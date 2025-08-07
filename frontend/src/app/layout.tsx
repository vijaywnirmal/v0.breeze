import './globals.css';
import type { Metadata } from 'next';
import { CredentialProvider } from '../context/CredentialManager';

export const metadata: Metadata = {
  title: 'Trading App',
  description: 'Secure trading dashboard for broker API integration',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 dark:bg-gray-950 min-h-screen">
        <CredentialProvider>
          <main className="min-h-screen flex flex-col items-center justify-start py-8">
            {children}
          </main>
        </CredentialProvider>
      </body>
    </html>
  );
}
