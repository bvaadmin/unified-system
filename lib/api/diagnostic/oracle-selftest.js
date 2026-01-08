import { applyCors } from '../../cors.js';

// Oracle diagnostics disabled (Notion-only backend)
export default async function handler(req, res) {
  applyCors(req, res, ['POST', 'OPTIONS']);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return res.status(410).json({
    error: 'Oracle diagnostics disabled',
    message: 'Oracle support has been removed; unified-system uses a Notion-only backend.'
  });
}

