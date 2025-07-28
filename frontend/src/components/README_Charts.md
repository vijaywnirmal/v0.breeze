# Reusable Chart System

This document explains how to use the reusable chart components throughout your trading application.

## Overview

The chart system consists of several components that can be used anywhere in your app:

1. **ChartComponent** - The core chart component (lightweight-charts based)
2. **LiveChartComponent** - Real-time websocket chart component
3. **ChartWrapper** - Universal wrapper for both historical and live charts
4. **DashboardWidget** - Pre-built widgets for common use cases
5. **ChartService** - Utility service for data fetching and chart operations

## Quick Start

### Basic Historical Chart

```tsx
import ChartWrapper from './components/ChartWrapper';

// Simple historical chart
<ChartWrapper
  data={historicalData}
  symbol="RELIANCE"
  interval="1day"
  height={400}
  title="RELIANCE - Daily Chart"
/>
```

### Live Chart

```tsx
// Real-time streaming chart
<ChartWrapper
  isLive={true}
  userData={userData}
  symbol="RELIANCE"
  exchange="NSE"
  interval="1minute"
  height={400}
  title="RELIANCE - Live"
  showControls={true}
/>
```

### Dashboard Widget

```tsx
import DashboardWidget from './components/DashboardWidget';

// Pre-built widget with stats
<DashboardWidget
  userData={userData}
  symbol="RELIANCE"
  exchange="NSE"
  interval="1minute"
  isLive={true}
  widgetType="watchlist"
  height={250}
/>
```

## Component Details

### ChartWrapper

Universal component that handles both historical and live charts.

**Props:**
- `data?: ChartData[]` - Historical data array
- `symbol?: string` - Stock symbol
- `interval?: string` - Time interval (1minute, 5minute, 30minute, 1day)
- `isLive?: boolean` - Whether to use live data
- `userData?: UserData` - Required for live charts
- `exchange?: string` - Exchange code (default: 'NSE')
- `height?: number` - Chart height in pixels
- `showControls?: boolean` - Show chart controls
- `title?: string` - Chart title
- `onDataUpdate?: (data: ChartData[]) => void` - Callback for data updates
- `onError?: (error: string) => void` - Error callback

### DashboardWidget

Pre-built widget component with automatic data fetching and stats.

**Props:**
- `userData: UserData` - User credentials and data
- `symbol: string` - Stock symbol
- `exchange?: string` - Exchange code (default: 'NSE')
- `interval?: string` - Time interval
- `isLive?: boolean` - Use live data (default: false)
- `widgetType?: 'watchlist' | 'portfolio' | 'analysis'` - Widget style
- `height?: number` - Widget height

### ChartService

Utility service for chart operations.

**Methods:**
- `fetchHistoricalData(request)` - Fetch historical data
- `getDefaultDateRange(interval)` - Get default date range for interval
- `formatChartTitle(symbol, interval, isLive)` - Format chart title
- `validateChartData(data)` - Validate chart data
- `calculateStats(data)` - Calculate price/volume statistics
- `getOptimalHeight(containerHeight, showVolume)` - Get optimal chart height
- `debounce(func, wait)` - Debounce function for chart updates

## Usage Examples

### 1. Watchlist Page

```tsx
const WatchlistPage = ({ userData }) => {
  const watchlist = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK'];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {watchlist.map(symbol => (
        <DashboardWidget
          key={symbol}
          userData={userData}
          symbol={symbol}
          interval="1minute"
          isLive={true}
          widgetType="watchlist"
          height={250}
        />
      ))}
    </div>
  );
};
```

### 2. Portfolio Overview

```tsx
const PortfolioPage = ({ userData, holdings }) => {
  return (
    <div className="space-y-6">
      {holdings.map(holding => (
        <div key={holding.symbol} className="bg-white shadow rounded p-4">
          <h3 className="font-semibold mb-2">{holding.symbol}</h3>
          <DashboardWidget
            userData={userData}
            symbol={holding.symbol}
            interval="1day"
            isLive={false}
            widgetType="portfolio"
            height={200}
          />
        </div>
      ))}
    </div>
  );
};
```

### 3. Analysis Page

```tsx
const AnalysisPage = ({ userData }) => {
  const [selectedSymbol, setSelectedSymbol] = useState('RELIANCE');
  const [interval, setInterval] = useState('1day');
  
  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <select value={selectedSymbol} onChange={e => setSelectedSymbol(e.target.value)}>
          <option value="RELIANCE">RELIANCE</option>
          <option value="TCS">TCS</option>
        </select>
        <select value={interval} onChange={e => setInterval(e.target.value)}>
          <option value="1minute">1 Min</option>
          <option value="1day">1 Day</option>
        </select>
      </div>
      
      <ChartWrapper
        isLive={true}
        userData={userData}
        symbol={selectedSymbol}
        interval={interval}
        height={500}
        title={`${selectedSymbol} Analysis`}
        showControls={true}
      />
    </div>
  );
};
```

### 4. Custom Chart Component

```tsx
const CustomChart = ({ userData, symbol, interval }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const fetchData = async () => {
    setLoading(true);
    const result = await ChartService.fetchHistoricalData({
      api_key: userData.credentials.api_key,
      api_secret: userData.credentials.api_secret,
      session_token: userData.credentials.session_token,
      stock_code: symbol,
      exchange_code: 'NSE',
      interval,
      from_date: '2024-01-01',
      to_date: '2024-12-31'
    });
    
    if (result.success) {
      setData(result.data);
    }
    setLoading(false);
  };
  
  useEffect(() => {
    fetchData();
  }, [symbol, interval]);
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <ChartWrapper
      data={data}
      symbol={symbol}
      interval={interval}
      height={400}
      title={`${symbol} - ${interval}`}
    />
  );
};
```

## Best Practices

### 1. Error Handling

Always provide error callbacks:

```tsx
<ChartWrapper
  isLive={true}
  userData={userData}
  symbol="RELIANCE"
  onError={(error) => console.error('Chart error:', error)}
/>
```

### 2. Performance

- Use `ChartService.debounce()` for frequent updates
- Set appropriate heights for different contexts
- Use `isLive={false}` for historical data to avoid unnecessary websocket connections

### 3. Responsive Design

```tsx
// Use responsive heights
const chartHeight = window.innerWidth < 768 ? 300 : 500;

<ChartWrapper
  height={chartHeight}
  // ... other props
/>
```

### 4. Data Validation

```tsx
import ChartService from '../services/chartService';

// Validate data before rendering
if (ChartService.validateChartData(data)) {
  return <ChartWrapper data={data} />;
} else {
  return <div>Invalid data</div>;
}
```

## Styling

All chart components use Tailwind CSS classes and can be customized:

```tsx
// Custom styling
<div className="bg-gray-900 rounded-lg p-4">
  <ChartWrapper
    // ... props
    className="custom-chart-class"
  />
</div>
```

## Troubleshooting

### Common Issues

1. **"Object is disposed" error**: Chart cleanup has been improved, but ensure components unmount properly
2. **WebSocket connection issues**: Check user credentials and network connectivity
3. **Data not loading**: Verify API endpoints and data format
4. **Chart not rendering**: Check if data array is not empty and properly formatted

### Debug Mode

Enable debug logging:

```tsx
// In your component
useEffect(() => {
  console.log('Chart data:', data);
  console.log('Chart props:', { symbol, interval, isLive });
}, [data, symbol, interval, isLive]);
```

## Migration Guide

### From Old ChartComponent

Replace direct usage:

```tsx
// Old
<ChartComponent data={data} symbol="RELIANCE" />

// New
<ChartWrapper data={data} symbol="RELIANCE" />
```

### From Old LiveChart

Replace with ChartWrapper:

```tsx
// Old
<LiveChart userData={userData} />

// New
<ChartWrapper
  isLive={true}
  userData={userData}
  symbol="RELIANCE"
  // ... other props
/>
```

This reusable chart system provides a consistent, maintainable way to display charts throughout your trading application! 