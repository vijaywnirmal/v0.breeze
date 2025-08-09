from datetime import date, datetime
from sqlalchemy import Column, Integer, String, Date, DateTime, Float, Boolean, BigInteger, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from database import Base

class Instrument(Base):
    """Represents a financial instrument (stock, bond, etc.)"""
    __tablename__ = 'instruments'
    
    id = Column(Integer, primary_key=True, index=True)
    short_name = Column(String(50), nullable=False, index=True)
    company_name = Column(String(255), nullable=False)
    isin_code = Column(String(20), nullable=False, index=True)
    exchange_code = Column(String(50), nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    snapshots = relationship("EODSnapshot", back_populates="instrument", cascade="all, delete-orphan")
    
    __table_args__ = (
        {'comment': 'Financial instruments (stocks, bonds, etc.)'},
    )


class EODSnapshot(Base):
    """End-of-day market data snapshot for an instrument"""
    __tablename__ = 'eod_snapshots'
    
    id = Column(Integer, primary_key=True, index=True)
    instrument_id = Column(Integer, ForeignKey('instruments.id', ondelete='CASCADE'), nullable=False)
    trade_date = Column(Date, nullable=False, index=True)
    
    # Price data
    open_price = Column(Float(precision=15, decimal_return_scale=2), nullable=True)
    high_price = Column(Float(precision=15, decimal_return_scale=2), nullable=True)
    low_price = Column(Float(precision=15, decimal_return_scale=2), nullable=True)
    close_price = Column(Float(precision=15, decimal_return_scale=2), nullable=False)
    prev_close_price = Column(Float(precision=15, decimal_return_scale=2), nullable=False)
    
    # Volume data
    volume = Column(BigInteger, nullable=True)
    week_avg_volume = Column(BigInteger, nullable=True)
    week_volume_diff_pct = Column(Float(precision=10, decimal_return_scale=2), nullable=True)
    
    # Technical indicators
    rsi_14 = Column(Float(precision=10, decimal_return_scale=2), nullable=True)
    macd = Column(Float(precision=10, decimal_return_scale=2), nullable=True)
    macd_signal = Column(Float(precision=10, decimal_return_scale=2), nullable=True)
    macd_histogram = Column(Float(precision=10, decimal_return_scale=2), nullable=True)
    
    # 52-week data
    fifty_two_week_high = Column(Float(precision=15, decimal_return_scale=2), nullable=True)
    fifty_two_week_low = Column(Float(precision=15, decimal_return_scale=2), nullable=True)
    
    # Additional data
    sparkline_data = Column(JSONB, nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    instrument = relationship("Instrument", back_populates="snapshots")
    
    __table_args__ = (
        Index('idx_eod_snapshot_instrument_date', 'instrument_id', 'trade_date', unique=True),
        {'comment': 'End-of-day market data snapshots'},
    )
    
    @property
    def change_abs(self):
        return self.close_price - self.prev_close_price if self.prev_close_price else None
    
    @property
    def change_pct(self):
        return (self.change_abs / self.prev_close_price * 100) if self.prev_close_price and self.prev_close_price != 0 else None
