import { useEffect, useMemo, useState } from 'react'
import {
  fetchResidents,
  fetchAssessments,
} from '../../services/socialWorkerService'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import AssessmentForm from '../../components/socialworker/AssessmentForm'
import type { Resident } from '../../types/Resident'
import type { Assessment, Instrument } from '../../types/Assessment'
import { severityBucket } from '../../utils/assessmentScoring'
import AssessmentResultsModal from '../../components/socialworker/AssessmentResultsModal'
import '../../components/socialworker/AssessmentResultsModal.css'
import './AssessmentsPage.css'

const INSTRUMENTS: Array<{ id: Instrument; name: string }> = [
  { id: 'PCL5', name: 'PCL-5' },
  { id: 'SUICIDE_RISK', name: 'Suicide Risk' },
  { id: 'BDI', name: 'BDI' },
  { id: 'BAI', name: 'BAI' },
]

type FilterId = 'All' | Instrument

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const safe = iso.includes('T') ? iso : iso + 'T00:00:00'
  return new Date(safe).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function AssessmentsPage() {
  const [residents, setResidents] = useState<Resident[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFormFor, setShowFormFor] = useState<Instrument | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [filter, setFilter] = useState<FilterId>('All')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [modalAssessment, setModalAssessment] = useState<Assessment | null>(null)

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
      setAssessments([])
      return
    }
    setShowFormFor(null)
    setExpandedId(null)
    setDetailLoading(true)
    fetchAssessments({ residentId: selectedId })
      .then(setAssessments)
      .catch((err) => setError(err.message))
      .finally(() => setDetailLoading(false))
  }, [selectedId])

  const selectedResident = useMemo(
    () => residents.find((r) => r.residentId === selectedId) ?? null,
    [residents, selectedId],
  )

  // Latest per instrument (for the score-card row)
  const latestByInstrument = useMemo(() => {
    const map = new Map<Instrument, Assessment>()
    for (const a of assessments) {
      const existing = map.get(a.instrument)
      if (!existing || new Date(a.administeredDate).getTime() > new Date(existing.administeredDate).getTime()) {
        map.set(a.instrument, a)
      }
    }
    return map
  }, [assessments])

  // Previous per instrument (for trend arrow vs latest)
  const previousByInstrument = useMemo(() => {
    const map = new Map<Instrument, Assessment>()
    INSTRUMENTS.forEach(({ id }) => {
      const sorted = assessments
        .filter((a) => a.instrument === id)
        .sort((a, b) => new Date(b.administeredDate).getTime() - new Date(a.administeredDate).getTime())
      if (sorted.length >= 2) map.set(id, sorted[1])
    })
    return map
  }, [assessments])

  const filteredAssessments = useMemo(() => {
    const list = filter === 'All' ? assessments : assessments.filter((a) => a.instrument === filter)
    return [...list].sort(
      (a, b) => new Date(b.administeredDate).getTime() - new Date(a.administeredDate).getTime(),
    )
  }, [assessments, filter])

  function handleSaved(created: Assessment) {
    setAssessments((prev) => [created, ...prev])
    setShowFormFor(null)
  }

  if (loading) return <LoadingSpinner size="lg" />
  if (error) return <p className="ap-error">Error: {error}</p>

  return (
    <div className="ap-page">
      <header className="ap-header">
        <div>
          <h1>Assessments</h1>
          <p className="ap-sub">
            Standardized clinical instruments tracking mental health recovery — administered
            verbally by the social worker.
          </p>
        </div>
      </header>

      <div className="ap-layout">
        {/* Left rail: residents */}
        <aside className="ap-rail">
          <div className="ap-rail-header">My Residents</div>
          {residents.length === 0 ? (
            <p className="ap-empty">No residents assigned yet.</p>
          ) : (
            <ul className="ap-rail-list">
              {residents.map((r) => {
                const active = r.residentId === selectedId
                return (
                  <li key={r.residentId}>
                    <button
                      type="button"
                      className={`ap-rail-item${active ? ' ap-rail-item--active' : ''}`}
                      onClick={() => setSelectedId(r.residentId)}
                    >
                      <span className="ap-rail-code">{r.internalCode ?? `#${r.residentId}`}</span>
                      <span className="ap-rail-meta">Age {r.presentAge ?? '—'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {/* Right pane */}
        <section className="ap-main">
          {selectedResident ? (
            <>
              <div className="ap-main-header">
                <div>
                  <h2>{selectedResident.internalCode ?? `#${selectedResident.residentId}`}</h2>
                  <div className="ap-main-meta">
                    Age {selectedResident.presentAge ?? '—'} ·{' '}
                    <span className={`ap-risk ap-risk--${(selectedResident.currentRiskLevel ?? 'unknown').toLowerCase()}`}>
                      {selectedResident.currentRiskLevel ?? 'Unknown'} risk
                    </span>{' '}
                    · {assessments.length} {assessments.length === 1 ? 'assessment' : 'assessments'}
                  </div>
                </div>
                {!showFormFor && (
                  <div className="ap-new-wrap">
                    <button
                      type="button"
                      className="ap-new-btn"
                      onClick={() => setPickerOpen((o) => !o)}
                      aria-haspopup="menu"
                      aria-expanded={pickerOpen}
                    >
                      + New Assessment
                    </button>
                    {pickerOpen && (
                      <>
                        <div
                          className="ap-new-backdrop"
                          onClick={() => setPickerOpen(false)}
                        />
                        <div className="ap-new-menu" role="menu">
                          {INSTRUMENTS.map(({ id, name }) => (
                            <button
                              key={id}
                              type="button"
                              role="menuitem"
                              className="ap-new-menu-item"
                              onClick={() => {
                                setShowFormFor(id)
                                setPickerOpen(false)
                              }}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {detailLoading ? (
                <LoadingSpinner size="md" />
              ) : (
                <>
                  {/* Score-card row: latest per instrument */}
                  <div className="ap-scores">
                    {INSTRUMENTS.map(({ id, name }) => {
                      const latest = latestByInstrument.get(id)
                      const prev = previousByInstrument.get(id)
                      const bucket = latest ? severityBucket(latest.severityBand) : 'neutral'
                      let trend: 'up' | 'down' | 'flat' | null = null
                      if (latest && prev) {
                        const a = latest.totalScore ?? latest.tickCount ?? 0
                        const b = prev.totalScore ?? prev.tickCount ?? 0
                        trend = a < b ? 'down' : a > b ? 'up' : 'flat'
                      }
                      return (
                        <div key={id} className={`ap-score-card ap-score-card--${bucket}`}>
                          <div className="ap-score-card-name">{name}</div>
                          {latest ? (
                            <>
                              <div className="ap-score-card-value">
                                {latest.totalScore ?? latest.tickCount ?? '—'}
                                {trend && (
                                  <span className={`ap-trend ap-trend--${trend}`}>
                                    {trend === 'down' ? '↓' : trend === 'up' ? '↑' : '→'}
                                  </span>
                                )}
                              </div>
                              <div className="ap-score-card-band">{latest.severityBand ?? '—'}</div>
                              <div className="ap-score-card-date">
                                {daysSince(latest.administeredDate)}d ago
                              </div>
                            </>
                          ) : (
                            <div className="ap-score-card-empty">No data</div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Form panel */}
                  {showFormFor && (
                    <AssessmentForm
                      residentId={selectedResident.residentId}
                      instrument={showFormFor}
                      onCancel={() => setShowFormFor(null)}
                      onSaved={handleSaved}
                    />
                  )}

                  {/* History */}
                  {assessments.length === 0 ? (
                    <p className="ap-empty">
                      No assessments yet for {selectedResident.internalCode ?? 'this resident'}.
                      Conduct one to start tracking mental health trajectory.
                    </p>
                  ) : (
                    <>
                      <div className="ap-filters">
                        {(['All', ...INSTRUMENTS.map((i) => i.id)] as FilterId[]).map((f) => {
                          const count = f === 'All' ? assessments.length : assessments.filter((a) => a.instrument === f).length
                          const label = f === 'All' ? 'All' : INSTRUMENTS.find((i) => i.id === f)?.name ?? f
                          return (
                            <button
                              key={f}
                              type="button"
                              className={`ap-filter${filter === f ? ' ap-filter--active' : ''}`}
                              onClick={() => setFilter(f)}
                            >
                              {label} ({count})
                            </button>
                          )
                        })}
                      </div>

                      <div className="ap-list">
                        <div className="ap-list-head">
                          <div>Date</div>
                          <div>Instrument</div>
                          <div>Score</div>
                          <div>Severity</div>
                          <div>Administered By</div>
                        </div>
                        <ul className="ap-rows">
                          {filteredAssessments.map((a) => {
                            const isExpanded = expandedId === a.assessmentId
                            const bucket = severityBucket(a.severityBand)
                            return (
                              <li key={a.assessmentId} className={`ap-row-wrap${isExpanded ? ' ap-row-wrap--open' : ''}`}>
                                <button
                                  type="button"
                                  className="ap-row"
                                  onClick={() => setModalAssessment(a)}
                                >
                                  <div className="ap-row-date">{formatDate(a.administeredDate)}</div>
                                  <div className="ap-row-instrument">
                                    {INSTRUMENTS.find((i) => i.id === a.instrument)?.name ?? a.instrument}
                                  </div>
                                  <div className="ap-row-score">
                                    {a.totalScore ?? a.tickCount ?? '—'}
                                  </div>
                                  <div className="ap-row-sev">
                                    <span className={`ap-sev-pill ap-sev-pill--${bucket}`}>
                                      {a.severityBand ?? '—'}
                                    </span>
                                  </div>
                                  <div className="ap-row-by">{a.administeredBy}</div>
                                </button>
                                {isExpanded && (
                                  <div className="ap-row-detail">
                                    {a.worstEvent && (
                                      <div className="ap-detail-line">
                                        <strong>Worst event:</strong> {a.worstEvent}
                                      </div>
                                    )}
                                    {a.observationNotes && (
                                      <div className="ap-detail-section">
                                        <div className="ap-detail-label">Observation Notes</div>
                                        <p>{a.observationNotes}</p>
                                      </div>
                                    )}
                                    {a.immediateAction && (
                                      <div className="ap-detail-section ap-detail-section--alert">
                                        <div className="ap-detail-label">⚠ Immediate Action Taken</div>
                                        <p>{a.immediateAction}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <p className="ap-empty">Select a resident from the left to view their assessments.</p>
          )}
        </section>
      </div>

      {modalAssessment && (
        <AssessmentResultsModal
          assessment={modalAssessment}
          onClose={() => setModalAssessment(null)}
        />
      )}
    </div>
  )
}

export default AssessmentsPage
