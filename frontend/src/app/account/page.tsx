"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCredentialManager } from '../../context/CredentialManager';
import { LoadingSpinner } from '../../components/LoadingSpinner';
// Removed MarketIndices and MarketStatus from Account page

interface CustomerData {
  Success?: {
    idirect_userid?: string;
    idirect_user_name?: string;
  };
}

export default function AccountDetails() {
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { credentials, clearCredentials } = useCredentialManager();

  // Ensure SSR and first client render match
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    // Check if user is authenticated after mount
    if (!credentials?.sessionToken) {
      router.push('/');
      return;
    }
    try {
      const storedCustomer = localStorage.getItem('breeze_customer_data');
      if (storedCustomer) {
        setCustomer(JSON.parse(storedCustomer));
      }
    } catch { setCustomer(null); }
  }, [mounted, credentials, router]);

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

  // Show stable placeholder during SSR/first paint and while checking auth
  if (!mounted || !credentials?.sessionToken) {
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
        {/* Removed duplicate Profile button (kept only the global header one) */}

        {/* Trading/summary section intentionally removed from Account page */}
      </div>
    </div>
  );
}
