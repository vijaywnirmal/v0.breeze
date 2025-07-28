import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChartComponent from './ChartComponent';

// Types for login and user data
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

type Page = 'dashboard' | 'funds' | 'market' | 'history' | 'order' | 'portfolio' | 'livechart';

function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [credentials, setCredentials] = useState<Credentials>({
    api_key: '',
    api_secret: '',
    session_token: '',
  });
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle login form submit
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate credentials
    if (!credentials.api_key.trim() || !credentials.api_secret.trim() || !credentials.session_token.trim()) {
      setError('All fields are required');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      if (data.success) {
        setUserData(data);
        setPage('dashboard');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [credentials]);

  // Navigation bar for logged-in users
  const NavBar = useCallback(() => (
    <nav className="flex flex-wrap gap-4 mb-8 justify-center items-center w-full" role="navigation" aria-label="Main navigation">
      {[
        ['dashboard','Dashboard'],
        ['funds','Funds'],
        ['market','Market Quote'],
        ['history','Historical Data'],
        ['order','Order'],
        ['portfolio','Portfolio'],
        ['livechart','Live Chart']
      ].map(([key, label]) => (
        <button
          key={key}
          className={`px-4 py-1 rounded transition-colors duration-150 ${
            page === key 
              ? 'bg-blue-600 text-white font-bold' 
              : 'bg-transparent text-blue-600 border border-blue-600 hover:bg-blue-600 hover:text-white'
          }`}
          onClick={() => setPage(key as Page)}
          aria-current={page === key ? 'page' : undefined}
        >
          {label}
        </button>
      ))}
      <button
        className="ml-4 px-4 py-1 rounded bg-red-600 text-white border border-red-600 hover:bg-red-700 transition-colors duration-150"
        onClick={() => {
          setUserData(null); 
          setPage('dashboard');
        }}
        aria-label="Logout"
      >
        Logout
      </button>
    </nav>
  ), [page]);

  // Dashboard page
  const Dashboard = () => userData && (
    <div className="bg-white shadow p-6 rounded w-full max-w-md text-left">
      <h2 className="text-xl font-semibold mb-2">Welcome, {userData.user_name}</h2>
      <div className="mb-2 text-gray-700">User ID: {userData.userid}</div>
      <div className="mb-2 text-gray-700">Funds: <pre className="inline">{JSON.stringify(userData.funds, null, 2)}</pre></div>
      <div className="text-gray-500 text-sm mt-4">Use the navigation above to access all features.</div>
    </div>
  );

  // Funds page (allocate/unallocate)
  const Funds = () => {
    const [segment, setSegment] = useState('equity');
    const [amount, setAmount] = useState('');
    const [action, setAction] = useState<'allocate' | 'unallocate'>('allocate');
    const [message, setMessage] = useState<string | null>(null);
    const [msgType, setMsgType] = useState<'success' | 'error'>('success');
    const [loading, setLoading] = useState(false);

    const handleFunds = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setMessage(null);
      try {
        const endpoint = action === 'allocate' ? '/api/allocate_funds' : '/api/unallocate_funds';
        const res = await fetch(`http://localhost:8000${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...userData?.credentials,
            segment,
            amount: Number(amount),
          }),
        });
        const data = await res.json();
        if (data.success) {
          setMsgType('success');
          setMessage(data.message || 'Success');
          // Optionally update funds in dashboard
          if (userData) {
            const fundsRes = await fetch('http://localhost:8000/api/funds', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(userData.credentials),
            });
            const fundsData = await fundsRes.json();
            if (fundsData.success) setUserData({ ...userData, funds: fundsData.funds });
          }
        } else {
          setMsgType('error');
          setMessage(data.message || 'Error');
        }
      } catch (err) {
        setMsgType('error');
        setMessage('Network error');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="bg-white shadow p-6 rounded w-full max-w-md flex flex-col gap-4">
        <h2 className="text-lg font-semibold mb-2">Funds Management</h2>
        <form onSubmit={handleFunds} className="flex flex-col gap-2">
          <label>
            Segment:
            <select className="border p-2 rounded w-full" value={segment} onChange={e => setSegment(e.target.value)}>
              <option value="equity">Equity</option>
              <option value="fno">FNO</option>
              <option value="commodity">Commodity</option>
            </select>
          </label>
          <label>
            Amount:
            <input
              className="border p-2 rounded w-full"
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className={action==='allocate' ? 'bg-blue-600 text-white rounded p-2 font-semibold flex-1' : 'border rounded p-2 flex-1'}
              onClick={()=>setAction('allocate')}
            >Allocate</button>
            <button
              type="button"
              className={action==='unallocate' ? 'bg-blue-600 text-white rounded p-2 font-semibold flex-1' : 'border rounded p-2 flex-1'}
              onClick={()=>setAction('unallocate')}
            >Unallocate</button>
          </div>
          <button
            type="submit"
            className="bg-green-600 text-white rounded p-2 font-semibold mt-2 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? (action==='allocate' ? 'Allocating...' : 'Unallocating...') : (action==='allocate' ? 'Allocate Funds' : 'Unallocate Funds')}
          </button>
        </form>
        {message && <div className={msgType==='success' ? 'text-green-600' : 'text-red-600'}>{message}</div>}
      </div>
    );
  };

  // Market Quote page (with NFO option)
  const MarketQuote = () => {
    const [exchange, setExchange] = useState('NSE');
    const [stockCode, setStockCode] = useState('');
    const [productType, setProductType] = useState('cash');
    const [expiryDate, setExpiryDate] = useState('');
    const [right, setRight] = useState('others');
    const [strikePrice, setStrikePrice] = useState('');
    const [quote, setQuote] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Scrip search states
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);

    useEffect(() => {
      setExpiryDate('');
      setRight('others');
      setStrikePrice('');
    }, [productType, exchange]);

    // Scrip search effect
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
    }, [searchQuery]);

    // Handle click outside to close dropdown
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

    const fetchScripResults = useCallback(async (search: string) => {
      setSearchLoading(true);
      try {
        console.log('Searching for:', search);
        const res = await fetch(
          `/scrips/search?q=${encodeURIComponent(search)}&limit=5`
        );
        
        if (!res.ok) {
          if (res.status === 422) {
            console.error('Validation error - check parameter types');
            setSearchResults([]);
            setShowResults(false);
            return;
          }
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        console.log('Search response:', data);
        
        if (Array.isArray(data)) {
          setSearchResults(data);
          setShowResults(true);
        } else if (data.error) {
          console.error('Search error:', data.error);
          setSearchResults([]);
          setShowResults(false);
        } else {
          setSearchResults([]);
          setShowResults(false);
        }
      } catch (err) {
        console.error("Failed to fetch scrips", err);
        setSearchResults([]);
        setShowResults(false);
      } finally {
        setSearchLoading(false);
      }
    }, []);

    const selectScrip = useCallback((scrip: ScripData) => {
      setStockCode(scrip.ticker);
      setSearchQuery(scrip.ticker);
      setShowResults(false);
    }, []);

    const isEquity = (exchange === 'NSE' || exchange === 'BSE') && productType === 'cash';
    const isFutures = productType === 'futures';
    const isOptions = productType === 'options';

    const canSubmit = (stockCode || searchQuery).trim() && (!isFutures || expiryDate) && (!isOptions || (expiryDate && right && strikePrice)) && !loading;

    const handleQuote = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setQuote(null);
      const finalStockCode = stockCode || searchQuery;
      let payload: any = {
        api_key: userData?.credentials.api_key,
        api_secret: userData?.credentials.api_secret,
        session_token: userData?.credentials.session_token,
        stock_code: finalStockCode.trim(),
        product_type: productType,
        exchange_code: exchange,
      };
      if (isEquity) {
        payload.expiry_date = '';
        payload.right = '';
        payload.strike_price = '';
      } else if (isFutures) {
        payload.expiry_date = expiryDate;
        payload.right = 'others';
        payload.strike_price = '0';
      } else if (isOptions) {
        payload.expiry_date = expiryDate;
        payload.right = right;
        payload.strike_price = strikePrice;
      }
      try {
        const res = await fetch('/api/market_quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success !== false) {
          setQuote(data);
        } else {
          setError(data.message || 'Failed to fetch quote');
        }
      } catch (err) {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="max-w-md mx-auto p-4 bg-white rounded shadow">
        <form onSubmit={handleQuote} className="flex flex-col gap-4" autoComplete="off">
          <label>
            Exchange Code
            <select className="w-full p-2 border rounded bg-[#181818] text-white" value={exchange} onChange={e => setExchange(e.target.value)}>
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
              <option value="NFO">NFO</option>
              <option value="BFO">BFO</option>
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
            Product Type
            <select className="w-full p-2 border rounded bg-[#181818] text-white" value={productType} onChange={e => setProductType(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="futures">Futures</option>
              <option value="options">Options</option>
            </select>
          </label>
          {isFutures && (
            <label>
              Expiry Date
              <input className="w-full p-2 border rounded bg-[#181818] text-white" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
            </label>
          )}
          {isOptions && (
            <>
              <label>
                Expiry Date
                <input className="w-full p-2 border rounded bg-[#181818] text-white" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
              </label>
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
          <button type="submit" disabled={!canSubmit} className="bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 transition disabled:opacity-50">{loading ? 'Loading...' : 'Get Quote'}</button>
        </form>
        {error && <div className="text-red-600 mt-2">{error}</div>}
        {quote && <pre className="bg-gray-100 p-2 mt-4 rounded text-xs overflow-x-auto">{JSON.stringify(quote, null, 2)}</pre>}
      </div>
    );
  };

  // Historical Data page
  const HistoricalData = () => {
    // Get today's date and set default times
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    const defaultFromTime = `${todayStr}T09:15`; // 9:15 AM
    const defaultToTime = `${todayStr}T15:30`; // 3:30 PM
    
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

    // Scrip search states
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);

    // View toggle state
    const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

    // Dynamic field logic
    const isFutures = instrument === 'futures';
    const isOptions = instrument === 'options';

    // Scrip search effect
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

    // Handle click outside to close dropdown
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

    // Exchange code options
    const exchangeOptions = [
      { value: 'NSE', label: 'NSE (Equity)' },
      { value: 'BSE', label: 'BSE (Equity)' },
      { value: 'NFO', label: 'NFO (Futures/Options)' },
      { value: 'BFO', label: 'BFO (Futures/Options)' },
    ];

    // Interval options
    const intervalOptions = [
      '1minute', '5minute', '30minute', '1day'
    ];

    const fetchScripResults = async (search: string) => {
      setSearchLoading(true);
      try {
        console.log('Searching for:', search, 'Instrument:', instrument);
        
        // Map instrument type to product_type for API
        let productType = 'cash';
        if (instrument === 'futures') productType = 'futures';
        else if (instrument === 'options') productType = 'options';
        
        const res = await fetch(
          `http://localhost:8000/scrips/search?q=${encodeURIComponent(search)}&product_type=${productType}&limit=5`
        );
        
        if (!res.ok) {
          if (res.status === 422) {
            console.error('Validation error - check parameter types');
            setSearchResults([]);
            setShowResults(false);
            return;
          }
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        console.log('Search response:', data);
        
        if (Array.isArray(data)) {
          setSearchResults(data);
          setShowResults(true);
        } else if (data.error) {
          console.error('Search error:', data.error);
          setSearchResults([]);
          setShowResults(false);
        } else {
          setSearchResults([]);
          setShowResults(false);
        }
      } catch (err) {
        console.error("Failed to fetch scrips", err);
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

    // Handle form submit
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
        const res = await fetch('http://localhost:8000/api/historical_data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        console.log('Historical data response:', json);
        
        if (json.success && json.data) {
          // The Breeze API returns data in format: {"Success": [...], "Status": 200, "Error": None}
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
            {/* View Toggle */}
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

            {/* Data Display */}
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
                <ChartComponent 
                  data={data} 
                  symbol={`${stockCode || searchQuery} ${instrument.toUpperCase()}`}
                  interval={interval}
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // Order page
  const Order = () => (
    <div className="bg-white shadow p-6 rounded w-full max-w-md flex flex-col gap-4">
      <h2 className="text-lg font-semibold mb-2">Place Order</h2>
      <div className="text-gray-500 text-sm mb-2">Place buy/sell orders for stocks/options/futures.</div>
      {/* TODO: Add form for order placement */}
      <div className="text-gray-400">(Form coming soon)</div>
    </div>
  );

  // Portfolio page
  const Portfolio = () => (
    <div className="bg-white shadow p-6 rounded w-full max-w-md flex flex-col gap-4">
      <h2 className="text-lg font-semibold mb-2">Portfolio</h2>
      <div className="text-gray-500 text-sm mb-2">View holdings and positions.</div>
      {/* TODO: Add tables for holdings and positions */}
      <div className="text-gray-400">(Tables coming soon)</div>
    </div>
  );

  // Live Chart page
  const LiveChart = () => {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [scripResults, setScripResults] = useState<ScripData[]>([]);
    const [showResults, setShowResults] = useState<boolean>(false);
    const [selectedScrip, setSelectedScrip] = useState<ScripData | null>(null);
    const [displayInterval, setDisplayInterval] = useState<string>('1minute');
    const [rawTicks, setRawTicks] = useState<TickData[]>([]);
    const [aggregatedData, setAggregatedData] = useState<CandleData[]>([]);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [stockToken, setStockToken] = useState<string>('');
    const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    // Close dropdown when clicking outside
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
        console.log('Fetching scrip results for:', search);
        const response = await fetch(`/scrips/search?q=${encodeURIComponent(search)}&limit=10`);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Scrip results:', data);
        setScripResults(data);
        setShowResults(true);
      } catch (err) {
        console.error('Error fetching scrip results:', err);
        setScripResults([]);
        setShowResults(false);
      }
    }, []);

    const selectScrip = useCallback((scrip: ScripData) => {
      setSelectedScrip(scrip);
      setSearchQuery(scrip.ticker);
      setShowResults(false);
      
      // Generate stock token format: exchange_code.stock_code
      const token = `${scrip.exchange}.${scrip.ticker}`;
      setStockToken(token);
    }, []);

    const connectWebSocket = async () => {
      if (!selectedScrip || !userData) return;

      setIsLoading(true);
      setError(null);

      try {
        // Connect to websocket endpoint
        const ws = new WebSocket(`ws://localhost:8000/ws/marketdata`);
        
        ws.onopen = () => {
          console.log('WebSocket connected to backend');
          setIsConnected(true);
          
          // Send subscription message (no interval - we want raw ticks)
          const subscriptionMessage = {
            api_key: userData.credentials.api_key,
            api_secret: userData.credentials.api_secret,
            session_token: userData.credentials.session_token,
            scrip_code: selectedScrip.ticker,
            exchange_code: selectedScrip.exchange
          };
          
          console.log('Sending subscription message:', {
            scrip_code: selectedScrip.ticker,
            exchange_code: selectedScrip.exchange
          });
          
          ws.send(JSON.stringify(subscriptionMessage));
        };

        ws.onmessage = (event) => {
          console.log('WebSocket message:', event.data);
          try {
            const data = JSON.parse(event.data);
            
            if (data.error) {
              setError(data.error);
              return;
            }

            // Handle connection status messages
            if (data.type === 'connection_status') {
              console.log('WebSocket status:', data.message);
              return;
            }

            // Handle subscription status messages
            if (data.type === 'subscription_status') {
              console.log('Subscription status:', data.message);
              return;
            }

            // Handle heartbeat messages
            if (data.type === 'heartbeat') {
              console.log('Heartbeat received:', data.message);
              return;
            }

            // Handle tick data (real-time price updates)
            if (data.type === 'tick') {
              const tickData = {
                price: parseFloat(data.price),
                volume: parseFloat(data.volume) || 0,
                timestamp: data.timestamp || new Date().toISOString(),
                symbol: data.symbol,
                exchange: data.exchange,
                stock_name: data.stock_name
              };

              setRawTicks(prevTicks => {
                const newTicks = [...prevTicks, tickData];
                // Keep only last 1000 ticks to prevent memory issues
                return newTicks.slice(-1000);
              });
              setLastUpdateTime(new Date());
              return;
            }

            // Handle OHLCV data (if any)
            if (data.type === 'ohlcv') {
              const tickData = {
                price: parseFloat(data.close),
                volume: parseFloat(data.volume) || 0,
                timestamp: data.datetime,
                symbol: data.stock_code,
                exchange: data.exchange_code
              };

              setRawTicks(prevTicks => {
                const newTicks = [...prevTicks, tickData];
                return newTicks.slice(-1000);
              });
              setLastUpdateTime(new Date());
              return;
            }

            // Handle raw data (fallback)
            if (data.type === 'raw') {
              console.log('Received raw data:', data.data);
              return;
            }

            console.log('Unhandled websocket message:', data);

          } catch (err) {
            console.error('Error parsing websocket message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setError('WebSocket connection error');
          setIsConnected(false);
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
        };

        wsRef.current = ws;

      } catch (err) {
        console.error('Error connecting to websocket:', err);
        setError(`Failed to connect to live data feed: ${err instanceof Error ? err.message : String(err)}`);
        setIsConnected(false);
      } finally {
        setIsLoading(false);
      }
    };

    const disconnectWebSocket = () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      setRawTicks([]);
      setAggregatedData([]);
    };

      // Aggregate raw ticks into OHLCV data based on display interval
  const aggregateTicks = (ticks: any[], interval: string) => {
    if (ticks.length === 0) return [];
    
    const intervalMs = getIntervalMs(interval);
    const aggregated: any = {};
    
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
    
    return Object.values(aggregated).sort((a: any, b: any) => a.time - b.time);
  };
  
  // Get milliseconds for interval
  const getIntervalMs = (interval: string) => {
    switch (interval) {
      case '1minute': return 60 * 1000;
      case '5minute': return 5 * 60 * 1000;
      case '30minute': return 30 * 60 * 1000;
      case '1day': return 24 * 60 * 60 * 1000;
      default: return 60 * 1000;
    }
  };
  
  // Update aggregated data when raw ticks or display interval changes
  useEffect(() => {
    const aggregated = aggregateTicks(rawTicks, displayInterval);
    setAggregatedData(aggregated);
  }, [rawTicks, displayInterval]);
  
  // Cleanup websocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

    const handleStartLiveChart = () => {
      if (isConnected) {
        disconnectWebSocket();
      } else {
        connectWebSocket();
      }
    };

    return (
      <div className="bg-white shadow p-6 rounded w-full max-w-4xl flex flex-col gap-4">
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

          {/* Connection Status and Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleStartLiveChart}
              disabled={!selectedScrip || isLoading}
              className={`px-4 py-2 rounded font-medium transition ${
                isConnected
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              } ${(!selectedScrip || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? 'Connecting...' : isConnected ? 'Stop Live Chart' : 'Start Live Chart'}
            </button>
            
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {selectedScrip && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="text-sm">
                <strong>Selected:</strong> {selectedScrip.ticker} - {selectedScrip.name}
              </div>
              <div className="text-xs text-gray-600">
                Exchange: {selectedScrip.exchange} | Type: {selectedScrip.instrument_type}
              </div>
              {stockToken && (
                <div className="text-xs text-gray-600">
                  Stock Token: {stockToken}
                </div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                Real-time tick data will be aggregated into {displayInterval} candles
              </div>
            </div>
          )}

          {/* Real-time Stats */}
          {isConnected && (
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <div className="text-sm text-green-700">
                <strong>Live Stats:</strong>
              </div>
              <div className="text-xs text-green-600 mt-1">
                Raw Ticks: {rawTicks.length} | Aggregated Candles: {aggregatedData.length} | Display Interval: {displayInterval}
              </div>
              {lastUpdateTime && (
                <div className="text-xs text-green-600">
                  Last Tick: {lastUpdateTime.toLocaleTimeString()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Chart */}
        {aggregatedData.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex justify-between items-center text-sm text-gray-600">
              <div>
                Raw Ticks: {rawTicks.length} | Aggregated Candles: {aggregatedData.length} | Display: {displayInterval} | Last Update: {lastUpdateTime ? lastUpdateTime.toLocaleTimeString() : 'Never'}
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span className="text-xs">
                  {isConnected ? 'Streaming' : 'Disconnected'}
                </span>
              </div>
            </div>
            <ChartComponent 
              data={aggregatedData} 
              symbol={`${selectedScrip?.ticker || 'Live'} ${displayInterval}`}
              interval={displayInterval}
            />
          </div>
        )}

        {selectedScrip && rawTicks.length === 0 && isConnected && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded text-center">
            <div className="text-yellow-700">Waiting for live data...</div>
            <div className="text-sm text-yellow-600 mt-1">Raw ticks will be aggregated into {displayInterval} candles</div>
          </div>
        )}
      </div>
    );
  };

  // Remove all page === 'login' and page !== 'login' checks
  // Instead, render login form if !userData, else render NavBar and main app
  if (!userData) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-100">
        <form onSubmit={handleLogin} className="bg-white shadow p-8 rounded-lg flex flex-col gap-4 w-full max-w-xs">
          <h2 className="text-xl font-semibold mb-4">Login</h2>
          <input className="p-2 border border-gray-700 rounded bg-[#181818] text-white placeholder-gray-500 focus:outline-none focus:border-blue-600 transition" type="text" placeholder="API Key" value={credentials.api_key} onChange={e=>setCredentials(c=>({...c, api_key: e.target.value}))} required />
          <input className="p-2 border border-gray-700 rounded bg-[#181818] text-white placeholder-gray-500 focus:outline-none focus:border-blue-600 transition" type="text" placeholder="API Secret" value={credentials.api_secret} onChange={e=>setCredentials(c=>({...c, api_secret: e.target.value}))} required />
          <input className="p-2 border border-gray-700 rounded bg-[#181818] text-white placeholder-gray-500 focus:outline-none focus:border-blue-600 transition" type="text" placeholder="Session Token" value={credentials.session_token} onChange={e=>setCredentials(c=>({...c, session_token: e.target.value}))} required />
          <button className="bg-blue-600 text-white py-2 rounded mt-2 font-semibold hover:bg-blue-700 transition" type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
          {error && <div className="text-red-600 mt-2">{error}</div>}
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center">
      <NavBar />
      <div className="flex flex-col md:flex-row gap-8 justify-center items-start w-full max-w-5xl mt-8 px-4">
        <div className="flex-1 flex justify-center">
          {page === 'dashboard' && <Dashboard />}
          {page === 'funds' && <Funds />}
          {page === 'market' && <MarketQuote />}
          {page === 'history' && <HistoricalData />}
          {page === 'order' && <Order />}
          {page === 'portfolio' && <Portfolio />}
          {page === 'livechart' && <LiveChart />}
        </div>
      </div>
    </div>
  );
}

export default App;
