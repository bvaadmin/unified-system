#!/usr/bin/env node
/**
 * Diagnose why the app-only Graph writer (lib/sharepoint.js) gets 403 on the
 * worship site. Prints token claims and the HTTP status of each Graph step;
 * never prints the secret or the token.
 *
 *   op run --env-file=<refs file> -- node scripts/sharepoint/diagnose.mjs           # read-only
 *   op run --env-file=<refs file> -- node scripts/sharepoint/diagnose.mjs --write   # also create + delete one item
 *
 * Env: GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET (the same values
 * that are in Vercel production).
 */

const { GRAPH_TENANT_ID: tenant, GRAPH_CLIENT_ID: clientId, GRAPH_CLIENT_SECRET: secret } = process.env;
if (!tenant || !clientId || !secret) {
  console.error('GRAPH_TENANT_ID, GRAPH_CLIENT_ID and GRAPH_CLIENT_SECRET must be set');
  process.exit(1);
}

const HOST = 'bayviewassociation.sharepoint.com';
const SITE_PATH = '/sites/worship';
const PREACHER_LIST = '4426f849-a143-4de2-a0f6-024e0bec5193';
const G = 'https://graph.microsoft.com/v1.0';

const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: secret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  })
});
const tokenBody = await tokenRes.json();
console.log(`token request: ${tokenRes.status}`);
if (!tokenRes.ok) {
  console.log(`  ${tokenBody.error}: ${String(tokenBody.error_description).split('\r\n')[0]}`);
  process.exit(1);
}
const token = tokenBody.access_token;

const part = token.split('.')[1];
const claims = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
console.log(`  aud:   ${claims.aud}   (want https://graph.microsoft.com or 00000003-0000-0000-c000-000000000000)`);
console.log(`  appid: ${claims.appid}   (must be the Centaris app's client ID)`);
console.log(`  app_displayname: ${claims.app_displayname}`);
// Bay View's tenant, from login.microsoftonline.com/bayviewassociation.org/v2.0/.well-known/openid-configuration
const BAY_VIEW_TENANT = '93ce9419-8fa1-4a87-96f9-7b4f9b8cb766';
console.log(`  tid:   ${claims.tid}   ${claims.tid === BAY_VIEW_TENANT ? '(Bay View tenant)' : '(NOT the Bay View tenant: the app or tenant ID belongs to another directory)'}`);
console.log(`  GRAPH_TENANT_ID is ${tenant === BAY_VIEW_TENANT ? '' : 'NOT '}Bay View's tenant ID`);
console.log(`  roles: ${JSON.stringify(claims.roles ?? null)}   (null = no admin consent; want ["Sites.Selected"])`);

async function step(label, method, path, body) {
  const res = await fetch(`${G}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  const err = json?.error ? ` ${json.error.code}: ${String(json.error.message).split('\r\n')[0]}` : '';
  console.log(`${label}: ${res.status}${err}`);
  return { ok: res.ok, json };
}

await step('GET tenant root site (expect 403 under Sites.Selected)', 'GET', '/sites/root?$select=id');
const site = await step('GET worship site by path', 'GET', `/sites/${HOST}:${SITE_PATH}?$select=id,displayName`);
if (!site.ok) process.exit(2);
const siteId = site.json.id;
console.log(`  site id: ${siteId}`);
await step('GET site permissions (needs FullControl; 403 is normal)', 'GET', `/sites/${siteId}/permissions`);
await step('GET Preacher Recommendations list', 'GET', `/sites/${siteId}/lists/${PREACHER_LIST}?$select=id,displayName`);
await step('GET list items (read access)', 'GET', `/sites/${siteId}/lists/${PREACHER_LIST}/items?$top=1`);

if (process.argv.includes('--write')) {
  const created = await step('POST test item', 'POST', `/sites/${siteId}/lists/${PREACHER_LIST}/items`, {
    fields: { Title: 'DIAGNOSE - safe to delete', Status: 'New' }
  });
  if (created.ok) {
    await step(`DELETE test item ${created.json.id}`, 'DELETE', `/sites/${siteId}/lists/${PREACHER_LIST}/items/${created.json.id}`);
  }
}
