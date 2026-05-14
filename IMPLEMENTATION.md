# Reversion — Implementation

A floating pill toolbar (Agentation-inspired) that lets viewers switch between **reversions** in a live React prototype. A "reversion" is a component slot with multiple alternative versions. Open by default, draggable, viewport-aware, highlights what will change on hover, persists across reloads.

**Stack**: React 18+ with TypeScript. **Works in**: Vite, Next.js (App or Pages Router), CRA. **No new dependencies.**

The full source for the 3 files lives next to this document under `./template/`. Copy them verbatim, adjust paths to match your project conventions.

---

## Files to copy

| Source (in this skill) | Destination (in target project) | What it is |
|---|---|---|
| `template/ReversionRegistry.tsx` | `src/prototype/ReversionRegistry.tsx` | Hooks + registry. The `useReversionVersion`, `useReversionInstance`, `useVisibleReversions`, `registerReversion` exports. |
| `template/ReversionToolbar.tsx` | `src/prototype/ReversionToolbar.tsx` | The pill toolbar component itself (open by default, draggable, viewport-aware, highlight overlay). |
| `template/ExampleReversion.tsx.example` | (rename per component) e.g. `src/components/HeroReversion.tsx` | Template for wrapping a component pair into a reversion. Duplicate this file once per component you want to switch. |

> Path note: place `ReversionRegistry.tsx` and `ReversionToolbar.tsx` together in a folder that matches the project's conventions (e.g. `src/lib/`, `src/internal/`, `app/_lib/`). Reversion wrappers usually live next to the components they wrap.

---

## Step 1 — Drop in the registry and toolbar

Copy `template/ReversionRegistry.tsx` and `template/ReversionToolbar.tsx` into the target project. Adjust the relative import inside `ReversionToolbar.tsx` (`import { ... } from './ReversionRegistry'`) if you split them across folders.

No edits needed beyond paths.

---

## Step 2 — Create one reversion wrapper per component pair

For each component that will have alternative versions, duplicate `template/ExampleReversion.tsx.example` and adapt. Concrete pattern:

```tsx
// src/components/HeroReversion.tsx
import { Hero } from './Hero'
import { HeroV2 } from './Hero_v2'
import {
  registerReversion,
  useReversionInstance,
  useReversionVersion,
} from '../prototype/ReversionRegistry'

type HeroProps = React.ComponentProps<typeof Hero>

const REVERSION_ID = 'hero'

registerReversion({
  id: REVERSION_ID,
  label: 'Hero',
  defaultVersionId: 'current',
  versions: [
    { id: 'current', label: 'Original', component: Hero },
    { id: 'v2', label: 'Redesign', component: HeroV2 },
  ],
})

export function HeroReversion(props: HeroProps) {
  const [activeId] = useReversionVersion(REVERSION_ID, 'current')
  const ref = useReversionInstance(REVERSION_ID)
  const Component = activeId === 'v2' ? HeroV2 : Hero
  return (
    <div ref={ref} data-reversion={REVERSION_ID}>
      <Component {...props} />
    </div>
  )
}
```

At the call site:

```diff
- <Hero onCtaClick={...} />
+ <HeroReversion onCtaClick={...} />
```

**Requirements**:
- All versions must accept the same prop type. Otherwise narrow the wrapper props or use a discriminated union.
- The `<div ref={ref}>` wrapper is required — `useReversionInstance` uses it for IntersectionObserver (viewport detection) and `getBoundingClientRect` (highlight overlay). If the wrapper breaks layout (rare), wrap the reversion higher up in the tree where a block-level div is safe.

---

## Step 3 — Mount the toolbar at the root

### Vite (`src/App.tsx`)

```tsx
import { ReversionToolbar } from './prototype/ReversionToolbar'

function App() {
  return (
    <>
      <YourAppRoot />
      <ReversionToolbar />
    </>
  )
}
```

### Next.js App Router

The toolbar uses hooks and `localStorage`, so it needs a client boundary:

```tsx
// app/_reversion-toolbar.tsx
'use client'
export { ReversionToolbar } from '@/prototype/ReversionToolbar'
```

```tsx
// app/layout.tsx
import { ReversionToolbar } from './_reversion-toolbar'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <ReversionToolbar />
      </body>
    </html>
  )
}
```

### Next.js Pages Router (`pages/_app.tsx`)

```tsx
import { ReversionToolbar } from '@/prototype/ReversionToolbar'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <ReversionToolbar />
    </>
  )
}
```

---

## Step 4 — Verify

1. Build / typecheck passes (`npm run build` or `tsc --noEmit`).
2. Open the app. The toolbar appears **expanded by default** at the bottom-right with the label **"In this page"** followed by chips for every reversion whose component is currently in view.
3. Hover a chip → a **cyan outline + label** highlights the target component on the page.
4. Click the chip → a popover opens above with the version options. Click a version → the component swaps instantly.
5. Reload → the selection persists.
6. Drag the dotted grip on the left of the pill → the toolbar moves. Reload → position persists.
7. Click the × on the right → the toolbar collapses to a 44px circle. Click the circle to reopen. The open/closed state persists across reloads.
8. Press **Esc** → closes the active popover, then collapses the toolbar.
9. Scroll → reversions whose component leaves the viewport disappear from the toolbar; new ones appear as you scroll into them.
10. Click the ⬇️ button → browser downloads `reversion-picks-<host>-<timestamp>.md` with the current picks (table + JSON block, ready to share or hand to another agent).

---

## Downloading picks

The toolbar exposes a download button (⬇️) that calls `downloadPicksMarkdown()` from the registry. The exported `.md` looks like:

```markdown
# Reversion picks

**Site**: https://example.com/
**Captured at**: 2026-05-14T16:23:00Z
**Generated by**: Reversion toolbar v0.1

## Picks

| Reversion | Selected version | Default |
| --- | --- | --- |
| Hero (`hero`) | Slides (`v1`) | Cartelera (`current`) |

## How to apply
... (instructions for a receiving agent)

## Raw data
\```json
{ "site": "...", "capturedAt": "...", "picks": { "hero": "v1" } }
\```
```

The JSON block lets another agent ingest the picks programmatically without parsing the markdown table.

---

## How it works (quick reference)

- **`registerReversion(reversion)`**: module-level. Adds the reversion to a shared array. Runs at import time, so a reversion only "exists" if its wrapper file is imported in the tree.
- **`useReversionVersion(reversionId, defaultVersionId)`**: returns `[activeVersionId, setActiveVersionId]`. Reads/writes `localStorage["prototype-reversions"]`. Cross-component sync via `CustomEvent('reversion-change')`.
- **`useReversionInstance(reversionId)`**: returns a ref callback. When attached to an element, registers it for viewport tracking (IntersectionObserver, threshold 0.05). The toolbar reads this to filter visible reversions and to compute highlight rects.
- **`useVisibleReversions()`**: hook returning only reversions whose tracked element is currently in viewport.
- **Toolbar state**: position in `localStorage["prototype-reversions:toolbar-pos"]` as `{ left, top }`; open/closed in `localStorage["prototype-reversions:toolbar-open"]` (`"1"` or `"0"`).

## Reset state

```js
localStorage.removeItem('prototype-reversions')              // version selections
localStorage.removeItem('prototype-reversions:toolbar-pos')  // toolbar position
localStorage.removeItem('prototype-reversions:toolbar-open') // open/closed state
```

## Tips

- **Dev-only gating**: this toolbar is intentionally visible in production. To restrict to dev:
  - Vite: `{import.meta.env.DEV && <ReversionToolbar />}`
  - Next.js: `{process.env.NODE_ENV !== 'production' && <ReversionToolbar />}`
- **Multiple versions per reversion**: the `versions` array supports any number, not just two.
- **Theme**: the toolbar is dark (`#1a1a1a`) with cyan accent (`#42d3fe`). Tweak inline styles in `ReversionToolbar.tsx` if you need to rebrand.
