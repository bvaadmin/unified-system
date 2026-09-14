#!/usr/bin/env node
/**
 * Verify the Graph setup used by lib/sharepoint.js.
 *
 *   node scripts/sharepoint/check-app-permissions.js           # token + permissions + list columns
 *   node scripts/sharepoint/check-app-permissions.js --write   # also create + delete a smoke item
 *
 * Needs GRAPH_TENANT_ID / GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET in the
 * environment (e.g. `op run --env-file=.env.sharepoint -- node …`).
 * Add GRAPH_REFRESH_TOKEN to test the delegated (user) mode instead of
 * app-only. Prints nothing secret.
 */

import {
  getSharePointConfig,
  getAccessToken,
  decodeTokenClaims,
  resolveSiteId,
  getListColumns,
  createListItem,
  deleteListItem,
  buildApplicationFields
} from '../../lib/sharepoint.js';

const REQUIRED_PERMISSION = 'Sites.ReadWrite.All';
const HIGHER_PERMISSIONS = ['Sites.Manage.All', 'Sites.FullControl.All'];
const doWrite = process.argv.includes('--write');

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const config = getSharePointConfig();
if (!config) {
  fail('GRAPH_TENANT_ID, GRAPH_CLIENT_ID and GRAPH_CLIENT_SECRET must all be set');
}
console.log(`site: ${config.siteUrl}`);
console.log(`list: ${config.listId}`);
console.log(`mode: ${config.mode}${config.mode === 'delegated' ? ' (GRAPH_REFRESH_TOKEN set)' : ' (client credentials)'}`);

let token;
try {
  token = await getAccessToken(config);
  console.log(`✓ ${config.mode} access token acquired`);
} catch (error) {
  fail(`token request failed — ${error.message}`);
}

const { roles, scopes, user, appId, tenantId } = decodeTokenClaims(token);
console.log(`  app: ${appId}  tenant: ${tenantId}`);

let canWrite;
if (config.mode === 'delegated') {
  console.log(`  signed-in user: ${user || '(unknown)'}`);
  console.log(`  delegated scopes (scp): ${scopes.length ? scopes.join(', ') : '(none)'}`);
  canWrite = scopes.includes(REQUIRED_PERMISSION) || HIGHER_PERMISSIONS.some(p => scopes.includes(p));
  if (canWrite) {
    console.log(`✓ ${REQUIRED_PERMISSION} delegated scope present — writes should work if the user can edit the list`);
  } else {
    console.log(`! ${REQUIRED_PERMISSION} is NOT in the delegated scopes — re-run oauth-login with that scope`);
  }
} else {
  console.log(`  application permissions (roles): ${roles.length ? roles.join(', ') : '(none)'}`);
  canWrite = roles.includes(REQUIRED_PERMISSION) || HIGHER_PERMISSIONS.some(p => roles.includes(p));
  if (canWrite) {
    console.log(`✓ ${REQUIRED_PERMISSION} (or higher) is granted — list writes should work`);
  } else if (roles.includes('Sites.Selected')) {
    console.log('! Sites.Selected only — writes work only if this site has a write grant for the app');
  } else {
    console.log(`! ${REQUIRED_PERMISSION} is NOT granted — writes will 403 until an admin consents to it in Entra (or set GRAPH_REFRESH_TOKEN for delegated mode)`);
  }
}

try {
  const siteId = await resolveSiteId(config);
  console.log(`✓ site resolved: ${siteId}`);
} catch (error) {
  fail(`site lookup failed — ${error.message}`);
}

let columns;
try {
  columns = await getListColumns(config);
  const names = columns.filter(c => !c.readOnly).map(c => c.name);
  console.log(`✓ list readable, writable columns: ${names.join(', ')}`);
  const expected = ['Title', 'FormType', 'Status', 'SubmissionId', 'ApplicantName', 'ContactEmail', 'ContactPhone', 'CalculatedFee', 'ServiceDate', 'SubmittedAt', 'NotionId', 'FormData'];
  const missing = expected.filter(n => !names.includes(n));
  if (missing.length) {
    console.log(`! list is missing expected columns: ${missing.join(', ')}`);
  }
} catch (error) {
  fail(`list read failed — ${error.message}`);
}

if (!doWrite) {
  console.log('(pass --write to create and delete a smoke-test item)');
  process.exit(canWrite ? 0 : 2);
}

const submissionId = `SMOKE-${Date.now()}`;
const fields = buildApplicationFields({
  formType: 'general-use',
  submissionId,
  title: 'Smoke test — safe to delete',
  applicantName: 'check-app-permissions.js',
  contactEmail: 'noreply@example.invalid',
  fee: 0,
  serviceDate: new Date().toISOString().slice(0, 10),
  submittedAt: new Date().toISOString(),
  formData: { smoke: true, submissionId }
});

let item;
try {
  item = await createListItem(config, fields);
  console.log(`✓ smoke item created: id ${item.id}`);
} catch (error) {
  fail(`create item failed — ${error.message}`);
}

try {
  await deleteListItem(config, item.id);
  console.log(`✓ smoke item ${item.id} deleted`);
} catch (error) {
  console.error(`! created item ${item.id} but could not delete it — remove "${submissionId}" by hand: ${error.message}`);
  process.exit(1);
}

console.log(`✓ ${config.mode} write path verified`);
