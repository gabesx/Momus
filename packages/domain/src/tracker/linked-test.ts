export type LinkedIssue = { key: string; type: string };

export function hasLinkedTestExecutionFromLinkedIssues(linked_issues: unknown): boolean {
  if (!Array.isArray(linked_issues)) return false;
  return linked_issues.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const type = (entry as LinkedIssue).type;
    return typeof type === 'string' && /test execution/i.test(type);
  });
}
