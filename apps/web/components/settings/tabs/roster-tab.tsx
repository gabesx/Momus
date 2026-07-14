'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '@/lib/api-client';

const DISCIPLINES = ['QA', 'BE', 'Apps', 'FE', 'Data'] as const;
type Discipline = (typeof DISCIPLINES)[number];
type Member = {
  id: number;
  name: string;
  jira_account_id: string | null;
  discipline: Discipline;
  tribe: string | null;
  squad: string | null;
};
type Draft = Omit<Member, 'id'>;
type AtlassianTeam = { id: string; name: string };
const EMPTY: Draft = { name: '', jira_account_id: '', discipline: 'QA', tribe: '', squad: '' };

export function RosterTab({
  onAlert,
}: {
  onAlert: (type: 'success' | 'error' | 'info', text: string) => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teams, setTeams] = useState<AtlassianTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [importing, setImporting] = useState(false);
  const [orgId, setOrgId] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiJson<{ members?: Member[] }>('/api/settings/roster');
    setLoading(false);
    if (!res.success) return onAlert('error', res.message ?? 'Failed to load roster');
    setMembers(res.members ?? []);
  }, [onAlert]);
  useEffect(() => {
    void load();
  }, [load]);
  const change = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!draft.name.trim()) return onAlert('error', 'Name is required');
    setSaving(true);
    const res = await apiJson(
      editing ? `/api/settings/roster/${editing.id}` : '/api/settings/roster',
      { method: editing ? 'PUT' : 'POST', body: JSON.stringify(draft) },
    );
    setSaving(false);
    if (!res.success) return onAlert('error', res.message ?? 'Failed to save roster member');
    setDraft(EMPTY);
    setEditing(null);
    onAlert('success', editing ? 'Roster member updated' : 'Roster member added');
    await load();
  };
  const remove = async (member: Member) => {
    if (!window.confirm(`Remove ${member.name} from the roster?`)) return;
    const res = await apiJson(`/api/settings/roster/${member.id}`, { method: 'DELETE' });
    if (!res.success) return onAlert('error', res.message ?? 'Failed to remove roster member');
    onAlert('success', `${member.name} removed from roster`);
    await load();
  };
  const loadTeams = async () => {
    setLoadingTeams(true);
    const res = await apiJson<{ teams?: AtlassianTeam[]; org_id?: string }>(
      '/api/settings/roster/atlassian-teams',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'load', org_id: orgId.trim() }),
      },
    );
    setLoadingTeams(false);
    if (!res.success) return onAlert('error', res.message ?? 'Failed to load Atlassian teams');
    if (res.org_id && !orgId.trim()) setOrgId(res.org_id);
    setTeams(res.teams ?? []);
    setSelectedTeamId('');
  };
  const importTeam = async () => {
    const selected = teams.find((team) => team.id === selectedTeamId);
    if (!selected) return onAlert('error', 'Choose an Atlassian team');
    setImporting(true);
    const res = await apiJson<{ imported?: number }>('/api/settings/roster/atlassian-teams', {
      method: 'POST',
      body: JSON.stringify({
        action: 'import',
        team_id: selected.id,
        team_name: selected.name,
        discipline: draft.discipline,
        tribe: draft.tribe,
        squad: draft.squad || selected.name,
      }),
    });
    setImporting(false);
    if (!res.success) return onAlert('error', res.message ?? 'Failed to import Atlassian team');
    onAlert('success', `Imported ${res.imported ?? 0} roster members`);
    await load();
  };
  return (
    <div className="settings-section">
      <div className="settings-section__intro">
        <h2>Squad roster</h2>
        <p>
          Maintain the people used for ownership reporting. QA members drive the QA Bug Slip table
          on Defect Analytics.
        </p>
      </div>
      <section className="settings-card">
        <div className="roster-import-head">
          <div>
            <h3>Import from Atlassian team</h3>
            <p className="muted">
              Pull a team’s members into the roster. Discipline, tribe, and squad below are applied
              to every imported member.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => void loadTeams()}
            disabled={loadingTeams}
          >
            {loadingTeams ? 'Loading…' : 'Load Atlassian teams'}
          </button>
        </div>
        <label className="field">
          Organization ID
          <input
            type="text"
            value={orgId}
            placeholder="e.g. abc12345-1234-abcd-9876-1a2b3c4d5e6f"
            onChange={(e) => setOrgId(e.target.value)}
          />
          <small className="hint">
            The UUID in your admin.atlassian.com URL: admin.atlassian.com/o/&lt;organization
            ID&gt;/teams. Saved after the first load.
          </small>
        </label>
        {teams.length ? (
          <div className="roster-import-controls">
            <label className="field">
              Team
              <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
                <option value="">— choose a team —</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void importTeam()}
              disabled={!selectedTeamId || importing}
            >
              {importing ? 'Importing…' : 'Import team members'}
            </button>
          </div>
        ) : null}
      </section>
      <section className="settings-card">
        <h3>{editing ? 'Edit roster member' : 'Add member manually'}</h3>
        <div className="roster-form-grid">
          <label className="field">
            Name
            <input
              value={draft.name}
              onChange={(e) => change('name', e.target.value)}
              placeholder="Name *"
            />
          </label>
          <label className="field">
            Discipline
            <select
              value={draft.discipline}
              onChange={(e) => change('discipline', e.target.value as Discipline)}
            >
              {DISCIPLINES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Jira account ID
            <input
              value={draft.jira_account_id ?? ''}
              onChange={(e) => change('jira_account_id', e.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="field">
            Tribe
            <input
              value={draft.tribe ?? ''}
              onChange={(e) => change('tribe', e.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="field">
            Squad
            <input
              value={draft.squad ?? ''}
              onChange={(e) => change('squad', e.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? 'Saving…' : editing ? 'Save member' : 'Add to roster'}
          </button>
          {editing ? (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setEditing(null);
                setDraft(EMPTY);
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </section>
      <section className="settings-card">
        <h3>Roster members ({members.length})</h3>
        {loading ? (
          <p className="muted">Loading roster…</p>
        ) : !members.length ? (
          <p className="muted">No members yet.</p>
        ) : (
          <div className="bb-table-wrap">
            <table className="bb-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Discipline</th>
                  <th>Jira account ID</th>
                  <th>Tribe</th>
                  <th>Squad</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>{member.name}</td>
                    <td>
                      <span className="bb-badge">{member.discipline}</span>
                    </td>
                    <td>{member.jira_account_id ?? '—'}</td>
                    <td>{member.tribe ?? '—'}</td>
                    <td>{member.squad ?? '—'}</td>
                    <td className="roster-actions">
                      <button
                        type="button"
                        className="btn btn-link"
                        onClick={() => {
                          setEditing(member);
                          setDraft({
                            name: member.name,
                            jira_account_id: member.jira_account_id ?? '',
                            discipline: member.discipline,
                            tribe: member.tribe ?? '',
                            squad: member.squad ?? '',
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-link roster-remove"
                        onClick={() => void remove(member)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
