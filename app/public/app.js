/* Guild HQ — The Cozy Florist guild tracker (vanilla JS SPA) */
'use strict';

// ------------------------------------------------------------------ state --

const state = { role: null, data: null };

const ui = {
  sort: {
    members: { key: 'name', dir: 1 },
    memberFlowers: { key: 'rarity', dir: -1 },
    flowers: { key: 'name', dir: 1 },
    rivals: { key: 'date', dir: -1 },
    weekCompetitors: { key: 'score', dir: -1 },
  },
  search: { members: '', flowers: '', rivals: '' },
  filters: { membersRole: '', showInactive: false, flowersRarity: '' },
  weekDraft: { compId: null, results: {} }, // admin edit draft for a week's member results
  rivalsWeekId: null, // which competition week the Rivals estimate cards show
};

const $ = sel => document.querySelector(sel);
const app = () => $('#app');
const isAdmin = () => state.role === 'admin';

// -------------------------------------------------------------------- api --

async function api(path, method = 'GET', body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { state.role = null; render(); throw new Error('Logged out.'); }
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`);
  return payload;
}

async function loadData() {
  const payload = await api('/api/data');
  state.role = payload.role;
  const { role, ...rest } = payload;
  state.data = rest;
}

async function saveAndReload(fn, successMsg) {
  try {
    await fn();
    await loadData();
    render();
    if (successMsg) toast(successMsg);
    return true;
  } catch (err) {
    toast(err.message, true);
    return false;
  }
}

// ---------------------------------------------------------------- helpers --

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

const fmtNum = n => (n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString());

function ordinal(n) {
  if (n === null || n === undefined || n === '') return '—';
  n = Number(n);
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function weekLabel(c) {
  if (!c.weekStart) return 'Unscheduled week';
  if (!c.weekEnd) return fmtDate(c.weekStart);
  const [y1, m1, d1] = c.weekStart.split('-').map(Number);
  const [y2, m2, d2] = c.weekEnd.split('-').map(Number);
  const a = new Date(y1, m1 - 1, d1), b = new Date(y2, m2 - 1, d2);
  const sameMonth = y1 === y2 && m1 === m2;
  const left = a.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
  const right = b.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${left}–${right}`;
}

function mostRecentTuesday() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() - 2 + 7) % 7));
  return d;
}

function flowerById(id) { return state.data.flowers.find(f => f.id === id); }
function memberById(id) { return state.data.members.find(m => m.id === id); }

function flowerOwners(flowerId) {
  return state.data.members.filter(m => (m.flowerIds || []).includes(flowerId));
}

// colour-coded labels ---------------------------------------------------------

const ROLES = ['Leader', 'Co-Leader', 'Elder', 'Elite', 'Member'];
const ROLE_COLORS = { Leader: 'red', 'Co-Leader': 'yellow', Elder: 'purple', Elite: 'blue', Member: 'green' };
const roleTag = role => `<span class="tag tag-${ROLE_COLORS[role] || 'green'}">${esc(role)}</span>`;

const RARITIES = [
  { key: 'UR', label: 'Ultra Rare', color: 'red' },
  { key: 'SSR', label: 'Super Special Rare', color: 'yellow' },
  { key: 'SR', label: 'Super Rare', color: 'purple' },
  { key: 'R', label: 'Rare', color: 'blue' },
  { key: 'N', label: 'Normal', color: 'green' },
];
function rarityRank(key) { // UR highest, no rarity lowest
  const i = RARITIES.findIndex(r => r.key === key);
  return i === -1 ? 0 : RARITIES.length - i;
}
function rarityTag(key) {
  const r = RARITIES.find(x => x.key === key);
  return r ? `<span class="tag tag-${r.color}" title="${r.label}">${r.key}</span>` : '<span class="muted">—</span>';
}

const FLORIST_RANKS = [
  { key: 'standard', label: 'Standard Florist', color: 'blue' },
  { key: 'senior', label: 'Senior Florist', color: 'purple' },
  { key: 'honored', label: 'Honored Florist', color: 'yellow' },
  { key: 'peerless', label: 'Peerless Florist', color: 'red' },
  { key: 'supreme', label: 'Supreme Florist', color: 'electric' },
];

const flowerBonus = (m, flowerId) => (m.flowerBonuses || {})[flowerId] || 0;

// potential estimate --------------------------------------------------------

function effScorePerQuest() {
  const p = state.data.settings.potential;
  return (p.scorePerQuest || 0) + (p.includeBonus ? (p.avgBonus || 0) : 0);
}

function memberPotential(m) {
  if (m.potentialOverride !== null && m.potentialOverride !== undefined) return m.potentialOverride;
  const s = state.data.settings;
  return Math.round((m.questCount ?? s.questsMax) * effScorePerQuest());
}

function guildPotential() {
  const s = state.data.settings, p = s.potential;
  if (p.membersOverride !== null && p.membersOverride !== undefined) {
    return { value: Math.round(p.membersOverride * s.questsMax * effScorePerQuest()), basis: `${p.membersOverride} members (manual) × ${s.questsMax} quests × ${effScorePerQuest()} pts` };
  }
  const active = state.data.members.filter(m => m.active);
  if (!active.length) {
    return { value: Math.round(s.memberCapacity * s.questsMax * effScorePerQuest()), basis: `${s.memberCapacity} capacity × ${s.questsMax} quests × ${effScorePerQuest()} pts` };
  }
  return {
    value: active.reduce((sum, m) => sum + memberPotential(m), 0),
    basis: `sum over ${active.length} active members (each: own quest count × ${effScorePerQuest()} pts, or their manual override)`,
  };
}

// ui utilities ---------------------------------------------------------------

let toastTimer = null;
function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 2600);
}

function openDialog(html) {
  document.querySelectorAll('dialog').forEach(d => d.remove());
  const dlg = document.createElement('dialog');
  dlg.innerHTML = html;
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
  return dlg;
}

function sortArrow(view, key) {
  const s = ui.sort[view];
  if (s.key !== key) return 'sortable';
  return 'sortable ' + (s.dir === 1 ? 'sorted-asc' : 'sorted-desc');
}

function bindSortHeaders(view, rerender) {
  document.querySelectorAll(`[data-sortview="${view}"] th[data-key]`).forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      const s = ui.sort[view];
      if (s.key === key) s.dir = -s.dir; else { s.key = key; s.dir = 1; }
      rerender();
    });
  });
}

function cmp(a, b) {
  if (a === null || a === undefined || a === '') return 1;
  if (b === null || b === undefined || b === '') return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true });
}

function downloadFile(filename, text, type = 'text/csv') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// ----------------------------------------------------------------- chrome --

const TABS = [
  { hash: '#/dashboard', label: 'Home', ico: '🏠' },
  { hash: '#/members', label: 'Members', ico: '👥' },
  { hash: '#/flowers', label: 'Flowers', ico: '🌸' },
  { hash: '#/weeks', label: 'Weeks', ico: '🏆' },
  { hash: '#/rivals', label: 'Rivals', ico: '⚔️' },
  { hash: '#/settings', label: 'Settings', ico: '⚙️' },
];

function chrome(content, activeTab) {
  const s = state.data.settings;
  return `
    <header class="topbar">
      <span class="title">🌸 ${esc(s.guildName)}</span>
      <span class="rolechip ${isAdmin() ? 'admin' : ''}">${isAdmin() ? 'Admin' : 'Viewer'}</span>
      <button class="btn secondary small" id="logout">Log out</button>
    </header>
    ${content}
    <nav class="tabs">
      ${TABS.map(t => `<a href="${t.hash}" class="${activeTab === t.hash ? 'active' : ''}"><span class="ico">${t.ico}</span>${t.label}</a>`).join('')}
    </nav>`;
}

function bindChrome() {
  $('#logout')?.addEventListener('click', async () => {
    await api('/api/logout', 'POST', {});
    state.role = null;
    render();
  });
}

// ------------------------------------------------------------------ login --

function renderLogin() {
  app().innerHTML = `
    <div class="login">
      <div class="flower">🌸</div>
      <h1>Guild HQ</h1>
      <p class="muted">The Cozy Florist — guild leadership tracker</p>
      <form id="loginform">
        <label for="pw">Password</label>
        <input type="password" id="pw" autocomplete="current-password" autofocus>
        <button class="btn" style="width:100%">Enter</button>
      </form>
    </div>`;
  $('#loginform').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await api('/api/login', 'POST', { password: $('#pw').value });
      await loadData();
      location.hash = '#/dashboard';
      render();
    } catch (err) {
      toast(err.message, true);
    }
  });
}

// -------------------------------------------------------------- dashboard --

function renderDashboard() {
  const d = state.data, s = d.settings;
  const active = d.members.filter(m => m.active);
  const totalOwned = d.members.reduce((n, m) => n + (m.flowerIds || []).length, 0);
  const pot = guildPotential();

  const byRarity = new Map();
  for (const m of d.members) {
    for (const fid of m.flowerIds || []) {
      const f = flowerById(fid);
      if (!f) continue;
      byRarity.set(f.rarity || 'none', (byRarity.get(f.rarity || 'none') || 0) + 1);
    }
  }
  const rarityChips = [...RARITIES.map(r => ({ ...r, count: byRarity.get(r.key) || 0 })), { key: 'none', label: 'No rarity', color: 'none', count: byRarity.get('none') || 0 }]
    .filter(r => r.count)
    .map(r => `<span class="tag tag-${r.color}" style="margin:2px 4px 2px 0">${r.key === 'none' ? r.label : r.key} · ${r.count}</span>`)
    .join('') || '<p class="muted">No flowers recorded yet.</p>';

  const comps = [...d.competitions].sort((a, b) => cmp(b.weekStart, a.weekStart));
  const latest = comps[0];
  let latestCard = '';
  if (latest) {
    const rivals = [...(latest.competitors || [])].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    const top = rivals[0];
    latestCard = `
      <div class="card">
        <h2 style="margin-top:0">Latest week · ${esc(weekLabel(latest))}</h2>
        <p>Our score: <strong>${fmtNum(latest.ourScore)}</strong>
           · Placement: <strong>${ordinal(latest.ourPlacement)}</strong>
           ${latest.ourRankTitle ? `· ${esc(latest.ourRankTitle)}` : ''}</p>
        ${top ? `<p class="muted">Top rival: ${esc(top.name)} (${fmtNum(top.score)})</p>` : ''}
        <a href="#/weeks/${latest.id}" class="backlink">Open week →</a>
      </div>`;
  }

  app().innerHTML = chrome(`
    <h1>Guild strength</h1>
    <div class="cardgrid">
      <div class="card stat">
        <div class="num">${active.length}<span class="muted" style="font-size:1rem">/${s.memberCapacity}</span></div>
        <div class="lbl">Members</div>
        <div class="sub">${d.members.length - active.length} inactive</div>
      </div>
      <div class="card stat">
        <div class="num">${totalOwned}</div>
        <div class="lbl">Flowers owned</div>
        <div class="sub">${d.flowers.length} types in catalogue</div>
      </div>
      <div class="card stat">
        <div class="num">${fmtNum(pot.value)}</div>
        <div class="lbl">Max potential <span class="badge">est.</span></div>
        <div class="sub">tunable in Settings</div>
      </div>
      <div class="card stat">
        <div class="num">${comps.length}</div>
        <div class="lbl">Weeks logged</div>
        <div class="sub">${comps.reduce((n, c) => n + (c.competitors || []).length, 0)} rival records</div>
      </div>
    </div>

    <div class="card">
      <h2 style="margin-top:0">Flowers owned by rarity</h2>
      ${rarityChips}
    </div>

    ${latestCard}

    <div class="card">
      <h2 style="margin-top:0">Max potential — how it's calculated</h2>
      <p class="muted">Estimate: ${esc(pot.basis)}.
      Flower→quest scoring in game isn't fully known, so tune the inputs under
      <a href="#/settings">Settings → Potential estimate</a> as the real relationship becomes clear.</p>
    </div>
  `, '#/dashboard');
  bindChrome();
}

// ---------------------------------------------------------------- members --

function memberRows() {
  const q = ui.search.members.toLowerCase();
  let rows = state.data.members.filter(m =>
    (ui.filters.showInactive || m.active) &&
    (!ui.filters.membersRole || m.role === ui.filters.membersRole) &&
    (!q || m.name.toLowerCase().includes(q) || (m.timezone || '').toLowerCase().includes(q))
  );
  const { key, dir } = ui.sort.members;
  const val = m => ({
    name: m.name, role: ROLES.indexOf(m.role), timezone: m.timezone || null,
    quests: m.questCount, flowers: (m.flowerIds || []).length, potential: memberPotential(m),
  })[key];
  rows.sort((a, b) => dir * cmp(val(a), val(b)));
  return rows;
}

function renderMembersTable() {
  const rows = memberRows();
  $('#members-table').innerHTML = rows.length ? `
    <div class="tablewrap">
    <table data-sortview="members">
      <thead><tr>
        <th data-key="name" class="${sortArrow('members', 'name')}">Name</th>
        <th data-key="role" class="${sortArrow('members', 'role')}">Role</th>
        <th data-key="timezone" class="${sortArrow('members', 'timezone')}">Timezone</th>
        <th data-key="quests" class="${sortArrow('members', 'quests')}">Quests</th>
        <th data-key="flowers" class="${sortArrow('members', 'flowers')}">Flowers</th>
        <th data-key="potential" class="${sortArrow('members', 'potential')}">Potential</th>
      </tr></thead>
      <tbody>
        ${rows.map(m => `
          <tr class="rowlink" data-go="#/members/${m.id}">
            <td>${esc(m.name)}${m.active ? '' : ' <span class="muted small">(inactive)</span>'}</td>
            <td>${roleTag(m.role)}</td>
            <td>${esc(m.timezone || '—')}</td>
            <td>${m.questCount}</td>
            <td>${(m.flowerIds || []).length}</td>
            <td>${fmtNum(memberPotential(m))}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    </div>`
    : `<div class="empty"><div class="big">👥</div>No members match.${isAdmin() ? ' Add your roster with the button above.' : ''}</div>`;
  bindSortHeaders('members', renderMembersTable);
  document.querySelectorAll('#members-table [data-go]').forEach(tr =>
    tr.addEventListener('click', () => { location.hash = tr.dataset.go; }));
}

function renderMembers() {
  app().innerHTML = chrome(`
    <h1>Members</h1>
    <div class="toolbar">
      <input type="search" id="msearch" placeholder="Search name or timezone…" value="${esc(ui.search.members)}">
      <select id="mrole">
        <option value="">All roles</option>
        ${ROLES.map(r =>
          `<option ${ui.filters.membersRole === r ? 'selected' : ''}>${r}</option>`).join('')}
      </select>
      <label class="inline"><input type="checkbox" id="minactive" ${ui.filters.showInactive ? 'checked' : ''}>Inactive</label>
      ${isAdmin() ? '<button class="btn small" id="addmember">+ Add</button>' : ''}
    </div>
    <div id="members-table"></div>
  `, '#/members');
  bindChrome();
  renderMembersTable();
  $('#msearch').addEventListener('input', e => { ui.search.members = e.target.value; renderMembersTable(); });
  $('#mrole').addEventListener('change', e => { ui.filters.membersRole = e.target.value; renderMembersTable(); });
  $('#minactive').addEventListener('change', e => { ui.filters.showInactive = e.target.checked; renderMembersTable(); });
  $('#addmember')?.addEventListener('click', () => memberFormDialog(null));
}

function memberFormDialog(member) {
  const s = state.data.settings;
  const m = member || { name: '', role: 'Member', timezone: '', active: true, questCount: s.questsMin, notes: '', potentialOverride: null };
  const dlg = openDialog(`
    <h2>${member ? 'Edit member' : 'Add member'}</h2>
    <form id="mform">
      <label>In-game name</label>
      <input name="name" required value="${esc(m.name)}">
      <div class="formrow">
        <div>
          <label>Role</label>
          <select name="role">${ROLES.map(r =>
            `<option ${m.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
        </div>
        <div>
          <label>Timezone</label>
          <input name="timezone" placeholder="e.g. UTC+1, EST" value="${esc(m.timezone)}">
        </div>
      </div>
      <div class="formrow">
        <div>
          <label>Quest count (${s.questsMin}–${s.questsMax})</label>
          <input name="questCount" type="number" min="0" max="99" value="${m.questCount}">
        </div>
        <div>
          <label>Potential override (optional)</label>
          <input name="potentialOverride" type="number" placeholder="auto" value="${m.potentialOverride ?? ''}">
        </div>
      </div>
      <label class="inline" style="margin:6px 0 12px"><input type="checkbox" name="active" ${m.active ? 'checked' : ''}>Active member</label>
      <label>Notes</label>
      <textarea name="notes">${esc(m.notes)}</textarea>
      <button class="btn">${member ? 'Save' : 'Add member'}</button>
      <button class="btn secondary" type="button" data-close>Cancel</button>
    </form>`);
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.querySelector('#mform').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = {
      name: f.get('name'), role: f.get('role'), timezone: f.get('timezone'),
      questCount: f.get('questCount'), potentialOverride: f.get('potentialOverride') || null,
      active: f.get('active') === 'on', notes: f.get('notes'),
    };
    const ok = await saveAndReload(
      () => member ? api(`/api/members/${member.id}`, 'PUT', body) : api('/api/members', 'POST', body),
      member ? 'Member saved' : 'Member added');
    if (ok) dlg.close();
  });
}

function renderMemberDetail(id) {
  const m = memberById(id);
  if (!m) { location.hash = '#/members'; return; }
  const flowers = (m.flowerIds || []).map(flowerById).filter(Boolean);
  const { key, dir } = ui.sort.memberFlowers;
  const val = f => ({
    name: f.name, rarity: rarityRank(f.rarity), points: f.points,
    bonus: flowerBonus(m, f.id), total: (f.points || 0) + flowerBonus(m, f.id),
  })[key];
  flowers.sort((a, b) => dir * cmp(val(a), val(b)) || cmp(a.name, b.name));

  const history = [...state.data.competitions]
    .map(c => ({ c, r: (c.memberResults || []).find(r => r.memberId === id) }))
    .filter(x => x.r)
    .sort((a, b) => cmp(b.c.weekStart, a.c.weekStart));

  app().innerHTML = chrome(`
    <a href="#/members" class="backlink">← Members</a>
    <h1>${esc(m.name)} ${m.active ? '' : '<span class="muted" style="font-size:.9rem">(inactive)</span>'}</h1>
    <div class="card">
      <p>${roleTag(m.role)} · ${esc(m.timezone || 'no timezone')} · ${m.questCount} quests/week</p>
      <p>Max potential: <strong>${fmtNum(memberPotential(m))}</strong>
        ${m.potentialOverride != null ? '<span class="badge">manual</span>' : '<span class="badge">est.</span>'}</p>
      ${m.notes ? `<p class="muted" style="white-space:pre-wrap">${esc(m.notes)}</p>` : ''}
      ${isAdmin() ? `
        <button class="btn small" id="editmember">Edit</button>
        <button class="btn danger small" id="delmember">Delete</button>` : ''}
    </div>

    <div class="card">
      <h2 style="margin-top:0">Flowers owned (${flowers.length})</h2>
      ${flowers.length ? `
        <div class="tablewrap"><table data-sortview="memberFlowers">
          <thead><tr>
            <th data-key="name" class="${sortArrow('memberFlowers', 'name')}">Flower</th>
            <th data-key="rarity" class="${sortArrow('memberFlowers', 'rarity')}">Rarity</th>
            <th data-key="points" class="${sortArrow('memberFlowers', 'points')}">Points</th>
            <th data-key="bonus" class="${sortArrow('memberFlowers', 'bonus')}">Bonus</th>
            <th data-key="total" class="${sortArrow('memberFlowers', 'total')}">Total</th>
            ${isAdmin() ? '<th></th>' : ''}
          </tr></thead>
          <tbody>${flowers.map(f => `
            <tr>
              <td>${esc(f.name)}</td>
              <td>${rarityTag(f.rarity)}</td>
              <td>${fmtNum(f.points)}</td>
              <td>${isAdmin()
                ? `<input type="number" inputmode="numeric" min="0" style="width:70px;margin:0;padding:6px" data-bonus="${f.id}" value="${flowerBonus(m, f.id) || ''}" placeholder="0">`
                : fmtNum(flowerBonus(m, f.id) || null)}</td>
              <td><strong data-total="${f.id}">${fmtNum((f.points || 0) + flowerBonus(m, f.id))}</strong></td>
              ${isAdmin() ? `<td><button class="btn danger small" data-removeflower="${f.id}" title="Remove">✕</button></td>` : ''}
            </tr>`).join('')}
          </tbody></table></div>`
        : '<p class="muted">None recorded.</p>'}
      ${isAdmin() ? '<div style="margin-top:8px"><button class="btn secondary small" id="addflowers">+ Add flowers</button></div>' : ''}
    </div>

    <div class="card">
      <h2 style="margin-top:0">Weekly performance</h2>
      ${history.length ? `
        <div class="tablewrap"><table>
          <thead><tr><th>Week</th><th>Quests</th><th>Score</th><th></th></tr></thead>
          <tbody>${history.map(({ c, r }) => `
            <tr class="rowlink" data-go="#/weeks/${c.id}">
              <td>${esc(weekLabel(c))}</td>
              <td>${fmtNum(r.questsCompleted)}</td>
              <td>${fmtNum(r.finalScore)}</td>
              <td class="muted small">${(r.questDetail || []).length ? `${r.questDetail.length} quests logged` : ''}</td>
            </tr>`).join('')}
          </tbody></table></div>`
        : '<p class="muted">No results yet — record them inside a competition week.</p>'}
    </div>
  `, '#/members');
  bindChrome();
  bindSortHeaders('memberFlowers', () => renderMemberDetail(id));
  document.querySelectorAll('[data-go]').forEach(tr =>
    tr.addEventListener('click', () => { location.hash = tr.dataset.go; }));
  document.querySelectorAll('[data-bonus]').forEach(inp => {
    // live total while typing; persist on change (blur/steppers)
    inp.addEventListener('input', () => {
      const f = flowerById(inp.dataset.bonus);
      const total = document.querySelector(`[data-total="${inp.dataset.bonus}"]`);
      if (f && total) total.textContent = fmtNum((f.points || 0) + (Number(inp.value) || 0));
    });
    inp.addEventListener('change', () => {
      const bonuses = { ...(m.flowerBonuses || {}) };
      const v = Number(inp.value);
      if (v > 0) bonuses[inp.dataset.bonus] = v; else delete bonuses[inp.dataset.bonus];
      saveAndReload(() => api(`/api/members/${m.id}`, 'PUT', { flowerBonuses: bonuses }), 'Bonus saved');
    });
  });
  $('#editmember')?.addEventListener('click', () => memberFormDialog(m));
  $('#delmember')?.addEventListener('click', async () => {
    if (!confirm(`Delete ${m.name}? Their weekly results will also be removed. (Tip: mark inactive instead to keep history.)`)) return;
    const ok = await saveAndReload(() => api(`/api/members/${m.id}`, 'DELETE'), 'Member deleted');
    if (ok) location.hash = '#/members';
  });
  document.querySelectorAll('[data-removeflower]').forEach(btn =>
    btn.addEventListener('click', () => {
      const flowerIds = (m.flowerIds || []).filter(fid => fid !== btn.dataset.removeflower);
      saveAndReload(() => api(`/api/members/${m.id}`, 'PUT', { flowerIds }), 'Flower removed');
    }));
  $('#addflowers')?.addEventListener('click', () => addFlowersDialog(m));
}

function addFlowersDialog(m) {
  const owned = new Set(m.flowerIds || []);
  const available = state.data.flowers.filter(f => !owned.has(f.id)).sort((a, b) => cmp(a.name, b.name));
  const dlg = openDialog(`
    <h2>Add flowers to ${esc(m.name)}</h2>
    ${available.length ? `
      <input type="search" id="fsearch" placeholder="Filter…">
      <form id="fform" style="max-height:44dvh;overflow-y:auto">
        ${available.map(f => `
          <label class="inline" data-fname="${esc(f.name.toLowerCase())}" style="padding:5px 0">
            <input type="checkbox" name="fid" value="${f.id}">
            ${esc(f.name)} ${rarityTag(f.rarity)} <span class="muted small">· ${fmtNum(f.points)} pts</span>
          </label>`).join('')}
      </form>
      <button class="btn" id="fsave">Add selected</button>`
      : '<p class="muted">Every catalogued flower is already owned — add new flowers on the Flowers tab first.</p>'}
    <button class="btn secondary" data-close>Close</button>`);
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.querySelector('#fsearch')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    dlg.querySelectorAll('[data-fname]').forEach(el =>
      el.style.display = el.dataset.fname.includes(q) ? '' : 'none');
  });
  dlg.querySelector('#fsave')?.addEventListener('click', async () => {
    const ids = [...dlg.querySelectorAll('input[name="fid"]:checked')].map(i => i.value);
    if (!ids.length) { dlg.close(); return; }
    const ok = await saveAndReload(
      () => api(`/api/members/${m.id}`, 'PUT', { flowerIds: [...(m.flowerIds || []), ...ids] }),
      `${ids.length} flower(s) added`);
    if (ok) dlg.close();
  });
}

// ---------------------------------------------------------------- flowers --

function renderFlowersTable() {
  const q = ui.search.flowers.toLowerCase();
  let rows = state.data.flowers.filter(f =>
    (!ui.filters.flowersRarity || f.rarity === ui.filters.flowersRarity) &&
    (!q || f.name.toLowerCase().includes(q)));
  const { key, dir } = ui.sort.flowers;
  const val = f => ({
    name: f.name, rarity: rarityRank(f.rarity),
    points: f.points, owners: flowerOwners(f.id).length,
  })[key];
  rows.sort((a, b) => dir * cmp(val(a), val(b)));

  $('#flowers-table').innerHTML = rows.length ? `
    <div class="tablewrap">
    <table data-sortview="flowers">
      <thead><tr>
        <th data-key="name" class="${sortArrow('flowers', 'name')}">Flower</th>
        <th data-key="rarity" class="${sortArrow('flowers', 'rarity')}">Rarity</th>
        <th data-key="points" class="${sortArrow('flowers', 'points')}">Points</th>
        <th data-key="owners" class="${sortArrow('flowers', 'owners')}">Owners</th>
      </tr></thead>
      <tbody>${rows.map(f => `
        <tr class="rowlink" data-flower="${f.id}">
          <td>${esc(f.name)}</td>
          <td>${rarityTag(f.rarity)}</td>
          <td>${fmtNum(f.points)}</td>
          <td>${flowerOwners(f.id).length}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>`
    : `<div class="empty"><div class="big">🌸</div>No flowers yet.${isAdmin() ? ' Add your first with the button above.' : ''}</div>`;
  bindSortHeaders('flowers', renderFlowersTable);
  document.querySelectorAll('#flowers-table [data-flower]').forEach(tr =>
    tr.addEventListener('click', () => flowerDialog(tr.dataset.flower)));
}

function renderFlowers() {
  app().innerHTML = chrome(`
    <h1>Flowers</h1>
    <div class="toolbar">
      <input type="search" id="fsearch" placeholder="Search flowers…" value="${esc(ui.search.flowers)}">
      <select id="frarity">
        <option value="">All rarities</option>
        ${RARITIES.map(r =>
          `<option value="${r.key}" ${ui.filters.flowersRarity === r.key ? 'selected' : ''}>${r.key} — ${r.label}</option>`).join('')}
      </select>
      ${isAdmin() ? '<button class="btn small" id="addflower">+ Flower</button>' : ''}
    </div>
    <div id="flowers-table"></div>
  `, '#/flowers');
  bindChrome();
  renderFlowersTable();
  $('#fsearch').addEventListener('input', e => { ui.search.flowers = e.target.value; renderFlowersTable(); });
  $('#frarity').addEventListener('change', e => { ui.filters.flowersRarity = e.target.value; renderFlowersTable(); });
  $('#addflower')?.addEventListener('click', () => flowerFormDialog(null));
}

function flowerDialog(flowerId) {
  const f = flowerById(flowerId);
  if (!f) return;
  const owners = flowerOwners(flowerId).sort((a, b) => cmp(a.name, b.name));
  const dlg = openDialog(`
    <h2>${esc(f.name)} ${rarityTag(f.rarity)}</h2>
    <p class="muted">${fmtNum(f.points)} points</p>
    <h3>Owned by (${owners.length})</h3>
    ${owners.map(m => `<span class="chip">${esc(m.name)}${flowerBonus(m, f.id) ? ` · +${flowerBonus(m, f.id)}` : ''}</span>`).join('') || '<p class="muted">No owners recorded.</p>'}
    <hr>
    ${isAdmin() ? `
      <button class="btn small" id="editflower">Edit</button>
      <button class="btn danger small" id="delflower">Delete</button>` : ''}
    <button class="btn secondary small" data-close>Close</button>`);
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.querySelector('#editflower')?.addEventListener('click', () => { dlg.close(); flowerFormDialog(f); });
  dlg.querySelector('#delflower')?.addEventListener('click', async () => {
    if (!confirm(`Delete ${f.name}? It will be removed from ${owners.length} member(s).`)) return;
    const ok = await saveAndReload(() => api(`/api/flowers/${f.id}`, 'DELETE'), 'Flower deleted');
    if (ok) dlg.close();
  });
}

function flowerFormDialog(flower) {
  const f = flower || { name: '', rarity: '', points: 0 };
  const dlg = openDialog(`
    <h2>${flower ? 'Edit flower' : 'Add flower'}</h2>
    <form id="fform">
      <label>Name</label>
      <input name="name" required value="${esc(f.name)}">
      <div class="formrow">
        <div>
          <label>Rarity</label>
          <select name="rarity">
            <option value="">No rarity</option>
            ${RARITIES.map(r =>
              `<option value="${r.key}" ${f.rarity === r.key ? 'selected' : ''}>${r.key} — ${r.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Points value</label>
          <input name="points" type="number" step="any" value="${f.points}">
        </div>
      </div>
      <button class="btn">${flower ? 'Save' : 'Add flower'}</button>
      <button class="btn secondary" type="button" data-close>Cancel</button>
    </form>`);
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.querySelector('#fform').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { name: fd.get('name'), rarity: fd.get('rarity') || null, points: fd.get('points') };
    const ok = await saveAndReload(
      () => flower ? api(`/api/flowers/${flower.id}`, 'PUT', body) : api('/api/flowers', 'POST', body),
      flower ? 'Flower saved' : 'Flower added');
    if (ok) dlg.close();
  });
}

// ------------------------------------------------------------------ weeks --

function renderWeeks() {
  const comps = [...state.data.competitions].sort((a, b) => cmp(b.weekStart, a.weekStart));
  app().innerHTML = chrome(`
    <h1>Competition weeks</h1>
    ${isAdmin() ? '<button class="btn small" id="addweek">+ New week</button>' : ''}
    ${comps.length ? comps.map(c => `
      <div class="card rowlink" data-go="#/weeks/${c.id}">
        <strong>${esc(weekLabel(c))}</strong>
        ${c.ourPlacement ? `<span class="chip rose">${ordinal(c.ourPlacement)}</span>` : ''}
        <p class="muted" style="margin:4px 0 0">
          Score ${fmtNum(c.ourScore)}${c.ourRankTitle ? ` · ${esc(c.ourRankTitle)}` : ''}
          · ${(c.competitors || []).length} rivals · ${(c.memberResults || []).length} member results
        </p>
      </div>`).join('')
      : `<div class="empty"><div class="big">🏆</div>No weeks logged yet.</div>`}
  `, '#/weeks');
  bindChrome();
  document.querySelectorAll('[data-go]').forEach(el =>
    el.addEventListener('click', () => { location.hash = el.dataset.go; }));
  $('#addweek')?.addEventListener('click', () => {
    const start = mostRecentTuesday();
    const end = new Date(start);
    end.setDate(end.getDate() + 5);
    const dlg = openDialog(`
      <h2>New competition week</h2>
      <form id="wform">
        <label>Week start (Tuesday)</label>
        <input type="date" name="weekStart" required value="${localISO(start)}">
        <label>Week end (Sunday)</label>
        <input type="date" name="weekEnd" value="${localISO(end)}">
        <button class="btn">Create</button>
        <button class="btn secondary" type="button" data-close>Cancel</button>
      </form>`);
    dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
    dlg.querySelector('#wform').addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        const c = await api('/api/competitions', 'POST', { weekStart: f.get('weekStart'), weekEnd: f.get('weekEnd') });
        await loadData();
        dlg.close();
        location.hash = `#/weeks/${c.id}`;
      } catch (err) { toast(err.message, true); }
    });
  });
}

function ensureWeekDraft(c) {
  if (ui.weekDraft.compId === c.id) return;
  const results = {};
  for (const r of c.memberResults || []) {
    results[r.memberId] = {
      finalScore: r.finalScore, questsCompleted: r.questsCompleted,
      questDetail: (r.questDetail || []).map(q => ({ ...q })),
    };
  }
  ui.weekDraft = { compId: c.id, results };
}

function draftFor(memberId) {
  if (!ui.weekDraft.results[memberId]) {
    ui.weekDraft.results[memberId] = { finalScore: null, questsCompleted: null, questDetail: [] };
  }
  return ui.weekDraft.results[memberId];
}

function renderWeekDetail(id) {
  const c = state.data.competitions.find(x => x.id === id);
  if (!c) { location.hash = '#/weeks'; return; }
  ensureWeekDraft(c);

  // comparison: us + rivals, sorted by score
  const entries = [
    { name: state.data.settings.guildName, score: c.ourScore, ours: true },
    ...(c.competitors || []).map(r => ({ name: r.name, score: r.score, ours: false })),
  ].filter(e => e.score !== null && e.score !== undefined)
    .sort((a, b) => b.score - a.score);
  const maxScore = Math.max(1, ...entries.map(e => e.score));

  // competitors table
  const { key, dir } = ui.sort.weekCompetitors;
  const rivals = [...(c.competitors || [])].sort((a, b) => dir * cmp(a[key], b[key]));

  // member results: active members plus anyone with a saved/draft result
  const withData = new Set([
    ...(c.memberResults || []).map(r => r.memberId),
    ...Object.keys(ui.weekDraft.results),
  ]);
  const resultMembers = state.data.members
    .filter(m => m.active || withData.has(m.id))
    .sort((a, b) => cmp(a.name, b.name));
  const saved = new Map((c.memberResults || []).map(r => [r.memberId, r]));

  app().innerHTML = chrome(`
    <a href="#/weeks" class="backlink">← Weeks</a>
    <h1>${esc(weekLabel(c))}</h1>

    <div class="card">
      <h2 style="margin-top:0">Our result</h2>
      <p>Score <strong>${fmtNum(c.ourScore)}</strong>
        · Placement <strong>${ordinal(c.ourPlacement)}</strong>
        ${c.ourRankTitle ? `· ${esc(c.ourRankTitle)}` : ''}</p>
      ${c.notes ? `<p class="muted" style="white-space:pre-wrap">${esc(c.notes)}</p>` : ''}
      ${isAdmin() ? `
        <button class="btn small" id="editweek">Edit</button>
        <button class="btn danger small" id="delweek">Delete week</button>` : ''}
    </div>

    ${entries.length > 1 ? `
    <div class="card">
      <h2 style="margin-top:0">Score comparison</h2>
      ${entries.map(e => `
        <div class="bar ${e.ours ? 'ours' : ''}">
          <span class="name">${esc(e.name)}</span>
          <span class="track"><span class="fill" style="width:${Math.round(100 * e.score / maxScore)}%"></span></span>
          <span class="val">${fmtNum(e.score)}</span>
        </div>`).join('')}
    </div>` : ''}

    <div class="card">
      <h2 style="margin-top:0">Rival guilds (${rivals.length})</h2>
      ${rivals.length ? `
        <div class="tablewrap"><table data-sortview="weekCompetitors">
          <thead><tr>
            <th data-key="name" class="${sortArrow('weekCompetitors', 'name')}">Guild</th>
            <th data-key="score" class="${sortArrow('weekCompetitors', 'score')}">Score</th>
            <th data-key="rankTitle" class="${sortArrow('weekCompetitors', 'rankTitle')}">Rank</th>
            <th data-key="placement" class="${sortArrow('weekCompetitors', 'placement')}">Place</th>
          </tr></thead>
          <tbody>${rivals.map(r => `
            <tr class="${isAdmin() ? 'rowlink' : ''}" data-rival="${r.id}">
              <td>${esc(r.name)}</td><td>${fmtNum(r.score)}</td>
              <td>${esc(r.rankTitle || '—')}</td><td>${ordinal(r.placement)}</td>
            </tr>`).join('')}
          </tbody></table></div>` : '<p class="muted">No rivals logged for this week yet.</p>'}
      ${isAdmin() ? '<button class="btn secondary small" id="addrival">+ Add rival</button>' : ''}
    </div>

    <div class="card">
      <h2 style="margin-top:0">Member results</h2>
      ${resultMembers.length ? `
        <div class="tablewrap"><table>
          <thead><tr><th>Member</th><th>Quests</th><th>Score</th><th>Detail</th></tr></thead>
          <tbody>${resultMembers.map(m => {
            const d = isAdmin() ? draftFor(m.id) : (saved.get(m.id) || {});
            const detailCount = (d.questDetail || []).length;
            return `<tr>
              <td>${esc(m.name)}${m.active ? '' : ' <span class="muted small">(inactive)</span>'}</td>
              <td>${isAdmin()
                ? `<input type="number" inputmode="numeric" style="width:74px;margin:0;padding:6px" data-quests="${m.id}" value="${d.questsCompleted ?? ''}">`
                : fmtNum(d.questsCompleted)}</td>
              <td>${isAdmin()
                ? `<input type="number" inputmode="numeric" style="width:88px;margin:0;padding:6px" data-score="${m.id}" value="${d.finalScore ?? ''}">`
                : fmtNum(d.finalScore)}</td>
              <td>${isAdmin()
                ? `<button class="btn secondary small" data-detail="${m.id}">${detailCount ? detailCount + ' quests' : '+ quests'}</button>`
                : (detailCount ? `<button class="btn secondary small" data-viewdetail="${m.id}">${detailCount} quests</button>` : '—')}</td>
            </tr>`;
          }).join('')}
          </tbody></table></div>
        ${isAdmin() ? `
          <button class="btn" id="saveresults">Save results</button>
          <p class="muted small">Rows left fully blank aren't stored. Quest detail is optional.</p>` : ''}
        <button class="btn secondary small" id="exportcsv">Export CSV</button>`
        : '<p class="muted">No members on the roster yet.</p>'}
    </div>
  `, '#/weeks');
  bindChrome();
  bindSortHeaders('weekCompetitors', () => renderWeekDetail(id));

  $('#editweek')?.addEventListener('click', () => weekFormDialog(c));
  $('#delweek')?.addEventListener('click', async () => {
    if (!confirm('Delete this week and all its results and rival records?')) return;
    const ok = await saveAndReload(() => api(`/api/competitions/${c.id}`, 'DELETE'), 'Week deleted');
    if (ok) location.hash = '#/weeks';
  });

  $('#addrival')?.addEventListener('click', () => rivalFormDialog(c, null));
  if (isAdmin()) {
    document.querySelectorAll('[data-rival]').forEach(tr =>
      tr.addEventListener('click', () => {
        const r = (c.competitors || []).find(x => x.id === tr.dataset.rival);
        if (r) rivalFormDialog(c, r);
      }));
  }

  // draft inputs update state only (no re-render → keyboard stays open)
  document.querySelectorAll('[data-quests]').forEach(inp =>
    inp.addEventListener('input', () => {
      draftFor(inp.dataset.quests).questsCompleted = inp.value === '' ? null : Number(inp.value);
    }));
  document.querySelectorAll('[data-score]').forEach(inp =>
    inp.addEventListener('input', () => {
      draftFor(inp.dataset.score).finalScore = inp.value === '' ? null : Number(inp.value);
    }));
  document.querySelectorAll('[data-detail]').forEach(btn =>
    btn.addEventListener('click', () => questDetailDialog(c, btn.dataset.detail, true)));
  document.querySelectorAll('[data-viewdetail]').forEach(btn =>
    btn.addEventListener('click', () => questDetailDialog(c, btn.dataset.viewdetail, false)));

  $('#saveresults')?.addEventListener('click', async () => {
    const memberResults = Object.entries(ui.weekDraft.results)
      .filter(([, d]) => d.finalScore != null || d.questsCompleted != null || (d.questDetail || []).length)
      .map(([memberId, d]) => ({ memberId, ...d }));
    const ok = await saveAndReload(
      () => api(`/api/competitions/${c.id}`, 'PUT', { memberResults }),
      'Results saved');
    if (ok) ui.weekDraft = { compId: null, results: {} };
  });

  $('#exportcsv')?.addEventListener('click', () => {
    const rows = [['Member', 'Role', 'Quests completed', 'Final score']];
    for (const m of resultMembers) {
      const r = saved.get(m.id);
      rows.push([m.name, m.role, r?.questsCompleted ?? '', r?.finalScore ?? '']);
    }
    rows.push([]);
    rows.push(['Our guild score', c.ourScore ?? '', 'Placement', c.ourPlacement ?? '']);
    for (const r of c.competitors || []) rows.push([`Rival: ${r.name}`, r.score ?? '', r.rankTitle ?? '', r.placement ?? '']);
    downloadFile(`guild-week-${c.weekStart || 'undated'}.csv`,
      rows.map(row => row.map(csvCell).join(',')).join('\n'));
    toast('CSV exported (saved data only)');
  });
}

function weekFormDialog(c) {
  const dlg = openDialog(`
    <h2>Edit week</h2>
    <form id="wform">
      <div class="formrow">
        <div><label>Start</label><input type="date" name="weekStart" value="${esc(c.weekStart)}"></div>
        <div><label>End</label><input type="date" name="weekEnd" value="${esc(c.weekEnd)}"></div>
      </div>
      <div class="formrow3">
        <div><label>Our score</label><input type="number" name="ourScore" value="${c.ourScore ?? ''}"></div>
        <div><label>Rank title</label><input name="ourRankTitle" value="${esc(c.ourRankTitle)}"></div>
        <div><label>Placement</label><input type="number" name="ourPlacement" min="1" max="10" value="${c.ourPlacement ?? ''}"></div>
      </div>
      <label>Notes</label>
      <textarea name="notes">${esc(c.notes)}</textarea>
      <button class="btn">Save</button>
      <button class="btn secondary" type="button" data-close>Cancel</button>
    </form>`);
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.querySelector('#wform').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const ok = await saveAndReload(() => api(`/api/competitions/${c.id}`, 'PUT', {
      weekStart: f.get('weekStart'), weekEnd: f.get('weekEnd'),
      ourScore: f.get('ourScore') || null, ourRankTitle: f.get('ourRankTitle'),
      ourPlacement: f.get('ourPlacement') || null, notes: f.get('notes'),
    }), 'Week saved');
    if (ok) dlg.close();
  });
}

function rivalFormDialog(c, rival) {
  const r = rival || { name: '', score: null, rankTitle: '', placement: null };
  const dlg = openDialog(`
    <h2>${rival ? 'Edit rival' : 'Add rival guild'}</h2>
    <form id="rform">
      <label>Guild name</label>
      <input name="name" required value="${esc(r.name)}" list="rivalnames">
      <datalist id="rivalnames">
        ${[...new Set(state.data.competitions.flatMap(x => (x.competitors || []).map(v => v.name)))]
          .sort().map(n => `<option value="${esc(n)}">`).join('')}
      </datalist>
      <div class="formrow3">
        <div><label>Score</label><input type="number" name="score" value="${r.score ?? ''}"></div>
        <div><label>Rank title</label><input name="rankTitle" value="${esc(r.rankTitle)}"></div>
        <div><label>Placement</label><input type="number" name="placement" min="1" max="10" value="${r.placement ?? ''}"></div>
      </div>
      <button class="btn">${rival ? 'Save' : 'Add'}</button>
      ${rival ? '<button class="btn danger" type="button" id="delrival">Delete</button>' : ''}
      <button class="btn secondary" type="button" data-close>Cancel</button>
    </form>`);
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.querySelector('#rform').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const entry = {
      id: rival?.id, name: f.get('name'), score: f.get('score') || null,
      rankTitle: f.get('rankTitle'), placement: f.get('placement') || null,
      estimate: rival?.estimate ?? null,
    };
    const competitors = rival
      ? (c.competitors || []).map(x => x.id === rival.id ? entry : x)
      : [...(c.competitors || []), entry];
    const ok = await saveAndReload(
      () => api(`/api/competitions/${c.id}`, 'PUT', { competitors }),
      rival ? 'Rival saved' : 'Rival added');
    if (ok) dlg.close();
  });
  dlg.querySelector('#delrival')?.addEventListener('click', async () => {
    const competitors = (c.competitors || []).filter(x => x.id !== rival.id);
    const ok = await saveAndReload(() => api(`/api/competitions/${c.id}`, 'PUT', { competitors }), 'Rival removed');
    if (ok) dlg.close();
  });
}

function questDetailDialog(c, memberId, editable) {
  const m = memberById(memberId);
  const s = state.data.settings;
  const d = editable ? draftFor(memberId)
    : ((c.memberResults || []).find(r => r.memberId === memberId) || { questDetail: [] });
  const rows = () => d.questDetail || (d.questDetail = []);

  const questScore = q => Math.round(q.base * (q.maxed ? s.maxMultiplier : 1) + (q.bonus || 0));
  const total = () => rows().reduce((n, q) => n + questScore(q), 0);

  function body() {
    return `
      <h2>Quests — ${esc(m ? m.name : 'member')}</h2>
      <p class="muted small">Base scores come from Settings. Maxed = ×${s.maxMultiplier}. Bonus ${s.bonusMin}–${s.bonusMax}.</p>
      <div id="qrows">
        ${rows().map((q, i) => `
          <div class="questrow">
            ${editable ? `
              <select data-qbase="${i}">
                ${s.baseQuestScores.map(b => `<option value="${b}" ${q.base === b ? 'selected' : ''}>${b}</option>`).join('')}
              </select>
              <label class="inline"><input type="checkbox" data-qmax="${i}" ${q.maxed ? 'checked' : ''}>max</label>
              <input type="number" data-qbonus="${i}" min="0" max="${s.bonusMax}" value="${q.bonus || 0}" title="bonus">
              <strong style="text-align:right">${questScore(q)}</strong>
              <button class="btn danger small" data-qdel="${i}">✕</button>`
              : `
              <span>Base ${q.base}</span><span>${q.maxed ? 'maxed' : ''}</span>
              <span>+${q.bonus || 0}</span><strong style="text-align:right">${questScore(q)}</strong><span></span>`}
          </div>`).join('') || '<p class="muted">No quests logged.</p>'}
      </div>
      <p><strong>Total: ${total()}</strong> · ${rows().length} quests</p>
      ${editable ? `
        <button class="btn secondary small" id="qadd">+ Quest</button>
        <button class="btn small" id="qapply">Use total as score & count</button>
        <hr>` : ''}
      <button class="btn secondary" data-close>${editable ? 'Done' : 'Close'}</button>`;
  }

  const dlg = openDialog(body());

  function bind() {
    dlg.querySelector('[data-close]').addEventListener('click', () => {
      dlg.close();
      if (editable) renderWeekDetail(c.id); // refresh detail-count buttons
    });
    if (!editable) return;
    dlg.querySelector('#qadd').addEventListener('click', () => {
      rows().push({ base: s.baseQuestScores[s.baseQuestScores.length - 1] || 0, maxed: false, bonus: 0 });
      rerender();
    });
    dlg.querySelector('#qapply').addEventListener('click', () => {
      d.finalScore = total();
      d.questsCompleted = rows().length;
      toast(`Set score ${d.finalScore}, ${d.questsCompleted} quests — remember to Save results`);
      dlg.close();
      renderWeekDetail(c.id);
    });
    dlg.querySelectorAll('[data-qbase]').forEach(el =>
      el.addEventListener('change', () => { rows()[el.dataset.qbase].base = Number(el.value); rerender(); }));
    dlg.querySelectorAll('[data-qmax]').forEach(el =>
      el.addEventListener('change', () => { rows()[el.dataset.qmax].maxed = el.checked; rerender(); }));
    dlg.querySelectorAll('[data-qbonus]').forEach(el =>
      el.addEventListener('input', () => { rows()[el.dataset.qbonus].bonus = Number(el.value) || 0; rerender(); }));
    dlg.querySelectorAll('[data-qdel]').forEach(el =>
      el.addEventListener('click', () => { rows().splice(Number(el.dataset.qdel), 1); rerender(); }));
  }
  function rerender() { dlg.innerHTML = body(); bind(); }
  bind();
}

// ----------------------------------------------------------------- rivals --

function rivalRecords() {
  const out = [];
  for (const c of state.data.competitions) {
    for (const r of c.competitors || []) {
      out.push({ comp: c, r, date: c.weekStart || '' });
    }
  }
  return out;
}

function renderRivalsTable() {
  const q = ui.search.rivals.toLowerCase();
  let rows = rivalRecords().filter(x => !q || x.r.name.toLowerCase().includes(q));
  const { key, dir } = ui.sort.rivals;
  const val = x => ({ date: x.date, name: x.r.name, score: x.r.score, placement: x.r.placement })[key];
  rows.sort((a, b) => dir * cmp(val(a), val(b)));

  // summary card when a search narrows to a single guild
  const names = [...new Set(rows.map(x => x.r.name.toLowerCase()))];
  let summary = '';
  if (q && names.length === 1 && rows.length) {
    const scores = rows.map(x => x.r.score).filter(v => v != null);
    const best = scores.length ? Math.max(...scores) : null;
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const last = [...rows].sort((a, b) => cmp(b.date, a.date))[0];
    summary = `
      <div class="card">
        <h2 style="margin-top:0">${esc(last.r.name)}</h2>
        <p>Faced <strong>${rows.length}×</strong> · best score <strong>${fmtNum(best)}</strong>
          · avg <strong>${fmtNum(avg)}</strong></p>
        <p class="muted">Last met ${esc(weekLabel(last.comp))}: scored ${fmtNum(last.r.score)},
          placed ${ordinal(last.r.placement)}${last.r.rankTitle ? ` (${esc(last.r.rankTitle)})` : ''}.</p>
      </div>`;
  }

  $('#rivals-table').innerHTML = summary + (rows.length ? `
    <div class="tablewrap">
    <table data-sortview="rivals">
      <thead><tr>
        <th data-key="date" class="${sortArrow('rivals', 'date')}">Week</th>
        <th data-key="name" class="${sortArrow('rivals', 'name')}">Guild</th>
        <th data-key="score" class="${sortArrow('rivals', 'score')}">Score</th>
        <th>Rank</th>
        <th data-key="placement" class="${sortArrow('rivals', 'placement')}">Place</th>
      </tr></thead>
      <tbody>${rows.map(x => `
        <tr class="rowlink" data-name="${esc(x.r.name)}" data-week="${x.comp.id}">
          <td>${esc(weekLabel(x.comp))}</td>
          <td>${esc(x.r.name)}</td>
          <td>${fmtNum(x.r.score)}</td>
          <td>${esc(x.r.rankTitle || '—')}</td>
          <td>${ordinal(x.r.placement)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>
    <p class="muted small">Tap a row to see that guild's full history; tap the week column header to sort by date.</p>`
    : `<div class="empty"><div class="big">⚔️</div>No rival records${q ? ' match' : ' yet — log them inside each competition week'}.</div>`);

  bindSortHeaders('rivals', renderRivalsTable);
  document.querySelectorAll('#rivals-table tr[data-name]').forEach(tr =>
    tr.addEventListener('click', () => {
      if (ui.search.rivals.toLowerCase() === tr.dataset.name.toLowerCase()) {
        location.hash = `#/weeks/${tr.dataset.week}`;
      } else {
        ui.search.rivals = tr.dataset.name;
        $('#rsearch').value = tr.dataset.name;
        renderRivalsTable();
      }
    }));
}

// Estimate cards: one per rival guild in a competition week. Count the florist
// titles their members display in-game; each title means "earned ≥ that many
// points", so min = title floors, max = each member up to the NEXT title's
// floor (top title capped at our per-member max-potential estimate). Untitled
// members count at the assumed value from Settings in both. Saved on the
// week's rival record, so the actual score at week's end shows the error.

function maxPerMemberEst() {
  const s = state.data.settings;
  return Math.round(s.questsMax * effScorePerQuest());
}

function rankBounds(key) {
  const fr = state.data.settings.floristRanks;
  const i = FLORIST_RANKS.findIndex(r => r.key === key);
  const min = fr[key] || 0;
  const next = FLORIST_RANKS[i + 1];
  return { min, max: next ? Math.max(min, fr[next.key] || 0) : Math.max(min, maxPerMemberEst()) };
}

function emptyEstimate() {
  const counts = {};
  for (const r of FLORIST_RANKS) counts[r.key] = 0;
  return { totalPlayers: null, counts };
}

function estimateStats(est) {
  const fr = state.data.settings.floristRanks;
  let min = 0, max = 0, titled = 0;
  for (const r of FLORIST_RANKS) {
    const c = (est.counts || {})[r.key] || 0;
    const b = rankBounds(r.key);
    min += c * b.min;
    max += c * b.max;
    titled += c;
  }
  const total = est.totalPlayers ?? titled;
  const untitled = Math.max(0, total - titled);
  min += untitled * (fr.unknown || 0);
  max += untitled * (fr.unknown || 0);
  return {
    min, max, avg: Math.round((min + max) / 2), titled, untitled, total,
    knownPct: total ? Math.round(1000 * titled / total) / 10 : null,
  };
}

function predictionErr(score, avg) {
  if (score === null || score === undefined || score === '') return '—';
  const err = Math.round(score - avg);
  const pct = score ? Math.round(1000 * Math.abs(err) / score) / 10 : 0;
  return `${err >= 0 ? '+' : '−'}${fmtNum(Math.abs(err))} (${pct}%)`;
}

function rivalEstCard(r) {
  const est = r.estimate || emptyEstimate();
  const stats = estimateStats(est);
  const ranksDesc = [...FLORIST_RANKS].reverse();
  const num = (key, value, ph) => isAdmin()
    ? `<input type="number" inputmode="numeric" min="0" data-est="${key}" value="${value ?? ''}" placeholder="${ph}">`
    : `<strong>${fmtNum(value)}</strong>`;
  return `
    <div class="card estcard" data-estcard="${r.id}">
      <h3 class="estname" ${isAdmin() ? `data-editrival="${r.id}" title="Edit rival"` : ''}>${esc(r.name)}</h3>
      <div class="estrow"><span class="muted small">Total players</span>${num('totalPlayers', est.totalPlayers, '?')}</div>
      ${ranksDesc.map(rank => `
        <div class="estrow"><span class="tag tag-${rank.color}">${rank.label}</span>
          ${num(rank.key, (est.counts || {})[rank.key] || null, '0')}</div>`).join('')}
      <div class="estrow"><span class="tag tag-none">Untitled</span><strong data-out="untitled">${stats.untitled}</strong></div>
      <div class="estrow muted small"><span>Known titles</span><span data-out="knownPct">${stats.knownPct === null ? '—' : stats.knownPct + '%'}</span></div>
      <hr>
      <div class="estscores">
        <div><span class="muted small">Min</span><strong data-out="min">${fmtNum(stats.min)}</strong></div>
        <div><span class="muted small">Average</span><strong data-out="avg">${fmtNum(stats.avg)}</strong></div>
        <div><span class="muted small">Max</span><strong data-out="max">${fmtNum(stats.max)}</strong></div>
      </div>
      <hr>
      <div class="estrow"><span class="muted small">Actual comp score</span>${num('score', r.score, 'TBD')}</div>
      <div class="estrow"><span class="muted small">Prediction error</span><strong data-out="err">${predictionErr(r.score, stats.avg)}</strong></div>
    </div>`;
}

function readCardEstimate(card) {
  const val = key => {
    const el = card.querySelector(`[data-est="${key}"]`);
    return el && el.value !== '' ? Number(el.value) : null;
  };
  const counts = {};
  for (const r of FLORIST_RANKS) counts[r.key] = Math.max(0, Math.round(val(r.key) || 0));
  return { estimate: { totalPlayers: val('totalPlayers'), counts }, score: val('score') };
}

function refreshEstCard(card) {
  const { estimate, score } = readCardEstimate(card);
  const stats = estimateStats(estimate);
  const set = (key, text) => { card.querySelector(`[data-out="${key}"]`).textContent = text; };
  set('untitled', stats.untitled);
  set('knownPct', stats.knownPct === null ? '—' : stats.knownPct + '%');
  set('min', fmtNum(stats.min));
  set('avg', fmtNum(stats.avg));
  set('max', fmtNum(stats.max));
  set('err', predictionErr(score, stats.avg));
}

// persist quietly (no re-render) so tabbing between card inputs isn't interrupted
async function persistEstimates(c) {
  const competitors = (c.competitors || []).map(r => {
    const card = document.querySelector(`[data-estcard="${r.id}"]`);
    return card ? { ...r, ...readCardEstimate(card) } : r;
  });
  try {
    const updated = await api(`/api/competitions/${c.id}`, 'PUT', { competitors });
    Object.assign(c, updated);
  } catch (err) {
    toast(err.message, true);
  }
}

function renderRivals() {
  const comps = [...state.data.competitions].sort((a, b) => cmp(b.weekStart, a.weekStart));
  if (!comps.some(x => x.id === ui.rivalsWeekId)) ui.rivalsWeekId = comps[0]?.id ?? null;
  const c = comps.find(x => x.id === ui.rivalsWeekId) || null;
  const rivals = c ? [...(c.competitors || [])].sort((a, b) => cmp(a.name, b.name)) : [];

  app().innerHTML = chrome(`
    <h1>Rivals</h1>
    ${comps.length ? `
      <div class="toolbar">
        <select id="rweek">${comps.map(x =>
          `<option value="${x.id}" ${c && x.id === c.id ? 'selected' : ''}>${esc(weekLabel(x))}</option>`).join('')}</select>
        ${isAdmin() && c ? '<button class="btn small" id="estaddrival">+ Add rival</button>' : ''}
      </div>
      <p class="muted small">Fill each card from the florist titles that guild's players display
        in-game. Min uses each title's point floor, max lets every member reach the next title's
        floor; untitled players count at the assumed value. Floors and assumptions are editable
        in Settings. <span class="badge">est.</span></p>
      ${rivals.length
        ? `<div class="rivalcards">${rivals.map(rivalEstCard).join('')}</div>`
        : `<div class="empty"><div class="big">⚔️</div>No rivals in this week yet.${isAdmin() ? ' Add them with the button above.' : ''}</div>`}
      <p class="muted small">Our own max potential: <strong>${fmtNum(guildPotential().value)}</strong> — the number to push past theirs.</p>`
      : '<div class="empty"><div class="big">⚔️</div>Create a competition week first (Weeks tab), then estimate rivals here.</div>'}
    <h2>Competitor history</h2>
    <div class="toolbar">
      <input type="search" id="rsearch" placeholder="Search guild name…" value="${esc(ui.search.rivals)}">
    </div>
    <div id="rivals-table"></div>
  `, '#/rivals');
  bindChrome();
  renderRivalsTable();
  $('#rsearch').addEventListener('input', e => { ui.search.rivals = e.target.value; renderRivalsTable(); });
  $('#rweek')?.addEventListener('change', e => { ui.rivalsWeekId = e.target.value; renderRivals(); });
  $('#estaddrival')?.addEventListener('click', () => rivalFormDialog(c, null));
  document.querySelectorAll('[data-editrival]').forEach(el =>
    el.addEventListener('click', () => {
      const r = (c.competitors || []).find(x => x.id === el.dataset.editrival);
      if (r) rivalFormDialog(c, r);
    }));
  document.querySelectorAll('[data-estcard]').forEach(card => {
    card.querySelectorAll('[data-est]').forEach(inp => {
      inp.addEventListener('input', () => refreshEstCard(card));
      inp.addEventListener('change', () => persistEstimates(c));
    });
  });
}

// --------------------------------------------------------------- settings --

function renderSettings() {
  const s = state.data.settings;
  const ro = isAdmin() ? '' : 'disabled';
  app().innerHTML = chrome(`
    <h1>Settings</h1>
    ${isAdmin() ? '' : '<p class="muted">You\'re viewing as read-only. Ask an admin to change settings.</p>'}
    <form id="sform">
      <div class="card">
        <h2 style="margin-top:0">Guild</h2>
        <label>Guild name</label>
        <input name="guildName" ${ro} value="${esc(s.guildName)}">
        <label>Member capacity (grows as the guild levels)</label>
        <input name="memberCapacity" ${ro} type="number" min="1" value="${s.memberCapacity}">
      </div>

      <div class="card">
        <h2 style="margin-top:0">Quest scoring rules</h2>
        <p class="muted small">Editable so the tool survives game rebalances.</p>
        <div class="formrow">
          <div><label>Quests per member — min</label><input name="questsMin" ${ro} type="number" value="${s.questsMin}"></div>
          <div><label>Quests per member — max</label><input name="questsMax" ${ro} type="number" value="${s.questsMax}"></div>
        </div>
        <label>Base quest scores (comma-separated)</label>
        <input name="baseQuestScores" ${ro} value="${s.baseQuestScores.join(', ')}">
        <div class="formrow3">
          <div><label>Max multiplier</label><input name="maxMultiplier" ${ro} type="number" step="any" value="${s.maxMultiplier}"></div>
          <div><label>Bonus min</label><input name="bonusMin" ${ro} type="number" value="${s.bonusMin}"></div>
          <div><label>Bonus max</label><input name="bonusMax" ${ro} type="number" value="${s.bonusMax}"></div>
        </div>
      </div>

      <div class="card">
        <h2 style="margin-top:0">Potential estimate <span class="badge">est.</span></h2>
        <p class="muted small">Member potential = quest count × (score per quest + avg bonus if enabled),
          unless a member has a manual override. Guild potential sums active members —
          or uses the manual member count below if set. Tune once the real flower→quest
          relationship is clear.</p>
        <div class="formrow">
          <div><label>Score per quest</label><input name="p_scorePerQuest" ${ro} type="number" step="any" value="${s.potential.scorePerQuest}"></div>
          <div><label>Avg bonus per quest</label><input name="p_avgBonus" ${ro} type="number" step="any" value="${s.potential.avgBonus}"></div>
        </div>
        <label class="inline" style="margin-bottom:10px">
          <input type="checkbox" name="p_includeBonus" ${ro} ${s.potential.includeBonus ? 'checked' : ''}>Include bonus in estimate
        </label>
        <label>Manual member count (blank = use roster)</label>
        <input name="p_membersOverride" ${ro} type="number" placeholder="auto" value="${s.potential.membersOverride ?? ''}">
        ${isAdmin() ? '<button class="btn secondary small" type="button" id="deriveddefaults">Reset to derived defaults</button>' : ''}
      </div>

      <div class="card">
        <h2 style="margin-top:0">Florist rank labels</h2>
        <p class="muted small">Minimum points behind each profile label — powers the
          <a href="#/rivals">Rivals score calculator</a>. Editable in case the game rebalances.</p>
        <div class="formrow">
          ${FLORIST_RANKS.map(r => `
            <div>
              <label><span class="tag tag-${r.color}">${r.label}</span></label>
              <input name="fr_${r.key}" ${ro} type="number" min="0" value="${s.floristRanks[r.key]}">
            </div>`).join('')}
          <div>
            <label><span class="tag tag-none">Untitled — assumed each</span></label>
            <input name="fr_unknown" ${ro} type="number" min="0" value="${s.floristRanks.unknown}">
          </div>
        </div>
      </div>

      ${isAdmin() ? '<button class="btn" style="width:100%">Save settings</button>' : ''}
    </form>

    <div class="card">
      <h2 style="margin-top:0">Data</h2>
      <p class="muted small">Passwords are set on the server (config.json or env vars), not here —
        so nobody can lock anyone out from inside the app. The server also keeps
        automatic daily backups of the data file.</p>
      <button class="btn secondary small" id="backup">Download backup (JSON)</button>
    </div>
  `, '#/settings');
  bindChrome();

  $('#backup').addEventListener('click', () => {
    downloadFile(`guild-backup-${localISO(new Date())}.json`,
      JSON.stringify(state.data, null, 2), 'application/json');
  });

  $('#deriveddefaults')?.addEventListener('click', () => {
    const form = $('#sform');
    const scores = String(form.baseQuestScores.value).split(',').map(v => Number(v.trim())).filter(n => n > 0);
    const top = scores.length ? Math.max(...scores) : 30;
    form.p_scorePerQuest.value = top * (Number(form.maxMultiplier.value) || 2);
    form.p_avgBonus.value = ((Number(form.bonusMin.value) || 0) + (Number(form.bonusMax.value) || 0)) / 2;
    toast('Derived defaults filled — hit Save settings to apply');
  });

  if (isAdmin()) {
    $('#sform').addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      await saveAndReload(() => api('/api/settings', 'PUT', {
        guildName: f.get('guildName'),
        memberCapacity: f.get('memberCapacity'),
        questsMin: f.get('questsMin'),
        questsMax: f.get('questsMax'),
        baseQuestScores: String(f.get('baseQuestScores')).split(',').map(v => Number(v.trim())),
        maxMultiplier: f.get('maxMultiplier'),
        bonusMin: f.get('bonusMin'),
        bonusMax: f.get('bonusMax'),
        potential: {
          scorePerQuest: f.get('p_scorePerQuest'),
          avgBonus: f.get('p_avgBonus'),
          includeBonus: f.get('p_includeBonus') === 'on',
          membersOverride: f.get('p_membersOverride') || null,
        },
        floristRanks: Object.fromEntries(
          [...FLORIST_RANKS.map(r => r.key), 'unknown'].map(k => [k, f.get(`fr_${k}`)])),
      }), 'Settings saved');
    });
  }
}

// ----------------------------------------------------------------- router --

function render() {
  if (!state.role || !state.data) { renderLogin(); return; }
  const hash = location.hash || '#/dashboard';
  const [, view, id] = hash.split('/');
  window.scrollTo(0, 0);
  switch (view) {
    case 'members': id ? renderMemberDetail(id) : renderMembers(); break;
    case 'flowers': renderFlowers(); break;
    case 'weeks': id ? renderWeekDetail(id) : renderWeeks(); break;
    case 'rivals': renderRivals(); break;
    case 'settings': renderSettings(); break;
    default: renderDashboard();
  }
}

window.addEventListener('hashchange', render);

(async function init() {
  try {
    await loadData();
  } catch { /* not logged in */ }
  render();
})();
