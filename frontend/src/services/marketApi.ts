import axios from 'axios';
import { MarketIndices, MarketIndex } from '../types/market';
import { API_URL } from './api';
import type { ScreenerItem } from '../types/market';


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
export async function fetchMarketIndices(sessionToken?: string): Promise<MarketIndices> {
  // Allow empty API_URL on the client so Next.js rewrite can proxy to the backend
  if (!API_URL && typeof window === 'undefined') throw new Error('API URL is not set');
  
  try {
    // Try new router path first, fall back to legacy
    // Prefer the original main.py endpoint first
    const base = API_URL || '';
    const urlCandidates = [
      `${base}/api/market/indices`,
      `${base}/api/indices`,
      `${base}/market/indices`,
    ];

    let data: unknown | null = null;
    let lastErr: unknown = null;
    for (const url of urlCandidates) {
      try {
        const params: Record<string, string> = {};
        if (sessionToken) params.api_session = sessionToken;
        const resp = await axios.get(url, {
          // Pass session if available; backend supports optional
          params,
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
        nifty: indicesMap['nifty'] || null,
        sensex: indicesMap['sensex'] || null,
        bankNifty: indicesMap['banknifty'] || null,
        finNifty: indicesMap['finnifty'] || null
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
        nifty: indicesMap['nifty'] || null,
        sensex: indicesMap['sensex'] || null,
        bankNifty: indicesMap['banknifty'] || null,
        finNifty: indicesMap['finnifty'] || null
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
        nifty: indicesMap['nifty'] || null,
        sensex: indicesMap['sensex'] || null,
        bankNifty: indicesMap['banknifty'] || null,
        finNifty: indicesMap['finnifty'] || null
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


export interface ScreenerResponse {
  total: number;
  items: ScreenerItem[];
  limit: number;
  offset: number;
}

export interface ScreenerQuery {
  limit?: number;
  offset?: number;
  min_price?: number;
  max_price?: number;
  min_change_pct?: number;
  max_change_pct?: number;
  min_volume?: number;
  min_1w_vol_diff_pct?: number;
  exchange?: string;
  is_active?: boolean;
  min_rsi_14?: number;
  max_rsi_14?: number;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
  symbols?: string; // comma-separated short_names
}

export async function fetchEodScreener(sessionToken: string, query: ScreenerQuery = {}): Promise<ScreenerResponse> {
  if (!API_URL && typeof window === 'undefined') throw new Error('API URL is not set');
  const params = new URLSearchParams();
  params.set('api_session', sessionToken);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) params.set(k, String(v));
  });
  const base = API_URL || '';
  const url = `${base}/api/stocks/eod-screener?${params.toString()}`;
  try {
    const resp = await axios.get(url, { headers: { 'Content-Type': 'application/json' } });
    return resp.data as ScreenerResponse;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response && err.response.status === 404) {
      // Gracefully degrade: return empty so caller can fall back to intraday
      return {
        total: 0,
        items: [],
        limit: Number(params.get('limit') || 50),
        offset: Number(params.get('offset') || 0),
      } as ScreenerResponse;
    }
    throw err;
  }
}

export interface IntradayQuery {
  page?: number;
  page_size?: number;
  exchange?: 'NSE' | 'BSE';
}

export async function fetchIntradayScreener(sessionToken: string, query: IntradayQuery = {}): Promise<ScreenerResponse> {
  if (!API_URL && typeof window === 'undefined') throw new Error('API URL is not set');
  const params = new URLSearchParams();
  params.set('api_session', sessionToken);
  if (query.page) params.set('page', String(query.page));
  if (query.page_size) params.set('page_size', String(query.page_size));
  if (query.exchange) params.set('exchange', query.exchange);
  const url = `${API_URL}/api/stocks/intraday-screener?${params.toString()}`;
  const resp = await axios.get(url, {
    headers: { 'Content-Type': 'application/json' },
    withCredentials: false,
  });
  return resp.data as ScreenerResponse;
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




