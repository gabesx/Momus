import { describe, expect, it } from 'vitest';
import { buildQaSlipRows } from './qa-slip';

describe('buildQaSlipRows', () => {
  it('counts defects by reporter and bugs by QA ownership or reporter without double counting', () => {
    const rows = buildQaSlipRows(
      [
        { id: 1, name: 'Ari QA', discipline: 'QA' },
        { id: 2, name: 'Ben BE', discipline: 'BE' },
      ],
      [
        { issue_type: 'Defect', reporter: 'Ari QA' },
        // QA owner AND reporter — counted once
        { issue_type: 'Bug', owner: 'Ari QA', reporter: 'Ari QA' },
        { issue_type: 'Bug', reporter: 'Ari QA' },
        { issue_type: 'Bug', owner: 'Someone else' },
      ],
    );

    expect(rows).toEqual([
      {
        member_id: 1,
        name: 'Ari QA',
        bugs: 2,
        defects: 1,
        bug_ratio: 2,
        bug_slip_pct: 66.66666666666666,
      },
    ]);
  });

  it('only roster QA members appear, even when others reported issues', () => {
    const rows = buildQaSlipRows(
      [{ id: 1, name: 'Ari QA', discipline: 'QA' }],
      [
        { issue_type: 'Defect', reporter: 'Not On Roster' },
        { issue_type: 'Bug', owner: 'Ben BE' },
      ],
    );
    expect(rows).toEqual([
      { member_id: 1, name: 'Ari QA', bugs: 0, defects: 0, bug_ratio: null, bug_slip_pct: 0 },
    ]);
  });

  it('recognises QA ownership via tested_by / tester_assignee when owner is empty', () => {
    const rows = buildQaSlipRows(
      [{ id: 1, name: 'Ari QA', discipline: 'QA' }],
      [
        { issue_type: 'Bug', tested_by: 'ari qa' },
        { issue_type: 'Bug', tester_assignee: 'Ari QA', reporter: 'Ari QA' },
      ],
    );
    expect(rows[0].bugs).toBe(2);
  });

  it('groups by issue_type first, matching the analytics convention', () => {
    const rows = buildQaSlipRows(
      [{ id: 1, name: 'Ari QA', discipline: 'QA' }],
      // issue_type wins over final_issue_type
      [{ issue_type: 'Bug', final_issue_type: 'Defect', reporter: 'Ari QA' }],
    );
    expect(rows[0].bugs).toBe(1);
    expect(rows[0].defects).toBe(0);
  });

  it('defects never attribute via QA ownership fields', () => {
    const rows = buildQaSlipRows(
      [{ id: 1, name: 'Ari QA', discipline: 'QA' }],
      [{ issue_type: 'Defect', owner: 'Ari QA', tested_by: 'Ari QA', reporter: 'Someone else' }],
    );
    expect(rows[0].defects).toBe(0);
  });
});
