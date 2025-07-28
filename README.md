# Breeze Trading Application

A real-time trading application built with FastAPI backend and React frontend, integrating with ICICI Direct's Breeze Connect API for live market data and trading functionality.

## Features

- **Real-time Market Data**: Live tick-by-tick data streaming via WebSocket
- **Interactive Charts**: Candlestick charts with volume using Lightweight Charts
- **Stock Search**: Search and filter stocks from comprehensive scrip master data
- **Market Quotes**: Real-time quotes for equity, futures, and options
- **Historical Data**: Historical OHLCV data with multiple timeframes
- **Order Management**: Place buy/sell orders
- **Portfolio Management**: View holdings and positions
- **Funds Management**: Allocate and unallocate funds across segments

## Tech Stack

### Backend
- **FastAPI**: Modern Python web framework
- **Breeze Connect**: ICICI Direct trading API client
- **Pandas**: Data processing and CSV handling
- **WebSockets**: Real-time data streaming
- **Pydantic**: Data validation and serialization

### Frontend
- **React 19**: Modern React with hooks
- **TypeScript**: Type-safe development
- **Lightweight Charts**: Professional financial charting
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework

## Project Structure

```
v0.breeze/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   ├── scrip_master_merged.csv  # Stock data
│   └── logs/               # Application logs
├── frontend/
│   ├── src/
│   │   ├── App.tsx         # Main React component
│   │   ├── ChartComponent.tsx  # Charting component
│   │   ├── main.tsx        # React entry point
│   │   └── index.css       # Styles
│   ├── package.json        # Node.js dependencies
│   └── vite.config.ts      # Vite configuration
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.8+
- Node.js 18+
- ICICI Direct trading account with API access

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the FastAPI server:
   ```bash
   python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

The backend will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:5173`

## API Endpoints

### Authentication
- `POST /api/login` - Authenticate with Breeze Connect

### Market Data
- `GET /scrips/search` - Search for stocks
- `POST /api/market_quote` - Get real-time quotes
- `POST /api/historical_data` - Get historical data
- `WS /ws/marketdata` - WebSocket for live data

### Trading
- `POST /api/place_order` - Place orders
- `POST /api/funds` - Get funds
- `POST /api/allocate_funds` - Allocate funds
- `POST /api/unallocate_funds` - Unallocate funds
- `POST /api/holdings` - Get holdings
- `POST /api/positions` - Get positions

### Debug
- `GET /health` - Health check
- `GET /test` - Server status
- `GET /debug/columns` - CSV data structure
- `GET /debug/reliance` - RELIANCE stock data

## Live Chart Feature

The Live Chart feature provides real-time candlestick charts with the following capabilities:

- **Real-time Data**: Streams tick-by-tick data from Breeze Connect
- **Frontend Aggregation**: Converts raw ticks to OHLCV candles
- **Dynamic Intervals**: Change display intervals without reconnection
- **Interactive Charts**: Zoom, pan, and crosshair functionality
- **Volume Display**: Optional volume histogram

### Usage

1. Navigate to the "Live Chart" tab
2. Search for a stock (e.g., "RELIND" for RELIANCE INDUSTRIES)
3. Select the stock from the dropdown
4. Choose your display interval (1min, 5min, 30min, 1day)
5. Click "Start Live Chart" to begin streaming
6. The chart will update in real-time as new data arrives

## Development

### Code Quality

- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting
- **Pydantic**: Backend data validation

### Available Scripts

#### Frontend
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
npm run format       # Format code with Prettier
```

#### Backend
```bash
python -m uvicorn main:app --reload  # Development server
```

## Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Breeze Connect API credentials
BREEZE_API_KEY=your_api_key
BREEZE_API_SECRET=your_api_secret
BREEZE_SESSION_TOKEN=your_session_token

# Server configuration
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=INFO
```

### Vite Proxy Configuration

The frontend is configured to proxy API requests to the backend:

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:8000', changeOrigin: true },
    '/scrips': { target: 'http://localhost:8000', changeOrigin: true },
    '/ws': { target: 'ws://localhost:8000', ws: true },
  },
}
```

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check if backend is running on port 8000
   - Verify Breeze Connect credentials
   - Check browser console for errors

2. **No Tick Data Received**
   - Verify stock token format (e.g., "NSE.RELIND")
   - Check backend logs for subscription errors
   - Ensure market hours for live data

3. **Chart Not Rendering**
   - Check browser console for JavaScript errors
   - Verify data format in network tab
   - Try refreshing the page

### Logs

Backend logs are stored in `backend/logs/`:
- `apiLogs.log` - API request logs
- `websocketLogs.log` - WebSocket connection logs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is for educational and personal use. Please ensure compliance with ICICI Direct's terms of service and API usage policies.

## Support

For issues related to:
- **Breeze Connect API**: Contact ICICI Direct support
- **Application Bugs**: Create an issue in the repository
- **Trading Questions**: Consult with your broker 