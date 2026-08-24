# Nothing But A Dice Roller

A fast tabletop RPG dice roller with standard 3D dice, advantage/disadvantage quick rolls, secure custom dN rolls, saved roll shortcuts, account sync, and visual Dice Studio customization.

**Production:** https://nothingbutattrpgdiceroller.netlify.app/

**Free dice resources:** https://nothingbutattrpgdiceroller.netlify.app/resources.html

**D20 probability calculator:** https://nothingbutattrpgdiceroller.netlify.app/dice-probability.html

## Core product rules

- Standard RPG dice remain standard physical shapes with standard numeric results.
- RAW mechanics are immutable inside RAW shortcut records.
- Homebrew is explicit and separate from RAW.
- Dice customization is presentation only; changing a face label never changes the underlying result.
- Default Dice is permanent, system-owned, immutable, and always available as the fallback.
- Public Community dice sets must be locked before publishing.

## Main surfaces

- `/` — main dice roller
- `/resources.html` — public dice resource hub
- `/d20-roller.html` — d20 guide and direct roller path
- `/advantage-disadvantage.html` — d20 advantage/disadvantage guide
- `/dice-probability.html` — exact d20 threshold probability calculator
- `/custom-dice-roller.html` — arbitrary dN guide
- `/d100-roller.html` — percentile dice guide
- `/dice-notation.html` — dice notation guide
- `/dice-randomness.html` — randomness/trust explanation
- `/custom-3d-dice.html` — public Dice Studio showcase
- `/rolls.html` — roll shortcut manager
- `/customize.html` — Dice Studio
- `/how-to.html` — user guide
- `/privacy.html` — privacy/data explanation
- `/legal.html` — legal notices and SRD attribution

## Randomization

Seven standard dice (d4, d6, d8, d10, d12, d20, d100) use DiceBox 3D physics. Nonstandard CUSTOM dN rolls use Web Crypto with rejection sampling and support d2 through d1,000,000.

## Accounts and storage

Netlify Identity provides authentication. Signed-in saved configurations, shortcuts, and Dice Studio records use account-scoped Netlify Blob storage. Production and nonproduction stores are separated by deploy context.

Community publishing uses privacy-safe public projections. Public records use opaque public IDs and do not expose account email or internal account IDs.

## Development

Requirements:

- Node.js 22.12+
- npm

Install locked dependencies and run the full validation/build chain:

```bash
npm ci
npm run build
```

`npm run build` runs the complete contract suite first, builds the static `dist/` directory, then strips internal diagnostic harnesses from the release bundle.

## Deployment

Netlify configuration lives in `netlify.toml`.

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

Pull requests run the full validation workflow before merge. Changes should be developed on branches and tested through Netlify Deploy Preview before production merge.

## Search and discovery

The public growth surface uses unique titles and canonical URLs, structured data, a crawlable resource hub, and `sitemap.xml`. The interactive Dice Studio and roll shortcut editor remain intentionally `noindex` while public pages explain those features in a search-friendly form.

The release contract validates canonical metadata, sitemap coverage, protected `noindex` surfaces, PWA shortcuts, and the d20 probability calculator math.

## Security and privacy design

Authenticated mutations require trusted-origin verification. Cloud payloads are validated before use, public dice-set records are revalidated against authoritative owner state, and public/capability image responses are designed to fail closed after privacy changes.

See `/privacy.html` for user-facing details.

## SRD attribution

The project contains a limited structured set of roll-relevant mechanics derived from SRD 5.1 and SRD 5.2.1 under CC BY 4.0. See `SRD_ATTRIBUTION.md` and `/legal.html`.

## License

Original project code and design are source-available under the repository's proprietary license. SRD-derived material and third-party dependencies remain subject to their respective licenses.
