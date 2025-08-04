# API Architecture - IMPORTANT: Read Before Adding New Endpoints

## 🚨 Critical: We Use a Unified API Pattern

**DO NOT create new files in the `/api` directory!**

Due to Vercel's hobby plan limit of 12 serverless functions, all API endpoints are routed through a single unified handler at `/api/index.js`.

## How to Add a New API Endpoint

### 1. Create Your Handler
Place your handler file in the appropriate subdirectory under `/lib/api/`:

```
/lib/api/
  ├── memorial/
  │   └── submit-garden.js
  ├── chapel/
  │   ├── submit-service.js
  │   └── check-availability.js
  ├── admin/
  │   └── db-init.js
  └── your-new-handler.js
```

### 2. Import in the Unified Router
Edit `/api/index.js` to add your handler:

```javascript
// Import your handler
import yourHandler from '../lib/api/your-new-handler.js';

// Add to the routes object
const routes = {
  // Existing routes...
  'GET /api/your-endpoint': yourHandler,
  'POST /api/your-endpoint': yourHandler,
};
```

### 3. Handler Template
Your handler should follow this pattern:

```javascript
import { applyCors } from '../cors.js';
import { createPgClient } from '../db.js';

export default async function handler(req, res) {
  // Apply CORS (handled by unified router, but can be redundant)
  applyCors(req, res);
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') { // or POST, PUT, etc.
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Your logic here
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

## Why This Pattern?

1. **Vercel Limit**: Hobby plan allows only 12 functions, we have 20+ endpoints
2. **Cost**: Upgrading to Pro plan costs $20/month per user
3. **Simplicity**: All routing logic in one place
4. **Performance**: Single function deployment is faster

## Common Mistakes to Avoid

❌ **DON'T**: Create files directly in `/api/`
```bash
# This will cause deployment to fail!
touch api/my-new-endpoint.js
```

❌ **DON'T**: Forget to update the routes object
```javascript
// Handler exists but not routed = 404 error
import myHandler from '../lib/api/my-handler.js';
// Forgot to add to routes object!
```

❌ **DON'T**: Use incorrect import paths
```javascript
// Wrong - assumes file is in api/
import { applyCors } from '../lib/cors.js';

// Correct - file is in lib/api/
import { applyCors } from '../cors.js';
```

## Testing Your Endpoint

1. **Local Testing**:
```bash
npm run dev
curl http://localhost:3000/api/your-endpoint
```

2. **Check Function Count**:
```bash
# Should always be 1
ls -la api/*.js | wc -l
```

3. **Deploy**:
```bash
vercel --prod
```

## Current Endpoints (August 2025)

All these routes are handled by `/api/index.js`:

- `GET /api/health` - System health check
- `GET /api/test-db` - Database connectivity test
- `POST /api/memorial/submit-garden` - Memorial garden submissions
- `POST /api/chapel/submit-service` - Chapel service applications
- `GET /api/chapel/check-availability` - Chapel availability
- `POST /api/admin/*` - Various admin endpoints

## Questions?

If you're unsure about the architecture:
1. Check existing patterns in `/api/index.js`
2. Look at handlers in `/lib/api/` for examples
3. Run `npm run lint` before committing
4. Test thoroughly - deployment failures affect all endpoints!

## Remember

**One function to rule them all!** 🧙‍♂️

Every API request goes through `/api/index.js` - keep it that way to stay within Vercel's limits.