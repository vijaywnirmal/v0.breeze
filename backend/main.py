from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from backend.api.endpoints import router as api_router
from backend.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/apiLogs.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

app = FastAPI(
    title="Breeze Trading API",
    description="Real-time trading application with Breeze Connect integration",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
