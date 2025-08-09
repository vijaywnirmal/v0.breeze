"use client";
import React from 'react';
import { getMarketState } from '../utils/marketState';

export const MarketStatus: React.FC = () => {
  const marketState = getMarketState();
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'text-green-600 dark:text-green-400';
      case 'closed':
        return 'text-red-600 dark:text-red-400';
      case 'pre-open':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'weekend':
        return 'text-gray-600 dark:text-gray-400';
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
      case 'weekend':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">NSE Status:</span>
          <div className="flex items-center space-x-2">
            {getStatusIcon(marketState.marketStatus)}
            <span className={`font-medium ${getStatusColor(marketState.marketStatus)}`}>
              {marketState.marketStatus === 'open' ? 'Open' : 
               marketState.marketStatus === 'closed' ? 'Closed' :
               marketState.marketStatus === 'pre-open' ? 'Pre-Open' : 'Weekend'}
            </span>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">BSE Status:</span>
          <div className="flex items-center space-x-2">
            {getStatusIcon(marketState.marketStatus)}
            <span className={`font-medium ${getStatusColor(marketState.marketStatus)}`}>
              {marketState.marketStatus === 'open' ? 'Open' : 
               marketState.marketStatus === 'closed' ? 'Closed' :
               marketState.marketStatus === 'pre-open' ? 'Pre-Open' : 'Weekend'}
            </span>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Data Source:</span>
          <span className="text-gray-900 dark:text-gray-100 font-medium">
            3:30 PM IST
          </span>
        </div>
      </div>
      
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {marketState.description}
        </p>
      </div>
    </div>
  );
};
