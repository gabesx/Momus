import type { TrackerEditableField, TrackerOverrides } from './types';
import { TRACKER_EDITABLE_FIELDS } from './types';

export { TRACKER_EDITABLE_FIELDS };

export function mergeTrackerOverrides(
  current: TrackerOverrides,
  patch: Partial<Record<TrackerEditableField, unknown>>,
  meta: { at: string; by: string },
): TrackerOverrides {
  const next: TrackerOverrides = { ...current };
  for (const key of TRACKER_EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      next[key] = { at: meta.at, by: meta.by };
    }
  }
  return next;
}

export function omitOverriddenFields<T extends Record<string, unknown>>(
  payload: T,
  overrides: TrackerOverrides | null | undefined,
): T {
  if (!overrides || Object.keys(overrides).length === 0) return { ...payload };
  const out = { ...payload };
  for (const key of TRACKER_EDITABLE_FIELDS) {
    if (overrides[key]) delete out[key];
  }
  if (overrides.linked_issues) {
    delete out.has_linked_test_execution;
  }
  return out;
}
