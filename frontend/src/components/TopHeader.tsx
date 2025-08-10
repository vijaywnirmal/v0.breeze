"use client";
import React from 'react';
import { useCredentialManager } from '../context/CredentialManager';
import { MarketIndices } from './MarketIndices';

export const TopHeader: React.FC = () => {
  const { credentials, clearCredentials } = useCredentialManager();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [userId, setUserId] = React.useState<string>('');
  const [userName, setUserName] = React.useState<string>('');
  const [mounted, setMounted] = React.useState<boolean>(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('breeze_customer_data');
      if (stored) {
        const data = JSON.parse(stored);
        const id = data?.Success?.idirect_userid || data?.idirect_userid || '';
        const name = data?.Success?.idirect_user_name || data?.idirect_user_name || '';
        setUserId(id);
        setUserName(name);
      }
    } catch {}
  }, [credentials?.sessionToken]);

  const handleLogout = () => {
    clearCredentials();
    localStorage.removeItem('breeze_customer_data');
    setProfileOpen(false);
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  // Avoid hydration mismatches by rendering header only on client after mount
  if (!mounted) {
    return <div className="w-full" />;
  }

  return (
    <div className="w-full">
      {/* Top bar: Home icon (left) + Profile (right) */}
      <div className="w-full max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <a
            href="/dashboard"
            aria-label="Go to Dashboard"
            className="inline-flex items-center justify-center w-9 h-9 rounded bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
            title="Home"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M12 3.172 2.293 12.879a1 1 0 1 0 1.414 1.414L5 13.999V20a2 2 0 0 0 2 2h3v-6h4v6h3a2 2 0 0 0 2-2v-6l1.293 1.294a1 1 0 0 0 1.414-1.414L12 3.172z" />
            </svg>
          </a>
          <a
            href="/screener"
            className="inline-flex items-center gap-2 px-3 h-9 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
            title="Screeners"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 .8 1.6l-6.2 8.267V19a1 1 0 0 1-1.447.894l-3-1.5A1 1 0 0 1 9 17.5v-3.633L3.2 5.6A1 1 0 0 1 3 5V4z"/>
            </svg>
            <span>Screeners</span>
          </a>
        </div>

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
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow-lg py-2 z-20">
              <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">
                <div className="font-semibold">User ID:</div>
                <div>{userId || '—'}</div>
                <div className="font-semibold mt-2">Name:</div>
                <div>{userName || '—'}</div>
              </div>
              <a href="/account" className="block w-full text-left px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm">Account Details</a>
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
      {/* Market Indices strip shown on all pages */}
      <MarketIndices className="sticky top-0 z-10" />
    </div>
  );
};


