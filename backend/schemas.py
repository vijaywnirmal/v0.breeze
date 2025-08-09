from datetime import date, datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from enum import Enum

class SortOrder(str, Enum):
    ASC = "asc"
    DESC = "desc"

class EODSnapshotBase(BaseModel):
    trade_date: date
    open_price: Optional[float] = None
    high_price: Optional[float] = None
    low_price: Optional[float] = None
    close_price: float
    prev_close_price: float
    volume: Optional[int] = None
    week_avg_volume: Optional[int] = None
    week_volume_diff_pct: Optional[float] = None
    rsi_14: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_histogram: Optional[float] = None
    fifty_two_week_high: Optional[float] = None
    fifty_two_week_low: Optional[float] = None
    sparkline_data: Optional[Dict[str, Any]] = None

class EODSnapshotCreate(EODSnapshotBase):
    instrument_id: int

class EODSnapshotUpdate(EODSnapshotBase):
    pass

class EODSnapshotInDB(EODSnapshotBase):
    id: int
    instrument_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class InstrumentBase(BaseModel):
    short_name: str
    company_name: str
    isin_code: str
    exchange_code: str
    is_active: bool = True

class InstrumentCreate(InstrumentBase):
    pass

class InstrumentUpdate(InstrumentBase):
    pass

class InstrumentInDB(InstrumentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class InstrumentWithSnapshots(InstrumentInDB):
    snapshots: List[EODSnapshotInDB] = []

class EODSnapshotWithInstrument(EODSnapshotInDB):
    instrument: InstrumentInDB

class ScreenerFilter(BaseModel):
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    min_volume: Optional[int] = None
    min_change_pct: Optional[float] = None
    max_change_pct: Optional[float] = None
    exchange_codes: Optional[List[str]] = None
    is_active: Optional[bool] = None

class ScreenerSort(BaseModel):
    field: str = "change_pct"
    order: SortOrder = SortOrder.DESC

class ScreenerRequest(BaseModel):
    filters: Optional[ScreenerFilter] = None
    sort: Optional[ScreenerSort] = None
    limit: int = Field(100, ge=1, le=1000)
    offset: int = Field(0, ge=0)

class PaginatedResponse(BaseModel):
    total: int
    items: List[Dict[str, Any]]
    limit: int
    offset: int

    class Config:
        arbitrary_types_allowed = True