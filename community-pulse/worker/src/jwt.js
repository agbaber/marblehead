// Minimal JWT (HS256) for Cloudflare Workers using crypto.subtle.
// No external dependencies.

const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };
const EXPIRY_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

function base64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function importKey(secret) {
  const enc = new TextEncoder().encode(secret);
  return crypto.subtle.importKey('raw', enc, ALGORITHM, false, ['sign', 'verify']);
}

/**
 * Create a signed JWT.
 * @param {{ sub: string, branch: string|null }} payload
 * @param {string} secret
 * @returns {Promise<string>}
 */
export async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + Math.floor(EXPIRY_MS / 1000) };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const bodyB64 = base64url(enc.encode(JSON.stringify(body)));
  const data = `${headerB64}.${bodyB64}`;

  const key = await importKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${base64url(sig)}`;
}

/**
 * Verify a JWT and return the payload, or null if invalid/expired.
 * @param {string} token
 * @param {string} secret
 * @returns {Promise<object|null>}
 */
export async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, bodyB64, sigB64] = parts;
  const data = `${headerB64}.${bodyB64}`;
  const sig = base64urlDecode(sigB64);

  const key = await importKey(secret);
  const enc = new TextEncoder();
  const valid = await crypto.subtle.verify('HMAC', key, sig, enc.encode(data));
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(bodyB64)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract a JWT from the Authorization: Bearer header.
 * @param {Request} request
 * @returns {string|null}
 */
export function extractJWT(request) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

/**
 * Create a stateless signed challenge (no storage needed).
 * Format: base64url(timestamp_ms + 18 random bytes) + "." + base64url(HMAC)
 * @param {string} secret
 * @returns {Promise<string>}
 */
export async function createChallenge(secret) {
  const timestamp = new ArrayBuffer(8);
  new DataView(timestamp).setBigUint64(0, BigInt(Date.now()));
  const random = crypto.getRandomValues(new Uint8Array(18));
  const combined = new Uint8Array(8 + 18);
  combined.set(new Uint8Array(timestamp), 0);
  combined.set(random, 8);

  const dataB64 = base64url(combined);
  const key = await importKey(secret);
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(dataB64));
  return `${dataB64}.${base64url(sig)}`;
}

/**
 * Verify a signed challenge. Returns true if valid and within TTL.
 * @param {string} challenge
 * @param {string} secret
 * @param {number} [ttlMs=300000] - 5 minutes default
 * @returns {Promise<boolean>}
 */
export async function verifyChallenge(challenge, secret, ttlMs = 5 * 60 * 1000) {
  const dot = challenge.indexOf('.');
  if (dot === -1) return false;

  const dataB64 = challenge.slice(0, dot);
  const sigB64 = challenge.slice(dot + 1);

  const key = await importKey(secret);
  const enc = new TextEncoder();
  const sig = base64urlDecode(sigB64);
  const valid = await crypto.subtle.verify('HMAC', key, sig, enc.encode(dataB64));
  if (!valid) return false;

  // Check timestamp.
  const combined = base64urlDecode(dataB64);
  if (combined.length < 8) return false;
  const timestamp = Number(new DataView(combined.buffer).getBigUint64(0));
  return (Date.now() - timestamp) < ttlMs;
}

// 256 words — enough for 4-word keys with ~32 bits of entropy.
// Marblehead-flavored so they feel local, not generic.
const WORDLIST = [
  'anchor','baker','beacon','boat','boulder','brass','breeze','bridge',
  'buoy','captain','castle','cedar','channel','charter','cliff','coast',
  'cobble','compass','copper','coral','cove','crane','creek','crest',
  'current','dagger','dawn','deck','dock','dolphin','dory','drift',
  'dune','eagle','elm','ember','engine','falcon','ferry','fisher',
  'flag','flint','float','fog','fort','fossil','frost','gale',
  'galley','garden','gate','gavel','glacier','granite','gull','harbor',
  'hatch','hawk','hearth','helm','heron','hill','horizon','hull',
  'inlet','iron','island','ivy','jetty','journal','kayak','keel',
  'kelp','kettle','kindle','knot','ladder','lamp','lantern','larch',
  'ledge','light','lime','lobster','lodge','lookout','lumber','maple',
  'marble','marsh','mast','meadow','mill','mint','mirror','mooring',
  'mussel','narrows','navy','nest','north','oak','oar','ocean',
  'olive','orbit','osprey','otter','oyster','paddle','path','pearl',
  'pebble','pelican','penny','pepper','perch','picket','pier','pilot',
  'pine','plank','plover','plum','point','pond','port','powder',
  'prism','quarry','quartz','rail','ramp','raven','reef','ridge',
  'rigging','river','robin','rope','rudder','sail','salt','sand',
  'sandal','schooner','scout','seal','shell','shoal','shore','signal',
  'silver','skiff','slate','sloop','smoke','south','spark','spruce',
  'square','starboard','stern','stone','storm','strand','stream','summit',
  'sundial','surf','swan','tackle','tallow','tanker','tavern','tender',
  'thatch','thistle','thorn','ticket','tide','timber','tinker','tower',
  'trail','trident','trough','trout','trumpet','tugboat','tunnel','turtle',
  'vessel','village','vine','violet','voyage','walnut','watch','water',
  'wave','weather','whale','wharf','wheel','willow','wind','winter',
  'witch','wren','yacht','yard','zenith','anchor','basin','bluff',
  'bramble','cape','chart','clover','delta','drydock','eddy','fennel',
  'flare','gravel','halyard','haven','jib','ketch','lagoon','lanyard',
  'ledger','lunar','marker','narwhal','opal','osprey','piling','plover',
  'portside','quahog','ripple','rowboat','sandbar','seaglass','skipper','swell',
  'terrace','topside','urchin','venture','warden','windlass','yawl','zephyr',
];

/**
 * Generate a recovery key as four random words.
 * Format: MBLHD-harbor-lobster-foghorn-granite
 * @returns {{ plain: string, hash: string }}
 */
export async function generateRecoveryKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const words = Array.from(bytes).map(b => WORDLIST[b]);
  const plain = `MBLHD-${words.join('-')}`;

  const enc = new TextEncoder().encode(plain);
  const hashBuf = await crypto.subtle.digest('SHA-256', enc);
  const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  return { plain, hash };
}

/**
 * Hash a recovery key for comparison.
 * @param {string} plain
 * @returns {Promise<string>}
 */
export async function hashRecoveryKey(plain) {
  const enc = new TextEncoder().encode(plain);
  const hashBuf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
