"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { MarketIndices as MarketIndicesType, MarketIndex } from '../types/market';
import { LoadingSpinner } from './LoadingSpinner';
import { fetchMarketIndices } from '../services/marketApi';
import { useCredentialManager } from '../context/CredentialManager';

interface MarketIndicesProps {
  className?: string;
}

export const MarketIndices: React.FC<MarketIndicesProps> = ({
  className = ''
}) => {
  const [marketData, setMarketData] = useState<MarketIndicesType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMarketOpen, setIsMarketOpen] = useState<boolean>(false);
  // Remove flashing animation
  const lastPricesRef = React.useRef<Record<string, number | null>>({});
  const { credentials } = useCredentialManager();
  const isMountedRef = React.useRef(true);
  const sseRef = React.useRef<EventSource | null>(null);

  const fetchMarketData = useCallback(async () => {
    try {
      setError(null);
      
      // Fetch canonical market status from backend
      try {
        const base = process.env.NEXT_PUBLIC_API_URL || '';
        const resp = await fetch(`${base || ''}/api/market/status`, { cache: 'no-store' });
        if (resp.ok) {
          const status = await resp.json();
          if (!isMountedRef.current) return;
          setIsMarketOpen(Boolean(status?.is_market_open));
        }
      } catch {}
      
      // Fetch real market data
      const data = await fetchMarketIndices(credentials?.sessionToken);

      // Track last prices for future diff logic; no flashing
      const next: Record<string, number | null> = {
        NIFTY: data.nifty?.currentClose ?? null,
        SENSEX: data.sensex?.currentClose ?? null,
        BANKNIFTY: data.bankNifty?.currentClose ?? null,
        FINNIFTY: data.finNifty?.currentClose ?? null,
      };
      lastPricesRef.current = next;

      if (!isMountedRef.current) return;
      setMarketData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch market data';
      // Keep previous values visible; surface error unobtrusively
      if (isMountedRef.current) setError(errorMessage);
      console.error('Market data fetch error:', err);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [credentials?.sessionToken]);

  useEffect(() => {
    isMountedRef.current = true;

    // Initial fetch
    fetchMarketData();

    // If market is open, prefer SSE stream over polling
    let intervalId: number | null = null;
    if (isMarketOpen) {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL || '';
        const url = new URL(`${base || ''}/api/stream/indices`, window.location.href);
        if (credentials?.sessionToken) url.searchParams.set('api_session', credentials.sessionToken);
        const es = new EventSource(url.toString(), { withCredentials: false } as any);
        sseRef.current = es;
        es.onmessage = (ev: MessageEvent) => {
          if (!isMountedRef.current) return;
          try {
            const payload = JSON.parse(ev.data);
            const arr = Array.isArray(payload) ? payload : (payload?.data || []);
            const bySymbol: Record<string, MarketIndex> = {} as any;
            arr.forEach((idx: any) => {
              const symbol = String(idx.symbol || '').toUpperCase();
              if (!symbol) return;
              bySymbol[symbol] = {
                symbol,
                name: idx.displayName || symbol,
                previousClose: idx.previousClose ?? null,
                currentClose: idx.currentClose ?? null,
                change: idx.change ?? null,
                percentChange: idx.percentChange ?? null,
                isPositive: typeof idx.isPositive === 'boolean' ? idx.isPositive : (idx.change ?? 0) >= 0,
                lastPrice: idx.currentClose ?? null,
                changePercent: idx.percentChange ?? null,
                marketClosed: false,
                lastTradingDay: null,
              } as any;
            });
            const nextData: MarketIndicesType = {
              nifty: bySymbol['NIFTY'] || null,
              sensex: bySymbol['SENSEX'] || null,
              bankNifty: bySymbol['BANKNIFTY'] || null,
              finNifty: bySymbol['FINNIFTY'] || null,
            };
            // Track last prices for future diff logic; no flashing
            const next: Record<string, number | null> = {
              NIFTY: nextData.nifty?.currentClose ?? null,
              SENSEX: nextData.sensex?.currentClose ?? null,
              BANKNIFTY: nextData.bankNifty?.currentClose ?? null,
              FINNIFTY: nextData.finNifty?.currentClose ?? null,
            };
            lastPricesRef.current = next;
            setMarketData(nextData);
          } catch {}
        };
        es.onerror = () => {
          // Fallback to polling if SSE fails
          if (intervalId == null) {
            intervalId = window.setInterval(() => {
              fetchMarketData();
            }, 1_000);
          }
        };
      } catch {
        // Fallback to polling if EventSource not available
        intervalId = window.setInterval(() => {
          fetchMarketData();
        }, 1_000);
      }
    }

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      isMountedRef.current = false;
      if (sseRef.current) {
        try { sseRef.current.close(); } catch {}
        sseRef.current = null;
      }
    };
  }, [credentials?.sessionToken, fetchMarketData, isMarketOpen]);

  const formatNumber = (num: number): string => {
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatChange = (change: number): string => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${formatNumber(change)}`;
  };

  const formatChangePercent = (percent: number): string => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-2 ${className}`}>
        <div className="max-w-7xl mx-auto px-4">
          <LoadingSpinner size="sm" text="Loading market data..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-2 ${className}`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-red-600 dark:text-red-400 text-sm text-center">
            Failed to load market data. Please try again.
          </div>
        </div>
      </div>
    );
  }

  if (!marketData) {
    return null;
  }

  const indices = [marketData.nifty, marketData.sensex, marketData.bankNifty, marketData.finNifty].filter(i => i !== null) as MarketIndex[];
  const anyClosed = indices.find(i => i.marketClosed);
  const lastTradingDay = indices.find(i => i.lastTradingDay)?.lastTradingDay || null;

  return (
    <div className={`sticky top-0 z-20 bg-black dark:bg-black border-y border-neutral-800 py-2 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 overflow-x-auto">
        <div className="inline-flex items-center gap-10 whitespace-nowrap min-w-max py-0.5">
          {indices.map((index: MarketIndex) => {
            const isUp = index.isPositive === true;
            const isDown = index.isPositive === false;
            return (
              <div
                key={index.symbol}
                className="inline-flex items-baseline gap-3 pr-8"
              >
                <span className="text-white font-semibold tracking-wide text-sm uppercase">
                  {index.symbol}
                </span>
                <span className="text-gray-300 font-medium tabular-nums text-sm">
                  {index.currentClose !== null && index.currentClose !== undefined ? formatNumber(index.currentClose) : 'N/A'}
                </span>
                {index.change !== null && index.percentChange !== null && index.isPositive !== null ? (
                  <>
                    <span className={`text-xs tabular-nums ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                      {formatChange(index.change)}
                    </span>
                    <span className={`text-xs tabular-nums ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                      ({formatChangePercent(index.percentChange)})
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-gray-500">N/A</span>
                )}
                {/* Metadata removed per request: Prev and As of */}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
