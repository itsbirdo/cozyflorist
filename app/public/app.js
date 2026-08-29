/* Guild HQ — The Cozy Florist guild tracker (vanilla JS SPA) */
'use strict';

// ------------------------------------------------------------------ state --

const state = { role: null, data: null };

const ui = {
  sort: {
    summary: { key: 'name', dir: 1 },
    members: { key: 'name', dir: 1 },
    memberFlowers: { key: 'points', dir: -1 },
    flowers: { key: 'points', dir: -1 },
    singleOwnerFlowers: { key: 'name', dir: 1 },
    rivals: { key: 'score', dir: -1 },
    weekCompetitors: { key: 'placement', dir: 1 },
    weekMemberResults: { key: 'name', dir: 1 },
    competitionRemaining: { key: 'name', dir: 1 },
  },
  search: { summary: '', members: '', flowers: '', rivals: '', questFlowers: '', singleOwnerFlowers: '', weekMemberResults: '' },
  filters: { summaryFlower: '', membersRole: '', showInactive: false, flowersRarity: '' },
  weekDraft: { compId: null, results: {} }, // admin edit draft for a week's member results
  rivalsWeekId: null, // which competition week the Rivals estimate cards show
  rivalsShowAll: false,
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
const optNum = v => (v === null || v === undefined || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));

function memberAverageQuestScore(result) {
  const score = optNum(result?.finalScore);
  const quests = optNum(result?.questsCompleted);
  if (score === null || quests === null || quests <= 0) return null;
  return score / quests;
}

function fmtAverageQuestScore(result) {
  const avg = memberAverageQuestScore(result);
  if (avg === null) return '—';
  return Number.isInteger(avg)
    ? fmtNum(avg)
    : avg.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
function fmtAverageQuestPointsWithHalf(result) {
  const avg = memberAverageQuestScore(result);
  if (avg === null) return '—';
  const half = avg / 2;
  const fmt = value => Number.isInteger(value)
    ? fmtNum(value)
    : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return `${fmt(avg)} (${fmt(half)})`;
}

function normalizedMemberResult(result) {
  if (!result) return {};
  const score = optNum(result.finalScore);
  const quests = optNum(result.questsCompleted);
  const maxQuests = optNum(state.data?.settings?.questsMax) || 24;
  if (score === null && quests !== null && quests > maxQuests) {
    return { ...result, finalScore: quests, questsCompleted: null };
  }
  return result;
}

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
function firstFlowerOwnerName(flowerId) {
  const owners = flowerOwners(flowerId).map(m => m.name).sort((a, b) => cmp(a, b));
  return owners[0] || null;
}
function ownedFlowerIds() {
  return new Set(state.data.members.flatMap(m => m.flowerIds || []));
}

// colour-coded labels ---------------------------------------------------------

const ROLES = ['Leader', 'Co-Leader', 'Elder', 'Elite', 'Member'];
const ROLE_COLORS = { Leader: 'red', 'Co-Leader': 'yellow', Elder: 'purple', Elite: 'blue', Member: 'green' };
const roleTag = role => `<span class="tag tag-${ROLE_COLORS[role] || 'green'}">${esc(role)}</span>`;
const roleName = member => `<strong class="role-name role-name-${ROLE_COLORS[member.role] || 'green'}">${esc(member.name)}</strong>`;

const RARITIES = [
  { key: 'UR', label: 'Ultra Rare', color: 'red' },
  { key: 'SSR', label: 'Super Special Rare', color: 'yellow' },
  { key: 'SR', label: 'Super Rare', color: 'purple' },
  { key: 'R', label: 'Rare', color: 'blue' },
  { key: 'N', label: 'Normal', color: 'green' },
];
function rarityForPoints(points) {
  const n = optNum(points);
  if (n === null) return '';
  if (n >= 28) return 'UR';
  if (n >= 25) return 'SSR';
  if (n >= 23) return 'SR';
  if (n >= 21) return 'R';
  return 'N';
}
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

function bestPotentialFlower(m) {
  const s = state.data.settings;
  return (m.flowerIds || [])
    .map(flowerById)
    .filter(Boolean)
    .map(f => ({
      flower: f,
      bonus: flowerBonus(m, f.id),
      scorePerQuest: (f.points || 0) * s.maxMultiplier + flowerBonus(m, f.id),
    }))
    .sort((a, b) => cmp(b.flower.points || 0, a.flower.points || 0) || cmp(b.bonus, a.bonus) || cmp(a.flower.name, b.flower.name))[0] || null;
}

function memberPotential(m) {
  if (m.potentialOverride !== null && m.potentialOverride !== undefined) return m.potentialOverride;
  const best = bestPotentialFlower(m);
  if (!best) return 0;
  return Math.round(state.data.settings.questsMax * best.scorePerQuest);
}

function guildPotential() {
  const active = state.data.members.filter(m => m.active);
  return {
    value: active.reduce((sum, m) => sum + memberPotential(m), 0),
    basis: active.length
      ? `sum over ${active.length} active members (each: ${state.data.settings.questsMax} quests × their highest owned flower after multiplier and bonus)`
      : 'no active members with flower data yet',
  };
}
function guildRankText() {
  const rank = state.data?.settings?.guildRank;
  return rank ? ` · Guild rank: <strong>${esc(rank)}</strong>` : '';
}

function usefulLinksHtml(links) {
  return (links || []).length ? `
    <div class="linklist">
      ${links.map(link => `
        <a class="usefullink" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">
          <strong>${esc(link.label || link.url)}</strong>
          ${link.description ? `<span>${esc(link.description)}</span>` : ''}
        </a>`).join('')}
    </div>`
    : `<p class="muted">No useful links have been added yet.${isAdmin() ? ' Add them in Settings.' : ''}</p>`;
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
      if (s.key === key) {
        s.dir = view === 'weekCompetitors' && key === 'placement' ? 1 : -s.dir;
      } else {
        s.key = key;
        s.dir = (key === 'score' || key === 'potential' || key === 'flowers' || key === 'topFlower' || key === 'date' || key === 'average') ? -1 : 1;
      }
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
function tsvCell(v) {
  return String(v ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
}
function restoreInputFocus(selector, start, end = start) {
  requestAnimationFrame(() => {
    const el = $(selector);
    if (!el) return;
    el.focus();
    el.setSelectionRange?.(start, end);
  });
}

// ----------------------------------------------------------------- chrome --

const TABS = [
  { hash: '#/dashboard', label: 'Home', ico: '🏠' },
  { hash: '#/summary', label: 'Summary', ico: '📋' },
  { hash: '#/members', label: 'Members', ico: '👥' },
  { hash: '#/flowers', label: 'Flowers', ico: '🌸' },
  { hash: '#/reports', label: 'Reports', ico: '📊' },
  { hash: '#/weeks', label: 'Weeks', ico: '🏆' },
  { hash: '#/rivals', label: 'Rivals', ico: '⚔️' },
  { hash: '#/settings', label: 'Settings', ico: '⚙️' },
];

function chrome(content, activeTab) {
  const s = state.data.settings;
  return `
    <header class="topbar">
      <span class="title">💐 ${esc(s.guildName)}</span>
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
      <div class="flower">💐</div>
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

function questFlowerReportResultsHtml(rows) {
  return rows.length ? `
    <div class="tablewrap">
      <table class="quest-flower-table">
        <thead><tr>
          <th>Flower</th>
          <th>Points</th>
          <th>Member</th>
        </tr></thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>
                <strong>${esc(row.flower.name)}</strong>
                ${rarityTag(row.flower.rarity)}
              </td>
              <td><strong>${fmtNum(row.points)}</strong></td>
              <td class="wrap">
                <div class="flowerlist">${row.members.map(item => `
                  <span class="flowerpill">
                    ${roleName(item.member)}
                    <span class="muted small">${item.questsLeft} left${item.bonus ? ` · +${fmtNum(item.bonus)}` : ''}</span>
                  </span>
                `).join('')}</div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`
    : '<p class="muted">No quest flowers match that search.</p>';
}

function renderDashboard() {
  const d = state.data, s = d.settings;
  const active = d.members.filter(m => m.active);
  const totalOwned = d.flowers.length;
  const pot = guildPotential();

  const byRarity = new Map();
  for (const f of d.flowers) {
    byRarity.set(f.rarity || 'none', (byRarity.get(f.rarity || 'none') || 0) + 1);
  }
  const rarityChips = [...RARITIES.map(r => ({ ...r, count: byRarity.get(r.key) || 0 })), { key: 'none', label: 'No rarity', color: 'none', count: byRarity.get('none') || 0 }]
    .filter(r => r.count)
    .map(r => `<span class="tag tag-${r.color}" style="margin:2px 4px 2px 0">${r.key === 'none' ? r.label : r.key} · ${r.count}</span>`)
    .join('') || '<p class="muted">No flowers recorded yet.</p>';

  const comps = [...d.competitions].sort((a, b) => cmp(b.weekStart, a.weekStart));
  const latest = comps[0];
  const questFlowerRows = latest ? questFlowerReportRows(latest) : [];
  const visibleQuestFlowerRows = filteredQuestFlowerReportRows(questFlowerRows, ui.search.questFlowers);
  let latestCard = '';
  if (latest) {
    const rivals = [...(latest.competitors || [])].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    const top = rivals[0];
    const comp = currentCompetitionSummary(latest);
    const remainingRows = sortedCompetitionRemainingRows(comp.remaining);
    latestCard = `
      <div class="card">
        <h2 style="margin-top:0">Current Competition</h2>
        <p class="muted small">${esc(weekLabel(latest))}</p>
        <div class="competition-stats">
          <div><strong>${fmtNum(comp.questsCompleted)}</strong><span>Quests completed</span></div>
          <div><strong>${fmtNum(comp.score)}</strong><span>Score</span></div>
          <div><strong>${comp.remaining.length}</strong><span>Members with quests left</span></div>
          <div><strong>${fmtNum(comp.totalRemaining)}</strong><span>Total quests remaining</span></div>
        </div>
        <p>Placement: <strong>${ordinal(latest.ourPlacement)}</strong>
           ${guildRankText()}
           ${latest.ourRankTitle ? `· ${esc(latest.ourRankTitle)}` : ''}</p>
        ${top ? `<p class="muted">Top rival: ${esc(top.name)} (${fmtNum(top.score)})</p>` : ''}
        <h3>Quests remaining</h3>
        <!-- Put remaining quests first so mobile scans start with the action item. -->
        ${comp.remaining.length ? `
          <label class="mobile-only mobile-sort">Sort
            <select id="competitionremainingsort">
              <option value="name:1" ${ui.sort.competitionRemaining.key === 'name' && ui.sort.competitionRemaining.dir === 1 ? 'selected' : ''}>Member A-Z</option>
              <option value="name:-1" ${ui.sort.competitionRemaining.key === 'name' && ui.sort.competitionRemaining.dir === -1 ? 'selected' : ''}>Member Z-A</option>
              <option value="completed:-1" ${ui.sort.competitionRemaining.key === 'completed' && ui.sort.competitionRemaining.dir === -1 ? 'selected' : ''}>Quests completed high-low</option>
              <option value="completed:1" ${ui.sort.competitionRemaining.key === 'completed' && ui.sort.competitionRemaining.dir === 1 ? 'selected' : ''}>Quests completed low-high</option>
              <option value="score:-1" ${ui.sort.competitionRemaining.key === 'score' && ui.sort.competitionRemaining.dir === -1 ? 'selected' : ''}>Score high-low</option>
              <option value="score:1" ${ui.sort.competitionRemaining.key === 'score' && ui.sort.competitionRemaining.dir === 1 ? 'selected' : ''}>Score low-high</option>
              <option value="remaining:1" ${ui.sort.competitionRemaining.key === 'remaining' && ui.sort.competitionRemaining.dir === 1 ? 'selected' : ''}>Quests left low-high</option>
              <option value="remaining:-1" ${ui.sort.competitionRemaining.key === 'remaining' && ui.sort.competitionRemaining.dir === -1 ? 'selected' : ''}>Quests left high-low</option>
              <option value="average:-1" ${ui.sort.competitionRemaining.key === 'average' && ui.sort.competitionRemaining.dir === -1 ? 'selected' : ''}>Ave. quest points high-low</option>
              <option value="average:1" ${ui.sort.competitionRemaining.key === 'average' && ui.sort.competitionRemaining.dir === 1 ? 'selected' : ''}>Ave. quest points low-high</option>
            </select>
          </label>
          <div class="tablewrap remaining-table-wrap"><table class="remaining-table" data-sortview="competitionRemaining">
            <thead><tr>
              <th data-key="name" class="${sortArrow('competitionRemaining', 'name')}">Member</th>
              <th data-key="remaining" class="${sortArrow('competitionRemaining', 'remaining')}">Quests Left</th>
              <th data-key="completed" class="${sortArrow('competitionRemaining', 'completed')}">Quests Completed</th>
              <th data-key="score" class="${sortArrow('competitionRemaining', 'score')}">Score</th>
              <th data-key="average" class="${sortArrow('competitionRemaining', 'average')}">Ave. Quest Points</th>
            </tr></thead>
            <tbody>
              ${remainingRows.map(row => `
                <tr>
                  <td>${roleName(row.member)}</td>
                  <td><strong>${row.remaining}</strong></td>
                  <td>${row.completed}</td>
                  <td>${fmtNum(row.result.finalScore)}</td>
                  <td>${fmtAverageQuestPointsWithHalf(row.result)}</td>
                </tr>`).join('')}
            </tbody>
          </table></div>`
          : '<p class="muted">All active members have completed their weekly quests.</p>'}
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
        <div class="sub">catalogue total</div>
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

    <div class="card">
      <h2 style="margin-top:0">Useful links</h2>
      ${usefulLinksHtml(s.usefulLinks)}
    </div>

    ${latestCard}

    <div class="card">
      <h2 style="margin-top:0">Quest flower report</h2>
      ${latest
        ? `<p class="muted small">${esc(weekLabel(latest))}</p>
          ${questFlowerRows.length ? `
            <div class="toolbar quest-flower-toolbar">
              <input type="search" id="questflowersearch" placeholder="Search flower or member…" value="${esc(ui.search.questFlowers)}">
              <button class="btn secondary small" id="exportquestflowers" type="button">Export CSV</button>
              <button class="btn secondary small" id="exportquestflowersexcel" type="button">Export Excel</button>
              <button class="btn secondary small" id="copyquestflowersheets" type="button">Google Sheets</button>
            </div>
            <div id="questflowerresults">${questFlowerReportResultsHtml(visibleQuestFlowerRows)}</div>`
            : '<p class="muted">No flowers are recorded for members with quests left.</p>'}`
        : '<p class="muted">Add a competition week to see which members still need quest flowers.</p>'}
    </div>
  `, '#/dashboard');
  bindChrome();
  bindSortHeaders('competitionRemaining', renderDashboard);
  $('#competitionremainingsort')?.addEventListener('change', e => {
    const [key, dir] = e.target.value.split(':');
    ui.sort.competitionRemaining = { key, dir: Number(dir) };
    renderDashboard();
  });
  $('#questflowersearch')?.addEventListener('input', e => {
    ui.search.questFlowers = e.target.value;
    $('#questflowerresults').innerHTML = questFlowerReportResultsHtml(
      filteredQuestFlowerReportRows(questFlowerRows, ui.search.questFlowers),
    );
  });
  $('#exportquestflowers')?.addEventListener('click', () => {
    exportQuestFlowerReport(
      latest,
      filteredQuestFlowerReportRows(questFlowerRows, ui.search.questFlowers),
      ui.search.questFlowers,
    );
  });
  $('#exportquestflowersexcel')?.addEventListener('click', () => {
    exportQuestFlowerReportExcel(
      latest,
      filteredQuestFlowerReportRows(questFlowerRows, ui.search.questFlowers),
      ui.search.questFlowers,
    );
  });
  $('#copyquestflowersheets')?.addEventListener('click', async () => {
    await copyQuestFlowerReportForSheets(filteredQuestFlowerReportRows(questFlowerRows, ui.search.questFlowers));
  });
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
        <th data-key="potential" class="${sortArrow('members', 'potential')}">Potential</th>
        <th data-key="flowers" class="${sortArrow('members', 'flowers')}">Flowers</th>
        <th data-key="timezone" class="${sortArrow('members', 'timezone')}">Timezone</th>
      </tr></thead>
      <tbody>
        ${rows.map(m => `
          <tr class="rowlink" data-go="#/members/${m.id}">
            <td>${esc(m.name)}${m.active ? '' : ' <span class="muted small">(inactive)</span>'}</td>
            <td>${roleTag(m.role)}</td>
            <td>${fmtNum(memberPotential(m))}</td>
            <td>${(m.flowerIds || []).length}</td>
            <td>${esc(m.timezone || '—')}</td>
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
  $('#msearch').addEventListener('input', e => {
    ui.search.members = e.target.value;
    renderMembersTable();
  });
  $('#mrole').addEventListener('change', e => { ui.filters.membersRole = e.target.value; renderMembersTable(); });
  $('#minactive').addEventListener('change', e => { ui.filters.showInactive = e.target.checked; renderMembersTable(); });
  $('#addmember')?.addEventListener('click', () => memberFormDialog(null));
}

// ---------------------------------------------------------------- summary --

function topMemberFlowers(m, limit = 5) {
  return (m.flowerIds || [])
    .map(flowerById)
    .filter(Boolean)
    .map(f => ({ flower: f, bonus: flowerBonus(m, f.id), total: (f.points || 0) + flowerBonus(m, f.id) }))
    .sort((a, b) => cmp(b.total, a.total) || cmp(b.flower.points || 0, a.flower.points || 0) || cmp(a.flower.name, b.flower.name))
    .slice(0, limit);
}

function floristRankForPoints(points) {
  let best = null;
  for (const rank of FLORIST_RANKS) {
    if (points >= (state.data.settings.floristRanks[rank.key] || 0)) best = rank;
  }
  return best;
}
function floristRankTag(points) {
  const rank = floristRankForPoints(points);
  return rank
    ? `<span class="tag tag-${rank.color}">${rank.label}</span>`
    : '<span class="tag tag-none">Below Standard Florist</span>';
}
function summaryRows() {
  const q = ui.search.summary.toLowerCase().trim();
  const flowerFilter = ui.filters.summaryFlower;
  const rows = state.data.members.filter(m => {
    const top = topMemberFlowers(m);
    const allFlowers = (m.flowerIds || []).map(flowerById).filter(Boolean);
    const haystack = [
      m.name,
      m.role,
      m.timezone,
      m.notes,
      ...allFlowers.map(f => f.name),
      floristRankForPoints(memberPotential(m))?.label || '',
    ].join(' ').toLowerCase();
    return (!flowerFilter || (m.flowerIds || []).includes(flowerFilter)) &&
      (!q || haystack.includes(q)) &&
      (top.length || !flowerFilter);
  });
  const { key, dir } = ui.sort.summary;
  const val = m => ({
    name: m.name,
    role: ROLES.indexOf(m.role),
    potential: memberPotential(m),
    flowers: (m.flowerIds || []).length,
    timezone: m.timezone || null,
    topFlower: topMemberFlowers(m)[0]?.total ?? null,
  })[key];
  return rows.sort((a, b) => dir * cmp(val(a), val(b)) || cmp(a.name, b.name));
}

function renderSummaryTable() {
  const members = summaryRows();
  $('#summary-table').innerHTML = members.length ? `
    <div class="tablewrap desktop-only">
    <table data-sortview="summary">
      <thead><tr>
        <th data-key="name" class="${sortArrow('summary', 'name')}">Member</th>
        <th data-key="topFlower" class="${sortArrow('summary', 'topFlower')}">Top 5 highest point flowers</th>
        <th data-key="potential" class="${sortArrow('summary', 'potential')}">Max potential</th>
        <th data-key="flowers" class="${sortArrow('summary', 'flowers')}">Flowers</th>
        <th data-key="timezone" class="${sortArrow('summary', 'timezone')}">Timezone</th>
      </tr></thead>
      <tbody>${members.map(m => {
        const top = topMemberFlowers(m);
        const potential = memberPotential(m);
        return `
          <tr class="rowlink" data-go="#/members/${m.id}">
            <td><strong>${esc(m.name)}</strong>${m.active ? '' : ' <span class="muted small">(inactive)</span>'}<br>${roleTag(m.role)}<br>${floristRankTag(potential)}</td>
            <td class="wrap">
              ${top.length ? `<div class="flowerlist">${top.map(item => `
                <span class="flowerpill">
                  ${esc(item.flower.name)}
                  ${rarityTag(item.flower.rarity)}
                  <strong>${fmtNum(item.total)}</strong>
                  ${item.bonus ? `<span class="muted small">+${fmtNum(item.bonus)}</span>` : ''}
                </span>`).join('')}</div>` : '<span class="muted">No flowers recorded.</span>'}
            </td>
            <td><strong>${fmtNum(potential)}</strong>${m.potentialOverride != null ? ' <span class="badge">manual</span>' : ''}</td>
            <td>${(m.flowerIds || []).length}</td>
            <td>${esc(m.timezone || '—')}</td>
          </tr>`;
      }).join('')}</tbody>
    </table>
    </div>
    <div class="mobilecards">
      ${members.map(m => {
        const top = topMemberFlowers(m);
        const potential = memberPotential(m);
        return `
          <div class="mobilecard rowlink" data-go="#/members/${m.id}">
            <div class="head">
              <div>
                <strong>${esc(m.name)}</strong>${m.active ? '' : ' <span class="muted small">(inactive)</span>'}
                <div class="meta">${roleTag(m.role)} ${floristRankTag(potential)}</div>
              </div>
              <div class="metric">
                <strong>${fmtNum(potential)}</strong>
                <div class="muted small">max potential</div>
              </div>
            </div>
            <div class="section">
              <label>Top 5 flowers</label>
              ${top.length ? `<div class="flowerlist">${top.map(item => `
                <span class="flowerpill">
                  ${esc(item.flower.name)}
                  ${rarityTag(item.flower.rarity)}
                  <strong>${fmtNum(item.total)}</strong>
                  ${item.bonus ? `<span class="muted small">+${fmtNum(item.bonus)}</span>` : ''}
                </span>`).join('')}</div>` : '<p class="muted">No flowers recorded.</p>'}
            </div>
            <div class="meta">
              <span class="chip">${(m.flowerIds || []).length} flowers</span>
              <span class="chip">${esc(m.timezone || 'No timezone')}</span>
            </div>
          </div>`;
      }).join('')}
    </div>`
    : `<div class="empty"><div class="big">📋</div>No members match.</div>`;
  bindSortHeaders('summary', renderSummaryTable);
  document.querySelectorAll('#summary-table [data-go]').forEach(tr => tr.addEventListener('click', () => { location.hash = tr.dataset.go; }));
}

function renderSummary() {
  const members = [...state.data.members].sort((a, b) => cmp(a.name, b.name));
  const activeCount = members.filter(m => m.active).length;
  const withFlowers = members.filter(m => (m.flowerIds || []).length).length;
  const pot = guildPotential();

  app().innerHTML = chrome(`
    <h1>Member flower summary</h1>
    <div class="cardgrid">
      <div class="card stat">
        <div class="num">${members.length}</div>
        <div class="lbl">Members</div>
        <div class="sub">${activeCount} active</div>
      </div>
      <div class="card stat">
        <div class="num">${withFlowers}</div>
        <div class="lbl">With flowers</div>
        <div class="sub">${members.length - withFlowers} without flowers</div>
      </div>
      <div class="card stat">
        <div class="num">${fmtNum(pot.value)}</div>
        <div class="lbl">Guild max potential</div>
        <div class="sub">highest owned flowers</div>
      </div>
      <div class="card stat">
        <div class="num">${state.data.flowers.length}</div>
        <div class="lbl">Catalogue</div>
        <div class="sub">flower types</div>
      </div>
    </div>
    <div class="toolbar">
      <input type="search" id="summarysearch" placeholder="Search member, flower, timezone…" value="${esc(ui.search.summary)}">
      <select id="summaryflower">
        <option value="">All flowers</option>
        ${[...state.data.flowers].sort((a, b) => cmp(a.name, b.name)).map(f => `<option value="${f.id}" ${ui.filters.summaryFlower === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
      </select>
      <label class="mobile-only mobile-sort">Sort
        <select id="summarysort">
          <option value="name:1" ${ui.sort.summary.key === 'name' && ui.sort.summary.dir === 1 ? 'selected' : ''}>Name A-Z</option>
          <option value="potential:-1" ${ui.sort.summary.key === 'potential' && ui.sort.summary.dir === -1 ? 'selected' : ''}>Max potential high-low</option>
          <option value="potential:1" ${ui.sort.summary.key === 'potential' && ui.sort.summary.dir === 1 ? 'selected' : ''}>Max potential low-high</option>
          <option value="flowers:-1" ${ui.sort.summary.key === 'flowers' && ui.sort.summary.dir === -1 ? 'selected' : ''}>Flowers high-low</option>
          <option value="timezone:1" ${ui.sort.summary.key === 'timezone' && ui.sort.summary.dir === 1 ? 'selected' : ''}>Timezone A-Z</option>
        </select>
      </label>
    </div>
    <div id="summary-table"></div>
  `, '#/summary');
  bindChrome();
  renderSummaryTable();
  $('#summarysearch').addEventListener('input', e => { ui.search.summary = e.target.value; renderSummaryTable(); });
  $('#summaryflower').addEventListener('change', e => { ui.filters.summaryFlower = e.target.value; renderSummaryTable(); });
  $('#summarysort')?.addEventListener('change', e => {
    const [key, dir] = e.target.value.split(':');
    ui.sort.summary = { key, dir: Number(dir) };
    renderSummaryTable();
  });
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
  rows.sort((a, b) => dir * cmp(val(a), val(b)) || cmp(firstFlowerOwnerName(a.id), firstFlowerOwnerName(b.id)) || cmp(a.name, b.name));

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
  const form = dlg.querySelector('#fform');
  const rarityInput = form.elements.rarity;
  const pointsInput = form.elements.points;
  const syncRarityFromPoints = () => { rarityInput.value = rarityForPoints(pointsInput.value); };
  pointsInput.addEventListener('input', syncRarityFromPoints);
  pointsInput.addEventListener('change', syncRarityFromPoints);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { name: fd.get('name'), rarity: fd.get('rarity') || null, points: fd.get('points') };
    const ok = await saveAndReload(
      () => flower ? api(`/api/flowers/${flower.id}`, 'PUT', body) : api('/api/flowers', 'POST', body),
      flower ? 'Flower saved' : 'Flower added');
    if (ok) dlg.close();
  });
}

// ---------------------------------------------------------------- reports --

function singleOwnerFlowerRows() {
  const q = ui.search.singleOwnerFlowers.toLowerCase().trim();
  const rows = state.data.flowers
    .map(flower => {
      const owners = flowerOwners(flower.id);
      const owner = owners[0] || null;
      return { flower, owner, ownerCount: owners.length, bonus: owner ? flowerBonus(owner, flower.id) : 0 };
    })
    .filter(row => row.ownerCount === 1)
    .filter(row => !q ||
      row.flower.name.toLowerCase().includes(q) ||
      row.owner.name.toLowerCase().includes(q) ||
      (row.flower.rarity || '').toLowerCase().includes(q));

  const { key, dir } = ui.sort.singleOwnerFlowers;
  const val = row => ({
    name: row.flower.name,
    rarity: rarityRank(row.flower.rarity),
    points: row.flower.points,
    owner: row.owner.name,
    bonus: row.bonus,
    total: (row.flower.points || 0) + row.bonus,
  })[key];
  return rows.sort((a, b) => dir * cmp(val(a), val(b)) || cmp(a.flower.name, b.flower.name));
}

function singleOwnerFlowerReportExportRows(rows) {
  return [
    ['Flower', 'Rarity', 'Points', 'Sole owner', 'Bonus', 'Total'],
    ...rows.map(row => [
      row.flower.name,
      row.flower.rarity || '',
      row.flower.points ?? '',
      row.owner.name,
      row.bonus || '',
      (row.flower.points || 0) + row.bonus,
    ]),
  ];
}

function singleOwnerFlowerReportCsv(rows) {
  return singleOwnerFlowerReportExportRows(rows).map(row => row.map(csvCell).join(',')).join('\n');
}

function renderReports() {
  const rows = singleOwnerFlowerRows();
  const totalUnique = state.data.flowers.filter(f => flowerOwners(f.id).length === 1).length;
  const totalShared = state.data.flowers.filter(f => flowerOwners(f.id).length > 1).length;
  const totalUnowned = state.data.flowers.filter(f => flowerOwners(f.id).length === 0).length;

  app().innerHTML = chrome(`
    <h1>Reports</h1>
    <div class="cardgrid">
      <div class="card stat">
        <div class="num">${fmtNum(totalUnique)}</div>
        <div class="lbl">Single-owner flowers</div>
        <div class="sub">owned by exactly one member</div>
      </div>
      <div class="card stat">
        <div class="num">${fmtNum(totalShared)}</div>
        <div class="lbl">Shared flowers</div>
        <div class="sub">owned by 2+ members</div>
      </div>
      <div class="card stat">
        <div class="num">${fmtNum(totalUnowned)}</div>
        <div class="lbl">Unowned flowers</div>
        <div class="sub">in catalogue only</div>
      </div>
      <div class="card stat">
        <div class="num">${fmtNum(state.data.flowers.length)}</div>
        <div class="lbl">Catalogue</div>
        <div class="sub">flower types</div>
      </div>
    </div>

    <div class="card">
      <div class="section-head">
        <div>
          <h2 style="margin-top:0">Flowers with one owner</h2>
          <p class="muted small">Flowers currently owned by exactly one guild member.</p>
        </div>
        <button class="btn secondary small" id="exportsingleowner" type="button" ${rows.length ? '' : 'disabled'}>Export CSV</button>
      </div>
      <div class="toolbar">
        <input type="search" id="singleownersearch" placeholder="Search flower, owner, rarity…" value="${esc(ui.search.singleOwnerFlowers)}">
        <label class="mobile-only mobile-sort">Sort
          <select id="singleownersort">
            <option value="name:1" ${ui.sort.singleOwnerFlowers.key === 'name' && ui.sort.singleOwnerFlowers.dir === 1 ? 'selected' : ''}>Flower A-Z</option>
            <option value="owner:1" ${ui.sort.singleOwnerFlowers.key === 'owner' && ui.sort.singleOwnerFlowers.dir === 1 ? 'selected' : ''}>Owner A-Z</option>
            <option value="points:-1" ${ui.sort.singleOwnerFlowers.key === 'points' && ui.sort.singleOwnerFlowers.dir === -1 ? 'selected' : ''}>Points high-low</option>
            <option value="points:1" ${ui.sort.singleOwnerFlowers.key === 'points' && ui.sort.singleOwnerFlowers.dir === 1 ? 'selected' : ''}>Points low-high</option>
            <option value="rarity:-1" ${ui.sort.singleOwnerFlowers.key === 'rarity' && ui.sort.singleOwnerFlowers.dir === -1 ? 'selected' : ''}>Rarity high-low</option>
            <option value="total:-1" ${ui.sort.singleOwnerFlowers.key === 'total' && ui.sort.singleOwnerFlowers.dir === -1 ? 'selected' : ''}>Total high-low</option>
          </select>
        </label>
      </div>
      ${rows.length ? `
        <div class="tablewrap desktop-only">
          <table data-sortview="singleOwnerFlowers">
            <thead><tr>
              <th data-key="name" class="${sortArrow('singleOwnerFlowers', 'name')}">Flower</th>
              <th data-key="rarity" class="${sortArrow('singleOwnerFlowers', 'rarity')}">Rarity</th>
              <th data-key="points" class="${sortArrow('singleOwnerFlowers', 'points')}">Points</th>
              <th data-key="owner" class="${sortArrow('singleOwnerFlowers', 'owner')}">Sole owner</th>
              <th data-key="bonus" class="${sortArrow('singleOwnerFlowers', 'bonus')}">Bonus</th>
              <th data-key="total" class="${sortArrow('singleOwnerFlowers', 'total')}">Total</th>
            </tr></thead>
            <tbody>${rows.map(row => `
              <tr class="rowlink" data-go="#/members/${row.owner.id}">
                <td><strong>${esc(row.flower.name)}</strong></td>
                <td>${rarityTag(row.flower.rarity)}</td>
                <td>${fmtNum(row.flower.points)}</td>
                <td>${roleName(row.owner)}</td>
                <td>${fmtNum(row.bonus || null)}</td>
                <td><strong>${fmtNum((row.flower.points || 0) + row.bonus)}</strong></td>
              </tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="mobilecards">
          ${rows.map(row => `
            <div class="mobilecard rowlink" data-go="#/members/${row.owner.id}">
              <div class="head">
                <div>
                  <strong>${esc(row.flower.name)}</strong>
                  <div class="muted small">${rarityTag(row.flower.rarity)} · ${fmtNum(row.flower.points)} points</div>
                </div>
                <div class="metric">
                  <strong>${fmtNum((row.flower.points || 0) + row.bonus)}</strong>
                  <div class="muted small">total</div>
                </div>
              </div>
              <div class="meta">
                <span class="chip">Owner ${esc(row.owner.name)}</span>
                ${row.bonus ? `<span class="chip rose">+${fmtNum(row.bonus)} bonus</span>` : ''}
              </div>
            </div>`).join('')}
        </div>`
        : `<div class="empty"><div class="big">📊</div>${ui.search.singleOwnerFlowers ? 'No single-owner flowers match.' : 'No single-owner flowers yet.'}</div>`}
    </div>
  `, '#/reports');
  bindChrome();
  bindSortHeaders('singleOwnerFlowers', renderReports);
  document.querySelectorAll('[data-go]').forEach(el =>
    el.addEventListener('click', () => { location.hash = el.dataset.go; }));
  $('#singleownersearch')?.addEventListener('input', e => {
    const start = e.target.selectionStart ?? e.target.value.length;
    const end = e.target.selectionEnd ?? start;
    ui.search.singleOwnerFlowers = e.target.value;
    renderReports();
    restoreInputFocus('#singleownersearch', start, end);
  });
  $('#singleownersort')?.addEventListener('change', e => {
    const [key, dir] = e.target.value.split(':');
    ui.sort.singleOwnerFlowers = { key, dir: Number(dir) };
    renderReports();
  });
  $('#exportsingleowner')?.addEventListener('click', () => {
    downloadFile('single-owner-flowers.csv', singleOwnerFlowerReportCsv(rows));
    toast('Single-owner flowers exported');
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
          Score ${fmtNum(c.ourScore)}${guildRankText()}${c.ourRankTitle ? ` · ${esc(c.ourRankTitle)}` : ''}
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

function weeklyPlacementMap(c, ourScore) {
  const entries = [
    { id: 'ours', score: ourScore },
    ...(c.competitors || []).map(r => ({ id: r.id, score: r.score })),
  ]
    .filter(r => r.score !== null && r.score !== undefined)
    .sort((a, b) => cmp(b.score, a.score));
  const placements = new Map();
  let lastScore = null, place = 0;
  entries.forEach((entry, index) => {
    if (lastScore === null || Number(entry.score) !== Number(lastScore)) place = index + 1;
    placements.set(entry.id, place);
    lastScore = entry.score;
  });
  return placements;
}
function autoPlacementPatch(c, competitors, ourScore) {
  const placements = weeklyPlacementMap({ ...c, competitors }, ourScore);
  const patch = {
    competitors: competitors.map(r => ({ ...r, placement: placements.get(r.id) ?? r.placement })),
  };
  const ourPlacement = placements.get('ours');
  if (ourPlacement !== undefined) patch.ourPlacement = ourPlacement;
  return patch;
}

function competitorRankTitle(r, fallback = '—') {
  const rank = r.ours ? (state.data?.settings?.guildRank || r.rankTitle) : r.rankTitle;
  return rank || fallback;
}

function sortWeekCompetitorRows(rows, placements = new Map()) {
  const { key, dir } = ui.sort.weekCompetitors;
  const place = r => placements.get(r.id) ?? r.placement;
  const val = r => ({ name: r.name, score: r.score, rankTitle: competitorRankTitle(r, ''), placement: place(r) })[key];
  return rows.sort((a, b) =>
    dir * cmp(val(a), val(b)) ||
    (key === 'placement' ? cmp(b.score, a.score) : cmp(place(a), place(b))) ||
    cmp(a.name, b.name));
}
function sortWeekMemberResultRows(rows) {
  const { key, dir } = ui.sort.weekMemberResults;
  const val = row => ({
    name: row.member.name,
    role: ROLES.indexOf(row.member.role),
    quests: row.result.questsCompleted,
    score: row.result.finalScore,
    average: memberAverageQuestScore(row.result),
    detail: (row.result.questDetail || []).length,
  })[key];
  return [...rows].sort((a, b) => dir * cmp(val(a), val(b)) || cmp(a.member.name, b.member.name));
}
function filterWeekMemberResultRows(rows, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(row => {
    const m = row.member;
    const r = row.result || {};
    return [
      m.name,
      m.role,
      r.questsCompleted,
      r.finalScore,
      memberAverageQuestScore(r),
      ...(r.questDetail || []).flatMap(detail => [detail.flowerName, detail.score, detail.count]),
    ].some(value => String(value ?? '').toLowerCase().includes(q));
  });
}
function scoreBarColor(i) {
  return ['#c95f7d', '#5f8a5e', '#5a78c9', '#c99a3a', '#8d63b8', '#d7784f', '#4b9d9a', '#b35f86', '#6f7f4f', '#7b78c9'][i % 10];
}
function scoreBarWidth(score, maxScore) {
  if (!Number.isFinite(score) || score <= 0 || !Number.isFinite(maxScore) || maxScore <= 0) return 0;
  return Math.max(3, Math.round(100 * score / maxScore));
}
function scoreComparisonEntries(c, ourScore, placements) {
  const rows = [
    { id: 'ours', name: state.data.settings.guildName, score: ourScore, rankTitle: c.ourRankTitle, placement: c.ourPlacement, ours: true },
    ...(c.competitors || []).map(r => ({ ...r, ours: false })),
  ];
  return rows
    .filter(e => e.ours || e.score !== null && e.score !== undefined)
    .sort((a, b) => cmp(placements.get(a.id), placements.get(b.id)) || cmp(b.score, a.score) || cmp(a.name, b.name));
}

function ensureWeekDraft(c) {
  if (ui.weekDraft.compId === c.id) return;
  const results = {};
  for (const r of c.memberResults || []) {
    const normalized = normalizedMemberResult(r);
    results[r.memberId] = {
      finalScore: normalized.finalScore, questsCompleted: normalized.questsCompleted,
      questDetail: (normalized.questDetail || []).map(q => ({ ...q })),
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
function draftForWeek(c, memberId) {
  ensureWeekDraft(c);
  return draftFor(memberId);
}
function isVisibleInput(el) {
  return Boolean(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}
function syncWeekDraftFromInputs(c) {
  if (c) ensureWeekDraft(c);
  document.querySelectorAll('[data-quests], [data-quests-mobile]').forEach(inp => {
    if (!isVisibleInput(inp)) return;
    const memberId = inp.dataset.quests || inp.dataset.questsMobile;
    draftFor(memberId).questsCompleted = inp.value === '' ? null : Number(inp.value);
  });
  document.querySelectorAll('[data-score], [data-score-mobile]').forEach(inp => {
    if (!isVisibleInput(inp)) return;
    const memberId = inp.dataset.score || inp.dataset.scoreMobile;
    draftFor(memberId).finalScore = inp.value === '' ? null : Number(inp.value);
  });
}
function hasMemberResultData(r) {
  return r && (r.finalScore != null || r.questsCompleted != null || (r.questDetail || []).length);
}
function mergedMemberResultsForSave(c) {
  const merged = new Map((c.memberResults || []).map(r => [r.memberId, {
    memberId: r.memberId,
    finalScore: r.finalScore,
    questsCompleted: r.questsCompleted,
    questDetail: (r.questDetail || []).map(q => ({ ...q })),
  }]));
  if (ui.weekDraft.compId === c.id) {
    for (const [memberId, draft] of Object.entries(ui.weekDraft.results)) {
      if (hasMemberResultData(draft)) {
        merged.set(memberId, { memberId, ...draft, questDetail: (draft.questDetail || []).map(q => ({ ...q })) });
      } else {
        merged.delete(memberId);
      }
    }
  }
  return [...merged.values()];
}
function memberResultsScoreSummary(memberResults) {
  const scores = memberResults.map(r => normalizedMemberResult(r).finalScore).filter(v => v !== null && v !== undefined);
  return { hasScores: scores.length > 0, total: scores.reduce((sum, score) => sum + Number(score || 0), 0) };
}
function currentCompetitionSummary(c) {
  const target = state.data.settings.questsMax || 24;
  const results = new Map((c.memberResults || []).map(r => [r.memberId, normalizedMemberResult(r)]));
  const resultScore = memberResultsScoreSummary(c.memberResults || []);
  const members = state.data.members
    .filter(m => m.active)
    .sort((a, b) => cmp(a.name, b.name));
  const remaining = members
    .map(m => {
      const result = results.get(m.id) || {};
      const completed = Math.max(0, optNum(result.questsCompleted) ?? 0);
      return { member: m, result, completed, remaining: Math.max(0, target - completed) };
    })
    .filter(row => row.remaining > 0);

  return {
    target,
    questsCompleted: members.reduce((sum, m) => sum + Math.max(0, optNum(results.get(m.id)?.questsCompleted) ?? 0), 0),
    score: resultScore.hasScores ? resultScore.total : c.ourScore,
    totalRemaining: remaining.reduce((sum, row) => sum + row.remaining, 0),
    remaining,
  };
}
function sortedCompetitionRemainingRows(rows) {
  const { key, dir } = ui.sort.competitionRemaining;
  const val = row => ({
    name: row.member.name,
    completed: row.completed,
    score: row.result.finalScore,
    average: memberAverageQuestScore(row.result),
    remaining: row.remaining,
  })[key];
  return [...rows].sort((a, b) => dir * cmp(val(a), val(b)) || cmp(a.member.name, b.member.name));
}
function allMemberFlowers(m) {
  return (m.flowerIds || [])
    .map(flowerById)
    .filter(Boolean)
    .map(f => ({ flower: f, bonus: flowerBonus(m, f.id), total: (f.points || 0) + flowerBonus(m, f.id) }))
    .sort((a, b) => cmp(b.total, a.total) || cmp(b.flower.points || 0, a.flower.points || 0) || cmp(a.flower.name, b.flower.name));
}
function questFlowerReportRows(c) {
  const groups = new Map();
  for (const row of sortedCompetitionRemainingRows(currentCompetitionSummary(c).remaining)) {
    for (const item of allMemberFlowers(row.member)) {
      if (!groups.has(item.flower.id)) {
        groups.set(item.flower.id, { flower: item.flower, points: item.flower.points || 0, members: [] });
      }
      groups.get(item.flower.id).members.push({
        member: row.member,
        questsLeft: row.remaining,
        bonus: item.bonus,
      });
    }
  }
  return [...groups.values()]
    .sort((a, b) => cmp(b.points, a.points) || cmp(a.flower.name, b.flower.name));
}
function filteredQuestFlowerReportRows(rows, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return rows;
  return rows.flatMap(row => {
    if (row.flower.name.toLowerCase().includes(q)) return [row];
    const members = row.members.filter(item => item.member.name.toLowerCase().includes(q));
    return members.length ? [{ ...row, members }] : [];
  });
}
function questFlowerReportExportRows(rows) {
  const exportRows = [['Flower', 'Points', 'Member', 'Quests left', 'Bonus']];
  for (const row of rows) {
    for (const item of row.members) {
      exportRows.push([
        row.flower.name,
        row.points,
        item.member.name,
        item.questsLeft,
        item.bonus || '',
      ]);
    }
  }
  return exportRows;
}
function questFlowerReportCsv(rows) {
  return questFlowerReportExportRows(rows).map(row => row.map(csvCell).join(',')).join('\n');
}
function questFlowerReportTsv(rows) {
  return questFlowerReportExportRows(rows).map(row => row.map(tsvCell).join('\t')).join('\n');
}
function questFlowerReportExcelHtml(rows) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body>
<table>
${questFlowerReportExportRows(rows).map((row, i) => `  <tr>${row.map(cell => i === 0 ? `<th>${esc(cell)}</th>` : `<td>${esc(cell)}</td>`).join('')}</tr>`).join('\n')}
</table>
</body>
</html>`;
}
function questFlowerExportSuffix(query = '') {
  return String(query || '').trim() ? '-filtered' : '';
}
function exportQuestFlowerReport(week, rows, query = '') {
  if (!week) return;
  const suffix = questFlowerExportSuffix(query);
  downloadFile(`quest-flower-report-${week.weekStart || 'undated'}${suffix}.csv`, questFlowerReportCsv(rows));
  toast(`Quest flower report exported${suffix ? ' (filtered)' : ''}`);
}
function exportQuestFlowerReportExcel(week, rows, query = '') {
  if (!week) return;
  const suffix = questFlowerExportSuffix(query);
  downloadFile(
    `quest-flower-report-${week.weekStart || 'undated'}${suffix}.xls`,
    questFlowerReportExcelHtml(rows),
    'application/vnd.ms-excel',
  );
  toast(`Excel report exported${suffix ? ' (filtered)' : ''}`);
}
async function copyQuestFlowerReportForSheets(rows) {
  const text = questFlowerReportTsv(rows);
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied for Google Sheets');
  } catch {
    downloadFile('quest-flower-report-google-sheets.tsv', text, 'text/tab-separated-values');
    toast('Sheets file downloaded');
  }
}
function currentWeekOurScore(c) {
  const score = memberResultsScoreSummary(mergedMemberResultsForSave(c));
  return score.hasScores ? score.total : c.ourScore;
}
function refreshWeekResultSummary(c) {
  const score = currentWeekOurScore(c);
  const placements = weeklyPlacementMap(c, score);
  const place = placements.get('ours') ?? c.ourPlacement;
  document.querySelectorAll('[data-week-our-score]').forEach(el => { el.textContent = fmtNum(score); });
  document.querySelectorAll('[data-week-our-place]').forEach(el => { el.textContent = ordinal(place); });
}
function refreshMemberAverage(memberId) {
  document.querySelectorAll(`[data-average="${memberId}"], [data-average-mobile="${memberId}"]`)
    .forEach(el => { el.textContent = fmtAverageQuestScore(draftFor(memberId)); });
}

function renderWeekDetail(id) {
  const c = state.data.competitions.find(x => x.id === id);
  if (!c) { location.hash = '#/weeks'; return; }
  ensureWeekDraft(c);
  const displayOurScore = currentWeekOurScore(c);
  const placements = weeklyPlacementMap(c, displayOurScore);

  const rivals = sortWeekCompetitorRows([...(c.competitors || [])], placements);
  const allCompetitors = [
    { id: 'ours', name: state.data.settings.guildName, score: displayOurScore, rankTitle: c.ourRankTitle, placement: c.ourPlacement, ours: true },
    ...(c.competitors || []).map(r => ({ ...r, ours: false })),
  ];
  const entries = scoreComparisonEntries(c, displayOurScore, placements);
  const maxScore = Math.max(1, ...entries.map(e => e.score));

  // member results: active members plus anyone with a saved/draft result
  const withData = new Set([
    ...(c.memberResults || []).map(r => r.memberId),
    ...Object.keys(ui.weekDraft.results),
  ]);
  const resultMembers = state.data.members
    .filter(m => m.active || withData.has(m.id))
    .sort((a, b) => cmp(a.name, b.name));
  const saved = new Map((c.memberResults || []).map(r => [r.memberId, r]));
  const allMemberResultRows = sortWeekMemberResultRows(resultMembers.map(m => ({
    member: m,
    result: isAdmin() ? draftFor(m.id) : (saved.get(m.id) || {}),
  })));
  const memberResultRows = filterWeekMemberResultRows(allMemberResultRows, ui.search.weekMemberResults);

  app().innerHTML = chrome(`
    <a href="#/weeks" class="backlink">← Weeks</a>
    <h1>${esc(weekLabel(c))}</h1>

    <div class="card">
      <h2 style="margin-top:0">Our result</h2>
      <p>Score <strong data-week-our-score>${fmtNum(displayOurScore)}</strong>
        · Placement <strong data-week-our-place>${ordinal(placements.get('ours') ?? c.ourPlacement)}</strong>
        ${guildRankText()}
        ${c.ourRankTitle ? `· ${esc(c.ourRankTitle)}` : ''}</p>
      ${c.notes ? `<p class="muted" style="white-space:pre-wrap">${esc(c.notes)}</p>` : ''}
      ${isAdmin() ? `
        <button class="btn small" id="editweek">Edit</button>
        <button class="btn danger small" id="delweek">Delete week</button>` : ''}
    </div>

    <div class="card">
      <h2 style="margin-top:0">Score comparison</h2>
      ${entries.length ? `
        <div class="scoregraph">
        ${entries.map((e, i) => `
          <div class="bar ${e.ours ? 'ours' : ''}">
            <span class="place" ${e.ours ? 'data-week-our-place' : ''}>${ordinal(placements.get(e.id) ?? e.placement)}</span>
            <span class="name">${esc(e.name)}${e.ours ? ' <span class="chip">Our guild</span>' : ''}</span>
            <span class="track"><span class="fill" style="width:${scoreBarWidth(e.score, maxScore)}%;background:${scoreBarColor(i)}"></span></span>
            <span class="val" ${e.ours ? 'data-week-our-score' : ''}>${fmtNum(e.score)}</span>
          </div>`).join('')}
        </div>`
        : '<p class="muted">Enter scores in Results or Member results to draw the comparison graph.</p>'}
    </div>

    <div class="card">
      <h2 style="margin-top:0">Results</h2>
      <label class="mobile-only mobile-sort">Sort
        <select id="weekresultsort">
          <option value="placement:1" ${ui.sort.weekCompetitors.key === 'placement' && ui.sort.weekCompetitors.dir === 1 ? 'selected' : ''}>Place 1st-last</option>
          <option value="score:-1" ${ui.sort.weekCompetitors.key === 'score' && ui.sort.weekCompetitors.dir === -1 ? 'selected' : ''}>Score high-low</option>
          <option value="score:1" ${ui.sort.weekCompetitors.key === 'score' && ui.sort.weekCompetitors.dir === 1 ? 'selected' : ''}>Score low-high</option>
          <option value="name:1" ${ui.sort.weekCompetitors.key === 'name' && ui.sort.weekCompetitors.dir === 1 ? 'selected' : ''}>Guild A-Z</option>
          <option value="rankTitle:1" ${ui.sort.weekCompetitors.key === 'rankTitle' && ui.sort.weekCompetitors.dir === 1 ? 'selected' : ''}>Rank A-Z</option>
        </select>
      </label>
      <div class="tablewrap desktop-only"><table data-sortview="weekCompetitors">
        <thead><tr>
          <th data-key="name" class="${sortArrow('weekCompetitors', 'name')}">Guild</th>
          <th data-key="score" class="${sortArrow('weekCompetitors', 'score')}">Score</th>
          <th data-key="rankTitle" class="${sortArrow('weekCompetitors', 'rankTitle')}">Rank</th>
          <th data-key="placement" class="${sortArrow('weekCompetitors', 'placement')}">Place</th>
        </tr></thead>
        <tbody>
          ${sortWeekCompetitorRows(allCompetitors, placements).map(r => `
          <tr class="${r.ours ? 'highlight' : (isAdmin() ? 'rowlink' : '')}" ${r.ours ? '' : `data-rival="${r.id}"`}>
            <td>${esc(r.name)}</td><td ${r.ours ? 'data-week-our-score' : ''}>${fmtNum(r.score)}</td>
            <td>${esc(competitorRankTitle(r))}</td><td ${r.ours ? 'data-week-our-place' : ''}>${ordinal(placements.get(r.id) ?? r.placement)}</td>
          </tr>`).join('')}
        </tbody></table></div>
      <div class="mobilecards">
        ${sortWeekCompetitorRows(allCompetitors, placements).map(r => `
          <div class="mobilecard ${r.ours ? 'highlight' : (isAdmin() ? 'rowlink' : '')}" ${r.ours ? '' : `data-rival="${r.id}"`}>
            <div class="head">
              <div>
                <strong>${esc(r.name)}</strong>
                <div class="muted small">${esc(competitorRankTitle(r, 'No rank logged'))}</div>
              </div>
              <div class="metric">
                <strong ${r.ours ? 'data-week-our-place' : ''}>${ordinal(placements.get(r.id) ?? r.placement)}</strong>
                <div class="muted small">place</div>
              </div>
            </div>
            <div class="section">
              <span class="chip rose">Score <span ${r.ours ? 'data-week-our-score' : ''}>${fmtNum(r.score)}</span></span>
              ${r.ours ? '<span class="chip">Our guild</span>' : ''}
            </div>
          </div>`).join('')}
      </div>
      ${rivals.length ? '' : '<p class="muted small">No rival guilds logged for this week yet.</p>'}
      ${isAdmin() ? '<button class="btn secondary small" id="addrival">+ Add rival</button>' : ''}
    </div>

    <div class="card">
      <h2 style="margin-top:0">Member results</h2>
      ${allMemberResultRows.length ? `
        <div class="toolbar">
          <input type="search" id="weekmemberresultsearch" placeholder="Search member, role, score, quests…" value="${esc(ui.search.weekMemberResults)}">
        </div>
        <label class="mobile-only mobile-sort">Sort
          <select id="weekmemberresultsort">
            <option value="name:1" ${ui.sort.weekMemberResults.key === 'name' && ui.sort.weekMemberResults.dir === 1 ? 'selected' : ''}>Member A-Z</option>
            <option value="name:-1" ${ui.sort.weekMemberResults.key === 'name' && ui.sort.weekMemberResults.dir === -1 ? 'selected' : ''}>Member Z-A</option>
            <option value="quests:-1" ${ui.sort.weekMemberResults.key === 'quests' && ui.sort.weekMemberResults.dir === -1 ? 'selected' : ''}>Quests high-low</option>
            <option value="quests:1" ${ui.sort.weekMemberResults.key === 'quests' && ui.sort.weekMemberResults.dir === 1 ? 'selected' : ''}>Quests low-high</option>
            <option value="score:-1" ${ui.sort.weekMemberResults.key === 'score' && ui.sort.weekMemberResults.dir === -1 ? 'selected' : ''}>Score high-low</option>
            <option value="score:1" ${ui.sort.weekMemberResults.key === 'score' && ui.sort.weekMemberResults.dir === 1 ? 'selected' : ''}>Score low-high</option>
            <option value="average:-1" ${ui.sort.weekMemberResults.key === 'average' && ui.sort.weekMemberResults.dir === -1 ? 'selected' : ''}>Average quest score high-low</option>
            <option value="average:1" ${ui.sort.weekMemberResults.key === 'average' && ui.sort.weekMemberResults.dir === 1 ? 'selected' : ''}>Average quest score low-high</option>
          </select>
        </label>
        ${memberResultRows.length ? `
        <div class="tablewrap desktop-only"><table class="member-results-table" data-sortview="weekMemberResults">
          <thead><tr>
            <th data-key="name" class="${sortArrow('weekMemberResults', 'name')}">Member</th>
            <th data-key="quests" class="${sortArrow('weekMemberResults', 'quests')}">Quests</th>
            <th data-key="score" class="${sortArrow('weekMemberResults', 'score')}">Score</th>
            <th data-key="average" class="${sortArrow('weekMemberResults', 'average')}">Average quest score</th>
            <th data-key="detail" class="${sortArrow('weekMemberResults', 'detail')}">Detail</th>
          </tr></thead>
          <tbody>${memberResultRows.map(row => {
            const m = row.member;
            const d = row.result;
            const detailCount = (d.questDetail || []).length;
            return `<tr>
              <td>${esc(m.name)}${m.active ? '' : ' <span class="muted small">(inactive)</span>'}</td>
              <td>${isAdmin()
                ? `<input type="number" inputmode="numeric" style="width:74px;margin:0;padding:6px" data-quests="${m.id}" value="${d.questsCompleted ?? ''}">`
                : fmtNum(d.questsCompleted)}</td>
              <td>${isAdmin()
                ? `<input type="number" inputmode="numeric" style="width:88px;margin:0;padding:6px" data-score="${m.id}" value="${d.finalScore ?? ''}">`
                : fmtNum(d.finalScore)}</td>
              <td data-average="${m.id}">${fmtAverageQuestScore(d)}</td>
              <td>${isAdmin()
                ? `<button class="btn secondary small" data-detail="${m.id}">${detailCount ? detailCount + ' quests' : '+ quests'}</button>`
                : (detailCount ? `<button class="btn secondary small" data-viewdetail="${m.id}">${detailCount} quests</button>` : '—')}</td>
            </tr>`;
          }).join('')}
          </tbody></table></div>
        <div class="mobilecards">
          ${memberResultRows.map(row => {
            const m = row.member;
            const d = row.result;
            const detailCount = (d.questDetail || []).length;
            return `
              <div class="mobilecard">
                <div class="head">
                  <div>
                    <strong>${esc(m.name)}</strong>${m.active ? '' : ' <span class="muted small">(inactive)</span>'}
                    <div class="muted small">${esc(m.role || 'Member')}</div>
                  </div>
                  <div class="metric">
                    <strong>${fmtNum(d.finalScore)}</strong>
                    <div class="muted small">score</div>
                  </div>
                  <div class="metric">
                    <strong data-average-mobile="${m.id}">${fmtAverageQuestScore(d)}</strong>
                    <div class="muted small">avg quest</div>
                  </div>
                </div>
                ${isAdmin() ? `
                  <div class="mobilefield">
                    <label>Quests</label>
                    <input type="number" inputmode="numeric" data-quests-mobile="${m.id}" value="${d.questsCompleted ?? ''}">
                  </div>
                  <div class="mobilefield">
                    <label>Score</label>
                    <input type="number" inputmode="numeric" data-score-mobile="${m.id}" value="${d.finalScore ?? ''}">
                  </div>
                  <div class="actions">
                    <button class="btn secondary small" data-detail="${m.id}">${detailCount ? detailCount + ' quests' : '+ quests'}</button>
                  </div>`
                  : `<div class="meta">
                    <span class="chip">${fmtNum(d.questsCompleted)} quests</span>
                    ${detailCount ? `<button class="btn secondary small" data-viewdetail="${m.id}">${detailCount} quests</button>` : ''}
                  </div>`}
              </div>`;
          }).join('')}
        </div>
        ` : '<p class="muted">No member results match that search.</p>'}
        ${isAdmin() ? `
          <button class="btn" id="saveresults">Save results</button>
          <p class="muted small">Rows left fully blank aren't stored. Quest detail is optional.</p>` : ''}
        <button class="btn secondary small" id="exportcsv">Export CSV</button>`
        : '<p class="muted">No members on the roster yet.</p>'}
    </div>
  `, '#/weeks');
  bindChrome();
  bindSortHeaders('weekCompetitors', () => renderWeekDetail(id));
  bindSortHeaders('weekMemberResults', () => {
    syncWeekDraftFromInputs(c);
    renderWeekDetail(id);
  });
  $('#weekresultsort')?.addEventListener('change', e => {
    const [key, dir] = e.target.value.split(':');
    ui.sort.weekCompetitors = { key, dir: Number(dir) };
    renderWeekDetail(id);
  });
  $('#weekmemberresultsort')?.addEventListener('change', e => {
    syncWeekDraftFromInputs(c);
    const [key, dir] = e.target.value.split(':');
    ui.sort.weekMemberResults = { key, dir: Number(dir) };
    renderWeekDetail(id);
  });
  $('#weekmemberresultsearch')?.addEventListener('input', e => {
    syncWeekDraftFromInputs(c);
    const start = e.target.selectionStart ?? e.target.value.length;
    const end = e.target.selectionEnd ?? start;
    ui.search.weekMemberResults = e.target.value;
    renderWeekDetail(id);
    restoreInputFocus('#weekmemberresultsearch', start, end);
  });

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
      draftForWeek(c, inp.dataset.quests).questsCompleted = inp.value === '' ? null : Number(inp.value);
      refreshWeekResultSummary(c);
      refreshMemberAverage(inp.dataset.quests);
    }));
  document.querySelectorAll('[data-score]').forEach(inp =>
    inp.addEventListener('input', () => {
      draftForWeek(c, inp.dataset.score).finalScore = inp.value === '' ? null : Number(inp.value);
      refreshWeekResultSummary(c);
      refreshMemberAverage(inp.dataset.score);
    }));
  document.querySelectorAll('[data-quests-mobile]').forEach(inp =>
    inp.addEventListener('input', () => {
      draftForWeek(c, inp.dataset.questsMobile).questsCompleted = inp.value === '' ? null : Number(inp.value);
      refreshWeekResultSummary(c);
      refreshMemberAverage(inp.dataset.questsMobile);
    }));
  document.querySelectorAll('[data-score-mobile]').forEach(inp =>
    inp.addEventListener('input', () => {
      draftForWeek(c, inp.dataset.scoreMobile).finalScore = inp.value === '' ? null : Number(inp.value);
      refreshWeekResultSummary(c);
      refreshMemberAverage(inp.dataset.scoreMobile);
    }));
  document.querySelectorAll('[data-detail]').forEach(btn =>
    btn.addEventListener('click', () => questDetailDialog(c, btn.dataset.detail, true)));
  document.querySelectorAll('[data-viewdetail]').forEach(btn =>
    btn.addEventListener('click', () => questDetailDialog(c, btn.dataset.viewdetail, false)));

  $('#saveresults')?.addEventListener('click', async () => {
    syncWeekDraftFromInputs(c);
    const memberResults = mergedMemberResultsForSave(c);
    const score = memberResultsScoreSummary(memberResults);
    const body = score.hasScores
      ? { memberResults, ourScore: score.total, ...autoPlacementPatch(c, c.competitors || [], score.total) }
      : { memberResults };
    try {
      await api(`/api/competitions/${c.id}`, 'PUT', body);
      await loadData();
      ui.weekDraft = { compId: null, results: {} };
      render();
      toast('Results saved');
    } catch (err) {
      toast(err.message, true);
    }
  });

  $('#exportcsv')?.addEventListener('click', () => {
    const rows = [['Member', 'Role', 'Quests completed', 'Final score', 'Average quest score']];
    for (const row of memberResultRows) {
      const m = row.member;
      const r = saved.get(m.id);
      rows.push([m.name, m.role, r?.questsCompleted ?? '', r?.finalScore ?? '', memberAverageQuestScore(r) ?? '']);
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
    const ourScore = f.get('ourScore') || null;
    const auto = autoPlacementPatch(c, c.competitors || [], optNum(ourScore));
    const ok = await saveAndReload(() => api(`/api/competitions/${c.id}`, 'PUT', {
      weekStart: f.get('weekStart'), weekEnd: f.get('weekEnd'),
      ourScore, ourRankTitle: f.get('ourRankTitle'),
      ourPlacement: auto.ourPlacement ?? (f.get('ourPlacement') || null), notes: f.get('notes'),
      competitors: auto.competitors,
    }), 'Week saved');
    if (ok) dlg.close();
  });
}

function rivalFormDialog(c, rival, afterSave) {
  const r = rival || { name: '', score: null, rankTitle: '', placement: null, notes: '' };
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
      <label>Notes</label>
      <textarea name="notes" placeholder="Anything useful to remember about this guild">${esc(r.notes)}</textarea>
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
      notes: f.get('notes'), estimate: rival?.estimate ?? null,
    };
    const competitors = rival
      ? (c.competitors || []).map(x => x.id === rival.id ? entry : x)
      : [...(c.competitors || []), entry];
    const ok = await saveAndReload(
      () => api(`/api/competitions/${c.id}`, 'PUT', autoPlacementPatch(c, competitors, currentWeekOurScore(c))),
      rival ? 'Rival saved' : 'Rival added');
    if (ok) {
      dlg.close();
      afterSave?.();
    }
  });
  dlg.querySelector('#delrival')?.addEventListener('click', async () => {
    const competitors = (c.competitors || []).filter(x => x.id !== rival.id);
    const ok = await saveAndReload(
      () => api(`/api/competitions/${c.id}`, 'PUT', autoPlacementPatch(c, competitors, currentWeekOurScore(c))),
      'Rival removed');
    if (ok) {
      dlg.close();
      afterSave?.();
    }
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
function rivalRecordsByName(name) {
  const needle = String(name || '').toLowerCase();
  return rivalRecords()
    .filter(x => x.r.name.toLowerCase() === needle)
    .sort((a, b) => cmp(b.date, a.date));
}
function rivalEstimateSummary(r) {
  const est = r.estimate || null;
  if (!est) return '<span class="muted">No calculator saved.</span>';
  const counts = [...FLORIST_RANKS].reverse()
    .map(rank => ({ rank, count: (est.counts || {})[rank.key] || 0 }))
    .filter(x => x.count > 0)
    .map(x => `<span class="tag tag-${x.rank.color}" style="margin:2px 4px 2px 0">${x.rank.label} × ${x.count}</span>`)
    .join('');
  const stats = estimateStats(est);
  return `
    ${counts || '<span class="muted">No title counts.</span>'}
    <div class="muted small">Players ${fmtNum(est.totalPlayers)} · min ${fmtNum(stats.min)} · avg ${fmtNum(stats.avg)} · max ${fmtNum(stats.max)}</div>`;
}

function renderRivalDetail(rawName) {
  const name = decodeURIComponent(rawName || '');
  const rows = rivalRecordsByName(name);
  if (!rows.length) { location.hash = '#/rivals'; return; }
  const scores = rows.map(x => x.r.score).filter(v => v != null);
  const best = scores.length ? Math.max(...scores) : null;
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const latest = rows[0];

  app().innerHTML = chrome(`
    <a href="#/rivals" class="backlink">← Rivals</a>
    <div class="toolbar" style="justify-content:space-between">
      <h1 style="margin:0">${esc(latest.r.name)}</h1>
      ${isAdmin() ? `<button class="btn small" id="edit-latest-rival">Edit latest notes</button>` : ''}
    </div>
    <div class="cardgrid">
      <div class="card stat">
        <div class="num">${rows.length}</div>
        <div class="lbl">Meetings</div>
        <div class="sub">recorded weeks</div>
      </div>
      <div class="card stat">
        <div class="num">${fmtNum(best)}</div>
        <div class="lbl">Best score</div>
        <div class="sub">highest seen</div>
      </div>
      <div class="card stat">
        <div class="num">${fmtNum(avg)}</div>
        <div class="lbl">Average</div>
        <div class="sub">scored weeks</div>
      </div>
      <div class="card stat">
        <div class="num">${ordinal(latest.r.placement)}</div>
        <div class="lbl">Latest place</div>
        <div class="sub">${esc(weekLabel(latest.comp))}</div>
      </div>
    </div>
    <div class="card">
      <div class="toolbar" style="justify-content:space-between">
        <h2 style="margin:0">Notes</h2>
        ${isAdmin() ? `<button class="btn secondary small" id="edit-rival-notes">Edit</button>` : ''}
      </div>
      ${latest.r.notes
        ? `<p class="muted" style="white-space:pre-wrap">${esc(latest.r.notes)}</p>`
        : '<p class="muted">No notes saved for the latest meeting yet.</p>'}
    </div>
    <div class="card">
      <h2 style="margin-top:0">Competition history</h2>
      <div class="tablewrap"><table>
        <thead><tr><th>Week</th><th>Score</th><th>Place</th><th>Rank</th><th>Potential calculator</th><th>Notes</th>${isAdmin() ? '<th></th>' : ''}</tr></thead>
        <tbody>${rows.map(x => `
          <tr class="rowlink" data-go="#/weeks/${x.comp.id}">
            <td>${esc(weekLabel(x.comp))}</td>
            <td>${fmtNum(x.r.score)}</td>
            <td>${ordinal(x.r.placement)}</td>
            <td>${esc(x.r.rankTitle || '—')}</td>
            <td class="wrap">${rivalEstimateSummary(x.r)}</td>
            <td class="wrap">${x.r.notes ? esc(x.r.notes) : '<span class="muted">—</span>'}</td>
            ${isAdmin() ? `<td><button class="btn secondary small" data-edit-rival="${x.comp.id}:${x.r.id}" type="button">Edit</button></td>` : ''}
          </tr>`).join('')}</tbody>
      </table></div>
    </div>
  `, '#/rivals');
  bindChrome();
  const rerender = () => renderRivalDetail(encodeURIComponent(name));
  $('#edit-latest-rival')?.addEventListener('click', () => rivalFormDialog(latest.comp, latest.r, rerender));
  $('#edit-rival-notes')?.addEventListener('click', () => rivalFormDialog(latest.comp, latest.r, rerender));
  document.querySelectorAll('[data-edit-rival]').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    const [compId, rivalId] = btn.dataset.editRival.split(':');
    const comp = state.data.competitions.find(x => x.id === compId);
    const rival = (comp?.competitors || []).find(x => x.id === rivalId);
    if (comp && rival) rivalFormDialog(comp, rival, rerender);
  }));
  document.querySelectorAll('[data-go]').forEach(tr => tr.addEventListener('click', () => { location.hash = tr.dataset.go; }));
}

function renderRivalsTable() {
  const q = ui.search.rivals.toLowerCase();
  const allRows = rivalRecords().filter(x => !q || x.r.name.toLowerCase().includes(q));
  const topRows = [...allRows].sort((a, b) => cmp(b.r.score, a.r.score) || cmp(a.r.name, b.r.name)).slice(0, 10);
  let rows = ui.rivalsShowAll ? [...allRows] : topRows;
  const { key, dir } = ui.sort.rivals;
  const val = x => ({ date: x.date, name: x.r.name, score: x.r.score, placement: x.r.placement })[key];
  rows.sort((a, b) => dir * cmp(val(a), val(b)) || cmp(a.r.name, b.r.name));

  // summary card when a search narrows to a single guild
  const names = [...new Set(allRows.map(x => x.r.name.toLowerCase()))];
  let summary = '';
  if (q && names.length === 1 && allRows.length) {
    const scores = allRows.map(x => x.r.score).filter(v => v != null);
    const best = scores.length ? Math.max(...scores) : null;
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const last = [...allRows].sort((a, b) => cmp(b.date, a.date))[0];
    summary = `
      <div class="card">
        <h2 style="margin-top:0">${esc(last.r.name)}</h2>
        <p>Faced <strong>${allRows.length}×</strong> · best score <strong>${fmtNum(best)}</strong>
          · avg <strong>${fmtNum(avg)}</strong></p>
        <p class="muted">Last met ${esc(weekLabel(last.comp))}: scored ${fmtNum(last.r.score)},
          placed ${ordinal(last.r.placement)}${last.r.rankTitle ? ` (${esc(last.r.rankTitle)})` : ''}.</p>
        ${last.r.notes ? `<p class="muted" style="white-space:pre-wrap">${esc(last.r.notes)}</p>` : ''}
      </div>`;
  }

  const toggle = $('#rtoggle');
  if (toggle) {
    toggle.textContent = ui.rivalsShowAll ? 'Show top 10' : 'Show full list';
    toggle.hidden = allRows.length <= 10;
  }

  $('#rivals-table').innerHTML = summary + (rows.length ? `
    <div class="tablewrap">
    <table data-sortview="rivals">
      <thead><tr>
        <th data-key="name" class="${sortArrow('rivals', 'name')}">Guild</th>
        <th data-key="score" class="${sortArrow('rivals', 'score')}">Score</th>
        <th>Rank</th>
        <th data-key="placement" class="${sortArrow('rivals', 'placement')}">Place</th>
        <th data-key="date" class="${sortArrow('rivals', 'date')}">Week</th>
      </tr></thead>
      <tbody>${rows.map(x => `
        <tr class="rowlink" data-name="${esc(x.r.name)}" data-week="${x.comp.id}">
          <td>${esc(x.r.name)}</td>
          <td>${fmtNum(x.r.score)}</td>
          <td>${esc(x.r.rankTitle || '—')}</td>
          <td>${ordinal(x.r.placement)}</td>
          <td>${esc(weekLabel(x.comp))}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>
    <p class="muted small">${ui.rivalsShowAll ? `Showing all ${allRows.length} records.` : `Showing top ${rows.length} by score.`} Tap a row to open that guild's full history.</p>`
    : `<div class="empty"><div class="big">⚔️</div>No rival records${q ? ' match' : ' yet — log them inside each competition week'}.</div>`);

  bindSortHeaders('rivals', renderRivalsTable);
  document.querySelectorAll('#rivals-table tr[data-name]').forEach(tr =>
    tr.addEventListener('click', () => { location.hash = `#/rivals/${encodeURIComponent(tr.dataset.name)}`; }));
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
    <h2>Competitor history</h2>
    <div class="toolbar">
      <input type="search" id="rsearch" placeholder="Search guild name…" value="${esc(ui.search.rivals)}">
      <button class="btn secondary small" id="rtoggle" type="button">Show full list</button>
    </div>
    <div id="rivals-table"></div>
    ${comps.length ? `
      <h2>Score estimates</h2>
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
  `, '#/rivals');
  bindChrome();
  renderRivalsTable();
  $('#rsearch').addEventListener('input', e => { ui.search.rivals = e.target.value; renderRivalsTable(); });
  $('#rtoggle').addEventListener('click', () => { ui.rivalsShowAll = !ui.rivalsShowAll; renderRivalsTable(); });
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
  const linkRows = (s.usefulLinks && s.usefulLinks.length ? s.usefulLinks : [{ label: '', url: '', description: '' }]);
  app().innerHTML = chrome(`
    <h1>Settings</h1>
    ${isAdmin() ? '' : '<p class="muted">You\'re viewing as read-only. Ask an admin to change settings.</p>'}
    <form id="sform">
      <div class="card">
        <h2 style="margin-top:0">Guild</h2>
        <label>Guild name</label>
        <input name="guildName" ${ro} value="${esc(s.guildName)}">
        <label>Guild rank</label>
        <input name="guildRank" ${ro} value="${esc(s.guildRank)}" placeholder="#12">
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
        <p class="muted small">Member potential = max quests × ((that member's highest-point
          owned flower × max multiplier) + that member's bonus on that flower), unless a member
          has a manual override. Guild potential sums active members.</p>
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

      <div class="card">
        <div class="section-head">
          <h2 style="margin-top:0">Useful links</h2>
          ${isAdmin() ? '<button class="btn secondary small" type="button" id="addlink">+ Add link</button>' : ''}
        </div>
        <div id="usefullinkrows" class="linkformlist">
          ${linkRows.map((link, i) => `
            <div class="linkrow" data-linkrow>
              <div class="formrow">
                <div><label>Link title</label><input name="link_label_${i}" ${ro} value="${esc(link.label || '')}" placeholder="Discord guide"></div>
                <div><label>URL</label><input name="link_url_${i}" ${ro} value="${esc(link.url || '')}" placeholder="https://example.com"></div>
              </div>
              <label>Short description</label>
              <textarea name="link_description_${i}" ${ro} maxlength="180" placeholder="What this link is useful for">${esc(link.description || '')}</textarea>
              ${isAdmin() ? '<button class="btn danger small" type="button" data-removelink>Remove</button>' : ''}
            </div>`).join('')}
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
    $('#addlink')?.addEventListener('click', () => {
      const rows = $('#usefullinkrows');
      rows.insertAdjacentHTML('beforeend', `
        <div class="linkrow" data-linkrow>
          <div class="formrow">
            <div><label>Link title</label><input name="link_label_new" value="" placeholder="Discord guide"></div>
            <div><label>URL</label><input name="link_url_new" value="" placeholder="https://example.com"></div>
          </div>
          <label>Short description</label>
          <textarea name="link_description_new" maxlength="180" placeholder="What this link is useful for"></textarea>
          <button class="btn danger small" type="button" data-removelink>Remove</button>
        </div>`);
    });
    $('#usefullinkrows')?.addEventListener('click', e => {
      if (!e.target.matches('[data-removelink]')) return;
      e.target.closest('[data-linkrow]')?.remove();
    });
    $('#sform').addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const usefulLinks = [...document.querySelectorAll('[data-linkrow]')].map(row => ({
        label: row.querySelector('input[name^="link_label_"]')?.value,
        url: row.querySelector('input[name^="link_url_"]')?.value,
        description: row.querySelector('textarea[name^="link_description_"]')?.value,
      })).filter(link => link.url);
      await saveAndReload(() => api('/api/settings', 'PUT', {
        guildName: f.get('guildName'),
        guildRank: f.get('guildRank'),
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
        usefulLinks,
      }), 'Settings saved');
    });
  }
}

// ----------------------------------------------------------------- router --

function render() {
  if (!state.role || !state.data) { renderLogin(); return; }
  const hash = location.hash || '#/dashboard';
  const [, view, ...rest] = hash.split('/');
  const id = rest.join('/');
  window.scrollTo(0, 0);
  switch (view) {
    case 'members': id ? renderMemberDetail(id) : renderMembers(); break;
    case 'summary': renderSummary(); break;
    case 'flowers': renderFlowers(); break;
    case 'reports': renderReports(); break;
    case 'weeks': id ? renderWeekDetail(id) : renderWeeks(); break;
    case 'rivals': id ? renderRivalDetail(id) : renderRivals(); break;
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
