// Affiliate slots for tabletop gear (dice, books, table accessories).
//
// Everything is EMPTY on purpose. Nothing renders until:
//   1. enabled is true,
//   2. at least one item has a real https:// URL from a program you have actually joined
//      (placeholder, example, TODO, or http:// links are ignored), and
//   3. disclosure is non-empty. It is shown above the links (FTC). If you use Amazon Associates,
//      include the exact line: "As an Amazon Associate I earn from qualifying purchases."
//
// Items without a real URL are skipped, and a group with no real items is not shown.
export const AFFILIATE_CONFIG = Object.freeze({
  enabled: false,
  heading: 'Gear for your table',
  disclosure: '',
  groups: Object.freeze([
    Object.freeze({
      id: 'dice',
      title: 'Dice sets',
      items: Object.freeze([
        Object.freeze({ label: 'Polyhedral dice set (7 dice)', url: '', note: '' }),
        Object.freeze({ label: 'Metal dice set', url: '', note: '' }),
        Object.freeze({ label: 'Dice tray', url: '', note: '' }),
        Object.freeze({ label: 'Dice bag', url: '', note: '' }),
      ]),
    }),
    Object.freeze({
      id: 'books',
      title: 'D&D books',
      items: Object.freeze([
        Object.freeze({ label: "Player's Handbook", url: '', note: '' }),
        Object.freeze({ label: "Dungeon Master's Guide", url: '', note: '' }),
        Object.freeze({ label: 'Monster Manual', url: '', note: '' }),
      ]),
    }),
    Object.freeze({
      id: 'table',
      title: 'At the table',
      items: Object.freeze([
        Object.freeze({ label: 'Battle mat', url: '', note: '' }),
        Object.freeze({ label: 'DM screen', url: '', note: '' }),
        Object.freeze({ label: 'Initiative tracker', url: '', note: '' }),
      ]),
    }),
  ]),
});
