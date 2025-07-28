import React, { useState, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import Funds from './components/Funds';
import MarketQuote from './components/MarketQuote';
import HistoricalData from './components/HistoricalData';
import Order from './components/Order';
import Portfolio from './components/Portfolio';
import LiveChart from './components/LiveChart';

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

  // Navigation component
  const NavBar = React.memo(() => (
    <nav className="w-full bg-white shadow-sm border-b border-gray-200 p-4 flex flex-wrap items-center justify-center gap-2">
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
  ));

  // Login screen
  if (!userData) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-100">
        <form onSubmit={handleLogin} className="bg-white shadow p-8 rounded-lg flex flex-col gap-4 w-full max-w-xs">
          <h2 className="text-xl font-semibold mb-4">Login</h2>
          <input 
            className="p-2 border border-gray-700 rounded bg-[#181818] text-white placeholder-gray-500 focus:outline-none focus:border-blue-600 transition" 
            type="text" 
            placeholder="API Key" 
            value={credentials.api_key} 
            onChange={e => setCredentials(c => ({...c, api_key: e.target.value}))} 
            required 
          />
          <input 
            className="p-2 border border-gray-700 rounded bg-[#181818] text-white placeholder-gray-500 focus:outline-none focus:border-blue-600 transition" 
            type="text" 
            placeholder="API Secret" 
            value={credentials.api_secret} 
            onChange={e => setCredentials(c => ({...c, api_secret: e.target.value}))} 
            required 
          />
          <input 
            className="p-2 border border-gray-700 rounded bg-[#181818] text-white placeholder-gray-500 focus:outline-none focus:border-blue-600 transition" 
            type="text" 
            placeholder="Session Token" 
            value={credentials.session_token} 
            onChange={e => setCredentials(c => ({...c, session_token: e.target.value}))} 
            required 
          />
          <button 
            className="bg-blue-600 text-white py-2 rounded mt-2 font-semibold hover:bg-blue-700 transition" 
            type="submit" 
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
          {error && <div className="text-red-600 mt-2">{error}</div>}
        </form>
      </div>
    );
  }

  // Main app
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center">
      <NavBar />
      <div className="flex flex-col md:flex-row gap-8 justify-center items-start w-full max-w-5xl mt-8 px-4">
        <div className="flex-1 flex justify-center">
          {page === 'dashboard' && userData && <Dashboard userData={userData} />}
          {page === 'funds' && userData && <Funds userData={userData} setUserData={setUserData} />}
          {page === 'market' && userData && <MarketQuote userData={userData} />}
          {page === 'history' && userData && <HistoricalData userData={userData} />}
          {page === 'order' && userData && <Order userData={userData} />}
          {page === 'portfolio' && userData && <Portfolio userData={userData} />}
          {page === 'livechart' && userData && <LiveChart userData={userData} />}
        </div>
      </div>
    </div>
  );
}

export default App;
