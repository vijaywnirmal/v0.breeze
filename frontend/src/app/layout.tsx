import './globals.css';
import type { Metadata } from 'next';
import { CredentialProvider } from '../context/CredentialManager';
import { ErrorBoundary } from '../components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'Breeze - ICICI',
  description: 'Secure trading dashboard for broker API integration',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 dark:bg-gray-950 min-h-screen">
        <ErrorBoundary>
          <CredentialProvider>
            <main className="min-h-screen flex flex-col items-center justify-start py-8">
              {children}
            </main>
          </CredentialProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
