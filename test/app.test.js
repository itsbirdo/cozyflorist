'use strict';

// Mirrors guild-hq.test.js for the server app's frontend (app/public/app.js),
// so the two versions can't silently drift apart on shared logic.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadApp() {
  const script = fs.readFileSync(path.join(__dirname, '..', 'app', 'public', 'app.js'), 'utf8');

  const boot = `
window.addEventListener('hashchange', render);

(async function init() {
  try {
    await loadData();
  } catch { /* not logged in */ }
  render();
})();`;
  const patched = script.replace(boot, `
globalThis.__guildHq = {
  state,
  ui,
  ownedFlowerIds,
  topMemberFlowers,
  firstFlowerOwnerName,
  flowerOwners,
  rarityForPoints,
  sortWeekCompetitorRows,
  mergedMemberResultsForSave,
  memberPotential,
  guildPotential,
  guildRankText,
  competitorRankTitle,
  bestPotentialFlower,
  memberResultsScoreSummary,
  currentCompetitionSummary,
  weeklyPlacementMap,
  autoPlacementPatch,
  scoreBarWidth,
  scoreComparisonEntries,
};
`);
  assert.notEqual(patched, script, 'test loader should replace browser boot code');

  const context = {
    console,
    window: {
      addEventListener() {},
      scrollTo() {},
    },
  };

  vm.runInNewContext(patched, context, { filename: 'app/public/app.js' });
  return context.__guildHq;
}

// app.js has no normalize() — the server owns migrations — so tests build
// fully-populated data directly.
function fullData(over = {}) {
  return {
    settings: {
      guildName: 'My Guild', guildRank: '', memberCapacity: 40, questsMin: 18, questsMax: 24,
      baseQuestScores: [21, 23, 25, 28, 30], maxMultiplier: 2, bonusMin: 1, bonusMax: 4,
      potential: { scorePerQuest: 60, includeBonus: true, avgBonus: 2.5, membersOverride: null },
      floristRanks: { standard: 500, senior: 700, honored: 1000, peerless: 1300, supreme: 1400, unknown: 500 },
      ...(over.settings || {}),
    },
    members: over.members || [],
    flowers: over.flowers || [],
    competitions: over.competitions || [],
  };
}

function sampleData() {
  return fullData({
    members: [
      { id: 'm1', name: 'Zoe', active: true, role: 'Member', questCount: 18, flowerIds: ['rose', 'lily'], flowerBonuses: { rose: 15 } },
      { id: 'm2', name: 'Ada', active: true, role: 'Elite', questCount: 18, flowerIds: ['rose', 'tulip'], flowerBonuses: {} },
      { id: 'm3', name: 'Mia', active: true, role: 'Elder', questCount: 18, flowerIds: [], flowerBonuses: {} },
    ],
    flowers: [
      { id: 'rose', name: 'Rose', rarity: 'UR', points: 100 },
      { id: 'lily', name: 'Lily', rarity: 'SSR', points: 120 },
      { id: 'tulip', name: 'Tulip', rarity: 'SR', points: 90 },
    ],
  });
}

test('counts owned flowers once per base flower across members', () => {
  const { state, ownedFlowerIds } = loadApp();
  state.data = sampleData();

  assert.deepEqual([...ownedFlowerIds()].sort(), ['lily', 'rose', 'tulip']);
});

test('finds the alphabetically first owner for a shared flower', () => {
  const { state, firstFlowerOwnerName, flowerOwners } = loadApp();
  state.data = sampleData();

  assert.equal(firstFlowerOwnerName('rose'), 'Ada');
  assert.deepEqual(flowerOwners('rose').map(m => m.name), ['Zoe', 'Ada']);
});

test('member summary top flowers use highest effective points first', () => {
  const { state, topMemberFlowers } = loadApp();
  state.data = sampleData();

  assert.deepEqual(
    topMemberFlowers(state.data.members[0]).map(item => [item.flower.name, item.total]),
    [['Lily', 120], ['Rose', 115]],
  );
});

test('flowers page defaults to max points sorting', () => {
  const { ui } = loadApp();

  assert.equal(ui.sort.flowers.key, 'points');
  assert.equal(ui.sort.flowers.dir, -1);
});

test('flower points pick the matching rarity tier', () => {
  const { rarityForPoints } = loadApp();

  assert.equal(rarityForPoints(30), 'UR');
  assert.equal(rarityForPoints(28), 'UR');
  assert.equal(rarityForPoints(25), 'SSR');
  assert.equal(rarityForPoints(23), 'SR');
  assert.equal(rarityForPoints(21), 'R');
  assert.equal(rarityForPoints(20), 'N');
  assert.equal(rarityForPoints(''), '');
});

test('guild rank display is blank until configured and escapes saved text', () => {
  const { state, guildRankText } = loadApp();
  state.data = fullData();

  assert.equal(guildRankText(), '');

  state.data.settings.guildRank = '<Rank 12>';
  assert.equal(guildRankText(), ' · Guild rank: <strong>&lt;Rank 12&gt;</strong>');
});

test('week results use configured guild rank for our row', () => {
  const { state, competitorRankTitle } = loadApp();
  state.data = fullData({ settings: { guildRank: '#12' } });

  assert.equal(competitorRankTitle({ ours: true, rankTitle: 'A-Rank Guild' }), '#12');
  assert.equal(competitorRankTitle({ ours: false, rankTitle: 'A-Rank Guild' }), 'A-Rank Guild');
  assert.equal(competitorRankTitle({ ours: true }, 'No rank logged'), '#12');
});

test('weekly competitors default to place with score as tie-breaker', () => {
  const { ui, sortWeekCompetitorRows } = loadApp();
  const rows = sortWeekCompetitorRows([
    { name: 'B Guild', score: 800, placement: 2 },
    { name: 'A Guild', score: 900, placement: 2 },
    { name: 'C Guild', score: 700, placement: 1 },
  ]);

  assert.equal(ui.sort.weekCompetitors.key, 'placement');
  assert.equal(ui.sort.weekCompetitors.dir, 1);
  assert.deepEqual(rows.map(r => r.name), ['C Guild', 'A Guild', 'B Guild']);
});

test('saving a new member result preserves existing saved member results', () => {
  const { state, ui, mergedMemberResultsForSave } = loadApp();
  state.data = fullData({
    members: [
      { id: 'm1', name: 'Ada', active: true, role: 'Member', questCount: 18, flowerIds: [], flowerBonuses: {} },
      { id: 'm2', name: 'Zoe', active: true, role: 'Member', questCount: 18, flowerIds: [], flowerBonuses: {} },
    ],
    competitions: [{
      id: 'w1',
      weekStart: '2026-07-21',
      weekEnd: '2026-07-26',
      memberResults: [{ memberId: 'm1', finalScore: 111, questsCompleted: 3, questDetail: [] }],
    }],
  });
  ui.weekDraft = {
    compId: 'w1',
    results: { m2: { finalScore: 222, questsCompleted: 4, questDetail: [] } },
  };

  const merged = mergedMemberResultsForSave(state.data.competitions[0]).sort((a, b) => a.memberId.localeCompare(b.memberId));

  assert.equal(
    JSON.stringify(merged.map(r => [r.memberId, r.finalScore, r.questsCompleted])),
    JSON.stringify([['m1', 111, 3], ['m2', 222, 4]]),
  );
});

test('a draft from another week does not leak into this week\'s save', () => {
  const { state, ui, mergedMemberResultsForSave } = loadApp();
  state.data = fullData({
    members: [{ id: 'm1', name: 'Ada', active: true, role: 'Member', questCount: 18, flowerIds: [], flowerBonuses: {} }],
    competitions: [{
      id: 'w1',
      memberResults: [{ memberId: 'm1', finalScore: 111, questsCompleted: 3, questDetail: [] }],
    }],
  });
  ui.weekDraft = {
    compId: 'other-week',
    results: { m1: { finalScore: 999, questsCompleted: 9, questDetail: [] } },
  };

  const merged = mergedMemberResultsForSave(state.data.competitions[0]);
  assert.equal(
    JSON.stringify(merged.map(r => [r.memberId, r.finalScore])),
    JSON.stringify([['m1', 111]]),
  );
});

test('member max potential uses highest base-point flower and that flower bonus', () => {
  const { state, bestPotentialFlower, memberPotential, guildPotential } = loadApp();
  state.data = fullData({
    settings: { questsMax: 24, maxMultiplier: 2 },
    members: [{
      id: 'm1',
      name: 'Ada',
      active: true,
      role: 'Member',
      questCount: 18,
      flowerIds: ['thirty', 'twentyeight'],
      flowerBonuses: { thirty: 2, twentyeight: 10 },
    }],
    flowers: [
      { id: 'thirty', name: 'Thirty', rarity: 'UR', points: 30 },
      { id: 'twentyeight', name: 'Twenty Eight', rarity: 'SSR', points: 28 },
    ],
  });

  assert.equal(bestPotentialFlower(state.data.members[0]).flower.id, 'thirty');
  assert.equal(memberPotential(state.data.members[0]), 1488);
  assert.equal(guildPotential().value, 1488);
});

test('week score tally sums saved and draft member scores', () => {
  const { state, ui, mergedMemberResultsForSave, memberResultsScoreSummary } = loadApp();
  state.data = fullData({
    members: [
      { id: 'm1', name: 'Ada', active: true, role: 'Member', questCount: 18, flowerIds: [], flowerBonuses: {} },
      { id: 'm2', name: 'Zoe', active: true, role: 'Member', questCount: 18, flowerIds: [], flowerBonuses: {} },
    ],
    competitions: [{
      id: 'w1',
      memberResults: [{ memberId: 'm1', finalScore: 111, questsCompleted: 3, questDetail: [] }],
    }],
  });
  ui.weekDraft = {
    compId: 'w1',
    results: { m2: { finalScore: 222, questsCompleted: null, questDetail: [] } },
  };

  const summary = memberResultsScoreSummary(mergedMemberResultsForSave(state.data.competitions[0]));
  assert.equal(summary.hasScores, true);
  assert.equal(summary.total, 333);
});

test('current competition summary totals saved member quests and remaining quests', () => {
  const { state, currentCompetitionSummary } = loadApp();
  state.data = fullData({
    settings: { questsMax: 24 },
    members: [
      { id: 'm1', name: 'Ada', active: true, role: 'Member', questCount: 18, flowerIds: [], flowerBonuses: {} },
      { id: 'm2', name: 'Zoe', active: true, role: 'Member', questCount: 18, flowerIds: [], flowerBonuses: {} },
      { id: 'm3', name: 'Mia', active: false, role: 'Member', questCount: 18, flowerIds: [], flowerBonuses: {} },
    ],
  });
  const summary = currentCompetitionSummary({
    ourScore: 999,
    memberResults: [
      { memberId: 'm1', finalScore: 111, questsCompleted: 12, questDetail: [] },
      { memberId: 'm2', finalScore: 222, questsCompleted: 24, questDetail: [] },
      { memberId: 'm3', finalScore: 333, questsCompleted: 4, questDetail: [] },
    ],
  });

  assert.equal(summary.questsCompleted, 36);
  assert.equal(summary.score, 666);
  assert.deepEqual(summary.remaining.map(row => [row.member.name, row.remaining]), [['Ada', 12]]);
});

test('weekly placements are calculated from scores with competition ranking', () => {
  const { weeklyPlacementMap, autoPlacementPatch } = loadApp();
  const c = {
    competitors: [
      { id: 'r1', name: 'One', score: 900, placement: null },
      { id: 'r2', name: 'Two', score: 800, placement: null },
      { id: 'r3', name: 'Three', score: 800, placement: null },
    ],
  };

  const placements = weeklyPlacementMap(c, 1000);
  assert.equal(placements.get('ours'), 1);
  assert.equal(placements.get('r1'), 2);
  assert.equal(placements.get('r2'), 3);
  assert.equal(placements.get('r3'), 3);

  const patch = autoPlacementPatch(c, c.competitors, 750);
  assert.equal(patch.ourPlacement, 4);
  assert.equal(patch.competitors.find(r => r.id === 'r1').placement, 1);
});

test('weekly competitor sorting uses computed placement values', () => {
  const { ui, sortWeekCompetitorRows } = loadApp();
  ui.sort.weekCompetitors = { key: 'placement', dir: 1 };
  const placements = new Map([['ours', 2], ['r1', 1], ['r2', 3]]);
  const rows = sortWeekCompetitorRows([
    { id: 'ours', name: 'Our Guild', score: 900 },
    { id: 'r2', name: 'Last Guild', score: 700 },
    { id: 'r1', name: 'Top Guild', score: 1000 },
  ], placements);

  assert.equal(rows.map(r => r.id).join(','), 'r1,ours,r2');
});

test('score comparison bar widths scale by score', () => {
  const { scoreBarWidth } = loadApp();

  assert.equal(scoreBarWidth(20000, 20000), 100);
  assert.equal(scoreBarWidth(12000, 20000), 60);
  assert.equal(scoreBarWidth(4700, 20000), 24);
  assert.equal(scoreBarWidth(0, 20000), 0);
});

test('score comparison includes our guild with rival guilds', () => {
  const { state, scoreComparisonEntries, weeklyPlacementMap } = loadApp();
  state.data = fullData({ settings: { guildName: 'Cozy Florist' } });
  const c = {
    ourRankTitle: '',
    ourPlacement: null,
    competitors: [
      { id: 'r1', name: 'Hyacinth', score: 7816, placement: null },
      { id: 'r2', name: 'Magnolia', score: 5400, placement: null },
    ],
  };
  const placements = weeklyPlacementMap(c, 6000);
  const rows = scoreComparisonEntries(c, 6000, placements);

  const summary = JSON.parse(JSON.stringify(rows.map(r => [r.id, r.name, r.ours, r.score])));
  assert.deepEqual(summary, [
    ['r1', 'Hyacinth', false, 7816],
    ['ours', 'Cozy Florist', true, 6000],
    ['r2', 'Magnolia', false, 5400],
  ]);
});

test('score comparison keeps our guild row before member scores are entered', () => {
  const { state, scoreComparisonEntries, weeklyPlacementMap } = loadApp();
  state.data = fullData({ settings: { guildName: 'Bloomhaven' } });
  const c = {
    ourRankTitle: 'A-Rank Guild',
    ourPlacement: null,
    competitors: [
      { id: 'r1', name: 'Hyacinth', score: 7816, placement: null },
    ],
  };
  const placements = weeklyPlacementMap(c, null);
  const rows = scoreComparisonEntries(c, null, placements);
  const ourRow = rows.find(r => r.ours);

  assert.equal(ourRow.name, 'Bloomhaven');
  assert.equal(ourRow.score, null);
});
