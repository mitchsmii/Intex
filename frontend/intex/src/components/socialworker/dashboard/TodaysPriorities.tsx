import { useMemo, useState } from 'react'
import type { Alert, AlertSource } from './CriticalAlerts'
import type { ActionItem } from '../../../types/ActionItem'

/**
 * Unified priority shape. Built by merging Alerts (passive observations —
 * incidents, safety flags, MH assessments) with ActionItems (things to do —
 * overdue visits, plan reviews, high-risk cases) into a single ranked stack
 * so a social worker sees "what needs me" in one place, not two.
 */
export interface Priority {
  key: string
  severity: 'high' | 'medium' | 'low'
  source:
    | AlertSource
    | 'overdue-visit'
    | 'plan-review'
    | 'high-risk'
  residentId: number
  residentCode: string
  headline: string
  /** The *why* — e.g. "BDI item-9 = 2", "Risk escalated Low→High", "No visit in 34 days". */
  signal: string
  /** ISO date or null. Used for sort + "N days ago" timestamp. */
  date: string | null
}

const SEVERITY_ORDER: Record<Priority['severity'], number> = {
  high: 0,
  medium: 1,
  low: 2,
}

const ACTION_HEADLINES: Record<ActionItem['reason'], string> = {
  'overdue-visit': 'Overdue home visit',
  'plan-review': 'Intervention plan due for review',
  'high-risk': 'Flagged as high risk',
}

/** Merge Alerts + ActionItems → unified, sorted, deduped priority list. */
export function mergePriorities(alerts: Alert[], actions: ActionItem[]): Priority[] {
  const out: Priority[] = []

  alerts.forEach((a) => {
    out.push({
      key: `alert-${a.key}`,
      severity: a.severity,
      source: a.source,
      residentId: a.residentId,
      residentCode: a.residentCode,
      headline: a.title,
      signal: a.detail,
      date: a.date,
    })
  })

  actions.forEach((it, i) => {
    out.push({
      key: `action-${it.residentId}-${it.reason}-${i}`,
      severity: it.severity,
      source: it.reason,
      residentId: it.residentId,
      residentCode: it.residentCode,
      headline: ACTION_HEADLINES[it.reason],
      signal: it.detail ?? 'Review case',
      date: null,
    })
  })

  // Dedupe per resident: keep the highest-severity row; track how many were
  // folded in so the row can show "+N more".
  const byResident = new Map<number, { row: Priority; extra: number }>()
  out.forEach((p) => {
    const existing = byResident.get(p.residentId)
    if (!existing) {
      byResident.set(p.residentId, { row: p, extra: 0 })
      return
    }
    if (SEVERITY_ORDER[p.severity] < SEVERITY_ORDER[existing.row.severity]) {
      byResident.set(p.residentId, { row: p, extra: existing.extra + 1 })
    } else {
      existing.extra += 1
    }
  })

  const deduped = Array.from(byResident.values()).map(({ row, extra }) =>
    extra > 0 ? { ...row, signal: `${row.signal} · +${extra} more` } : row,
  )

  // Sort: severity asc (high=0 first) → date desc → residentCode asc
  return deduped.sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (s !== 0) return s
    const da = a.date ? new Date(a.date).getTime() : 0
    const db = b.date ? new Date(b.date).getTime() : 0
    if (da !== db) return db - da
    return a.residentCode.localeCompare(b.residentCode)
  })
}

function daysAgo(iso: string | null): string | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

/**
 * Tiny inline SVG icons — keeps bundle small, no dependency, strokes use
 * currentColor so they inherit the source color. Each glyph is 20×20.
 */
function SourceIcon({ source }: { source: Priority['source'] }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (source) {
    case 'incident':
      // flag
      return (
        <svg {...common} aria-hidden>
          <path d="M4 17V3" />
          <path d="M4 4h10l-2 3 2 3H4" />
        </svg>
      )
    case 'safety':
    case 'high-risk':
      // shield
      return (
        <svg {...common} aria-hidden>
          <path d="M10 2l6 2v5c0 4-3 7-6 9-3-2-6-5-6-9V4l6-2z" />
        </svg>
      )
    case 'session':
      // chat bubble
      return (
        <svg {...common} aria-hidden>
          <path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V5z" />
        </svg>
      )
    case 'risk':
      // up-arrow in circle (escalation)
      return (
        <svg {...common} aria-hidden>
          <circle cx="10" cy="10" r="7" />
          <path d="M10 13V7" />
          <path d="M7 10l3-3 3 3" />
        </svg>
      )
    case 'mh-suicide-bdi':
    case 'mh-suicide-screen':
    case 'mh-ptsd':
      // brain / circle with dot
      return (
        <svg {...common} aria-hidden>
          <path d="M6 4a3 3 0 0 0-3 3v4a3 3 0 0 0 3 3" />
          <path d="M14 4a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3" />
          <path d="M6 4c0-1 1-2 2-2M14 4c0-1-1-2-2-2" />
          <path d="M6 14c0 1 1 2 2 2h4c1 0 2-1 2-2" />
          <path d="M10 5v9" />
        </svg>
      )
    case 'overdue-visit':
      // calendar-x
      return (
        <svg {...common} aria-hidden>
          <rect x="3" y="4" width="14" height="13" rx="1" />
          <path d="M3 8h14M7 2v4M13 2v4" />
          <path d="M8 12l4 4M12 12l-4 4" />
        </svg>
      )
    case 'plan-review':
      // clipboard
      return (
        <svg {...common} aria-hidden>
          <rect x="5" y="4" width="10" height="14" rx="1" />
          <path d="M8 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1" />
          <path d="M8 9h4M8 12h4M8 15h2" />
        </svg>
      )
    default:
      return null
  }
}

function Chevron() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 5l5 5-5 5" />
    </svg>
  )
}

interface Props {
  alerts: Alert[]
  actions: ActionItem[]
  onSelect?: (residentId: number) => void
}

function TodaysPriorities({ alerts, actions, onSelect }: Props) {
  const priorities = useMemo(() => mergePriorities(alerts, actions), [alerts, actions])
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? priorities : priorities.slice(0, 6)

  return (
    <section className="tp-card">
      <header className="tp-header">
        <h2 className="tp-title">Today's Priorities</h2>
        <span className="tp-count">
          {priorities.length === 0
            ? '0'
            : showAll || priorities.length <= 6
              ? `${priorities.length} of ${priorities.length}`
              : `6 of ${priorities.length}`}
        </span>
      </header>

      {priorities.length === 0 ? (
        <div className="tp-empty">
          <p className="tp-empty-title">Nothing urgent today.</p>
          <p className="tp-empty-sub">Your residents are safe.</p>
        </div>
      ) : (
        <>
          <ul className="tp-list">
            {visible.map((p) => {
              const ts = daysAgo(p.date)
              return (
                <li key={p.key}>
                  <button
                    type="button"
                    className={`tp-row tp-row--${p.severity}`}
                    onClick={() => onSelect?.(p.residentId)}
                  >
                    <span className="tp-rail" aria-hidden />
                    <span className="tp-icon">
                      <SourceIcon source={p.source} />
                    </span>
                    <span className="tp-resident">{p.residentCode}</span>
                    <span className="tp-headline">{p.headline}</span>
                    <span className="tp-signal">{p.signal}</span>
                    <span className="tp-time">{ts ?? '—'}</span>
                    <span className="tp-chev" aria-hidden>
                      <Chevron />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {priorities.length > 6 && (
            <button
              type="button"
              className="tp-more"
              onClick={() => setShowAll((s) => !s)}
            >
              {showAll ? 'Show fewer' : `Show all priorities (${priorities.length})`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

export default TodaysPriorities
