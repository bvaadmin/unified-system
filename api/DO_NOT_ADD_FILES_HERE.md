# ⛔ STOP! DO NOT ADD FILES TO THIS DIRECTORY

## Only `index.js` should exist in `/api/`

Due to Vercel's 12-function limit, all API endpoints must be routed through the single unified handler in `index.js`.

### To add a new endpoint:

1. Create your handler in `/lib/api/`
2. Import it in `/api/index.js`
3. Add it to the routes object

### Why?
- Each .js file in `/api/` becomes a separate Vercel function
- We're limited to 12 functions on the hobby plan
- Having more will cause deployment to fail

See [API-ARCHITECTURE.md](../API-ARCHITECTURE.md) for full details.