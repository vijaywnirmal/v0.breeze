import { CredentialForm } from '../components/CredentialForm';

export default function Home() {
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-8 items-center justify-start">
      <CredentialForm />
    </div>
  );
}
