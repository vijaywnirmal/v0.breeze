"use client";
import React, { useEffect, useState } from 'react';

type MarketStatusResponse = {
  is_market_open: boolean;
  status: 'open' | 'closed' | 'pre-open';
  current_time: string;
  market_open_time: string;
  market_close_cutoff: string;
  current_day: string;
  is_weekend: boolean;
  is_holiday: boolean;
  last_trading_day: string;
  next_market_open?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export const MarketStatus: React.FC = () => {
  const [marketState, setMarketState] = useState<MarketStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const url = (API_BASE ? `${API_BASE}/market/status` : `/api/market/status`);
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load market status');
        const data = await res.json();
        if (!cancelled) setMarketState(data);
      } catch {
        if (!cancelled) setError('Unable to load market status');
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'text-green-600 dark:text-green-400';
      case 'closed':
        return 'text-red-600 dark:text-red-400';
      case 'pre-open':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'closed':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'pre-open':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Market Status
      </h3>
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</div>
      )}
      {!marketState && !error && (
        <div className="text-sm text-gray-500">Loading...</div>
      )}

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">NSE Status:</span>
          <div className="flex items-center space-x-2">
            {getStatusIcon(marketState?.status || 'closed')}
            <span className={`font-medium ${getStatusColor(marketState?.status || 'closed')}`}>
              {marketState?.status === 'open' ? 'Open' : 
               marketState?.status === 'closed' ? 'Closed' : 'Pre-Open'}
            </span>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">BSE Status:</span>
          <div className="flex items-center space-x-2">
            {getStatusIcon(marketState?.status || 'closed')}
            <span className={`font-medium ${getStatusColor(marketState?.status || 'closed')}`}>
              {marketState?.status === 'open' ? 'Open' : 
               marketState?.status === 'closed' ? 'Closed' : 'Pre-Open'}
            </span>
          </div>
        </div>
        
        {/* Data source row removed per request */}
      </div>
      
      {/* Footer description removed per request */}
    </div>
  );
};
