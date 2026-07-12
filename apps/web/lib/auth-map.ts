import type { ApprovalStatus } from '@momus/domain';

export type MomusUserRow = {
  id: number | string;
  email: string;
  name: string | null;
  is_candidate: boolean;
  approval_status: ApprovalStatus;
};

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  permissions: string[];
  approvalStatus: ApprovalStatus;
};

export type MapResult =
  | { ok: true; user: AuthUser }
  | { ok: false; reason: 'no_momus_user' };

export function mapMomusUser(
  row: MomusUserRow | null | undefined,
  permissions: string[],
): MapResult {
  if (!row) return { ok: false, reason: 'no_momus_user' };
  return {
    ok: true,
    user: {
      id: Number(row.id),
      email: row.email,
      name: row.name ?? row.email,
      permissions,
      approvalStatus: row.approval_status,
    },
  };
}
