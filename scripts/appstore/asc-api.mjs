// Minimal App Store Connect API client — no dependencies beyond Node's
// built-in crypto/fetch. Signs its own ES256 JWT from a downloaded API key
// (.p8) instead of using an SDK, so nothing needs to be installed.
//
// Env vars (all required):
//   ASC_KEY_ID     - the "Key ID" shown in App Store Connect (also the
//                    filename: AuthKey_<KEY_ID>.p8)
//   ASC_ISSUER_ID  - the "Issuer ID" shown at the top of the Integrations
//                    page (same for every key on the account)
//   ASC_KEY_PATH   - absolute path to the AuthKey_*.p8 file
//
// The private key file itself is never committed — only its path is read
// from an env var, and the file lives outside the repo (Downloads).
import crypto from 'node:crypto';
import fs from 'node:fs';

const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;
const KEY_PATH = process.env.ASC_KEY_PATH;

if (!KEY_ID || !ISSUER_ID || !KEY_PATH) {
  throw new Error('Set ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH env vars first.');
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

let cachedToken = null;
let cachedExp = 0;

export function getToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedExp - now > 60) return cachedToken;

  const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
  const exp = now + 19 * 60; // Apple caps this at 20 minutes
  const payload = { iss: ISSUER_ID, iat: now, exp, aud: 'appstoreconnect-v1' };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const privateKey = fs.readFileSync(KEY_PATH, 'utf8');
  const sign = crypto.createSign('SHA256');
  sign.update(signingInput);
  sign.end();
  const signature = sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });

  cachedToken = `${signingInput}.${base64url(signature)}`;
  cachedExp = exp;
  return cachedToken;
}

const BASE = 'https://api.appstoreconnect.apple.com';

export async function asc(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  if (!res.ok) {
    const err = new Error(`ASC API ${method} ${path} -> ${res.status}`);
    err.status = res.status;
    err.body = json ?? text;
    throw err;
  }
  return json;
}
