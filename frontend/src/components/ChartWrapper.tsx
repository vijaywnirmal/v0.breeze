import React, { useState, useEffect } from 'react';
import ChartComponent from '../ChartComponent';
import LiveChartComponent from './LiveChartComponent';
import { ChartData } from '../services/chartService';

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

interface ChartWrapperProps {
  // Data props
  data?: ChartData[]; // For historical data
  symbol?: string;
  interval?: string;
  
  // Live chart props
  isLive?: boolean;
  userData?: UserData;
  exchange?: string;
  
  // Display props
  height?: number;
  showControls?: boolean;
  showVolume?: boolean;
  title?: string;
  
  // Callbacks
  onDataUpdate?: (data: ChartData[]) => void;
  onError?: (error: string) => void;
}

const ChartWrapper: React.FC<ChartWrapperProps> = ({
  data = [],
  symbol = 'Chart',
  interval = '1minute',
  isLive = false,
  userData,
  exchange = 'NSE',
  height = 500,
  showControls = true,
  showVolume = true,
  title,
  onDataUpdate,
  onError
}) => {
  const [error, setError] = useState<string | null>(null);

  // Handle errors
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Validate props
  if (isLive && !userData) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded">
        <div className="text-gray-500">User data required for live charts</div>
      </div>
    );
  }

  if (!isLive && data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded">
        <div className="text-gray-500">No data available for chart</div>
      </div>
    );
  }

  // Render live chart
  if (isLive && userData) {
    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {title && (
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          </div>
        )}
        <LiveChartComponent
          userData={userData}
          symbol={symbol}
          exchange={exchange}
          interval={interval}
          height={height}
          showControls={showControls}
          onDataUpdate={onDataUpdate}
        />
      </div>
    );
  }

  // Render historical chart
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {title && (
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <div className="text-sm text-gray-600">
            {data.length} data points • {interval} interval
          </div>
        </div>
      )}
      <div style={{ height }}>
        <ChartComponent
          data={data}
          symbol={symbol}
          interval={interval}
        />
      </div>
    </div>
  );
};

export default ChartWrapper; 