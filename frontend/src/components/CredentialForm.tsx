"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCredentialManager } from '../context/CredentialManager';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || ""; // prefer Next.js rewrite when empty
const SESSION_LINK = 'https://api.icicidirect.com/apiuser/home';

export type BrokerCredentials = {
  apiKey: string;
  apiSecret: string;
  sessionToken: string;
};

const initialState: BrokerCredentials = {
  apiKey: '',
  apiSecret: '',
  sessionToken: '',
};

export const CredentialForm: React.FC = () => {
  const [form, setForm] = useState<BrokerCredentials>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setCredentials } = useCredentialManager();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = {
        api_key: form.apiKey,
        api_secret: form.apiSecret,
        session_token: form.sessionToken,
      };
      const res = await fetch((BACKEND_URL || '') + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Login failed');
      }
      const loginData = await res.json();
      // Save ONLY session token client-side; do not persist apiSecret/apiKey
      setCredentials({ sessionToken: loginData?.api_session || form.sessionToken }, true);
      // Store customer details if present
      const toStore = loginData && loginData.customer ? loginData.customer : null;
      if (toStore) {
        localStorage.setItem('breeze_customer_data', JSON.stringify(toStore));
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-700"
      autoComplete="off"
    >
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <span className="inline-block text-blue-600 dark:text-blue-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0-1.104.896-2 2-2s2 .896 2 2-.896 2-2 2-2-.896-2-2zm0 0V7m0 4v4m0 0c0 1.104-.896 2-2 2s-2-.896-2-2 .896-2 2-2 2 .896 2 2z" /></svg>
        </span>
        Broker API Login
      </h2>
      <p className="mb-4 text-gray-600 dark:text-gray-300 text-sm">
        Enter your <span className="font-semibold">API Key</span>, <span className="font-semibold">API Secret</span>, and <span className="font-semibold">Session Token</span>.<br/>
        <span className="inline-flex items-center gap-1"><svg className="h-4 w-4 text-yellow-500 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01" /></svg>For security, credentials are <span className="font-semibold">never stored on our servers</span>.</span>
      </p>
      <div className="mb-4">
        <label htmlFor="apiKey" className="block text-sm font-medium mb-1">API Key</label>
        <input
          type="text"
          id="apiKey"
          name="apiKey"
          value={form.apiKey}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          autoComplete="off"
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="apiSecret" className="block text-sm font-medium mb-1">API Secret</label>
        <input
          type="text"
          id="apiSecret"
          name="apiSecret"
          value={form.apiSecret}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          autoComplete="off"
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="sessionToken" className="block text-sm font-medium mb-1">Session Token</label>
        <input
          type="text"
          id="sessionToken"
          name="sessionToken"
          value={form.sessionToken}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          autoComplete="off"
          required
        />
      </div>

      <div className="mb-4">
        <a
          href={SESSION_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 underline text-sm flex items-center gap-1"
        >
          <svg className="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7m0 0v7m0-7L10 14m-7 7h7a2 2 0 002-2v-7" /></svg>
          Generate Session Token (ICICI Direct)
        </a>
      </div>
      {error && <div className="mb-4 text-red-600 dark:text-red-400 text-sm">{error}</div>}
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </div>
    </form>
  );
};
