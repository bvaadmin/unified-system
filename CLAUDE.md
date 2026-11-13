# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Bay View Association's worship web forms (Crouse Chapel applications, Memorial Garden placements and prepayments, Visiting Preacher Recommendations). The forms are static pages on GitHub Pages (`forms/`); each one posts to a small API on Vercel, which saves the submission as an item in a SharePoint List on the Worship site (`bayviewassociation.sharepoint.com/sites/worship`). The Lists are the system of record.

Notion, PostgreSQL, Oracle and SendGrid are retired: no code path or Vercel setting uses them. The forms send no email; applicant confirmations and office alerts are an open item (handoff tracker F7).

## API

Vercel's hobby plan allows few functions, so `api/index.js` is the only function. It applies CORS for every route, answers OPTIONS, and dispatches by `METHOD /path`:

| Route | Handler | List |
|---|---|---|
| `POST /api/chapel/submit-service` | `lib/handlers/chapel/submit-service.js` | Chapel Services |
| `POST /api/memorial/submit-garden` | `lib/api/memorial/submit-garden.js` | Memorial Garden Applications |
| `POST /api/preachers/submit-recommendation` | `lib/api/preachers/submit-recommendation.js` | Visiting Preacher Recommendations |
| `GET /api/health` | `lib/api/health.js` | none (reports whether the Graph settings exist) |

To add an endpoint, put the handler under `lib/` and register it in the `routes` object. Never add files to `api/`.

`lib/sharepoint.js` holds the Graph client, the List ids (`WORSHIP_LISTS`), field helpers (`spText`, `spNote`, `spDate`, `spNumber`, `spChoice`) and `saveSubmission`, which throws if the item is not saved so the form shows the applicant an error.

## Conventions

- List column internal names are PascalCase (Chapel "Type" is `ServiceType`). Check a List's columns before writing a new field; Graph rejects unknown columns and off-list choice values.
- Date-only values are written at 12:00 UTC on the intended day (`spDate`) so they show as that day in Michigan.
- Item titles are readable ("Wedding: Bethany Drier and Mikah Hobson, 7/7/2028", "James Lynn Frick (placement)"); the form's code (`CHAPEL-…`, `MG-…`, `PREACHER-…`) goes in the `SubmissionID` / `RecommendationID` column, because applicants are told to quote it with payment.
- Memorial Garden person details (birth and death dates, place of birth, maiden name, parents, second person) have their own columns; the old `PersonalHistoryJSON` / `OtherPersonJSON` columns hold only pre-November 2026 data.
- Fees live in the chapel handler: wedding $300 member / $750 non-member; vow renewal $225 / $560 (3/4 of the wedding fee); baptism $75 / $150 chapel-use fee; memorial $150 / $325; general use set by staff.

## Environment (Vercel production)

```
GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET   # app registration "Worship Forms – SharePoint Access"
SHAREPOINT_SITE_URL                                       # optional; defaults to the Worship site
```

The app has Microsoft Graph `Sites.Selected` with a Write grant on the Worship site only. The client secret expires 2027-10-27; renew it through Zach and Centaris, then replace `GRAPH_CLIENT_SECRET` in Vercel and redeploy (Vercel reads env vars only at deploy time). `scripts/sharepoint/diagnose.mjs` prints the token's claims and the result of each Graph step (`op run --env-file=<refs> -- node scripts/sharepoint/diagnose.mjs --write`).

## Deploying

- API: push to `main` of `bvaadmin/unified-system`; Vercel deploys it. Pushing needs the bvaadmin GitHub account.
- Forms: the same push publishes `forms/` to GitHub Pages.
- There is no test suite. Test a change with a stubbed `fetch` against the handlers, then one live submission per affected form, and delete the test items from the List afterwards.
