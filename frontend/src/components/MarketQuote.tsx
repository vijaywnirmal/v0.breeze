import React, { useState, useEffect, useCallback } from 'react';

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

interface MarketQuoteProps {
  userData: UserData;
}

const MarketQuote: React.FC<MarketQuoteProps> = ({ userData }) => {
  const [exchange, setExchange] = useState('NSE');
  const [stockCode, setStockCode] = useState('');
  const [productType, setProductType] = useState('cash');
  const [expiryDate, setExpiryDate] = useState('');
  const [right, setRight] = useState('others');
  const [strikePrice, setStrikePrice] = useState('');
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    setExpiryDate('');
    setRight('others');
    setStrikePrice('');
  }, [productType, exchange]);

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
      const res = await fetch(`/scrips/search?q=${encodeURIComponent(search)}&limit=5`);
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
  }, []);

  const selectScrip = useCallback((scrip: ScripData) => {
    setStockCode(scrip.ticker);
    setSearchQuery(scrip.ticker);
    setShowResults(false);
  }, []);

  const isEquity = (exchange === 'NSE' || exchange === 'BSE') && productType === 'cash';
  const isFutures = productType === 'futures';
  const isOptions = productType === 'options';
  const isCash = productType === 'cash';

  const canSubmit = (stockCode || searchQuery).trim() && (!isFutures || expiryDate) && (!isOptions || (expiryDate && right && strikePrice)) && !loading;

  const handleQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const payload: any = {
      api_key: userData.credentials.api_key,
      api_secret: userData.credentials.api_secret,
      session_token: userData.credentials.session_token,
      stock_code: stockCode || searchQuery,
      exchange_code: exchange,
      product_type: productType,
    };

    if (isCash) {
      // For cash products, don't include expiry_date, right, or strike_price
      // These fields are not needed for equity stocks
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

export default MarketQuote; 