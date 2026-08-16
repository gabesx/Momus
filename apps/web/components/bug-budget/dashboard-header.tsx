'use client';

import Link from 'next/link';
import { MESSAGES } from '@momus/shared';
import { useMe } from '@/lib/use-me';

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
  const { user, loaded } = useMe();
  const canAccessSettings = loaded && !!user?.permissions.includes('access_settings');

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
        {canAccessSettings ? (
          <Link className="btn btn-outline" href={settingsHref}>
            Settings
          </Link>
        ) : null}
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
