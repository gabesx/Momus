'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '@/lib/api-client';

type UserRecord = {
  id: number;
  email: string;
  name: string | null;
  is_candidate: boolean;
  permissions: string[];
};

const PERMISSION_OPTIONS = [
  { key: 'view_analytics', label: 'View Analytics' },
  { key: 'access_settings', label: 'Access Settings' },
  { key: 'manage_users', label: 'Manage Users' },
] as const;

type PermissionKey = (typeof PERMISSION_OPTIONS)[number]['key'];

type InvitePermissions = Record<PermissionKey, boolean>;

const DEFAULT_INVITE_PERMISSIONS: InvitePermissions = {
  view_analytics: true,
  access_settings: false,
  manage_users: false,
};

function permissionsFromFlags(flags: InvitePermissions): string[] {
  return PERMISSION_OPTIONS.filter((p) => flags[p.key]).map((p) => p.key);
}

function isForbiddenResponse(message?: string): boolean {
  if (!message) return false;
  return message.includes('manage_users') || message.includes('Missing permission');
}

export function UsersAdmin() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [draftPermissions, setDraftPermissions] = useState<Record<number, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePermissions, setInvitePermissions] =
    useState<InvitePermissions>(DEFAULT_INVITE_PERMISSIONS);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [savingId, setSavingId] = useState<number | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);

  const showAlert = useCallback((type: 'success' | 'error', text: string) => {
    setAlert({ type, text });
    if (type === 'success') {
      window.setTimeout(() => setAlert((a) => (a?.text === text ? null : a)), 6000);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    setForbidden(false);

    const res = await apiJson<{ users?: UserRecord[] }>('/api/users');
    setLoading(false);

    if (!res.success) {
      if (isForbiddenResponse(res.message)) {
        setForbidden(true);
        return;
      }
      setPageError(res.message ?? 'Failed to load users');
      return;
    }

    const list = res.users ?? [];
    setUsers(list);
    setDraftPermissions(
      Object.fromEntries(list.map((u) => [u.id, [...u.permissions]] as const)),
    );
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const inviteUser = async () => {
    setInviteError(null);
    const email = inviteEmail.trim();
    const name = inviteName.trim();

    if (!email || !email.includes('@')) {
      setInviteError('Valid email is required');
      return;
    }

    setInviting(true);
    try {
      const res = await apiJson<{ user?: UserRecord }>('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email,
          name,
          permissions: permissionsFromFlags(invitePermissions),
        }),
      });

      if (!res.success) {
        setInviteError(res.message ?? 'Failed to invite user');
        return;
      }

      setInviteEmail('');
      setInviteName('');
      setInvitePermissions(DEFAULT_INVITE_PERMISSIONS);
      showAlert('success', `Invited ${email}`);
      await loadUsers();
    } finally {
      setInviting(false);
    }
  };

  const savePermissions = async (userId: number) => {
    setSavingId(userId);
    try {
      const permissions = draftPermissions[userId] ?? [];
      const res = await apiJson<{ user?: UserRecord }>(`/api/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ permissions }),
      });

      if (!res.success) {
        showAlert('error', res.message ?? 'Failed to update permissions');
        return;
      }

      showAlert('success', 'Permissions saved');
      await loadUsers();
    } finally {
      setSavingId(null);
    }
  };

  const softDeactivate = async (userId: number) => {
    setDeactivatingId(userId);
    try {
      const res = await apiJson<{ user?: UserRecord }>(`/api/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_candidate: true, permissions: [] }),
      });

      if (!res.success) {
        showAlert('error', res.message ?? 'Failed to deactivate user');
        return;
      }

      showAlert('success', 'User deactivated');
      await loadUsers();
    } finally {
      setDeactivatingId(null);
    }
  };

  const toggleDraftPermission = (userId: number, key: PermissionKey, checked: boolean) => {
    setDraftPermissions((prev) => {
      const current = prev[userId] ?? [];
      const next = checked
        ? [...new Set([...current, key])]
        : current.filter((p) => p !== key);
      return { ...prev, [userId]: next };
    });
  };

  if (forbidden) {
    return (
      <div className="settings-page">
        <header className="settings-header">
          <div>
            <h1>Users</h1>
            <p>Manage Momus user access and permissions.</p>
          </div>
        </header>
        <div className="settings-alert settings-alert--error" role="alert">
          You need manage_users permission
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div>
          <h1>Users</h1>
          <p>Invite users and manage Momus permissions.</p>
        </div>
        <Link href="/" className="btn btn-outline">
          ← Back to Analytics
        </Link>
      </header>

      {alert ? (
        <div className={`settings-alert settings-alert--${alert.type}`} role="status">
          <span>{alert.text}</span>
          <button type="button" className="settings-alert__close" onClick={() => setAlert(null)}>
            ×
          </button>
        </div>
      ) : null}

      {pageError ? (
        <div className="settings-alert settings-alert--error" role="alert">
          {pageError}
        </div>
      ) : null}

      <section className="settings-card">
        <h2>Invite user</h2>
        <p className="muted">Sends a Supabase invite email and creates a Momus user record.</p>

        {inviteError ? (
          <div className="settings-alert settings-alert--error" role="alert">
            {inviteError}
          </div>
        ) : null}

        <div className="field-row">
          <label className="field">
            <span>Email *</span>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@company.com"
            />
          </label>
          <label className="field">
            <span>Name</span>
            <input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Display name"
            />
          </label>
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: '0 0 0.75rem' }}>
          <legend className="muted" style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
            Permissions
          </legend>
          {PERMISSION_OPTIONS.map((perm) => (
            <label key={perm.key} className="toggle-row" style={{ marginBottom: '0.35rem' }}>
              <span>{perm.label}</span>
              <input
                type="checkbox"
                checked={invitePermissions[perm.key]}
                onChange={(e) =>
                  setInvitePermissions((prev) => ({ ...prev, [perm.key]: e.target.checked }))
                }
              />
            </label>
          ))}
        </fieldset>

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={inviting}
            onClick={() => void inviteUser()}
          >
            {inviting ? 'Inviting…' : 'Send invite'}
          </button>
        </div>
      </section>

      <section className="settings-card">
        <div className="bb-table-toolbar">
          <h2>All users</h2>
          {loading ? <span className="muted">Loading…</span> : null}
        </div>

        {!loading && users.length === 0 ? (
          <p className="muted">No users yet.</p>
        ) : null}

        {!loading && users.length > 0 ? (
          <div className="bb-table-wrap">
            <table className="bb-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Candidate</th>
                  <th>Permissions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const draft = draftPermissions[user.id] ?? user.permissions;
                  const permissionsDirty =
                    [...draft].sort().join(',') !== [...user.permissions].sort().join(',');

                  return (
                    <tr key={user.id}>
                      <td>{user.email}</td>
                      <td>{user.name || '—'}</td>
                      <td>{user.is_candidate ? 'Yes' : 'No'}</td>
                      <td>
                        {user.is_candidate ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {user.permissions.length > 0 ? (
                              user.permissions.map((p) => (
                                <span key={p} className="bb-badge bb-badge--secondary">
                                  {p}
                                </span>
                              ))
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {PERMISSION_OPTIONS.map((perm) => (
                              <label
                                key={perm.key}
                                className="toggle-row"
                                style={{ marginBottom: 0, fontSize: '0.85rem' }}
                              >
                                <span>{perm.label}</span>
                                <input
                                  type="checkbox"
                                  checked={draft.includes(perm.key)}
                                  onChange={(e) =>
                                    toggleDraftPermission(user.id, perm.key, e.target.checked)
                                  }
                                />
                              </label>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        {user.is_candidate ? (
                          <span className="muted">Inactive</span>
                        ) : (
                          <div className="btn-row" style={{ marginTop: 0 }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={savingId === user.id || !permissionsDirty}
                              onClick={() => void savePermissions(user.id)}
                            >
                              {savingId === user.id ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline"
                              disabled={deactivatingId === user.id}
                              onClick={() => void softDeactivate(user.id)}
                            >
                              {deactivatingId === user.id ? 'Deactivating…' : 'Soft deactivate'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
