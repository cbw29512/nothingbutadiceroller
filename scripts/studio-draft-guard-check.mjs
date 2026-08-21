import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStudioDraftGuard } from '../js/appearance/studio-draft-guard.mjs';

const confirmations = [];
let confirmationResult = false;
const guard = createStudioDraftGuard({
  confirmFn(message) { confirmations.push(message); return confirmationResult; },
});

assert.equal(guard.isDirty(), false);
assert.equal(guard.confirmDiscard(), true, 'Clean drafts must switch without prompting.');
assert.equal(confirmations.length, 0);
guard.markDirty();
assert.equal(guard.isDirty(), true);
assert.equal(guard.confirmDiscard('Discard test?'), false);
assert.equal(confirmations.at(-1), 'Discard test?');
confirmationResult = true;
assert.equal(guard.confirmDiscard('Discard test?'), true);
guard.markClean();
assert.equal(guard.isDirty(), false);

let beforeUnloadHandler = null;
const target = { addEventListener(type, handler) { if (type === 'beforeunload') beforeUnloadHandler = handler; } };
guard.bindBeforeUnload(target);
assert.equal(typeof beforeUnloadHandler, 'function');
const cleanEvent = { prevented: false, preventDefault() { this.prevented = true; }, returnValue: null };
beforeUnloadHandler(cleanEvent);
assert.equal(cleanEvent.prevented, false);
guard.markDirty();
const dirtyEvent = { prevented: false, preventDefault() { this.prevented = true; }, returnValue: null };
beforeUnloadHandler(dirtyEvent);
assert.equal(dirtyEvent.prevented, true);
assert.equal(dirtyEvent.returnValue, '');

const studio = await readFile(new URL('../js/appearance/studio.js', import.meta.url), 'utf8');
for (const required of [
  'createStudioDraftGuard()', 'draftGuard.markDirty()', 'draftGuard.markClean()',
  "requireCleanDraft('using it on the roller')", "requireCleanDraft('locking or unlocking it')",
  "requireCleanDraft('changing its community visibility')", 'if (!draftIsPersisted())',
  "setStatus('Unsaved dice set discarded.'", 'draftGuard.confirmAction(`Delete',
  "q('set-name').addEventListener('input'", 'draftGuard.bindBeforeUnload(window)',
  'if (activeId === draft.id) setActiveDiceSet(draft);',
]) assert.ok(studio.includes(required), `Studio draft contract missing: ${required}`);

console.log('Studio draft guard passed: clean/dirty state, discard confirmation, unload protection, save-before-use/lock/publish, unsaved discard, and delete confirmation are protected.');
