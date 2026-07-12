'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

function safeNext(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}

function SignInFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const authError =
    searchParams.get('error') === 'auth'
      ? 'Sign-in failed. Please try again.'
      : null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);

    const supabase = createSupabaseBrowserClient();

    if (mode === 'password') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        setMessage(error.message);
        return;
      }
      const next = safeNext(searchParams.get('next'));
      router.replace(next ?? '/');
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage('Check your email for a sign-in link.');
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
        <div
          className={`settings-alert ${
            message.startsWith('Check your email')
              ? 'settings-alert--info'
              : 'settings-alert--error'
          }`}
        >
          {message}
        </div>
      ) : null}

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

        {mode === 'password' ? (
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        ) : null}

        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy
              ? 'Please wait…'
              : mode === 'password'
                ? 'Sign in'
                : 'Send magic link'}
          </button>
        </div>
      </form>

      <p className="muted" style={{ marginTop: '1rem' }}>
        {mode === 'password' ? (
          <>
            Prefer a magic link?{' '}
            <button
              type="button"
              className="linkish"
              onClick={() => {
                setMode('otp');
                setMessage(null);
              }}
            >
              Email me a sign-in link
            </button>
          </>
        ) : (
          <>
            Use password instead?{' '}
            <button
              type="button"
              className="linkish"
              onClick={() => {
                setMode('password');
                setMessage(null);
              }}
            >
              Sign in with password
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
