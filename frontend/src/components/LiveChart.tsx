import React, { useState, useEffect, useCallback } from 'react';
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

interface ScripData {
  ticker: string;
  name: string;
  exchange: string;
  instrument_type: string;
}

interface LiveChartProps {
  userData: UserData;
}

const LiveChart: React.FC<LiveChartProps> = ({ userData }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scripResults, setScripResults] = useState<ScripData[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [selectedScrip, setSelectedScrip] = useState<ScripData | null>(null);
  const [displayInterval, setDisplayInterval] = useState<string>('1minute');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showResults && !(event.target as Element).closest('.search-container')) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showResults]);

  const fetchScripResults = useCallback(async (search: string) => {
    if (search.length < 2) {
      setScripResults([]);
      return;
    }
    try {
      const response = await fetch(`/scrips/search?q=${encodeURIComponent(search)}&limit=10`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setScripResults(data);
      setShowResults(true);
    } catch (err) {
      setScripResults([]);
      setShowResults(false);
    }
  }, []);

  const selectScrip = useCallback((scrip: ScripData) => {
    setSelectedScrip(scrip);
    setSearchQuery(scrip.ticker);
    setShowResults(false);
  }, []);

  return (
    <div className="bg-white shadow p-6 rounded w-full max-w-6xl flex flex-col gap-4">
      <h2 className="text-lg font-semibold mb-2">Live Chart</h2>
      <div className="text-gray-500 text-sm mb-4">Real-time market data charts with websocket streaming.</div>
      
      {/* Stock Selection */}
      <div className="flex flex-col gap-4">
        <div className="search-container relative">
          <input
            type="text"
            placeholder="Search for stocks..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              fetchScripResults(e.target.value);
            }}
            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
          {showResults && scripResults.length > 0 && (
            <div className="absolute z-10 w-full bg-white border border-gray-300 rounded mt-1 max-h-60 overflow-y-auto">
              {scripResults.map((scrip, index) => (
                <div
                  key={index}
                  className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-200"
                  onClick={() => selectScrip(scrip)}
                >
                  <div className="font-medium">{scrip.ticker}</div>
                  <div className="text-sm text-gray-600">{scrip.name}</div>
                  <div className="text-xs text-gray-500">{scrip.exchange} - {scrip.instrument_type}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Display Interval Selection */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Display Interval:</label>
          <select
            value={displayInterval}
            onChange={(e) => setDisplayInterval(e.target.value)}
            className="p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          >
            <option value="1minute">1 Minute</option>
            <option value="5minute">5 Minutes</option>
            <option value="30minute">30 Minutes</option>
            <option value="1day">1 Day</option>
          </select>
          <div className="text-xs text-gray-500">
            (Can be changed anytime)
          </div>
        </div>

        {selectedScrip && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="text-sm">
              <strong>Selected:</strong> {selectedScrip.ticker} - {selectedScrip.name}
            </div>
            <div className="text-xs text-gray-600">
              Exchange: {selectedScrip.exchange} | Type: {selectedScrip.instrument_type}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Real-time tick data will be aggregated into {displayInterval} candles
            </div>
          </div>
        )}
      </div>

      {/* Live Chart Component */}
      {selectedScrip && (
        <LiveChartComponent
          userData={userData}
          symbol={selectedScrip.ticker}
          exchange={selectedScrip.exchange}
          interval={displayInterval}
          height={500}
          showControls={true}
        />
      )}

      {!selectedScrip && (
        <div className="mt-4 p-8 bg-gray-50 border border-gray-200 rounded text-center">
          <div className="text-gray-500 mb-2">Select a stock to view live chart</div>
          <div className="text-sm text-gray-400">Search for any stock above to start streaming real-time data</div>
        </div>
      )}
    </div>
  );
};

export default LiveChart; 