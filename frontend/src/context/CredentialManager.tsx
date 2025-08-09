"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Types for credentials
export type BrokerCredentials = {
  apiKey: string;
  apiSecret: string;
  sessionToken: string;
};

export type CredentialContextType = {
  credentials: BrokerCredentials | null;
  setCredentials: (creds: BrokerCredentials, persist?: boolean) => void;
  clearCredentials: () => void;
  isPersisted: boolean;
};

const CredentialContext = createContext<CredentialContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'breeze_broker_credentials';

export const CredentialProvider = ({ children }: { children: ReactNode }) => {
  const [credentials, setCredentialsState] = useState<BrokerCredentials | null>(null);
  const [isPersisted, setIsPersisted] = useState(false);

  // Load credentials from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      try {
        setCredentialsState(JSON.parse(stored));
        setIsPersisted(true);
      } catch {
        setCredentialsState(null);
        setIsPersisted(false);
      }
    }
  }, []);

  // Set credentials and persist to sessionStorage
  const setCredentials = (creds: BrokerCredentials, persist = false) => {
    setCredentialsState(creds);
    if (persist) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(creds));
      setIsPersisted(true);
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setIsPersisted(false);
    }
  };

  // Clear credentials from state and storage
  const clearCredentials = () => {
    setCredentialsState(null);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setIsPersisted(false);
  };

  return (
    <CredentialContext.Provider value={{ credentials, setCredentials, clearCredentials, isPersisted }}>
      {children}
    </CredentialContext.Provider>
  );
};

// Hook to use credentials context
export const useCredentialManager = () => {
  const ctx = useContext(CredentialContext);
  if (!ctx) throw new Error('useCredentialManager must be used within a CredentialProvider');
  return ctx;
};
