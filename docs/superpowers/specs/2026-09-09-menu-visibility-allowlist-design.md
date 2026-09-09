# Menu visibility (multi-module + allowlist) — Design Spec

**Date:** 2026-09-09  
**Status:** Draft for review (awaiting user sign-off)  
**Depends on:** PR #50 / `show_defect_analytics` hard-hide for Defect Analytics  
**Scope:** Extend Menu visibility to Defect Analytics, Defect Tracker, Leaderboard, and Bug Budget, with a shared user allowlist exception

## Goal

Let an admin hide any of the four product menus for everyone, while optionally keeping them visible to a shared allowlist of approved users. Hidden modules are hard-hidden (nav, page redirect, product APIs 403). Settings and Users stay reachable so the kill switch can be undone.

## Non-goals (v1)

- Per-menu allowlist overrides (hybrid later; v1 = one shared `allowlist_user_ids`)
- Hiding Executive Report, Settings, or Users
- Soft / nav-only hide
- Changing permission keys (`view_analytics`, etc.) — visibility is orthogonal to permissions
- Env-only kill switch

## Decisions (approved)

| Topic | Choice |
|---|---|
| Storage | `menu_visibility` block on existing `analytics_settings` |
| Modules | Defect Analytics, Defect Tracker, Leaderboard, Bug Budget |
| Allowlist | Shared only in v1; approved Momus users |
| Hide strength | Hard hide for all four |
| Landing when hidden | Walk `APP_ROUTES` order; skip hidden (unless allowlisted); else Settings if permitted; else `/no-access` |
| Settings UI | Settings → Analytics → Menu visibility card |
| Compat | Map legacy `show_defect_analytics` → `menu_visibility.defect_analytics` on read |

## Data model

```ts
menu_visibility: {
  defect_analytics: boolean; // default true
  defect_tracker: boolean;   // default true
  leaderboard: boolean;      // default true
  bug_budget: boolean;       // default true
  allowlist_user_ids: number[]; // default []
}
```

**Normalize / fail-open**

- Missing `menu_visibility` → all four `true`, allowlist `[]`
- If only legacy `show_defect_analytics` is present → use it for `defect_analytics`, others `true`
- Settings load failure → treat all modules as shown (`true`)
- Invalid allowlist entries dropped; only finite positive integers kept
- On save, persist `menu_visibility` and stop writing `show_defect_analytics`

**Effective visibility** for module `M` and user `U`:

```
visible(M, U) =
  menu_visibility[M] === true
  || allowlist_user_ids.includes(U.id)
```

Allowlist does **not** grant permissions. A user still needs the route permission. Allowlist only bypasses the hide.

## Settings UI

**Settings → Analytics → Menu visibility**

1. Four checkboxes (checked = shown to everyone with permission):
   - Show Defect Analytics  
   - Show Defect Tracker  
   - Show Leaderboard  
   - Show Bug Budget  
2. When **any** checkbox is unchecked, show:
   - Label: **Hide from everyone — still show to selected users**
   - Multi-select checklist of approved users (name + email)
   - Data source: a narrow picker endpoint callable with `access_settings` (e.g. `GET /api/settings/analytics/allowlist-candidates` or extend an existing settings-safe route) returning `{ id, name, email }[]` for `status=approved` only. Do **not** require `manage_users` to edit menu visibility — Settings admins must be able to set the exception list.
3. Helper copy: Hidden modules leave the nav; pages redirect; product APIs return 403. Allowlisted users still see them if they have permission. This settings area stays available.

Empty allowlist + unchecked module = hidden for all non-allowlisted users.

After successful save, call `reloadMe()` so the admin’s own nav updates without a hard refresh.

## Architecture

```
Settings → Analytics (menu_visibility)
        │
        ▼
analytics_settings.menu_visibility
        │
        ├── /api/me → flags.show_* (effective for current user)
        ├── AppHeader (filter nav + brand = first visible product route)
        ├── landingPathFor(permissions, effectiveFlags)
        └── Per-module page + product API gates (403 / redirect)
```

Never gate: `/api/settings/*`, `/api/users*` (admin), `/api/me`, `/api/auth/*`, `/api/health*`.

## `/api/me` flags

```ts
flags: {
  show_defect_analytics: boolean;
  show_defect_tracker: boolean;
  show_leaderboard: boolean;
  show_bug_budget: boolean;
}
```

Each value is `visible(module, currentUser)` with fail-open `true`.

## Nav and brand

- Omit nav items whose effective flag is false (permission filter still applies).
- Brand “Momus” href = first visible product route in `APP_ROUTES` order for this user; if none, `/settings/atlassian` when they have `access_settings`, else `/no-access`.

## Landing

`landingPathFor(permissions, flags)` walks `APP_ROUTES` in order, skips routes whose flag is false, returns first permission match, else `/no-access`.

Wire into `requirePagePermission`, leaderboard error redirect, and auth callback default `next` (same pattern as PR #50).

## Hard-hide matrix

When effective flag is false for the requesting user:

| Module | Pages | Product APIs (403) |
|---|---|---|
| Defect Analytics | `/`, `/analytics` → landing | `GET /api/analytics`, `/period-detail`, `/export/csv` |
| Defect Tracker | `/tracker` → landing | `GET /api/tracker`, `/api/tracker/[jiraKey]`, related tracker read APIs used by the page (not settings) |
| Leaderboard | `/leaderboard` → landing | `GET /api/leaderboard`, `/api/leaderboard/reporter-issues` |
| Bug Budget | `/bug-budget`, `/bug-budget/[id]` → landing | `GET /api/bug-budget`, `/[id]`, `/export/csv`, open-bug/defect summaries |

Pages redirect for UX; APIs return `{ success: false, message: '… is disabled' }` with 403.

Shared helper: generalize `loadShowDefectAnalytics` into menu-visibility resolution (e.g. `getMenuVisibilityFlags(userId)` + `assertModuleVisible(module)`).

## Error handling

- Settings load failure → fail-open (all shown)
- Allowlist references deleted users → ignore on evaluate; optionally prune on next settings save
- Admin hides every product module and is not on allowlist → lands on Settings (if permitted) or `/no-access`; Settings → Analytics remains reachable for users with `access_settings`

## Testing

- Defaults / missing key → all four shown
- Legacy `show_defect_analytics: false` maps correctly
- Module false + empty allowlist → nav omit, page redirect, API 403 for normal user
- Module false + user on allowlist → visible if permission held; APIs 200
- Module false + user on allowlist but missing permission → still denied by permission gate
- Multiple modules hidden → landing skips them in order
- All product modules hidden → Settings or `/no-access`
- Settings analytics GET/POST never 403’d by these flags
- `reloadMe` after save updates flags for the saving admin

## Out of scope follow-ups

- Per-menu `allowlist_user_ids` overrides
- Hide Executive Report
- Audit log dedicated entry for menu visibility (settings audit already covers analytics_settings writes)
