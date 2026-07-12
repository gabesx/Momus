'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { apiJson } from '@/lib/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

function safeNext(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}

function authErrorMessage(error: string | null): string | null {
  switch (error) {
    case 'auth':
      return 'Sign-in failed. Please try again.';
    case 'denied':
      return 'Your account access was denied. Contact an administrator.';
    case 'not_allowlisted':
      return 'Your email is not allowlisted. Contact an administrator to request access.';
    default:
      return null;
  }
}

function SignInFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const authError = authErrorMessage(searchParams.get('error'));
  const next = safeNext(searchParams.get('next'));

  const routeAfterEnsureUser = async () => {
    const res = await apiJson<{ access?: 'ok' | 'pending' | 'denied' }>(
      '/api/auth/ensure-user',
      { method: 'POST' },
    );

    if (!res.success) {
      setMessage(res.message ?? 'Could not complete sign-in.');
      setBusy(false);
      return;
    }

    setBusy(false);

    if (res.access === 'pending') {
      router.replace('/pending-approval');
      router.refresh();
      return;
    }

    if (res.access === 'denied') {
      setMessage('Your account access was denied. Contact an administrator.');
      await createSupabaseBrowserClient().auth.signOut();
      return;
    }

    router.replace(next ?? '/');
    router.refresh();
  };

  const onGoogleSignIn = async () => {
    setBusy(true);
    setMessage(null);

    const supabase = createSupabaseBrowserClient();
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    if (next) callbackUrl.searchParams.set('next', next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl.toString() },
    });

    setBusy(false);
    if (error) setMessage(error.message);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);

    const supabase = createSupabaseBrowserClient();

    if (mode === 'sign-up') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setBusy(false);
        setMessage(error.message);
        return;
      }
      await routeAfterEnsureUser();
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }

    await routeAfterEnsureUser();
  };

  return (
    <div className="settings-card bb-sign-in__card">
      <h1 style={{ marginTop: 0 }}>Sign in to Momus</h1>
      <p className="muted">
        Use your work email to access Defect Analytics, Tracker, and Bug Budget.
      </p>

      {authError ? (
        <div className="settings-alert settings-alert--error">{authError}</div>
      ) : null}
      {message ? (
        <div className="settings-alert settings-alert--error">{message}</div>
      ) : null}

      <div className="btn-row">
        <button
          type="button"
          className="btn btn-outline bb-sign-in__google"
          disabled={busy}
          onClick={() => void onGoogleSignIn()}
        >
          Continue with Google
        </button>
      </div>

      <div className="bb-sign-in__divider" aria-hidden="true">
        <span>or</span>
      </div>

      <form onSubmit={(e) => void onSubmit(e)}>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
          </button>
        </div>
      </form>

      <p className="muted" style={{ marginTop: '1rem' }}>
        {mode === 'sign-in' ? (
          <>
            Need an account?{' '}
            <button
              type="button"
              className="linkish"
              onClick={() => {
                setMode('sign-up');
                setMessage(null);
              }}
            >
              Sign up with email
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              type="button"
              className="linkish"
              onClick={() => {
                setMode('sign-in');
                setMessage(null);
              }}
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}

export function SignInForm() {
  return (
    <Suspense
      fallback={
        <div className="settings-card bb-sign-in__card">
          <p className="muted">Loading…</p>
        </div>
      }
    >
      <SignInFormInner />
    </Suspense>
  );
}
