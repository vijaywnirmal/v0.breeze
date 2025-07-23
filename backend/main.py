from fastapi import FastAPI
from pydantic import BaseModel
from breeze_connect import BreezeConnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can restrict to ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    api_key: str
    api_secret: str
    session_token: str

@app.post("/api/login")
async def login(req: LoginRequest):
    try:
        breeze = BreezeConnect(api_key=req.api_key)
        breeze.generate_session(api_secret=req.api_secret, session_token=req.session_token)
        response = breeze.get_customer_details(api_session=req.session_token)
        funds_response = breeze.get_funds()
        funds = funds_response.get("Success", {}) if funds_response.get("Status") == 200 and funds_response.get("Error") is None else None
        if response.get("Status") == 200 and response.get("Error") is None:
            user_info = response.get("Success", {})
            return {
                "success": True,
                "user_name": user_info.get("idirect_user_name"),
                "userid": user_info.get("idirect_userid"),
                "funds": funds,
                "credentials": {
                    "api_key": req.api_key,
                    "api_secret": req.api_secret,
                    "session_token": req.session_token
                }
            }
        else:
            return {"success": False, "message": response.get("Error", "Invalid credentials")}
    except Exception as e:
        return {"success": False, "message": str(e)}

class FundsActionRequest(BaseModel):
    api_key: str
    api_secret: str
    session_token: str
    segment: str
    amount: float

@app.post("/api/allocate_funds")
async def allocate_funds(req: FundsActionRequest):
    try:
        # Map segment to correct API value
        segment_map = {
            "equity": "Equity",
            "fno": "FNO",
            "commodity": "Commodity"
        }
        segment = segment_map.get(req.segment.lower())
        if not segment:
            return {"success": False, "message": f"Unsupported segment: {req.segment}. Only Equity, FNO, and Commodity are supported."}
        breeze = BreezeConnect(api_key=req.api_key)
        breeze.generate_session(api_secret=req.api_secret, session_token=req.session_token)
        # Breeze API expects amount as integer string (no decimals)
        amount_str = str(int(round(req.amount)))
        response = breeze.set_funds(transaction_type="credit", amount=amount_str, segment=segment)
        if response.get("Status") == 200 and response.get("Error") is None:
            return {"success": True, "message": "Funds allocated successfully."}
        else:
            return {"success": False, "message": response.get("Error", "Could not allocate funds")}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.post("/api/unallocate_funds")
async def unallocate_funds(req: FundsActionRequest):
    try:
        # Map segment to correct API value
        segment_map = {
            "equity": "Equity",
            "fno": "FNO",
            "commodity": "Commodity"
        }
        segment = segment_map.get(req.segment.lower())
        if not segment:
            return {"success": False, "message": f"Unsupported segment: {req.segment}. Only Equity, FNO, and Commodity are supported."}
        breeze = BreezeConnect(api_key=req.api_key)
        breeze.generate_session(api_secret=req.api_secret, session_token=req.session_token)
        # Breeze API expects amount as integer string (no decimals)
        amount_str = str(int(round(req.amount)))
        response = breeze.set_funds(transaction_type="debit", amount=amount_str, segment=segment)
        if response.get("Status") == 200 and response.get("Error") is None:
            return {"success": True, "message": "Funds unallocated successfully."}
        else:
            return {"success": False, "message": response.get("Error", "Could not unallocate funds")}
    except Exception as e:
        return {"success": False, "message": str(e)}

class FundsRequest(BaseModel):
    api_key: str
    api_secret: str
    session_token: str

@app.post("/api/funds")
async def get_funds(req: FundsRequest):
    try:
        breeze = BreezeConnect(api_key=req.api_key)
        breeze.generate_session(api_secret=req.api_secret, session_token=req.session_token)
        response = breeze.get_funds()
        if response.get("Status") == 200 and response.get("Error") is None:
            return {"success": True, "funds": response.get("Success", {})}
        else:
            return {"success": False, "message": response.get("Error", "Could not fetch funds")}
    except Exception as e:
        return {"success": False, "message": str(e)}

# -------- MARKET QUOTE --------
class MarketQuoteRequest(BaseModel):
    api_key: str
    api_secret: str
    session_token: str
    exchange_code: str
    stock_code: str
    product_type: str

@app.post("/api/market_quote")
async def get_market_quote(req: MarketQuoteRequest):
    try:
        breeze = BreezeConnect(api_key=req.api_key)
        breeze.generate_session(api_secret=req.api_secret, session_token=req.session_token)
        quote = breeze.get_market_quote(
            exchange_code=req.exchange_code,
            stock_code=req.stock_code,
            product_type=req.product_type
        )
        return {"success": True, "quote": quote}
    except Exception as e:
        return {"success": False, "message": str(e)}

# -------- HISTORICAL DATA --------
class HistoricalDataRequest(BaseModel):
    api_key: str
    api_secret: str
    session_token: str
    exchange_code: str
    stock_code: str
    interval: str
    from_date: str
    to_date: str

@app.post("/api/historical_data")
async def get_historical_data(req: HistoricalDataRequest):
    try:
        breeze = BreezeConnect(api_key=req.api_key)
        breeze.generate_session(api_secret=req.api_secret, session_token=req.session_token)
        data = breeze.get_historical_data(
            interval=req.interval,
            from_date=req.from_date,
            to_date=req.to_date,
            stock_code=req.stock_code,
            exchange_code=req.exchange_code
        )
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "message": str(e)}

# -------- ORDER PLACEMENT --------
class OrderRequest(BaseModel):
    api_key: str
    api_secret: str
    session_token: str
    stock_code: str
    exchange_code: str
    product_type: str
    order_type: str
    price: Optional[float]
    quantity: int
    action: str  # "buy" or "sell"

@app.post("/api/place_order")
async def place_order(req: OrderRequest):
    try:
        breeze = BreezeConnect(api_key=req.api_key)
        breeze.generate_session(api_secret=req.api_secret, session_token=req.session_token)
        order = breeze.place_order(
            stock_code=req.stock_code,
            exchange_code=req.exchange_code,
            product_type=req.product_type,
            order_type=req.order_type,
            price=str(req.price) if req.price else None,
            quantity=str(req.quantity),
            action=req.action
        )
        return {"success": True, "order": order}
    except Exception as e:
        return {"success": False, "message": str(e)}

# -------- PORTFOLIO: Holdings & Positions --------
class PortfolioRequest(BaseModel):
    api_key: str
    api_secret: str
    session_token: str

@app.post("/api/holdings")
async def get_holdings(req: PortfolioRequest):
    try:
        breeze = BreezeConnect(api_key=req.api_key)
        breeze.generate_session(api_secret=req.api_secret, session_token=req.session_token)
        holdings = breeze.get_portfolio_holdings()
        return {"success": True, "holdings": holdings}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.post("/api/positions")
async def get_positions(req: PortfolioRequest):
    try:
        breeze = BreezeConnect(api_key=req.api_key)
        breeze.generate_session(api_secret=req.api_secret, session_token=req.session_token)
        positions = breeze.get_portfolio_positions()
        return {"success": True, "positions": positions}
    except Exception as e:
        return {"success": False, "message": str(e)}
