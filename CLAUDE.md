# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bay View Association administrative system — chapel services and memorial garden applications for a 150-year-old National Historic Landmark Chautauqua community in Petoskey, Michigan. Notion is the system of record (data + workflow), APIs on Vercel, forms on GitHub Pages.

> **SharePoint mirror (2026-09):** every accepted submission (chapel, memorial garden, preacher recommendation) is also written to the SharePoint list **Worship Applications** on `/sites/worship` via `lib/sharepoint.js` — Microsoft Graph with `GRAPH_*` env vars: delegated refresh-token mode when `GRAPH_REFRESH_TOKEN` is set (user-consented scopes, no tenant admin required — the mode in use, since we are not tenant admins), else app-only client credentials (needs admin-consented `Sites.ReadWrite.All`). Notion stays the system of record; a SharePoint failure is returned as `sharepoint: {ok:false,…}` in the response and never fails the request. This is the first step of moving the worship data out of Notion into SharePoint lists.

> **Data backend status (2026-06):** PostgreSQL has been decommissioned — it is gone. Notion is now the sole system of record. The `DATABASE_URL` env var is dead (local config holds a stale, non-resolving string; production has no `DATABASE_URL` at all). Do NOT write code that connects to PostgreSQL or assumes a dual-write. Much of the PostgreSQL-specific reference below (schemas, connection pattern, `npm run` db commands) is retained for historical context only and is non-operative. See **Data Backend** below.

### Domain Context
- **Leaseholding, not ownership** — Properties use perpetual leases, not deeds
- **Block & Lot system** — Properties identified as "Block 12 Lot 7"
- **Member sponsorship required** — Non-members need member sponsors for events
- Use authentic Bay View terminology (leaseholder not owner, etc.)

## CRITICAL: Unified API Pattern

Due to Vercel's 12-function hobby plan limit:
- **Only ONE file in `/api/`**: `index.js` — the unified router
- **ALL handlers go in `/lib/api/` or `/lib/handlers/`** with subdirectories by feature
- **ALL routes registered in `/api/index.js`**

```bash
# ❌ WRONG: Creates separate function — will break deployment
touch api/my-endpoint.js

# ✅ CORRECT: Handler in lib, registered in router
touch lib/api/my-feature/my-endpoint.js
# Then import and add to routes object in /api/index.js

# Verify: must always output 1
ls api/*.js | wc -l
```

Read `API-ARCHITECTURE.md` and `CONTRIBUTING.md` before making API changes.

## Common Commands

```bash
npm run dev                    # Vercel dev server (hot reload)
npm run test-connection        # Test PostgreSQL connectivity
npm run pre-commit             # validate-constraints + lint + typecheck
npm run validate               # Validate configuration system
npm run smoke                  # Smoke check (scripts/diagnostic/smoke-check.js)
npm run health-check           # curl production /api/health
npm run deploy                 # Deploy to Vercel

# Database initialization
npm run init-chapel-db         # Chapel service tables
npm run init-forms-db          # Forms registry tables
npm run init-memorial-db       # Memorial garden tables

# Test submissions
npm run test-chapel-submission
npm run test-memorial-submission
npm run check-submissions      # Check recent submissions

# Forms management
npm run insert-forms / list-forms / check-duplicates / forms-summary
```

Note: `lint` and `typecheck` are currently placeholder echo commands.

## Architecture

### Handler Locations (two directories, both valid)
- `/lib/handlers/` — Chapel and admin handlers (older convention)
- `/lib/api/` — Memorial, config, diagnostic, health handlers (newer convention)
- Both are imported by `/api/index.js` — check actual imports there for the source of truth

### Shared Utilities (`/lib/`)
- `db.js` — `createPgClient()`, `withDatabase()`, `withTransaction()`
- `db-pool.js` — Connection pooling
- `cors.js` — `applyCors()`, `withCors()`
- `notion.js` — `createNotionPage()`, `toNotionProperty()`
- `error-tracking.js` — Error tracking utilities
- `database/dual-write-manager.js` — Legacy dual-write manager (PostgreSQL leg is dead; Notion write is the only one that lands)

### Storage Pattern (Notion-only)
Submissions persist to **Notion only** — it is the system of record for both data and workflow. New features save to Notion. (Historically this was a dual-write to PostgreSQL + Notion; the PostgreSQL leg has been decommissioned and any remaining dual-write code paths no-op or fail closed on the PG side.)

### Database Schemas
- `bayview.*` — Memorial garden, forms management
- `crouse_chapel.*` — Chapel service applications
- `core.*` — Unified persons, members, committees
- `property.*` — Block/lot system with leaseholds
- `finance.*` — Accounts, transactions, payments
- `events.*` — Programs, facilities, bookings
- `config.*` — Runtime configuration with audit trail
- `migration.*` — Schema version tracking

### Critical Schema Gotchas
- `members` uses `membership_type` (NOT `member_type`), no `good_standing` column
- `persons` has `person_type` (NOT `person_status`), no `is_active` column
- No unique constraint on committee names — check existence before insert
- `btree_gist` extension required for exclusion constraints
- All timestamps: `TIMESTAMP WITH TIME ZONE`

### Data Backend: Notion-only
- **Oracle** — removed (commit `07aa612`).
- **PostgreSQL** — decommissioned (2026-06). No longer provisioned anywhere: local `DATABASE_URL` is a stale, non-resolving string and production has no `DATABASE_URL`/`DATABASE_URL_CLEAN`. The only live production data var is `NOTION_API_KEY`.
- **Notion is the sole system of record.** All reads and writes go through Notion. Do not attempt PostgreSQL connections; `npm run test-connection`, the `init-*-db` scripts, and the connection pattern below are non-operative historical artifacts.

## Key File Locations

| What | Where |
|------|-------|
| API router (ONLY file in api/) | `api/index.js` |
| Handler modules | `lib/handlers/` and `lib/api/` |
| Migrations | `scripts/migrations/00X_*.sql` |
| Test/utility scripts | `scripts/` |
| HTML forms (GitHub Pages) | `forms/` |
| Documentation | `docs/` |

## Environment Variables

```bash
NOTION_API_KEY          # Notion integration key (system of record)
CHAPEL_NOTION_DB_ID     # Chapel Notion database
MEMORIAL_NOTION_DB_ID   # Memorial garden Notion database
ADMIN_TOKEN             # Admin endpoint authentication
SENDGRID_API_KEY        # Outbound email

# DEFUNCT — PostgreSQL is gone. These are no longer set in production and any
# value present locally is stale/non-resolving. Do not rely on them.
# DATABASE_URL          # (dead) PostgreSQL with ?sslmode=require
# DATABASE_URL_CLEAN    # (dead) PostgreSQL without SSL params
```

## Database Connection Pattern (DEFUNCT — historical only)

> PostgreSQL is gone (2026-06). The pattern below no longer applies; there is no database to connect to. Retained only to explain legacy code you may encounter. New code must use Notion (`lib/notion.js`).

```javascript
// HISTORICAL — does not work; no live PostgreSQL backend exists.
const pgClient = new Client({
  connectionString: DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});
```

## CORS

Allowed origins: `https://bvaadmin.github.io`, `https://vercel.com`, `http://localhost:3000`, `http://127.0.0.1:5500`. The unified router in `api/index.js` applies CORS globally and handles OPTIONS preflight.

## Common Pitfalls

- **"Function limit exceeded"**: You created a file in `/api/`. Move to `/lib/api/` and register in router.
- **404 on new endpoint**: Forgot to register route in `/api/index.js` routes object.
- **SQL quote escaping**: Use `'Women''s Council'` not `"Women's Council"`
- **Vercel timeout**: 10s max (`vercel.json` maxDuration setting)
- **Environment variables**: Use `DATABASE_URL.replace('?sslmode=require', '')` pattern

## Testing

No test framework. Testing is done via custom scripts in `scripts/`, direct database queries, and manual API testing. Run `npm run dev` locally, then test with scripts or curl.

## Deployment

- APIs: Vercel (auto-deploy)
- Forms: GitHub Pages (push to main)
- Data store: Notion (DigitalOcean PostgreSQL decommissioned 2026-06)
- Cron: Daily email batch at midnight (`/api/email/send-batch` via `vercel.json`)

## Business Rules

- Chapel form types: `wedding` or `memorial-funeral-service`
- Chapel fees: $300 (members) / $750 (non-members)
- Service date/time uniqueness enforced by DB constraint
- Availability checking includes blackout dates and 2-hour buffer
- Clergy approval workflow: `pending` → `approved` / `rejected`
- Memorial garden records are permanent historical records
