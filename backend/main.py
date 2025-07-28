from fastapi import FastAPI
from pydantic import BaseModel, Field, constr
from breeze_connect import BreezeConnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from fastapi import Query
import csv
import os
from fastapi import WebSocket, WebSocketDisconnect
import asyncio
import threading
import json as pyjson
import pandas as pd
import logging
import os
from datetime import datetime

# Create logs directory if it doesn't exist
os.makedirs('logs', exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/apiLogs.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Breeze Trading API",
    description="Real-time trading application with Breeze Connect integration",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can restrict to ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load scrip master data into memory
try:
    df = pd.read_csv("scrip_master_merged.csv", low_memory=False)
    
    # Handle NaN values properly to avoid FutureWarning
    df = df.fillna("")
    
    # Normalize column names if needed
    df.columns = [col.strip().lower() for col in df.columns]
    
    # Example: Ensure required columns are renamed consistently
    df.rename(columns={
        'exchange_code': 'exchange',
        'instrument': 'instrument_type',
        'symbol': 'ticker',       # adapt as per your CSV
        'token': 'token',         # if exists
        'name': 'name'
    }, inplace=True)
    
    # Fix the exchange mapping - use segment as exchange
    df['exchange'] = df['segment']
    
    logger.info(f"Loaded scrip_master_merged.csv with {len(df)} rows.")
    logger.info(f"Available columns: {list(df.columns)}")
except Exception as e:
    logger.error(f"Failed to load CSV: {e}")
    df = pd.DataFrame()

# Test endpoint to verify server is working
@app.get("/test")
def test_endpoint():
    return {"message": "Server is working", "df_loaded": not df.empty, "df_shape": df.shape if not df.empty else None}

@app.get("/health")
def health_check():
    """
    Health check endpoint for monitoring
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "df_loaded": not df.empty,
        "df_rows": len(df) if not df.empty else 0
    }

@app.get("/debug/columns")
def debug_columns():
    if df.empty:
        return {"error": "CSV data not loaded."}
    return {
        "columns": list(df.columns),
        "sample_data": df.head(3).to_dict(orient="records")
    }

@app.get("/debug/reliance")
def debug_reliance():
    """Debug endpoint to check RELIANCE related stocks"""
    if df.empty:
        return {"error": "CSV data not loaded."}
    
    # Search for RELIANCE related stocks
    reliance_stocks = df[df['ticker'].str.contains('RELI', case=False, na=False) | 
                        df['name'].str.contains('RELIANCE', case=False, na=False)]
    
    return {
        "reliance_stocks": reliance_stocks[['ticker', 'name', 'exchange', 'instrument_type']].to_dict(orient="records"),
        "total_found": len(reliance_stocks)
    }

@app.get("/scrips/search")
def search_scrips(
    q: str = Query(..., min_length=1, max_length=50, description="Search query for stock ticker or name"),
    exchange: Optional[str] = Query(None, max_length=10, description="Exchange code filter"),
    product_type: Optional[str] = Query(None, max_length=20, description="Product type filter"),
    limit: int = Query(10, ge=1, le=100, description="Maximum number of results to return")
):
    """
    Search for stocks by ticker or name with optional filters
    """
    if df.empty:
        logger.warning("Search attempted but CSV data not loaded")
        return {"error": "CSV data not loaded."}
    
    try:
        results = df.copy()

        # Apply exchange filter if provided
        if exchange:
            exchange_upper = exchange.upper().strip()
            results = results[results["exchange"].str.upper() == exchange_upper]
            logger.info(f"Filtered by exchange: {exchange_upper}, remaining results: {len(results)}")
        
        # Apply product type filter if provided
        if product_type:
            product_upper = product_type.upper().strip()
            results = results[results["instrument_type"].str.upper() == product_upper]
            logger.info(f"Filtered by product type: {product_upper}, remaining results: {len(results)}")
        
        # Apply search query
        query_mask = (
            results["ticker"].str.contains(q, case=False, na=False) |
            results["name"].str.contains(q, case=False, na=False)
        )
        results = results[query_mask]
        
        logger.info(f"Search query '{q}' returned {len(results)} results")
        
        return results[["ticker", "name", "exchange", "instrument_type"]].head(limit).to_dict(orient="records")
    
    except Exception as e:
        logger.error(f"Error in search_scrips: {e}")
        return {"error": f"Search failed: {str(e)}"}

class LoginRequest(BaseModel):
    api_key: str = Field(..., min_length=1, max_length=100, description="Breeze API key")
    api_secret: str = Field(..., min_length=1, max_length=100, description="Breeze API secret")
    session_token: str = Field(..., min_length=1, max_length=100, description="Breeze session token")

@app.post("/api/login")
async def login(req: LoginRequest):
    """
    Authenticate user with Breeze Connect API
    """
    try:
        logger.info(f"Login attempt for API key: {req.api_key[:8]}...")
        
        breeze = BreezeConnect(api_key=req.api_key)
        breeze.generate_session(api_secret=req.api_secret, session_token=req.session_token)
        
        # Get customer details
        response = breeze.get_customer_details(api_session=req.session_token)
        if response.get("Status") != 200 or response.get("Error") is not None:
            logger.warning(f"Login failed - customer details error: {response.get('Error')}")
            return {"success": False, "message": response.get("Error", "Invalid credentials")}
        
        # Get funds information
        funds_response = breeze.get_funds()
        funds = None
        if funds_response.get("Status") == 200 and funds_response.get("Error") is None:
            funds = funds_response.get("Success", {})
        else:
            logger.warning(f"Failed to fetch funds: {funds_response.get('Error')}")
        
        user_info = response.get("Success", {})
        logger.info(f"Login successful for user: {user_info.get('idirect_user_name')}")
        
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
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return {"success": False, "message": str(e)}

class FundsActionRequest(BaseModel):
    api_key: str = Field(..., min_length=1, max_length=100)
    api_secret: str = Field(..., min_length=1, max_length=100)
    session_token: str = Field(..., min_length=1, max_length=100)
    segment: constr(pattern="^(equity|fno|commodity)$") = Field(..., description="Trading segment")
    amount: float = Field(..., gt=0, le=10000000, description="Amount to allocate/unallocate")

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
    api_key: str = Field(..., min_length=1, max_length=100)
    api_secret: str = Field(..., min_length=1, max_length=100)
    session_token: str = Field(..., min_length=1, max_length=100)

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
    api_key: str = Field(..., min_length=1, max_length=100)
    api_secret: str = Field(..., min_length=1, max_length=100)
    session_token: str = Field(..., min_length=1, max_length=100)
    exchange_code: constr(pattern="^(NSE|BSE|NFO|BFO)$") = Field(..., description="Exchange code")
    stock_code: str = Field(..., min_length=1, max_length=20, description="Stock code")
    product_type: constr(pattern="^(cash|futures|options)$") = Field(..., description="Product type")
    expiry_date: Optional[constr(pattern="^\\d{4}-\\d{2}-\\d{2}$")] = Field(None, description="Expiry date (YYYY-MM-DD)")
    right: Optional[constr(pattern="^(call|put|others)$")] = Field(None, description="Option right")
    strike_price: Optional[constr(pattern="^\\d+(\\.\\d+)?$")] = Field(None, description="Strike price")

@app.post("/api/market_quote")
async def get_market_quote(req: MarketQuoteRequest):
    try:
        breeze = BreezeConnect(api_key=req.api_key)
        breeze.generate_session(api_secret=req.api_secret, session_token=req.session_token)
        # Prepare kwargs for get_quotes
        kwargs = dict(
            stock_code=req.stock_code,
            exchange_code=req.exchange_code,
            product_type=req.product_type,
        )
        if req.expiry_date:
            kwargs["expiry_date"] = req.expiry_date
        if req.right:
            kwargs["right"] = req.right
        if req.strike_price:
            kwargs["strike_price"] = req.strike_price
        quote = breeze.get_quotes(**kwargs)
        return {"success": True, "quote": quote}
    except Exception as e:
        return {"success": False, "message": str(e)}

# -------- HISTORICAL DATA --------
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

@app.post("/api/historical_data")
async def get_historical_data(req: HistoricalDataRequest):
    try:
        breeze = BreezeConnect(api_key=req.api_key)
        breeze.generate_session(api_secret=req.api_secret, session_token=req.session_token)
        kwargs = dict(
            interval=req.interval,
            from_date=req.from_date,
            to_date=req.to_date,
            stock_code=req.stock_code,
            exchange_code=req.exchange_code,
            product_type=req.product_type,
        )
        if req.expiry_date:
            kwargs["expiry_date"] = req.expiry_date
        if req.right:
            kwargs["right"] = req.right
        if req.strike_price:
            kwargs["strike_price"] = req.strike_price
        data = breeze.get_historical_data(**kwargs)
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "message": str(e)}

# -------- ORDER PLACEMENT --------
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
    api_key: str = Field(..., min_length=1, max_length=100)
    api_secret: str = Field(..., min_length=1, max_length=100)
    session_token: str = Field(..., min_length=1, max_length=100)

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

@app.websocket("/ws/marketdata")
async def websocket_marketdata(websocket: WebSocket):
    await websocket.accept()
    breeze = None
    ws_thread = None
    heartbeat_task = None
    
    try:
        # Expect the first message to be a JSON with credentials and scrip details
        init = await websocket.receive_json()
        api_key = init.get("api_key")
        api_secret = init.get("api_secret")
        session_token = init.get("session_token")
        scrip_code = init.get("scrip_code")
        exchange_code = init.get("exchange_code")
        
        if not all([api_key, api_secret, session_token, scrip_code, exchange_code]):
            logger.error("WebSocket connection failed: Missing credentials or scrip details")
            await websocket.send_json({"error": "Missing credentials or scrip details"})
            await websocket.close()
            return
        
        logger.info(f"WebSocket connection initiated for {scrip_code} on {exchange_code}")
            
        # Initialize BreezeConnect
        try:
            breeze = BreezeConnect(api_key=api_key)
            breeze.generate_session(api_secret=api_secret, session_token=session_token)
            logger.info("BreezeConnect initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize BreezeConnect: {e}")
            await websocket.send_json({"error": f"Failed to initialize BreezeConnect: {str(e)}"})
            await websocket.close()
            return
        
        # Create queue for tick data
        tick_queue = asyncio.Queue()
        
        def on_ticks(ticks):
            """Callback function to receive ticks from Breeze websocket"""
            try:
                logger.info(f"📈 Received ticks: {type(ticks)} - {ticks}")
                
                # Handle both single tick and list of ticks
                if isinstance(ticks, list):
                    logger.info(f"📊 Processing {len(ticks)} ticks")
                    for tick in ticks:
                        asyncio.run_coroutine_threadsafe(tick_queue.put(tick), asyncio.get_event_loop())
                else:
                    logger.info(f"📊 Processing single tick")
                    asyncio.run_coroutine_threadsafe(tick_queue.put(ticks), asyncio.get_event_loop())
            except Exception as e:
                logger.error(f"❌ Error in on_ticks callback: {e}")
        
        def start_breeze_websocket():
            """Start Breeze websocket connection in a separate thread"""
            try:
                # Patch: Ensure event loop exists in this thread
                import asyncio
                try:
                    loop = asyncio.get_running_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                logger.info(f"🔌 Connecting to Breeze websocket for {scrip_code} on {exchange_code}")
                
                # Connect to Breeze websocket
                logger.info(f"🔗 Attempting to connect to Breeze websocket...")
                breeze.ws_connect()
                logger.info(f"✅ Breeze websocket connected successfully")
                
                # Wait a moment for connection to stabilize
                import time
                time.sleep(2)
                logger.info(f"⏳ Connection stabilized, proceeding with subscription...")
                
                # Test the connection with a simple quote first
                logger.info(f"🧪 Testing connection with a simple quote...")
                try:
                    test_quote = breeze.get_quotes(stock_code=scrip_code, exchange_code=exchange_code, product_type="cash")
                    logger.info(f"✅ Test quote successful: {test_quote}")
                except Exception as e:
                    logger.warning(f"⚠️ Test quote failed: {e}")
                
                # Subscribe to real-time tick-by-tick data
                # Format: stock_token = "exchange_code.stock_code" (e.g., "NSE.RELIND")
                stock_token = f"{exchange_code}.{scrip_code}"
                logger.info(f"📡 Subscribing to stock token: {stock_token}")
                
                # Subscribe to equity quotes (tick-by-tick data)
                # For real-time data, we need to use the correct subscription format
                response = breeze.subscribe_feeds(stock_token=stock_token)
                logger.info(f"📊 Websocket subscription response: {response}")
                
                # Also try subscribing with different formats if the first one doesn't work
                if not response or response.get('Status') != 200:
                    logger.warning(f"⚠️ First subscription failed, trying alternative format...")
                    # Try with just the stock code
                    alt_response = breeze.subscribe_feeds(stock_token=scrip_code)
                    logger.info(f"📊 Alternative subscription response: {alt_response}")
                
                # Set the callback for receiving ticks
                breeze.on_ticks = on_ticks
                logger.info(f"🎯 Tick callback set successfully")
                
                # Send a test message to confirm subscription is working
                test_message = {
                    "type": "subscription_status",
                    "status": "subscribed",
                    "stock_token": stock_token,
                    "message": f"Successfully subscribed to {stock_token} for real-time data"
                }
                asyncio.run_coroutine_threadsafe(
                    websocket.send_json(test_message), 
                    asyncio.get_event_loop()
                )
                
            except Exception as e:
                logger.error(f"❌ Error in Breeze websocket thread: {e}")
                # Send error to client
                error_data = {"error": f"Breeze websocket error: {str(e)}"}
                asyncio.run_coroutine_threadsafe(
                    websocket.send_json(error_data), 
                    asyncio.get_event_loop()
                )
        
        # Start Breeze websocket in a separate thread
        ws_thread = threading.Thread(target=start_breeze_websocket, daemon=True)
        ws_thread.start()
        
        # Define heartbeat function first
        async def send_heartbeat(ws):
            """Send heartbeat messages to keep connection alive"""
            while True:
                try:
                    await asyncio.sleep(30)
                    await ws.send_json({
                        "type": "heartbeat",
                        "timestamp": asyncio.get_event_loop().time(),
                        "message": "Websocket connection alive"
                    })
                    logger.info(f"💓 Heartbeat sent for {scrip_code}")
                except Exception as e:
                    logger.error(f"❌ Heartbeat error: {e}")
                    break
        
        # Send initial connection success message
        await websocket.send_json({
            "type": "connection_status",
            "status": "connected",
            "message": f"Connected to {scrip_code} on {exchange_code} for real-time tick data"
        })
        
        # Send a heartbeat every 30 seconds to keep connection alive
        heartbeat_task = asyncio.create_task(send_heartbeat(websocket))
        
        # Listen for incoming ticks and forward them to the client
        while True:
            try:
                tick = await tick_queue.get()
                
                # Transform tick data to raw tick format for frontend aggregation
                if isinstance(tick, dict):
                    # Handle equity quote data (tick-by-tick)
                    if 'last' in tick and 'symbol' in tick:
                        transformed_tick = {
                            "type": "tick",
                            "symbol": tick.get("symbol"),
                            "price": tick.get("last"),
                            "high": tick.get("high"),
                            "low": tick.get("low"),
                            "open": tick.get("open"),
                            "close": tick.get("close"),
                            "volume": tick.get("ttq", 0),
                            "timestamp": tick.get("ltt", ""),
                            "exchange": tick.get("exchange", exchange_code),
                            "stock_name": tick.get("stock_name", scrip_code)
                        }
                    # Handle OHLCV data (if any)
                    elif 'datetime' in tick and 'open' in tick:
                        transformed_tick = {
                            "type": "ohlcv",
                            "datetime": tick.get("datetime"),
                            "open": tick.get("open"),
                            "high": tick.get("high"),
                            "low": tick.get("low"),
                            "close": tick.get("close"),
                            "volume": tick.get("volume", 0),
                            "exchange_code": tick.get("exchange_code", exchange_code),
                            "stock_code": tick.get("stock_code", scrip_code)
                        }
                    else:
                        # Send raw tick data if transformation fails
                        transformed_tick = {"type": "raw", "data": tick}
                    await websocket.send_json(transformed_tick)
                    logger.info(f"Sent tick to frontend: {transformed_tick}")
                else:
                    # Send raw tick data if transformation fails
                    await websocket.send_json({"type": "raw", "data": tick})
                    logger.info(f"Sent raw tick to frontend: {tick}")
                    
            except asyncio.CancelledError:
                logger.info("WebSocket tick processing cancelled")
                break
            except Exception as e:
                logger.error(f"Error processing tick: {e}")
                await websocket.send_json({"error": f"Error processing tick: {str(e)}"})
                
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({"error": str(e)})
        except:
            pass
    finally:
        # Cleanup
        try:
            if heartbeat_task:
                heartbeat_task.cancel()
            if breeze:
                breeze.ws_disconnect()
            if ws_thread and ws_thread.is_alive():
                # Thread will be daemon, so it will be cleaned up automatically
                pass
            logger.info("WebSocket cleanup completed")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
        await websocket.close()
