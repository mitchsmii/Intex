import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  fetchResidents,
  fetchProcessRecordings,
  createProcessRecording,
} from '../../services/socialWorkerService'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import type { Resident } from '../../types/Resident'
import type { ProcessRecording } from '../../types/ProcessRecording'
import './ProcessRecordingsPage.css'

type FormState = {
  sessionDate: string
  sessionType: string
  sessionDurationMinutes: string
  emotionalStateObserved: string
  emotionalStateEnd: string
  sessionNarrative: string
  interventionsApplied: string
  followUpActions: string
  progressNoted: boolean
  concernsFlagged: boolean
  referralMade: boolean
}

const emptyForm = (): FormState => ({
  sessionDate: new Date().toISOString().slice(0, 10),
  sessionType: 'Individual',
  sessionDurationMinutes: '',
  emotionalStateObserved: '',
  emotionalStateEnd: '',
  sessionNarrative: '',
  interventionsApplied: '',
  followUpActions: '',
  progressNoted: false,
  concernsFlagged: false,
  referralMade: false,
})

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

type TrendBucket = 'good' | 'warn' | 'bad' | 'unknown'

function emotionalStateColor(state: string | null): TrendBucket {
  if (!state) return 'unknown'
  const s = state.toLowerCase()
  if (['happy', 'hopeful', 'calm'].includes(s)) return 'good'
  if (['anxious', 'sad', 'withdrawn'].includes(s)) return 'warn'
  if (['angry', 'distressed'].includes(s)) return 'bad'
  return 'unknown'
}

const DRAFT_PREFIX = 'pr-draft-'

function draftKey(residentId: number): string {
  return `${DRAFT_PREFIX}${residentId}`
}

function loadDraft(residentId: number): FormState | null {
  try {
    const raw = localStorage.getItem(draftKey(residentId))
    if (!raw) return null
    return JSON.parse(raw) as FormState
  } catch {
    return null
  }
}

type RecordingFilter = 'all' | 'concerns'

function ProcessRecordingsPage() {
  const { user } = useAuth()
  const location = useLocation()
  const preSelectedResidentId = (location.state as { preSelectedResidentId?: number } | null)?.preSelectedResidentId
  const [residents, setResidents] = useState<Resident[]>([])
  const [recordings, setRecordings] = useState<ProcessRecording[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [recordingsLoading, setRecordingsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [draftRestored, setDraftRestored] = useState(false)

  const [filter, setFilter] = useState<RecordingFilter>('all')
  const [expandedRowId] = useState<number | null>(null)
  const [modalRecording, setModalRecording] = useState<ProcessRecording | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Initial load: residents only
  useEffect(() => {
    fetchResidents()
      .then((rs) => {
        setResidents(rs)
        if (rs.length === 0) return
        const preselect = preSelectedResidentId && rs.some((r) => r.residentId === preSelectedResidentId)
          ? preSelectedResidentId
          : rs[0].residentId
        setSelectedId(preselect)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [preSelectedResidentId])

  // Load recordings whenever the selected resident changes
  useEffect(() => {
    if (selectedId == null) {
      setRecordings([])
      return
    }
    setRecordingsLoading(true)
    fetchProcessRecordings({ residentId: selectedId })
      .then(setRecordings)
      .catch((err) => setError(err.message))
      .finally(() => setRecordingsLoading(false))
  }, [selectedId])

  const selectedResident = useMemo(
    () => residents.find((r) => r.residentId === selectedId) ?? null,
    [residents, selectedId],
  )

  const sortedRecordings = useMemo(() => {
    return [...recordings].sort((a, b) => {
      const ad = a.sessionDate ? new Date(a.sessionDate).getTime() : 0
      const bd = b.sessionDate ? new Date(b.sessionDate).getTime() : 0
      return bd - ad
    })
  }, [recordings])

  const concernsCount = useMemo(
    () => sortedRecordings.filter((r) => r.concernsFlagged === true).length,
    [sortedRecordings],
  )

  const filteredRecordings = useMemo(() => {
    if (filter === 'concerns') {
      return sortedRecordings.filter((r) => r.concernsFlagged === true)
    }
    return sortedRecordings
  }, [sortedRecordings, filter])

  // Trend dots — 5 most recent, oldest on the left for a temporal read
  const trendSessions = useMemo(
    () => sortedRecordings.slice(0, 5).reverse(),
    [sortedRecordings],
  )

  // Reset to first page whenever the resident, filter, or page size changes
  useEffect(() => {
    setPage(1)
  }, [selectedId, pageSize, filter])

  const totalPages = Math.max(1, Math.ceil(filteredRecordings.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedRecordings = filteredRecordings.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  )

  function openForm() {
    if (selectedId != null) {
      const draft = loadDraft(selectedId)
      if (draft) {
        setForm(draft)
        setDraftRestored(true)
      } else {
        setForm(emptyForm())
        setDraftRestored(false)
      }
    } else {
      setForm(emptyForm())
      setDraftRestored(false)
    }
    setSubmitError(null)
    setShowForm(true)
  }

  function closeFormDiscardDraft() {
    if (selectedId != null) {
      localStorage.removeItem(draftKey(selectedId))
    }
    setDraftRestored(false)
    setShowForm(false)
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // Autosave the form to localStorage on every change, scoped per resident
  useEffect(() => {
    if (!showForm || selectedId == null) return
    try {
      localStorage.setItem(draftKey(selectedId), JSON.stringify(form))
    } catch {
      // ignore quota errors
    }
  }, [form, showForm, selectedId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedId == null) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const payload: Omit<ProcessRecording, 'recordingId'> = {
        residentId: selectedId,
        sessionDate: form.sessionDate || null,
        socialWorker: user?.username ?? null,
        sessionType: form.sessionType || null,
        sessionDurationMinutes: form.sessionDurationMinutes
          ? Number(form.sessionDurationMinutes)
          : null,
        emotionalStateObserved: form.emotionalStateObserved || null,
        emotionalStateEnd: form.emotionalStateEnd || null,
        sessionNarrative: form.sessionNarrative || null,
        interventionsApplied: form.interventionsApplied || null,
        followUpActions: form.followUpActions || null,
        progressNoted: form.progressNoted,
        concernsFlagged: form.concernsFlagged,
        referralMade: form.referralMade,
      }
      const created = await createProcessRecording(payload)
      setRecordings((prev) => [created, ...prev])
      if (selectedId != null) {
        localStorage.removeItem(draftKey(selectedId))
      }
      setDraftRestored(false)
      setShowForm(false)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save recording')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingSpinner size="lg" />
  if (error) return <p className="pr-error">Error: {error}</p>

  return (
    <div className="pr-page">
      <header className="pr-header">
        <div>
          <h1>Process Recordings</h1>
          <p className="pr-sub">
            Document each counseling session — the healing journey of every resident.
          </p>
        </div>
      </header>

      <div className="pr-layout">
        {/* Left rail: residents */}
        <aside className="pr-rail">
          <div className="pr-rail-header">My Residents</div>
          {residents.length === 0 ? (
            <p className="pr-empty">No residents assigned yet.</p>
          ) : (
            <ul className="pr-rail-list">
              {residents.map((r) => {
                const active = r.residentId === selectedId
                return (
                  <li key={r.residentId}>
                    <button
                      type="button"
                      className={`pr-rail-item${active ? ' pr-rail-item--active' : ''}`}
                      onClick={() => setSelectedId(r.residentId)}
                    >
                      <span className="pr-rail-code">{r.internalCode ?? `#${r.residentId}`}</span>
                      <span className="pr-rail-meta">
                        Age {r.presentAge ?? '—'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {/* Right pane: timeline */}
        <section className="pr-main">
          {selectedResident ? (
            <>
              <div className="pr-main-header">
                <div>
                  <h2>{selectedResident.internalCode ?? `#${selectedResident.residentId}`}</h2>
                  <div className="pr-main-meta">
                    Age {selectedResident.presentAge ?? '—'} ·{' '}
                    <span className={`pr-risk pr-risk--${(selectedResident.currentRiskLevel ?? 'unknown').toLowerCase()}`}>
                      {selectedResident.currentRiskLevel ?? 'Unknown'} risk
                    </span>{' '}
                    · {recordings.length} {recordings.length === 1 ? 'recording' : 'recordings'}
                  </div>
                  {trendSessions.length > 0 && (
                    <div className="pr-trend">
                      <span className="pr-trend-label">Emotional trend</span>
                      <span className="pr-trend-sub">— last {trendSessions.length} {trendSessions.length === 1 ? 'session' : 'sessions'}</span>
                      <div className="pr-trend-row">
                        {trendSessions.map((r, i) => (
                          <span
                            key={r.recordingId}
                            className="pr-trend-item"
                          >
                            {i > 0 && <span className="pr-trend-caret">›</span>}
                            <span
                              className={`pr-trend-dot pr-trend-dot--${emotionalStateColor(r.emotionalStateEnd)}`}
                              title={`${formatDate(r.sessionDate)}: ${r.emotionalStateObserved ?? '—'} → ${r.emotionalStateEnd ?? '—'}`}
                            />
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="pr-header-actions">
                  {!showForm && (
                    <button type="button" className="pr-add-btn" onClick={openForm}>
                      + New Recording
                    </button>
                  )}
                  <div className="pr-legend">
                    <span className="pr-legend-item">
                      <span className="pr-flag pr-flag--progress">P</span> Progress
                    </span>
                    <span className="pr-legend-item">
                      <span className="pr-flag pr-flag--concern">C</span> Concerns
                    </span>
                    <span className="pr-legend-item">
                      <span className="pr-flag pr-flag--referral">R</span> Referral
                    </span>
                  </div>
                </div>
              </div>

              {showForm && (
                <form className="pr-form" onSubmit={handleSubmit}>
                  {draftRestored && (
                    <div className="pr-draft-banner">
                      <span>Restored a draft you started earlier.</span>
                      <button
                        type="button"
                        className="pr-draft-dismiss"
                        onClick={() => setDraftRestored(false)}
                        aria-label="Dismiss"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <div className="pr-form-row">
                    <label className="pr-field">
                      <span>Session Date</span>
                      <input
                        type="date"
                        value={form.sessionDate}
                        onChange={(e) => updateField('sessionDate', e.target.value)}
                        required
                      />
                    </label>
                    <label className="pr-field">
                      <span>Social Worker</span>
                      <input type="text" value={user?.username ?? ''} readOnly />
                    </label>
                    <label className="pr-field">
                      <span>Duration (min)</span>
                      <input
                        type="number"
                        min="0"
                        value={form.sessionDurationMinutes}
                        onChange={(e) => updateField('sessionDurationMinutes', e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="pr-field">
                    <span>Session Type</span>
                    <div className="pr-radio-row">
                      {['Individual', 'Group'].map((t) => (
                        <label key={t} className="pr-radio">
                          <input
                            type="radio"
                            name="sessionType"
                            value={t}
                            checked={form.sessionType === t}
                            onChange={() => updateField('sessionType', t)}
                          />
                          {t}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="pr-form-row">
                    <label className="pr-field">
                      <span>Emotional State Observed</span>
                      <select
                        value={form.emotionalStateObserved}
                        onChange={(e) => updateField('emotionalStateObserved', e.target.value)}
                      >
                        <option value="">Select…</option>
                        {['Distressed', 'Crying', 'Aggressive', 'Sad', 'Withdrawn', 'Anxious', 'Fearful', 'Neutral', 'Flat', 'Calm', 'Stable', 'Content', 'Positive', 'Happy', 'Joyful'].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label className="pr-field">
                      <span>Emotional State at End</span>
                      <select
                        value={form.emotionalStateEnd}
                        onChange={(e) => updateField('emotionalStateEnd', e.target.value)}
                      >
                        <option value="">Select…</option>
                        {['Distressed', 'Crying', 'Aggressive', 'Sad', 'Withdrawn', 'Anxious', 'Fearful', 'Neutral', 'Flat', 'Calm', 'Stable', 'Content', 'Positive', 'Happy', 'Joyful'].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="pr-field">
                    <span>Session Narrative</span>
                    <textarea
                      rows={5}
                      placeholder="Summary of what happened in the session..."
                      value={form.sessionNarrative}
                      onChange={(e) => updateField('sessionNarrative', e.target.value)}
                    />
                  </label>

                  <div className="pr-field">
                    <span>Interventions Applied</span>
                    <div className="pr-interventions-grid">
                      {['Counseling', 'Teaching', 'Caring', 'Healing', 'Legal Services', 'Medical referral', 'School enrollment', 'Family mediation', 'Crisis intervention', 'Spiritual support'].map((svc) => {
                        const selected = form.interventionsApplied
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                        const isChecked = selected.includes(svc)
                        return (
                          <label key={svc} className="pr-intervention-opt">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...selected, svc]
                                  : selected.filter((s) => s !== svc)
                                updateField('interventionsApplied', next.join(', '))
                              }}
                            />
                            <span>{svc}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <label className="pr-field">
                    <span>Follow-Up Actions</span>
                    <textarea
                      rows={3}
                      placeholder="What needs to happen before next session..."
                      value={form.followUpActions}
                      onChange={(e) => updateField('followUpActions', e.target.value)}
                    />
                  </label>

                  <div className="pr-checkbox-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={form.progressNoted}
                        onChange={(e) => updateField('progressNoted', e.target.checked)}
                      />
                      Progress noted
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={form.concernsFlagged}
                        onChange={(e) => updateField('concernsFlagged', e.target.checked)}
                      />
                      Concerns flagged
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={form.referralMade}
                        onChange={(e) => updateField('referralMade', e.target.checked)}
                      />
                      Referral made
                    </label>
                  </div>

                  {submitError && <div className="pr-form-error">{submitError}</div>}

                  <div className="pr-form-actions">
                    <button
                      type="button"
                      className="pr-btn pr-btn--secondary"
                      onClick={closeFormDiscardDraft}
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="pr-btn pr-btn--primary" disabled={submitting}>
                      {submitting ? 'Saving…' : 'Save Recording'}
                    </button>
                  </div>
                </form>
              )}

              {recordingsLoading ? (
                <LoadingSpinner size="md" />
              ) : sortedRecordings.length === 0 ? (
                <p className="pr-empty">
                  No recordings yet for {selectedResident.internalCode ?? 'this resident'} — add the first one above.
                </p>
              ) : (
                <>
                <div className="pr-filters">
                  <button
                    type="button"
                    className={`pr-filter${filter === 'all' ? ' pr-filter--active' : ''}`}
                    onClick={() => setFilter('all')}
                  >
                    All ({sortedRecordings.length})
                  </button>
                  <button
                    type="button"
                    className={`pr-filter${filter === 'concerns' ? ' pr-filter--active' : ''}`}
                    onClick={() => setFilter('concerns')}
                  >
                    Concerns Only ({concernsCount})
                  </button>
                </div>

                {filteredRecordings.length === 0 ? (
                  <p className="pr-empty">No sessions flagged with concerns for this resident.</p>
                ) : (
                <>
                <div className="pr-list">
                  <div className="pr-list-head">
                    <div>Date</div>
                    <div>Type</div>
                    <div>Duration</div>
                    <div>Social Worker</div>
                    <div>Interventions · Follow-up</div>
                    <div className="pr-list-head-flags">Flags</div>
                    <div className="pr-list-head-mood" title="Emotional state at end of session">Mood</div>
                  </div>
                  <ul className="pr-rows">
                    {pagedRecordings.map((r) => {
                      const isExpanded = expandedRowId === r.recordingId
                      return (
                        <li key={r.recordingId} className={`pr-row-wrap${isExpanded ? ' pr-row-wrap--open' : ''}`}>
                          <button
                            type="button"
                            className="pr-row"
                            onClick={() => setModalRecording(r)}
                          >
                            <div className="pr-row-date">{formatDate(r.sessionDate)}</div>
                            <div className="pr-row-type">
                              {r.sessionType && (
                                <span className="pr-card-type">{r.sessionType}</span>
                              )}
                            </div>
                            <div className="pr-row-duration">
                              {r.sessionDurationMinutes != null ? `${r.sessionDurationMinutes} min` : '—'}
                            </div>
                            <div className="pr-row-worker">{r.socialWorker ?? '—'}</div>
                            <div className="pr-row-summary">
                              {r.interventionsApplied ? (
                                <span className="pr-row-interventions">{r.interventionsApplied}</span>
                              ) : (
                                <span className="pr-row-muted">No interventions logged</span>
                              )}
                              {r.followUpActions && (
                                <>
                                  <span className="pr-row-sep"> · </span>
                                  <span className="pr-row-followup">{r.followUpActions}</span>
                                </>
                              )}
                            </div>
                            <div className="pr-row-flags">
                              {r.progressNoted && <span className="pr-flag pr-flag--progress" title="Progress noted">P</span>}
                              {r.concernsFlagged && <span className="pr-flag pr-flag--concern" title="Concerns flagged">C</span>}
                              {r.referralMade && <span className="pr-flag pr-flag--referral" title="Referral made">R</span>}
                            </div>
                            <div className="pr-row-mood">
                              <span
                                className={`pr-trend-dot pr-trend-dot--${emotionalStateColor(r.emotionalStateEnd)}`}
                                title={`${r.emotionalStateObserved ?? '—'} → ${r.emotionalStateEnd ?? '—'}`}
                              />
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="pr-row-detail">
                              {(r.emotionalStateObserved || r.emotionalStateEnd) && (
                                <div className="pr-card-emotion">
                                  <strong>Emotional state:</strong>{' '}
                                  {r.emotionalStateObserved ?? '—'}
                                  {r.emotionalStateEnd && ` → ${r.emotionalStateEnd}`}
                                </div>
                              )}
                              {r.sessionNarrative && (
                                <div className="pr-card-section">
                                  <div className="pr-card-label">Narrative</div>
                                  <p>{r.sessionNarrative}</p>
                                </div>
                              )}
                              {r.interventionsApplied && (
                                <div className="pr-card-section">
                                  <div className="pr-card-label">Interventions</div>
                                  <p>{r.interventionsApplied}</p>
                                </div>
                              )}
                              {r.followUpActions && (
                                <div className="pr-card-section">
                                  <div className="pr-card-label">Follow-up</div>
                                  <p>{r.followUpActions}</p>
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

                {filteredRecordings.length > 0 && (
                <div className="pr-pagination">
                  <div className="pr-pagination-info">
                    Showing {(safePage - 1) * pageSize + 1}–
                    {Math.min(safePage * pageSize, filteredRecordings.length)} of{' '}
                    {filteredRecordings.length}
                  </div>
                  <div className="pr-pagination-controls">
                    <button
                      type="button"
                      className="pr-page-btn"
                      onClick={() => setPage(1)}
                      disabled={safePage === 1}
                    >
                      « First
                    </button>
                    <button
                      type="button"
                      className="pr-page-btn"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                    >
                      ‹ Prev
                    </button>
                    <span className="pr-page-current">
                      Page {safePage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className="pr-page-btn"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                    >
                      Next ›
                    </button>
                    <button
                      type="button"
                      className="pr-page-btn"
                      onClick={() => setPage(totalPages)}
                      disabled={safePage === totalPages}
                    >
                      Last »
                    </button>
                    <select
                      className="pr-page-size"
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                    >
                      {[5, 10, 25, 50].map((n) => (
                        <option key={n} value={n}>
                          {n} / page
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                )}
                </>
              )}
            </>
          ) : (
            <p className="pr-empty">Select a resident from the left to view their recordings.</p>
          )}
        </section>
      </div>

      {modalRecording && (() => {
        const r = modalRecording
        const fmtDate = (iso: string | null) =>
          iso ? new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '—'
        return (
          <div className="pr-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalRecording(null) }}>
            <div className="pr-modal">
              <header className="pr-modal-header">
                <div>
                  <h2 className="pr-modal-title">Session Details</h2>
                  <p className="pr-modal-meta">
                    {fmtDate(r.sessionDate)}
                    {r.sessionType && ` · ${r.sessionType}`}
                    {r.socialWorker && ` · ${r.socialWorker}`}
                    {r.sessionDurationMinutes != null && ` · ${r.sessionDurationMinutes} min`}
                  </p>
                </div>
                <button type="button" className="pr-modal-close" onClick={() => setModalRecording(null)} aria-label="Close">×</button>
              </header>
              <div className="pr-modal-body">
                {(r.emotionalStateObserved || r.emotionalStateEnd) && (
                  <div className="pr-modal-section">
                    <div className="pr-modal-label">Emotional State</div>
                    <p>
                      {r.emotionalStateObserved ?? '—'} → {r.emotionalStateEnd ?? '—'}
                    </p>
                  </div>
                )}
                {r.sessionNarrative && (
                  <div className="pr-modal-section">
                    <div className="pr-modal-label">Session Narrative</div>
                    <p>{r.sessionNarrative}</p>
                  </div>
                )}
                {r.interventionsApplied && (
                  <div className="pr-modal-section">
                    <div className="pr-modal-label">Interventions Applied</div>
                    <p>{r.interventionsApplied}</p>
                  </div>
                )}
                {r.followUpActions && (
                  <div className="pr-modal-section">
                    <div className="pr-modal-label">Follow-up Actions</div>
                    <p>{r.followUpActions}</p>
                  </div>
                )}
                <div className="pr-modal-section">
                  <div className="pr-modal-label">Flags</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {r.progressNoted && <span className="pr-flag pr-flag--progress">P</span>}
                    {r.concernsFlagged && <span className="pr-flag pr-flag--concern">C</span>}
                    {r.referralMade && <span className="pr-flag pr-flag--referral">R</span>}
                    {!r.progressNoted && !r.concernsFlagged && !r.referralMade && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>None</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default ProcessRecordingsPage
