import {
  TRACKER_MISSING_FIELD_KEYS,
  TRACKER_MISSING_FIELD_LABELS,
  type TrackerMissingFieldKey,
} from '@momus/domain';
import {
  getTrackerExcludedFields,
  saveTrackerExcludedFields,
} from '@momus/infra';
import { assertCsrf, requireViewAnalytics } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

/** Load Incomplete Field Settings (which fields count as missing). */
export async function GET() {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;

  try {
    const excluded_fields = await getTrackerExcludedFields();
    const fields = TRACKER_MISSING_FIELD_KEYS.map((key) => ({
      key,
      label: TRACKER_MISSING_FIELD_LABELS[key as TrackerMissingFieldKey],
      included: !excluded_fields.includes(key),
    }));
    return jsonOk({ fields, excluded_fields });
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to load field settings', 500);
  }
}

/** Save Incomplete Field Settings. Body: { excluded_fields: string[] }. */
export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;

  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as { excluded_fields?: unknown };
    if (!Array.isArray(body.excluded_fields)) {
      return jsonFail('excluded_fields must be an array', 422);
    }
    const excluded_fields = await saveTrackerExcludedFields(
      body.excluded_fields.filter((v): v is string => typeof v === 'string'),
    );
    const fields = TRACKER_MISSING_FIELD_KEYS.map((key) => ({
      key,
      label: TRACKER_MISSING_FIELD_LABELS[key as TrackerMissingFieldKey],
      included: !excluded_fields.includes(key),
    }));
    return jsonOk({ fields, excluded_fields });
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to save field settings', 500);
  }
}
