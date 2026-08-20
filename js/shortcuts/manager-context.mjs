import {
  DEFAULT_SHORTCUT_OPTIONS, hydrateShortcutSlot, normalizeShortcutOptions, normalizeShortcutSlots,
} from './persistence.mjs';

export const managerContext = {
  accountUser: null,
  serverState: null,
  shortcuts: [],
  options: DEFAULT_SHORTCUT_OPTIONS,
  selectedSlotId: null,
  dirty: false,
  demoMode: false,
  localMode: false,
  activeTab: '2024',
  nextGroupNumber: 1,
  builderGroups: [],
  rawDrafts: new Map(),
};

export function createBuilderGroup(kind = 'damage', number = 1) {
  return {
    id: `group-${number}`,
    label: kind === 'attack' ? `Attack ${number}` : `Damage ${number}`,
    kind,
    count: 1,
    sides: kind === 'attack' ? 20 : 6,
    modifier: 0,
    repeat: 1,
    damageType: kind === 'damage' ? 'slashing' : '',
    critEligible: false,
    triggerGroupId: '',
  };
}

export function resetBuilder() {
  managerContext.nextGroupNumber = 1;
  managerContext.builderGroups = [createBuilderGroup('damage', 1)];
}

resetBuilder();

export function isDeployPreviewDemo() {
  try {
    return location.hostname.startsWith('deploy-preview-')
      && new URLSearchParams(location.search).get('shortcutDemo') === '1';
  } catch (error) {
    console.error('Failed to determine shortcut demo mode:', error);
    return false;
  }
}

export function demoSlots() {
  return normalizeShortcutSlots([
    { id: 'demo-fireball', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'fireball', baseVariantId: 'slot-3' },
    { id: 'demo-fire-bolt', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'fire-bolt', baseVariantId: 'tier-2' },
    { id: 'demo-ice-storm', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'ice-storm', baseVariantId: 'slot-4' },
    { id: 'demo-meteor-swarm', source: 'raw', ruleset: 'dnd5e-2024', spellId: 'meteor-swarm', baseVariantId: 'base' },
  ]);
}

export function canEdit() {
  return Boolean(managerContext.accountUser || managerContext.demoMode || managerContext.localMode);
}

export function slotName(slot) {
  try {
    return hydrateShortcutSlot(slot).definition.name;
  } catch (error) {
    console.error('Failed to resolve shortcut name:', error);
    return slot?.id || 'Shortcut';
  }
}

export function applyServerState(serverState, accountUser) {
  managerContext.serverState = serverState;
  managerContext.accountUser = accountUser || null;
  managerContext.shortcuts = [...(serverState?.workspace?.shortcuts || [])];
  managerContext.options = normalizeShortcutOptions(serverState?.workspace?.options || DEFAULT_SHORTCUT_OPTIONS);
  managerContext.activeTab = managerContext.options.preferredRuleset === 'dnd5e-2014' ? '2014' : '2024';
  managerContext.selectedSlotId = null;
  managerContext.dirty = false;
}

