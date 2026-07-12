# BB-MIG-06 — 30-day read-only legacy rollback

**Context:** After BB-MIG-05 route flip, **Momus is production**. QARATMS (app + MySQL) remains **deployable but read-only** for **30 days**, then is **hard-deleted**. Rollback is only meaningful inside that window.

---

## Principles

1. Cutover is **route-level** (DNS / gateway / entry URL) — not “keep both DBs in sync forever.”
2. Rollback = flip routes back to QARATMS + **pause Momus Bug Budget writes** (sync/cron/settings).
3. After day 30, deletion of QARATMS app and DB is **irreversible**; extend the window deliberately if needed.

---

## Standby posture (day 0 → day 30)

| Asset | Required state |
|---|---|
| QARATMS app | Deployable image/tag pinned; config known; **Bug Budget sync OFF** |
| QARATMS MySQL | Snapshot at cutover (or continuous backup); **no schema drops** until window ends |
| Momus | Production; Vault token; Inngest worker healthy |
| Docs | This file + MIG-05 go/no-go record dated |

### Read-only rules on QARATMS during standby

- No Bug Budget Jira sync / cron.
- Prefer blocking writes to `bug_budget` / sync_runs (app config or DB grants).
- Analytics/Tracker/etc. only if still routed for rollback emergency — prefer Momus-only traffic.

---

## Rollback trigger examples

- Critical Bug Budget parity regression vs last known-good parallel `mig:diff`
- Momus sync permanently failing (Jira/Vault/Inngest) with no ETA
- Data corruption on Momus `bug_budget` without clean restore

Non-triggers: cosmetic UI diffs, single-user permission mistakes (fix forward).

---

## Rollback procedure

1. **Announce** — status page / Slack; stop new Momus admin changes.
2. **Pause Momus writers** — disable Bug Budget cron; stop manual sync; optionally feature-flag write APIs.
3. **Route flip** — point Bug Budget (and any rolled-back consumers) to QARATMS.
4. **QARATMS mode** — may temporarily re-enable sync **only if** Momus data must not be authoritative; document who is SoT.
5. **Do not** delete Momus data; keep for forensics / re-cutover.
6. **Postmortem** — root cause, re-entry criteria for second cutover (re-run MIG-02/04 as needed).

### Data warning

If Momus accepted writes after cutover, QARATMS MySQL is **stale**. Rollback restores **availability**, not automatic merge of Momus-only rows. Plan a one-way copy or accept loss before flipping back.

---

## Day-30 decommission checklist

- [ ] No rollback in flight; product sign-off  
- [ ] Momus `mig:reconcile` / recent `mig:diff` acceptable  
- [ ] Consumer matrix (MIG-05) complete — nothing still needs QARATMS MySQL  
- [ ] Final MySQL dump archived (cold storage, access-controlled)  
- [ ] Final QARATMS app artifact archived  
- [ ] Drop/stop QARATMS app hosts  
- [ ] Drop/stop MySQL (`qara` / legacy instance)  
- [ ] Revoke legacy Jira tokens used only by QARATMS; confirm Momus Vault token active  
- [ ] Update runbooks / DNS docs — Momus only  

---

## Exit criteria (BB-MIG-06)

- [ ] 30-day (or extended) window completed without unresolved rollback  
- [ ] QARATMS app + DB decommissioned  
- [ ] Archives retained per company retention policy  
- [ ] AC-10 migration criterion satisfied for cutover + rollback readiness
