# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bay View Association administrative system — chapel services and memorial garden applications for a 150-year-old National Historic Landmark Chautauqua community in Petoskey, Michigan. PostgreSQL for data storage, Notion for workflow management, APIs on Vercel, forms on GitHub Pages.

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
- `database/dual-write-manager.js` — Dual-write to PostgreSQL + Notion

### Dual Storage Pattern
All submissions write to both PostgreSQL (queries/constraints) and Notion (workflow management). New features must save to both systems.

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

### Oracle: Disabled
Oracle support was removed (commit `07aa612`). The backend is Notion-only for workflow. PostgreSQL remains the primary data store.

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
DATABASE_URL            # PostgreSQL with ?sslmode=require
DATABASE_URL_CLEAN      # PostgreSQL without SSL params
NOTION_API_KEY          # Notion integration key
CHAPEL_NOTION_DB_ID     # Chapel Notion database
MEMORIAL_NOTION_DB_ID   # Memorial garden Notion database
ADMIN_TOKEN             # Admin endpoint authentication
```

## Database Connection Pattern

```javascript
const pgClient = new Client({
  connectionString: DATABASE_URL.replace('?sslmode=require', ''),
  ssl: { rejectUnauthorized: false }
});
```

Always call `client.end()` in finally blocks. Use `ssl: { rejectUnauthorized: false }` for DigitalOcean PostgreSQL.

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
- Database: DigitalOcean PostgreSQL
- Cron: Daily email batch at midnight (`/api/email/send-batch` via `vercel.json`)

## Business Rules

- Chapel form types: `wedding` or `memorial-funeral-service`
- Chapel fees: $300 (members) / $750 (non-members)
- Service date/time uniqueness enforced by DB constraint
- Availability checking includes blackout dates and 2-hour buffer
- Clergy approval workflow: `pending` → `approved` / `rejected`
- Memorial garden records are permanent historical records
