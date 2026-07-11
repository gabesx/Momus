# DEV-9 Jira Token Vault Encryption — Design Spec

**Date:** 2026-07-11  
**Status:** Approved for planning  
**Branch:** `feat/dev9-jira-vault`  
**Scope:** Encrypt `jira_api_token` at rest via Supabase Vault (BB-NFR-04 / DEV-9 / AC-9)  
**Approach:** Security-definer SQL helpers + UUID in `settings` (Approach 1)

## Goal

Store the Jira API token encrypted in Vault; keep only a secret UUID (or empty) in `public.settings`; decrypt only through service-role RPCs for sync/settings flows. UI/API continue to mask tokens as `****************`.

## Non-goals

- Encrypting Confluence fields (no token today)
- Phase 6 data migration / BB-DATA-08
- Dual-read plaintext forever after migrate
- Exposing Vault to `anon` / `authenticated`

## Decisions

| Topic | Choice |
|---|---|
| Storage | `settings.jira_api_token` = Vault secret UUID or `''` |
| Access | `momus_set_jira_token` / `momus_get_jira_token` SECURITY DEFINER, `service_role` only |
| Migrate | Non-empty ∧ non-UUID plaintext → Vault; empty leave `''`; UUID skip |
| Failures on save | Surface error; do not fall back to plaintext write |

## Architecture

```
Settings UI / sync
        │
        ▼
getJiraSettings / saveJiraSettings  (service_role client)
        │
        ▼
momus_get_jira_token / momus_set_jira_token
        │
        ▼
vault.decrypted_secrets / vault.create_secret|update_secret
```

| Piece | Responsibility |
|---|---|
| Migration | Enable `supabase_vault`; create helpers; one-time plaintext migrate |
| `packages/infra/.../settings.ts` | Call RPCs for token get/set; other Jira keys unchanged |
| Tests | Mask/parse unchanged; typecheck |

## Data flow

**Save:** parse body (masked → keep prior decrypted token) → `momus_set_jira_token(plaintext)` → upsert non-secret keys → audit with `toPublicJiraConnection`.

**Load:** load non-secret keys from `settings` + `momus_get_jira_token()` for `apiToken`.

**Migrate (SQL once):** for current `jira_api_token` value matching migrate rule A, `create_secret` and replace value with UUID.

## Errors

| Case | Behavior |
|---|---|
| Set/get RPC fails | Throw to caller (HTTP 5xx on save) |
| Empty settings value | Get returns `''` (unconfigured) |
| Orphan UUID (secret missing) | Get returns `''`; server may log |
| Non-service_role execute | Permission denied |

## Testing / done when

- [ ] After migrate, `settings.jira_api_token` is UUID or empty — not plaintext token  
- [ ] `getJiraSettings` returns usable token for Jira client via service role  
- [ ] Public APIs still mask token  
- [ ] `@momus/infra` / `@momus/web` typecheck  
- [ ] Existing settings unit tests pass  

## Traceability

| Ref | Coverage |
|---|---|
| DEV-9 / BB-NFR-04 | Encrypted at rest |
| AC-9 | Token encryption requirement |
| Security rules | Mask in UI/API; no token logs |
