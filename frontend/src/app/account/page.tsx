"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCredentialManager } from '../../context/CredentialManager';
import { LoadingSpinner } from '../../components/LoadingSpinner';
// Removed MarketIndices and MarketStatus from Account page

export default function AccountDetails() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { credentials } = useCredentialManager();

  // Ensure SSR and first client render match
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    // Check if user is authenticated after mount
    if (!credentials?.sessionToken) {
      router.push('/');
      return;
    }
  }, [mounted, credentials, router]);

  // Show stable placeholder during SSR/first paint and while checking auth
  if (!mounted || !credentials?.sessionToken) {
    return (
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-8 items-center justify-start py-8">
        <LoadingSpinner size="lg" text="Checking authentication..." />
      </div>
    );
  }

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
