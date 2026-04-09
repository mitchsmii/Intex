import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchResidents,
  fetchInterventionPlans,
} from '../../services/socialWorkerService'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import type { Resident } from '../../types/Resident'
import type { InterventionPlan } from '../../types/InterventionPlan'
import './CaseConferencesPage.css'

type Conference = {
  date: string // ISO
  plans: InterventionPlan[]
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysFromToday(d: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

const DAY_MS = 24 * 60 * 60 * 1000

function CaseConferencesPage() {
  const navigate = useNavigate()
  const [residents, setResidents] = useState<Resident[]>([])
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)

  useEffect(() => {
    fetchResidents()
      .then((rs) => {
        setResidents(rs)
        if (rs.length > 0) setSelectedId(rs[0].residentId)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selectedId == null) {
      setPlans([])
      return
    }
    setExpandedDate(null)
    setDetailLoading(true)
    fetchInterventionPlans({ residentId: selectedId })
      .then(setPlans)
      .catch((err) => setError(err.message))
      .finally(() => setDetailLoading(false))
  }, [selectedId])

  const selectedResident = useMemo(
    () => residents.find((r) => r.residentId === selectedId) ?? null,
    [residents, selectedId],
  )

  // Group plans by case_conference_date → a Conference is one meeting that
  // may have produced multiple intervention plans.
  const conferences: Conference[] = useMemo(() => {
    const byDate = new Map<string, InterventionPlan[]>()
    for (const p of plans) {
      if (!p.caseConferenceDate) continue
      const key = p.caseConferenceDate
      const bucket = byDate.get(key) ?? []
      bucket.push(p)
      byDate.set(key, bucket)
    }
    return Array.from(byDate.entries()).map(([date, plans]) => ({ date, plans }))
  }, [plans])

  const todayMs = new Date().setHours(0, 0, 0, 0)

  const upcoming = useMemo(
    () =>
      conferences
        .filter((c) => new Date(c.date).getTime() >= todayMs)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [conferences, todayMs],
  )

  const past = useMemo(
    () =>
      conferences
        .filter((c) => new Date(c.date).getTime() < todayMs)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [conferences, todayMs],
  )

  // Proactive gap alert: if this resident has no upcoming conference and the
  // most recent past conference was more than 12 months ago (or there is none
  // at all), surface a warning so nothing falls through the cracks.
  const gapAlert = useMemo(() => {
    if (!selectedResident) return null
    if (upcoming.length > 0) return null
    if (past.length === 0) {
      return { level: 'bad' as const, message: 'No case conference on record for this resident.' }
    }
    const latest = past[0].date
    const daysAgo = Math.floor((Date.now() - new Date(latest).getTime()) / DAY_MS)
    if (daysAgo >= 365) {
      const years = Math.floor(daysAgo / 365)
      const label = years >= 2 ? `${years}+ years` : '12+ months'
      return {
        level: 'bad' as const,
        message: `No case conference in ${label}. Last conference was ${formatDate(latest)}.`,
      }
    }
    if (daysAgo >= 180) {
      return {
        level: 'warn' as const,
        message: `No case conference in 6+ months. Last conference was ${formatDate(latest)}.`,
      }
    }
    return null
  }, [selectedResident, upcoming, past])

  if (loading) return <LoadingSpinner size="lg" />
  if (error) return <p className="cc-error">Error: {error}</p>

  return (
    <div className="cc-page">
      <header className="cc-header">
        <div>
          <h1>Case Conferences</h1>
          <p className="cc-sub">
            Multidisciplinary meetings that review a resident's situation and produce intervention plans.
          </p>
        </div>
      </header>

      <div className="cc-layout">
        {/* Left rail: residents */}
        <aside className="cc-rail">
          <div className="cc-rail-header">My Residents</div>
          {residents.length === 0 ? (
            <p className="cc-empty">No residents assigned yet.</p>
          ) : (
            <ul className="cc-rail-list">
              {residents.map((r) => {
                const active = r.residentId === selectedId
                return (
                  <li key={r.residentId}>
                    <button
                      type="button"
                      className={`cc-rail-item${active ? ' cc-rail-item--active' : ''}`}
                      onClick={() => setSelectedId(r.residentId)}
                    >
                      <span className="cc-rail-code">{r.internalCode ?? `#${r.residentId}`}</span>
                      <span className="cc-rail-meta">Age {r.presentAge ?? '—'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {/* Right pane */}
        <section className="cc-main">
          {selectedResident ? (
            <>
              <div className="cc-main-header">
                <div>
                  <h2>{selectedResident.internalCode ?? `#${selectedResident.residentId}`}</h2>
                  <div className="cc-main-meta">
                    Age {selectedResident.presentAge ?? '—'} ·{' '}
                    <span className={`cc-risk cc-risk--${(selectedResident.currentRiskLevel ?? 'unknown').toLowerCase()}`}>
                      {selectedResident.currentRiskLevel ?? 'Unknown'} risk
                    </span>{' '}
                    · {conferences.length} {conferences.length === 1 ? 'conference' : 'conferences'}
                  </div>
                </div>
                <button
                  type="button"
                  className="cc-schedule-btn"
                  onClick={() => navigate('/socialworker/dashboard/intervention-plans')}
                >
                  + Schedule Conference
                </button>
              </div>

              {gapAlert && (
                <div className={`cc-gap-alert cc-gap-alert--${gapAlert.level}`}>
                  <strong>⚠ Attention:</strong> {gapAlert.message}
                </div>
              )}

              {detailLoading ? (
                <LoadingSpinner size="md" />
              ) : conferences.length === 0 ? (
                <p className="cc-empty">
                  No case conferences yet for {selectedResident.internalCode ?? 'this resident'}. Schedule one from the Intervention Plans page.
                </p>
              ) : (
                <>
                  {/* Upcoming */}
                  <section className="cc-section">
                    <div className="cc-section-header">
                      <h3>Upcoming</h3>
                      <span className="cc-count">{upcoming.length}</span>
                    </div>
                    {upcoming.length === 0 ? (
                      <p className="cc-empty-sm">None scheduled.</p>
                    ) : (
                      <div className="cc-list">
                        <div className="cc-list-head">
                          <div>Date</div>
                          <div>When</div>
                          <div>Plans</div>
                          <div>Categories</div>
                        </div>
                        <ul className="cc-rows">
                          {upcoming.map((c) => (
                            <ConferenceRow
                              key={`up-${c.date}`}
                              conference={c}
                              upcoming
                              expanded={expandedDate === `up-${c.date}`}
                              onToggle={() =>
                                setExpandedDate((cur) =>
                                  cur === `up-${c.date}` ? null : `up-${c.date}`,
                                )
                              }
                              onOpenPlans={() =>
                                navigate('/socialworker/dashboard/intervention-plans')
                              }
                            />
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>

                  {/* Past */}
                  <section className="cc-section">
                    <div className="cc-section-header">
                      <h3>Past</h3>
                      <span className="cc-count">{past.length}</span>
                    </div>
                    {past.length === 0 ? (
                      <p className="cc-empty-sm">No past conferences on record.</p>
                    ) : (
                      <div className="cc-list">
                        <div className="cc-list-head cc-list-head--past">
                          <div>Date</div>
                          <div>Plans</div>
                          <div>Categories</div>
                        </div>
                        <ul className="cc-rows">
                          {past.map((c) => (
                            <ConferenceRow
                              key={`past-${c.date}`}
                              conference={c}
                              upcoming={false}
                              expanded={expandedDate === `past-${c.date}`}
                              onToggle={() =>
                                setExpandedDate((cur) =>
                                  cur === `past-${c.date}` ? null : `past-${c.date}`,
                                )
                              }
                              onOpenPlans={() =>
                                navigate('/socialworker/dashboard/intervention-plans')
                              }
                            />
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                </>
              )}
            </>
          ) : (
            <p className="cc-empty">Select a resident from the left to view their case conferences.</p>
          )}
        </section>
      </div>
    </div>
  )
}

interface RowProps {
  conference: Conference
  upcoming: boolean
  expanded: boolean
  onToggle: () => void
  onOpenPlans: () => void
}

function ConferenceRow({ conference, upcoming, expanded, onToggle, onOpenPlans }: RowProps) {
  const categories = Array.from(
    new Set(conference.plans.map((p) => p.planCategory).filter(Boolean) as string[]),
  )
  const days = upcoming ? daysFromToday(new Date(conference.date)) : null

  return (
    <li className={`cc-row-wrap${upcoming ? ' cc-row-wrap--upcoming' : ''}${expanded ? ' cc-row-wrap--open' : ''}`}>
      <button
        type="button"
        className={`cc-row${upcoming ? '' : ' cc-row--past'}`}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="cc-row-date">{formatDate(conference.date)}</div>
        {upcoming && (
          <div className="cc-row-when">
            {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}
          </div>
        )}
        <div className="cc-row-plans-count">
          {conference.plans.length} {conference.plans.length === 1 ? 'plan' : 'plans'}
        </div>
        <div className="cc-row-cats">
          {categories.length === 0 ? (
            <span className="cc-row-muted">—</span>
          ) : (
            categories.map((c) => (
              <span key={c} className="cc-cat-chip">{c}</span>
            ))
          )}
        </div>
      </button>

      {expanded && (
        <div className="cc-row-detail">
          <div className="cc-detail-summary">
            <strong>Conference on {formatDate(conference.date)}</strong> produced {conference.plans.length}{' '}
            {conference.plans.length === 1 ? 'intervention plan' : 'intervention plans'}:
          </div>
          <ul className="cc-detail-plans">
            {conference.plans.map((p) => (
              <li key={p.planId} className="cc-detail-plan">
                <div className="cc-detail-plan-head">
                  <span className="cc-cat-chip">{p.planCategory ?? 'Plan'}</span>
                  {p.status && <span className="cc-status-pill">{p.status}</span>}
                </div>
                {p.planDescription && <p className="cc-detail-plan-desc">{p.planDescription}</p>}
                {p.servicesProvided && (
                  <div className="cc-detail-plan-services">
                    <strong>Services:</strong> {p.servicesProvided}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="cc-detail-actions">
            <button type="button" className="cc-detail-link" onClick={onOpenPlans}>
              Open in Intervention Plans →
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

export default CaseConferencesPage
