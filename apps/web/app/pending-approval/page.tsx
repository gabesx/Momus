'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiJson } from '@/lib/api-client';

export default function PendingApprovalPage() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    setSigningOut(true);
    setError(null);

    const res = await apiJson('/api/auth/sign-out', { method: 'POST' });
    if (!res.success) {
      setError(res.message ?? 'Sign out failed');
      setSigningOut(false);
      return;
    }

    router.push('/sign-in');
    router.refresh();
  };

  return (
    <main className="bb-sign-in">
      <div className="settings-card bb-sign-in__card">
        <h1 style={{ marginTop: 0 }}>Pending approval</h1>
        <p className="muted">
          Your account has been created and is waiting for an administrator to approve access.
          You will be able to use Momus once approval is complete.
        </p>

        {error ? (
          <div className="settings-alert settings-alert--error">{error}</div>
        ) : null}

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-outline"
            disabled={signingOut}
            onClick={() => void signOut()}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </main>
  );
}
