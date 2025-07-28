from fastapi import APIRouter, Query, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from datetime import datetime
import logging
import asyncio

from backend.api.models import (
    LoginRequest, FundsActionRequest, FundsRequest, MarketQuoteRequest, HistoricalDataRequest, OrderRequest, PortfolioRequest
)
from backend.utils.data_loader import load_master_csv
from backend.utils.breeze_client import get_breeze_client
from backend.utils.token_mapping import get_stock_token
from backend.utils.websocket_handler import websocket_manager

router = APIRouter()

df = load_master_csv()

@router.get("/api/get_token")
def api_get_token(stock_name: str = Query(...), exchange: str = Query(None), fuzzy: bool = Query(False)):
    matches = get_stock_token(stock_name, exchange, fuzzy)
    if not matches:
        return JSONResponse(status_code=404, content={"success": False, "error": "Token not found for given stock name and exchange."})
    if len(matches) == 1:
        return {"success": True, "token": matches[0]["token"], "match": matches[0]}
    else:
        return {"success": True, "matches": matches}

@router.get("/test")
def test_endpoint():
    return {"message": "Server is working", "df_loaded": not df.empty, "df_shape": df.shape if not df.empty else None}

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "df_loaded": not df.empty,
        "df_rows": len(df) if not df.empty else 0
    }

@router.get("/debug/columns")
def debug_columns():
    if df.empty:
        return {"error": "CSV data not loaded."}
    return {
        "columns": list(df.columns),
        "sample_data": df.head(3).to_dict(orient="records")
    }

@router.get("/debug/reliance")
def debug_reliance():
    if df.empty:
        return {"error": "CSV data not loaded."}
    reliance_stocks = df[df['shortname'].str.contains('RELI', case=False, na=False) |
                        df['companyname'].str.contains('RELIANCE', case=False, na=False)]
    return {
        "reliance_stocks": reliance_stocks[['shortname', 'companyname', 'exchange', 'instrumenttype']].rename(columns={
            "shortname": "ticker",
            "companyname": "name",
            "instrumenttype": "instrument_type"
        }).to_dict(orient="records"),
        "total_found": len(reliance_stocks)
    }

@router.get("/scrips/search")
def search_scrips(
    q: str = Query(..., min_length=1, max_length=50, description="Search query for stock ticker or name"),
    exchange: str = Query(None, max_length=10, description="Exchange code filter"),
    product_type: str = Query(None, max_length=20, description="Product type filter"),
    limit: int = Query(10, ge=1, le=100, description="Maximum number of results to return")
):
    if df.empty:
        logging.warning("Search attempted but CSV data not loaded")
        return {"error": "CSV data not loaded."}
    try:
        results = df.copy()
        if exchange:
            exchange_upper = exchange.upper().strip()
            results = results[results["exchange"].str.upper() == exchange_upper]
            logging.info(f"Filtered by exchange: {exchange_upper}, remaining results: {len(results)}")
        if product_type:
            product_upper = product_type.upper().strip()
            # Map product_type to instrumenttype values
            product_mapping = {
                "cash": "EQ",  # Equity
                "futures": "FUT",  # Futures
                "options": "OPT"   # Options
            }
            mapped_product = product_mapping.get(product_upper, product_upper)
            results = results[results["instrumenttype"].str.upper() == mapped_product]
            logging.info(f"Filtered by product type: {product_upper}, remaining results: {len(results)}")
        
        # Search in shortname (ticker) and companyname (company name)
        query_mask = (
            results["shortname"].str.contains(q, case=False, na=False) |
            results["companyname"].str.contains(q, case=False, na=False)
        )
        results = results[query_mask]
        logging.info(f"Search query '{q}' returned {len(results)} results")
        
        # Return results with mapped column names for frontend compatibility
        return results[["shortname", "companyname", "exchange", "instrumenttype"]].rename(columns={
            "shortname": "ticker",
            "companyname": "name",
            "instrumenttype": "instrument_type"
        }).head(limit).to_dict(orient="records")
    except Exception as e:
        logging.error(f"Error in search_scrips: {e}")
        return {"error": f"Search failed: {str(e)}"}

@router.post("/api/login")
async def login(req: LoginRequest):
    try:
        logging.info(f"Login attempt for API key: {req.api_key[:8]}...")
        breeze = get_breeze_client(req.api_key, req.api_secret, req.session_token)
        response = breeze.get_customer_details(api_session=req.session_token)
        if response.get("Status") != 200 or response.get("Error") is not None:
            logging.warning(f"Login failed - customer details error: {response.get('Error')}")
            return {"success": False, "message": response.get("Error", "Invalid credentials")}
        funds_response = breeze.get_funds()
        funds = None
        if funds_response.get("Status") == 200 and funds_response.get("Error") is None:
            funds = funds_response.get("Success", {})
        else:
            logging.warning(f"Failed to fetch funds: {funds_response.get('Error')}")
        user_info = response.get("Success", {})
        logging.info(f"Login successful for user: {user_info.get('idirect_user_name')}")
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
        logging.error(f"Login error: {str(e)}")
        return {"success": False, "message": str(e)}

@router.post("/api/allocate_funds")
async def allocate_funds(req: FundsActionRequest):
    try:
        segment_map = {
            "equity": "Equity",
            "fno": "FNO",
            "commodity": "Commodity"
        }
        segment = segment_map.get(req.segment.lower())
        if not segment:
            return {"success": False, "message": f"Unsupported segment: {req.segment}. Only Equity, FNO, and Commodity are supported."}
        breeze = get_breeze_client(req.api_key, req.api_secret, req.session_token)
        amount_str = str(int(round(req.amount)))
        response = breeze.set_funds(transaction_type="credit", amount=amount_str, segment=segment)
        if response.get("Status") == 200 and response.get("Error") is None:
            return {"success": True, "message": "Funds allocated successfully."}
        else:
            return {"success": False, "message": response.get("Error", "Could not allocate funds")}
    except Exception as e:
        return {"success": False, "message": str(e)}

@router.post("/api/unallocate_funds")
async def unallocate_funds(req: FundsActionRequest):
    try:
        segment_map = {
            "equity": "Equity",
            "fno": "FNO",
            "commodity": "Commodity"
        }
        segment = segment_map.get(req.segment.lower())
        if not segment:
            return {"success": False, "message": f"Unsupported segment: {req.segment}. Only Equity, FNO, and Commodity are supported."}
        breeze = get_breeze_client(req.api_key, req.api_secret, req.session_token)
        amount_str = str(int(round(req.amount)))
        response = breeze.set_funds(transaction_type="debit", amount=amount_str, segment=segment)
        if response.get("Status") == 200 and response.get("Error") is None:
            return {"success": True, "message": "Funds unallocated successfully."}
        else:
            return {"success": False, "message": response.get("Error", "Could not unallocate funds")}
    except Exception as e:
        return {"success": False, "message": str(e)}

@router.post("/api/funds")
async def get_funds(req: FundsRequest):
    try:
        breeze = get_breeze_client(req.api_key, req.api_secret, req.session_token)
        response = breeze.get_funds()
        if response.get("Status") == 200 and response.get("Error") is None:
            return {"success": True, "funds": response.get("Success", {})}
        else:
            return {"success": False, "message": response.get("Error", "Could not fetch funds")}
    except Exception as e:
        return {"success": False, "message": str(e)}

@router.post("/api/market_quote")
async def get_market_quote(req: MarketQuoteRequest):
    try:
        breeze = get_breeze_client(req.api_key, req.api_secret, req.session_token)
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

@router.post("/api/historical_data")
async def get_historical_data(req: HistoricalDataRequest):
    try:
        breeze = get_breeze_client(req.api_key, req.api_secret, req.session_token)
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

@router.post("/api/place_order")
async def place_order(req: OrderRequest):
    try:
        breeze = get_breeze_client(req.api_key, req.api_secret, req.session_token)
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

@router.post("/api/holdings")
async def get_holdings(req: PortfolioRequest):
    try:
        breeze = get_breeze_client(req.api_key, req.api_secret, req.session_token)
        holdings = breeze.get_portfolio_holdings()
        return {"success": True, "holdings": holdings}
    except Exception as e:
        return {"success": False, "message": str(e)}

@router.post("/api/positions")
async def get_positions(req: PortfolioRequest):
    try:
        breeze = get_breeze_client(req.api_key, req.api_secret, req.session_token)
        positions = breeze.get_portfolio_positions()
        return {"success": True, "positions": positions}
    except Exception as e:
        return {"success": False, "message": str(e)}

@router.websocket("/ws/marketdata")
async def websocket_marketdata(websocket: WebSocket):
    subscription_id = None
    tick_queue = asyncio.Queue()
    heartbeat_task = None
    aggregation_task = None
    breeze = None
    try:
        init = await websocket.receive_json()
        api_key = init.get("api_key")
        api_secret = init.get("api_secret")
        session_token = init.get("session_token")
        scrip_code = init.get("scrip_code")
        exchange_code = init.get("exchange_code")
        interval = init.get("interval", "1minute")
        if not all([api_key, api_secret, session_token, scrip_code, exchange_code]):
            await websocket.send_json({"error": "Missing credentials or scrip details"})
            await websocket.close()
            return
        subscription_id = f"{scrip_code}_{exchange_code}_{interval}"
        await websocket_manager.connect(websocket, subscription_id)
        token_row = df[(df['shortname'] == scrip_code) & (df['exchange'] == exchange_code)]
        if token_row.empty:
            await websocket.send_json({"error": f"Token not found for {scrip_code} on {exchange_code}"})
            await websocket.close()
            return
        stock_token = token_row.iloc[0]['token']
        try:
            breeze = get_breeze_client(api_key, api_secret, session_token)
        except Exception as e:
            await websocket.send_json({"error": f"Failed to initialize BreezeConnect: {str(e)}"})
            await websocket.close()
            return
        def on_ticks(ticks):
            try:
                if isinstance(ticks, list):
                    for tick in ticks:
                        asyncio.run_coroutine_threadsafe(tick_queue.put(tick), asyncio.get_event_loop())
                else:
                    asyncio.run_coroutine_threadsafe(tick_queue.put(ticks), asyncio.get_event_loop())
            except Exception as e:
                pass
        breeze.ws_connect()
        breeze.subscribe_feeds(stock_token=stock_token, interval=interval)
        breeze.on_ticks = on_ticks
        await websocket.send_json({"type": "subscription_status", "status": "subscribed", "stock_token": stock_token, "interval": interval})
        heartbeat_task = asyncio.create_task(websocket_manager.send_heartbeat(websocket))
        aggregation_task = asyncio.create_task(websocket_manager.handle_ticks(subscription_id, tick_queue, websocket, interval))
        await websocket.send_json({"type": "connection_status", "status": "connected", "message": f"Connected for {subscription_id}"})
        while True:
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({"error": str(e)})
    finally:
        if aggregation_task:
            aggregation_task.cancel()
        if heartbeat_task:
            heartbeat_task.cancel()
        if breeze:
            breeze.ws_disconnect()
        await websocket_manager.disconnect(subscription_id) 