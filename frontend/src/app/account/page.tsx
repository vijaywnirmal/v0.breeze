"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCredentialManager } from '../../context/CredentialManager';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { MarketIndices } from '../../components/MarketIndices';
import { MarketStatus } from '../../components/MarketStatus';

interface CustomerData {
  Success?: {
    idirect_userid?: string;
    idirect_user_name?: string;
  };
}

export default function AccountDetails() {
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const router = useRouter();
  const { credentials, clearCredentials } = useCredentialManager();

  useEffect(() => {
    // Check if user is authenticated
    if (!credentials?.sessionToken) {
      router.push('/');
      return;
    }

    if (typeof window === 'undefined') return;
    const storedCustomer = localStorage.getItem('breeze_customer_data');
    if (storedCustomer) {
      try {
        setCustomer(JSON.parse(storedCustomer));
      } catch (error) {
        console.error('Failed to parse customer data:', error);
        setCustomer(null);
      }
    }
  }, [credentials, router]);

  // Helper to safely get nested fields
  const get = (obj: CustomerData | null, path: string, fallback: string = 'N/A'): string => {
    if (!obj) return fallback;
    try {
      const keys = path.split('.');
      let result: unknown = obj;
      for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
          result = (result as Record<string, unknown>)[key];
        } else {
          return fallback;
        }
      }
      return typeof result === 'string' ? result : fallback;
    } catch {
      return fallback;
    }
  };

  const handleLogout = () => {
    clearCredentials();
    localStorage.removeItem('breeze_customer_data');
    setCustomer(null);
    router.push('/');
  };

  // Show loading while checking authentication
  if (!credentials?.sessionToken) {
    return (
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-8 items-center justify-start py-8">
        <LoadingSpinner size="lg" text="Checking authentication..." />
      </div>
    );
  }

  const userId = get(customer, 'Success.idirect_userid', '');
  const userName = get(customer, 'Success.idirect_user_name', '');

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* Keep this page without indices strip; moved to Dashboard */}

      {/* Main Dashboard Content */}
      <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col gap-8 items-start justify-start py-8 px-4 relative">
        {/* Profile dropdown remains for Account Details */}
        <div className="absolute right-4 top-0 mt-4 z-10">
          <div className="relative">
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded shadow hover:bg-gray-300 dark:hover:bg-gray-700 focus:outline-none"
            >
              <span className="font-semibold">Profile</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-2">
                <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">
                  <div className="font-semibold">User ID:</div>
                  <div>{userId}</div>
                  <div className="font-semibold mt-2">Name:</div>
                  <div>{userName}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Account Details Grid (kept original Trading Dashboard content) */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* Market Status */}
          <div className="lg:col-span-1">
            <MarketStatus />
          </div>

          {/* Trading Dashboard */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Trading Dashboard
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Quick Actions
                  </h3>
                  <div className="space-y-2">
                    <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm">
                      View Holdings
                    </button>
                    <button className="w-full bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-900 dark:text-gray-100 font-medium py-2 px-4 rounded-lg transition-colors text-sm">
                      Place Order
                    </button>
                    <a
                      href="/screener"
                      className="block w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                    >
                      View Latest Screeners (RELIND + TCS)
                    </a>
                  </div>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Account Summary
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">User ID:</span>
                      <span className="font-medium">{userId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Status:</span>
                      <span className="text-green-600 dark:text-green-400 font-medium">Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
