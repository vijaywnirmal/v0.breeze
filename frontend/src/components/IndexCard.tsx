"use client";
import React from 'react';
import { MarketIndex } from '../types/market';

interface IndexCardProps {
  index: MarketIndex;
  className?: string;
  showDetails?: boolean;
  onClick?: () => void;
}

export const IndexCard: React.FC<IndexCardProps> = ({
  index,
  className = '',
  showDetails = false,
  onClick
}) => {
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

  const formatVolume = (volume: number): string => {
    if (volume >= 1000000000) {
      return `${(volume / 1000000000).toFixed(2)}B`;
    } else if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(2)}K`;
    }
    return volume.toString();
  };

  return (
    <div 
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {index.symbol}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {index.name}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {index.currentClose !== null && index.currentClose !== undefined ? formatNumber(index.currentClose) : 'N/A'}
          </div>
          <div className="flex items-center space-x-1">
            {index.change !== null && index.percentChange !== null && index.isPositive !== null ? (
              <>
                <span 
                  className={`text-sm font-medium ${
                    index.isPositive 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatChange(index.change)}
                </span>
                <span 
                  className={`text-sm font-medium ${
                    index.isPositive 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  ({formatChangePercent(index.percentChange)})
                </span>
              </>
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Data unavailable
              </span>
            )}
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Open:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {index.open ? formatNumber(index.open) : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">High:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {index.high ? formatNumber(index.high) : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Low:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {index.low ? formatNumber(index.low) : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Volume:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {index.volume ? formatVolume(index.volume) : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
