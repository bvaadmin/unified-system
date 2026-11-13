/**
 * SharePoint Lists client — app-only Microsoft Graph writer for the worship
 * site (bayviewassociation.sharepoint.com/sites/worship).
 *
 * The four form-fed Notion databases were copied to Lists on 2026-10-23;
 * this module lets the form handlers write new submissions to those Lists.
 * Column internal names are PascalCase versions of the Notion property names
 * (Chapel "Type" is ServiceType).
 *
 * Auth is the client-credentials grant against the Centaris app registration
 * "Worship Forms – SharePoint Access": Microsoft Graph Sites.Selected, with a
 * Write grant on the worship site only. The secret expires 2027-10-27; renew
 * through Zach and Centaris, then replace GRAPH_CLIENT_SECRET in Vercel.
 * scripts/sharepoint/diagnose.mjs checks the token and each Graph step.
 *
 * Env:
 *   GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET   (all required)
 *   SHAREPOINT_SITE_URL   default: worship site
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const LOGIN_BASE = 'https://login.microsoftonline.com';

export const DEFAULT_SITE_URL = 'https://bayviewassociation.sharepoint.com/sites/worship';

/** List ids on the worship site, created 2026-10-23. */
export const WORSHIP_LISTS = {
  chapel: '8138db27-2614-49a6-bde2-7b3cd7caf790',
  memorialGarden: 'e287b309-9d0f-4fb9-a09e-ac0a386aa8d5',
  preacherRecommendations: '4426f849-a143-4de2-a0f6-024e0bec5193',
  altarFlowers: '915c8ba9-9cc3-431c-82e6-0006cf7f414b'
};

// maxDuration is 10s and the Notion write plus email share the request.
const REQUEST_TIMEOUT_MS = 6000;
const TOKEN_REFRESH_MARGIN_S = 60;
// Single-line text columns reject anything over 255 characters; note
// columns hold far more, but keep payloads sane.
const TEXT_LIMIT = 255;
const NOTE_LIMIT = 60000;

// Warm function instances reuse these; a cold start refetches.
let tokenCache = { value: null, expiresAt: 0 };
const siteIdCache = new Map();

export function getSharePointConfig(env = process.env) {
  const tenantId = env.GRAPH_TENANT_ID;
  const clientId = env.GRAPH_CLIENT_ID;
  const clientSecret = env.GRAPH_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    return null;
  }
  return {
    tenantId,
    clientId,
    clientSecret,
    siteUrl: env.SHAREPOINT_SITE_URL || DEFAULT_SITE_URL
  };
}

export function isSharePointConfigured(env = process.env) {
  return getSharePointConfig(env) !== null;
}

async function fetchWithTimeout(url, init = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readError(response) {
  const text = await response.text().catch(() => '');
  try {
    const json = JSON.parse(text);
    const code = json?.error?.code || json?.error;
    const message = json?.error?.message || json?.error_description || text;
    return `${response.status} ${code ? `${code}: ` : ''}${String(message).split('\r\n')[0]}`;
  } catch {
    return `${response.status} ${text}`.trim();
  }
}

export async function getAccessToken(config) {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache.value && tokenCache.expiresAt - TOKEN_REFRESH_MARGIN_S > now) {
    return tokenCache.value;
  }

  const response = await fetchWithTimeout(`${LOGIN_BASE}/${config.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    })
  });
  if (!response.ok) {
    throw new Error(`Graph token request failed: ${await readError(response)}`);
  }

  const data = await response.json();
  tokenCache = { value: data.access_token, expiresAt: now + Number(data.expires_in || 3600) };
  return tokenCache.value;
}

async function graphRequest(config, method, path, body) {
  const token = await getAccessToken(config);
  const response = await fetchWithTimeout(`${GRAPH_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    throw new Error(`Graph ${method} ${path} failed: ${await readError(response)}`);
  }
  return response.status === 204 ? null : response.json();
}

export async function resolveSiteId(config) {
  const cached = siteIdCache.get(config.siteUrl);
  if (cached) {
    return cached;
  }
  const url = new URL(config.siteUrl);
  const site = await graphRequest(config, 'GET', `/sites/${url.hostname}:${url.pathname.replace(/\/$/, '')}?$select=id`);
  siteIdCache.set(config.siteUrl, site.id);
  return site.id;
}

export async function createListItem(config, listId, fields) {
  const siteId = await resolveSiteId(config);
  return graphRequest(config, 'POST', `/sites/${siteId}/lists/${listId}/items`, { fields });
}

export async function deleteListItem(config, listId, itemId) {
  const siteId = await resolveSiteId(config);
  return graphRequest(config, 'DELETE', `/sites/${siteId}/lists/${listId}/items/${itemId}`);
}

// ---- Field helpers --------------------------------------------------------

/** Single-line text: trimmed, capped at 255, undefined when empty. */
export function spText(value, limit = TEXT_LIMIT) {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s ? s.slice(0, limit) : undefined;
}

/** Multi-line (note) text. */
export function spNote(value) {
  return spText(value, NOTE_LIMIT);
}

/**
 * Date or datetime. A date-only value is written at 12:00 UTC so it shows as
 * the same calendar day in Eastern time (midnight UTC displays as the day
 * before), matching the rows copied from Notion.
 */
export function spDate(value) {
  if (!value) return undefined;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T12:00:00Z`;
  const d = new Date(s.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function spNumber(value) {
  const n = Number(value);
  return value === '' || value === null || value === undefined || !Number.isFinite(n) ? undefined : n;
}

/**
 * Choice columns reject values outside their choice list, which would fail
 * the whole item. Returns the value only when it is one of `choices`.
 */
export function spChoice(value, choices) {
  const s = spText(value);
  return s && choices.includes(s) ? s : undefined;
}

/** Drop undefined fields so Graph does not see them. */
export function compactFields(fields) {
  for (const key of Object.keys(fields)) {
    if (fields[key] === undefined) delete fields[key];
  }
  return fields;
}

/**
 * Write one item to a worship List.
 *
 * Never throws. Returns:
 *   { ok: true, id, webUrl }     item created
 *   { ok: false, skipped: true } Graph env vars not set
 *   { ok: false, error }         Graph rejected the write or timed out
 */
export async function saveListItem(listId, fields, env = process.env) {
  const config = getSharePointConfig(env);
  if (!config) {
    return { ok: false, skipped: true };
  }
  try {
    const item = await createListItem(config, listId, compactFields({ ...fields }));
    return { ok: true, id: item.id, webUrl: item.webUrl };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Save a submission to the SharePoint List and to Notion, in parallel.
 *
 * Until Notion goes away both are written; a failure in either is logged and
 * the submission still succeeds as long as one store accepted it. When Graph
 * is not configured, Notion is the only store and its failure fails the
 * request (the pre-SharePoint behavior).
 *
 * @param {Object} opts
 * @param {string} opts.label           for logs, e.g. the submission id
 * @param {string} opts.listId
 * @param {Object} opts.fields          List item fields
 * @param {() => Promise<Object>} [opts.notion]  creates the Notion page; omit to skip Notion
 * @returns {Promise<{sharePoint: Object, notion: Object|null, notionError: string|null}>}
 * @throws when no store accepted the submission
 */
export async function saveSubmission({ label, listId, fields, notion }) {
  const [sp, nt] = await Promise.allSettled([
    saveListItem(listId, fields),
    notion ? notion() : Promise.resolve(null)
  ]);

  const sharePoint = sp.value;
  const notionPage = nt.status === 'fulfilled' ? nt.value : null;
  const notionError = nt.status === 'rejected' ? nt.reason?.message || String(nt.reason) : null;

  if (sharePoint.ok) {
    console.log(`${label} saved to SharePoint item ${sharePoint.id}`);
  } else if (!sharePoint.skipped) {
    console.error(`${label} SharePoint write failed: ${sharePoint.error}`);
  }
  if (notionPage) {
    console.log(`${label} saved to Notion ${notionPage.id}`);
  } else if (notionError) {
    console.error(`${label} Notion write failed: ${notionError}`);
  }

  if (!sharePoint.ok && !notionPage) {
    throw new Error(
      sharePoint.skipped
        ? notionError || 'No storage configured'
        : `SharePoint: ${sharePoint.error}; Notion: ${notionError || 'not attempted'}`
    );
  }
  return { sharePoint, notion: notionPage, notionError };
}
