import { TRACKER_MISSING_FIELD_KEYS, type TrackerMissingFieldKey } from '@momus/domain';
import { createServerClient } from './client';

const SETTING_KEY = 'incomplete_field_excluded_fields';

export async function getTrackerExcludedFields(): Promise<string[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', SETTING_KEY)
    .maybeSingle();
  if (error) throw new Error(`Failed to load tracker field settings: ${error.message}`);

  try {
    const parsed = JSON.parse(data?.value ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    const valid = new Set<string>(TRACKER_MISSING_FIELD_KEYS);
    return parsed.filter((v): v is string => typeof v === 'string' && valid.has(v));
  } catch {
    return [];
  }
}

export async function saveTrackerExcludedFields(excludedFields: string[]): Promise<string[]> {
  const valid = new Set<string>(TRACKER_MISSING_FIELD_KEYS);
  const cleaned = [
    ...new Set(excludedFields.filter((v): v is TrackerMissingFieldKey => valid.has(v))),
  ];

  const supabase = createServerClient();
  const { error } = await supabase.from('settings').upsert(
    {
      key: SETTING_KEY,
      value: JSON.stringify(cleaned),
      type: 'json',
      group: 'defect_tracker',
      description: 'Fields excluded from incomplete field tracking',
    },
    { onConflict: 'key' },
  );
  if (error) throw new Error(`Failed to save tracker field settings: ${error.message}`);
  return cleaned;
}
