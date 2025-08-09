"use client";
import React, { useState } from 'react';
import { MarketIndices } from './MarketIndices';

interface MarketDashboardProps {
  className?: string;
}

export const MarketDashboard: React.FC<MarketDashboardProps> = ({ className = '' }) => {
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const [showDetailedView, setShowDetailedView] = useState(false);

  const handleCloseDetailedView = () => {
    setShowDetailedView(false);
    setSelectedIndex(null);
  };

  return (
    <div className={className}>
      {/* Market Indices Strip */}
      <MarketIndices 
        className="sticky top-0 z-10"
      />

      {/* Main Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Market Overview
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time market data for major Indian indices
          </p>
        </div>

        {/* Market Indices Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* This will be populated with real data from the MarketIndices component */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="text-center">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Loading market data...
              </div>
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Market Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Market Status
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">NSE Status:</span>
                <span className="text-green-600 dark:text-green-400 font-medium">Open</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">BSE Status:</span>
                <span className="text-green-600 dark:text-green-400 font-medium">Open</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Last Updated:</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                View Detailed Charts
              </button>
              <button className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium py-2 px-4 rounded-lg transition-colors">
                Market News
              </button>
              <button className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium py-2 px-4 rounded-lg transition-colors">
                Trading Calendar
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Market Summary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Advance/Decline:</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">Loading...</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Market Breadth:</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">Loading...</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Volatility Index:</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">Loading...</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed View Modal */}
      {showDetailedView && selectedIndex && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {selectedIndex} Detailed View
              </h2>
              <button
                onClick={handleCloseDetailedView}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-center text-gray-600 dark:text-gray-400">
              Detailed view for {selectedIndex} will be implemented with real data integration.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
