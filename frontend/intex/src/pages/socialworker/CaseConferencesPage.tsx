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

function CaseConferencesPage() {
  const navigate = useNavigate()
  const [residents, setResidents] = useState<Resident[]>([])
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const conferences = useMemo(
    () => plans.filter((p) => p.caseConferenceDate),
    [plans],
  )

  const todayMs = new Date().setHours(0, 0, 0, 0)

  const upcoming = useMemo(
    () =>
      conferences
        .filter((p) => new Date(p.caseConferenceDate!).getTime() >= todayMs)
        .sort((a, b) => new Date(a.caseConferenceDate!).getTime() - new Date(b.caseConferenceDate!).getTime()),
    [conferences, todayMs],
  )

  const past = useMemo(
    () =>
      conferences
        .filter((p) => new Date(p.caseConferenceDate!).getTime() < todayMs)
        .sort((a, b) => new Date(b.caseConferenceDate!).getTime() - new Date(a.caseConferenceDate!).getTime()),
    [conferences, todayMs],
  )

  if (loading) return <LoadingSpinner size="lg" />
  if (error) return <p className="cc-error">Error: {error}</p>

  return (
    <div className="cc-page">
      <header className="cc-header">
        <div>
          <h1>Case Conferences</h1>
          <p className="cc-sub">
            Multidisciplinary reviews that create or revise intervention plans.
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
                          <div>Category</div>
                          <div>Description</div>
                          <div>Status</div>
                        </div>
                        <ul className="cc-rows">
                          {upcoming.map((p) => {
                            const days = daysFromToday(new Date(p.caseConferenceDate!))
                            return (
                              <li key={`up-${p.planId}`} className="cc-row-wrap cc-row-wrap--upcoming">
                                <div className="cc-row">
                                  <div className="cc-row-date">{formatDate(p.caseConferenceDate)}</div>
                                  <div className="cc-row-when">
                                    {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}
                                  </div>
                                  <div className="cc-row-cat">{p.planCategory ?? 'Conference'}</div>
                                  <div className="cc-row-desc">
                                    {p.planDescription ?? <span className="cc-row-muted">No description</span>}
                                  </div>
                                  <div className="cc-row-status">
                                    {p.status && <span className="cc-status-pill">{p.status}</span>}
                                  </div>
                                </div>
                              </li>
                            )
                          })}
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
                          <div>Category</div>
                          <div>Description</div>
                          <div>Status</div>
                        </div>
                        <ul className="cc-rows">
                          {past.map((p) => (
                            <li key={`past-${p.planId}`} className="cc-row-wrap">
                              <div className="cc-row cc-row--past">
                                <div className="cc-row-date">{formatDate(p.caseConferenceDate)}</div>
                                <div className="cc-row-cat">{p.planCategory ?? 'Conference'}</div>
                                <div className="cc-row-desc">
                                  {p.planDescription ?? <span className="cc-row-muted">No description</span>}
                                </div>
                                <div className="cc-row-status">
                                  {p.status && <span className="cc-status-pill">{p.status}</span>}
                                </div>
                              </div>
                            </li>
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

export default CaseConferencesPage
