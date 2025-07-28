# Live Chart Feature Documentation

## Overview
The Live Chart feature allows users to view real-time market data charts using the Breeze Connect websocket API. This implementation provides live OHLCV (Open, High, Low, Close, Volume) data streaming for selected stocks.

## Features

### Frontend (React + TypeScript)
- **Stock Selection**: Search and select stocks from the scrip master database
- **Interval Selection**: Choose from 1 minute, 5 minutes, 30 minutes, or 1 day intervals
- **Real-time Chart**: Live candlestick chart using lightweight-charts library
- **Connection Status**: Visual indicators for websocket connection status
- **Data Management**: Automatic cleanup of old data points (keeps last 100)
- **Error Handling**: Comprehensive error handling and user feedback

### Backend (FastAPI + Breeze Connect)
- **WebSocket Endpoint**: `/ws/marketdata` for real-time data streaming
- **Breeze Integration**: Uses Breeze Connect SDK for market data subscription
- **Data Transformation**: Converts Breeze data to standardized chart format
- **Multi-threading**: Handles Breeze websocket in separate thread
- **Cleanup**: Proper resource cleanup on disconnect

## How It Works

### 1. Stock Selection
- User searches for stocks using the search input
- Results are fetched from `/scrips/search` endpoint
- Selected stock information is stored for websocket subscription

### 2. WebSocket Connection
- Frontend connects to `ws://localhost:8000/ws/marketdata`
- Sends subscription message with:
  - API credentials (api_key, api_secret, session_token)
  - Stock details (scrip_code, exchange_code)
  - Interval preference

### 3. Backend Processing
- Backend receives subscription request
- Initializes Breeze Connect with provided credentials
- Connects to Breeze websocket in separate thread
- Subscribes to real-time data using `breeze.subscribe_feeds()`
- Transforms incoming data to standardized format

### 4. Data Flow
- Breeze sends real-time OHLCV data
- Backend transforms and forwards to frontend
- Frontend updates chart with new data points
- Chart automatically scrolls to show latest data

## API Reference

### WebSocket Endpoint
```
ws://localhost:8000/ws/marketdata
```

### Subscription Message Format
```json
{
  "api_key": "your_api_key",
  "api_secret": "your_api_secret", 
  "session_token": "your_session_token",
  "scrip_code": "RELIANCE",
  "exchange_code": "NSE",
  "interval": "1minute"
}
```

### Response Data Formats

#### OHLCV Data
```json
{
  "type": "ohlcv",
  "datetime": "2025-01-28 10:30:00",
  "open": "1200.50",
  "high": "1205.75",
  "low": "1198.25",
  "close": "1203.00",
  "volume": "150000",
  "interval": "1minute",
  "exchange_code": "NSE",
  "stock_code": "RELIANCE"
}
```

#### Equity Quote Data
```json
{
  "type": "quote",
  "symbol": "NSE.RELIANCE",
  "last": "1203.00",
  "high": "1205.75",
  "low": "1198.25",
  "open": "1200.50",
  "close": "1203.00",
  "volume": "150000",
  "datetime": "Wed Jan 28 10:30:20 2025",
  "exchange": "NSE Equity",
  "stock_name": "RELIANCE INDUSTRIES"
}
```

## Usage Instructions

### 1. Start the Backend Server
```bash
cd backend
python main.py
```

### 2. Start the Frontend Development Server
```bash
cd frontend
npm run dev
```

### 3. Access the Live Chart
1. Navigate to the application
2. Login with your Breeze Connect credentials
3. Click on "Live Chart" in the navigation
4. Search for a stock (e.g., "RELIANCE")
5. Select the desired interval
6. Click "Start Live Chart"
7. Watch the real-time data stream

## Technical Details

### Dependencies
- **Frontend**: React, TypeScript, lightweight-charts
- **Backend**: FastAPI, Breeze Connect SDK, asyncio, threading

### Data Management
- Maximum 100 data points kept in memory
- Automatic cleanup of old data
- Real-time timestamp updates
- Connection status monitoring

### Error Handling
- WebSocket connection errors
- Breeze API errors
- Data parsing errors
- Network timeouts

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check if backend server is running
   - Verify CORS settings
   - Check network connectivity

2. **No Data Received**
   - Verify Breeze Connect credentials
   - Check if market is open
   - Verify stock token format

3. **Chart Not Updating**
   - Check browser console for errors
   - Verify websocket connection status
   - Check data transformation logic

### Debug Information
- Check browser console for frontend logs
- Check backend terminal for server logs
- Monitor websocket connection status
- Verify data format in network tab

## Future Enhancements

1. **Multiple Charts**: Support for multiple stock charts simultaneously
2. **Technical Indicators**: Add moving averages, RSI, MACD
3. **Chart Types**: Support for line charts, area charts
4. **Data Export**: Export live data to CSV/JSON
5. **Alerts**: Price alerts and notifications
6. **Historical Context**: Show historical data alongside live data

## References

- [Breeze Connect Documentation](https://pypi.org/project/breeze-connect/)
- [Lightweight Charts Documentation](https://tradingview.github.io/lightweight-charts/)
- [FastAPI WebSocket Guide](https://fastapi.tiangolo.com/advanced/websockets/) 