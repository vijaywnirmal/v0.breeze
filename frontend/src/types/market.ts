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
  nifty: MarketIndex;
  sensex: MarketIndex;
  bankNifty: MarketIndex;
  finNifty: MarketIndex;
}

export interface MarketDataResponse {
  success: boolean;
  data: MarketIndices;
  timestamp: string;
  error?: string;
}
