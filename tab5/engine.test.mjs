import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { initialState, selectSystem, confirmSystem, cancelSelection, secureInt, rollPool } from './engine.mjs';

// Real CSPRNG adapter for the portable Node reference test.
const rng = (count) => new Uint8Array(randomBytes(count));
test('session cannot switch systems; reboot resets to chooser', () => {
  const selected = selectSystem(initialState(), 'dnd5e');
  assert.equal(selected.phase, 'confirm');
  assert.equal(cancelSelection(selected).phase, 'choose');
  const locked = confirmSystem(selected);
  assert.equal(locked.selectedSystemId, 'dnd5e');
  assert.throws(() => selectSystem(locked, 'custom'), /restart required/);
  assert.equal(initialState().phase, 'choose');
});
test('every die remains individually inspectable and totals match', () => {
  const roll = rollPool(Array(30).fill(6), 4, rng);
  assert.equal(roll.dice.length, 30);
  assert.deepEqual(roll.dice.map(d => d.id), Array.from({length:30}, (_,i)=>i+1));
  assert.equal(roll.total, roll.dice.reduce((n,d)=>n+d.face,4));
  assert.ok(roll.dice.every(d=>d.face>=1 && d.face<=6));
});
test('supports million-sided custom dice', () => {
  assert.ok(secureInt(1_000_000, rng) >= 1);
  assert.throws(() => secureInt(1, rng), /Die sides/);
});
test('rejects modulo-biased draw and uses next sample', () => {
  // d6 rejection begins at 4294967292. First 0xffffffff must be rejected.
  const samples = [new Uint8Array([255,255,255,255]), new Uint8Array([0,0,0,5])];
  assert.equal(secureInt(6,()=>samples.shift()), 6);
});
test('rejects invalid session and pool input', () => {
  assert.throws(()=>confirmSystem(initialState()), /awaiting confirmation/);
  assert.throws(()=>rollPool([],0,rng), /Dice count/);
  assert.throws(()=>rollPool([1],0,rng), /Invalid die/);
});
