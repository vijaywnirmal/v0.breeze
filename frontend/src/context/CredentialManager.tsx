"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Types for credentials
export type BrokerCredentials = {
  apiKey?: string;      // avoid persisting; optional for compatibility
  apiSecret?: string;   // avoid persisting; optional for compatibility
  sessionToken: string; // only this is persisted
};

export type CredentialContextType = {
  credentials: BrokerCredentials | null;
  setCredentials: (creds: BrokerCredentials, persist?: boolean) => void;
  clearCredentials: () => void;
  isPersisted: boolean;
};

const CredentialContext = createContext<CredentialContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'breeze_session_token';

export const CredentialProvider = ({ children }: { children: ReactNode }) => {
  // Hydrate from sessionStorage synchronously to avoid logout flashes between pages
  const [credentials, setCredentialsState] = useState<BrokerCredentials | null>(() => {
    if (typeof window === 'undefined') return null;
    const token = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return token ? { sessionToken: token } : null;
  });
  const [isPersisted, setIsPersisted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !!sessionStorage.getItem(SESSION_STORAGE_KEY);
  });

  // Set credentials and persist to sessionStorage
  const setCredentials = (creds: BrokerCredentials, persist = false) => {
    // Always store only the session token
    setCredentialsState({ sessionToken: creds.sessionToken });
    if (persist) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, creds.sessionToken);
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
