import React, { useState, useEffect } from 'react';
import ChartWrapper from './ChartWrapper';
import ChartService, { ChartData } from '../services/chartService';

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

interface DashboardWidgetProps {
  userData: UserData;
  symbol: string;
  exchange?: string;
  interval?: string;
  isLive?: boolean;
  widgetType?: 'watchlist' | 'portfolio' | 'analysis';
  height?: number;
}

const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  userData,
  symbol,
  exchange = 'NSE',
  interval = '1minute',
  isLive = false,
  widgetType = 'watchlist',
  height = 300
}) => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  // Fetch historical data for non-live charts
  useEffect(() => {
    if (!isLive && symbol) {
      fetchHistoricalData();
    }
  }, [symbol, interval, isLive]);

  const fetchHistoricalData = async () => {
    setLoading(true);
    setError(null);

    const { from, to } = ChartService.getDefaultDateRange(interval);
    
    const request = {
      api_key: userData.credentials.api_key,
      api_secret: userData.credentials.api_secret,
      session_token: userData.credentials.session_token,
      stock_code: symbol,
      exchange_code: exchange,
      interval,
      from_date: from,
      to_date: to,
    };

    const result = await ChartService.fetchHistoricalData(request);
    
    if (result.success && result.data) {
      setChartData(result.data);
      setStats(ChartService.calculateStats(result.data));
    } else {
      setError(result.error || 'Failed to fetch data');
    }
    
    setLoading(false);
  };

  const getWidgetTitle = () => {
    const baseTitle = ChartService.formatChartTitle(symbol, interval, isLive);
    switch (widgetType) {
      case 'watchlist':
        return `Watchlist: ${baseTitle}`;
      case 'portfolio':
        return `Portfolio: ${baseTitle}`;
      case 'analysis':
        return `Analysis: ${baseTitle}`;
      default:
        return baseTitle;
    }
  };

  const getWidgetStyle = () => {
    switch (widgetType) {
      case 'watchlist':
        return 'border-l-4 border-blue-500';
      case 'portfolio':
        return 'border-l-4 border-green-500';
      case 'analysis':
        return 'border-l-4 border-purple-500';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${getWidgetStyle()}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${getWidgetStyle()}`}>
        <div className="text-red-600 text-sm mb-2">Error loading chart</div>
        <div className="text-gray-500 text-xs">{error}</div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow overflow-hidden ${getWidgetStyle()}`}>
      {/* Widget Header */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">{getWidgetTitle()}</h3>
          <div className="flex items-center space-x-2">
            {stats && (
              <div className="text-xs">
                <span className={`font-medium ${stats.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{stats.currentPrice.toFixed(2)}
                </span>
                <span className={`ml-1 ${stats.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.change >= 0 ? '+' : ''}{stats.changePercent.toFixed(2)}%
                </span>
              </div>
            )}
            <div className="text-xs text-gray-500">
              {isLive ? 'LIVE' : `${chartData.length} pts`}
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ChartWrapper
        data={chartData}
        symbol={symbol}
        interval={interval}
        isLive={isLive}
        userData={userData}
        exchange={exchange}
        height={height}
        showControls={false}
        onError={setError}
      />
    </div>
  );
};

export default DashboardWidget; 