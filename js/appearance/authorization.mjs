function owns(set, userId) {
  return Boolean(userId) && !set?.systemOwned && set?.ownerId === userId;
}

export function canUseDiceSet(set, userId = null) {
  try {
    if (!set) return false;
    if (set.systemOwned) return true;
    if (set.visibility === 'public' && set.locked) return true;
    return owns(set, userId);
  } catch (error) {
    console.error('Failed to evaluate dice-set use permission:', error);
    return false;
  }
}

export function canEditDiceSet(set, userId) {
  try {
    return owns(set, userId) && !set.locked;
  } catch (error) {
    console.error('Failed to evaluate dice-set edit permission:', error);
    return false;
  }
}

export function canDeleteDiceSet(set, userId) {
  try {
    return owns(set, userId);
  } catch (error) {
    console.error('Failed to evaluate dice-set delete permission:', error);
    return false;
  }
}

export function canLockDiceSet(set, userId) {
  try {
    return owns(set, userId) && !set.locked;
  } catch (error) {
    console.error('Failed to evaluate dice-set lock permission:', error);
    return false;
  }
}

export function canUnlockDiceSet(set, userId) {
  try {
    return owns(set, userId) && set.locked;
  } catch (error) {
    console.error('Failed to evaluate dice-set unlock permission:', error);
    return false;
  }
}

export function canPublishDiceSet(set, userId) {
  try {
    return owns(set, userId) && set.locked;
  } catch (error) {
    console.error('Failed to evaluate dice-set publish permission:', error);
    return false;
  }
}
