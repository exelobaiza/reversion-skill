import { useEffect, useRef, useState } from 'react'
import {
  downloadPicksMarkdown,
  getReversionElement,
  useRegisteredReversions,
  useReversionVersion,
  useVisibleReversions,
} from './ReversionRegistry'

type Position = { right: number; bottom: number } | null

const POS_STORAGE_KEY = 'prototype-reversions:toolbar-pos'
const OPEN_STORAGE_KEY = 'prototype-reversions:toolbar-open'

function readStoredPos(): Position {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(POS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.right === 'number' && typeof parsed?.bottom === 'number') {
      return parsed
    }
  } catch {
    // ignore
  }
  return null
}

function writeStoredPos(pos: Position) {
  if (typeof window === 'undefined') return
  try {
    if (pos) window.localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos))
  } catch {
    // ignore
  }
}

function readStoredOpen(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = window.localStorage.getItem(OPEN_STORAGE_KEY)
    if (raw === null) return true
    return raw === '1'
  } catch {
    return true
  }
}

function writeStoredOpen(open: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(OPEN_STORAGE_KEY, open ? '1' : '0')
  } catch {
    // ignore
  }
}

function isLocalHostname(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h.endsWith('.local') ||
    h.endsWith('.localhost')
  )
}

function isForceShowEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('reversion-force-show') === '1'
  } catch {
    return false
  }
}

function useExtensionPresent(): boolean {
  const [present, setPresent] = useState(false)
  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const check = () => {
      if (cancelled) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const flag = (window as any).reversion?.__extensionPresent
      if (flag) {
        setPresent(true)
        return
      }
      attempts += 1
      if (attempts < 30) setTimeout(check, 100)
    }
    check()
    const onChange = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setPresent(!!(window as any).reversion?.__extensionPresent)
    }
    window.addEventListener('reversion:extension-changed', onChange)
    return () => {
      cancelled = true
      window.removeEventListener('reversion:extension-changed', onChange)
    }
  }, [])
  return present
}

export function ReversionToolbar() {
  const allReversions = useRegisteredReversions()
  const visibleReversions = useVisibleReversions()
  const extensionPresent = useExtensionPresent()
  const [expanded, setExpanded] = useState<boolean>(() => readStoredOpen())
  const [openReversionId, setOpenReversionId] = useState<string | null>(null)
  const [hoverTarget, setHoverTarget] = useState<string | null>(null)
  const [pos, setPos] = useState<Position>(() => readStoredPos())
  const dragRef = useRef<{
    active: boolean
    moved: boolean
    startX: number
    startY: number
    originRight: number
    originBottom: number
    onTapStartCollapsed: boolean
  } | null>(null)
  const toolbarRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openReversionId) {
          setOpenReversionId(null)
        } else {
          setOpenReversionId(null)
          setExpanded(false)
          writeStoredOpen(false)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded, openReversionId])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag?.active) return
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) {
        drag.moved = true
      }
      if (!drag.moved) return
      const node = toolbarRef.current
      const w = node?.offsetWidth ?? 320
      const h = node?.offsetHeight ?? 44
      const maxRight = window.innerWidth - w - 8
      const maxBottom = window.innerHeight - h - 8
      const right = Math.min(Math.max(8, drag.originRight - dx), maxRight)
      const bottom = Math.min(Math.max(8, drag.originBottom - dy), maxBottom)
      setPos({ right, bottom })
    }
    const onUp = () => {
      const drag = dragRef.current
      if (!drag?.active) return
      drag.active = false
      if (drag.moved) {
        setPos((current) => {
          writeStoredPos(current)
          return current
        })
      } else if (drag.onTapStartCollapsed) {
        setExpanded(true)
        writeStoredOpen(true)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  if (extensionPresent) return null
  if (!isLocalHostname() && !isForceShowEnabled()) return null

  const collapse = () => {
    setOpenReversionId(null)
    setExpanded(false)
    writeStoredOpen(false)
  }

  const startDrag = (e: React.PointerEvent, fromCollapsed = false) => {
    const node = toolbarRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      originRight: window.innerWidth - rect.right,
      originBottom: window.innerHeight - rect.bottom,
      onTapStartCollapsed: fromCollapsed,
    }
    e.preventDefault()
  }

  const positionStyle: React.CSSProperties = pos
    ? { right: pos.right, bottom: pos.bottom, left: 'auto', top: 'auto' }
    : { right: 20, bottom: 20 }

  const display = visibleReversions
  const hasVisible = display.length > 0

  return (
    <>
      {hoverTarget && <HighlightOverlay reversionId={hoverTarget} />}
      <div
        ref={toolbarRef}
        style={{
          position: 'fixed',
          zIndex: 100000,
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          colorScheme: 'light',
          ...positionStyle,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 44,
            padding: expanded ? '0 4px 0 0' : '0 4px',
            width: expanded ? 'auto' : 80,
            background: '#1a1a1a',
            color: '#fff',
            borderRadius: 22,
            boxShadow:
              '0 2px 8px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.1)',
            transition:
              'width 0.4s cubic-bezier(0.19, 1, 0.22, 1), padding 0.4s cubic-bezier(0.19, 1, 0.22, 1)',
            userSelect: 'none',
          }}
        >
          {expanded ? (
            <>
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.5)',
                  padding: '0 6px 0 10px',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                }}
              >
                In this page
              </span>
              {hasVisible ? (
                display.map((reversion) => (
                  <ReversionPill
                    key={reversion.id}
                    reversionId={reversion.id}
                    isOpen={openReversionId === reversion.id}
                    onToggle={() =>
                      setOpenReversionId((id) => (id === reversion.id ? null : reversion.id))
                    }
                    onHoverTarget={(id) => setHoverTarget(id)}
                  />
                ))
              ) : (
                <span
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.55)',
                    padding: '0 8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {allReversions.length === 0
                    ? 'No reversions registered yet'
                    : 'No reversions in view'}
                </span>
              )}
              <button
                type="button"
                onClick={() => downloadPicksMarkdown()}
                aria-label="Bajar decisions.md"
                title="Bajar decisions.md"
                style={iconButtonStyle()}
              >
                <DownloadIcon />
              </button>
              <DragHandle onPointerDown={startDrag} />
              <button
                type="button"
                onClick={collapse}
                aria-label="Cerrar"
                style={iconButtonStyle()}
              >
                <CloseIcon />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setExpanded(true)
                  writeStoredOpen(true)
                }}
                aria-label="Abrir reversion"
                style={iconButtonStyle()}
              >
                <LayersIcon />
              </button>
              <DragHandle onPointerDown={(e) => startDrag(e, false)} />
            </>
          )}
        </div>
      </div>
    </>
  )
}

function ReversionPill({
  reversionId,
  isOpen,
  onToggle,
  onHoverTarget,
}: {
  reversionId: string
  isOpen: boolean
  onToggle: () => void
  onHoverTarget: (id: string | null) => void
}) {
  const reversions = useRegisteredReversions()
  const reversion = reversions.find((r) => r.id === reversionId)
  const [active, setActive] = useReversionVersion(
    reversionId,
    reversion?.defaultVersionId ?? '',
  )

  if (!reversion) return null
  const activeVersion = reversion.versions.find((v) => v.id === active)

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={() => onHoverTarget(reversionId)}
        onMouseLeave={() => onHoverTarget(null)}
        data-active={isOpen ? 'true' : undefined}
        style={{
          ...chipStyle(isOpen),
          height: 32,
          padding: '0 12px',
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600 }}>{reversion.label}</span>
        <span
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.6)',
            fontWeight: 500,
          }}
        >
          {activeVersion?.label ?? '—'}
        </span>
        <ChevronIcon open={isOpen} />
      </button>
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 10px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: 8,
            boxShadow:
              '0 8px 24px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            minWidth: 160,
            animation: 'reversionPopIn 180ms cubic-bezier(0.19, 1, 0.22, 1)',
          }}
        >
          <style>{`@keyframes reversionPopIn { from { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.96); } to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } }`}</style>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.45)',
              padding: '4px 8px 6px',
            }}
          >
            {reversion.label}
          </div>
          {reversion.versions.map((version) => {
            const isActive = version.id === active
            return (
              <button
                key={version.id}
                type="button"
                onClick={() => {
                  setActive(version.id)
                  onToggle()
                  onHoverTarget(null)
                }}
                onMouseEnter={() => onHoverTarget(reversionId)}
                onMouseLeave={() => onHoverTarget(null)}
                style={{
                  appearance: 'none',
                  border: 'none',
                  background: isActive
                    ? 'rgba(66, 211, 254, 0.18)'
                    : 'transparent',
                  color: isActive ? '#42d3fe' : 'rgba(255,255,255,0.88)',
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'background 120ms ease, color 120ms ease',
                }}
                onFocus={(e) => {
                  if (!isActive)
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                }}
                onBlur={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: isActive ? '#42d3fe' : 'rgba(255,255,255,0.25)',
                  }}
                />
                {version.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function HighlightOverlay({ reversionId }: { reversionId: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const el = getReversionElement(reversionId)
    if (!el) return
    const update = () => setRect(el.getBoundingClientRect())
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [reversionId])

  if (!rect) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        pointerEvents: 'none',
        border: '2px solid #42d3fe',
        borderRadius: 6,
        boxShadow: '0 0 0 9999px rgba(10, 28, 58, 0.18)',
        zIndex: 99999,
        transition: 'left 80ms ease, top 80ms ease, width 80ms ease, height 80ms ease',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -28,
          left: 0,
          background: '#42d3fe',
          color: '#0a1c3a',
          fontSize: 11,
          fontWeight: 700,
          padding: '4px 8px',
          borderRadius: 4,
          letterSpacing: '0.04em',
        }}
      >
        {reversionId}
      </div>
    </div>
  )
}

function DragHandle({ onPointerDown }: { onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      aria-label="Mover toolbar"
      title="Arrastrar para mover"
      style={{
        ...iconButtonStyle(),
        cursor: 'grab',
      }}
    >
      <DotsIcon />
    </button>
  )
}

function iconButtonStyle(): React.CSSProperties {
  return {
    appearance: 'none',
    width: 34,
    height: 34,
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.85)',
    borderRadius: 999,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 120ms ease, color 120ms ease, transform 100ms ease',
  }
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    appearance: 'none',
    border: 'none',
    background: active ? 'rgba(66, 211, 254, 0.18)' : 'rgba(255,255,255,0.06)',
    color: active ? '#42d3fe' : 'rgba(255,255,255,0.92)',
    cursor: 'pointer',
    transition: 'background 120ms ease, color 120ms ease',
  }
}

function LayersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="8" cy="6" r="1.6" />
      <circle cx="16" cy="6" r="1.6" />
      <circle cx="8" cy="12" r="1.6" />
      <circle cx="16" cy="12" r="1.6" />
      <circle cx="8" cy="18" r="1.6" />
      <circle cx="16" cy="18" r="1.6" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: 'transform 180ms ease',
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
