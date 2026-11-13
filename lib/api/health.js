// GET /api/health: reports whether the SharePoint settings are present.
// It does not call Graph; scripts/sharepoint/diagnose.mjs does the full check.
// CORS and OPTIONS are handled by the router in api/index.js.

import { isSharePointConfigured } from '../sharepoint.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sharePoint = isSharePointConfigured();
  return res.status(sharePoint ? 200 : 503).json({
    status: sharePoint ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    checks: {
      api: 'ok',
      sharePoint: sharePoint ? 'configured' : 'GRAPH_TENANT_ID, GRAPH_CLIENT_ID or GRAPH_CLIENT_SECRET is missing'
    }
  });
}
