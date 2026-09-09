# Defect Analytics menu visibility — Design Spec

**Date:** 2026-09-09  
**Status:** Approved for planning  
**Scope:** Global admin toggle to show/hide Defect Analytics (nav + hard block)

## Goal

Let an admin hide Defect Analytics for everyone from Settings → Analytics. When hidden, the nav item disappears, `/` and `/analytics` send users to `/bug-budget`, and dashboard read/export APIs return 403 until the flag is turned back on.

## Non-goals

- Per-user preference
- Env-only kill switch (no Settings UI)
- Hiding Settings → Analytics (must stay reachable to re-enable)
- Changing Tracker, Leaderboard, or Executive Report visibility
- Menu-visibility system for every nav item (Defect Analytics only)

## Decisions (approved)

| Topic | Choice |
|---|---|
| Who controls it | Global admin setting, Settings → Analytics |
| Storage | `show_defect_analytics` on existing `analytics_settings` JSON |
| Default | `true` (current prod behavior unchanged) |
| Hide strength | Hard hide: nav + page redirect + dashboard API 403 |
| Settings when hidden | Stay open (toggle, thresholds, digest) |
| Redirect target | `/bug-budget` |
| Client flag source | Extend `/api/me` with app flags |

## Data model

Add to `AnalyticsSettings` in `packages/infra`:

```ts
show_defect_analytics: boolean; // default true
```

- Persist in the existing `analytics_settings` config blob
- Missing key on read → treat as `true`
- Settings → Analytics checkbox, e.g. “Show Defect Analytics in navigation”
- Helper copy: when off, users land on Bug Budget and dashboard APIs return 403
- Save path: existing `GET|POST /api/settings/analytics` (permission `access_settings`)

## Architecture

```
Settings → Analytics (toggle)
        │
        ▼
analytics_settings.show_defect_analytics
        │
        ├── /api/me → flags.show_defect_analytics → AppHeader (filter nav, brand href)
        ├── landingPathFor(permissions, flags) → skip `/` when off
        ├── GET /  and GET /analytics → redirect /bug-budget when off
        └── GET /api/analytics{,/period-detail,/export/csv}
              → 403 when off
```

`/api/settings/analytics` is never gated by this flag.

## Nav, landing, redirects

When `show_defect_analytics` is `false`:

| Surface | Behavior |
|---|---|
| Header nav + Menu panel | Omit “Defect Analytics” |
| Brand “Momus” link | `/bug-budget` |
| `GET /` | Server `redirect('/bug-budget')` |
| `GET /analytics` | Same redirect (already aliases home) |
| `landingPathFor` | Skip `/`; for `view_analytics` prefer `/bug-budget` over Tracker |

When the flag is `true`, behavior matches today (`/` is Defect Analytics, brand points to `/`).

## API hard-hide

Shared helper (e.g. `assertDefectAnalyticsEnabled()`) after auth on:

- `GET /api/analytics`
- `GET /api/analytics/period-detail`
- `GET /api/analytics/export/csv`

Response when disabled: **403** `{ success: false, message: "…" }` (same envelope as other denials).

Pages redirect for UX; APIs 403 so export/bookmarks cannot succeed silently.

## Components / files (expected touch list)

| Area | Change |
|---|---|
| `packages/infra` analytics settings | Field + default + load/save validation |
| Settings Analytics tab | Checkbox + save |
| `/api/me` + `useMe` | Expose `flags.show_defect_analytics` |
| `AppHeader` | Filter route; brand href |
| `landing-path` / homepage / `/analytics` | Redirect / skip `/` when off |
| Analytics API routes | Call assert helper |
| Tests | Default on; flag off covers nav, landing, redirect, 403, settings still OK |

## Error handling

- If settings cannot be loaded, **fail-open to `true`** (module stays visible). Only an explicit saved `false` hides it. A DB blip must not blank the nav or 403 the dashboard.
- Saving `show_defect_analytics: false` must succeed even while dashboard APIs are blocked.

## Testing

- Default / missing key → visible, `/` works, APIs 200 (auth permitting)
- Flag `false` → nav omits item, brand → bug-budget, `/` and `/analytics` redirect, three APIs 403
- Flag `false` → Settings analytics GET/POST still succeed
- Flag flipped back to `true` → full restore without redeploy

## Out of scope follow-ups

- Generic menu-visibility admin for all `APP_ROUTES`
- Audit log entry for this toggle (nice-to-have; not required for v1)
