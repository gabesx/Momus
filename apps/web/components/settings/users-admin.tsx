'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '@/lib/api-client';

type UserRecord = {
  id: number;
  email: string;
  name: string | null;
  is_candidate: boolean;
  approval_status?: string;
  permissions: string[];
};

type AdminTab = 'pending' | 'active' | 'allowlist';

const PERMISSION_OPTIONS = [
  { key: 'view_analytics', label: 'View Analytics' },
  { key: 'access_settings', label: 'Access Settings' },
  { key: 'manage_users', label: 'Manage Users' },
] as const;

type PermissionKey = (typeof PERMISSION_OPTIONS)[number]['key'];

type PermissionFlags = Record<PermissionKey, boolean>;

const DEFAULT_PERMISSIONS: PermissionFlags = {
  view_analytics: true,
  access_settings: false,
  manage_users: false,
};

function permissionsFromFlags(flags: PermissionFlags): string[] {
  return PERMISSION_OPTIONS.filter((p) => flags[p.key]).map((p) => p.key);
}

function isForbiddenResponse(message?: string): boolean {
  if (!message) return false;
  return message.includes('manage_users') || message.includes('Missing permission');
}

function ApproveDialog({
  email,
  permissions,
  approving,
  onPermissionsChange,
  onApprove,
  onClose,
}: {
  email: string;
  permissions: PermissionFlags;
  approving: boolean;
  onPermissionsChange: (next: PermissionFlags) => void;
  onApprove: () => void;
  onClose: () => void;
}) {
  return (
    <div className="bb-modal" role="dialog" aria-modal="true" aria-label="Approve user">
      <div className="bb-modal__panel" style={{ maxWidth: 480, margin: '4rem auto', flex: 'none' }}>
        <div className="bb-modal__head">
          <div>
            <h2>Approve user</h2>
            <p className="muted">Grant permissions for {email}</p>
          </div>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={approving}>
            Cancel
          </button>
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: '0 0 1rem' }}>
          <legend className="muted" style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
            Permissions
          </legend>
          {PERMISSION_OPTIONS.map((perm) => (
            <label key={perm.key} className="toggle-row" style={{ marginBottom: '0.35rem' }}>
              <span>{perm.label}</span>
              <input
                type="checkbox"
                checked={permissions[perm.key]}
                onChange={(e) =>
                  onPermissionsChange({ ...permissions, [perm.key]: e.target.checked })
                }
              />
            </label>
          ))}
        </fieldset>

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={approving}
            onClick={onApprove}
          >
            {approving ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function UsersAdmin() {
  const [tab, setTab] = useState<AdminTab>('pending');

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [draftPermissions, setDraftPermissions] = useState<Record<number, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePermissions, setInvitePermissions] = useState<PermissionFlags>(DEFAULT_PERMISSIONS);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [savingId, setSavingId] = useState<number | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);

  const [approveTarget, setApproveTarget] = useState<UserRecord | null>(null);
  const [approvePermissions, setApprovePermissions] = useState<PermissionFlags>(DEFAULT_PERMISSIONS);
  const [approving, setApproving] = useState(false);
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  const [allowlistDomains, setAllowlistDomains] = useState<string[]>([]);
  const [allowlistEmails, setAllowlistEmails] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [allowlistLoading, setAllowlistLoading] = useState(false);
  const [allowlistSaving, setAllowlistSaving] = useState(false);
  const [allowlistError, setAllowlistError] = useState<string | null>(null);

  const showAlert = useCallback((type: 'success' | 'error', text: string) => {
    setAlert({ type, text });
    if (type === 'success') {
      window.setTimeout(() => setAlert((a) => (a?.text === text ? null : a)), 6000);
    }
  }, []);

  const loadUsers = useCallback(async (status: 'pending' | 'approved') => {
    setLoading(true);
    setPageError(null);
    setForbidden(false);

    const res = await apiJson<{ users?: UserRecord[] }>(
      `/api/users?status=${encodeURIComponent(status)}`,
    );
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
    if (status === 'approved') {
      setDraftPermissions(
        Object.fromEntries(list.map((u) => [u.id, [...u.permissions]] as const)),
      );
    }
  }, []);

  const loadAllowlist = useCallback(async () => {
    setAllowlistLoading(true);
    setAllowlistError(null);
    setForbidden(false);

    const res = await apiJson<{ domains?: string[]; emails?: string[] }>(
      '/api/settings/auth-allowlist',
    );
    setAllowlistLoading(false);

    if (!res.success) {
      if (isForbiddenResponse(res.message)) {
        setForbidden(true);
        return;
      }
      setAllowlistError(res.message ?? 'Failed to load allowlist');
      return;
    }

    setAllowlistDomains(res.domains ?? []);
    setAllowlistEmails(res.emails ?? []);
  }, []);

  useEffect(() => {
    if (tab === 'pending') {
      void loadUsers('pending');
    } else if (tab === 'active') {
      void loadUsers('approved');
    } else {
      void loadAllowlist();
    }
  }, [tab, loadUsers, loadAllowlist]);

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
      setInvitePermissions(DEFAULT_PERMISSIONS);
      showAlert('success', `Invited ${email}`);
      if (tab === 'active') {
        await loadUsers('approved');
      }
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
      await loadUsers('approved');
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
      await loadUsers('approved');
    } finally {
      setDeactivatingId(null);
    }
  };

  const openApproveDialog = (user: UserRecord) => {
    setApproveTarget(user);
    setApprovePermissions(DEFAULT_PERMISSIONS);
  };

  const closeApproveDialog = () => {
    if (approving) return;
    setApproveTarget(null);
  };

  const approveUser = async () => {
    if (!approveTarget) return;

    setApproving(true);
    try {
      const res = await apiJson<{ user?: UserRecord }>(
        `/api/users/${approveTarget.id}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({
            permissions: permissionsFromFlags(approvePermissions),
          }),
        },
      );

      if (!res.success) {
        showAlert('error', res.message ?? 'Failed to approve user');
        return;
      }

      setApproveTarget(null);
      showAlert('success', `Approved ${approveTarget.email}`);
      await loadUsers('pending');
    } finally {
      setApproving(false);
    }
  };

  const rejectUser = async (userId: number) => {
    setRejectingId(userId);
    try {
      const res = await apiJson<{ user?: UserRecord }>(`/api/users/${userId}/reject`, {
        method: 'POST',
      });

      if (!res.success) {
        showAlert('error', res.message ?? 'Failed to reject user');
        return;
      }

      showAlert('success', 'User rejected');
      await loadUsers('pending');
    } finally {
      setRejectingId(null);
    }
  };

  const saveAllowlist = async () => {
    setAllowlistSaving(true);
    setAllowlistError(null);
    try {
      const res = await apiJson<{ domains?: string[]; emails?: string[] }>(
        '/api/settings/auth-allowlist',
        {
          method: 'PUT',
          body: JSON.stringify({
            domains: allowlistDomains,
            emails: allowlistEmails,
          }),
        },
      );

      if (!res.success) {
        setAllowlistError(res.message ?? 'Failed to save allowlist');
        return;
      }

      setAllowlistDomains(res.domains ?? allowlistDomains);
      setAllowlistEmails(res.emails ?? allowlistEmails);
      showAlert('success', 'Allowlist saved');
    } finally {
      setAllowlistSaving(false);
    }
  };

  const addDomain = () => {
    const value = newDomain.trim().toLowerCase();
    if (!value) return;
    if (allowlistDomains.includes(value)) {
      setNewDomain('');
      return;
    }
    setAllowlistDomains((prev) => [...prev, value].sort());
    setNewDomain('');
  };

  const addEmail = () => {
    const value = newEmail.trim().toLowerCase();
    if (!value || !value.includes('@')) {
      setAllowlistError('Valid email is required');
      return;
    }
    setAllowlistError(null);
    if (allowlistEmails.includes(value)) {
      setNewEmail('');
      return;
    }
    setAllowlistEmails((prev) => [...prev, value].sort());
    setNewEmail('');
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
          <p>Invite users, approve sign-ups, and manage Momus permissions.</p>
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
        <p className="muted">Sends a Supabase invite email and creates an approved Momus user.</p>

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

      <nav className="settings-tabs" aria-label="User admin sections">
        <button
          type="button"
          className={`settings-tab${tab === 'pending' ? ' is-active' : ''}`}
          onClick={() => setTab('pending')}
        >
          Pending
        </button>
        <button
          type="button"
          className={`settings-tab${tab === 'active' ? ' is-active' : ''}`}
          onClick={() => setTab('active')}
        >
          Active
        </button>
        <button
          type="button"
          className={`settings-tab${tab === 'allowlist' ? ' is-active' : ''}`}
          onClick={() => setTab('allowlist')}
        >
          Allowlist
        </button>
      </nav>

      {tab === 'pending' ? (
        <section className="settings-card">
          <div className="bb-table-toolbar">
            <h2>Pending approval</h2>
            {loading ? <span className="muted">Loading…</span> : null}
          </div>
          <p className="muted">Users who signed up and are waiting for admin approval.</p>

          {!loading && users.length === 0 ? (
            <p className="muted">No pending users.</p>
          ) : null}

          {!loading && users.length > 0 ? (
            <div className="bb-table-wrap">
              <table className="bb-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.email}</td>
                      <td>{user.name || '—'}</td>
                      <td>
                        <div className="btn-row" style={{ marginTop: 0 }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={rejectingId === user.id || approving}
                            onClick={() => openApproveDialog(user)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            disabled={rejectingId === user.id || approving}
                            onClick={() => void rejectUser(user.id)}
                          >
                            {rejectingId === user.id ? 'Rejecting…' : 'Reject'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'active' ? (
        <section className="settings-card">
          <div className="bb-table-toolbar">
            <h2>Active users</h2>
            {loading ? <span className="muted">Loading…</span> : null}
          </div>

          {!loading && users.length === 0 ? (
            <p className="muted">No active users yet.</p>
          ) : null}

          {!loading && users.length > 0 ? (
            <div className="bb-table-wrap">
              <table className="bb-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Status</th>
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
                        <td>{user.is_candidate ? 'Inactive' : 'Active'}</td>
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
                            <span className="muted">Deactivated</span>
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
                                {deactivatingId === user.id ? 'Deactivating…' : 'Deactivate'}
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
      ) : null}

      {tab === 'allowlist' ? (
        <section className="settings-card">
          <div className="bb-table-toolbar">
            <h2>Auth allowlist</h2>
            {allowlistLoading ? <span className="muted">Loading…</span> : null}
          </div>
          <p className="muted">
            Self-sign-up is allowed when the email domain or exact address matches an entry below.
          </p>

          {allowlistError ? (
            <div className="settings-alert settings-alert--error" role="alert">
              {allowlistError}
            </div>
          ) : null}

          <h3 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Allowed domains</h3>
          <div className="field-row">
            <label className="field" style={{ flex: 1 }}>
              <span>Add domain</span>
              <input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="company.com"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addDomain();
                  }
                }}
              />
            </label>
            <div className="btn-row" style={{ alignSelf: 'flex-end', marginTop: 0 }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={allowlistLoading}
                onClick={addDomain}
              >
                Add
              </button>
            </div>
          </div>
          {allowlistDomains.length === 0 ? (
            <p className="muted">No domains configured.</p>
          ) : (
            <ul style={{ margin: '0 0 1rem', paddingLeft: '1.25rem' }}>
              {allowlistDomains.map((domain) => (
                <li key={domain} style={{ marginBottom: '0.35rem' }}>
                  <span>{domain}</span>{' '}
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ marginLeft: '0.5rem', padding: '0.15rem 0.5rem', fontSize: '0.8rem' }}
                    onClick={() =>
                      setAllowlistDomains((prev) => prev.filter((d) => d !== domain))
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h3 style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>Allowed emails</h3>
          <div className="field-row">
            <label className="field" style={{ flex: 1 }}>
              <span>Add email</span>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@company.com"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addEmail();
                  }
                }}
              />
            </label>
            <div className="btn-row" style={{ alignSelf: 'flex-end', marginTop: 0 }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={allowlistLoading}
                onClick={addEmail}
              >
                Add
              </button>
            </div>
          </div>
          {allowlistEmails.length === 0 ? (
            <p className="muted">No exact emails configured.</p>
          ) : (
            <ul style={{ margin: '0 0 1rem', paddingLeft: '1.25rem' }}>
              {allowlistEmails.map((email) => (
                <li key={email} style={{ marginBottom: '0.35rem' }}>
                  <span>{email}</span>{' '}
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ marginLeft: '0.5rem', padding: '0.15rem 0.5rem', fontSize: '0.8rem' }}
                    onClick={() => setAllowlistEmails((prev) => prev.filter((e) => e !== email))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={allowlistLoading || allowlistSaving}
              onClick={() => void saveAllowlist()}
            >
              {allowlistSaving ? 'Saving…' : 'Save allowlist'}
            </button>
          </div>
        </section>
      ) : null}

      {approveTarget ? (
        <ApproveDialog
          email={approveTarget.email}
          permissions={approvePermissions}
          approving={approving}
          onPermissionsChange={setApprovePermissions}
          onApprove={() => void approveUser()}
          onClose={closeApproveDialog}
        />
      ) : null}
    </div>
  );
}
