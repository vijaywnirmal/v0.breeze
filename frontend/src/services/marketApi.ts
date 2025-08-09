import axios from 'axios';
import { MarketIndices, MarketIndex } from '../types/market';
import { API_URL } from './api';

// Types for API responses
interface IndexDataResponse {
  symbol: string;
  data: Record<string, unknown>;
}

interface MarketStatusResponse {
  nse: {
    status: string;
  };
  bse: {
    status: string;
  };
}

// Legacy combined indices response format
interface MarketIndicesResponseLegacy {
  status: string;
  data: Array<{
    symbol: string;
    displayName: string;
    previousClose: number | null;
    currentClose: number | null;
    change: number | null;
    percentChange: number | null;
    isPositive: boolean | null;
    marketClosed?: boolean;
    lastTradingDay?: string | null;
  }>;
}

// New router response: { indices: Array<{ symbol|code, last_price, change, percent_change }> }
interface MarketIndicesResponseNew {
  indices: Array<{
    symbol?: string;
    code?: string;
    last_price: number;
    change: number;
    percent_change: number;
  }>;
}

// Fetch market indices data with proper change calculations
export async function fetchMarketIndices(sessionToken: string): Promise<MarketIndices> {
  if (!API_URL) throw new Error('API URL is not set');
  
  try {
    // Try new router path first, fall back to legacy
    // Prefer the original main.py endpoint first
    const urlCandidates = [
      `${API_URL}/market/indices`,
      `${API_URL}/api/market/indices`,
      `${API_URL}/api/indices`
    ];

    let data: unknown | null = null;
    let lastErr: unknown = null;
    for (const url of urlCandidates) {
      try {
        const resp = await axios.get(url, {
          // Pass session if backend still expects it; harmless if ignored
          params: { api_session: sessionToken },
          headers: { 'Content-Type': 'application/json' },
          withCredentials: false,
        });
        data = resp.data;
        break;
      } catch (err) {
        // Only fall back to next candidate on 404 (route not found)
        if (axios.isAxiosError(err) && err.response && err.response.status === 404) {
          lastErr = err;
          continue;
        }
        // For any other error (e.g., 401 invalid session), surface it immediately
        throw err;
      }
    }
    if (!data) throw lastErr || new Error('Failed to fetch indices');

    // New shape A: plain list (from new router) -> [{ name, last_price, change, percent_change, prev_close, date }]
    if (Array.isArray(data)) {
      const indicesMap: Record<string, MarketIndex> = {};
      (data as Array<any>).forEach((idx) => {
        const symbol = String(idx.name || '').toUpperCase();
        if (!symbol) return;
        const currentClose = Number(idx.last_price);
        const change = Number(idx.change);
        const percent = Number(idx.percent_change);
        const previousClose = Number(idx.prev_close);
        indicesMap[symbol.toLowerCase()] = {
          symbol,
          name: getIndexName(symbol),
          previousClose: isFinite(previousClose) ? previousClose : null,
          currentClose: isFinite(currentClose) ? currentClose : null,
          change: isFinite(change) ? change : null,
          percentChange: isFinite(percent) ? percent : null,
          isPositive: isFinite(change) ? change >= 0 : null,
          lastPrice: isFinite(currentClose) ? currentClose : null,
          changePercent: isFinite(percent) ? percent : null,
        };
      });
      return {
        nifty: indicesMap['nifty'] || getMockIndexData('NIFTY'),
        sensex: indicesMap['sensex'] || getMockIndexData('SENSEX'),
        bankNifty: indicesMap['banknifty'] || getMockIndexData('BANKNIFTY'),
        finNifty: indicesMap['finnifty'] || getMockIndexData('FINNIFTY')
      };
    }

    // New shape B: { indices: [...] }
    if ((data as MarketIndicesResponseNew).indices) {
      const indicesArr = (data as MarketIndicesResponseNew).indices;
      const indicesMap: Record<string, MarketIndex> = {};
      indicesArr.forEach((idx) => {
        const symbol = (idx.symbol || idx.code || '').toUpperCase();
        if (!symbol) return;
        const currentClose = idx.last_price;
        const change = idx.change;
        const percent = idx.percent_change;
        const previousClose = currentClose - change;
        indicesMap[symbol.toLowerCase()] = {
          symbol,
          name: getIndexName(symbol),
          previousClose,
          currentClose,
          change,
          percentChange: percent,
          isPositive: change >= 0,
          lastPrice: currentClose,
          changePercent: percent,
        };
      });
      return {
        nifty: indicesMap['nifty'] || getMockIndexData('NIFTY'),
        sensex: indicesMap['sensex'] || getMockIndexData('SENSEX'),
        bankNifty: indicesMap['banknifty'] || getMockIndexData('BANKNIFTY'),
        finNifty: indicesMap['finnifty'] || getMockIndexData('FINNIFTY')
      };
    }

    // Legacy shape: { status, data: [...] }
    if ((data as MarketIndicesResponseLegacy).status && (data as MarketIndicesResponseLegacy).data) {
      const legacy = data as MarketIndicesResponseLegacy;
      const indicesMap: Record<string, MarketIndex> = {};
      legacy.data.forEach((indexData) => {
        const symbol = indexData.symbol.toUpperCase();
        indicesMap[symbol.toLowerCase()] = {
          symbol,
          name: indexData.displayName || getIndexName(symbol),
          previousClose: indexData.previousClose,
          currentClose: indexData.currentClose,
          change: indexData.change,
          percentChange: indexData.percentChange,
          isPositive: indexData.isPositive,
          marketClosed: indexData.marketClosed,
          lastTradingDay: indexData.lastTradingDay ?? null,
          lastPrice: indexData.currentClose,
          changePercent: indexData.percentChange,
        };
      });
      return {
        nifty: indicesMap['nifty'] || getMockIndexData('NIFTY'),
        sensex: indicesMap['sensex'] || getMockIndexData('SENSEX'),
        bankNifty: indicesMap['banknifty'] || getMockIndexData('BANKNIFTY'),
        finNifty: indicesMap['finnifty'] || getMockIndexData('FINNIFTY')
      };
    }

    throw new Error('Unrecognized indices API response');
    
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.detail || 'Failed to fetch market indices');
    }
    throw new Error('Network error or server unavailable');
  }
}



// Get index display name
function getIndexName(symbol: string): string {
  const names: Record<string, string> = {
    'NIFTY': 'NIFTY 50',
    'SENSEX': 'S&P BSE SENSEX',
    'BANKNIFTY': 'NIFTY BANK',
    'FINNIFTY': 'NIFTY FINANCIAL SERVICES'
  };
  return names[symbol] || symbol;
}

// No mock fallback per request; always require API data
function getMockIndexData(symbol: string): MarketIndex {
  return {
    symbol,
    name: getIndexName(symbol),
    previousClose: null,
    currentClose: null,
    change: null,
    percentChange: null,
    isPositive: null,
    lastPrice: null,
    changePercent: null,
  };
}

// Fetch specific index data
export async function fetchIndexData(sessionToken: string, symbol: string): Promise<IndexDataResponse> {
  if (!API_URL) throw new Error('API URL is not set');
  
  try {
    const response = await axios.get(
      `${API_URL}/market/index/${symbol}`,
      {
        params: { api_session: sessionToken },
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: false,
      }
    );
    
    return response.data as IndexDataResponse;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.detail || `Failed to fetch ${symbol} data`);
    }
    throw new Error('Network error or server unavailable');
  }
}

// Fetch market status
export async function fetchMarketStatus(sessionToken: string): Promise<MarketStatusResponse> {
  if (!API_URL) throw new Error('API URL is not set');
  
  try {
    const response = await axios.get(
      `${API_URL}/market/status`,
      {
        params: { api_session: sessionToken },
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: false,
      }
    );
    
    return response.data as MarketStatusResponse;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.detail || 'Failed to fetch market status');
    }
    throw new Error('Network error or server unavailable');
  }
}


