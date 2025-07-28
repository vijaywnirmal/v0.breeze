import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChartComponent from '../ChartComponent';

interface Credentials {
  api_key: string;
  api_secret: string;
  session_token: string;
}

interface UserData {
  user_name: string;
  userid: string;
  funds: any;
  credentials: Credentials;
}

interface ScripData {
  ticker: string;
  name: string;
  exchange: string;
  instrument_type: string;
}

interface TickData {
  price: number;
  volume: number;
  timestamp: string;
  symbol: string;
  exchange: string;
  stock_name?: string;
}

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface LiveChartComponentProps {
  userData: UserData;
  symbol?: string;
  exchange?: string;
  interval?: string;
  height?: number;
  showControls?: boolean;
  onDataUpdate?: (data: CandleData[]) => void;
}

const LiveChartComponent: React.FC<LiveChartComponentProps> = ({
  userData,
  symbol = '',
  exchange = 'NSE',
  interval = '1minute',
  height = 500,
  showControls = true,
  onDataUpdate
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawTicks, setRawTicks] = useState<TickData[]>([]);
  const [aggregatedData, setAggregatedData] = useState<CandleData[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Get milliseconds for interval
  const getIntervalMs = useCallback((interval: string) => {
    switch (interval) {
      case '1minute': return 60 * 1000;
      case '5minute': return 5 * 60 * 1000;
      case '30minute': return 30 * 60 * 1000;
      case '1day': return 24 * 60 * 60 * 1000;
      default: return 60 * 1000;
    }
  }, []);

  // Aggregate raw ticks into OHLCV data based on interval
  const aggregateTicks = useCallback((ticks: TickData[], interval: string) => {
    if (ticks.length === 0) return [];
    
    const intervalMs = getIntervalMs(interval);
    const aggregated: { [key: number]: CandleData } = {};
    
    ticks.forEach(tick => {
      const timestamp = new Date(tick.timestamp || Date.now()).getTime();
      const intervalKey = Math.floor(timestamp / intervalMs) * intervalMs;
      
      if (!aggregated[intervalKey]) {
        aggregated[intervalKey] = {
          time: Math.floor(intervalKey / 1000),
          open: tick.price,
          high: tick.price,
          low: tick.price,
          close: tick.price,
          volume: tick.volume || 0,
        };
      } else {
        const candle = aggregated[intervalKey];
        candle.high = Math.max(candle.high, tick.price);
        candle.low = Math.min(candle.low, tick.price);
        candle.close = tick.price;
        candle.volume += tick.volume || 0;
      }
    });
    
    return Object.values(aggregated).sort((a, b) => a.time - b.time);
  }, [getIntervalMs]);

  // Update aggregated data when raw ticks or interval changes
  useEffect(() => {
    const aggregated = aggregateTicks(rawTicks, interval);
    setAggregatedData(aggregated);
    if (onDataUpdate) {
      onDataUpdate(aggregated);
    }
  }, [rawTicks, interval, aggregateTicks, onDataUpdate]);

  const connectWebSocket = useCallback(async () => {
    if (!symbol || !userData) {
      setError('Symbol and user data are required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const ws = new WebSocket(`ws://localhost:8000/ws/marketdata`);
      
      ws.onopen = () => {
        setIsConnected(true);
        const subscriptionMessage = {
          api_key: userData.credentials.api_key,
          api_secret: userData.credentials.api_secret,
          session_token: userData.credentials.session_token,
          scrip_code: symbol,
          exchange_code: exchange,
          interval: interval
        };
        ws.send(JSON.stringify(subscriptionMessage));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.error) {
            setError(data.error);
            return;
          }

          // Handle connection status messages
          if (data.type === 'connection_status' || data.type === 'subscription_status' || data.type === 'heartbeat') {
            return;
          }

          // Handle OHLCV data
          if (data.type === 'ohlcv') {
            const tickData: TickData = {
              price: parseFloat(data.close),
              volume: parseFloat(data.volume) || 0,
              timestamp: data.datetime,
              symbol: data.stock_code || symbol,
              exchange: data.exchange_code || exchange
            };

            setRawTicks(prevTicks => {
              const newTicks = [...prevTicks, tickData];
              // Keep only last 1000 ticks to prevent memory issues
              return newTicks.slice(-1000);
            });
            setLastUpdateTime(new Date());
            return;
          }

          // Handle tick data (real-time price updates)
          if (data.type === 'tick') {
            const tickData: TickData = {
              price: parseFloat(data.price),
              volume: parseFloat(data.volume) || 0,
              timestamp: data.timestamp || new Date().toISOString(),
              symbol: data.symbol,
              exchange: data.exchange,
              stock_name: data.stock_name
            };

            setRawTicks(prevTicks => {
              const newTicks = [...prevTicks, tickData];
              return newTicks.slice(-1000);
            });
            setLastUpdateTime(new Date());
            return;
          }

        } catch (err) {
          console.error('Error parsing websocket message:', err);
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
      };

      wsRef.current = ws;

    } catch (err) {
      setError(`Failed to connect to live data feed: ${err instanceof Error ? err.message : String(err)}`);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [symbol, exchange, interval, userData]);

  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setRawTicks([]);
    setAggregatedData([]);
  }, []);

  // Auto-connect when component mounts with symbol
  useEffect(() => {
    if (symbol && userData && !isConnected) {
      connectWebSocket();
    }
  }, [symbol, userData, isConnected, connectWebSocket]);

  // Cleanup websocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleStartStop = () => {
    if (isConnected) {
      disconnectWebSocket();
    } else {
      connectWebSocket();
    }
  };

  if (!symbol) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded">
        <div className="text-gray-500">No symbol selected for live chart</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header with controls */}
      {showControls && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-gray-800">
              {symbol} - {interval}
            </h3>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className="text-sm text-gray-600">
                {isConnected ? 'Live' : 'Disconnected'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleStartStop}
              disabled={isLoading}
              className={`px-4 py-2 rounded font-medium transition ${
                isConnected
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? 'Connecting...' : isConnected ? 'Stop' : 'Start'}
            </button>
            
            {lastUpdateTime && (
              <span className="text-xs text-gray-500">
                Last: {lastUpdateTime.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700">
          {error}
        </div>
      )}

      {/* Stats bar */}
      {isConnected && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Raw Ticks: {rawTicks.length}</span>
            <span>Candles: {aggregatedData.length}</span>
            <span>Interval: {interval}</span>
            <span>Exchange: {exchange}</span>
          </div>
        </div>
      )}

      {/* Chart container */}
      <div style={{ height }}>
        {aggregatedData.length > 0 ? (
          <ChartComponent 
            data={aggregatedData} 
            symbol={symbol}
            interval={interval}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center">
              <div className="text-gray-500 mb-2">
                {isConnected ? 'Waiting for live data...' : 'Chart not connected'}
              </div>
              <div className="text-sm text-gray-400">
                {isConnected ? 'Real-time data will appear here' : 'Click Start to begin'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveChartComponent; 