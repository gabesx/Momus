# Open Bug Summary — key link, severity column, year desc

**Date:** 2026-07-12  
**Status:** Approved  
**Branch:** `fix/open-bug-summary-key-link-severity`

## Goal

In Bug Budget **Open Bug Summary** (and matching Open Defect Summary) modal:

1. Make issue **Key** a hyperlink to Jira browse (`{jira_browse_base}/{KEY}`), new tab.
2. Add a **Severity** column (data already on `SummaryIssue.severity`).
3. Year filter options: **All Years**, then years newest → oldest.

## Non-goals

- No domain/API contract changes beyond passing existing `jira_browse_base` into the modal.
- Severity section headings remain.

## Implementation

- `apps/web/components/bug-budget/summary-modal.tsx` — UI
- `apps/web/components/bug-budget/bug-budget-dashboard.tsx` — pass `jiraBrowseBase`
