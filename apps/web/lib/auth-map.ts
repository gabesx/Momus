export type MomusUserRow = {
  id: number | string;
  email: string;
  name: string | null;
  is_candidate: boolean;
};

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  permissions: string[];
};

export type MapResult =
  | { ok: true; user: AuthUser }
  | { ok: false; reason: 'no_momus_user' | 'candidate' };

export function mapMomusUser(
  row: MomusUserRow | null | undefined,
  permissions: string[],
): MapResult {
  if (!row) return { ok: false, reason: 'no_momus_user' };
  if (row.is_candidate) return { ok: false, reason: 'candidate' };
  return {
    ok: true,
    user: {
      id: Number(row.id),
      email: row.email,
      name: row.name ?? row.email,
      permissions,
    },
  };
}
