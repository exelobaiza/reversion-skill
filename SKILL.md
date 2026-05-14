---
name: reversion
description: Add an Agentation-style floating pill toolbar to a React prototype that lets viewers switch between alternative versions of components (reversions) live. Open by default, draggable, only shows reversions whose component is currently in the viewport, highlights the target on hover, and persists choices in localStorage. Use when the user wants stakeholders to compare design alternatives in a deployed prototype without rebuilding, or mentions "reversion", "variant switcher", "version toggle", "compare versions", "A/B preview toolbar", "design switcher".
---

# Reversion Toolbar

Install a floating **pill-shaped toolbar** (Agentation-inspired: dark `#1a1a1a`, 44px tall, rounded 22px, layered shadow) that lets viewers switch between registered **reversions** in a running React app. A "reversion" is a component slot with multiple alternative versions that can be switched at runtime.

Key behaviors:
- **Open by default**, but the user can close to a 44px circle. Open/closed state persists.
- **Viewport-aware**: only reversions whose component is currently visible on screen appear in the toolbar. The label "In this page" makes that contextual.
- **Hover to highlight**: hovering a reversion chip or version button outlines the target component with a cyan overlay so the viewer knows what's about to change.
- **Draggable**: a grip handle on the left lets the user reposition the toolbar; position persists in `localStorage`.
- **Version choice persists** in `localStorage` (key `prototype-reversions`).
- **Download picks**: a download button (⬇️) in the toolbar exports the current selection as a Markdown file (`reversion-picks-<host>-<timestamp>.md`) that stakeholders can share back with the team. The file is self-contained: includes a human-readable table + a JSON block another agent can parse to apply the picks.
- Works in deployed environments (Vercel, etc.) — no `NODE_ENV` gating by default, because stakeholders use it.

## When to use

Trigger when the user wants ANY of:
- A live way to compare alternative versions of a component (hero, footer, card layout) in a prototype.
- Stakeholders/designers reviewing a deployed prototype to flip between explorations without a new build.
- A generic "design toggle" — they have `Foo.tsx` and `Foo_v2.tsx` and want to swap at runtime.
- They mention saving/sharing a specific "reversion".

Do NOT use when:
- Real A/B testing with analytics is needed (use an experimentation platform).
- Variants must be selectable per-URL for sharing (extend the registry to read query params; not built-in).

## Terminology

- **Reversion**: the switchable thing — a component slot with multiple alternative versions. E.g. "the Hero reversion has 2 versions: Cartelera and Slides".
- **Version**: one specific alternative within a reversion. E.g. "v1" or "current".

## How to install

1. **Detect stack** via `package.json`. Note framework:
   - **Vite**: mount toolbar in `src/App.tsx` root.
   - **Next.js App Router**: mount in `app/layout.tsx`, behind a `'use client'` boundary.
   - **Next.js Pages Router**: mount in `pages/_app.tsx`.
   - **CRA / other**: mount at the root component.

2. **Read** `IMPLEMENTATION.md` for the full source of the 3 files (registry, toolbar, reversion wrapper template). The files live under `template/`. Copy them into a `prototype/` folder (or wherever the project keeps internal tooling).

3. **Wrap each component pair in a reversion wrapper**: for every component to be switchable, create a `XxxReversion.tsx` that calls `registerReversion(...)`, uses `useReversionVersion(...)` to pick the active version, and uses `useReversionInstance(...)` to attach a ref so the toolbar can detect viewport visibility and draw the highlight overlay. Replace the original usage at the call site.

4. **Mount the toolbar** once at the root.

5. **Verify**:
   - Build/typecheck passes.
   - Pill toolbar appears **expanded by default** at the bottom-right with "In this page" + visible reversion chips.
   - Scrolling into a reversion component makes its chip appear; scrolling away removes it.
   - Hovering a reversion chip outlines the component with a cyan border + label.
   - Dragging the dotted grip repositions the toolbar; reload preserves position.
   - Picking a version swaps the component immediately and persists across reload.
   - Closing the toolbar with the × collapses it to a circle; reload preserves that.

## How to register more reversions

Walk the user through this pattern for any component they want to swap:

```tsx
// FooterReversion.tsx
import { Footer } from './Footer'
import { FooterV2 } from './Footer_v2'
import {
  registerReversion,
  useReversionInstance,
  useReversionVersion,
} from '../prototype/ReversionRegistry'

const REVERSION_ID = 'footer'

registerReversion({
  id: REVERSION_ID,
  label: 'Footer',
  defaultVersionId: 'current',
  versions: [
    { id: 'current', label: 'Default', component: Footer },
    { id: 'v2', label: 'Compact', component: FooterV2 },
  ],
})

export function FooterReversion(props: React.ComponentProps<typeof Footer>) {
  const [activeId] = useReversionVersion(REVERSION_ID, 'current')
  const ref = useReversionInstance(REVERSION_ID)
  const Component = activeId === 'v2' ? FooterV2 : Footer
  return (
    <div ref={ref} data-reversion={REVERSION_ID}>
      <Component {...props} />
    </div>
  )
}
```

Then replace `<Footer ... />` with `<FooterReversion ... />` at the call site. The toolbar picks up the new reversion automatically when it scrolls into view.

## Notes

- The `<div>` wrapper is necessary so we can `IntersectionObserver` it and compute its `getBoundingClientRect` for the highlight overlay. If a layout needs the original element directly (e.g. inside a CSS grid targeting a specific child), refactor the parent or wrap higher in the tree.
- `registerReversion` runs at import time. A reversion only shows in the toolbar when its wrapper component is mounted AND in the viewport.
- All versions in a reversion must accept the **same props**. If signatures diverge, narrow them in the wrapper or use a discriminated union.
- The toolbar is dark-themed (matches agentation). Highlights use cyan `#42d3fe`. Tweak colors in `ReversionToolbar.tsx` if it clashes.
- No external dependencies are added.

## Resetting state

```js
localStorage.removeItem('prototype-reversions')              // version selections
localStorage.removeItem('prototype-reversions:toolbar-pos')  // toolbar position
localStorage.removeItem('prototype-reversions:toolbar-open') // open/closed state
```

## See also

- `IMPLEMENTATION.md` — full source files (in `template/`) and how to wire them up.
- `README.md` — human-facing install guide users can share.
- `template/` — the actual source files to copy into the target project.
