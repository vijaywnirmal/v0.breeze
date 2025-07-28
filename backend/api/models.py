from pydantic import BaseModel, Field, constr
from typing import Optional

class LoginRequest(BaseModel):
    api_key: str = Field(..., min_length=1, max_length=100, description="Breeze API key")
    api_secret: str = Field(..., min_length=1, max_length=100, description="Breeze API secret")
    session_token: str = Field(..., min_length=1, max_length=100, description="Breeze session token")

class FundsActionRequest(BaseModel):
    api_key: str = Field(..., min_length=1, max_length=100)
    api_secret: str = Field(..., min_length=1, max_length=100)
    session_token: str = Field(..., min_length=1, max_length=100)
    segment: constr(pattern="^(equity|fno|commodity)$") = Field(..., description="Trading segment")
    amount: float = Field(..., gt=0, le=10000000, description="Amount to allocate/unallocate")

class FundsRequest(BaseModel):
    api_key: str = Field(..., min_length=1, max_length=100)
    api_secret: str = Field(..., min_length=1, max_length=100)
    session_token: str = Field(..., min_length=1, max_length=100)

class MarketQuoteRequest(BaseModel):
    api_key: str = Field(..., min_length=1, max_length=100)
    api_secret: str = Field(..., min_length=1, max_length=100)
    session_token: str = Field(..., min_length=1, max_length=100)
    exchange_code: constr(pattern="^(NSE|BSE|NFO|BFO)$") = Field(..., description="Exchange code")
    stock_code: str = Field(..., min_length=1, max_length=20, description="Stock code")
    product_type: constr(pattern="^(cash|futures|options)$") = Field(..., description="Product type")
    expiry_date: Optional[constr(pattern="^\\d{4}-\\d{2}-\\d{2}$")] = Field(None, description="Expiry date (YYYY-MM-DD)")
    right: Optional[constr(pattern="^(call|put|others)$")] = Field(None, description="Option right")
    strike_price: Optional[constr(pattern="^\\d+(\\.\\d+)?$")] = Field(None, description="Strike price")

class HistoricalDataRequest(BaseModel):
    api_key: str = Field(..., min_length=1, max_length=100)
    api_secret: str = Field(..., min_length=1, max_length=100)
    session_token: str = Field(..., min_length=1, max_length=100)
    exchange_code: constr(pattern="^(NSE|BSE|NFO|BFO)$") = Field(...)
    stock_code: str = Field(..., min_length=1, max_length=20)
    interval: constr(pattern="^(1minute|5minute|30minute|1day)$") = Field(..., description="Data interval")
    from_date: constr(pattern="^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$") = Field(..., description="From date (YYYY-MM-DDTHH:MM)")
    to_date: constr(pattern="^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$") = Field(..., description="To date (YYYY-MM-DDTHH:MM)")
    product_type: constr(pattern="^(cash|futures|options)$") = Field(...)
    expiry_date: Optional[constr(pattern="^\\d{4}-\\d{2}-\\d{2}$")] = Field(None)
    right: Optional[constr(pattern="^(call|put|others)$")] = Field(None)
    strike_price: Optional[constr(pattern="^\\d+(\\.\\d+)?$")] = Field(None)

class OrderRequest(BaseModel):
    api_key: str = Field(..., min_length=1, max_length=100)
    api_secret: str = Field(..., min_length=1, max_length=100)
    session_token: str = Field(..., min_length=1, max_length=100)
    stock_code: str = Field(..., min_length=1, max_length=20)
    exchange_code: constr(pattern="^(NSE|BSE|NFO|BFO)$") = Field(...)
    product_type: constr(pattern="^(cash|futures|options)$") = Field(...)
    order_type: constr(pattern="^(market|limit|stop|stoplimit)$") = Field(..., description="Order type")
    price: Optional[float] = Field(None, gt=0, description="Order price")
    quantity: int = Field(..., gt=0, le=1000000, description="Order quantity")
    action: constr(pattern="^(buy|sell)$") = Field(..., description="Buy or sell action")

class PortfolioRequest(BaseModel):
    api_key: str = Field(..., min_length=1, max_length=100)
    api_secret: str = Field(..., min_length=1, max_length=100)
    session_token: str = Field(..., min_length=1, max_length=100) 