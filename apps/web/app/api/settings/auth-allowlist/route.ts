import { AuthAllowlistRepository, createServerClient } from '@momus/infra';
import { assertCsrf, requireManageUsers } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function GET() {
  const auth = await requireManageUsers();
  if ('error' in auth) return auth.error;

  try {
    const repo = new AuthAllowlistRepository(createServerClient());
    const allowlist = await repo.list();
    return jsonOk(allowlist);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load auth allowlist';
    return jsonFail(message, 500);
  }
}

export async function PUT(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;

  const auth = await requireManageUsers();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const domains = body.domains;
    const emails = body.emails;

    if (!Array.isArray(domains) || !domains.every((d) => typeof d === 'string')) {
      return jsonFail('domains must be an array of strings', 422);
    }
    if (!Array.isArray(emails) || !emails.every((e) => typeof e === 'string')) {
      return jsonFail('emails must be an array of strings', 422);
    }

    const repo = new AuthAllowlistRepository(createServerClient());
    await repo.setAllowlist({ domains, emails }, auth.user.id);
    const allowlist = await repo.list();
    return jsonOk(allowlist);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save auth allowlist';
    return jsonFail(message, 500);
  }
}
