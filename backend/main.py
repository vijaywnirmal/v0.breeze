#main.py

# main.py
import os
import json
import logging
import traceback
import time
import asyncio
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta, date, time as dt_time
from collections import defaultdict, deque
from pydantic_settings import BaseSettings
from pydantic import BaseModel, Field, validator

import pytz
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Breeze SDK (synchronous). We'll call its methods from a threadpool.
from breeze_connect import BreezeConnect

# ---------------------------
# Config
# ---------------------------
class Settings(BaseSettings):
    CORS_ORIGINS: str = "http://localhost:3000"
    SESSION_EXPIRY_HOURS: int = 24
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 3600  # seconds (server-side per-IP)
    BREEZE_LIMIT_REQUESTS: int = 100
    BREEZE_LIMIT_WINDOW: int = 60  # seconds (Breeze doc: 100/min)
    MARKET_CLOSE_HOUR: int = 15
    MARKET_CLOSE_MINUTE: int = 31  # treat >= 15:31 IST as market closed for the day
    MARKET_OPEN_HOUR: int = 9
    MARKET_OPEN_MINUTE: int = 30   # treat < 09:30 IST as market closed (use last trading day)
    # For maintainability, holidays should be externalized; kept here for demonstration
    HOLIDAY_YEAR_LIST: int = 2025

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# ---------------------------
# Logging
# ---------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("app.log"),
    ],
)
logger = logging.getLogger("breeze_api")

IST = pytz.timezone("Asia/Kolkata")

logger.info("Starting Breeze Trading API")
logger.info(f"CORS origins: {settings.CORS_ORIGINS.split(',')}")
logger.info(f"Session expiry hours: {settings.SESSION_EXPIRY_HOURS}")
logger.info(f"Server rate limit: {settings.RATE_LIMIT_REQUESTS} / {settings.RATE_LIMIT_WINDOW}s")
logger.info(f"Breeze rate limit: {settings.BREEZE_LIMIT_REQUESTS} / {settings.BREEZE_LIMIT_WINDOW}s")

# ---------------------------
# FastAPI app + CORS
# ---------------------------
app = FastAPI(title="Breeze Trading API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# Server-side rate limiting (per IP)
# NOTE: This is in-memory and per-process. For production multi-worker deployments use a shared store (Redis).
# ---------------------------
request_counts: Dict[str, deque] = defaultdict(lambda: deque())


def check_rate_limit_per_ip(client_ip: str) -> bool:
    """Return True if under limit, False if exceeded."""
    now_ts = time.time()
    window = settings.RATE_LIMIT_WINDOW
    dq = request_counts[client_ip]
    # Remove old timestamps
    while dq and now_ts - dq[0] >= window:
        dq.popleft()
    if len(dq) >= settings.RATE_LIMIT_REQUESTS:
        return False
    dq.append(now_ts)
    return True


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit_per_ip(client_ip):
        logger.warning(f"Rate limit exceeded for IP: {client_ip}")
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Try again later."})
    return await call_next(request)


# ---------------------------
# Breeze API rate limiting (global in-process)
# Using deque + asyncio.Lock to ensure safety within this process.
# ---------------------------
breeze_lock = asyncio.Lock()
breeze_request_times: deque = deque()


async def breeze_call(sync_func, *args, **kwargs):
    """
    Safely call a synchronous BreezeConnect function:
    - Enforce Breeze's rate limit in-process
    - Run the sync call in a threadpool (async-friendly)
    """
    async with breeze_lock:
        now_ts = time.time()
        # Purge old timestamps outside the window
        while breeze_request_times and now_ts - breeze_request_times[0] >= settings.BREEZE_LIMIT_WINDOW:
            breeze_request_times.popleft()
        if len(breeze_request_times) >= settings.BREEZE_LIMIT_REQUESTS:
            # Wait until oldest falls out of window
            wait_for = settings.BREEZE_LIMIT_WINDOW - (now_ts - breeze_request_times[0])
            wait_for = max(wait_for, 0.01)
            logger.info(f"Breeze rate limit reached. Sleeping {wait_for:.2f}s")
            await asyncio.sleep(wait_for)
            # purge again after sleeping
            now_ts = time.time()
            while breeze_request_times and now_ts - breeze_request_times[0] >= settings.BREEZE_LIMIT_WINDOW:
                breeze_request_times.popleft()

        loop = asyncio.get_running_loop()
        try:
            # Run the synchronous Breeze SDK function in a threadpool
            result = await loop.run_in_executor(None, lambda: sync_func(*args, **kwargs))
        except Exception:
            logger.error("Exception while calling Breeze sync method")
            logger.error(traceback.format_exc())
            raise
        # record timestamp for rate limit accounting
        breeze_request_times.append(time.time())
        return result


# ---------------------------
# Data models
# ---------------------------
class SessionData(BaseModel):
    api_key: str = Field(..., min_length=1)
    api_secret: str = Field(..., min_length=1)
    session_token: str = Field(..., min_length=1)

    @validator('api_key', 'api_secret', 'session_token')
    def strip_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Field cannot be empty")
        return v.strip()


class LogoutRequest(BaseModel):
    api_session: str = Field(..., min_length=1)


# ---------------------------
# Session store
# ---------------------------
class SessionStore:
    """
    In-memory session store. Each session entry:
    {
        "api_key": str,
        "api_secret": str,
        "breeze": BreezeConnect,
        "created_at": datetime,
        "expires_at": datetime,
        "customer_details": dict (optional)
    }
    """
    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.lock = asyncio.Lock()

    async def add_session(self, session_token: str, api_key: str, api_secret: str):
        """Create Breeze instance, generate session, and fetch & store customer details."""
        breeze = BreezeConnect(api_key=api_key)
        loop = asyncio.get_running_loop()
        try:
            # Breeze generate_session is synchronous, run in threadpool
            await loop.run_in_executor(None, lambda: breeze.generate_session(api_secret=api_secret, session_token=session_token))
        except Exception:
            logger.error("Failed to generate Breeze session during login.")
            logger.error(traceback.format_exc())
            raise

        created = datetime.now(IST)
        expires_at = created + timedelta(hours=settings.SESSION_EXPIRY_HOURS)
        customer_details = None
        try:
            # Respect Breeze rate limits when fetching customer details
            customer_details = await breeze_call(breeze.get_customer_details, api_session=session_token)
        except Exception as e:
            # Still create session even if customer fetch failed, but log
            logger.warning(f"Failed to fetch customer details during login: {e}")

        async with self.lock:
            self.sessions[session_token] = {
                "api_key": api_key,
                "api_secret": api_secret,
                "breeze": breeze,
                "created_at": created,
                "expires_at": expires_at,
                "customer_details": customer_details,
        }

    async def get_session(self, session_token: str) -> Optional[Dict[str, Any]]:
        async with self.lock:
            session = self.sessions.get(session_token)
            if not session:
                return None
            if datetime.now(IST) > session["expires_at"]:
                # expired
                del self.sessions[session_token]
                return None
            return session

    async def remove_session(self, session_token: str):
        async with self.lock:
            self.sessions.pop(session_token, None)

    async def cleanup_expired_sessions(self):
        async with self.lock:
            now = datetime.now(IST)
            expired = [t for t, s in self.sessions.items() if now > s["expires_at"]]
            for t in expired:
                del self.sessions[t]


session_store = SessionStore()

# ---------------------------
# Symbol mapping and indices
# ---------------------------
SYMBOL_MAPPING = {
    "NIFTY": "NIFTY",
    "SENSEX": "BSESEN",
    "BANKNIFTY": "CNXBAN",
    "FINNIFTY": "NIFFIN",
}

INDEX_LIST = [
    {"name": "NIFTY", "exchange": "NSE"},
    {"name": "BANKNIFTY", "exchange": "NSE"},
    {"name": "SENSEX", "exchange": "BSE"},
    {"name": "FINNIFTY", "exchange": "NSE"},
]


def get_index_display_name(symbol: str) -> str:
    names = {
        'NIFTY': 'NIFTY 50',
        'SENSEX': 'S&P BSE SENSEX',
        'BANKNIFTY': 'NIFTY BANK',
        'FINNIFTY': 'NIFTY FINANCIAL SERVICES'
    }
    return names.get(symbol, symbol)


def _to_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except Exception:
        return None


def calculate_change_percent(previous_close: Optional[float], current_close: Optional[float]) -> Tuple[Optional[float], Optional[float]]:
    if previous_close is not None and current_close is not None:
        change = round(current_close - previous_close, 2)
        percent = round((change / previous_close) * 100, 2) if previous_close != 0 else None
        return change, percent
    return None, None


# ---------------------------
# Holidays (2025) - load from JSON file trading_holidays_2025.json
# ---------------------------
def _parse_date_str(date_str: str) -> Optional[date]:
    try:
        # Accept ISO-like formats, take first 10 chars YYYY-MM-DD
        core = date_str.strip()[:10]
        return datetime.fromisoformat(core).date()
    except Exception:
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except Exception:
                continue
    return None


def _load_holidays_2025() -> set[date]:
    holidays: set[date] = set()
    try:
        json_path = os.path.join(os.path.dirname(__file__), "trading_holidays_2025.json")
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        # Support two shapes:
        # 1) Dict with keys: 'weekday_trading_holidays' (primary), 'weekend_non_trading_days' (informational)
        # 2) Flat list of strings or dicts with a 'date' field
        def add_date_str(s: str):
            dt = _parse_date_str(s)
            if dt:
                holidays.add(dt)

        if isinstance(data, dict):
            weekday_list = data.get("weekday_trading_holidays") or []
            for item in weekday_list:
                if isinstance(item, dict) and isinstance(item.get("date"), str):
                    add_date_str(item["date"])
            # Optionally include explicitly-listed weekend non-trading days (weekends are already closed)
            weekend_list = data.get("weekend_non_trading_days") or []
            for item in weekend_list:
                if isinstance(item, dict) and isinstance(item.get("date"), str):
                    add_date_str(item["date"])  # harmless; weekends are filtered elsewhere
        elif isinstance(data, list):
            for item in data:
                if isinstance(item, str):
                    add_date_str(item)
                elif isinstance(item, dict):
                    for key in ("date", "date_iso", "holiday_date", "Date"):
                        if key in item and isinstance(item[key], str):
                            add_date_str(item[key])
                            break
        else:
            logger.warning("Unexpected holidays JSON structure; expected dict or list")
    except FileNotFoundError:
        logger.warning("trading_holidays_2025.json not found; proceeding with no holidays loaded")
    except Exception as e:
        logger.warning(f"Failed to load holidays JSON: {e}")
        logger.debug(traceback.format_exc())
    logger.info(f"Loaded {len(holidays)} holidays for 2025 from JSON")
    return holidays


HOLIDAY_DATES_2025 = _load_holidays_2025()


def is_market_holiday(d: date) -> bool:
    return d in HOLIDAY_DATES_2025


def is_weekend(d: date) -> bool:
    return d.weekday() >= 5  # Sat=5, Sun=6


def is_market_closed_today(d: date) -> bool:
    return is_weekend(d) or is_market_holiday(d)


def find_last_market_day(d: date) -> date:
    """Return the most recent trading day on or before d (skipping weekends/holidays)."""
    counter = 0
    while True:
        if not is_market_closed_today(d):
            return d
        d = d - timedelta(days=1)
        counter += 1
        if counter > 3650:  # safety limit ~10 years
            raise ValueError("Could not find last market day within 10 years")


def find_previous_market_day(last_market_day: date) -> date:
    """Return the previous trading day before last_market_day."""
    d = last_market_day - timedelta(days=1)
    counter = 0
    while True:
        if not is_market_closed_today(d):
            return d
        d = d - timedelta(days=1)
        counter += 1
        if counter > 3650:
            raise ValueError("Could not find previous market day within 10 years")


def market_closed_now(now_ist: datetime) -> bool:
    """
    Market considered closed if:
    - Today is a weekend/holiday OR
    - Current IST time is before market open (09:30) OR
    - Current IST time is >= market close cutoff (15:31)
    """
    today = now_ist.date()
    if is_market_closed_today(today):
        return True
    open_cutoff = now_ist.replace(hour=settings.MARKET_OPEN_HOUR, minute=settings.MARKET_OPEN_MINUTE, second=0, microsecond=0)
    if now_ist < open_cutoff:
        return True
    close_cutoff = now_ist.replace(hour=settings.MARKET_CLOSE_HOUR, minute=settings.MARKET_CLOSE_MINUTE, second=0, microsecond=0)
    return now_ist >= close_cutoff


# ---------------------------
# Caches (in-memory). For multi-process deployments use Redis.
# - previous_close_cache: { (symbol, date_iso) : close }
# - today_close_cache: { symbol: {"close": float, "valid_until": datetime_ist} }
# - index_snapshot_cache: { symbol: {"currentClose": float, "previousClose": float, "timestamp": datetime_ist} }
# ---------------------------
previous_close_cache: Dict[str, Dict[str, Any]] = {}
today_close_cache: Dict[str, Dict[str, Any]] = {}
index_snapshot_cache: Dict[str, Dict[str, Any]] = {}


def set_previous_close_cache(symbol: str, market_day: date, close: float):
    key = f"{symbol}:{market_day.isoformat()}"
    previous_close_cache[key] = {"date": market_day, "close": close}


def get_previous_close_cache(symbol: str, market_day: date) -> Optional[float]:
    key = f"{symbol}:{market_day.isoformat()}"
    entry = previous_close_cache.get(key)
    if entry and entry.get("date") == market_day:
        return _to_float(entry.get("close"))
    return None


def set_today_close_cache(symbol: str, close: float, valid_until: datetime):
    today_close_cache[symbol] = {"close": close, "valid_until": valid_until}


def get_today_close_cache(symbol: str, now_ist: datetime) -> Optional[float]:
    entry = today_close_cache.get(symbol)
    if not entry:
        return None
    if now_ist <= entry.get("valid_until"):
        return _to_float(entry.get("close"))
    # expired
    today_close_cache.pop(symbol, None)
    return None


# ---------------------------
# Session dependency
# ---------------------------
async def get_session_or_401(api_session: str) -> Dict[str, Any]:
    await session_store.cleanup_expired_sessions()
    session_info = await session_store.get_session(api_session)
    if not session_info:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")
    return session_info


# ---------------------------
# Exception handler
# ---------------------------
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception for path {request.url.path}: {exc}")
    logger.error(traceback.format_exc())
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


# ---------------------------
# Routes
# ---------------------------
@app.post("/login")
async def login(data: SessionData):
    """
    Initialize session: create Breeze instance, generate session and fetch & store customer details.
    """
    try:
        short_key = data.api_key[:8] + "..." if len(data.api_key) > 8 else data.api_key
        logger.info(f"Login attempt for API key prefix: {short_key}")
        await session_store.add_session(data.session_token, data.api_key, data.api_secret)
        logger.info(f"Session created for token prefix: {data.session_token[:8]}...")
        return {"status": "session initialized"}
    except Exception as e:
        logger.error(f"Error initializing session: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=400, detail="Failed to initialize session")


@app.get("/account/details")
async def account_details(api_session: str):
    """
    Return stored customer details if available. If not available in session, attempt a Breeze fetch.
    """
    try:
        session_info = await get_session_or_401(api_session)
        if session_info.get("customer_details"):
            return {"status": "success", "customer": session_info["customer_details"]}
        # fallback: try to fetch live and update session
        breeze = session_info["breeze"]
        try:
            details = await breeze_call(breeze.get_customer_details, api_session=api_session)
            # update stored session
            async with session_store.lock:
                if api_session in session_store.sessions:
                    session_store.sessions[api_session]["customer_details"] = details
            return {"status": "success", "customer": details}
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to fetch customer details")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in account_details: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to get account details")


@app.get("/market/historical")
async def get_historical_data(api_session: str, symbol: str, exchange: str, from_date: str, to_date: str):
    """
    Returns 30-minute candles for specified range and the 15:30 (or last) close.
    """
    try:
        session_info = await get_session_or_401(api_session)
        breeze = session_info["breeze"]
        stock_code = SYMBOL_MAPPING.get(symbol, symbol)
        resp = await breeze_call(
            breeze.get_historical_data_v2,
            interval="30minute",
            from_date=from_date,
            to_date=to_date,
            stock_code=stock_code,
            exchange_code=exchange,
            product_type="cash"
        )
        candles = resp.get("Success", []) or []
        close_at_1530 = None
        for candle in candles:
            dtstr = candle.get("datetime")
            if not dtstr:
                continue
            try:
                iso = dtstr.replace(" ", "T")
                if iso.endswith("Z"):
                    iso = iso.replace("Z", "+00:00")
                candle_time = datetime.fromisoformat(iso)
            except Exception:
                try:
                    candle_time = datetime.fromisoformat(dtstr)
                except Exception:
                    continue
            candle_time = candle_time.astimezone(IST)
            if candle_time.hour == 15 and candle_time.minute == 30:
                close_at_1530 = candle.get("close")
                break
            elif candle_time.hour > 15:
                close_at_1530 = candle.get("close")
                break
        if close_at_1530 is None and candles:
            close_at_1530 = candles[-1].get("close")
        return {"Error": None, "Status": 200, "CloseAt1530": close_at_1530, "Candles": candles}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching historical data: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to get historical data for {symbol}")


@app.get("/market/indices")
async def get_market_indices(api_session: str):
    """
    Get current market indices with change calculations.
    All candle fetching uses interval="30minute".
    """
    try:
        session_info = await get_session_or_401(api_session)
        breeze_inst = session_info["breeze"]
        now_ist = datetime.now(IST)
        today_date = now_ist.date()

        is_closed_now = market_closed_now(now_ist)
        # Determine last market day and previous market day
        # last_market_day is the most recent trading day on or before today
        last_market_day = find_last_market_day(today_date)
        # current snapshot day: if market closed now -> last_market_day, else use today
        current_snapshot_day = last_market_day if is_closed_now else today_date
        prev_market_day = find_previous_market_day(last_market_day)

        async def fetch_last_candle(breeze, stock_code: str, exchange_code: str, day: date) -> Optional[Dict[str, Any]]:
            from_dt = f"{day.isoformat()}T00:00:01.000Z"
            to_dt = f"{day.isoformat()}T23:59:59.000Z"
            data = await breeze_call(
                breeze.get_historical_data_v2,
                interval="30minute",
                from_date=from_dt,
                to_date=to_dt,
                stock_code=stock_code,
                exchange_code=exchange_code,
                product_type="cash",
            )
            rows = data.get("Success") if isinstance(data, dict) else None
            if not rows:
                return None
            return rows[-1]

        # helper per-index to fetch prev & curr closes
        async def process_index(idx: Dict[str, str]) -> Dict[str, Any]:
            name = idx["name"]
            exchange = idx["exchange"]
            stock_code = SYMBOL_MAPPING.get(name, name)
            prev_close: Optional[float] = None
            curr_close: Optional[float] = None

            # If market closed and we have a same-day cached snapshot, reuse it
            cache_entry = index_snapshot_cache.get(name)
            if (
                cache_entry
                and cache_entry.get("timestamp")
                and cache_entry["timestamp"].date() == today_date
                and is_closed_now
            ):
                prev_close = _to_float(cache_entry.get("previousClose"))
                curr_close = _to_float(cache_entry.get("currentClose"))
            else:
                try:
                    current_candle_task = fetch_last_candle(breeze_inst, stock_code, exchange, current_snapshot_day)
                    prev_candle_task = fetch_last_candle(breeze_inst, stock_code, exchange, prev_market_day)
                    current_candle, prev_candle = await asyncio.gather(current_candle_task, prev_candle_task)
                    if not current_candle or not prev_candle:
                        logger.warning(f"Missing candle data for {name}: current={bool(current_candle)} prev={bool(prev_candle)}")
                    curr_close = _to_float(current_candle.get("close")) if current_candle else None
                    prev_close = _to_float(prev_candle.get("close")) if prev_candle else None
                except Exception as e:
                    logger.error(f"Error fetching 30min last candles for {name}: {e}")
                    logger.error(traceback.format_exc())

            # Cache snapshot for closed market to avoid recompute on subsequent calls same day
            if is_closed_now and curr_close is not None and prev_close is not None:
                index_snapshot_cache[name] = {
                    "currentClose": curr_close,
                    "previousClose": prev_close,
                    "timestamp": now_ist,
                }

            change, percent_change = calculate_change_percent(prev_close, curr_close)
            is_positive = change is not None and change >= 0

            return {
                "symbol": name,
                "displayName": get_index_display_name(name),
                "previousClose": prev_close,
                "currentClose": curr_close,
                "change": change,
                "percentChange": percent_change,
                "isPositive": is_positive,
                "marketClosed": is_closed_now,
                "lastTradingDay": last_market_day.isoformat() if is_closed_now else None,
            }

        # Run all indices concurrently
        tasks = [process_index(idx) for idx in INDEX_LIST]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        data = []
        for r in results:
            if isinstance(r, Exception):
                logger.error("One index task failed: %s", r)
                data.append({
                    "symbol": None,
                    "displayName": None,
                    "previousClose": None,
                    "currentClose": None,
                    "change": None,
                    "percentChange": None,
                    "isPositive": None,
                    "marketClosed": None,
                    "lastTradingDay": None,
                })
            else:
                data.append(r)
        return {"status": "success", "data": data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching market indices: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to get market indices")


@app.post("/logout")
async def logout(request: LogoutRequest):
    try:
        await session_store.remove_session(request.api_session)
        return {"status": "logged out successfully"}
    except Exception as e:
        logger.error(f"Error during logout: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to logout")


@app.get("/health")
async def health_check():
    active_sessions = len(session_store.sessions)
    return {
        "status": "healthy",
        "timestamp": datetime.now(IST).isoformat(),
        "active_sessions": active_sessions,
        "session_expiry_hours": settings.SESSION_EXPIRY_HOURS
    }


@app.get("/test-breeze")
async def test_breeze_api(api_session: str):
    try:
        session_info = await get_session_or_401(api_session)
        breeze_inst = session_info["breeze"]
        today = datetime.now(IST).date()
        from_date = f"{today.isoformat()}T00:00:01.000Z"
        to_date = f"{today.isoformat()}T23:59:59.000Z"
        resp = await breeze_call(
            breeze_inst.get_historical_data_v2,
            interval="30minute",
            from_date=from_date,
            to_date=to_date,
            stock_code="NIFTY",
            exchange_code="NSE",
            product_type="cash"
        )
        return {"status": "success", "response": resp, "timestamp": datetime.now(IST).isoformat()}
    except Exception as e:
        logger.error(f"Breeze API test failed: {e}")
        logger.error(traceback.format_exc())
        return {"status": "error", "error": str(e), "timestamp": datetime.now(IST).isoformat()}