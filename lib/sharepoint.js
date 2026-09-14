/**
 * SharePoint writer — app-only Microsoft Graph client for the
 * "Worship Applications" list on the worship site.
 *
 * Every form submission the API accepts is mirrored here as one list item:
 * a handful of typed columns for filtering (form type, status, contact,
 * fee, dates, ids) plus the complete submission payload as JSON in the
 * FormData note column. Notion remains the system of record for now, so a
 * SharePoint failure is logged and reported but never fails the request.
 *
 * Two auth modes, both confidential-client OAuth2 against Entra:
 *
 *   delegated  — GRAPH_REFRESH_TOKEN is set. The refresh-token grant mints an
 *                access token for the user who ran `npm run oauth-login` in
 *                sharepoint-mcp-server (delegated scope Sites.ReadWrite.All,
 *                user-consented — no tenant admin needed). Items show that
 *                user as Created By. Preferred while no admin consent exists.
 *   app-only   — client-credentials grant. Needs the *application* permission
 *                Sites.ReadWrite.All with admin consent; Sites.Read.All alone
 *                can read the list but not write.
 *
 * Env:
 *   GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET   (required)
 *   GRAPH_REFRESH_TOKEN          optional; selects delegated mode
 *   SHAREPOINT_SITE_URL          default: worship site
 *   SHAREPOINT_APPLICATIONS_LIST default: Worship Applications list id
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const LOGIN_BASE = 'https://login.microsoftonline.com';

export const DEFAULT_SITE_URL = 'https://bayviewassociation.sharepoint.com/sites/worship';
export const DEFAULT_APPLICATIONS_LIST_ID = '8431f00a-907b-4e3b-bd8e-a22ccb26102e';

// Vercel functions in this project run with maxDuration 10s and the Notion
// write plus email already happen in the same request, so keep the Graph
// budget short.
const REQUEST_TIMEOUT_MS = 6000;
const TOKEN_REFRESH_MARGIN_S = 60;
// SharePoint multi-line text columns cap out around 64k characters.
const FORM_DATA_LIMIT = 60000;

/** Form-type values the API uses → the list's FormType choice values. */
export const FORM_TYPE_CHOICES = {
  wedding: 'Wedding',
  'memorial-funeral-service': 'Memorial Service',
  baptism: 'Baptism',
  'general-use': 'General Use',
  'memorial-garden': 'Memorial Garden',
  'preacher-recommendation': 'Preacher Recommendation'
};

// Delegated scope requested on refresh. A subset of what the user consented
// to is fine; offline_access keeps refresh tokens flowing.
const DELEGATED_SCOPE = 'https://graph.microsoft.com/Sites.ReadWrite.All offline_access';

// Module-level caches survive across warm invocations of the same function
// instance, which is where they pay off; a cold start just refetches.
let tokenCache = { value: null, expiresAt: 0, mode: null };
const siteIdCache = new Map();

/**
 * Read the Graph configuration from the environment.
 * @returns {null | {tenantId:string, clientId:string, clientSecret:string, refreshToken?:string, mode:'delegated'|'app-only', siteUrl:string, listId:string}}
 */
export function getSharePointConfig(env = process.env) {
  const tenantId = env.GRAPH_TENANT_ID;
  const clientId = env.GRAPH_CLIENT_ID;
  const clientSecret = env.GRAPH_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    return null;
  }
  const refreshToken = env.GRAPH_REFRESH_TOKEN || undefined;
  return {
    tenantId,
    clientId,
    clientSecret,
    refreshToken,
    mode: refreshToken ? 'delegated' : 'app-only',
    siteUrl: env.SHAREPOINT_SITE_URL || DEFAULT_SITE_URL,
    listId: env.SHAREPOINT_APPLICATIONS_LIST || DEFAULT_APPLICATIONS_LIST_ID
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
    return `${response.status} ${code ? `${code}: ` : ''}${message}`;
  } catch {
    return `${response.status} ${text}`.trim();
  }
}

/**
 * Acquire (and cache) a Graph access token — delegated via refresh token when
 * one is configured, otherwise app-only via client credentials.
 *
 * The refresh-token response also carries a rotated refresh token. We keep
 * using the configured one: for confidential clients Entra does not revoke
 * the previous token on use, and it stays valid as long as it is exercised
 * within its inactivity window. If refreshes start failing, re-run
 * `npm run oauth-login` in sharepoint-mcp-server and update the env var.
 */
export async function getAccessToken(config) {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache.value && tokenCache.mode === config.mode && tokenCache.expiresAt - TOKEN_REFRESH_MARGIN_S > now) {
    return tokenCache.value;
  }

  const params = config.mode === 'delegated'
    ? {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        scope: DELEGATED_SCOPE,
        grant_type: 'refresh_token'
      }
    : {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
      };

  const response = await fetchWithTimeout(
    `${LOGIN_BASE}/${config.tenantId}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) }
  );
  if (!response.ok) {
    throw new Error(`Graph token request (${config.mode}) failed: ${await readError(response)}`);
  }

  const data = await response.json();
  tokenCache = {
    value: data.access_token,
    expiresAt: now + Number(data.expires_in || 3600),
    mode: config.mode
  };
  return tokenCache.value;
}

/** @deprecated use getAccessToken */
export const getAppToken = getAccessToken;

/**
 * Decode the permission claims carried by a Graph token: `roles` for
 * app-only tokens, `scp` (space-separated) for delegated ones.
 * Diagnostic only — the token is never verified here.
 */
export function decodeTokenClaims(token) {
  try {
    const payload = token.split('.')[1];
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const claims = JSON.parse(json);
    return {
      roles: claims.roles || [],
      scopes: claims.scp ? String(claims.scp).split(' ') : [],
      user: claims.upn || claims.preferred_username || null,
      appId: claims.appid,
      tenantId: claims.tid
    };
  } catch {
    return { roles: [], scopes: [], user: null, appId: null, tenantId: null };
  }
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
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

/**
 * Resolve a SharePoint site URL to its Graph site id (cached).
 */
export async function resolveSiteId(config) {
  const cached = siteIdCache.get(config.siteUrl);
  if (cached) {
    return cached;
  }
  const url = new URL(config.siteUrl);
  const sitePath = url.pathname.replace(/\/$/, '');
  const site = await graphRequest(config, 'GET', `/sites/${url.hostname}:${sitePath}?$select=id,webUrl`);
  siteIdCache.set(config.siteUrl, site.id);
  return site.id;
}

/**
 * Create one item in the configured list. Returns the created listItem.
 */
export async function createListItem(config, fields) {
  const siteId = await resolveSiteId(config);
  return graphRequest(config, 'POST', `/sites/${siteId}/lists/${config.listId}/items`, { fields });
}

/**
 * Delete one item from the configured list (used by the smoke test).
 */
export async function deleteListItem(config, itemId) {
  const siteId = await resolveSiteId(config);
  return graphRequest(config, 'DELETE', `/sites/${siteId}/lists/${config.listId}/items/${itemId}`);
}

/**
 * Read the configured list's column definitions.
 */
export async function getListColumns(config) {
  const siteId = await resolveSiteId(config);
  const data = await graphRequest(config, 'GET', `/sites/${siteId}/lists/${config.listId}/columns?$select=name,displayName,indexed,readOnly`);
  return data.value || [];
}

function normaliseDateTime(value) {
  if (!value) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  // Date-only input → midnight UTC so SharePoint keeps the calendar day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function cleanText(value, limit = 255) {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s ? s.slice(0, limit) : undefined;
}

/**
 * Build the list item fields for an application.
 *
 * @param {Object} app
 * @param {string} app.formType        API form type (see FORM_TYPE_CHOICES)
 * @param {string} app.submissionId    e.g. CHAPEL-1726....
 * @param {string} [app.title]         human-readable subject (couple, deceased, preacher…)
 * @param {string} [app.applicantName]
 * @param {string} [app.contactEmail]
 * @param {string} [app.contactPhone]
 * @param {number} [app.fee]
 * @param {string} [app.serviceDate]   ISO date or datetime
 * @param {string} [app.submittedAt]   ISO datetime
 * @param {string} [app.notionId]
 * @param {Object} [app.formData]      full payload, stored as JSON
 */
export function buildApplicationFields(app) {
  const formTypeChoice = FORM_TYPE_CHOICES[app.formType];
  if (!formTypeChoice) {
    throw new Error(`Unknown form type for SharePoint: ${app.formType}`);
  }

  let formDataJson;
  if (app.formData !== undefined) {
    formDataJson = JSON.stringify(app.formData);
    if (formDataJson.length > FORM_DATA_LIMIT) {
      formDataJson = JSON.stringify({ truncated: true, submissionId: app.submissionId, preview: formDataJson.slice(0, FORM_DATA_LIMIT - 200) });
    }
  }

  const fields = {
    Title: cleanText(app.title) || cleanText(app.applicantName) || app.submissionId,
    FormType: formTypeChoice,
    Status: 'Pending',
    SubmissionId: app.submissionId,
    ApplicantName: cleanText(app.applicantName),
    ContactEmail: cleanText(app.contactEmail),
    ContactPhone: cleanText(app.contactPhone),
    CalculatedFee: typeof app.fee === 'number' && Number.isFinite(app.fee) ? app.fee : undefined,
    ServiceDate: normaliseDateTime(app.serviceDate),
    SubmittedAt: normaliseDateTime(app.submittedAt) || new Date().toISOString(),
    NotionId: cleanText(app.notionId),
    FormData: formDataJson
  };

  for (const key of Object.keys(fields)) {
    if (fields[key] === undefined) delete fields[key];
  }
  return fields;
}

/**
 * Mirror an accepted application into SharePoint.
 *
 * Never throws. Returns:
 *   { ok: true,  id, webUrl }        item created
 *   { ok: false, skipped: true }     Graph env vars not set
 *   { ok: false, error }             Graph rejected the write or timed out
 */
export async function saveApplicationToSharePoint(app, env = process.env) {
  const config = getSharePointConfig(env);
  if (!config) {
    return { ok: false, skipped: true };
  }

  try {
    const fields = buildApplicationFields(app);
    const item = await createListItem(config, fields);
    console.log(`SharePoint item created for ${app.submissionId}: ${item.id}`);
    return { ok: true, id: item.id, webUrl: item.webUrl };
  } catch (error) {
    console.error(`SharePoint write failed for ${app.submissionId}:`, error.message);
    return { ok: false, error: error.message };
  }
}
