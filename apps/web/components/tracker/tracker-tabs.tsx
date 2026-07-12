'use client';

import type { TrackerTab } from '@momus/domain';

type Props = {
  active: TrackerTab;
  counts: Record<TrackerTab, number>;
  onChange: (tab: TrackerTab) => void;
};

const TABS: { id: TrackerTab; label: string }[] = [
  { id: 'missing_fields', label: 'Incomplete Fields' },
  { id: 'all', label: 'All Issues' },
  { id: 'no_linked_test', label: 'No Test Execution Link' },
];

export function TrackerTabs({ active, counts, onChange }: Props) {
  return (
    <nav className="bb-tracker-tabs" aria-label="Tracker views">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`bb-tracker-tab${active === tab.id ? ' is-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          <span className="bb-tracker-tab__badge">{counts[tab.id] ?? 0}</span>
        </button>
      ))}
    </nav>
  );
}
