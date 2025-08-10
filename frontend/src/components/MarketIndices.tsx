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
  const [flashMap, setFlashMap] = useState<Record<string, 'up' | 'down' | null>>({});
  const lastPricesRef = React.useRef<Record<string, number | null>>({});
  const { credentials } = useCredentialManager();

  const fetchMarketData = useCallback(async () => {
    try {
      setError(null);
      
      // Fetch canonical market status from backend
      try {
        const base = process.env.NEXT_PUBLIC_API_URL || '';
        const resp = await fetch(`${base || ''}/api/market/status`, { cache: 'no-store' });
        if (resp.ok) {
          const status = await resp.json();
          setIsMarketOpen(Boolean(status?.is_market_open));
        }
      } catch {}
      
      if (!credentials?.sessionToken) {
        throw new Error('No session token available');
      }
      
      // Fetch real market data
      const data = await fetchMarketIndices(credentials.sessionToken);

      // Micro-interaction: detect price changes to flash
      const next: Record<string, number | null> = {
        NIFTY: data.nifty?.currentClose ?? null,
        SENSEX: data.sensex?.currentClose ?? null,
        BANKNIFTY: data.bankNifty?.currentClose ?? null,
        FINNIFTY: data.finNifty?.currentClose ?? null,
      };
      const prev = lastPricesRef.current;
      const updates: Record<string, 'up' | 'down' | null> = {};
      Object.entries(next).forEach(([symbol, curr]) => {
        const previous = prev[symbol];
        if (curr !== null && previous !== undefined && previous !== null && curr !== previous) {
          updates[symbol] = curr > previous ? 'up' : 'down';
        }
      });
      if (Object.keys(updates).length > 0) {
        setFlashMap((m) => ({ ...m, ...updates }));
        // clear flashes after 400ms
        window.setTimeout(() => {
          setFlashMap((m) => {
            const cleared = { ...m };
            Object.keys(updates).forEach((k) => (cleared[k] = null));
            return cleared;
          });
        }, 400);
      }
      lastPricesRef.current = next;

      setMarketData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch market data';
      setError(errorMessage);
      console.error('Market data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [credentials?.sessionToken]);

  useEffect(() => {
    if (!credentials?.sessionToken) return;

    // Initial fetch
    fetchMarketData();

    // Poll periodically when market is open
    let intervalId: number | null = null;
    if (isMarketOpen) {
      intervalId = window.setInterval(() => {
        fetchMarketData();
      }, 60_000);
    }

    return () => {
      if (intervalId) window.clearInterval(intervalId);
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
    <div className={`bg-[#111] dark:bg-[#111] border-b border-neutral-800 py-2 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 overflow-x-auto">
        <div className="flex items-center gap-8 whitespace-nowrap">
          {indices.map((index: MarketIndex) => {
            const isUp = index.isPositive === true;
            const isDown = index.isPositive === false;
            const flash = flashMap[index.symbol];
            return (
              <div
                key={index.symbol}
                className={`inline-flex items-baseline gap-2 px-1 rounded transition-colors duration-300 ${
                  flash === 'up' ? 'bg-green-900/20' : flash === 'down' ? 'bg-red-900/20' : ''
                }`}
              >
                <span className="text-white font-extrabold tracking-wide">
                  {index.symbol}
                </span>
                <span className="text-gray-300 font-semibold tabular-nums">
                  {index.currentClose !== null && index.currentClose !== undefined ? formatNumber(index.currentClose) : 'N/A'}
                </span>
                {index.change !== null && index.percentChange !== null && index.isPositive !== null ? (
                  <>
                    <span className={`text-sm tabular-nums ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                      {formatChange(index.change)}
                    </span>
                    <span className={`text-sm tabular-nums ${isUp ? 'text-green-500' : 'text-red-500'}`}>
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
