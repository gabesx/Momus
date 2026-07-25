/** How a Momus user signs in (from Supabase Auth identities/providers). */
export type AuthSignInMethod = 'google_sso' | 'email_password' | 'both' | 'unknown';

/**
 * Classify sign-in from Auth provider names (`google`, `email`, …).
 * Google covers Gmail SSO; email is password-based auth.
 */
export function classifyAuthSignInMethod(providers: readonly string[]): AuthSignInMethod {
  const set = new Set(
    providers.map((p) => p.trim().toLowerCase()).filter(Boolean),
  );
  const hasGoogle = set.has('google');
  const hasEmail = set.has('email');
  if (hasGoogle && hasEmail) return 'both';
  if (hasGoogle) return 'google_sso';
  if (hasEmail) return 'email_password';
  return 'unknown';
}

export function authSignInMethodLabel(method: AuthSignInMethod): string {
  switch (method) {
    case 'google_sso':
      return 'Google SSO';
    case 'email_password':
      return 'Email & password';
    case 'both':
      return 'Google SSO + Email';
    case 'unknown':
      return 'Unknown';
  }
}
