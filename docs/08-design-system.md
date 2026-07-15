# PERSEA Design System

A reference for recreating the PERSEA product's visual language anywhere — Figma, another codebase, a design tool. This describes what exists in `app/shared/theme.css` and `app/shared/ui.js` today, extracted as a portable spec.

**Feel:** premium consulting, editorial, quietly confident. Near-black ground, warm gold accents, high-contrast serif italics for emotional moments, a clean geometric sans for everything functional. Subtle motion everywhere (drifting particles, scroll reveals, magnetic hover) — alive but never loud.

---

## 1. Color

| Token | Hex / Value | Use |
|---|---|---|
| `--bg` | `#0c0a09` | Page background (near-black, warm not blue-black) |
| `--bg2` | `#141210` | Secondary surface (e.g. phase-tracker dot default state) |
| `--card` | `#161210` | Card/surface background |
| `--cream` | `#f2ece0` | Primary text, primary button fill |
| `--muted` | `#a89a8c` | Secondary text, placeholders |
| `--line` | `rgba(242,236,224,.12)` | Borders, dividers — cream at 12% opacity |
| `--terracotta` | `#b8863a` | **Primary accent** — warm gold/bronze. Used for card accent bars, active nav, focus rings, links, progress fill start, button-hover borders |
| `--terracotta-soft` | `rgba(184,134,58,.45)` | Glow/ambient variant of the accent |
| `--gold` | `#dcc7a8` | Secondary lighter gold — progress fill end, "done" badge text, phase-tier label |
| `--error` | `#a85a52` | **Only** for genuine error/wrong-answer states (quiz feedback, error toasts). Never used as a design accent — the brand has no red |

Rule of thumb: everything warm and metallic is one of the two golds; nothing in the UI is saturated or cool except the one muted error red reserved for mistakes.

## 2. Typography

Two families, Google Fonts:

- **Playfair Display** — display serif. Used *only* for: page titles, brand mark, section headlines, phase-tier label, quote-like moments. Always paired with italic + medium/semibold weight for the "editorial" feel (`font-style: italic; font-weight: 500–700`).
- **Poppins** — geometric sans. Everything else: body copy, labels, buttons, nav, form fields. Weights used: 300, 400, 500, 600, 700.

Import:
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

Type scale in use:
- Page title (`.pg-title`): `clamp(1.9rem, 3.2vw, 2.6rem)`, Playfair italic 500
- Brand mark (nav logo): 19px, Playfair italic 600, letter-spacing .04em
- Body: 14–16px, Poppins 400
- Eyebrow/label (`.eyebrow`): 10.5px, Poppins 600, uppercase, letter-spacing .28em, colored `--terracotta`
- Numbered step eyebrow: `"01 — 06 · Label"` — the number pair in `--gold`, a terracotta-at-60%-opacity middot separator, label in `--muted`. This is the signature "step-through" label pattern used on every major section.

## 3. Texture & Atmosphere (applied to every page, behind content)

These four layers stack in this order, `position: fixed; inset: 0`, low z-index, `pointer-events: none`:

1. **Ambient glow** — two radial gradients (top-left and bottom-right) in terracotta at 12–16% opacity, slowly drifting/scaling over 20s (`ease-in-out infinite alternate`).
2. **Film grain** — an inline SVG `feTurbulence` noise texture, tiled, `mix-blend-mode: overlay`, opacity 0.4, stepped animation (8 steps, 8s loop) so it shifts subtly rather than static.
3. **Floating particles** — 14–18 small circular gold motes (`radial-gradient(circle, rgba(220,199,168,.9), transparent 70%)`), each 1.5–4.5px, drifting from bottom to top of viewport. **Critical: keep this slow** — 55–85s per full traverse, linear easing (not ease-in-out, which reads as a speed-up), randomized horizontal drift ±20px, randomized start delay so they don't sync. Peak opacity ~0.3–0.45. This should read as ambient dust, not a distraction.
4. Content sits above all of this at `z-index: 1+`.

## 4. Surfaces & Components

**Card** — the base building block everywhere:
```css
background: var(--card); border: 1px solid var(--line); border-radius: 4px; padding: 22px 24px;
```
Always carries a 2px left-edge accent bar in `--terracotta` at 70% opacity (`::before`, full height). Interactive cards (`<a class="card">`, `<button class="card">`, or `.card-interactive`) lift 3px on hover with a soft dark shadow and the accent bar widens to 3px.

**Magnetic tilt** (`.tilt-card`) — opt-in on top of `.card` for extra-tactile surfaces (stat tiles, format pickers, quiz options): cursor-tracked 3D rotation, ±5°, `perspective(900px)`, eases back to neutral on pointer-leave over .25s.

**Buttons** — three tiers, no more:
- `.btn-primary` — filled cream, dark text, for the one primary action per view
- `.btn-ghost` — outlined, transparent fill, terracotta border on hover
- `.btn-text` — no border/fill, muted → cream on hover, for tertiary/dismiss actions

**Badges** — pill-shaped, 11px, three semantic states: `badge-completed` (gold-tinted), `badge-progress` (terracotta-tinted), `badge-locked` (neutral/dim). No red badge state exists.

**Progress bar** — 2px track in `--line`, fill is a horizontal gradient from `--terracotta` to `--gold`, animates width over .7s.

**Form fields** (`.field`) — transparent background, `--line` border, terracotta border on focus, no fill change.

**Toast** — bottom-right, dark card surface, small terracotta dot prefix, fades in/out over .3s, auto-dismisses ~2.6s.

**Mood/feedback prompt** — bottom-*left* (deliberately opposite corner from toast so they never collide), floating card with a row of large tappable emoji, dismissible, slides/fades in over .4s.

## 5. Signature Component: Phase Tracker

A horizontal stepper showing progress through a multi-phase program (this system's biggest "wow" UI element — worth recreating carefully):

- A dotted connector line (`repeating-linear-gradient`) runs behind all nodes; a solid terracotta line overlays it up to the current step, animating its width over .8s when progress changes.
- Each node is a 40px circle: **done** = filled terracotta with a checkmark; **current** = dark fill, terracotta border, gold text, plus a **pulsing glow** (`box-shadow` breathing between two radii over 2.6s ease-in-out) — this is the "alive" focal point of the whole tracker; **locked** = dim, 55% opacity, no interaction.
- Labels sit below each dot; current step's label is bold cream, others muted.
- Collapses to a vertical list on mobile (line hidden, dots+labels go row-wise).
- Nodes are real buttons — clicking a locked node should give feedback (toast), not silently fail; clicking a completed/current node should navigate somewhere meaningful.

## 6. Motion Principles

- **Load-time reveal**: elements fade up 14px over .8s with a staggered delay per element (~.08s increments) — used on pages that render once and stay static.
- **Scroll-triggered reveal**: same fade-up but gated by IntersectionObserver, triggering at 15% visibility — used on long pages (13-section playbook, question lists) so content arrives as you scroll instead of all firing on load. **Don't use scroll-reveal on views that re-render on every user interaction** (e.g. a checklist that redraws on every checkbox click) — it'll flicker; use load-time reveal there instead.
- **Counted numbers**: any stat (%, score) animates from 0 to its value over ~700–1100ms with cubic ease-out, rather than appearing as a static digit.
- All easing curves are `cubic-bezier(.22,1,.36,1)` (a soft overshoot-free ease-out) — used consistently for reveals, hovers, and the tilt effect. This single curve is a big part of why the motion feels cohesive rather than assorted.

## 7. Layout

- Max content width: `1152px` (`max-w-6xl`), centered, `24px` horizontal padding.
- Sticky header, `64px` tall, blurred dark background (`backdrop-filter: blur(10px)`), bottom border in `--line`.
- Generous vertical rhythm: `48px` between major sections, `24px` grid gaps.
- Border radius is small and consistent: `3–4px` on cards/buttons/inputs, `6px` on floating panels (mood prompt), full pill (`99px`) only on badges.

## 8. Voice & Content Pattern

- Numbered progression everywhere something is sequential: "01 — 06", "Fase 2 de 4", "Pergunta 3 de 4" — the product should always tell the user exactly where they are in a sequence.
- Empty/locked states get a specific, warm sentence — never a bare "N/A" or blank space (e.g. "Esta fase ainda não foi liberada pela sua consultora" rather than nothing happening).
- All client-facing copy in Brazilian Portuguese (pt-BR), warm and personal ("você", never formal "o senhor/a senhora").

---

### Quick-start palette for a design tool

```
Background:      #0C0A09
Surface:         #161210
Surface alt:     #141210
Text primary:    #F2ECE0
Text muted:      #A89A8C
Border:          #F2ECE0 @ 12%
Accent (primary):#B8863A
Accent (light):  #DCC7A8
Error:           #A85A52
Font (display):  Playfair Display, italic, 500–700
Font (body):     Poppins, 300–700
Corner radius:   4px (cards/buttons), 6px (floating panels), full (badges)
```
