from datetime import date, datetime, time, timedelta
import pytz
from typing import Optional, List

# Timezone for Indian markets
IST = pytz.timezone('Asia/Kolkata')

# Market hours
MARKET_OPEN_TIME = time(9, 15)   # 9:15 AM IST
MARKET_CLOSE_TIME = time(15, 30)  # 3:30 PM cutoff IST

def is_market_open() -> bool:
    """Check if the market is currently open."""
    now = datetime.now(IST)
    current_time = now.time()
    
    # Market is closed on weekends
    if now.weekday() >= 5:  # 5 = Saturday, 6 = Sunday
        return False
    
    # Check if current time is within market hours
    if MARKET_OPEN_TIME <= current_time <= MARKET_CLOSE_TIME:
        return True
    
    return False

def is_market_closed_now() -> bool:
    """Check if the market is currently closed."""
    return not is_market_open()


def calculate_rsi_14(closes: List[float]) -> Optional[float]:
    if len(closes) < 15:
        return None
    gains = []
    losses = []
    for i in range(1, 15):
        change = closes[i] - closes[i - 1]
        gains.append(max(change, 0.0))
        losses.append(abs(min(change, 0.0)))
    avg_gain = sum(gains) / 14
    avg_loss = sum(losses) / 14
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def ema(values: List[float], period: int) -> Optional[List[float]]:
    if len(values) < period:
        return None
    k = 2 / (period + 1)
    out: List[float] = []
    # Seed with SMA
    sma = sum(values[:period]) / period
    out.append(sma)
    for price in values[period:]:
        prev = out[-1]
        out.append(price * k + prev * (1 - k))
    return out


def calculate_macd(closes: List[float]) -> tuple[Optional[float], Optional[float], Optional[float]]:
    if len(closes) < 26:
        return None, None, None
    ema12_full = ema(closes, 12)
    ema26_full = ema(closes, 26)
    if not ema12_full or not ema26_full:
        return None, None, None
    # Align lengths
    overlap = min(len(ema12_full), len(ema26_full))
    diffs = [ema12_full[-overlap + i] - ema26_full[-overlap + i] for i in range(overlap)]
    signal_full = ema(diffs, 9)
    if not signal_full:
        return None, None, None
    macd_val = diffs[-1]
    signal_val = signal_full[-1]
    hist_val = macd_val - signal_val
    return macd_val, signal_val, hist_val

def get_last_trading_day(current_date: Optional[date] = None) -> date:
    """
    Get the most recent trading day (Monday-Friday, not a holiday).
    If the market is open today, returns today's date.
    """
    if current_date is None:
        current_date = datetime.now(IST).date()
    
    # If market is open today, return today
    if is_market_open():
        return current_date
    
    # Otherwise, find the most recent trading day
    delta = timedelta(days=1)
    while True:
        current_date -= delta
        # Skip weekends (5=Saturday, 6=Sunday)
        if current_date.weekday() >= 5:
            continue
        # Skip holidays (you'll need to implement this based on your holiday calendar)
        if is_market_holiday(current_date):
            continue
        return current_date

def is_market_holiday(check_date: date) -> bool:
    """
    Check if the given date is a market holiday.
    TODO: Implement holiday calendar or integrate with an API
    """
    # This is a placeholder - you should implement proper holiday checking
    # You might want to use a configuration file or database table for holidays
    holidays = [
        # Add holidays here, e.g.:
        # date(2023, 1, 26),  # Republic Day
        # date(2023, 3, 7),   # Holi
    ]
    return check_date in holidays

def get_market_status() -> dict:
    """Get the current market status."""
    now = datetime.now(IST)
    is_open = is_market_open()
    
    status = {
        "is_market_open": is_open,
        "current_time": now.isoformat(),
        "market_open_time": MARKET_OPEN_TIME.isoformat(),
        "market_close_time": MARKET_CLOSE_TIME.isoformat(),
        "current_day": now.strftime("%A"),
        "is_weekend": now.weekday() >= 5,
        "is_holiday": is_market_holiday(now.date()),
        "last_trading_day": get_last_trading_day().isoformat()
    }
    
    if is_open:
        time_to_close = datetime.combine(now.date(), MARKET_CLOSE_TIME) - now
        status.update({
            "status": "open",
            "time_to_close": str(time_to_close)
        })
    else:
        # Find next market open time
        next_open = datetime.combine(now.date(), MARKET_OPEN_TIME)
        if now.time() > MARKET_CLOSE_TIME:
            # If market is closed for the day, next open is next trading day
            next_open = get_next_trading_day(now.date() + timedelta(days=1))
            next_open = datetime.combine(next_open, MARKET_OPEN_TIME)
        
        time_to_open = next_open - now
        status.update({
            "status": "closed",
            "next_market_open": next_open.isoformat(),
            "time_to_open": str(time_to_open)
        })
    
    return status

def get_next_trading_day(start_date: date) -> date:
    """Get the next trading day after the given date."""
    delta = timedelta(days=1)
    next_day = start_date + delta
    
    while True:
        # Skip weekends
        if next_day.weekday() >= 5:
            next_day += delta
            continue
        
        # Skip holidays
        if is_market_holiday(next_day):
            next_day += delta
            continue
        
        return next_day
