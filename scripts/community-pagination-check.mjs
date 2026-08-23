import assert from 'node:assert/strict';
import {
  LEGACY_COMMUNITY_INDEX,
  listLegacyPublicProjections,
  listPublicProjections,
  publicRecordKey,
  recordKey,
} from '../netlify/functions/dice-set-store.mjs';

function currentFixture(index) {
  const ownerId = `owner_${index}`;
  const setId = `set_${index}`;
  const publicAccessId = `public_${index}`;
  const recordVersion = `version_${index}`;
  const record = {
    set: { id: setId, ownerId, locked: true, visibility: 'public' },
    publicAccessId,
    recordVersion,
  };
  const projection = {
    publicAccessId,
    ownerId,
    setId,
    recordVersion,
    publicRecord: { set: { locked: true, visibility: 'public' } },
  };
  return { ownerId, setId, publicAccessId, record, projection };
}

function pagedStore(fixtures) {
  const values = new Map();
  fixtures.forEach((fixture) => {
    values.set(publicRecordKey(fixture.publicAccessId), fixture.projection);
    values.set(recordKey(fixture.ownerId, fixture.setId), fixture.record);
  });
  let yieldedPages = 0;
  const store = {
    list(options) {
      assert.equal(options.paginate, true, 'Community listing must use manual Blob pagination.');
      return {
        async *[Symbol.asyncIterator]() {
          yieldedPages += 1;
          yield { blobs: fixtures.map((fixture) => ({ key: publicRecordKey(fixture.publicAccessId) })) };
          yieldedPages += 1;
          yield { blobs: [{ key: publicRecordKey('should_not_be_read') }] };
        },
      };
    },
    async get(key) { return values.get(key) ?? null; },
  };
  return { store, yieldedPages: () => yieldedPages };
}

try {
  const fixtures = [currentFixture(1), currentFixture(2), currentFixture(3)];
  const currentStore = pagedStore(fixtures);
  const current = await listPublicProjections(currentStore.store, 2);
  assert.equal(current.length, 2, 'Current Community candidates must respect the explicit cap.');
  assert.equal(currentStore.yieldedPages(), 1, 'Community listing must stop after the first bounded Blob page.');

  const legacyReads = [];
  const legacyIndex = [1, 2, 3].map((index) => ({ ownerId: `legacy_owner_${index}`, setId: `legacy_set_${index}` }));
  const legacyRecords = new Map(legacyIndex.map(({ ownerId, setId }) => [
    recordKey(ownerId, setId),
    {
      set: { id: setId, ownerId, locked: true, visibility: 'public' },
      createdAt: '2026-08-22T00:00:00.000Z',
      updatedAt: '2026-08-22T00:00:00.000Z',
    },
  ]));
  const legacyStore = {
    async get(key) {
      if (key === LEGACY_COMMUNITY_INDEX) return legacyIndex;
      if (!legacyRecords.has(key)) return null;
      legacyReads.push(key);
      return legacyRecords.get(key);
    },
  };
  const legacy = await listLegacyPublicProjections(legacyStore, new Set(), 2);
  assert.equal(legacy.length, 2, 'Legacy Community migration reads must respect the explicit candidate cap.');
  assert.equal(legacyReads.length, 2, 'Legacy Community migration must not fan out beyond its candidate cap.');

  console.log('Community pagination passed: current Blob enumeration stops after one bounded page and legacy migration fan-out is capped while moderation lookups remain fail-closed.');
} catch (error) {
  console.error('Community pagination check failed:', error);
  process.exitCode = 1;
}
