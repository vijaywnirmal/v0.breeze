#main.py

# main.py
import os
import json
import logging
import traceback
import time
import asyncio
import uuid
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta, date, time as dt_time
from collections import defaultdict, deque
from pydantic_settings import BaseSettings
from pydantic import BaseModel, Field, validator

import pytz
from fastapi import FastAPI, HTTPException, Request, Depends, Query
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

# Breeze SDK (synchronous). We'll call its methods from a threadpool.
from breeze_connect import BreezeConnect
from schemas import ScreenerRequest, PaginatedResponse, SortOrder
from utils.market_utils import calculate_rsi_14, calculate_macd

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
    MARKET_CLOSE_MINUTE: int = 30  # treat >= 15:30 IST as market closed for the day
    MARKET_OPEN_HOUR: int = 9
    MARKET_OPEN_MINUTE: int = 15   # treat < 09:15 IST as market closed (use last trading day)
    # For maintainability, holidays should be externalized; kept here for demonstration
    HOLIDAY_YEAR_LIST: int = 2025
    # Optional service credentials used by scheduled compute
    SERVICE_API_KEY: Optional[str] = None
    SERVICE_API_SECRET: Optional[str] = None
    SERVICE_SESSION_TOKEN: Optional[str] = None

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

# Suppress verbose Breeze SDK logs
logging.getLogger("APILogger").setLevel(logging.WARNING)
logging.getLogger("WebsocketLogger").setLevel(logging.WARNING)

IST = pytz.timezone("Asia/Kolkata")

logger.info("Starting Breeze Trading API")
logger.info(f"CORS origins: {settings.CORS_ORIGINS.split(',')}")
logger.info(f"Session expiry hours: {settings.SESSION_EXPIRY_HOURS}")
logger.info(f"Server rate limit: {settings.RATE_LIMIT_REQUESTS} / {settings.RATE_LIMIT_WINDOW}s")
logger.info(f"Breeze rate limit: {settings.BREEZE_LIMIT_REQUESTS} / {settings.BREEZE_LIMIT_WINDOW}s")

# ---------------------------
# FastAPI app + CORS
# ---------------------------
app = FastAPI(title="Breeze Trading API", version="2.2.0")

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
    # Try to respect proxy headers for real client IP
    client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or (
        request.client.host if request.client else "unknown"
    )
    if not check_rate_limit_per_ip(client_ip):
        logger.warning(f"Rate limit exceeded for IP: {client_ip}")
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Try again later."})
    return await call_next(request)


# ---------------------------
# Request ID + basic timing metrics
# ---------------------------
from collections import defaultdict as _defaultdict

request_metrics: Dict[str, Any] = {
    "total_requests": 0,
    "per_path": _defaultdict(lambda: {"count": 0, "durations_ms": deque(maxlen=1000)}),
}


@app.middleware("http")
async def request_id_and_timing_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    start = time.perf_counter()
    try:
        response = await call_next(request)
    finally:
        duration_ms = (time.perf_counter() - start) * 1000.0
        path = request.url.path
        try:
            request_metrics["total_requests"] += 1
            bucket = request_metrics["per_path"][path]
            bucket["count"] += 1
            bucket["durations_ms"].append(duration_ms)
        except Exception:
            pass
    response.headers["X-Request-ID"] = request_id
    return response


@app.on_event("startup")
async def on_startup():
    # Load instruments into memory on startup
    try:
        await load_instruments_into_memory()
        logger.info(f"Loaded {len(INSTRUMENTS)} instruments into memory")
    except Exception as e:
        logger.error(f"Instrument load failed: {e}")
        logger.error(traceback.format_exc())
    # Try to start APScheduler for daily compute
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
        scheduler = AsyncIOScheduler(timezone=str(IST))
        trigger = CronTrigger(day_of_week='mon-fri', hour=15, minute=40)
        scheduler.add_job(build_screener_cache_job, trigger, id='daily_screener_build', replace_existing=True)
        scheduler.start()
        logger.info("APScheduler started: daily screener build at 15:40 IST, Mon–Fri")
    except Exception as e:
        logger.warning(f"APScheduler not started: {e}")
        logger.debug(traceback.format_exc())
    # If service credentials exist and market is open, bring up WS for indices
    try:
        breeze = await get_service_breeze()
        if breeze:
            now_ist = datetime.now(IST)
            if not market_closed_now(now_ist):
                await WS_MANAGER.ensure_connected(breeze)
                await WS_MANAGER.subscribe_indices()
                logger.info("Initialized Breeze WS indices on startup (market open)")
    except Exception:
        logger.warning("Failed to initialize WS on startup")
        logger.debug(traceback.format_exc())


# ---------------------------
# Market status helper
# ---------------------------
def get_market_status_backend(now_ist: Optional[datetime] = None) -> Dict[str, Any]:
    if now_ist is None:
        now_ist = datetime.now(IST)
    today = now_ist.date()
    is_holiday_today = is_market_holiday(today)
    is_weekend_today = is_weekend(today)

    open_time = now_ist.replace(
        hour=settings.MARKET_OPEN_HOUR,
        minute=settings.MARKET_OPEN_MINUTE,
        second=0,
        microsecond=0,
    )
    close_cutoff = now_ist.replace(
        hour=settings.MARKET_CLOSE_HOUR,
        minute=settings.MARKET_CLOSE_MINUTE,
        second=0,
        microsecond=0,
    )

    closed_now = market_closed_now(now_ist)
    status = "open"
    if closed_now:
        status = "pre-open" if now_ist < open_time and not (is_weekend_today or is_holiday_today) else "closed"

    # determine next open time
    if status == "open":
        next_market_open_iso = None
    else:
        next_day = today
        if now_ist >= close_cutoff:
            next_day = today + timedelta(days=1)
        # advance to next trading day
        while True:
            if not is_market_closed_today(next_day):
                break
            next_day += timedelta(days=1)
        next_open_dt = datetime.combine(next_day, dt_time(settings.MARKET_OPEN_HOUR, settings.MARKET_OPEN_MINUTE, 0)).astimezone(IST)
        next_market_open_iso = next_open_dt.isoformat()

    last_market_day = find_last_market_day(today)

    return {
        "is_market_open": not closed_now,
        "status": status,
        "current_time": now_ist.isoformat(),
        "market_open_time": dt_time(settings.MARKET_OPEN_HOUR, settings.MARKET_OPEN_MINUTE).isoformat(),
        "market_close_cutoff": dt_time(settings.MARKET_CLOSE_HOUR, settings.MARKET_CLOSE_MINUTE).isoformat(),
        "current_day": now_ist.strftime("%A"),
        "is_weekend": is_weekend_today,
        "is_holiday": is_holiday_today,
        "last_trading_day": last_market_day.isoformat(),
        "next_market_open": next_market_open_iso,
    }


@app.get("/market/status")
async def market_status():
    # Also manage WS lifecycle heuristically based on market status
    status = get_market_status_backend()
    try:
        breeze = await get_service_breeze()
        if breeze:
            if status.get("is_market_open"):
                await WS_MANAGER.ensure_connected(breeze)
                await WS_MANAGER.subscribe_indices()
            else:
                await WS_MANAGER.disconnect()
    except Exception:
        logger.debug("WS lifecycle handling in /market/status failed")
    return status


@app.get("/stream/indices")
async def stream_indices(api_session: str | None = Query(None)):
    """
    Server-Sent Events stream of index updates. Uses Breeze WS under the hood.
    Auto-connects WS when market open; otherwise streams a single snapshot and heartbeats.
    """
    # Ensure we have a breeze instance and WS if market open
    now = datetime.now(IST)
    try:
        breeze = await get_breeze_or_401(api_session)
        if not market_closed_now(now):
            await WS_MANAGER.ensure_connected(breeze)
            await WS_MANAGER.subscribe_indices()
    except HTTPException:
        raise
    except Exception:
        logger.debug("Failed to ready WS for SSE")

    async def event_generator():
        queue = await WS_MANAGER.add_subscriber()
        try:
            while True:
                # Emit next queued update, or a periodic snapshot every 1s
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=1.0)
                    payload = item
                except asyncio.TimeoutError:
                    payload = WS_MANAGER.build_snapshot()
                yield f"data: {json.dumps(payload, default=str)}\n\n".encode("utf-8")
        except asyncio.CancelledError:
            pass
        finally:
            WS_MANAGER.remove_subscriber(queue)

    headers = {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "text/event-stream",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_generator(), headers=headers)


@app.get("/stream/screener")
async def stream_screener(api_session: str | None = Query(None), symbols: str | None = Query(None)):
    """
    SSE stream for live screener rows. Provide comma-separated `symbols` (short_name) to subscribe.
    When market is closed, uses historical data instead of WebSocket.
    """
    now = datetime.now(IST)
    is_market_closed = market_closed_now(now)
    
    try:
        breeze = await get_breeze_or_401(api_session)
        sym_list = [s.strip().upper() for s in (symbols.split(",") if symbols else []) if s.strip()]
        logger.info(f"SSE screener stream requested for symbols: {sym_list} (market_closed: {is_market_closed})")
        
        if not is_market_closed:
            # Only connect WebSocket when market is open
            await WS_MANAGER.ensure_connected(breeze)
            if sym_list:
                await WS_MANAGER.subscribe_screener_symbols(sym_list)
        else:
            # When market is closed, immediately fetch historical data
            if sym_list:
                await WS_MANAGER.fetch_screener_fallback_prices(sym_list)
                
    except HTTPException:
        raise
    except Exception:
        logger.debug("Failed to ready WS for screener SSE")

    async def event_generator():
        sym_list = [s.strip().upper() for s in (symbols.split(",") if symbols else []) if s.strip()]
        queue = await WS_MANAGER.add_screener_subscriber(sym_list)
        last_fallback_update = 0
        try:
            while True:
                # Emit next queued update, or a periodic snapshot every 1s
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=1.0)
                    payload = item
                except asyncio.TimeoutError:
                    payload = WS_MANAGER.build_screener_snapshot(frozenset(sym_list))
                    
                    # Fetch updated prices: every 10s when market open, every 30s when closed
                    current_time = time.time()
                    update_interval = 30 if is_market_closed else 10
                    if current_time - last_fallback_update > update_interval:
                        try:
                            await WS_MANAGER.fetch_screener_fallback_prices(sym_list)
                            last_fallback_update = current_time
                            # Rebuild snapshot with fresh data
                            payload = WS_MANAGER.build_screener_snapshot(frozenset(sym_list))
                        except Exception:
                            pass
                
                yield f"data: {json.dumps(payload, default=str)}\n\n".encode("utf-8")
        except asyncio.CancelledError:
            pass
        finally:
            WS_MANAGER.remove_screener_subscriber(queue)

    headers = {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "text/event-stream",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_generator(), headers=headers)


# ---------------------------
# Health and readiness
# ---------------------------
@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/readyz")
async def readyz():
    # Basic readiness: instruments loaded
    try:
        inst_count = len(INSTRUMENTS)
        return {"status": "ready", "instruments": inst_count}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "not_ready"})


@app.get("/metrics/basic")
async def basic_metrics():
    # Provide small summary to avoid heavy payloads
    summary = {
        "total_requests": request_metrics.get("total_requests", 0),
        "paths": {},
    }
    per_path = request_metrics.get("per_path", {})
    for path, data in per_path.items():
        durations = list(data.get("durations_ms", []))
        if durations:
            durations_sorted = sorted(durations)
            p50 = durations_sorted[len(durations_sorted)//2]
            p90 = durations_sorted[int(len(durations_sorted)*0.9)-1]
            p99 = durations_sorted[int(len(durations_sorted)*0.99)-1] if len(durations_sorted) > 1 else durations_sorted[-1]
            avg = sum(durations)/len(durations)
        else:
            p50 = p90 = p99 = avg = 0.0
        summary["paths"][path] = {
            "count": data.get("count", 0),
            "avg_ms": round(avg, 2),
            "p50_ms": round(p50, 2),
            "p90_ms": round(p90, 2),
            "p99_ms": round(p99, 2),
        }
    return summary


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

# Some indices have multiple accepted stock_code variants in Breeze
INDEX_CODE_CANDIDATES: Dict[str, list[str]] = {
    "NIFTY": ["NIFTY"],
    "BANKNIFTY": ["CNXBAN", "BANKNIFTY"],
    "FINNIFTY": ["NIFFIN", "FINNIFTY"],
    "SENSEX": ["BSESEN", "SENSEX"],
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


def _iso_utc(dt: datetime) -> str:
    # Return ISO string with Z
    s = dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    return s


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
# Caches (in-memory)
# ---------------------------
previous_close_cache: Dict[str, Dict[str, Any]] = {}
today_close_cache: Dict[str, Dict[str, Any]] = {}
index_snapshot_cache: Dict[str, Dict[str, Any]] = {}

# In-memory instruments and screener snapshot
INSTRUMENTS: list[Dict[str, Any]] = []
COMPANY_TO_SHORT: Dict[str, str] = {}
COMPANY_TO_SHORT_NORM: Dict[str, str] = {}

# ---------------------------
# Breeze WebSocket live quotes (indices)
# ---------------------------
class LiveIndexQuote(BaseModel):
    symbol: str
    name: str
    last: Optional[float] = None
    prev_close: Optional[float] = None
    change: Optional[float] = None
    percent_change: Optional[float] = None
    updated_at: Optional[datetime] = None


class BreezeWSManager:
    """
    Manages a single Breeze websocket connection and live subscriptions for indices.
    Uses exchange quotes stream to compute live last and change against previous close.
    """
    def __init__(self):
        self._lock = asyncio.Lock()
        self._connected = False
        self._breeze: Optional[BreezeConnect] = None
        self._live: Dict[str, LiveIndexQuote] = {}
        self._subscribers: set[asyncio.Queue] = set()
        # Screener live quotes keyed by short_name (e.g., RELIANCE, TCS)
        self._screener_live: Dict[str, Dict[str, Any]] = {}
        # Subscribers for screener with symbol filters
        self._screener_subscribers: set[tuple[asyncio.Queue, frozenset[str]]] = set()
        # Map short_name -> (exchange_code, stock_code) for active subscriptions
        self._screener_sub_map: Dict[str, tuple[str, str]] = {}
        # Map of index names to their subscription params
        self._subs: Dict[str, Dict[str, str]] = {
            "NIFTY": {"exchange_code": "NSE", "stock_code": "NIFTY"},
            "BANKNIFTY": {"exchange_code": "NSE", "stock_code": "CNXBAN"},
            "FINNIFTY": {"exchange_code": "NSE", "stock_code": "NIFFIN"},
            "SENSEX": {"exchange_code": "BSE", "stock_code": "BSESEN"},
        }

    def _handle_tick(self, tick: Dict[str, Any]) -> None:
        try:
            stock_name = str(tick.get("stock_name") or "").upper()
            
            # Handle indices first
            name_map = {
                "NIFTY 50": "NIFTY",
                "NIFTY BANK": "BANKNIFTY",
                "NIFTY FINANCIAL SERVICES": "FINNIFTY",
                "NIFTY FINANCIAL SERVICES INDEX": "FINNIFTY",
                "S&P BSE SENSEX": "SENSEX",
                "BSE SENSEX": "SENSEX",
                "SENSEX": "SENSEX",
            }
            
            idx_key: Optional[str] = None
            if stock_name:
                for k, v in name_map.items():
                    if k in stock_name:
                        idx_key = v
                        break
            
            # Fallback by exchange_code + stock_code when present
            if not idx_key:
                exch = str(tick.get("exchange") or tick.get("exchange_code") or "").upper()
                sym = str(tick.get("symbol") or "").upper()
                if "SENSEX" in sym or (exch.startswith("BSE") and "SENSEX" in stock_name):
                    idx_key = "SENSEX"
            
            # If this is an index tick, handle it and return
            if idx_key:
                last = tick.get("last")
                prev_close = tick.get("close")
                last_f = float(last) if last is not None else None
                prev_f = float(prev_close) if prev_close is not None else None
                change = None
                pct = None
                if last_f is not None and prev_f not in (None, 0):
                    change = round(last_f - prev_f, 2)
                    pct = round((change / prev_f) * 100.0, 2)

                li = self._live.get(idx_key) or LiveIndexQuote(
                    symbol=idx_key,
                    name=get_index_display_name(idx_key),
                )
                li.last = last_f if last_f is not None else li.last
                li.prev_close = prev_f if prev_f is not None else li.prev_close
                li.change = change if change is not None else li.change
                li.percent_change = pct if pct is not None else li.percent_change
                li.updated_at = datetime.now(IST)
                self._live[idx_key] = li
                
                # Broadcast to subscribers (best-effort)
                snapshot = self.build_snapshot()
                for q in list(self._subscribers):
                    try:
                        q.put_nowait(snapshot)
                    except Exception:
                        pass
                return  # Exit early for index ticks

            # Handle screener symbols: map tick's stock_name to our short_name via COMPANY_TO_SHORT
            screener_key: Optional[str] = None
            if stock_name:
                # Try exact match first
                short_guess = COMPANY_TO_SHORT.get(stock_name)
                if not short_guess:
                    # Try normalized match
                    def _norm(s: str) -> str:
                        u = s.upper()
                        for suf in [" LIMITED", " LTD", ".", ",", " LIMITED."]:
                            u = u.replace(suf, "")
                        import re
                        u = re.sub(r"[^A-Z0-9 ]+", "", u)
                        u = re.sub(r"\s+", " ", u).strip()
                        return u
                    norm_name = _norm(stock_name)
                    short_guess = COMPANY_TO_SHORT_NORM.get(norm_name)
                
                if short_guess:
                    screener_key = short_guess
                else:
                    # Try to find a partial match for Reliance
                    if "RELIANCE" in stock_name and "INDUSTRIES" in stock_name:
                        screener_key = "RELIND"
            
            # Also try to match by stock_code if available
            if not screener_key:
                stock_code = str(tick.get("stock_code") or "").upper()
                if stock_code:
                    # Check if this stock_code maps to any of our screener symbols
                    for short_name in ["RELIND", "TCS"]:
                        exch, code = self._resolve_symbol_to_breeze(short_name)
                        if code and code.upper() == stock_code:
                            screener_key = short_name
                            break
            
            if screener_key:
                last = tick.get("last")
                prev_close = tick.get("close")
                sc_last = float(last) if last is not None else None
                sc_prev = float(prev_close) if prev_close is not None else None
                
                # Volume from exchange quotes: use total traded quantity (ttq) if available
                sc_vol = None
                try:
                    tv = tick.get("ttq")
                    if tv is not None:
                        sc_vol = int(tv)
                except Exception:
                    sc_vol = None
                
                ch = None
                pct = None
                if sc_last is not None and sc_prev not in (None, 0):
                    ch = round(sc_last - sc_prev, 2)
                    pct = round((ch / sc_prev) * 100.0, 2)
                
                self._screener_live[screener_key] = {
                    "last": sc_last,
                    "prev": sc_prev,
                    "change": ch,
                    "pct": pct,
                    "volume": sc_vol,
                    "updated_at": datetime.now(IST),
                }
                
                # Broadcast to screener subscribers with matching filters
                for (q, symbols) in list(self._screener_subscribers):
                    if screener_key in symbols:
                        try:
                            q.put_nowait(self.build_screener_snapshot(symbols))
                        except Exception:
                            pass
        except Exception as e:
            logger.error(f"Failed to parse WS tick: {tick}, error: {e}")
            logger.error(traceback.format_exc())

    async def ensure_connected(self, breeze: BreezeConnect) -> None:
        async with self._lock:
            # Reuse existing connection if same instance and connected
            if self._connected and self._breeze is breeze:
                return
            # If another instance, disconnect previous
            try:
                if self._connected and self._breeze:
                    self._breeze.ws_disconnect()
            except Exception:
                pass
            self._breeze = breeze
            # Assign callback first
            def _on_ticks(ticks: Dict[str, Any]):
                self._handle_tick(ticks)
            self._breeze.on_ticks = _on_ticks
            # Connect (sync SDK call)
            try:
                self._breeze.ws_connect()
                self._connected = True
                logger.info("Breeze WS connected")
            except Exception:
                self._connected = False
                logger.error("Failed to connect Breeze WS")
                logger.error(traceback.format_exc())
                raise

    async def subscribe_indices(self) -> None:
        async with self._lock:
            if not (self._connected and self._breeze):
                return
            for key, params in self._subs.items():
                try:
                    self._breeze.subscribe_feeds(
                        exchange_code=params["exchange_code"],
                        stock_code=params["stock_code"],
                        product_type="cash",
                        get_market_depth=False,
                        get_exchange_quotes=True,
                    )
                    # For SENSEX, also attempt alternate code subscription
                    if key == "SENSEX":
                        try:
                            self._breeze.subscribe_feeds(
                                exchange_code="BSE",
                                stock_code="SENSEX",
                                product_type="cash",
                                get_market_depth=False,
                                get_exchange_quotes=True,
                            )
                        except Exception:
                            pass
                    # initialize placeholder if not present
                    if key not in self._live:
                        self._live[key] = LiveIndexQuote(symbol=key, name=get_index_display_name(key))
                    logger.info("Subscribed WS quotes for %s", key)
                except Exception:
                    logger.warning("Failed WS subscribe for %s", key)

    def get_live(self, key: str) -> Optional[LiveIndexQuote]:
        li = self._live.get(key)
        if not li:
            return None
        # consider stale if older than 120 seconds
        if li.updated_at and (datetime.now(IST) - li.updated_at).total_seconds() <= 120:
            return li
        return None

    async def disconnect(self) -> None:
        async with self._lock:
            if self._connected and self._breeze:
                try:
                    self._breeze.ws_disconnect()
                except Exception:
                    pass
            self._connected = False

    def build_snapshot(self) -> Dict[str, Any]:
        """Return a lightweight snapshot for all indices we track."""
        out = []
        for key in ["NIFTY", "BANKNIFTY", "SENSEX", "FINNIFTY"]:
            li = self._live.get(key)
            if not li:
                continue
            prev = li.prev_close
            curr = li.last
            ch = None
            pct = None
            if curr is not None and prev not in (None, 0):
                ch = round(curr - prev, 2)
                pct = round((ch / prev) * 100.0, 2)
            out.append({
                "symbol": key,
                "displayName": get_index_display_name(key),
                "previousClose": prev,
                "currentClose": curr,
                "change": ch,
                "percentChange": pct,
                "isPositive": (ch is not None and ch >= 0),
            })
        return {"status": "success", "data": out, "ts": datetime.now(IST).isoformat()}

    def build_screener_snapshot(self, symbols: frozenset[str]) -> Dict[str, Any]:
        rows: list[dict[str, Any]] = []
        sym_set = set(symbols)
        for sym in sym_set:
            live = self._screener_live.get(sym)
            if not live:
                continue
            rows.append({
                "short_name": sym,
                "close_price": live.get("last"),
                "prev_close_price": live.get("prev"),
                "change_abs": live.get("change"),
                "change_pct": live.get("pct"),
                "volume": live.get("volume"),
            })
        return {"status": "success", "items": rows, "ts": datetime.now(IST).isoformat()}

    async def add_subscriber(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers.add(q)
        # Push an initial snapshot if available
        try:
            snap = self.build_snapshot()
            await q.put(snap)
        except Exception:
            pass
        return q

    def remove_subscriber(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    async def subscribe_screener_symbols(self, symbols: list[str]) -> None:
        async with self._lock:
            if not (self._connected and self._breeze):
                return
            logger.info(f"Subscribing to screener symbols: {symbols}")
            for sym in symbols:
                code = sym.upper().strip()
                exch, stock_code = self._resolve_symbol_to_breeze(code)
                logger.info(f"Resolved {code} -> ({exch}, {stock_code})")
                if not stock_code or not exch:
                    logger.warning(f"Could not resolve screener symbol: {code}")
                    continue
                try:
                    # Fix: Ensure all parameters are strings
                    self._breeze.subscribe_feeds(
                        exchange_code=str(exch), 
                        stock_code=str(stock_code), 
                        product_type="cash", 
                        get_market_depth=False, 
                        get_exchange_quotes=True
                    )
                    if code not in self._screener_live:
                        self._screener_live[code] = {"last": None, "prev": None, "change": None, "pct": None, "volume": None}
                    self._screener_sub_map[code] = (exch, stock_code)
                    logger.info("Subscribed WS quotes for screener symbol %s -> (%s, %s)", code, exch, stock_code)
                except Exception as e:
                    logger.error("Failed WS subscribe for screener symbol %s: %s", code, e)
                    logger.error(traceback.format_exc())

    # Add a fallback method to fetch live prices via REST API when WebSocket fails
    async def fetch_screener_fallback_prices(self, symbols: list[str]) -> None:
        """Fallback to fetch prices - live quotes when market open, historical data when closed"""
        if not self._breeze:
            return
            
        now_ist = datetime.now(IST)
        is_market_closed = market_closed_now(now_ist)
        
        for sym in symbols:
            try:
                exch, stock_code = self._resolve_symbol_to_breeze(sym)
                if not stock_code or not exch:
                    continue
                
                if is_market_closed:
                    # When market is closed, use historical data
                    today = now_ist.date()
                    last_market_day = find_last_market_day(today)
                    
                    # Get the last candle from the most recent trading day
                    try:
                        current_candle = await fetch_last_candle(self._breeze, stock_code, exch, last_market_day)
                        prev_market_day = find_last_market_day(last_market_day - timedelta(days=1))
                        prev_candle = await fetch_last_candle(self._breeze, stock_code, exch, prev_market_day)
                        
                        if current_candle and prev_candle:
                            last_f = _to_float(current_candle.get("close"))
                            prev_f = _to_float(prev_candle.get("close"))
                            vol_f = int(current_candle.get("volume") or 0)
                            
                            ch = None
                            pct = None
                            if last_f is not None and prev_f not in (None, 0):
                                ch = round(last_f - prev_f, 2)
                                pct = round((ch / prev_f) * 100.0, 2)
                            
                            self._screener_live[sym] = {
                                "last": last_f,
                                "prev": prev_f,
                                "change": ch,
                                "pct": pct,
                                "volume": vol_f,
                                "updated_at": datetime.now(IST),
                            }
                    except Exception as e:
                        logger.debug(f"Historical data fallback failed for {sym}: {e}")
                else:
                    # When market is open, use live quotes
                    quote_resp = self._breeze.get_quotes(
                        stock_code=stock_code,
                        exchange_code=exch,
                        expiry_date="",
                        product_type="cash",
                        right="others",
                        strike_price=""
                    )
                    
                    if quote_resp and quote_resp.get("Success"):
                        data = quote_resp.get("Result", {})
                        if data:
                            last = data.get("ltp")
                            prev_close = data.get("close")
                            volume = data.get("total_quantity_traded")
                            
                            last_f = float(last) if last is not None else None
                            prev_f = float(prev_close) if prev_close is not None else None
                            vol_f = int(volume) if volume is not None else None
                            
                            ch = None
                            pct = None
                            if last_f is not None and prev_f not in (None, 0):
                                ch = round(last_f - prev_f, 2)
                                pct = round((ch / prev_f) * 100.0, 2)
                            
                            self._screener_live[sym] = {
                                "last": last_f,
                                "prev": prev_f,
                                "change": ch,
                                "pct": pct,
                                "volume": vol_f,
                                "updated_at": datetime.now(IST),
                            }
                
                # Broadcast to screener subscribers
                for (q, symbols_filter) in list(self._screener_subscribers):
                    if sym in symbols_filter:
                        try:
                            q.put_nowait(self.build_screener_snapshot(symbols_filter))
                        except Exception:
                            pass
                                
            except Exception as e:
                logger.debug(f"Fallback price fetch failed for {sym}: {e}")

    def _resolve_symbol_to_breeze(self, short_name: str) -> tuple[Optional[str], Optional[str]]:
        # First, try exact short_name known normalizations used by normalize_stock_code
        sn = short_name.upper().strip()
        # Map common cases
        if sn in {"RELIND", "RELIANCE", "RIL", "RELI"}:
            return "NSE", "RELIND"  # Change this to RELIND instead of RELIANCE
        if sn == "TCS":
            return "NSE", "TCS"
        # Try to infer from instruments list
        for inst in INSTRUMENTS:
            if (inst.get("short_name") or "").upper().strip() == sn:
                # Prefer NSE when available
                exch = (inst.get("exchange_code") or "NSE").upper()
                # stock_code candidates
                for code in normalize_stock_code(inst.get("short_name"), inst.get("exchange_code"), inst.get("company_name")):
                    # Skip non-alpha codes that are obviously not tradable short codes
                    if code.isalpha():
                        result = ("NSE" if exch != "BSE" else "BSE"), code
                        logger.info(f"Resolved symbol '{short_name}' -> ({result[0]}, {result[1]})")
                        return result
        logger.warning(f"Could not resolve symbol '{short_name}' to exchange and stock_code")
        return None, None

    async def add_screener_subscriber(self, symbols: list[str]) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        syms = frozenset(s.upper().strip() for s in symbols if s)
        self._screener_subscribers.add((q, syms))
        # Push initial snapshot
        try:
            snap = self.build_screener_snapshot(syms)
            await q.put(snap)
        except Exception:
            pass
        return q

    def remove_screener_subscriber(self, q: asyncio.Queue) -> None:
        self._screener_subscribers = {(qq, s) for (qq, s) in self._screener_subscribers if qq is not q}


WS_MANAGER = BreezeWSManager()
SCREENER_CACHE: Dict[str, Any] = {
    "snapshot_date": None,
    "items": [],  # list[dict]
}


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


# Prefer user session Breeze, else fall back to service Breeze if configured
async def get_breeze_or_401(api_session: Optional[str]) -> BreezeConnect:
    if api_session:
        try:
            await session_store.cleanup_expired_sessions()
            sess = await session_store.get_session(api_session)
            if sess and sess.get("breeze"):
                return sess["breeze"]
        except Exception:
            pass
    service = await get_service_breeze()
    if service:
        return service
    raise HTTPException(status_code=401, detail="Invalid or expired session token")

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
        # Return customer details directly to save a follow-up request
        session_info = await session_store.get_session(data.session_token)
        customer_details = session_info.get("customer_details") if session_info else None
        return {
            "status": "session initialized",
            "api_session": data.session_token,
            "customer": customer_details,
        }
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
            interval="30minute",  # Changed back from 5minute to 30minute
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
async def get_market_indices(api_session: str | None = Query(None)):
    """
    Get current market indices with change calculations.
    All candle fetching uses interval="30minute".  # Updated comment back
    """
    try:
        breeze_inst = await get_breeze_or_401(api_session)
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
                interval="30minute",  # Changed back from 5minute to 30minute
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
                # If market is open and WS live quote is fresh, prefer it over REST
                live = WS_MANAGER.get_live(name) if not is_closed_now else None
                if live and live.last is not None and live.prev_close is not None:
                    curr_close = live.last
                    prev_close = live.prev_close
                else:
                    # When closed, always use last 30-minute candles to avoid polling
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


@app.get("/stocks/eod-screener", response_model=PaginatedResponse)
@app.get("/api/stocks/eod-screener", response_model=PaginatedResponse)
async def eod_screener(
    request: Request,
    api_session: str = Query(..., description="Session token for Breeze-backed auth"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    # Filters
    min_price: float | None = None,
    max_price: float | None = None,
    min_change_pct: float | None = None,
    max_change_pct: float | None = None,
    min_volume: int | None = None,
    min_week_vol_diff_pct: float | None = Query(None, alias="min_1w_avg_vol_diff_pct"),
    exchange: str | None = None,
    is_active: bool | None = True,
    min_rsi_14: float | None = None,
    max_rsi_14: float | None = None,
    sort_field: str = Query("change_pct"),
    sort_order: SortOrder = Query(SortOrder.DESC),
):
    try:
        await get_session_or_401(api_session)
        items = SCREENER_CACHE.get("items", [])
        # Accept alternate param name used by frontend (min_1w_vol_diff_pct)
        if min_week_vol_diff_pct is None:
            alt = request.query_params.get("min_1w_vol_diff_pct")
            if alt is not None:
                try:
                    min_week_vol_diff_pct = float(alt)
                except Exception:
                    pass
        # Filter
        def passes(row: dict[str, Any]) -> bool:
            price = row.get("close_price")
            change_pct_val = row.get("change_pct")
            vol = row.get("volume")
            week_diff = row.get("week_volume_diff_pct")
            ex = row.get("instrument", {}).get("exchange_code")
            active = row.get("instrument", {}).get("is_active")
            rsi = row.get("rsi_14")
            if min_price is not None and (price is None or price < min_price):
                return False
            if max_price is not None and (price is None or price > max_price):
                return False
            if min_change_pct is not None and (change_pct_val is None or change_pct_val < min_change_pct):
                return False
            if max_change_pct is not None and (change_pct_val is None or change_pct_val > max_change_pct):
                return False
            if min_volume is not None and (vol is None or vol < min_volume):
                return False
            if min_week_vol_diff_pct is not None and (week_diff is None or week_diff < min_week_vol_diff_pct):
                return False
            if exchange and (not ex or ex.lower() != exchange.lower()):
                return False
            if is_active is not None and active is not None and active != is_active:
                return False
            if min_rsi_14 is not None and (rsi is None or rsi < min_rsi_14):
                return False
            if max_rsi_14 is not None and (rsi is None or rsi > max_rsi_14):
                return False
            return True

        # Optional symbols whitelist (comma-separated short_names)
        symbols_param = request.query_params.get("symbols")
        allowed: set[str] | None = None
        if symbols_param:
            allowed = {s.strip().upper() for s in symbols_param.split(",") if s.strip()}

        filtered = []
        for r in items:
            if allowed:
                sn = (r.get("instrument", {}).get("short_name") or "").upper()
                if sn not in allowed:
                    continue
            if passes(r):
                filtered.append(r)

        # Sort
        def sort_key(r: dict[str, Any]):
            mapping = {
                "change_pct": r.get("change_pct"),
                "change_abs": r.get("change_abs"),
                "close_price": r.get("close_price"),
                "volume": r.get("volume"),
                "week_volume_diff_pct": r.get("week_volume_diff_pct"),
                "rsi_14": r.get("rsi_14"),
                "macd": r.get("macd"),
                "company_name": r.get("instrument", {}).get("company_name"),
            }
            return mapping.get(sort_field, mapping["change_pct"]) or -1e18

        reverse = sort_order == SortOrder.DESC
        sorted_rows = sorted(filtered, key=sort_key, reverse=reverse)

        total = len(sorted_rows)
        page = sorted_rows[offset: offset + limit]
        return PaginatedResponse(total=total, items=page, limit=limit, offset=offset)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in eod_screener: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to fetch Screener data")


@app.get("/stocks/intraday-screener", response_model=PaginatedResponse)
@app.get("/api/stocks/intraday-screener", response_model=PaginatedResponse)
async def intraday_screener(
    api_session: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    exchange: str = Query("NSE"),
    symbols: str | None = Query(None, description="Comma-separated short_names to include (e.g., RELIANCE,TATAMOTORS)"),
):
    """
    Build intraday screener for a page of instruments using 30m candles today.
    Computes last price, 1D change/%, volume (sum), optional sparkline.
    """
    await get_session_or_401(api_session)
    if not INSTRUMENTS:
        await load_instruments_into_memory()
    # Use either user session breeze or service breeze for the initial payload
    breeze = await get_breeze_or_401(api_session)

    # Optional symbols filter
    allowed: set[str] | None = None
    if symbols:
        allowed = {s.strip().upper() for s in symbols.split(",") if s.strip()}
        filtered = [i for i in INSTRUMENTS if (i.get("short_name") or "").upper() in allowed]
    else:
        filtered = INSTRUMENTS

    # Pick a slice of instruments
    start = (page - 1) * page_size
    end = start + page_size
    instruments_slice = filtered[start:end]
    total = len(filtered)
    if not instruments_slice:
        return PaginatedResponse(total=total, items=[], limit=page_size, offset=start)

    today = datetime.now(IST).date()
    from_dt = _iso_utc(datetime(today.year, today.month, today.day, 0, 0, 1))
    to_dt = _iso_utc(datetime(today.year, today.month, today.day, 23, 59, 59))

    async def one(inst: dict[str, Any]) -> dict[str, Any]:
        candidates = normalize_stock_code(inst.get("short_name"), inst.get("exchange_code"), inst.get("company_name"))
        try:
            rows: list[dict[str, Any]] = []
            # Try different intervals to get the most recent data
            intervals = ["1minute", "5minute", "15minute", "30minute"]  # Changed back to 30minute
            rows = None
            
            for interval in intervals:
                for code in candidates:
                    for ex in [exchange, "BSE" if exchange != "BSE" else "NSE"]:
                        try:
                            data = await breeze_call(
                                breeze.get_historical_data_v2,
                                interval=interval,
                                from_date=from_dt,
                                to_date=to_dt,
                                stock_code=code,
                                exchange_code=ex,
                                product_type="cash",
                            )
                            tmp = data.get("Success") if isinstance(data, dict) else None
                            if tmp and len(tmp) > 0:
                                rows = tmp
                                logger.info(f"Got {len(rows)} {interval} candles for {code} on {ex}")
                                break
                        except Exception as e:
                            logger.debug(f"Failed to get {interval} data for {code} on {ex}: {e}")
                            continue
                    if rows:
                        break
                if rows:
                    break
            closes = [
                _to_float(r.get("close")) for r in rows if _to_float(r.get("close")) is not None
            ]
            vols = [
                int(r.get("volume") or 0) for r in rows
            ]
            curr = closes[-1] if closes else None
            prev = closes[-2] if len(closes) >= 2 else None
            volume_sum = sum(vols) if vols else None

            # Fallback to daily closes if intraday not available
            if curr is None or prev is None:
                from_daily = _iso_utc(datetime(today.year, today.month, today.day, 0, 0, 1) - timedelta(days=15))
                daily_rows: list[dict[str, Any]] = []
                for code in candidates:
                    for ex in [exchange, "BSE" if exchange != "BSE" else "NSE"]:
                        data2 = await breeze_call(
                            breeze.get_historical_data_v2,
                            interval="1day",
                            from_date=from_daily,
                            to_date=to_dt,
                            stock_code=code,
                            exchange_code=ex,
                            product_type="cash",
                        )
                        tmp2 = data2.get("Success") if isinstance(data2, dict) else None
                        if tmp2:
                            daily_rows = tmp2
                            break
                    if daily_rows:
                        break
                daily_closes = [_to_float(r.get("close")) for r in daily_rows if _to_float(r.get("close")) is not None]
                if len(daily_closes) >= 1 and curr is None:
                    curr = daily_closes[-1]
                if len(daily_closes) >= 2 and prev is None:
                    prev = daily_closes[-2]
                # If volume from intraday missing, use last daily volume as fallback
                if volume_sum is None and daily_rows:
                    try:
                        volume_sum = int(daily_rows[-1].get("volume") or 0)
                    except Exception:
                        volume_sum = None
            change_abs = (curr - prev) if (curr is not None and prev not in (None, 0)) else None
            change_pct = (change_abs / prev * 100) if (change_abs is not None and prev) else None
            spark = closes[-20:] if closes else []
            return {
                "snapshot_id": None,
                "snapshot_date": today.isoformat(),
                "close_price": curr,
                "prev_close_price": prev,
                "change_abs": round(change_abs, 2) if change_abs is not None else None,
                "change_pct": round(change_pct, 2) if change_pct is not None else None,
                "volume": volume_sum,
                "week_avg_volume": None,
                "week_volume_diff_pct": None,
                "rsi_14": None,
                "macd": None,
                "macd_signal": None,
                "macd_histogram": None,
                "fifty_two_week_high": None,
                "fifty_two_week_low": None,
                "sparkline_data": {"p": spark} if spark else None,
                "instrument": {
                    "id": None,
                    "short_name": inst["short_name"],
                    "company_name": inst["company_name"],
                    "isin_code": inst["isin_code"],
                    "exchange_code": inst["exchange_code"],
                    "is_active": inst["is_active"],
                },
            }
        except Exception as e:
            return {
                "snapshot_id": None,
                "snapshot_date": today.isoformat(),
                "close_price": None,
                "prev_close_price": None,
                "change_abs": None,
                "change_pct": None,
                "volume": None,
                "sparkline_data": None,
                "instrument": {
                    "id": None,
                    "short_name": inst["short_name"],
                    "company_name": inst["company_name"],
                    "isin_code": inst["isin_code"],
                    "exchange_code": inst["exchange_code"],
                    "is_active": inst["is_active"],
                },
                "error": str(e),
            }

    sem = asyncio.Semaphore(8)
    async def guarded(inst: dict[str, Any]):
        async with sem:
            return await one(inst)

    results = await asyncio.gather(*(guarded(i) for i in instruments_slice))
    return PaginatedResponse(total=total, items=results, limit=page_size, offset=start)


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


# ---------------------------
# Instruments import & EOD compute helpers (no DB)
# ---------------------------
async def load_instruments_into_memory() -> None:
    json_path = os.path.join(os.path.dirname(__file__), "ScripMaster.json")
    csv_path = os.path.join(os.path.dirname(__file__), "ScripMaster.csv")
    data_list: list[dict[str, Any]] = []
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data_list = json.load(f)
        except Exception as e:
            logger.error(f"Failed to read ScripMaster.json: {e}")
    elif os.path.exists(csv_path):
        try:
            import csv
            with open(csv_path, newline='', encoding="utf-8") as f:
                reader = csv.reader(f)
                for row in reader:
                    if len(row) < 4:
                        continue
                    short, name, isin, exch_code = row[0], row[1], row[2], row[3]
                    data_list.append({
                        "ShortName": short,
                        "CompanyName": name,
                        "ISINCode": isin,
                        "ExchangeCode": exch_code,
                    })
        except Exception as e:
            logger.error(f"Failed to read ScripMaster.csv: {e}")
    INSTRUMENTS.clear()
    COMPANY_TO_SHORT.clear()
    COMPANY_TO_SHORT_NORM.clear()
    # Restrict to test set for now: RELIANCE and TCS, with simple de-duplication by short_name
    allowed_short = {"RELIND", "RELIANCE", "TCS"}
    seen: set[str] = set()
    for item in data_list:
        short_name = (item.get("ShortName") or "").strip()
        company_name = (item.get("CompanyName") or "").strip()
        isin_code = (item.get("ISINCode") or "").strip()
        exchange_code = (item.get("ExchangeCode") or "").strip()
        if not short_name or not company_name or not isin_code:
            continue
        sn_upper = short_name.upper()
        ec_upper = exchange_code.upper()
        if sn_upper not in allowed_short and ec_upper not in allowed_short:
            continue
        # Normalize key by short_name family to dedupe (RELIND/RELIANCE -> RELIND family, TCS -> TCS)
        fam = 'RELIND' if (sn_upper.startswith('REL') or ec_upper.startswith('REL')) else sn_upper
        if fam in seen:
            continue
        seen.add(fam)
        INSTRUMENTS.append({
            "short_name": short_name,
            "company_name": company_name,
            "isin_code": isin_code,
            "exchange_code": exchange_code,
            "is_active": bool(exchange_code),
        })
        # Map company name to short_name for quick lookup
        if company_name:
            key_raw = company_name.upper()
            COMPANY_TO_SHORT[key_raw] = short_name.upper()
            # Normalized key: strip common suffixes and non-alnum
            def _norm(s: str) -> str:
                u = s.upper()
                for suf in [" LIMITED", " LTD", ".", ",", " LIMITED."]:
                    u = u.replace(suf, "")
                # collapse spaces and remove non-alnum except space
                import re
                u = re.sub(r"[^A-Z0-9 ]+", "", u)
                u = re.sub(r"\s+", " ", u).strip()
                return u
            norm_key = _norm(company_name)
            COMPANY_TO_SHORT_NORM[norm_key] = short_name.upper()
            logger.info(f"Mapped company '{company_name}' -> short_name '{short_name.upper()}' (raw: '{key_raw}', norm: '{norm_key}')")

    # Add manual mappings for critical stocks that might not be in the CSV or have different names
    manual_mappings = {
        "RELIANCE INDUSTRIES LIMITED": "RELIND",
        "RELIANCE INDUSTRIES LTD": "RELIND", 
        "RELIANCE INDUSTRIES": "RELIND",
        "RELIANCE": "RELIND",
        "TATA CONSULTANCY SERVICES LIMITED": "TCS",
        "TATA CONSULTANCY SERVICES LTD": "TCS",
        "TATA CONSULTANCY SERVICES": "TCS",
        "TCS": "TCS",
    }
    
    for company_name, short_name in manual_mappings.items():
        key_raw = company_name.upper()
        COMPANY_TO_SHORT[key_raw] = short_name.upper()
        # Also add normalized version
        def _norm(s: str) -> str:
            u = s.upper()
            for suf in [" LIMITED", " LTD", ".", ",", " LIMITED."]:
                u = u.replace(suf, "")
            import re
            u = re.sub(r"[^A-Z0-9 ]+", "", u)
            u = re.sub(r"\s+", " ", u).strip()
            return u
        norm_key = _norm(company_name)
        COMPANY_TO_SHORT_NORM[norm_key] = short_name.upper()
        logger.info(f"Added manual mapping: '{company_name}' -> '{short_name.upper()}' (raw: '{key_raw}', norm: '{norm_key}')")


async def get_service_breeze() -> Optional[BreezeConnect]:
    if settings.SERVICE_API_KEY and settings.SERVICE_API_SECRET and settings.SERVICE_SESSION_TOKEN:
        try:
            breeze = BreezeConnect(api_key=settings.SERVICE_API_KEY)
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, lambda: breeze.generate_session(api_secret=settings.SERVICE_API_SECRET, session_token=settings.SERVICE_SESSION_TOKEN))
            return breeze
        except Exception:
            logger.error("Failed to init service Breeze session")
            logger.error(traceback.format_exc())
            return None
    async with session_store.lock:
        for token, sess in session_store.sessions.items():
            return sess.get("breeze")
    return None


async def fetch_daily_series(breeze: BreezeConnect, stock_code: str, exchange: str, from_date: str, to_date: str) -> list[dict[str, Any]]:
    data = await breeze_call(
        breeze.get_historical_data_v2,
        interval="1day",
        from_date=from_date,
        to_date=to_date,
        stock_code=stock_code,
        exchange_code=exchange,
        product_type="cash",
    )
    rows = data.get("Success") if isinstance(data, dict) else None
    return rows or []


async def fetch_30min_today(breeze: BreezeConnect, stock_code: str, exchange: str, day: date) -> list[dict[str, Any]]:
    from_dt = f"{day.isoformat()}T00:00:01.000Z"
    to_dt = f"{day.isoformat()}T23:59:59.000Z"
    data = await breeze_call(
        breeze.get_historical_data_v2,
        interval="5minute",  # Changed from 30minute to 5minute
        from_date=from_dt,
        to_date=to_dt,
        stock_code=stock_code,
        exchange_code=exchange,
        product_type="cash",
    )
    rows = data.get("Success") if isinstance(data, dict) else None
    return rows or []


def _to_float_safe(v: Any) -> Optional[float]:
    try:
        return float(v)
    except Exception:
        return None


def normalize_stock_code(short_name: str | None, exchange_code: str | None, company_name: str | None) -> list[str]:
    """Generate Breeze stock_code candidates for an instrument (order matters)."""
    cands: list[str] = []
    def add(code: Optional[str]):
        if not code:
            return
        u = str(code).strip().upper()
        if not u:
            return
        if u not in cands:
            cands.append(u)

    sn = (short_name or '').upper().strip()
    ec = (exchange_code or '').upper().strip()
    cn = (company_name or '').upper().strip()

    # Known normalizations
    if sn in {"RELIND", "RELIANCE", "RELI", "RIL"} or "RELIANCE" in cn:
        add("RELIANCE")
    if sn in {"TCS"} or "TATA CONSULTANCY" in cn:
        add("TCS")

    # Add raw fields as fallbacks
    add(ec)
    add(sn)

    # Clean and dedupe
    filtered = []
    for code in cands:
        cleaned = ''.join(ch for ch in code if ch.isalnum())
        if cleaned and cleaned not in filtered:
            filtered.append(cleaned)
    return filtered


def add_row_to_cache(instrument: dict, trade_date: date, payload: dict[str, Any]) -> None:
    row = {
        "snapshot_id": None,
        "snapshot_date": trade_date.isoformat(),
        **payload,
        "instrument": {
            "id": None,
            "short_name": instrument["short_name"],
            "company_name": instrument["company_name"],
            "isin_code": instrument["isin_code"],
            "exchange_code": instrument["exchange_code"],
            "is_active": instrument["is_active"],
        }
    }
    # derive change_abs/pct if missing
    prev = row.get("prev_close_price")
    curr = row.get("close_price")
    if curr is not None and prev not in (None, 0):
        row["change_abs"] = round(curr - prev, 2)
        row["change_pct"] = round(((curr - prev) / prev) * 100, 2)
    SCREENER_CACHE["items"].append(row)


async def process_instrument_compute(breeze: BreezeConnect, inst: dict, target_day: date, default_exchange: str = "NSE") -> None:
    code_candidates = normalize_stock_code(inst.get("short_name"), inst.get("exchange_code"), inst.get("company_name"))
    exchanges = [default_exchange, "BSE"] if default_exchange == "NSE" else [default_exchange, "NSE"]
    from_day = target_day - timedelta(days=400)
    from_date = f"{from_day.isoformat()}T00:00:01.000Z"
    to_date = f"{target_day.isoformat()}T23:59:59.000Z"
    daily_rows: list[dict[str, Any]] = []
    used_exchange: Optional[str] = None
    used_code: Optional[str] = None
    for code in code_candidates:
        for ex in exchanges:
            daily_rows = await fetch_daily_series(breeze, code, ex, from_date, to_date)
            if daily_rows:
                used_exchange = ex
                used_code = code
                break
        if daily_rows:
            break
    if not daily_rows:
        return
    closes: list[float] = []
    volumes: list[int] = []
    last_close: Optional[float] = None
    prev_close: Optional[float] = None
    today_volume: Optional[int] = None
    last_date: Optional[date] = None

    def parse_dt(dtstr: str) -> Optional[datetime]:
        if not dtstr:
            return None
        try:
            iso = dtstr.replace(" ", "T")
            if iso.endswith("Z"):
                iso = iso.replace("Z", "+00:00")
            return datetime.fromisoformat(iso)
        except Exception:
            try:
                return datetime.fromisoformat(dtstr)
            except Exception:
                return None

    for row in daily_rows:
        c = _to_float_safe(row.get("close"))
        v = row.get("volume")
        dt = parse_dt(row.get("datetime"))
        if c is None or not dt:
            continue
        closes.append(c)
        try:
            volumes.append(int(v))
        except Exception:
            volumes.append(0)
        last_date = dt.date()

    if not closes:
        return
    last_close = closes[-1]
    prev_close = closes[-2] if len(closes) >= 2 else None
    today_volume = volumes[-1] if volumes else None
    week_window = volumes[-6:-1] if len(volumes) >= 6 else []
    week_avg_volume = int(sum(week_window) / len(week_window)) if week_window else None
    week_vol_diff_pct = None
    if week_avg_volume and week_avg_volume != 0 and today_volume is not None:
        week_vol_diff_pct = round(((today_volume - week_avg_volume) / week_avg_volume) * 100, 2)
    period_52w = closes[-252:] if len(closes) >= 252 else closes[:]
    fifty_two_week_high = max(period_52w) if period_52w else None
    fifty_two_week_low = min(period_52w) if period_52w else None
    rsi_val = calculate_rsi_14(closes[-15:]) if len(closes) >= 15 else None
    macd_val, macd_signal_val, macd_hist_val = calculate_macd(closes) if len(closes) >= 26 else (None, None, None)
    intraday_rows = await fetch_30min_today(breeze, used_code or code_candidates[0], used_exchange or exchanges[0], target_day)
    spark_p: list[float] = []
    spark_t: list[str] = []
    for r in intraday_rows[-24:]:
        c = _to_float_safe(r.get("close"))
        d = r.get("datetime")
        if c is not None and d:
            spark_p.append(c)
            spark_t.append(str(d))
    payload = {
        "open_price": None,
        "high_price": None,
        "low_price": None,
        "close_price": last_close if last_close is not None else None,
        "prev_close_price": prev_close if prev_close is not None else (last_close if last_close is not None else None),
        "volume": today_volume,
        "week_avg_volume": week_avg_volume,
        "week_volume_diff_pct": week_vol_diff_pct,
        "rsi_14": rsi_val,
        "macd": macd_val,
        "macd_signal": macd_signal_val,
        "macd_histogram": macd_hist_val,
        "fifty_two_week_high": fifty_two_week_high,
        "fifty_two_week_low": fifty_two_week_low,
        "sparkline_data": {"t": spark_t, "p": spark_p} if spark_p else None,
    }
    add_row_to_cache(inst, last_date or target_day, payload)


async def build_screener_cache_job():
    try:
        if not INSTRUMENTS:
            await load_instruments_into_memory()
        breeze = await get_service_breeze()
        if not breeze:
            logger.warning("No Breeze session for screener build; skipping")
            return
        now_ist = datetime.now(IST)
        last_day = find_last_market_day(now_ist.date())
        if not market_closed_now(now_ist):
            logger.info("Market not closed yet; postponing screener build")
            return
        SCREENER_CACHE["items"] = []
        SCREENER_CACHE["snapshot_date"] = last_day.isoformat()
        sem = asyncio.Semaphore(10)
        async def run_one(inst: dict):
            async with sem:
                try:
                    await process_instrument_compute(breeze, inst, last_day)
                except Exception:
                    pass
        for start in range(0, len(INSTRUMENTS), 100):
            chunk = INSTRUMENTS[start:start+100]
            await asyncio.gather(*(run_one(i) for i in chunk))
        logger.info("Screener cache built: %d items", len(SCREENER_CACHE["items"]))
    except Exception as e:
        logger.error(f"Screener build error: {e}")
        logger.error(traceback.format_exc())


@app.post("/admin/import-instruments")
async def admin_import_instruments(api_session: str):
    await get_session_or_401(api_session)
    await load_instruments_into_memory()
    return {"status": "ok", "imported": len(INSTRUMENTS)}


@app.post("/admin/run-eod-etl")
async def admin_run_eod_etl(api_session: str):
    await get_session_or_401(api_session)
    await build_screener_cache_job()
    return {"status": "ok", "snapshot_date": SCREENER_CACHE.get("snapshot_date"), "rows": len(SCREENER_CACHE.get("items", []))}

