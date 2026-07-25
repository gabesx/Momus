# Executive Weekly Digest — Multi-Message Send Implementation Plan

**Goal:** Restructure the **sent** weekly digest (Slack/Google Chat) into an executive report: an **Executive Summary** message followed by **one message per product** for the **top N riskiest products** (default N=5).

**Why multi-message:** a single chat message can't hold the full per-product structure (size cap). Sending Exec Summary + one message per product delivers the full depth within Chat limits.

**Reuse:** `computeExecutiveSummary`, `computeProductHealth`, `listProductsByRisk` (already built + tested). Only new work: message-text builders + multi-post in `runAnalyticsDigest`.

## Messages

**Executive Summary** (1 message): total open, new/closed this week, backlog WoW, release-blocking count, riskiest squad, and the release-blocker issue list (key + link + age + assignee/reporter). Links to the full report page.

**Per product** (N messages): open total + new/closed this week; open-by-severity; open-by-priority; 8-week created/resolved sparkline; release-blocking defects; Top-10 open (by severity); Oldest open. Issues render as `KEY — summary (sev/prio, age, assignee) + link`.

## Tasks

- [ ] **Task 1 — Domain builders** (`digest-messages.ts`): `sparkline`, `issueLine`, `buildExecutiveDigestMessage`, `buildProductDigestMessage`, `DIGEST_TOP_PRODUCTS=5`. Provider-aware links (slack `<url|KEY>` vs plain `KEY … url`). Tests.
- [ ] **Task 2 — Runner** (`digest-runner.ts`): build the Exec Summary + top-N product messages and POST each sequentially; return count sent; fail loud on any non-2xx.
- [ ] **Task 3 — Verify + real send** to Google Chat (Exec Summary + N product messages), tests/typecheck/build.
- [ ] **Task 4 — PR.**

Cron + Send-now already call `runAnalyticsDigest`, so both pick up the new format automatically.
