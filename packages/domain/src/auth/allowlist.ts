export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailDomain(email: string): string | null {
  const n = normalizeEmail(email);
  const i = n.lastIndexOf('@');
  if (i <= 0 || i === n.length - 1) return null;
  return n.slice(i + 1);
}

export function isEmailAllowlisted(
  email: string,
  domains: string[],
  emails: string[],
): boolean {
  const n = normalizeEmail(email);
  const domainSet = new Set(domains.map((d) => d.trim().toLowerCase()));
  const emailSet = new Set(emails.map((e) => normalizeEmail(e)));
  if (emailSet.has(n)) return true;
  const d = emailDomain(n);
  return d !== null && domainSet.has(d);
}
