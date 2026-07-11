'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiJson } from '@/lib/api-client';

export function SignedOutScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const res = await apiJson('/api/auth/sign-in', { method: 'POST' });
    setBusy(false);
    if (!res.success) {
      setError(res.message ?? 'Sign in failed');
      return;
    }
    router.push('/');
    router.refresh();
  };

  return (
    <main className="bb-signed-out">
      <div className="settings-card" style={{ maxWidth: 420, margin: '4rem auto' }}>
        <h1 style={{ marginTop: 0 }}>Signed out</h1>
        <p className="muted">You have signed off from Momus.</p>
        {error ? <div className="settings-alert settings-alert--error">{error}</div> : null}
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void signIn()}>
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
      </div>
    </main>
  );
}
