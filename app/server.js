#!/usr/bin/env node
/**
 * Guild HQ — private guild tracker for The Cozy Florist.
 * Zero-dependency Node.js server: static frontend + JSON API + file-backed store.
 * Requires Node 18+.
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'guild.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const SECRET_FILE = path.join(DATA_DIR, '.session-secret');
const BACKUPS_TO_KEEP = 14;

// ---------------------------------------------------------------- config ---

let fileConfig = {};
try {
  fileConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
} catch { /* config.json is optional; env vars can carry everything */ }

const CONFIG = {
  port: Number(process.env.PORT || fileConfig.port || 8321),
  host: process.env.HOST || fileConfig.host || '0.0.0.0',
  adminPassword: process.env.ADMIN_PASSWORD || fileConfig.adminPassword || '',
  viewerPassword: process.env.VIEWER_PASSWORD || fileConfig.viewerPassword || '',
  // set true when serving over HTTPS (directly or behind a TLS reverse proxy)
  cookieSecure: String(process.env.COOKIE_SECURE ?? fileConfig.cookieSecure ?? 'false') === 'true',
  sessionDays: Number(process.env.SESSION_DAYS || fileConfig.sessionDays || 30),
};

if (!CONFIG.adminPassword || !CONFIG.viewerPassword) {
  console.error('Missing passwords. Set ADMIN_PASSWORD and VIEWER_PASSWORD (env vars or config.json).');
  process.exit(1);
}
if (CONFIG.adminPassword === CONFIG.viewerPassword) {
  console.error('ADMIN_PASSWORD and VIEWER_PASSWORD must be different.');
  process.exit(1);
}

// ----------------------------------------------------------------- store ---

function defaultData() {
  return {
    settings: {
      guildName: 'My Guild',
      memberCapacity: 40,
      questsMin: 18,
      questsMax: 24,
      baseQuestScores: [21, 23, 25, 28, 30],
      maxMultiplier: 2,
      bonusMin: 1,
      bonusMax: 4,
      potential: {
        // "Max points potential" is an ESTIMATE — inputs are tunable in Settings.
        scorePerQuest: 60,      // default: top base score (30) x max multiplier (2)
        includeBonus: true,
        avgBonus: 2.5,          // default: midpoint of bonus range
        membersOverride: null,  // when set, replaces the member-by-member sum
      },
      floristRanks: {
        // Min points behind each profile label — drives the Rivals calculator.
        // "honored" is a guess (reported as "100+", assumed typo for 1000).
        standard: 500,
        senior: 700,
        honored: 1000,
        peerless: 1300,
        supreme: 1400,
        unknown: 500,           // assumed floor for members showing no label
      },
    },
    members: [],       // {id,name,role,timezone,active,notes,questCount,flowerIds,flowerBonuses,potentialOverride}
    flowers: [],       // {id,name,rarity,points}
    competitions: [],  // {id,weekStart,weekEnd,ourScore,ourRankTitle,ourPlacement,notes,
                       //  memberResults:[{memberId,finalScore,questsCompleted,questDetail:[]}],
                       //  competitors:[{id,name,score,rankTitle,placement}]}
  };
}

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

let data;
try {
  data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  // merge any settings keys added in newer versions
  const def = defaultData();
  data.settings = { ...def.settings, ...data.settings };
  data.settings.potential = { ...def.settings.potential, ...(data.settings.potential || {}) };
  data.settings.floristRanks = { ...def.settings.floristRanks, ...(data.settings.floristRanks || {}) };
  for (const key of ['members', 'flowers', 'competitions']) {
    if (!Array.isArray(data[key])) data[key] = [];
  }
  for (const m of data.members) {
    if (!m.flowerBonuses || typeof m.flowerBonuses !== 'object') m.flowerBonuses = {};
  }
  for (const f of data.flowers) {
    if (!('rarity' in f)) f.rarity = null;
    delete f.categoryId; // categories were superseded by rarity
  }
  delete data.categories;
} catch {
  data = defaultData();
}

let saveTimer = null;
function save() {
  // debounce bursts of writes, then write atomically (tmp + rename)
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      dailyBackup();
      const tmp = DATA_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      fs.renameSync(tmp, DATA_FILE);
    } catch (err) {
      console.error('Failed to persist data:', err);
    }
  }, 150);
}

function dailyBackup() {
  if (!fs.existsSync(DATA_FILE)) return;
  const stamp = new Date().toISOString().slice(0, 10);
  const dest = path.join(BACKUP_DIR, `guild-${stamp}.json`);
  if (fs.existsSync(dest)) return; // one backup per day, taken before the day's first write
  try {
    fs.copyFileSync(DATA_FILE, dest);
    const old = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('guild-')).sort();
    while (old.length > BACKUPS_TO_KEEP) fs.unlinkSync(path.join(BACKUP_DIR, old.shift()));
  } catch (err) {
    console.error('Backup failed:', err);
  }
}

process.on('SIGINT', flushAndExit);
process.on('SIGTERM', flushAndExit);
function flushAndExit() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      const tmp = DATA_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      fs.renameSync(tmp, DATA_FILE);
    } catch (err) {
      console.error('Final save failed:', err);
    }
  }
  process.exit(0);
}

// -------------------------------------------------------------- sessions ---

let secret;
try {
  secret = fs.readFileSync(SECRET_FILE, 'utf8').trim();
  if (secret.length < 32) throw new Error('secret too short');
} catch {
  secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
}

function signSession(role) {
  const payload = Buffer.from(JSON.stringify({
    role,
    exp: Date.now() + CONFIG.sessionDays * 86400_000,
  })).toString('base64url');
  const mac = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

function verifySession(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, mac] = token.split('.');
  const expect = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (session.exp < Date.now()) return null;
    if (session.role !== 'admin' && session.role !== 'viewer') return null;
    return session;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function sessionCookie(value, maxAgeSeconds) {
  const bits = [
    `guildhq=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (CONFIG.cookieSecure) bits.push('Secure');
  return bits.join('; ');
}

// login rate limiting: 20 attempts / 10 min per IP
const loginAttempts = new Map();
function loginAllowed(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 600_000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 20;
}

function timingSafeMatch(input, expected) {
  const a = crypto.createHash('sha256').update(String(input)).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

// --------------------------------------------------------------- helpers ---

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > 2_000_000) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const uuid = () => crypto.randomUUID();
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const optNum = v => (v === null || v === undefined || v === '' ? null : (isNum(Number(v)) ? Number(v) : null));
const str = (v, max = 500) => String(v ?? '').slice(0, max);

const ROLES = ['Leader', 'Co-Leader', 'Elder', 'Elite', 'Member'];
const RARITIES = ['UR', 'SSR', 'SR', 'R', 'N'];

function sanitizeMemberPatch(body, existing) {
  const m = { ...existing };
  if ('name' in body) m.name = str(body.name, 80);
  if ('role' in body) m.role = ROLES.includes(body.role) ? body.role : 'Member';
  if ('timezone' in body) m.timezone = str(body.timezone, 60);
  if ('active' in body) m.active = Boolean(body.active);
  if ('notes' in body) m.notes = str(body.notes, 4000);
  if ('questCount' in body) {
    const n = optNum(body.questCount);
    m.questCount = n === null ? existing.questCount : Math.max(0, Math.min(99, Math.round(n)));
  }
  if ('potentialOverride' in body) m.potentialOverride = optNum(body.potentialOverride);
  if ('flowerIds' in body && Array.isArray(body.flowerIds)) {
    const valid = new Set(data.flowers.map(f => f.id));
    m.flowerIds = [...new Set(body.flowerIds.filter(id => valid.has(id)))];
  }
  if ('flowerBonuses' in body && body.flowerBonuses && typeof body.flowerBonuses === 'object') {
    const valid = new Set(data.flowers.map(f => f.id));
    const bonuses = {};
    for (const [fid, v] of Object.entries(body.flowerBonuses)) {
      const n = optNum(v);
      if (valid.has(fid) && n !== null && n > 0) bonuses[fid] = Math.min(99999, Math.round(n));
    }
    m.flowerBonuses = bonuses;
  }
  if (m.flowerBonuses) {
    // a bonus only makes sense on a flower the member still owns
    const owned = new Set(m.flowerIds || []);
    for (const fid of Object.keys(m.flowerBonuses)) {
      if (!owned.has(fid)) delete m.flowerBonuses[fid];
    }
  }
  return m;
}

const EST_KEYS = ['standard', 'senior', 'honored', 'peerless', 'supreme'];

// rival title-count estimate: {totalPlayers, counts:{standard..supreme}} or null
function sanitizeEstimate(e) {
  if (!e || typeof e !== 'object') return null;
  const counts = {};
  for (const k of EST_KEYS) {
    const n = optNum(e.counts && e.counts[k]);
    counts[k] = n === null ? 0 : Math.max(0, Math.min(99, Math.round(n)));
  }
  const totalPlayers = optNum(e.totalPlayers);
  const hasData = totalPlayers !== null || EST_KEYS.some(k => counts[k] > 0);
  return hasData ? { totalPlayers, counts } : null;
}

function sanitizeCompetitionPatch(body, existing) {
  const c = { ...existing };
  if ('weekStart' in body) c.weekStart = str(body.weekStart, 10);
  if ('weekEnd' in body) c.weekEnd = str(body.weekEnd, 10);
  if ('ourScore' in body) c.ourScore = optNum(body.ourScore);
  if ('ourRankTitle' in body) c.ourRankTitle = str(body.ourRankTitle, 60);
  if ('ourPlacement' in body) c.ourPlacement = optNum(body.ourPlacement);
  if ('notes' in body) c.notes = str(body.notes, 4000);
  if ('competitors' in body && Array.isArray(body.competitors)) {
    c.competitors = body.competitors.slice(0, 50).map(r => ({
      id: typeof r.id === 'string' && r.id ? r.id : uuid(),
      name: str(r.name, 80),
      score: optNum(r.score),
      rankTitle: str(r.rankTitle, 60),
      placement: optNum(r.placement),
      notes: str(r.notes, 2000),
      estimate: sanitizeEstimate(r.estimate),
    })).filter(r => r.name);
  }
  if ('memberResults' in body && Array.isArray(body.memberResults)) {
    const memberIds = new Set(data.members.map(m => m.id));
    c.memberResults = body.memberResults.slice(0, 200)
      .filter(r => memberIds.has(r.memberId))
      .map(r => ({
        memberId: r.memberId,
        finalScore: optNum(r.finalScore),
        questsCompleted: optNum(r.questsCompleted),
        questDetail: Array.isArray(r.questDetail)
          ? r.questDetail.slice(0, 40).map(q => ({
              base: optNum(q.base) ?? 0,
              maxed: Boolean(q.maxed),
              bonus: optNum(q.bonus) ?? 0,
            }))
          : [],
      }));
  }
  return c;
}

function sanitizeSettings(body) {
  const s = data.settings;
  if ('guildName' in body) s.guildName = str(body.guildName, 80) || 'My Guild';
  if ('memberCapacity' in body) s.memberCapacity = Math.max(1, Math.min(999, optNum(body.memberCapacity) ?? s.memberCapacity));
  if ('questsMin' in body) s.questsMin = Math.max(0, Math.min(99, optNum(body.questsMin) ?? s.questsMin));
  if ('questsMax' in body) s.questsMax = Math.max(s.questsMin, Math.min(99, optNum(body.questsMax) ?? s.questsMax));
  if ('baseQuestScores' in body && Array.isArray(body.baseQuestScores)) {
    const scores = body.baseQuestScores.map(optNum).filter(n => n !== null && n > 0).slice(0, 20);
    if (scores.length) s.baseQuestScores = [...new Set(scores)].sort((a, b) => a - b);
  }
  if ('maxMultiplier' in body) s.maxMultiplier = Math.max(1, optNum(body.maxMultiplier) ?? s.maxMultiplier);
  if ('bonusMin' in body) s.bonusMin = Math.max(0, optNum(body.bonusMin) ?? s.bonusMin);
  if ('bonusMax' in body) s.bonusMax = Math.max(s.bonusMin, optNum(body.bonusMax) ?? s.bonusMax);
  if (body.potential && typeof body.potential === 'object') {
    const p = body.potential;
    if ('scorePerQuest' in p) s.potential.scorePerQuest = Math.max(0, optNum(p.scorePerQuest) ?? s.potential.scorePerQuest);
    if ('includeBonus' in p) s.potential.includeBonus = Boolean(p.includeBonus);
    if ('avgBonus' in p) s.potential.avgBonus = Math.max(0, optNum(p.avgBonus) ?? s.potential.avgBonus);
    if ('membersOverride' in p) s.potential.membersOverride = optNum(p.membersOverride);
  }
  if (body.floristRanks && typeof body.floristRanks === 'object') {
    for (const key of Object.keys(s.floristRanks)) {
      if (key in body.floristRanks) {
        const n = optNum(body.floristRanks[key]);
        if (n !== null) s.floristRanks[key] = Math.max(0, n);
      }
    }
  }
}

// ------------------------------------------------------------------- api ---

async function handleApi(req, res, url, session) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';
  const method = req.method;
  const parts = url.pathname.split('/').filter(Boolean); // ['api', resource, id?]
  const resource = parts[1];
  const id = parts[2];

  // --- auth endpoints ---
  if (resource === 'login' && method === 'POST') {
    if (!loginAllowed(ip)) return json(res, 429, { error: 'Too many attempts. Try again in a few minutes.' });
    const body = await readBody(req);
    const pw = String(body.password ?? '');
    let role = null;
    if (timingSafeMatch(pw, CONFIG.adminPassword)) role = 'admin';
    else if (timingSafeMatch(pw, CONFIG.viewerPassword)) role = 'viewer';
    if (!role) return json(res, 401, { error: 'Wrong password.' });
    res.setHeader('Set-Cookie', sessionCookie(signSession(role), CONFIG.sessionDays * 86400));
    return json(res, 200, { role });
  }
  if (resource === 'logout' && method === 'POST') {
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    return json(res, 200, { ok: true });
  }

  // --- everything else requires a session ---
  if (!session) return json(res, 401, { error: 'Not logged in.' });

  if (resource === 'me' && method === 'GET') return json(res, 200, { role: session.role });
  if (resource === 'data' && method === 'GET') return json(res, 200, { role: session.role, ...data });

  // --- writes require admin + a same-origin check ---
  if (method !== 'GET') {
    if (session.role !== 'admin') return json(res, 403, { error: 'Viewer accounts are read-only.' });
    const origin = req.headers.origin;
    if (origin) {
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      try {
        if (new URL(origin).host !== host) return json(res, 403, { error: 'Cross-origin request rejected.' });
      } catch {
        return json(res, 403, { error: 'Cross-origin request rejected.' });
      }
    }
  }

  const body = method === 'GET' ? {} : await readBody(req);

  switch (resource) {
    case 'settings': {
      if (method !== 'PUT') break;
      sanitizeSettings(body);
      save();
      return json(res, 200, data.settings);
    }

    case 'members': {
      if (method === 'POST') {
        const m = sanitizeMemberPatch(body, {
          id: uuid(), name: '', role: 'Member', timezone: '', active: true,
          notes: '', questCount: data.settings.questsMin, flowerIds: [], flowerBonuses: {}, potentialOverride: null,
        });
        if (!m.name) return json(res, 400, { error: 'Name is required.' });
        data.members.push(m);
        save();
        return json(res, 201, m);
      }
      const member = data.members.find(m => m.id === id);
      if (!member) return json(res, 404, { error: 'Member not found.' });
      if (method === 'PUT') {
        const updated = sanitizeMemberPatch(body, member);
        if (!updated.name) return json(res, 400, { error: 'Name is required.' });
        Object.assign(member, updated);
        save();
        return json(res, 200, member);
      }
      if (method === 'DELETE') {
        data.members = data.members.filter(m => m.id !== id);
        for (const c of data.competitions) {
          c.memberResults = (c.memberResults || []).filter(r => r.memberId !== id);
        }
        save();
        return json(res, 200, { ok: true });
      }
      break;
    }

    case 'flowers': {
      if (method === 'POST') {
        const name = str(body.name, 80);
        if (!name) return json(res, 400, { error: 'Name is required.' });
        const flower = {
          id: uuid(),
          name,
          rarity: RARITIES.includes(body.rarity) ? body.rarity : null,
          points: optNum(body.points) ?? 0,
        };
        data.flowers.push(flower);
        save();
        return json(res, 201, flower);
      }
      const flower = data.flowers.find(f => f.id === id);
      if (!flower) return json(res, 404, { error: 'Flower not found.' });
      if (method === 'PUT') {
        if ('name' in body) {
          const name = str(body.name, 80);
          if (!name) return json(res, 400, { error: 'Name is required.' });
          flower.name = name;
        }
        if ('rarity' in body) flower.rarity = RARITIES.includes(body.rarity) ? body.rarity : null;
        if ('points' in body) flower.points = optNum(body.points) ?? flower.points;
        save();
        return json(res, 200, flower);
      }
      if (method === 'DELETE') {
        data.flowers = data.flowers.filter(f => f.id !== id);
        for (const m of data.members) {
          m.flowerIds = (m.flowerIds || []).filter(fid => fid !== id);
          if (m.flowerBonuses) delete m.flowerBonuses[id];
        }
        save();
        return json(res, 200, { ok: true });
      }
      break;
    }

    case 'competitions': {
      if (method === 'POST') {
        const c = sanitizeCompetitionPatch(body, {
          id: uuid(), weekStart: '', weekEnd: '', ourScore: null, ourRankTitle: '',
          ourPlacement: null, notes: '', memberResults: [], competitors: [],
        });
        if (!c.weekStart) return json(res, 400, { error: 'Week start date is required.' });
        data.competitions.push(c);
        save();
        return json(res, 201, c);
      }
      const comp = data.competitions.find(c => c.id === id);
      if (!comp) return json(res, 404, { error: 'Competition not found.' });
      if (method === 'PUT') {
        Object.assign(comp, sanitizeCompetitionPatch(body, comp));
        save();
        return json(res, 200, comp);
      }
      if (method === 'DELETE') {
        data.competitions = data.competitions.filter(c => c.id !== id);
        save();
        return json(res, 200, { ok: true });
      }
      break;
    }
  }

  return json(res, 404, { error: 'Unknown API route.' });
}

// ---------------------------------------------------------------- static ---

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function serveStatic(res, urlPath) {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) {
      // SPA fallback: unknown paths get the app shell
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, shell) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
        res.end(shell);
      });
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'max-age=300',
    });
    res.end(buf);
  });
}

// ---------------------------------------------------------------- server ---

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      const session = verifySession(parseCookies(req).guildhq);
      await handleApi(req, res, url, session);
    } else if (req.method === 'GET') {
      serveStatic(res, url.pathname);
    } else {
      res.writeHead(405);
      res.end();
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 400, { error: err.message || 'Bad request.' });
  }
});

server.listen(CONFIG.port, CONFIG.host, () => {
  console.log(`Guild HQ running on http://${CONFIG.host}:${CONFIG.port}`);
  console.log(`Data file: ${DATA_FILE}`);
});
