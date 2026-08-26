# Styling

## Design system

The visual language is defined in `frontend/tailwind.config.js` as Tailwind theme extensions. There is no CSS-in-JS and no external UI kit — everything is Tailwind utilities plus a small set of design tokens.

## Color tokens

| Token         | Hex       | Meaning                                              |
| ------------- | --------- | ---------------------------------------------------- |
| `bg`          | `#FAF8F5` | App background (warm off-white).                     |
| `bg2`         | `#EAE3D9` | Slightly darker sand — borders, dividers, inputs.    |
| `surface`     | `#FFFFFF` | Cards, modals, elevated panels.                      |
| `ink`         | `#2C362F` | Primary text.                                        |
| `ink2`        | `#5C6A61` | Muted / secondary text.                              |
| `brand`       | `#D45D3F` | Primary accent (terracotta) — CTAs, active states.   |
| `brandHover`  | `#B34A30` | Hover state of the primary accent.                   |
| `accent`      | `#E29547` | Warm secondary accent — amber highlights.            |
| `successc`    | `#4A6B53` | Success states, "served" badges.                     |
| `destructive` | `#A63C2E` | Errors, destructive buttons.                         |

Semantic pattern:

- Backgrounds → `bg-bg`, `bg-surface`.
- Borders / muted separators → `border-bg2`.
- Text → `text-ink` (primary), `text-ink2` (secondary).
- Primary CTA → `bg-brand hover:bg-brandHover text-white`.
- Destructive → `bg-destructive` or `text-destructive`.

## Typography

Three fonts loaded via Google Fonts in `frontend/public/index.html`:

- **Outfit** (`font-heading`) — headings, titles, big numbers.
- **DM Sans** (`font-body`, default) — body text.
- **JetBrains Mono** (`font-mono`) — money, PINs, tokens, timestamps. Anything the eye needs to grid-align.

## Elevation

Two custom shadows:

- `shadow-soft` — subtle, for interactive surfaces (buttons, cards on hover).
- `shadow-lift` — pronounced, for modals, drawers, and hero CTAs.

## Motion

Two keyframe animations, both defined in Tailwind:

- **`animate-pop`** — 400ms scale bounce. Used on the cart total when items are added.
- **`animate-fadeUp`** — 350ms fade + 8px translate. Used for every new-mount surface (menu cards, modals, drawers, drafts, banners) so nothing snaps in coldly.

Rules of thumb:

- Never use `transition: all`. Always name the properties (`transition-colors`, `transition-transform`, `transition`).
- Micro-interactions on every button: `hover:-translate-y-0.5` for lift, `transition disabled:opacity-50` for disabled states.
- No emoji as icons — use `lucide-react`.

## Common utility patterns

Pill buttons:
```
rounded-full bg-brand hover:bg-brandHover text-white font-medium
px-4 py-2.5 shadow-lift transition disabled:opacity-50
```

Card:
```
bg-surface border border-bg2 rounded-2xl p-4
hover:shadow-lift hover:-translate-y-0.5 transition-all
```

Glass header:
```
sticky top-0 z-40 glass border-b border-white/40
```
(`glass` is defined in `index.css` — backdrop-blur + white/60 background.)

Status badges use a small colour lookup:
```
PENDING   bg-slate-100 text-slate-700
CONFIRMED bg-blue-100 text-blue-700
PREPARING bg-amber-100 text-amber-800
READY     bg-emerald-100 text-emerald-800
SERVED    bg-successc/15 text-successc
CANCELLED bg-red-100 text-red-700
```

## Print styling

`Receipt.js` and the customer bill viewer use a `.receipt-print` container plus a `print:hidden` utility to hide UI chrome when the user chooses "Print". No dedicated stylesheet — Tailwind's `print:` variant is enough.

## Accessibility notes

- Every interactive element has a `data-testid` (see [contributing.md](./contributing.md)).
- Colour is never the sole conveyor of state — every status badge has a text label.
- Buttons that trigger destructive actions (`Remove`, `Void bill`, `Sign out`) always route through a confirm modal — never a bare click.
