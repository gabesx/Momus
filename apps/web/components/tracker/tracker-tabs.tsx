'use client';

import type { TrackerTab } from '@momus/domain';

type Props = {
  active: TrackerTab;
  counts: Record<TrackerTab, number>;
  onChange: (tab: TrackerTab) => void;
};

const TABS: { id: TrackerTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'missing_fields', label: 'Missing fields' },
  { id: 'no_linked_test', label: 'No linked test' },
];

export function TrackerTabs({ active, counts, onChange }: Props) {
  return (
    <nav className="settings-tabs" aria-label="Tracker views">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`settings-tab${active === tab.id ? ' is-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          <span className="bb-count-badge" style={{ marginLeft: '0.35rem' }}>
            {counts[tab.id] ?? 0}
          </span>
        </button>
      ))}
    </nav>
  );
}
