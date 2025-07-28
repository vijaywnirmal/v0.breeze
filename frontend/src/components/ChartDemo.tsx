import React, { useState } from 'react';
import LiveChartComponent from './LiveChartComponent';

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

interface ChartDemoProps {
  userData: UserData;
}

const ChartDemo: React.FC<ChartDemoProps> = ({ userData }) => {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['RELIANCE', 'TCS']);
  const [intervals, setIntervals] = useState<string[]>(['1minute', '5minute']);

  const popularStocks = [
    { symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE' },
    { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE' },
    { symbol: 'INFY', name: 'Infosys Limited', exchange: 'NSE' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank', exchange: 'NSE' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank', exchange: 'NSE' },
    { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE' },
  ];

  const addSymbol = (symbol: string) => {
    if (!selectedSymbols.includes(symbol)) {
      setSelectedSymbols([...selectedSymbols, symbol]);
    }
  };

  const removeSymbol = (symbol: string) => {
    setSelectedSymbols(selectedSymbols.filter(s => s !== symbol));
  };

  const changeInterval = (index: number, newInterval: string) => {
    const newIntervals = [...intervals];
    newIntervals[index] = newInterval;
    setIntervals(newIntervals);
  };

  return (
    <div className="bg-white shadow p-6 rounded w-full max-w-7xl">
      <h2 className="text-2xl font-bold mb-4">Live Chart Demo - Reusable Components</h2>
      <div className="text-gray-600 mb-6">
        This demo shows how the LiveChartComponent can be reused across different scenarios.
        Each chart is independent and can have its own interval and controls.
      </div>

      {/* Stock Selection */}
      <div className="mb-6 p-4 bg-gray-50 rounded">
        <h3 className="text-lg font-semibold mb-3">Select Stocks to Monitor</h3>
        <div className="flex flex-wrap gap-2">
          {popularStocks.map((stock) => (
            <button
              key={stock.symbol}
              onClick={() => addSymbol(stock.symbol)}
              disabled={selectedSymbols.includes(stock.symbol)}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                selectedSymbols.includes(stock.symbol)
                  ? 'bg-blue-600 text-white cursor-not-allowed'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {stock.symbol}
            </button>
          ))}
        </div>
        <div className="mt-3 text-sm text-gray-500">
          Selected: {selectedSymbols.join(', ')}
        </div>
      </div>

      {/* Live Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {selectedSymbols.map((symbol, index) => (
          <div key={symbol} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Chart Header */}
            <div className="flex items-center justify-between p-3 bg-gray-50 border-b">
              <div className="flex items-center space-x-3">
                <h4 className="font-semibold text-gray-800">{symbol}</h4>
                <select
                  value={intervals[index] || '1minute'}
                  onChange={(e) => changeInterval(index, e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                >
                  <option value="1minute">1 Min</option>
                  <option value="5minute">5 Min</option>
                  <option value="30minute">30 Min</option>
                  <option value="1day">1 Day</option>
                </select>
              </div>
              <button
                onClick={() => removeSymbol(symbol)}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Remove
              </button>
            </div>

            {/* Live Chart Component */}
            <LiveChartComponent
              userData={userData}
              symbol={symbol}
              exchange="NSE"
              interval={intervals[index] || '1minute'}
              height={400}
              showControls={false} // Hide controls since we have custom header
            />
          </div>
        ))}
      </div>

      {/* Empty State */}
      {selectedSymbols.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-2">No charts selected</div>
          <div className="text-sm text-gray-400">Select stocks above to start monitoring</div>
        </div>
      )}

      {/* Usage Instructions */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">How to Use This Component</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• Each chart is completely independent and reusable</div>
          <div>• Charts can have different intervals and symbols</div>
          <div>• All charts share the same user credentials</div>
          <div>• Charts automatically connect/disconnect based on visibility</div>
          <div>• You can embed this component anywhere in your app</div>
        </div>
      </div>
    </div>
  );
};

export default ChartDemo; 