'use client';

import { interpolateM01 } from '@/lib/bug-budget-url';

type Props = {
  activeFilterCount: number;
  filteredTotal: number;
  databaseTotal: number;
  onViewAll: () => void;
};

export function ScopeBanner({
  activeFilterCount,
  filteredTotal,
  databaseTotal,
  onViewAll,
}: Props) {
  if (activeFilterCount <= 0) return null;
  return (
    <div className="bb-scope">
      <span>{interpolateM01(filteredTotal, databaseTotal)}</span>
      <button type="button" className="btn btn-ghost" onClick={onViewAll}>
        View all {databaseTotal} records
      </button>
    </div>
  );
}
