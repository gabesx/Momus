import { BUG_GROUP_TYPES, DEFECT_GROUP_TYPES } from '../constants/defaults';

export type QaRosterMember = {
  id: number;
  name: string;
  discipline: string;
};

export type QaSlipIssue = {
  issue_type?: string | null;
  final_issue_type?: string | null;
  reporter?: string | null;
  /** Sync sets owner = tester for bugs — the primary QA-ownership signal. */
  owner?: string | null;
  tested_by?: string | null;
  tester_assignee?: string | null;
};

export type QaSlipRow = {
  member_id: number;
  name: string;
  bugs: number;
  defects: number;
  /** Bugs ÷ defects. Null when the member has no reported defects. */
  bug_ratio: number | null;
  /** Bugs ÷ (bugs + defects), as a percentage. */
  bug_slip_pct: number;
};

function samePerson(value: string | null | undefined, name: string): boolean {
  return value?.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase();
}

/** Analytics grouping rule: issue_type first (see issueTypeOf in filter.ts). */
function issueType(issue: QaSlipIssue): string {
  return issue.issue_type ?? issue.final_issue_type ?? '';
}

/** QA ownership of a bug: owner (sync sets it to the tester), else tester fields. */
function isQaOwner(issue: QaSlipIssue, name: string): boolean {
  return (
    samePerson(issue.owner, name) ||
    samePerson(issue.tested_by, name) ||
    samePerson(issue.tester_assignee, name)
  );
}

/**
 * QA Bug Slip per roster member (QA discipline only): defects belong to
 * their reporter; bugs belong to the QA owner or reporter. A bug matching
 * both is intentionally counted once.
 */
export function buildQaSlipRows(members: QaRosterMember[], issues: QaSlipIssue[]): QaSlipRow[] {
  return members
    .filter((member) => member.discipline === 'QA')
    .map((member) => {
      let bugs = 0;
      let defects = 0;
      for (const issue of issues) {
        const type = issueType(issue);
        if ((DEFECT_GROUP_TYPES as readonly string[]).includes(type)) {
          if (samePerson(issue.reporter, member.name)) defects += 1;
        } else if ((BUG_GROUP_TYPES as readonly string[]).includes(type)) {
          if (isQaOwner(issue, member.name) || samePerson(issue.reporter, member.name)) {
            bugs += 1;
          }
        }
      }
      return {
        member_id: member.id,
        name: member.name,
        bugs,
        defects,
        bug_ratio: defects > 0 ? bugs / defects : null,
        bug_slip_pct: bugs + defects > 0 ? (bugs / (bugs + defects)) * 100 : 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
