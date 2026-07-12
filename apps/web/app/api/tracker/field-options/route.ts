import {
  assertJiraEnabled,
  createServerClient,
  getJiraSettings,
  JiraClient,
  TrackerRepository,
} from '@momus/infra';
import { requireViewAnalytics } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

const FIELD_MAP = {
  severity_issue: 'customfield_10069',
  service_feature: 'customfield_10076',
} as const;

type TrackerOptionField = keyof typeof FIELD_MAP;

function isOptionField(value: string | null): value is TrackerOptionField {
  return value === 'severity_issue' || value === 'service_feature';
}

/** Jira select options for Tracker severity / service-feature dropdowns. */
export async function GET(request: Request) {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;

  try {
    const url = new URL(request.url);
    const field = url.searchParams.get('field');
    if (!isOptionField(field)) {
      return jsonFail('field must be severity_issue or service_feature', 422);
    }

    const jiraFieldId = FIELD_MAP[field];
    let options: { id: string; value: string }[] = [];
    let source: 'jira' | 'database' = 'jira';
    let jira_error: string | null = null;

    try {
      const settings = await getJiraSettings();
      assertJiraEnabled(settings);
      const client = new JiraClient({
        baseUrl: settings.url,
        email: settings.username,
        apiToken: settings.apiToken,
      });
      options = await client.getFieldOptions(jiraFieldId);
      if (!options.length) jira_error = 'Jira returned no enabled options for this field';
    } catch (err) {
      options = [];
      jira_error = err instanceof Error ? err.message : 'Jira options request failed';
    }

    if (!options.length) {
      source = 'database';
      const repo = new TrackerRepository(createServerClient());
      const values = await repo.listDistinctFieldValues(field);
      options = values.map((value) => ({ id: value, value }));
    }

    return jsonOk({
      field,
      jira_field_id: jiraFieldId,
      source,
      jira_error,
      options,
    });
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to load field options', 500);
  }
}
