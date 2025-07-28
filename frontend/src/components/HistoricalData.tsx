import React, { useState, useEffect, useCallback } from 'react';
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

interface ScripData {
  ticker: string;
  name: string;
  exchange: string;
  instrument_type: string;
}

interface HistoricalDataProps {
  userData: UserData;
}

const HistoricalData: React.FC<HistoricalDataProps> = ({ userData }) => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const defaultFromTime = `${todayStr}T09:15`;
  const defaultToTime = `${todayStr}T15:30`;

  const [instrument, setInstrument] = useState<'equity' | 'futures' | 'options'>('equity');
  const [stockCode, setStockCode] = useState('');
  const [exchangeCode, setExchangeCode] = useState('NSE');
  const [interval, setInterval] = useState('1minute');
  const [fromDate, setFromDate] = useState(defaultFromTime);
  const [toDate, setToDate] = useState(defaultToTime);
  const [expiryDate, setExpiryDate] = useState('');
  const [right, setRight] = useState('call');
  const [strikePrice, setStrikePrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  const isFutures = instrument === 'futures';
  const isOptions = instrument === 'options';

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.length >= 2) {
        fetchScripResults(searchQuery);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery, instrument]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.scrip-search-container')) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const exchangeOptions = [
    { value: 'NSE', label: 'NSE (Equity)' },
    { value: 'BSE', label: 'BSE (Equity)' },
    { value: 'NFO', label: 'NFO (Futures/Options)' },
    { value: 'BFO', label: 'BFO (Futures/Options)' },
  ];

  const intervalOptions = [
    '1minute', '5minute', '30minute', '1day'
  ];

  const fetchScripResults = async (search: string) => {
    setSearchLoading(true);
    try {
      let productType = 'cash';
      if (instrument === 'futures') productType = 'futures';
      else if (instrument === 'options') productType = 'options';
      const res = await fetch(
        `/scrips/search?q=${encodeURIComponent(search)}&product_type=${productType}&limit=5`
      );
      if (!res.ok) {
        if (res.status === 422) {
          setSearchResults([]);
          setShowResults(false);
          return;
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setSearchResults(data);
        setShowResults(true);
      } else if (data.error) {
        setSearchResults([]);
        setShowResults(false);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    } catch (err) {
      setSearchResults([]);
      setShowResults(false);
    } finally {
      setSearchLoading(false);
    }
  };

  const selectScrip = (scrip: any) => {
    setStockCode(scrip.ticker);
    setSearchQuery(scrip.ticker);
    setShowResults(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData([]);
    try {
      const finalStockCode = stockCode || searchQuery;
      const payload: any = {
        api_key: userData?.credentials.api_key,
        api_secret: userData?.credentials.api_secret,
        session_token: userData?.credentials.session_token,
        stock_code: finalStockCode.trim(),
        exchange_code: exchangeCode,
        interval,
        from_date: fromDate,
        to_date: toDate,
        product_type: instrument === 'equity' ? 'cash' : instrument,
      };
      if (isFutures || isOptions) payload.expiry_date = expiryDate;
      if (isOptions) {
        payload.right = right;
        payload.strike_price = strikePrice;
      } else if (isFutures) {
        payload.right = 'others';
        payload.strike_price = '0';
      }
      const res = await fetch('/api/historical_data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.Success) {
          setData(json.data.Success);
        } else if (json.data.Error) {
          setError(json.data.Error);
        } else {
          setError('No data received from API');
        }
      } else {
        setError(json.message || 'Failed to fetch data');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow p-6 rounded w-full max-w-2xl flex flex-col gap-4">
      <h2 className="text-lg font-semibold mb-2">Historical Data</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label>
          Instrument Type
          <select className="w-full p-2 border rounded bg-[#181818] text-white" value={instrument} onChange={e => setInstrument(e.target.value as any)}>
            <option value="equity">Equity</option>
            <option value="futures">Futures</option>
            <option value="options">Options</option>
          </select>
        </label>
        <label className="relative scrip-search-container">
          Stock Code
          <input 
            className="w-full p-2 border rounded bg-[#181818] text-white" 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && searchResults.length > 0 && setShowResults(true)}
            placeholder="Search for stock..."
            required 
          />
          {searchLoading && (
            <div className="absolute right-2 top-8 text-xs text-gray-400">Loading...</div>
          )}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-[#222] border border-gray-600 rounded shadow-lg max-h-64 overflow-y-auto">
              {searchResults.map((scrip, index) => (
                <div
                  key={`${scrip.ticker}-${scrip.exchange}-${index}`}
                  className="p-2 hover:bg-[#333] cursor-pointer border-b border-gray-600 last:border-b-0"
                  onClick={() => selectScrip(scrip)}
                >
                  <div className="font-semibold text-white">{scrip.ticker}</div>
                  <div className="text-sm text-gray-300">{scrip.name || 'N/A'}</div>
                  <div className="text-xs text-gray-400">
                    {scrip.segment || 'N/A'}
                    {scrip.instrument && ` | ${scrip.instrument}`}
                    {scrip.expiry && ` | Exp: ${scrip.expiry}`}
                    {scrip.strike && ` | Strike: ${scrip.strike}`}
                    {scrip.option_type && ` | ${scrip.option_type}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </label>
        <label>
          Exchange Code
          <select className="w-full p-2 border rounded bg-[#181818] text-white" value={exchangeCode} onChange={e => setExchangeCode(e.target.value)}>
            {exchangeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </label>
        <label>
          Interval
          <select className="w-full p-2 border rounded bg-[#181818] text-white" value={interval} onChange={e => setInterval(e.target.value)}>
            {intervalOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <label className="flex-1">
            From Date
            <input className="w-full p-2 border rounded bg-[#181818] text-white" type="datetime-local" value={fromDate} onChange={e => setFromDate(e.target.value)} required />
          </label>
          <label className="flex-1">
            To Date
            <input className="w-full p-2 border rounded bg-[#181818] text-white" type="datetime-local" value={toDate} onChange={e => setToDate(e.target.value)} required />
          </label>
        </div>
        {(isFutures || isOptions) && (
          <label>
            Expiry Date
            <input className="w-full p-2 border rounded bg-[#181818] text-white" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
          </label>
        )}
        {isOptions && (
          <>
            <label>
              Right
              <select className="w-full p-2 border rounded bg-[#181818] text-white" value={right} onChange={e => setRight(e.target.value)}>
                <option value="call">Call</option>
                <option value="put">Put</option>
              </select>
            </label>
            <label>
              Strike Price
              <input className="w-full p-2 border rounded bg-[#181818] text-white" type="number" value={strikePrice} onChange={e => setStrikePrice(e.target.value)} required />
            </label>
          </>
        )}
        <button type="submit" className="bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 transition mt-2" disabled={loading || !((stockCode || searchQuery).trim())}>{loading ? 'Loading...' : 'Fetch Data'}</button>
      </form>
      {error && <div className="text-red-600 mt-2">{error}</div>}
      {data.length > 0 && (
        <div className="text-green-500 text-sm mb-2">Data loaded: {data.length} records</div>
      )}
      {data.length > 0 && (
        <>
          <div className="flex gap-2 mt-4 mb-2">
            <button
              type="button"
              className={`px-4 py-2 rounded font-semibold transition ${
                viewMode === 'table' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
              onClick={() => setViewMode('table')}
            >
              Table View
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded font-semibold transition ${
                viewMode === 'chart' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
              onClick={() => setViewMode('chart')}
            >
              Chart View
            </button>
          </div>
          <div className="text-blue-500 text-sm mb-2">Current view mode: {viewMode}</div>
          {viewMode === 'table' ? (
            <div className="overflow-x-auto mt-4">
              <table className="min-w-full text-xs text-left">
                <thead>
                  <tr>
                    <th className="px-2 py-1">Datetime</th>
                    <th className="px-2 py-1">Open</th>
                    <th className="px-2 py-1">High</th>
                    <th className="px-2 py-1">Low</th>
                    <th className="px-2 py-1">Close</th>
                    <th className="px-2 py-1">Volume</th>
                    {data[0].open_interest !== undefined && <th className="px-2 py-1">Open Interest</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={`${row.datetime}-${i}`} className="border-t border-gray-700">
                      <td className="px-2 py-1">{row.datetime}</td>
                      <td className="px-2 py-1">{row.open}</td>
                      <td className="px-2 py-1">{row.high}</td>
                      <td className="px-2 py-1">{row.low}</td>
                      <td className="px-2 py-1">{row.close}</td>
                      <td className="px-2 py-1">{row.volume}</td>
                      {row.open_interest !== undefined && <td className="px-2 py-1">{row.open_interest}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4">
              <ChartWrapper 
                data={data} 
                symbol={`${stockCode || searchQuery} ${instrument.toUpperCase()}`}
                interval={interval}
                title={ChartService.formatChartTitle(`${stockCode || searchQuery} ${instrument.toUpperCase()}`, interval)}
                height={500}
                showControls={false}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HistoricalData; 