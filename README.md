# reversion

A Claude Code skill that adds an **Agentation-style floating pill toolbar** to a React prototype so designers, PMs, and stakeholders can switch between alternate versions of a component live — without rebuilding or redeploying.

Inspired by the floating-toolbar look of [agentation](https://github.com/benjitaylor/agentation), but for **picking design reversions** instead of annotating feedback.

---

## What does "reversion" mean here

- **Reversion** = a switchable component slot. Every reversion has a label (e.g. "Hero") and one or more alternative versions.
- **Version** = one specific alternative within a reversion (e.g. "Original", "Redesign v2").

Saving a *reversion choice* means picking which version of each reversion the prototype should show. The toolbar is the UI for that.

---

## What it does

- Adds a small dark **pill toolbar** at the bottom-right of your app — **expanded by default** so visitors immediately see the available reversions.
- Labels the row **"In this page"** to make the contextual nature clear: only reversions whose component is **currently in the viewport** appear.
- **Hover** a chip → the target component lights up with a cyan outline so you know what's about to change.
- **Click** a chip → a popover above lists the versions. Click a version → the component swaps in place. No reload, no rebuild.
- **Drag** the toolbar by its grip handle to reposition it. Position persists across reloads.
- Closing the toolbar (×) collapses it to a 44px circle. The collapsed/expanded state persists.
- Version selections persist in `localStorage`.
- Works in **deployed** environments (Vercel, Netlify…), not just local dev. That's the point: send the link to stakeholders and let them compare.

## Who it's for

Designers and developers running **prototype apps** as living artifacts (think "Figma in a browser") who want to show stakeholders multiple explorations side-by-side without maintaining branches or separate deploys.

If you only need it locally, you can wrap the toolbar in a `process.env.NODE_ENV !== 'production'` (Next.js) or `import.meta.env.DEV` (Vite) check. The skill explains how.

## Compatible stacks

- React 18+ with TypeScript
- Vite, Next.js (App Router or Pages Router), CRA, or any React setup with a root component
- **No new npm dependencies**

## Install with Claude Code

1. Drop this folder into your Claude Code skills directory:
   - macOS / Linux: `~/.claude/skills/reversion/`
   - Or your project's `.claude/skills/reversion/` for per-repo installation.
2. In Claude Code, ask: **"add a reversion toolbar for the Hero component"** (or any component pair you have like `Foo.tsx` + `Foo_v2.tsx`).
3. Claude detects your framework, copies the files, wires up the first reversion, and verifies the build.

## Install manually (no Claude)

Open `IMPLEMENTATION.md` in this folder. It has step-by-step instructions and points at the ready-to-copy source files under `./template/`:

```
template/
├── ReversionRegistry.tsx              # copy to src/prototype/
├── ReversionToolbar.tsx               # copy to src/prototype/
└── ExampleReversion.tsx.example       # duplicate + rename per component
```

Copy the first two as-is. Duplicate `ExampleReversion.tsx.example` once per component you want to switch (e.g. `HeroReversion.tsx`, `FooterReversion.tsx`) and edit the imports/labels. Then mount `<ReversionToolbar />` once at the root of your app.

Full details (framework-specific mount points, constraints, verify steps) live in `IMPLEMENTATION.md`.

## How to add more reversions

Each "reversion" represents a component slot with switchable versions. After the first install, the pattern repeats:

```tsx
// FooterReversion.tsx
import { Footer } from './Footer'
import { FooterCompact } from './Footer_compact'
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
    { id: 'compact', label: 'Compact', component: FooterCompact },
  ],
})

export function FooterReversion(props: React.ComponentProps<typeof Footer>) {
  const [activeId] = useReversionVersion(REVERSION_ID, 'current')
  const ref = useReversionInstance(REVERSION_ID)
  const Component = activeId === 'compact' ? FooterCompact : Footer
  return (
    <div ref={ref} data-reversion={REVERSION_ID}>
      <Component {...props} />
    </div>
  )
}
```

Then at the call site:

```diff
- <Footer city={city} />
+ <FooterReversion city={city} />
```

The toolbar picks up the new reversion automatically the first time it scrolls into view.

### Constraints

- All versions of a reversion must accept the **same props** (or you narrow them inside the wrapper).
- A reversion only appears in the toolbar when (a) its wrapper file is imported somewhere in the tree, **and** (b) the rendered element is in the viewport. `registerReversion` runs at import time; viewport tracking is per-instance.
- The `<div ref={...}>` wrapper exists so the toolbar can use IntersectionObserver and compute the highlight rectangle. If a CSS grid/flex layout breaks because of the extra wrapper, lift the reversion one level higher.

## Sharing this skill

The skill is just a folder. To share:

```bash
# Copy or zip the folder
cp -r ~/.claude/skills/reversion /path/to/somewhere/shareable

# Or commit it under your project
mkdir -p .claude/skills && cp -r ~/.claude/skills/reversion .claude/skills/
```

Anyone who drops it into their `~/.claude/skills/` (or the repo's `.claude/skills/`) gets the skill in Claude Code.

To publish as a public repo: copy the folder into a new git repo. The 4 files (`SKILL.md`, `IMPLEMENTATION.md`, `README.md`, and the `template/` directory) are self-contained.

## Reverting / cleanup

```js
// In DevTools console
localStorage.removeItem('prototype-reversions')              // clear version selections
localStorage.removeItem('prototype-reversions:toolbar-pos')  // clear toolbar position
localStorage.removeItem('prototype-reversions:toolbar-open') // clear open/closed state
```

To remove the feature entirely: delete `ReversionRegistry.tsx`, `ReversionToolbar.tsx`, and each `XxxReversion.tsx`, then revert call sites to use the original component directly.

## Files in this skill

| File | Audience | Purpose |
|---|---|---|
| `SKILL.md` | Claude Code | Frontmatter + agent instructions. Loaded when the skill triggers. |
| `IMPLEMENTATION.md` | Claude Code + humans | Step-by-step install with file mappings and framework variants. |
| `README.md` | Humans | This file. Overview, install, sharing. |
| `template/*.tsx` | Both | The actual source code to copy into the target project. |
