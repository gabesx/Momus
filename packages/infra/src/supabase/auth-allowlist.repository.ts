import { normalizeEmail } from '@momus/domain';
import type { SupabaseClient } from '@supabase/supabase-js';

function normalizeDomains(domains: string[]): string[] {
  return [...new Set(domains.map((d) => d.trim().toLowerCase()).filter((d) => d.length > 0))];
}

function normalizeEmails(emails: string[]): string[] {
  return [...new Set(emails.map((e) => normalizeEmail(e)).filter((e) => e.length > 0))];
}

export class AuthAllowlistRepository {
  constructor(private readonly db: SupabaseClient) {}

  async list(): Promise<{ domains: string[]; emails: string[] }> {
    const [domainsResult, emailsResult] = await Promise.all([
      this.db.from('auth_allowed_domains').select('domain').order('domain', { ascending: true }),
      this.db.from('auth_allowed_emails').select('email').order('email', { ascending: true }),
    ]);

    if (domainsResult.error) {
      throw new Error(`list allowlist domains failed: ${domainsResult.error.message}`);
    }
    if (emailsResult.error) {
      throw new Error(`list allowlist emails failed: ${emailsResult.error.message}`);
    }

    return {
      domains: (domainsResult.data ?? []).map((row) => row.domain as string),
      emails: (emailsResult.data ?? []).map((row) => row.email as string),
    };
  }

  async setAllowlist(
    input: { domains: string[]; emails: string[] },
    createdBy: number | null,
  ): Promise<void> {
    const domains = normalizeDomains(input.domains);
    const emails = normalizeEmails(input.emails);

    const { error: deleteDomainsError } = await this.db
      .from('auth_allowed_domains')
      .delete()
      .not('domain', 'is', null);
    if (deleteDomainsError) {
      throw new Error(`setAllowlist delete domains failed: ${deleteDomainsError.message}`);
    }

    const { error: deleteEmailsError } = await this.db
      .from('auth_allowed_emails')
      .delete()
      .not('email', 'is', null);
    if (deleteEmailsError) {
      throw new Error(`setAllowlist delete emails failed: ${deleteEmailsError.message}`);
    }

    if (domains.length > 0) {
      const { error: insertDomainsError } = await this.db.from('auth_allowed_domains').insert(
        domains.map((domain) => ({
          domain,
          created_by: createdBy,
        })),
      );
      if (insertDomainsError) {
        throw new Error(`setAllowlist insert domains failed: ${insertDomainsError.message}`);
      }
    }

    if (emails.length > 0) {
      const { error: insertEmailsError } = await this.db.from('auth_allowed_emails').insert(
        emails.map((email) => ({
          email,
          created_by: createdBy,
        })),
      );
      if (insertEmailsError) {
        throw new Error(`setAllowlist insert emails failed: ${insertEmailsError.message}`);
      }
    }
  }
}
