import { openScopedStore } from './deploy-store.mjs';

export const CONFIGURATION_STORE_NAME = 'dice-user-configurations';
export const SHORTCUT_STORE_NAME = 'dice-user-shortcuts-v1';

function userPart(userId) {
  const value = String(userId || '').trim();
  if (!value) throw new Error('User id is required.');
  return encodeURIComponent(value);
}

export function configurationKey(userId) {
  return `users/${userPart(userId)}/configurations.json`;
}

export function shortcutKey(userId) {
  return `users/${userPart(userId)}/shortcuts-v1.json`;
}

export function openConfigurationStore(context) {
  return openScopedStore(CONFIGURATION_STORE_NAME, context);
}

export function openShortcutStore(context) {
  return openScopedStore(SHORTCUT_STORE_NAME, context);
}
