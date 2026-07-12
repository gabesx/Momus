import { TRACKER_EDITABLE_FIELDS, type TrackerEditableField } from './types';

export type TrackerPatchResult =
  | { ok: true; value: Partial<Record<TrackerEditableField, unknown>> }
  | { ok: false; message: string };

function isValidLinkedIssues(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value === 'string') return true;
  if (Array.isArray(value)) return true;
  return false;
}

function isBlankString(value: string): boolean {
  return value.trim() === '';
}

export function parseTrackerPatch(body: Record<string, unknown>): TrackerPatchResult {
  for (const key of Object.keys(body)) {
    if (!(TRACKER_EDITABLE_FIELDS as readonly string[]).includes(key)) {
      return { ok: false, message: `Unknown field: ${key}` };
    }
  }

  const value: Partial<Record<TrackerEditableField, unknown>> = {};

  for (const key of TRACKER_EDITABLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const fieldValue = body[key];

    if (key === 'linked_issues') {
      if (!isValidLinkedIssues(fieldValue)) {
        return { ok: false, message: 'linked_issues must be null, string, or array' };
      }
      value.linked_issues = fieldValue;
      continue;
    }

    if (fieldValue !== null && typeof fieldValue !== 'string') {
      return { ok: false, message: `${key} must be a string or null` };
    }
    if (typeof fieldValue === 'string' && isBlankString(fieldValue)) {
      return { ok: false, message: `${key} must not be blank` };
    }
    value[key] = fieldValue;
  }

  return { ok: true, value };
}
