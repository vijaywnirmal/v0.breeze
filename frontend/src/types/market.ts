export interface MarketIndex {
  symbol: string;
  name: string;
  previousClose: number | null;
  currentClose: number | null;
  change: number | null;
  percentChange: number | null;
  isPositive: boolean | null;
  marketClosed?: boolean | null;
  lastTradingDay?: string | null;
  // Legacy fields for backward compatibility
  lastPrice?: number | null;
  changePercent?: number | null;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
}

export interface MarketIndices {
  nifty: MarketIndex | null;
  sensex: MarketIndex | null;
  bankNifty: MarketIndex | null;
  finNifty: MarketIndex | null;
}

export interface MarketDataResponse {
  success: boolean;
  data: MarketIndices;
  timestamp: string;
  error?: string;
}

export interface ScreenerItem {
  snapshot_id: number;
  snapshot_date: string | null;
  close_price: number | null;
  prev_close_price: number | null;
  change_abs: number | null;
  change_pct: number | null;
  volume: number | null;
  week_avg_volume: number | null;
  week_volume_diff_pct: number | null;
  rsi_14: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  sparkline_data: { t?: string[]; p?: number[] } | null;
  instrument: {
    id: number;
    short_name: string;
    company_name: string;
    isin_code: string;
    exchange_code: string;
    is_active: boolean;
  };
}