import { useEffect, useMemo, useState } from 'react'
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

function ProcessRecordingsPage() {
  const { user } = useAuth()
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

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Initial load: residents only
  useEffect(() => {
    fetchResidents()
      .then((rs) => {
        setResidents(rs)
        if (rs.length > 0) setSelectedId(rs[0].residentId)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

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

  // Reset to first page whenever the resident or page size changes
  useEffect(() => {
    setPage(1)
  }, [selectedId, pageSize])

  const totalPages = Math.max(1, Math.ceil(sortedRecordings.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedRecordings = sortedRecordings.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  )

  function openForm() {
    setForm(emptyForm())
    setSubmitError(null)
    setShowForm(true)
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

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
                </div>
                {!showForm && (
                  <button type="button" className="pr-add-btn" onClick={openForm}>
                    + New Recording
                  </button>
                )}
              </div>

              {showForm && (
                <form className="pr-form" onSubmit={handleSubmit}>
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
                      <input
                        type="text"
                        placeholder="e.g. Anxious, withdrawn"
                        value={form.emotionalStateObserved}
                        onChange={(e) => updateField('emotionalStateObserved', e.target.value)}
                      />
                    </label>
                    <label className="pr-field">
                      <span>Emotional State at End</span>
                      <input
                        type="text"
                        placeholder="e.g. Calm, hopeful"
                        value={form.emotionalStateEnd}
                        onChange={(e) => updateField('emotionalStateEnd', e.target.value)}
                      />
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

                  <label className="pr-field">
                    <span>Interventions Applied</span>
                    <textarea
                      rows={3}
                      placeholder="Techniques, exercises, referrals discussed..."
                      value={form.interventionsApplied}
                      onChange={(e) => updateField('interventionsApplied', e.target.value)}
                    />
                  </label>

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
                      onClick={() => setShowForm(false)}
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
                <ul className="pr-timeline">
                  {pagedRecordings.map((r) => (
                    <li key={r.recordingId} className="pr-card">
                      <div className="pr-card-top">
                        <span className="pr-card-date">{formatDate(r.sessionDate)}</span>
                        {r.sessionType && (
                          <span className="pr-card-type">{r.sessionType}</span>
                        )}
                        {r.sessionDurationMinutes != null && (
                          <span className="pr-card-duration">{r.sessionDurationMinutes} min</span>
                        )}
                        {r.socialWorker && (
                          <span className="pr-card-worker">{r.socialWorker}</span>
                        )}
                      </div>

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

                      <div className="pr-card-flags">
                        {r.progressNoted && <span className="pr-flag pr-flag--progress">Progress</span>}
                        {r.concernsFlagged && <span className="pr-flag pr-flag--concern">Concern</span>}
                        {r.referralMade && <span className="pr-flag pr-flag--referral">Referral</span>}
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="pr-pagination">
                  <div className="pr-pagination-info">
                    Showing {(safePage - 1) * pageSize + 1}–
                    {Math.min(safePage * pageSize, sortedRecordings.length)} of{' '}
                    {sortedRecordings.length}
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
                </>
              )}
            </>
          ) : (
            <p className="pr-empty">Select a resident from the left to view their recordings.</p>
          )}
        </section>
      </div>
    </div>
  )
}

export default ProcessRecordingsPage
