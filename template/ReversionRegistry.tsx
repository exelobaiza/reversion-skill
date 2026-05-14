import { useCallback, useEffect, useState, type ComponentType } from 'react'

export type Version = {
  id: string
  label: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>
}

export type Reversion = {
  id: string
  label: string
  defaultVersionId: string
  versions: Version[]
}

const STORAGE_KEY = 'prototype-reversions'
const CHANGE_EVENT = 'reversion-change'
const INSTANCE_EVENT = 'reversion-instance-change'
const REGISTRY_EVENT = `${CHANGE_EVENT}:registry`

const reversions: Reversion[] = []
const instances = new Map<string, HTMLElement>()
const inView = new Set<string>()

export function registerReversion(reversion: Reversion) {
  if (reversions.find((r) => r.id === reversion.id)) return
  reversions.push(reversion)
  if (typeof window !== 'undefined') {
    installGlobalApi()
    window.dispatchEvent(new CustomEvent(REGISTRY_EVENT))
    window.dispatchEvent(new CustomEvent('reversion:ready'))
  }
}

export function getReversions(): Reversion[] {
  return reversions
}

export function getReversionElement(reversionId: string): HTMLElement | undefined {
  return instances.get(reversionId)
}

function readStored(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function writeStored(state: Record<string, string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export function getActiveVersionId(reversionId: string, fallback: string): string {
  const stored = readStored()
  return stored[reversionId] ?? fallback
}

export function setActiveVersionId(reversionId: string, versionId: string) {
  const stored = readStored()
  stored[reversionId] = versionId
  writeStored(stored)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CHANGE_EVENT, { detail: { reversionId, versionId } }),
    )
    window.dispatchEvent(
      new CustomEvent('reversion:change', { detail: { reversionId, versionId } }),
    )
  }
}

type ReversionGlobalApi = {
  __version: string
  __extensionPresent: boolean
  register: (reversion: Reversion) => void
  getReversions: () => Array<{ id: string; label: string; defaultVersionId: string; versions: Array<{ id: string; label: string }> }>
  getActiveVersion: (reversionId: string) => string | null
  setActiveVersion: (reversionId: string, versionId: string) => void
  getInstance: (reversionId: string) => HTMLElement | null
  serializePicks: () => PicksSnapshot
}

declare global {
  interface Window {
    reversion?: ReversionGlobalApi
  }
}

let globalApiInstalled = false

function installGlobalApi() {
  if (globalApiInstalled || typeof window === 'undefined') return
  globalApiInstalled = true
  const existing = window.reversion
  const api: ReversionGlobalApi = {
    __version: '0.1.0',
    __extensionPresent: existing?.__extensionPresent ?? false,
    register: (r) => registerReversion(r),
    getReversions: () =>
      getReversions().map((r) => ({
        id: r.id,
        label: r.label,
        defaultVersionId: r.defaultVersionId,
        versions: r.versions.map((v) => ({ id: v.id, label: v.label })),
      })),
    getActiveVersion: (reversionId) => {
      const r = getReversions().find((x) => x.id === reversionId)
      if (!r) return null
      return getActiveVersionId(reversionId, r.defaultVersionId)
    },
    setActiveVersion: (reversionId, versionId) => setActiveVersionId(reversionId, versionId),
    getInstance: (reversionId) => getReversionElement(reversionId) ?? null,
    serializePicks: () => serializePicks(),
  }
  window.reversion = api
}

export function useReversionVersion(
  reversionId: string,
  defaultVersionId: string,
): [string, (versionId: string) => void] {
  const [active, setActive] = useState<string>(() =>
    getActiveVersionId(reversionId, defaultVersionId),
  )

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ reversionId: string; versionId: string }>).detail
      if (detail?.reversionId === reversionId) setActive(detail.versionId)
    }
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CHANGE_EVENT, onChange)
  }, [reversionId])

  return [active, (versionId: string) => setActiveVersionId(reversionId, versionId)]
}

export function useRegisteredReversions(): Reversion[] {
  const [, force] = useState(0)
  useEffect(() => {
    const bump = () => force((n) => n + 1)
    window.addEventListener(REGISTRY_EVENT, bump)
    window.addEventListener(CHANGE_EVENT, bump)
    return () => {
      window.removeEventListener(REGISTRY_EVENT, bump)
      window.removeEventListener(CHANGE_EVENT, bump)
    }
  }, [])
  return getReversions()
}

export function useReversionInstance(reversionId: string) {
  return useCallback(
    (element: HTMLElement | null) => {
      const previous = instances.get(reversionId)
      if (previous && previous !== element) {
        instances.delete(reversionId)
        inView.delete(reversionId)
      }
      if (element) {
        instances.set(reversionId, element)
        const observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) inView.add(reversionId)
              else inView.delete(reversionId)
            }
            window.dispatchEvent(new CustomEvent(INSTANCE_EVENT))
          },
          { threshold: 0.05 },
        )
        observer.observe(element)
        ;(element as unknown as { __reversionObserver?: IntersectionObserver }).__reversionObserver = observer
      }
      window.dispatchEvent(new CustomEvent(INSTANCE_EVENT))
    },
    [reversionId],
  )
}

export type PicksSnapshot = {
  site: string
  capturedAt: string
  generator: string
  reversions: Array<{
    id: string
    label: string
    selectedVersionId: string
    selectedVersionLabel: string
    defaultVersionId: string
    defaultVersionLabel: string
  }>
  picks: Record<string, string>
}

export function serializePicks(): PicksSnapshot {
  const list = getReversions()
  const reversionsData = list.map((r) => {
    const selectedId = getActiveVersionId(r.id, r.defaultVersionId)
    const selected = r.versions.find((v) => v.id === selectedId) ?? r.versions[0]
    const def = r.versions.find((v) => v.id === r.defaultVersionId) ?? r.versions[0]
    return {
      id: r.id,
      label: r.label,
      selectedVersionId: selected?.id ?? r.defaultVersionId,
      selectedVersionLabel: selected?.label ?? r.defaultVersionId,
      defaultVersionId: r.defaultVersionId,
      defaultVersionLabel: def?.label ?? r.defaultVersionId,
    }
  })
  const picks: Record<string, string> = {}
  for (const r of reversionsData) picks[r.id] = r.selectedVersionId
  return {
    site: typeof window !== 'undefined' ? window.location.href : '',
    capturedAt: new Date().toISOString(),
    generator: 'Reversion toolbar v0.1',
    reversions: reversionsData,
    picks,
  }
}

export function picksToMarkdown(snapshot: PicksSnapshot): string {
  const rows = snapshot.reversions
    .map(
      (r) =>
        `| ${r.label} (\`${r.id}\`) | ${r.selectedVersionLabel} (\`${r.selectedVersionId}\`) | ${r.defaultVersionLabel} (\`${r.defaultVersionId}\`) |`,
    )
    .join('\n')
  const jsonBlock = JSON.stringify(
    { site: snapshot.site, capturedAt: snapshot.capturedAt, picks: snapshot.picks },
    null,
    2,
  )
  return `# Reversion picks

**Site**: ${snapshot.site}
**Captured at**: ${snapshot.capturedAt}
**Generated by**: ${snapshot.generator}

## Picks

| Reversion | Selected version | Default |
| --- | --- | --- |
${rows}

## How to apply

Each pick maps to a \`XxxReversion.tsx\` wrapper in the codebase. To make a pick the new default:

1. Open the wrapper file (e.g. \`HeroReversion.tsx\`).
2. In the \`registerReversion({...})\` call, change \`defaultVersionId\` to the pick's id shown above.
3. Optionally: remove the no-longer-needed version + its component file.

If you want to keep the toolbar but pre-seed a specific pick on the deployed site, run in DevTools:

\`\`\`js
localStorage.setItem('prototype-reversions', ${JSON.stringify(JSON.stringify(snapshot.picks))})
\`\`\`

## Raw data

\`\`\`json
${jsonBlock}
\`\`\`
`
}

export function downloadPicksMarkdown(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const snapshot = serializePicks()
  const md = picksToMarkdown(snapshot)
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'decisions.md'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function useVisibleReversions(): Reversion[] {
  const [, force] = useState(0)
  useEffect(() => {
    const bump = () => force((n) => n + 1)
    window.addEventListener(REGISTRY_EVENT, bump)
    window.addEventListener(INSTANCE_EVENT, bump)
    window.addEventListener(CHANGE_EVENT, bump)
    return () => {
      window.removeEventListener(REGISTRY_EVENT, bump)
      window.removeEventListener(INSTANCE_EVENT, bump)
      window.removeEventListener(CHANGE_EVENT, bump)
    }
  }, [])
  return getReversions().filter((r) => inView.has(r.id))
}
