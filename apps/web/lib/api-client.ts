/** Thin JSON client for settings UI. */
export async function apiJson<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit,
): Promise<T & { success: boolean; message?: string }> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & {
    success: boolean;
    message?: string;
  };
  if (!res.ok && body.success !== false) {
    return { ...body, success: false, message: body.message ?? `HTTP ${res.status}` };
  }
  return body;
}
