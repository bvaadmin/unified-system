#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import handler from '../../lib/api/diagnostic/oracle-selftest.js';

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; console.log(JSON.stringify({ statusCode: this.statusCode, ...obj }, null, 2)); return this; },
    end() { /* noop */ }
  };
}

const req = {
  method: 'POST',
  headers: {
    origin: 'http://localhost:3000',
    authorization: `Bearer ${process.env.ADMIN_TOKEN || ''}`
  },
  url: '/api/diagnostic/oracle-selftest'
};

const res = makeRes();

handler(req, res).catch((e) => {
  console.error('Handler error:', e);
  process.exit(1);
});

