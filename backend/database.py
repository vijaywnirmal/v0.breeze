from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool
import os
from dotenv import load_dotenv

load_dotenv()

# Database URL from environment or default
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/stock_screener"
)

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=True,  # Set to False in production
    future=True,
    pool_pre_ping=True,
    pool_recycle=300,
    poolclass=NullPool  # For SQLAlchemy 2.0+ with async
)

# Session factory
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

# Base class for all models
Base = declarative_base()

# Dependency to get DB session
async def get_db():
    """Async generator that yields database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            raise e
        finally:
            await session.close()


async def init_db() -> None:
    """Create all tables if they do not exist. Prefer Alembic for real migrations."""
    from sqlalchemy import text
    from sqlalchemy.exc import SQLAlchemyError
    from . import models  # noqa: F401 - ensure models are imported so metadata knows about them

    async with engine.begin() as conn:
        try:
            # Run CREATE TABLEs
            await conn.run_sync(Base.metadata.create_all)
        except SQLAlchemyError:
            # As a fallback/diagnostic, try a no-op to ensure connection
            await conn.execute(text("SELECT 1"))
            raise