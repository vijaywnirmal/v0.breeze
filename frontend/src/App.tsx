import React, { useState, useEffect } from 'react';
import { createChart } from 'lightweight-charts';
import { useRef } from 'react';
import TestChart from './TestChart';

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
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const data = await res.json();
      if (data.success) {
        setUserData(data);
        setPage('dashboard');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Navigation bar for logged-in users
  const NavBar = () => (
    <nav className="flex gap-4 mb-8 justify-center">
      <button className={page==='dashboard'?"font-bold underline":"underline"} onClick={()=>setPage('dashboard')}>Dashboard</button>
      <button className={page==='funds'?"font-bold underline":"underline"} onClick={()=>setPage('funds')}>Funds</button>
      <button className={page==='market'?"font-bold underline":"underline"} onClick={()=>setPage('market')}>Market Quote</button>
      <button className={page==='history'?"font-bold underline":"underline"} onClick={()=>setPage('history')}>Historical Data</button>
      <button className={page==='order'?"font-bold underline":"underline"} onClick={()=>setPage('order')}>Order</button>
      <button className={page==='portfolio'?"font-bold underline":"underline"} onClick={()=>setPage('portfolio')}>Portfolio</button>
      <button className={page==='livechart'?"font-bold underline":"underline"} onClick={()=>setPage('livechart')}>Live Chart</button>
      <button className="text-blue-600 ml-4" onClick={()=>{setUserData(null); setPage('dashboard');}}>Logout</button>
    </nav>
  );

  // Dashboard page
  const Dashboard = () => userData && (
    <div className="bg-white shadow p-6 rounded w-full max-w-md">
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

    useEffect(() => {
      setExpiryDate('');
      setRight('others');
      setStrikePrice('');
    }, [productType, exchange]);

    const isEquity = (exchange === 'NSE' || exchange === 'BSE') && productType === 'cash';
    const isFutures = productType === 'futures';
    const isOptions = productType === 'options';

    const canSubmit = stockCode.trim() && (!isFutures || expiryDate) && (!isOptions || (expiryDate && right && strikePrice)) && !loading;

    const handleQuote = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setQuote(null);
      let payload: any = {
        api_key: userData?.credentials.api_key,
        api_secret: userData?.credentials.api_secret,
        session_token: userData?.credentials.session_token,
        stock_code: stockCode.trim(),
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
        const res = await fetch('http://localhost:8000/api/market_quote', {
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
            <select className="w-full p-2 border rounded" value={exchange} onChange={e => setExchange(e.target.value)}>
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
              <option value="NFO">NFO</option>
              <option value="BFO">BFO</option>
            </select>
          </label>
          <label>
            Stock Code
            <input className="w-full p-2 border rounded" type="text" value={stockCode} onChange={e => setStockCode(e.target.value)} required />
          </label>
          <label>
            Product Type
            <select className="w-full p-2 border rounded" value={productType} onChange={e => setProductType(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="futures">Futures</option>
              <option value="options">Options</option>
            </select>
          </label>
          {isFutures && (
            <label>
              Expiry Date
              <input className="w-full p-2 border rounded" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
            </label>
          )}
          {isOptions && (
            <>
              <label>
                Expiry Date
                <input className="w-full p-2 border rounded" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
              </label>
              <label>
                Right
                <select className="w-full p-2 border rounded" value={right} onChange={e => setRight(e.target.value)}>
                  <option value="call">Call</option>
                  <option value="put">Put</option>
                </select>
              </label>
              <label>
                Strike Price
                <input className="w-full p-2 border rounded" type="number" value={strikePrice} onChange={e => setStrikePrice(e.target.value)} required />
              </label>
            </>
          )}
          <button type="submit" disabled={!canSubmit}>{loading ? 'Loading...' : 'Get Quote'}</button>
        </form>
        {error && <div className="text-red-600 mt-2">{error}</div>}
        {quote && <pre className="bg-gray-100 p-2 mt-4 rounded text-xs overflow-x-auto">{JSON.stringify(quote, null, 2)}</pre>}
      </div>
    );
  };

  // Historical Data page
  const HistoricalData = () => (
    <div className="bg-white shadow p-6 rounded w-full max-w-md flex flex-col gap-4">
      <h2 className="text-lg font-semibold mb-2">Historical Data</h2>
      <div className="text-gray-500 text-sm mb-2">Fetch historical OHLCV data.</div>
      {/* TODO: Add form for historical data */}
      <div className="text-gray-400">(Form coming soon)</div>
    </div>
  );

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

  // LiveChart page (refactored for exchange, stock code, product type)
  const LiveChart = () => {
    const [exchange, setExchange] = useState('NSE');
    const [stockCode, setStockCode] = useState('');
    const [productType, setProductType] = useState('cash');
    const [expiryDate, setExpiryDate] = useState('');
    const [right, setRight] = useState('others');
    const [strikePrice, setStrikePrice] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [chartError, setChartError] = useState<string | null>(null);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const seriesRef = useRef<any>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const [ticks, setTicks] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [started, setStarted] = useState(false);

    useEffect(() => {
      try {
        if (!chartContainerRef.current) return;
        if (chartRef.current) return; // Only create once
        console.log('Initializing chart...');
        const chart = createChart(chartContainerRef.current, { height: 300 });
        console.log('Chart object:', chart, 'Methods:', Object.keys(chart));
        chartRef.current = chart;
        const series = (chart as any).addLineSeries();
        series.setData([
          { time: 1640995200, value: 100 },
          { time: 1641081600, value: 110 },
        ]);
        seriesRef.current = series;
        return () => {
          chart.remove();
          chartRef.current = null;
          seriesRef.current = null;
        };
      } catch (err) {
        console.error('Chart initialization error:', err);
        setChartError(String(err));
      }
    }, []);

    // Update chart with new ticks
    useEffect(() => {
      if (seriesRef.current && ticks.length > 0) {
        console.log('Updating chart with ticks:', ticks);
        seriesRef.current.setData(ticks);
      }
    }, [ticks]);

    // Connect to WebSocket when started and params change
    useEffect(() => {
      if (!started) return;
      if (!userData || !userData.credentials) return;
      setError(null);
      setTicks([]);
      wsRef.current?.close();
      console.log('Opening WebSocket for live chart...');
      const ws = new WebSocket('ws://localhost:8000/ws/marketdata');
      wsRef.current = ws;
      ws.onopen = () => {
        console.log('WebSocket opened, sending params...');
        ws.send(JSON.stringify({
          api_key: userData.credentials.api_key,
          api_secret: userData.credentials.api_secret,
          session_token: userData.credentials.session_token,
          scrip_code: stockCode.trim(),
          exchange_code: exchange,
          product_type: productType,
          expiry_date: isFutures || isOptions ? expiryDate : '',
          right: isOptions ? right : '',
          strike_price: isOptions ? strikePrice : (isFutures ? '0' : ''),
        }));
      };
      ws.onmessage = (event) => {
        console.log('WebSocket message:', event.data);
        try {
          const tick = JSON.parse(event.data);
          if (tick.error) {
            setError(tick.error);
            ws.close();
          } else if (tick.last_traded_price && tick.exchange_time) {
            setTicks(prev => ([
              ...prev.slice(-99),
              {
                time: Math.floor(new Date(tick.exchange_time).getTime() / 1000),
                value: Number(tick.last_traded_price)
              }
            ]));
          }
        } catch (e) {
          // ignore
        }
      };
      ws.onerror = () => { console.log('WebSocket error'); setError('WebSocket error'); };
      ws.onclose = () => { console.log('WebSocket closed'); };
      return () => { ws.close(); };
    }, [started, exchange, stockCode, productType, expiryDate, right, strikePrice, userData]);

    const handleStart = (e: React.FormEvent) => {
      e.preventDefault();
      console.log('Start Chart clicked', { exchange, stockCode, productType, expiryDate, right, strikePrice });
      setSubmitting(true);
      setStarted(false);
      setTimeout(() => {
        setStarted(true);
        setSubmitting(false);
      }, 100); // allow state to reset
    };

    const isFutures = productType === 'futures';
    const isOptions = productType === 'options';
    const canSubmit = stockCode.trim() && (!isFutures || expiryDate) && (!isOptions || (expiryDate && right && strikePrice)) && !submitting;

    if (chartError) return <div className="text-red-600">Chart Error: {chartError}</div>;

    return (
      <div className="max-w-md mx-auto p-4 bg-white rounded shadow">
        <form onSubmit={handleStart} className="flex flex-col gap-4" autoComplete="off">
          <label>
            Exchange Code
            <select className="w-full p-2 border rounded" value={exchange} onChange={e => setExchange(e.target.value)}>
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
              <option value="NFO">NFO</option>
              <option value="BFO">BFO</option>
            </select>
          </label>
          <label>
            Stock Code or Short Name
            <input className="w-full p-2 border rounded" type="text" value={stockCode} onChange={e => setStockCode(e.target.value)} required />
          </label>
          <label>
            Product Type
            <select className="w-full p-2 border rounded" value={productType} onChange={e => setProductType(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="futures">Futures</option>
              <option value="options">Options</option>
            </select>
          </label>
          {isFutures && (
            <label>
              Expiry Date
              <input className="w-full p-2 border rounded" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
            </label>
          )}
          {isOptions && (
            <>
              <label>
                Expiry Date
                <input className="w-full p-2 border rounded" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
              </label>
              <label>
                Right
                <select className="w-full p-2 border rounded" value={right} onChange={e => setRight(e.target.value)}>
                  <option value="call">Call</option>
                  <option value="put">Put</option>
                </select>
              </label>
              <label>
                Strike Price
                <input className="w-full p-2 border rounded" type="number" value={strikePrice} onChange={e => setStrikePrice(e.target.value)} required />
              </label>
            </>
          )}
          <button type="submit" disabled={!canSubmit}>{submitting ? 'Starting...' : 'Start Chart'}</button>
        </form>
        <div ref={chartContainerRef} className="w-full h-80 bg-gray-50 rounded mt-4" />
        {error && <div className="text-red-600 mt-2">{error}</div>}
      </div>
    );
  };

  // Remove all page === 'login' and page !== 'login' checks
  // Instead, render login form if !userData, else render NavBar and main app
  if (!userData) {
    return (
      <form onSubmit={handleLogin} className="bg-white shadow p-6 rounded flex flex-col gap-4 w-full max-w-xs mx-auto mt-16">
        <h2 className="text-xl font-semibold mb-4">Login</h2>
        <input className="p-2 border rounded" type="text" placeholder="API Key" value={credentials.api_key} onChange={e=>setCredentials(c=>({...c, api_key: e.target.value}))} required />
        <input className="p-2 border rounded" type="text" placeholder="API Secret" value={credentials.api_secret} onChange={e=>setCredentials(c=>({...c, api_secret: e.target.value}))} required />
        <input className="p-2 border rounded" type="text" placeholder="Session Token" value={credentials.session_token} onChange={e=>setCredentials(c=>({...c, session_token: e.target.value}))} required />
        <button className="bg-blue-600 text-white py-2 rounded mt-2" type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
        {error && <div className="text-red-600 mt-2">{error}</div>}
      </form>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <NavBar />
      <div className="max-w-2xl mx-auto mt-8">
        {page === 'dashboard' && <Dashboard />}
        {page === 'funds' && <Funds />}
        {page === 'market' && <MarketQuote />}
        {page === 'history' && <HistoricalData />}
        {page === 'order' && <Order />}
        {page === 'portfolio' && <Portfolio />}
        {page === 'livechart' && <LiveChart />}
        <TestChart />
      </div>
    </div>
  );
}

export default App;
