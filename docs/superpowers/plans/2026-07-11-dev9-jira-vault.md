# DEV-9 Jira Token Vault — Implementation Plan

> **For agentic workers:** Use subagent-driven-development or executing-plans.

**Goal:** Encrypt Jira API token at rest via Supabase Vault; settings stores UUID only.

**Spec:** `docs/superpowers/specs/2026-07-11-dev9-jira-vault-design.md`

## Tasks (summary)

1. Migration `20260711210000_jira_token_vault.sql` — extension, RPCs, plaintext migrate  
2. Wire `getJiraSettings` / `saveJiraSettings` to `momus_get_jira_token` / `momus_set_jira_token`  
3. Typecheck + settings unit tests; commit; PR  

## Done when

- Token not stored as plaintext in `settings.value` after migrate  
- Mask/parse tests still pass  
- Typecheck green  
