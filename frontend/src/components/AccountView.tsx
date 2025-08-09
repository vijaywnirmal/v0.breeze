"use client";
import React, { useState } from 'react';
import { fetchAccountDetails, AccountDetails } from '../services/api';
import { useCredentialManager } from '../context/CredentialManager';

export const AccountView: React.FC = () => {
  const [account, setAccount] = useState<AccountDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { credentials } = useCredentialManager();

  const handleFetch = async () => {
    if (!credentials?.sessionToken) {
      setError('Session token not found. Please log in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAccountDetails(credentials.sessionToken);
      setAccount(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch account details.';
      setError(errorMessage);
      setAccount(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <span className="inline-block text-green-600 dark:text-green-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </span>
        Account Details
      </h2>
      <button
        onClick={handleFetch}
        className="mb-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
        disabled={loading}
      >
        {loading ? 'Loading...' : 'Fetch Account Details'}
      </button>
      {error && <div className="mb-4 text-red-600 dark:text-red-400 text-sm">{error}</div>}
      {account && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
            <div className="font-semibold">Name:</div>
            <div>{account.name ?? 'N/A'}</div>
            <div className="font-semibold mt-2">Account ID:</div>
            <div>{account.accountId ?? 'N/A'}</div>
            <div className="font-semibold mt-2">Balance:</div>
            <div>
              ₹ {typeof account.balance === 'number' && !isNaN(account.balance) ? account.balance.toLocaleString() : 'N/A'}
            </div>
          </div>
          <div>
            <div className="font-semibold mb-2">Holdings:</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border border-gray-200 dark:border-gray-700 rounded">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Symbol</th>
                    <th className="px-3 py-2 text-right">Quantity</th>
                    <th className="px-3 py-2 text-right">Avg Price</th>
                    <th className="px-3 py-2 text-right">Current Price</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(account.holdings) && account.holdings.length > 0 ? (
                    account.holdings.map((h, i) => (
                      <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                        <td className="px-3 py-2">{h.symbol ?? 'N/A'}</td>
                        <td className="px-3 py-2 text-right">{typeof h.quantity === 'number' && !isNaN(h.quantity) ? h.quantity.toLocaleString() : 'N/A'}</td>
                        <td className="px-3 py-2 text-right">₹ {typeof h.avgPrice === 'number' && !isNaN(h.avgPrice) ? h.avgPrice.toLocaleString() : 'N/A'}</td>
                        <td className="px-3 py-2 text-right">₹ {typeof h.currentPrice === 'number' && !isNaN(h.currentPrice) ? h.currentPrice.toLocaleString() : 'N/A'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-center text-gray-500">No holdings found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
