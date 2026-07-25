'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadGuildHq() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'guild-hq.html'), 'utf8');
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, 'guild-hq.html should include one inline script');

  const boot = `
window.addEventListener('hashchange', render);

load();
render();`;
  const script = match[1].replace(boot, `
globalThis.__guildHq = {
  state,
  ui,
  normalize,
  ownedFlowerIds,
  topMemberFlowers,
  firstFlowerOwnerName,
  flowerOwners,
  sortWeekCompetitorRows,
};
`);
  assert.notEqual(script, match[1], 'test loader should replace browser boot code');

  const context = {
    console,
    localStorage: {
      getItem() { return null; },
      setItem() {},
    },
    window: {
      crypto: {
        randomUUID() { return '00000000-0000-4000-8000-000000000000'; },
        getRandomValues(bytes) { return bytes.fill(1); },
      },
      addEventListener() {},
      scrollTo() {},
    },
    crypto: {
      randomUUID() { return '00000000-0000-4000-8000-000000000000'; },
      getRandomValues(bytes) { return bytes.fill(1); },
    },
  };

  vm.runInNewContext(script, context, { filename: 'guild-hq.html' });
  return context.__guildHq;
}

function sampleData() {
  return {
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
    competitions: [],
  };
}

test('normalizes missing settings and collection fields', () => {
  const { normalize } = loadGuildHq();
  const data = normalize({ members: [{ id: 'm1' }], flowers: [{ id: 'f1', categoryId: 'old' }] });

  assert.equal(data.settings.guildName, 'My Guild');
  assert.equal(data.competitions.length, 0);
  assert.equal(Object.keys(data.members[0].flowerBonuses).length, 0);
  assert.equal(data.flowers[0].rarity, null);
  assert.equal('categoryId' in data.flowers[0], false);
});

test('counts owned flowers once per base flower across members', () => {
  const { state, normalize, ownedFlowerIds } = loadGuildHq();
  state.data = normalize(sampleData());

  assert.deepEqual([...ownedFlowerIds()].sort(), ['lily', 'rose', 'tulip']);
});

test('finds the alphabetically first owner for a shared flower', () => {
  const { state, normalize, firstFlowerOwnerName, flowerOwners } = loadGuildHq();
  state.data = normalize(sampleData());

  assert.equal(firstFlowerOwnerName('rose'), 'Ada');
  assert.deepEqual(flowerOwners('rose').map(m => m.name), ['Zoe', 'Ada']);
});

test('member summary top flowers use highest effective points first', () => {
  const { state, normalize, topMemberFlowers } = loadGuildHq();
  state.data = normalize(sampleData());

  assert.deepEqual(
    topMemberFlowers(state.data.members[0]).map(item => [item.flower.name, item.total]),
    [['Lily', 120], ['Rose', 115]],
  );
});

test('flowers page defaults to max points sorting', () => {
  const { ui } = loadGuildHq();

  assert.equal(ui.sort.flowers.key, 'points');
  assert.equal(ui.sort.flowers.dir, -1);
});

test('weekly competitors default to place with score as tie-breaker', () => {
  const { ui, sortWeekCompetitorRows } = loadGuildHq();
  const rows = sortWeekCompetitorRows([
    { name: 'B Guild', score: 800, placement: 2 },
    { name: 'A Guild', score: 900, placement: 2 },
    { name: 'C Guild', score: 700, placement: 1 },
  ]);

  assert.equal(ui.sort.weekCompetitors.key, 'placement');
  assert.equal(ui.sort.weekCompetitors.dir, 1);
  assert.deepEqual(rows.map(r => r.name), ['C Guild', 'A Guild', 'B Guild']);
});
