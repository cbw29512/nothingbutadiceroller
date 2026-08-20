import { getIdentity } from '../account-api.js';
import { playDiceSound, playNat20Fanfare } from '../audio.js';
import { clearPhysics, rollPhysics } from '../physics.js';
import { state, savePreferences } from '../state.js';
import { renderHistory, renderPool, renderResults, setStatus, showCrit } from '../ui.js';
import { getSkinColor } from '../utils.js';
import { compileShortcut, getNextRollChangingVariantId } from './compiler.mjs';
import { executeShortcutRoll } from './roller-adapter.mjs';
import { loadShortcutWorkspace } from './persistence-client.mjs';
import { loadLocalShortcutWorkspace } from './local-persistence.mjs';
import { hydrateShortcutSlot, normalizeShortcutSlots } from './persistence.mjs';
import { compileRawCatalogEntry, getRawSpell } from './raw/index.mjs';
import { renderShortcutToolbar } from './toolbar.mjs';

let slots = [];
let hydratedSlots = [];
let active = null;
let accountUser = null;
let initialized = false;
let demoMode = false;

function emitState() {
  document.dispatchEvent(new Event('shortcutstatechange'));
  document.dispatchEvent(new Event('rollstatechange'));
}

function isDeployPreviewDemo() {
  try {
    return location.hostname.startsWith('deploy-preview-')
      && new URLSearchParams(location.search).get('shortcutDemo') === '1';
  } catch {
    return false;
  }
}

function demoSlots() {
  return normalizeShortcutSlots([
    { id: 'demo-fireball', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'fireball', baseVariantId: 'slot-3' },
    { id: 'demo-fire-bolt', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'fire-bolt', baseVariantId: 'tier-2', inputs: { toHit: 9 } },
    { id: 'demo-scorching-ray', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'scorching-ray', baseVariantId: 'slot-2', inputs: { toHit: 9 } },
    { id: 'demo-magic-missile', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'magic-missile', baseVariantId: 'slot-1' },
    { id: 'demo-acid-arrow', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'acid-arrow', baseVariantId: 'slot-2', inputs: { toHit: 9 } },
    { id: 'demo-disintegrate', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'disintegrate', baseVariantId: 'slot-6' },
    { id: 'demo-harm', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'harm', baseVariantId: 'base' },
    { id: 'demo-acid-splash', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'acid-splash', baseVariantId: 'tier-2' },
  ]);
}

function toolbarItem(slot) {
  const hydrated = hydrateShortcutSlot(slot);
  return {
    id: slot.id,
    name: hydrated.definition.name,
    icon: slot.icon,
  };
}

function findHydrated(slotId) {
  return hydratedSlots.find((entry) => entry.slot.id === slotId) || null;
}

function compileSlot(slot, variantId = slot.baseVariantId) {
  if (slot.source === 'raw') {
    const entry = getRawSpell(slot.ruleset, slot.spellId);
    if (!entry) throw new Error(`Verified RAW shortcut not found: ${slot.spellId}`);
    return {
      plan: compileRawCatalogEntry(entry, { variantId, inputs: slot.inputs || {} }),
      entry,
      definition: entry.shortcut,
    };
  }
  return {
    plan: compileShortcut(slot.definition, { variantId }),
    entry: null,
    definition: slot.definition,
  };
}

function slotVariantLabel(slot, variantId) {
  const compiled = compileSlot(slot, variantId);
  return compiled.plan.variant.label;
}

function slotRollLabel(slot, variantId) {
  const compiled = compileSlot(slot, variantId);
  const upper = compiled.plan.name.toUpperCase();
  if (compiled.entry?.scalingMode === 'slot') {
    return `ROLL ${upper} ${compiled.plan.variant.scaleRank}`;
  }
  return `ROLL ${upper}`;
}

function setRollLabels() {
  if (!active) return;
  const label = slotRollLabel(active.slot, active.variantId);
  ['roll-btn', 'mobile-roll-btn'].forEach((id) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.textContent = label;
    button.setAttribute('aria-label', label);
    button.title = label;
  });
}

function setGearState() {
  const available = true;
  const mobileHint = document.getElementById('mobile-shortcut-hint');
  if (mobileHint) mobileHint.hidden = !available;
  ['shortcut-settings-btn', 'mobile-shortcut-settings-btn'].forEach((id) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.hidden = !available;
    button.disabled = state.rolling || Boolean(active);
  });
  document.querySelectorAll('.shortcut-roll-cluster').forEach((cluster) => {
    cluster.classList.toggle('has-shortcut-settings', available);
  });
}

function showShortcutInfo(slotId) {
  const host = document.getElementById('shortcut-tooltip');
  const found = findHydrated(slotId);
  if (!host || !found) return;
  const variantId = active?.slot.id === slotId ? active.variantId : found.slot.baseVariantId;
  const compiled = compileSlot(found.slot, variantId);
  const summary = compiled.plan.groups.flatMap((group) => group.instances.slice(0, 1).map((instance) => {
    const dice = instance.terms.map((term) => `${term.count}d${term.sides}`).join(' + ');
    const modifier = instance.modifier ? ` ${instance.modifier > 0 ? '+' : '−'} ${Math.abs(instance.modifier)}` : '';
    return `${group.label}: ${dice}${modifier}${group.damageType ? ` ${group.damageType}` : ''}`;
  })).join(' • ');
  host.textContent = `${compiled.plan.name} • ${compiled.plan.variant.label} • ${summary}`;
  host.hidden = false;
}

function hideShortcutInfo() {
  const host = document.getElementById('shortcut-tooltip');
  if (host) host.hidden = true;
}

function renderToolbar() {
  const section = document.getElementById('shortcut-toolbar-section');
  const container = document.getElementById('shortcut-toolbar');
  const title = document.getElementById('shortcut-toolbar-title');
  const note = section?.querySelector('.shortcut-toolbar-note');
  if (!section || !container || !title || !note) return;

  hydratedSlots = slots.map((slot) => ({ slot, hydrated: hydrateShortcutSlot(slot) }));
  const hasShortcuts = slots.length > 0;
  section.hidden = false;
  title.textContent = 'Press ⚙ to configure';
  note.hidden = !hasShortcuts;
  if (!slots.length) {
    container.replaceChildren();
    container.hidden = true;
    setGearState();
    return;
  }

  renderShortcutToolbar(container, slots.map(toolbarItem), {
    activeId: active?.slot.id || null,
    onActivate: (item) => prepareShortcut(item.id),
    onInfo: (item) => showShortcutInfo(item.id),
    onInfoHide: hideShortcutInfo,
  });
  setGearState();
  setRollLabels();
}

function restoreNormalRollLabel() {
  renderPool();
}

function activeCompiled() {
  if (!active) return null;
  return compileSlot(active.slot, active.variantId);
}

function formatInstanceRoll(instance, resolved) {
  const values = (resolved?.dice || []).flatMap((die) => die.values.map((value) => `d${die.sides} ${value}`));
  const rollText = values.join(' + ');
  const modifier = instance.modifier
    ? ` ${instance.modifier > 0 ? '+' : '−'} ${Math.abs(instance.modifier)}`
    : '';
  return `${rollText}${modifier} = ${instance.total}`;
}

function formatShortcutResult(execution) {
  const resolvedById = new Map(execution.resolvedInstances.map((item) => [item.instanceId, item]));
  const parts = [];
  for (const group of execution.result.groups) {
    group.instances.forEach((instance, index) => {
      const suffix = group.instances.length > 1 ? ` ${index + 1}` : '';
      const damageType = group.damageType ? ` ${group.damageType.toUpperCase()}` : '';
      parts.push(`${group.label.toUpperCase()}${suffix}${damageType}: ${formatInstanceRoll(instance, resolvedById.get(instance.id))}`);
    });
  }
  if (execution.result.damageTotal) parts.push(`TOTAL DAMAGE = ${execution.result.damageTotal}`);
  if (execution.result.healingTotal) parts.push(`TOTAL HEALING = ${execution.result.healingTotal}`);
  return parts.join(' | ');
}

function shortcutDisplayTotal(execution) {
  if (execution.result.damageTotal) return execution.result.damageTotal;
  if (execution.result.healingTotal) return execution.result.healingTotal;
  return '—';
}

function historyFormula() {
  if (!active) return 'Shortcut';
  const compiled = activeCompiled();
  return `${compiled.plan.name} • ${compiled.plan.variant.label}`;
}

function saveShortcutHistory(execution, breakdown) {
  state.history.unshift({
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    formula: historyFormula(),
    breakdown,
    total: execution.result.damageTotal
      ? `Damage ${execution.result.damageTotal}`
      : execution.result.healingTotal
        ? `Healing ${execution.result.healingTotal}`
        : 'Grouped',
  });
  if (state.history.length > 30) state.history.length = 30;
  savePreferences();
  renderHistory();
}

export function isShortcutPrepared() {
  return Boolean(active);
}

export function canRollPreparedShortcutFromTray() {
  return Boolean(state.physicsReady && !state.rolling && active);
}

export async function prepareShortcut(slotId) {
  if (state.rolling) return;
  const found = findHydrated(slotId);
  if (!found) return;

  try {
    if (active && active.slot.id !== slotId) return;

    if (!active) {
      state.selectedDice = [];
      state.hasRolled = false;
      state.d20Mode = 'normal';
      active = { slot: found.slot, variantId: found.slot.baseVariantId };
      renderPool();
    } else if (active.slot.source === 'raw') {
      const compiled = compileSlot(active.slot, active.variantId);
      if (compiled.entry?.scalingMode === 'slot') {
        active.variantId = getNextRollChangingVariantId(compiled.definition, active.variantId);
      }
    }

    const compiled = activeCompiled();
    renderResults(0, `Prepared: ${compiled.plan.name} • ${compiled.plan.variant.label}`);
    setStatus(`${compiled.plan.name} prepared. Press Roll or the tray to execute.`, 'ready');
    renderToolbar();
    emitState();
  } catch (error) {
    console.error('Failed to prepare shortcut:', error);
    setStatus(error.message || 'Unable to prepare shortcut.', 'error');
  }
}

export async function clearPreparedShortcut({ clearDice = false } = {}) {
  if (!active) return false;
  active = null;
  hideShortcutInfo();
  if (clearDice) {
    state.selectedDice = [];
    state.hasRolled = false;
    await clearPhysics();
    renderResults();
  }
  restoreNormalRollLabel();
  renderToolbar();
  emitState();
  return true;
}

export async function performPreparedShortcutRoll() {
  if (!active || state.rolling) return false;
  const current = active;
  state.rolling = true;
  state.d20Mode = 'normal';
  emitState();

  try {
    if (!state.physicsReady) throw new Error('3D physics is not ready yet.');
    const compiled = compileSlot(current.slot, current.variantId);
    setStatus(`Rolling ${compiled.plan.name}…`);
    document.getElementById('tray-empty-state')?.classList.add('hidden');
    playDiceSound();

    const color = getSkinColor(state.dieSkin, state.customAppearance?.diceColor);
    const execution = await executeShortcutRoll(compiled.plan, (notation) => rollPhysics(notation, color));
    const breakdown = formatShortcutResult(execution);
    state.hasRolled = true;
    renderResults(shortcutDisplayTotal(execution), breakdown);
    saveShortcutHistory(execution, breakdown);

    if (execution.criticalTriggerInstanceIds.length) {
      showCrit('nat20');
      playNat20Fanfare();
    }

    active = null;
    renderToolbar();
    restoreNormalRollLabel();
    setStatus(`Saved to history • ${state.history.length} roll${state.history.length === 1 ? '' : 's'}`, 'ready');
    return true;
  } catch (error) {
    console.error('Shortcut roll failed:', error);
    setStatus(error.message || 'Shortcut roll failed.', 'error');
    return false;
  } finally {
    state.rolling = false;
    state.d20Mode = 'normal';
    emitState();
  }
}

async function loadForSession(user) {
  accountUser = user || null;
  active = null;
  demoMode = isDeployPreviewDemo();

  try {
    if (demoMode) {
      slots = demoSlots();
      renderToolbar();
      emitState();
      setStatus('Shortcut demo mode ready.', 'ready');
      return;
    }
    if (!accountUser) {
      slots = loadLocalShortcutWorkspace().workspace.shortcuts;
      renderToolbar();
      emitState();
      return;
    }
    const stored = await loadShortcutWorkspace();
    slots = stored.workspace.shortcuts;
    renderToolbar();
    emitState();
  } catch (error) {
    console.error('Failed to load shortcut workspace:', error);
    slots = [];
    renderToolbar();
    emitState();
    setStatus('Saved shortcuts could not be loaded. Normal rolling is still available.', 'error');
  }
}

function bindGear() {
  const openManager = () => {
    if (active || state.rolling) return;
    location.href = demoMode ? '/rolls.html?shortcutDemo=1' : '/rolls.html';
  };
  document.getElementById('shortcut-settings-btn')?.addEventListener('click', openManager);
  document.getElementById('mobile-shortcut-settings-btn')?.addEventListener('click', openManager);
}

export function syncShortcutRuntimeUI() {
  setGearState();
  if (active) setRollLabels();
}

export function initShortcutRuntime() {
  if (initialized) return;
  initialized = true;
  bindGear();
  renderToolbar();

  const identity = getIdentity();
  identity.on('init', loadForSession);
  identity.on('login', loadForSession);
  identity.on('logout', () => loadForSession(null));
}
