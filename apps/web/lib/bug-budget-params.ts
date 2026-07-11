import type { BugBudgetFilterParams } from '@momus/domain';

export function bugBudgetParamsFromUrl(url: URL): BugBudgetFilterParams {
  const sp = url.searchParams;
  const get = (k: string) => sp.get(k) ?? undefined;
  return {
    project: get('project'),
    status: get('status'),
    reporter: get('reporter'),
    year: get('year'),
    quarter: get('quarter'),
    issue_type: get('issue_type'),
    status_category: get('status_category') as BugBudgetFilterParams['status_category'],
    not_done: get('not_done'),
    issue_type_group: get('issue_type_group') as BugBudgetFilterParams['issue_type_group'],
    assignee: get('assignee'),
    ac_related: get('ac_related') as BugBudgetFilterParams['ac_related'],
    date_from: get('date_from'),
    date_to: get('date_to'),
    age_min: get('age_min'),
    age_max: get('age_max'),
    open_critical_major: get('open_critical_major'),
    show_all: get('show_all'),
    include_all_projects: get('include_all_projects'),
    sort: get('sort'),
    direction: get('direction') as BugBudgetFilterParams['direction'],
    per_page: get('per_page'),
    page: get('page'),
  };
}
