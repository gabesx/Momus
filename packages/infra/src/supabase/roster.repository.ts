import type { SupabaseClient } from '@supabase/supabase-js';

export const ROSTER_DISCIPLINES = ['QA', 'BE', 'Apps', 'FE', 'Data'] as const;
export type RosterDiscipline = (typeof ROSTER_DISCIPLINES)[number];

export type RosterMember = {
  id: number;
  name: string;
  jira_account_id: string | null;
  discipline: RosterDiscipline;
  tribe: string | null;
  squad: string | null;
};

export type RosterMemberInput = Omit<RosterMember, 'id'>;

export type AtlassianTeam = { id: string; name: string };
export type AtlassianTeamMember = { name: string; jira_account_id: string | null };

function toRosterMember(row: Record<string, unknown>): RosterMember {
  return {
    id: Number(row.id),
    name: String(row.name),
    jira_account_id: typeof row.jira_account_id === 'string' ? row.jira_account_id : null,
    discipline: row.discipline as RosterDiscipline,
    tribe: typeof row.tribe === 'string' ? row.tribe : null,
    squad: typeof row.squad === 'string' ? row.squad : null,
  };
}

export class RosterRepository {
  constructor(private readonly db: SupabaseClient) {}

  async list(): Promise<RosterMember[]> {
    const { data, error } = await this.db
      .from('roster_members')
      .select('id, name, jira_account_id, discipline, tribe, squad')
      .order('discipline')
      .order('name');
    if (error?.code === 'PGRST205') {
      const { data: qa, error: qaError } = await this.db
        .from('qa_checker_names')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (qaError) throw new Error(`list roster failed: ${qaError.message}`);
      return (qa ?? []).map((row) => ({
        id: -Number(row.id),
        name: String(row.name),
        jira_account_id: null,
        discipline: 'QA' as const,
        tribe: null,
        squad: null,
      }));
    }
    if (error) throw new Error(`list roster failed: ${error.message}`);
    return (data ?? []).map((row) => toRosterMember(row as Record<string, unknown>));
  }

  async create(input: RosterMemberInput): Promise<RosterMember> {
    const { data, error } = await this.db
      .from('roster_members')
      .insert(input)
      .select('id, name, jira_account_id, discipline, tribe, squad')
      .single();
    if (error) throw new Error(`create roster member failed: ${error.message}`);
    return toRosterMember(data as Record<string, unknown>);
  }

  async update(id: number, input: RosterMemberInput): Promise<RosterMember> {
    const { data, error } = await this.db
      .from('roster_members')
      .update(input)
      .eq('id', id)
      .select('id, name, jira_account_id, discipline, tribe, squad')
      .single();
    if (error) throw new Error(`update roster member failed: ${error.message}`);
    return toRosterMember(data as Record<string, unknown>);
  }

  async remove(id: number): Promise<void> {
    const { error } = await this.db.from('roster_members').delete().eq('id', id);
    if (error) throw new Error(`remove roster member failed: ${error.message}`);
  }

  async importTeamMembers(
    members: AtlassianTeamMember[],
    input: Pick<RosterMemberInput, 'discipline' | 'tribe' | 'squad'>,
  ): Promise<number> {
    const rows = members
      .filter((member) => member.name.trim())
      .map((member) => ({
        name: member.name.trim(),
        jira_account_id: member.jira_account_id,
        ...input,
      }));
    if (!rows.length) return 0;
    const { error } = await this.db
      .from('roster_members')
      .upsert(rows, { onConflict: 'name,discipline' });
    if (error) throw new Error(`import roster members failed: ${error.message}`);
    return rows.length;
  }
}
