from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from breeze_connect import BreezeConnect
from fastapi.middleware.cors import CORSMiddleware
import traceback

app = FastAPI()
origins = [
    "http://localhost:3000",  # your frontend URL
    # Add other origins if needed, e.g. staging, production URLs
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,            # Allowed origins
    allow_credentials=True,
    allow_methods=["*"],              # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],              # Allow all headers
)

class SessionData(BaseModel):
    api_key: str
    api_secret: str
    session_token: str

# Global in-memory store for active sessions (for demo purposes, use a proper session store in production)
active_sessions = {}

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    print(f"Exception on path {request.url.path}: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"}
    )

@app.post("/login")
def login(data: SessionData):
    """
    Initializes BreezeConnect SDK and generates a session.
    Stores session tokens in memory keyed by the session token.
    """
    try:
        breeze = BreezeConnect(api_key=data.api_key)
        result = breeze.generate_session(
            api_secret=data.api_secret,
            session_token=data.session_token
        )
        # Store active session info (simple example; consider expiration and security in production)
        active_sessions[data.session_token] = {
            "api_key": data.api_key,
            "api_secret": data.api_secret
        }
        return {"status": "session initialized", "result": result}
    except Exception as e:
        print(f"Error initializing session: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=400, detail="Failed to initialize session")

@app.get("/account/details")
async def account_details(api_session: str):
    """
    Retrieves customer details using stored credentials and session token.
    """
    try:
        if api_session not in active_sessions:
            raise HTTPException(status_code=401, detail="Invalid or expired session token")
        session_info = active_sessions[api_session]
        breeze = BreezeConnect(api_key=session_info["api_key"])
        breeze.generate_session(api_secret=session_info["api_secret"], session_token=api_session)
        details = breeze.get_customer_details(api_session=api_session)
        return details
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching customer details: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to get customer details")
