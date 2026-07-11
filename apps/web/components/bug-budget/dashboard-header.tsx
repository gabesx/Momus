'use client';

import Link from 'next/link';
import { MESSAGES } from '@momus/shared';

type Props = {
  onOpenBug: () => void;
  onOpenDefect: () => void;
  onColumns: () => void;
  exportHref: string;
  settingsHref?: string;
};

export function DashboardHeader({
  onOpenBug,
  onOpenDefect,
  onColumns,
  exportHref,
  settingsHref = '/settings/atlassian#bug-budget',
}: Props) {
  return (
    <header className="bb-dash-header">
      <div>
        <h1>Bug Budget</h1>
        <p>{MESSAGES.M19}</p>
      </div>
      <div className="bb-dash-toolbar">
        <button type="button" className="btn btn-outline" onClick={onOpenBug}>
          Open Bug Summary
        </button>
        <button type="button" className="btn btn-outline" onClick={onOpenDefect}>
          Open Defect Summary
        </button>
        <Link className="btn btn-outline" href={settingsHref}>
          Settings
        </Link>
        <button type="button" className="btn btn-outline" onClick={onColumns}>
          Columns
        </button>
        <a className="btn btn-success" href={exportHref}>
          Export CSV
        </a>
      </div>
    </header>
  );
}
