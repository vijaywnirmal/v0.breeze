"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const [customer, setCustomer] = useState<any>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedCustomer = localStorage.getItem('breeze_customer_data');
    if (storedCustomer) {
      setCustomer(JSON.parse(storedCustomer));
    }
  }, []);

  // Helper to safely get nested fields
  const get = (obj: any, path: string, fallback: any = 'N/A') => {
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : fallback), obj);
  };

  const handleLogout = () => {
    localStorage.removeItem('breeze_session_token');
    localStorage.removeItem('breeze_broker_credentials');
    localStorage.removeItem('breeze_customer_data');
    setCustomer(null);
    router.push('/');
  };

  const userId = get(customer, 'Success.idirect_userid', '');
  const userName = get(customer, 'Success.idirect_user_name', '');

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-8 items-center justify-start py-8 relative">
      {/* Profile dropdown in top-right */}
      <div className="absolute right-0 top-0 mt-4 mr-4 z-10">
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
      {/* Main dashboard area is empty for now, ready for future features */}
    </div>
  );
}
