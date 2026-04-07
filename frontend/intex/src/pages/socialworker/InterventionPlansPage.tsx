import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  fetchResidents,
  fetchInterventionPlans,
  createInterventionPlan,
  updateInterventionPlan,
} from '../../services/socialWorkerService'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import type { Resident } from '../../types/Resident'
import type { InterventionPlan } from '../../types/InterventionPlan'
import './InterventionPlansPage.css'

const STATUSES = ['In Progress', 'Completed', 'On Hold'] as const
const CATEGORIES = ['Safety', 'Psychosocial', 'Education', 'Health', 'Family', 'Legal', 'Other'] as const

type StatusFilter = 'All' | (typeof STATUSES)[number]

type PlanForm = {
  planCategory: string
  planDescription: string
  servicesProvided: string
  targetDate: string
  caseConferenceDate: string
  status: string
}

const emptyPlanForm = (): PlanForm => ({
  planCategory: 'Safety',
  planDescription: '',
  servicesProvided: '',
  targetDate: '',
  caseConferenceDate: '',
  status: 'In Progress',
})

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function isOverdue(targetDate: string | null, status: string | null): boolean {
  if (!targetDate || status === 'Completed') return false
  return new Date(targetDate).getTime() < Date.now()
}

function InterventionPlansPage() {
  const location = useLocation()
  const preSelectedResidentId = (location.state as { preSelectedResidentId?: number } | null)?.preSelectedResidentId
  const [residents, setResidents] = useState<Resident[]>([])
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('All')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PlanForm>(emptyPlanForm)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

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

  const todayMs = new Date().setHours(0, 0, 0, 0)

  const upcomingConferences = useMemo(
    () =>
      plans
        .filter((p) => p.caseConferenceDate && new Date(p.caseConferenceDate).getTime() >= todayMs)
        .sort((a, b) => new Date(a.caseConferenceDate!).getTime() - new Date(b.caseConferenceDate!).getTime()),
    [plans, todayMs],
  )

  const pastConferences = useMemo(
    () =>
      plans
        .filter((p) => p.caseConferenceDate && new Date(p.caseConferenceDate).getTime() < todayMs)
        .sort((a, b) => new Date(b.caseConferenceDate!).getTime() - new Date(a.caseConferenceDate!).getTime()),
    [plans, todayMs],
  )

  const filteredPlans = useMemo(() => {
    const list = filter === 'All' ? plans : plans.filter((p) => p.status === filter)
    return [...list].sort((a, b) => {
      const ad = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const bd = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return bd - ad
    })
  }, [plans, filter])

  function openForm() {
    setForm(emptyPlanForm())
    setSubmitError(null)
    setShowForm(true)
  }

  function updateField<K extends keyof PlanForm>(key: K, value: PlanForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedId == null) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const payload: Omit<InterventionPlan, 'planId'> = {
        residentId: selectedId,
        planCategory: form.planCategory || null,
        planDescription: form.planDescription || null,
        servicesProvided: form.servicesProvided || null,
        targetValue: null,
        targetDate: form.targetDate || null,
        status: form.status || null,
        caseConferenceDate: form.caseConferenceDate || null,
        createdAt: null,
        updatedAt: null,
      }
      const created = await createInterventionPlan(payload)
      setPlans((prev) => [created, ...prev])
      setShowForm(false)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save plan')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatusChange(plan: InterventionPlan, newStatus: string) {
    const optimistic = { ...plan, status: newStatus }
    setPlans((prev) => prev.map((p) => (p.planId === plan.planId ? optimistic : p)))
    try {
      await updateInterventionPlan(plan.planId, optimistic)
    } catch {
      // revert on failure
      setPlans((prev) => prev.map((p) => (p.planId === plan.planId ? plan : p)))
    }
  }

  if (loading) return <LoadingSpinner size="lg" />
  if (error) return <p className="ip-error">Error: {error}</p>

  return (
    <div className="ip-page">
      <header className="ip-header">
        <div>
          <h1>Intervention Plans</h1>
          <p className="ip-sub">
            Track plans created from case conferences — safety, education, family, and beyond.
          </p>
        </div>
      </header>

      <div className="ip-layout">
        {/* Left rail */}
        <aside className="ip-rail">
          <div className="ip-rail-header">My Residents</div>
          {residents.length === 0 ? (
            <p className="ip-empty">No residents assigned yet.</p>
          ) : (
            <ul className="ip-rail-list">
              {residents.map((r) => {
                const active = r.residentId === selectedId
                return (
                  <li key={r.residentId}>
                    <button
                      type="button"
                      className={`ip-rail-item${active ? ' ip-rail-item--active' : ''}`}
                      onClick={() => setSelectedId(r.residentId)}
                    >
                      <span className="ip-rail-code">{r.internalCode ?? `#${r.residentId}`}</span>
                      <span className="ip-rail-meta">Age {r.presentAge ?? '—'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {/* Right pane */}
        <section className="ip-main">
          {selectedResident ? (
            <>
              <div className="ip-main-header">
                <div>
                  <h2>{selectedResident.internalCode ?? `#${selectedResident.residentId}`}</h2>
                  <div className="ip-main-meta">
                    Age {selectedResident.presentAge ?? '—'} ·{' '}
                    <span className={`ip-risk ip-risk--${(selectedResident.currentRiskLevel ?? 'unknown').toLowerCase()}`}>
                      {selectedResident.currentRiskLevel ?? 'Unknown'} risk
                    </span>
                  </div>
                </div>
                {!showForm && (
                  <button type="button" className="ip-add-btn" onClick={openForm}>
                    + New Plan
                  </button>
                )}
              </div>

              {detailLoading ? (
                <LoadingSpinner size="md" />
              ) : (
                <>
                  {/* Case Conferences embedded at the top */}
                  <section className="ip-conferences">
                    <h3>Case Conferences</h3>
                    <div className="ip-conf-grid">
                      <div>
                        <div className="ip-conf-label">Upcoming</div>
                        {upcomingConferences.length === 0 ? (
                          <p className="ip-empty-sm">None scheduled.</p>
                        ) : (
                          <ul className="ip-conf-list">
                            {upcomingConferences.map((p) => (
                              <li key={`up-${p.planId}`} className="ip-conf-item ip-conf-item--upcoming">
                                <div className="ip-conf-date">{formatDate(p.caseConferenceDate)}</div>
                                <div className="ip-conf-cat">{p.planCategory ?? 'Conference'}</div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <div className="ip-conf-label">Past</div>
                        {pastConferences.length === 0 ? (
                          <p className="ip-empty-sm">No past conferences.</p>
                        ) : (
                          <ul className="ip-conf-list">
                            {pastConferences.slice(0, 5).map((p) => (
                              <li key={`past-${p.planId}`} className="ip-conf-item">
                                <div className="ip-conf-date">{formatDate(p.caseConferenceDate)}</div>
                                <div className="ip-conf-cat">{p.planCategory ?? 'Conference'}</div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* New plan form */}
                  {showForm && (
                    <form className="ip-form" onSubmit={handleSubmit}>
                      <div className="ip-form-row">
                        <label className="ip-field">
                          <span>Category</span>
                          <select
                            value={form.planCategory}
                            onChange={(e) => updateField('planCategory', e.target.value)}
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </label>
                        <label className="ip-field">
                          <span>Status</span>
                          <select
                            value={form.status}
                            onChange={(e) => updateField('status', e.target.value)}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                        <label className="ip-field">
                          <span>Target Date</span>
                          <input
                            type="date"
                            value={form.targetDate}
                            onChange={(e) => updateField('targetDate', e.target.value)}
                          />
                        </label>
                        <label className="ip-field">
                          <span>Case Conference Date</span>
                          <input
                            type="date"
                            value={form.caseConferenceDate}
                            onChange={(e) => updateField('caseConferenceDate', e.target.value)}
                          />
                        </label>
                      </div>

                      <label className="ip-field">
                        <span>Plan Description</span>
                        <textarea
                          rows={3}
                          placeholder="What is this plan trying to accomplish..."
                          value={form.planDescription}
                          onChange={(e) => updateField('planDescription', e.target.value)}
                          required
                        />
                      </label>

                      <label className="ip-field">
                        <span>Services Provided</span>
                        <input
                          type="text"
                          placeholder="e.g. Counseling, school enrollment, medical referral"
                          value={form.servicesProvided}
                          onChange={(e) => updateField('servicesProvided', e.target.value)}
                        />
                      </label>

                      {submitError && <div className="ip-form-error">{submitError}</div>}

                      <div className="ip-form-actions">
                        <button
                          type="button"
                          className="ip-btn ip-btn--secondary"
                          onClick={() => setShowForm(false)}
                          disabled={submitting}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="ip-btn ip-btn--primary" disabled={submitting}>
                          {submitting ? 'Saving…' : 'Save Plan'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Status filter chips */}
                  <div className="ip-filters">
                    {(['All', ...STATUSES] as StatusFilter[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`ip-filter${filter === s ? ' ip-filter--active' : ''}`}
                        onClick={() => setFilter(s)}
                      >
                        {s} {s === 'All' ? `(${plans.length})` : `(${plans.filter((p) => p.status === s).length})`}
                      </button>
                    ))}
                  </div>

                  {/* Plans list */}
                  {filteredPlans.length === 0 ? (
                    <p className="ip-empty">
                      No plans {filter === 'All' ? 'yet for this resident' : `in "${filter}" status`}.
                    </p>
                  ) : (
                    <ul className="ip-plans">
                      {filteredPlans.map((p) => {
                        const overdue = isOverdue(p.targetDate, p.status)
                        return (
                          <li key={p.planId} className={`ip-plan${overdue ? ' ip-plan--overdue' : ''}`}>
                            <div className="ip-plan-top">
                              <span className="ip-plan-cat">{p.planCategory ?? 'Plan'}</span>
                              {p.targetDate && (
                                <span className={`ip-plan-target${overdue ? ' ip-plan-target--overdue' : ''}`}>
                                  {overdue ? 'Overdue: ' : 'Target: '}
                                  {formatDate(p.targetDate)}
                                </span>
                              )}
                              <select
                                className="ip-plan-status"
                                value={p.status ?? ''}
                                onChange={(e) => handleStatusChange(p, e.target.value)}
                              >
                                {STATUSES.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </div>
                            {p.planDescription && (
                              <p className="ip-plan-desc">{p.planDescription}</p>
                            )}
                            {p.servicesProvided && (
                              <div className="ip-plan-services">
                                <strong>Services:</strong> {p.servicesProvided}
                              </div>
                            )}
                            {p.caseConferenceDate && (
                              <div className="ip-plan-conf">
                                Linked to conference: {formatDate(p.caseConferenceDate)}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </>
              )}
            </>
          ) : (
            <p className="ip-empty">Select a resident from the left to view their intervention plans.</p>
          )}
        </section>
      </div>
    </div>
  )
}

export default InterventionPlansPage
