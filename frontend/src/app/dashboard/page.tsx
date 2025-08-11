"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCredentialManager } from '../../context/CredentialManager';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { MarketStatus } from '../../components/MarketStatus';



export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { credentials } = useCredentialManager();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!credentials?.sessionToken) {
      router.push('/');
      return;
    }
  }, [mounted, credentials, router]);

  if (!mounted) {
    return (
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-8 items-center justify-start py-8">
        <LoadingSpinner size="lg" text="Checking authentication..." />
      </div>
    );
  }
  if (!credentials?.sessionToken) {
    return null;
  }

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* Header (profile + tickers) is handled globally in layout */}
      {/* Main content: Market Status only (no Trading Dashboard card) */}
      <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col gap-8 items-start justify-start py-8 px-4">
        <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
          <div className="lg:col-span-1">
            <MarketStatus />
          </div>
        </div>
      </div>
    </div>
  );
}


