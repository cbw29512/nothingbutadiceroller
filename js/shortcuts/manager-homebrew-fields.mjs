import { ROLLER_DIE_SIDES } from './constants.mjs';
import { managerContext } from './manager-context.mjs';
import { element, selectWithOptions } from './manager-ui.mjs';

export function homebrewPayload() {
  return {
    name: document.getElementById('homebrew-name')?.value || '',
    icon: document.getElementById('homebrew-icon')?.value || 'dice',
    category: document.getElementById('homebrew-category')?.value || 'custom',
    groups: managerContext.builderGroups,
  };
}

function fieldControl(group, key, type, renderBuilder, renderPreview) {
  let control;
  if (key === 'kind') {
    control = selectWithOptions(['attack', 'damage', 'healing', 'save', 'check', 'utility'], group.kind);
  } else if (key === 'sides') {
    control = selectWithOptions(ROLLER_DIE_SIDES.map(String), String(group.sides), (value) => `d${value}`);
  } else {
    control = element('input', 'group-input');
    control.type = type;
    if (type === 'number') control.step = '1';
    control.value = String(group[key]);
  }
  control.classList.add('group-input');
  control.addEventListener('change', () => {
    group[key] = ['count', 'sides', 'modifier', 'repeat'].includes(key) ? Number(control.value) : control.value;
    if (key === 'kind') {
      if (group.kind === 'attack') group.sides = 20;
      if (group.kind === 'damage' && !group.damageType) group.damageType = 'slashing';
      if (group.kind !== 'damage') group.critEligible = false;
      renderBuilder(renderPreview);
    }
    renderPreview();
  });
  if (key === 'label') control.addEventListener('input', () => {
    group.label = control.value;
    renderPreview();
  });
  return control;
}

function appendDamageFields(card, group, attackGroups, renderBuilder, renderPreview) {
  const damage = element('div', 'group-damage-fields');
  const typeLabel = element('label', '', 'Damage type');
  const typeInput = element('input', 'group-input');
  typeInput.type = 'text';
  typeInput.maxLength = 40;
  typeInput.value = group.damageType;
  typeInput.addEventListener('input', () => {
    group.damageType = typeInput.value;
    renderPreview();
  });
  typeLabel.append(typeInput);

  const critLabel = element('label', 'checkbox-control');
  const critInput = element('input');
  critInput.type = 'checkbox';
  critInput.checked = group.critEligible;
  critInput.disabled = attackGroups.length === 0;
  critInput.addEventListener('change', () => {
    group.critEligible = critInput.checked;
    if (group.critEligible && !group.triggerGroupId) group.triggerGroupId = attackGroups[0]?.id || '';
    renderBuilder(renderPreview);
    renderPreview();
  });
  critLabel.append(critInput, element('span', '', 'Crit eligible'));

  const triggerLabel = element('label', '', 'Triggered by');
  const trigger = selectWithOptions(
    attackGroups.map((attack) => attack.id),
    group.triggerGroupId,
    (id) => attackGroups.find((attack) => attack.id === id)?.label || id,
  );
  trigger.disabled = !group.critEligible;
  trigger.addEventListener('change', () => {
    group.triggerGroupId = trigger.value;
    renderPreview();
  });
  triggerLabel.append(trigger);
  damage.append(typeLabel, critLabel, triggerLabel);
  card.append(damage);
}

export function renderBuilderGroups(renderPreview) {
  const host = document.getElementById('homebrew-groups');
  if (!host) return;
  host.replaceChildren();
  const attackGroups = managerContext.builderGroups.filter((group) => group.kind === 'attack');
  const specs = [
    ['Group name', 'text', 'label'], ['Roll type', 'select', 'kind'], ['Number of dice', 'number', 'count'],
    ['Die type', 'select', 'sides'], ['Bonus / Modifier', 'number', 'modifier'], ['Attacks / Targets', 'number', 'repeat'],
  ];

  managerContext.builderGroups.forEach((group, index) => {
    const card = element('section', 'homebrew-group-card');
    const fields = element('div', 'group-fields');
    for (const [labelText, type, key] of specs) {
      const label = element('label', '', labelText);
      label.append(fieldControl(group, key, type, renderBuilderGroups, renderPreview));
      fields.append(label);
    }
    card.append(fields);
    if (group.kind === 'damage') appendDamageFields(card, group, attackGroups, renderBuilderGroups, renderPreview);

    const actions = element('div', 'group-card-actions');
    const remove = element('button', 'btn danger', 'Remove Group');
    remove.type = 'button';
    remove.disabled = managerContext.builderGroups.length === 1;
    remove.addEventListener('click', () => {
      managerContext.builderGroups.splice(index, 1);
      renderBuilderGroups(renderPreview);
      renderPreview();
    });
    actions.append(remove);
    card.append(actions);
    host.append(card);
    if (index < managerContext.builderGroups.length - 1) host.append(element('div', 'and-divider', 'AND'));
  });
}

