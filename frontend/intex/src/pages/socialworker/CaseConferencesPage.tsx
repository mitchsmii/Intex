import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchResidents,
  fetchInterventionPlans,
} from '../../services/socialWorkerService'
import { api } from '../../services/apiService'
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
  const [modalConference, setModalConference] = useState<Conference | null>(null)

  // ── Schedule request form state ──
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [reqDate, setReqDate] = useState('')
  const [reqTime, setReqTime] = useState('')
  const [reqResidents, setReqResidents] = useState<Set<number>>(new Set())
  const [reqAgenda, setReqAgenda] = useState<Record<number, string>>({})
  const [reqSubmitting, setReqSubmitting] = useState(false)
  const [reqError, setReqError] = useState<string | null>(null)

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
                  onClick={() => {
                    setReqDate('')
                    setReqTime('')
                    setReqResidents(new Set())
                    setReqAgenda({})
                    setReqError(null)
                    setShowRequestForm(true)
                  }}
                >
                  + Request Conference
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
                              onToggle={() => setModalConference(c)}
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
                              onToggle={() => setModalConference(c)}
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

      {modalConference && (() => {
        const c = modalConference
        return (
          <div className="cc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalConference(null) }}>
            <div className="cc-modal">
              <header className="cc-modal-header">
                <div>
                  <h2 className="cc-modal-title">Case Conference</h2>
                  <p className="cc-modal-meta">
                    {formatDate(c.date)} · {c.plans.length} {c.plans.length === 1 ? 'plan' : 'plans'}
                  </p>
                </div>
                <button type="button" className="cc-modal-close" onClick={() => setModalConference(null)} aria-label="Close">×</button>
              </header>
              <div className="cc-modal-body">
                {c.plans.map((p) => (
                  <div key={p.planId} className="cc-modal-plan">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <span className="cc-cat-chip">{p.planCategory ?? 'Plan'}</span>
                      {p.status && <span className="cc-status-pill">{p.status}</span>}
                    </div>
                    {p.planDescription && (
                      <div className="cc-modal-section">
                        <div className="cc-modal-label">Description</div>
                        <p>{p.planDescription}</p>
                      </div>
                    )}
                    {p.servicesProvided && (
                      <div className="cc-modal-section">
                        <div className="cc-modal-label">Services Provided</div>
                        <p>{p.servicesProvided}</p>
                      </div>
                    )}
                    {p.targetDate && (
                      <div className="cc-modal-section">
                        <div className="cc-modal-label">Target Date</div>
                        <p>{formatDate(p.targetDate)}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {showRequestForm && (
        <div className="cc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowRequestForm(false) }}>
          <div className="cc-modal" style={{ maxWidth: 700 }}>
            <header className="cc-modal-header">
              <div>
                <h2 className="cc-modal-title">Request a Case Conference</h2>
                <p className="cc-modal-meta">Select a date, time, residents, and agenda items. Admin will review your request.</p>
              </div>
              <button type="button" className="cc-modal-close" onClick={() => setShowRequestForm(false)}>×</button>
            </header>
            <form
              className="cc-modal-body"
              onSubmit={async (e) => {
                e.preventDefault()
                if (reqResidents.size === 0) { setReqError('Select at least one resident.'); return }
                setReqSubmitting(true)
                setReqError(null)
                try {
                  await api.submitCaseConferenceRequest({
                    residentIds: Array.from(reqResidents),
                    requestedDate: reqDate,
                    requestedTime: reqTime,
                    agenda: Array.from(reqResidents).map((id) => ({
                      residentId: id,
                      notes: reqAgenda[id] ?? '',
                    })),
                  })
                  setShowRequestForm(false)
                } catch (err) {
                  setReqError(err instanceof Error ? err.message : 'Submission failed')
                } finally {
                  setReqSubmitting(false)
                }
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <label className="cc-req-field">
                  <span className="cc-modal-label">Preferred Date</span>
                  <input type="date" value={reqDate} onChange={(e) => setReqDate(e.target.value)} required />
                </label>
                <label className="cc-req-field">
                  <span className="cc-modal-label">Preferred Time</span>
                  <select value={reqTime} onChange={(e) => setReqTime(e.target.value)} required>
                    <option value="">Select…</option>
                    {['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="cc-req-section">
                <div className="cc-modal-label">Select Residents to Discuss</div>
                <div className="cc-req-residents">
                  {residents.map((r) => {
                    const checked = reqResidents.has(r.residentId)
                    return (
                      <label key={r.residentId} className={`cc-req-resident-opt${checked ? ' cc-req-resident-opt--on' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setReqResidents((prev) => {
                              const next = new Set(prev)
                              e.target.checked ? next.add(r.residentId) : next.delete(r.residentId)
                              return next
                            })
                          }}
                        />
                        <span>{r.internalCode ?? `#${r.residentId}`}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {reqResidents.size > 0 && (
                <div className="cc-req-section">
                  <div className="cc-modal-label">Agenda — What to Discuss per Resident</div>
                  {Array.from(reqResidents).map((id) => {
                    const res = residents.find((r) => r.residentId === id)
                    return (
                      <label key={id} className="cc-req-agenda-row">
                        <span className="cc-req-agenda-code">{res?.internalCode ?? `#${id}`}</span>
                        <input
                          type="text"
                          placeholder="e.g. Review risk level, discuss reintegration plan"
                          value={reqAgenda[id] ?? ''}
                          onChange={(e) => setReqAgenda((prev) => ({ ...prev, [id]: e.target.value }))}
                        />
                      </label>
                    )
                  })}
                </div>
              )}

              {reqError && <div style={{ color: 'var(--color-error)', fontSize: '0.85rem' }}>{reqError}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', paddingTop: 'var(--space-sm)' }}>
                <button type="button" className="cc-detail-link" onClick={() => setShowRequestForm(false)} disabled={reqSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="cc-schedule-btn" disabled={reqSubmitting}>
                  {reqSubmitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
