#!/usr/bin/env node
// Simple CI smoke check for deployed API
// - Pings Oracle readiness endpoint
// - Optionally runs secure self-test if ADMIN_TOKEN provided

import 'dotenv/config';
import fetch from 'node-fetch';

const BASE = process.env.API_BASE_URL;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 20000);
const RUN_SELFTEST = (process.env.SMOKE_RUN_SELFTEST || '').toLowerCase() !== 'false';

if (!BASE) {
  console.error('❌ API_BASE_URL is not set');
  process.exit(1);
}

function withTimeout(promise, ms, label) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return promise(ctrl)
    .finally(() => clearTimeout(t))
    .catch((e) => {
      if (e.name === 'AbortError') throw new Error(`${label} timed out after ${ms}ms`);
      throw e;
    });
}

async function getJson(url, opts = {}, ctrl) {
  const res = await fetch(url, { ...opts, signal: ctrl.signal });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  console.log(`🔎 Smoke check against: ${BASE}`);

  // 1) Oracle ping (with graceful fallback if route not yet deployed)
  const apiBase = BASE.replace(/\/$/, '');
  const pingUrl = `${apiBase}/api/diagnostic/oracle-ping`;
  console.log(`→ GET ${pingUrl}`);
  let pingRes = await withTimeout((ctrl) => getJson(pingUrl, {}, ctrl), TIMEOUT_MS, 'oracle-ping');
  console.log('   status:', pingRes.status, 'body:', JSON.stringify(pingRes.data));

  // If missing, try fallbacks discovered via available_routes
  if (pingRes.status === 404 && pingRes.data && Array.isArray(pingRes.data.available_routes)) {
    const routes = pingRes.data.available_routes;
    const hasOracleHealth = routes.includes('GET /api/diagnostic/oracle-health');
    const hasHealth = routes.includes('GET /api/health');

    if (hasOracleHealth) {
      const healthUrl = `${apiBase}/api/diagnostic/oracle-health`;
      console.log(`→ Fallback GET ${healthUrl}`);
      const ohealth = await withTimeout((ctrl) => getJson(healthUrl, {}, ctrl), TIMEOUT_MS, 'oracle-health');
      console.log('   status:', ohealth.status, 'body:', JSON.stringify(ohealth.data));
      if (!ohealth.ok) throw new Error(`oracle-health failed (HTTP ${ohealth.status})`);
      if (ohealth.data.status !== 'healthy' && ohealth.data.status !== 'degraded') {
        throw new Error(`oracle-health not healthy (status=${ohealth.data.status})`);
      }
      console.log('✅ Oracle health fallback ok');
    } else if (hasHealth) {
      const basicUrl = `${apiBase}/api/health`;
      console.log(`→ Fallback GET ${basicUrl}`);
      const basic = await withTimeout((ctrl) => getJson(basicUrl, {}, ctrl), TIMEOUT_MS, 'health');
      console.log('   status:', basic.status, 'body:', JSON.stringify(basic.data));
      if (!basic.ok) throw new Error(`health endpoint failed (HTTP ${basic.status})`);
      console.log('⚠️  Oracle ping route not present; basic health passed.');
    } else {
      throw new Error('No suitable health route available on deployment');
    }
  } else {
    if (!pingRes.ok || pingRes.data.status !== 'healthy') {
      throw new Error(`oracle-ping unhealthy (HTTP ${pingRes.status})`);
    }
  }

  // 2) Optional: deep self-test (insert/delete)
  if (RUN_SELFTEST) {
    if (!ADMIN_TOKEN) {
      console.log('⚠️  Skipping self-test: ADMIN_TOKEN not set');
    } else {
      const selfUrl = `${apiBase}/api/diagnostic/oracle-selftest`;
      console.log(`→ POST ${selfUrl}`);
      const selfRes = await withTimeout(
        (ctrl) => getJson(selfUrl, { method: 'POST', headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }, ctrl),
        TIMEOUT_MS,
        'oracle-selftest'
      );
      console.log('   status:', selfRes.status, 'body:', JSON.stringify(selfRes.data));
      if (selfRes.status === 404) {
        console.log('⚠️  Self-test route not present on deployment; skipping.');
      } else if (!selfRes.ok || (selfRes.data.status !== 'healthy' && selfRes.data.status !== 'degraded')) {
        throw new Error(`oracle-selftest failed (HTTP ${selfRes.status})`);
      }
    }
  }

  console.log('✅ Smoke check passed');
}

main().catch((err) => {
  console.error('❌ Smoke check failed:', err.message);
  process.exit(1);
});
