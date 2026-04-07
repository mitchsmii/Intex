import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  fetchResidents,
  fetchHomeVisitations,
  createHomeVisitation,
} from '../../services/socialWorkerService'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import type { Resident } from '../../types/Resident'
import type { HomeVisitation } from '../../types/HomeVisitation'
import './VisitsConferencesPage.css'

const VISIT_TYPES = [
  'Initial Assessment',
  'Routine Follow-up',
  'Reintegration Assessment',
  'Post-Placement Monitoring',
  'Emergency',
] as const

type VisitForm = {
  visitDate: string
  visitType: string
  locationVisited: string
  familyMembersPresent: string
  purpose: string
  observations: string
  familyCooperationLevel: string
  safetyConcernsNoted: boolean
  followUpNeeded: boolean
  followUpNotes: string
  visitOutcome: string
}

const emptyVisitForm = (): VisitForm => ({
  visitDate: new Date().toISOString().slice(0, 10),
  visitType: 'Routine Follow-up',
  locationVisited: '',
  familyMembersPresent: '',
  purpose: '',
  observations: '',
  familyCooperationLevel: 'Medium',
  safetyConcernsNoted: false,
  followUpNeeded: false,
  followUpNotes: '',
  visitOutcome: '',
})

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function VisitsConferencesPage() {
  const { user } = useAuth()
  const [residents, setResidents] = useState<Resident[]>([])
  const [visits, setVisits] = useState<HomeVisitation[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<VisitForm>(emptyVisitForm)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const pageSize = 10

  // Initial residents load
  useEffect(() => {
    fetchResidents()
      .then((rs) => {
        setResidents(rs)
        if (rs.length > 0) setSelectedId(rs[0].residentId)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Per-resident: load visits
  useEffect(() => {
    if (selectedId == null) {
      setVisits([])
      return
    }
    setDetailLoading(true)
    fetchHomeVisitations({ residentId: selectedId })
      .then(setVisits)
      .catch((err) => setError(err.message))
      .finally(() => setDetailLoading(false))
  }, [selectedId])

  // Reset page when resident changes
  useEffect(() => {
    setPage(1)
  }, [selectedId])

  const selectedResident = useMemo(
    () => residents.find((r) => r.residentId === selectedId) ?? null,
    [residents, selectedId],
  )

  const sortedVisits = useMemo(() => {
    return [...visits].sort((a, b) => {
      const ad = a.visitDate ? new Date(a.visitDate).getTime() : 0
      const bd = b.visitDate ? new Date(b.visitDate).getTime() : 0
      return bd - ad
    })
  }, [visits])

  const totalPages = Math.max(1, Math.ceil(sortedVisits.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedVisits = sortedVisits.slice((safePage - 1) * pageSize, safePage * pageSize)

  function openForm() {
    setForm(emptyVisitForm())
    setSubmitError(null)
    setShowForm(true)
  }

  function updateField<K extends keyof VisitForm>(key: K, value: VisitForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedId == null) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const payload: Omit<HomeVisitation, 'visitationId'> = {
        residentId: selectedId,
        visitDate: form.visitDate || null,
        socialWorker: user?.username ?? null,
        visitType: form.visitType || null,
        locationVisited: form.locationVisited || null,
        familyMembersPresent: form.familyMembersPresent || null,
        purpose: form.purpose || null,
        observations: form.observations || null,
        familyCooperationLevel: form.familyCooperationLevel || null,
        safetyConcernsNoted: form.safetyConcernsNoted,
        followUpNeeded: form.followUpNeeded,
        followUpNotes: form.followUpNotes || null,
        visitOutcome: form.visitOutcome || null,
      }
      const created = await createHomeVisitation(payload)
      setVisits((prev) => [created, ...prev])
      setShowForm(false)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save visit')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingSpinner size="lg" />
  if (error) return <p className="vc-error">Error: {error}</p>

  return (
    <div className="vc-page">
      <header className="vc-header">
        <div>
          <h1>Home Visits</h1>
          <p className="vc-sub">
            Log home and field visits and track family cooperation.
          </p>
        </div>
      </header>

      <div className="vc-layout">
        {/* Left rail: residents */}
        <aside className="vc-rail">
          <div className="vc-rail-header">My Residents</div>
          {residents.length === 0 ? (
            <p className="vc-empty">No residents assigned yet.</p>
          ) : (
            <ul className="vc-rail-list">
              {residents.map((r) => {
                const active = r.residentId === selectedId
                return (
                  <li key={r.residentId}>
                    <button
                      type="button"
                      className={`vc-rail-item${active ? ' vc-rail-item--active' : ''}`}
                      onClick={() => setSelectedId(r.residentId)}
                    >
                      <span className="vc-rail-code">{r.internalCode ?? `#${r.residentId}`}</span>
                      <span className="vc-rail-meta">Age {r.presentAge ?? '—'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {/* Right pane */}
        <section className="vc-main">
          {selectedResident ? (
            <>
              <div className="vc-main-header">
                <div>
                  <h2>{selectedResident.internalCode ?? `#${selectedResident.residentId}`}</h2>
                  <div className="vc-main-meta">
                    Age {selectedResident.presentAge ?? '—'} ·{' '}
                    <span className={`vc-risk vc-risk--${(selectedResident.currentRiskLevel ?? 'unknown').toLowerCase()}`}>
                      {selectedResident.currentRiskLevel ?? 'Unknown'} risk
                    </span>
                  </div>
                </div>
                {!showForm && (
                  <button type="button" className="vc-add-btn" onClick={openForm}>
                    + New Visit
                  </button>
                )}
              </div>

              {detailLoading ? (
                <LoadingSpinner size="md" />
              ) : (
                <>
                  {showForm && (
                    <form className="vc-form" onSubmit={handleSubmit}>
                      <div className="vc-form-row">
                        <label className="vc-field">
                          <span>Visit Date</span>
                          <input
                            type="date"
                            value={form.visitDate}
                            onChange={(e) => updateField('visitDate', e.target.value)}
                            required
                          />
                        </label>
                        <label className="vc-field">
                          <span>Social Worker</span>
                          <input type="text" value={user?.username ?? ''} readOnly />
                        </label>
                        <label className="vc-field">
                          <span>Visit Type</span>
                          <select
                            value={form.visitType}
                            onChange={(e) => updateField('visitType', e.target.value)}
                          >
                            {VISIT_TYPES.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="vc-form-row">
                        <label className="vc-field">
                          <span>Location Visited</span>
                          <input
                            type="text"
                            placeholder="e.g. Family residence, school"
                            value={form.locationVisited}
                            onChange={(e) => updateField('locationVisited', e.target.value)}
                          />
                        </label>
                        <label className="vc-field">
                          <span>Family Members Present</span>
                          <input
                            type="text"
                            placeholder="e.g. Mother, sibling"
                            value={form.familyMembersPresent}
                            onChange={(e) => updateField('familyMembersPresent', e.target.value)}
                          />
                        </label>
                        <label className="vc-field">
                          <span>Family Cooperation</span>
                          <select
                            value={form.familyCooperationLevel}
                            onChange={(e) => updateField('familyCooperationLevel', e.target.value)}
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </label>
                      </div>

                      <label className="vc-field">
                        <span>Purpose</span>
                        <input
                          type="text"
                          placeholder="Why this visit"
                          value={form.purpose}
                          onChange={(e) => updateField('purpose', e.target.value)}
                        />
                      </label>

                      <label className="vc-field">
                        <span>Observations About Home Environment</span>
                        <textarea
                          rows={4}
                          placeholder="Conditions, family dynamics, anything you noticed..."
                          value={form.observations}
                          onChange={(e) => updateField('observations', e.target.value)}
                        />
                      </label>

                      <div className="vc-checkbox-row">
                        <label>
                          <input
                            type="checkbox"
                            checked={form.safetyConcernsNoted}
                            onChange={(e) => updateField('safetyConcernsNoted', e.target.checked)}
                          />
                          Safety concerns noted
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={form.followUpNeeded}
                            onChange={(e) => updateField('followUpNeeded', e.target.checked)}
                          />
                          Follow-up needed
                        </label>
                      </div>

                      {form.followUpNeeded && (
                        <label className="vc-field">
                          <span>Follow-Up Actions</span>
                          <textarea
                            rows={3}
                            placeholder="What needs to happen next..."
                            value={form.followUpNotes}
                            onChange={(e) => updateField('followUpNotes', e.target.value)}
                          />
                        </label>
                      )}

                      <label className="vc-field">
                        <span>Visit Outcome</span>
                        <input
                          type="text"
                          placeholder="e.g. Stable, Concerning, Action required"
                          value={form.visitOutcome}
                          onChange={(e) => updateField('visitOutcome', e.target.value)}
                        />
                      </label>

                      {submitError && <div className="vc-form-error">{submitError}</div>}

                      <div className="vc-form-actions">
                        <button
                          type="button"
                          className="vc-btn vc-btn--secondary"
                          onClick={() => setShowForm(false)}
                          disabled={submitting}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="vc-btn vc-btn--primary" disabled={submitting}>
                          {submitting ? 'Saving…' : 'Save Visit'}
                        </button>
                      </div>
                    </form>
                  )}

                  {sortedVisits.length === 0 ? (
                    <p className="vc-empty">
                      No home visits logged yet for {selectedResident.internalCode ?? 'this resident'}.
                    </p>
                  ) : (
                    <>
                      <ul className="vc-timeline">
                        {pagedVisits.map((v) => (
                          <li key={v.visitationId} className="vc-card">
                            <div className="vc-card-top">
                              <span className="vc-card-date">{formatDate(v.visitDate)}</span>
                              {v.visitType && <span className="vc-card-type">{v.visitType}</span>}
                              {v.locationVisited && (
                                <span className="vc-card-location">{v.locationVisited}</span>
                              )}
                              {v.socialWorker && (
                                <span className="vc-card-worker">{v.socialWorker}</span>
                              )}
                            </div>

                            {v.familyMembersPresent && (
                              <div className="vc-card-line">
                                <strong>Family present:</strong> {v.familyMembersPresent}
                              </div>
                            )}

                            {v.purpose && (
                              <div className="vc-card-line">
                                <strong>Purpose:</strong> {v.purpose}
                              </div>
                            )}

                            {v.observations && (
                              <div className="vc-card-section">
                                <div className="vc-card-label">Observations</div>
                                <p>{v.observations}</p>
                              </div>
                            )}

                            {v.followUpNeeded && v.followUpNotes && (
                              <div className="vc-card-section">
                                <div className="vc-card-label">Follow-up</div>
                                <p>{v.followUpNotes}</p>
                              </div>
                            )}

                            <div className="vc-card-flags">
                              {v.familyCooperationLevel && (
                                <span className={`vc-flag vc-flag--coop-${v.familyCooperationLevel.toLowerCase()}`}>
                                  Cooperation: {v.familyCooperationLevel}
                                </span>
                              )}
                              {v.safetyConcernsNoted && (
                                <span className="vc-flag vc-flag--concern">Safety concern</span>
                              )}
                              {v.followUpNeeded && (
                                <span className="vc-flag vc-flag--followup">Follow-up</span>
                              )}
                              {v.visitOutcome && (
                                <span className="vc-flag vc-flag--outcome">{v.visitOutcome}</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>

                      <div className="vc-pagination">
                        <div className="vc-pagination-info">
                          Showing {(safePage - 1) * pageSize + 1}–
                          {Math.min(safePage * pageSize, sortedVisits.length)} of{' '}
                          {sortedVisits.length}
                        </div>
                        <div className="vc-pagination-controls">
                          <button
                            type="button"
                            className="vc-page-btn"
                            onClick={() => setPage(1)}
                            disabled={safePage === 1}
                          >
                            « First
                          </button>
                          <button
                            type="button"
                            className="vc-page-btn"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={safePage === 1}
                          >
                            ‹ Prev
                          </button>
                          <span className="vc-page-current">
                            Page {safePage} of {totalPages}
                          </span>
                          <button
                            type="button"
                            className="vc-page-btn"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage === totalPages}
                          >
                            Next ›
                          </button>
                          <button
                            type="button"
                            className="vc-page-btn"
                            onClick={() => setPage(totalPages)}
                            disabled={safePage === totalPages}
                          >
                            Last »
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <p className="vc-empty">Select a resident from the left to view their visits.</p>
          )}
        </section>
      </div>
    </div>
  )
}

export default VisitsConferencesPage
