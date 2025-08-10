import { CredentialForm } from '../components/CredentialForm';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-8 items-center justify-start">
      <CredentialForm />
      <div className="flex gap-4">
        <Link href="/dashboard" className="text-blue-600 hover:underline text-sm">Go to Dashboard</Link>
        <Link href="/screener" className="text-blue-600 hover:underline text-sm">Open Screeners</Link>
      </div>
    </div>
  );
}
