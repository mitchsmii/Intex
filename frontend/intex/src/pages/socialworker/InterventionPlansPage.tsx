import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  fetchResidents,
  fetchInterventionPlans,
  createInterventionPlan,
  updateInterventionPlan,
} from '../../services/socialWorkerService'
import { api } from '../../services/apiService'
import type { AdmissionChecklist, CaseConferenceRequest } from '../../services/apiService'
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

// ── Admission checklist items ─────────────────────────────────────────────────

const IN_FACILITY_ITEMS = [
  'Intake form signed by resident or guardian',
  'Initial health assessment completed',
  'Room and bed assigned',
  'Personal belongings inventoried and stored',
  'Emergency contacts recorded',
  'House rules & expectations reviewed with resident',
] as const

const NOT_IN_FACILITY_ITEMS = [
  'Warrant for rescue / custody obtained',
  'Restraining order against parents or guardians filed',
  'Court order documentation prepared',
  'DSWD referral completed',
  'Legal guardian or DSWD representative notified',
  'Child protective services contacted',
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const safe = iso.includes('T') ? iso : iso + 'T00:00:00'
  return new Date(safe).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function isOverdue(targetDate: string | null, status: string | null): boolean {
  if (!targetDate || status === 'Completed') return false
  return new Date(targetDate).getTime() < Date.now()
}

// ── Component ─────────────────────────────────────────────────────────────────

function InterventionPlansPage() {
  const location = useLocation()
  const preSelectedResidentId = (location.state as { preSelectedResidentId?: number } | null)?.preSelectedResidentId
  const [residents, setResidents] = useState<Resident[]>([])
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [knownServices, setKnownServices] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [modalPlan, setModalPlan] = useState<InterventionPlan | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('All')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PlanForm>(emptyPlanForm)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Admission checklist state ──────────────────────────────────────────────
  const [facilityStatus, setFacilityStatus] = useState<'in' | 'not'>('in')
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [checklistSubmitting, setChecklistSubmitting] = useState(false)
  const [checklistError, setChecklistError] = useState<string | null>(null)
  const [existingChecklist, setExistingChecklist] = useState<AdmissionChecklist | null>(null)
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [conferences, setConferences] = useState<CaseConferenceRequest[]>([])

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

  // Pull every existing services_provided value once so we can offer them as
  // checkboxes when adding/editing a plan. Splits comma-separated entries so
  // historical free-text inputs become individual options.
  useEffect(() => {
    fetchInterventionPlans()
      .then((all) => {
        const set = new Set<string>()
        all.forEach((p) => {
          if (!p.servicesProvided) return
          p.servicesProvided.split(',').forEach((s) => {
            const trimmed = s.trim()
            if (trimmed) set.add(trimmed)
          })
        })
        setKnownServices(Array.from(set).sort((a, b) => a.localeCompare(b)))
      })
      .catch(() => { /* non-fatal */ })
  }, [])

  useEffect(() => {
    if (selectedId == null) {
      setPlans([])
      setExistingChecklist(null)
      return
    }
    setDetailLoading(true)
    setChecklistLoading(true)
    setCheckedItems(new Set())
    setChecklistError(null)

    fetchInterventionPlans({ residentId: selectedId })
      .then(setPlans)
      .catch((err) => setError(err.message))
      .finally(() => setDetailLoading(false))

    // Fetch approved/accepted conferences that include this resident
    api.getCaseConferenceRequests()
      .then((all) => {
        const forResident = all.filter((c) => {
          if (c.status !== 'Approved' && c.status !== 'Accepted') return false
          try {
            const ids: number[] = JSON.parse(c.residentIds)
            return ids.includes(selectedId)
          } catch { return false }
        })
        setConferences(forResident)
      })
      .catch(() => setConferences([]))

    // Load any existing checklist submission for this resident
    api.getAdmissionChecklists()
      .then((all) => {
        const match = all.find((c) => c.residentId === selectedId) ?? null
        setExistingChecklist(match)
        if (match) {
          setFacilityStatus(match.residentInFacility ? 'in' : 'not')
          try {
            const items: string[] = JSON.parse(match.checkedItems)
            setCheckedItems(new Set(items))
          } catch {
            setCheckedItems(new Set())
          }
        }
      })
      .catch(() => setExistingChecklist(null))
      .finally(() => setChecklistLoading(false))
  }, [selectedId])

  const selectedResident = useMemo(
    () => residents.find((r) => r.residentId === selectedId) ?? null,
    [residents, selectedId],
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
      setPlans((prev) => prev.map((p) => (p.planId === plan.planId ? plan : p)))
    }
  }

  function toggleItem(item: string) {
    setCheckedItems((prev) => {
      const next = new Set(prev)
      next.has(item) ? next.delete(item) : next.add(item)
      return next
    })
  }

  async function handleChecklistSubmit() {
    if (selectedId == null) return
    setChecklistSubmitting(true)
    setChecklistError(null)
    try {
      const result = await api.submitAdmissionChecklist({
        residentId: selectedId,
        residentInFacility: facilityStatus === 'in',
        checkedItems: Array.from(checkedItems),
      })
      setExistingChecklist(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed'
      setChecklistError(msg.includes('409') || msg.includes('Conflict')
        ? 'A pending submission already exists for this resident.'
        : msg)
    } finally {
      setChecklistSubmitting(false)
    }
  }

  const activeItems = facilityStatus === 'in'
    ? IN_FACILITY_ITEMS
    : NOT_IN_FACILITY_ITEMS

  const allChecked = activeItems.length > 0 && activeItems.every((i) => checkedItems.has(i))

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

                      <div className="ip-field">
                        <span>Services Provided</span>
                        {knownServices.length === 0 ? (
                          <input
                            type="text"
                            placeholder="e.g. Counseling, school enrollment, medical referral"
                            value={form.servicesProvided}
                            onChange={(e) => updateField('servicesProvided', e.target.value)}
                          />
                        ) : (
                          <div className="ip-services-grid">
                            {knownServices.map((svc) => {
                              const selected = form.servicesProvided
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean)
                              const isChecked = selected.includes(svc)
                              return (
                                <label key={svc} className="ip-services-option">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const next = e.target.checked
                                        ? [...selected, svc]
                                        : selected.filter((s) => s !== svc)
                                      updateField('servicesProvided', next.join(', '))
                                    }}
                                  />
                                  <span>{svc}</span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>

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
                    <div className="ip-list">
                      <div className="ip-list-head">
                        <div>Plan</div>
                        <div>Description</div>
                        <div>Services</div>
                        <div>Target</div>
                        <div>Status</div>
                      </div>
                      <ul className="ip-rows">
                        {filteredPlans.map((p) => {
                          const overdue = isOverdue(p.targetDate, p.status)
                          return (
                            <li
                              key={p.planId}
                              className={`ip-row-wrap${overdue ? ' ip-row-wrap--overdue' : ''}`}
                            >
                              <div className="ip-row" onClick={() => setModalPlan(p)} style={{ cursor: 'pointer' }}>
                                <div className="ip-row-cat">
                                  <span className="ip-plan-cat">{p.planCategory ?? 'Plan'}</span>
                                </div>
                                <div className="ip-row-desc">
                                  {p.planDescription ?? <span className="ip-row-muted">No description</span>}
                                </div>
                                <div className="ip-row-services">
                                  {p.servicesProvided ?? <span className="ip-row-muted">—</span>}
                                </div>
                                <div className={`ip-row-target${overdue ? ' ip-row-target--overdue' : ''}`}>
                                  {p.targetDate ? (
                                    <>
                                      {overdue && <span className="ip-row-overdue-tag">Overdue</span>}
                                      {formatDate(p.targetDate)}
                                    </>
                                  ) : (
                                    <span className="ip-row-muted">—</span>
                                  )}
                                </div>
                                <div className="ip-row-status" onClick={(e) => e.stopPropagation()}>
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
                              </div>
                              {p.caseConferenceDate && (
                                <div className="ip-row-conf-line">
                                  Linked to conference: {formatDate(p.caseConferenceDate)}
                                </div>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}

                  {/* ── Admission Checklist ─────────────────────────────── */}
                  <div className="ip-checklist-section">
                    <div className="ip-checklist-header">
                      <div>
                        <h3 className="ip-checklist-title">Admission Checklist</h3>
                        <p className="ip-checklist-sub">
                          Complete and submit to admin for approval before or after placement.
                        </p>
                      </div>
                      {existingChecklist && (
                        <span className={`ip-cl-status-badge ip-cl-status--${existingChecklist.status.toLowerCase()}`}>
                          {existingChecklist.status}
                        </span>
                      )}
                    </div>

                    {checklistLoading ? (
                      <p className="ip-empty">Loading checklist…</p>
                    ) : existingChecklist?.status === 'Approved' ? (
                      <div className="ip-cl-approved">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Checklist approved by admin on {formatDate(existingChecklist.reviewedAt)}.
                        {existingChecklist.adminNotes && (
                          <span className="ip-cl-notes"> Note: {existingChecklist.adminNotes}</span>
                        )}
                      </div>
                    ) : existingChecklist?.status === 'Rejected' ? (
                      <div className="ip-cl-rejected">
                        Submission was rejected on {formatDate(existingChecklist.reviewedAt)}.
                        {existingChecklist.adminNotes && (
                          <span className="ip-cl-notes"> Reason: {existingChecklist.adminNotes}</span>
                        )}
                        <p className="ip-cl-rejected-hint">You may resubmit after addressing the concerns above.</p>
                      </div>
                    ) : existingChecklist?.status === 'Pending' ? (
                      <div className="ip-cl-pending">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        Submitted on {formatDate(existingChecklist.submittedAt)} — awaiting admin review.
                      </div>
                    ) : (
                      <>
                        {/* Facility toggle */}
                        <div className="ip-cl-toggle-row">
                          <span className="ip-cl-toggle-label">Resident status:</span>
                          <div className="ip-cl-toggle">
                            <button
                              type="button"
                              className={`ip-cl-toggle-btn${facilityStatus === 'in' ? ' active' : ''}`}
                              onClick={() => { setFacilityStatus('in'); setCheckedItems(new Set()) }}
                            >
                              Already in facility
                            </button>
                            <button
                              type="button"
                              className={`ip-cl-toggle-btn${facilityStatus === 'not' ? ' active' : ''}`}
                              onClick={() => { setFacilityStatus('not'); setCheckedItems(new Set()) }}
                            >
                              Not yet admitted
                            </button>
                          </div>
                        </div>

                        {/* Context note for legal docs */}
                        {facilityStatus === 'not' && (
                          <div className="ip-cl-legal-note">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/>
                              <line x1="12" y1="8" x2="12" y2="12"/>
                              <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                            Confirm the following legal documents are in place before requesting admission approval.
                          </div>
                        )}

                        {/* Checklist items */}
                        <ul className="ip-cl-list">
                          {activeItems.map((item) => (
                            <li key={item} className="ip-cl-item">
                              <label className="ip-cl-label">
                                <input
                                  type="checkbox"
                                  className="ip-cl-check"
                                  checked={checkedItems.has(item)}
                                  onChange={() => toggleItem(item)}
                                />
                                <span className={checkedItems.has(item) ? 'ip-cl-text--checked' : ''}>
                                  {item}
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>

                        <div className="ip-cl-footer">
                          <span className="ip-cl-count">
                            {checkedItems.size} / {activeItems.length} confirmed
                          </span>
                          {checklistError && (
                            <span className="ip-cl-error">{checklistError}</span>
                          )}
                          <button
                            type="button"
                            className="ip-btn ip-btn--primary"
                            disabled={checkedItems.size === 0 || checklistSubmitting}
                            onClick={handleChecklistSubmit}
                          >
                            {checklistSubmitting
                              ? 'Submitting…'
                              : allChecked
                                ? 'Submit for Approval'
                                : `Submit ${checkedItems.size} item${checkedItems.size !== 1 ? 's' : ''} for Approval`}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="ip-empty">Select a resident from the left to view their intervention plans.</p>
          )}
        </section>
      </div>

      {modalPlan && (() => {
        const p = modalPlan
        return (
          <div className="ip-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalPlan(null) }}>
            <div className="ip-modal">
              <header className="ip-modal-header">
                <div>
                  <h2 className="ip-modal-title">{p.planCategory ?? 'Intervention Plan'}</h2>
                  <p className="ip-modal-meta">
                    Status: {p.status ?? '—'}
                    {p.targetDate && ` · Target: ${formatDate(p.targetDate)}`}
                    {p.caseConferenceDate && ` · Conference: ${formatDate(p.caseConferenceDate)}`}
                  </p>
                </div>
                <button type="button" className="ip-modal-close" onClick={() => setModalPlan(null)} aria-label="Close">×</button>
              </header>
              <div className="ip-modal-body">
                {p.planDescription && (
                  <div className="ip-modal-section">
                    <div className="ip-modal-label">Description</div>
                    <p>{p.planDescription}</p>
                  </div>
                )}
                {p.servicesProvided && (
                  <div className="ip-modal-section">
                    <div className="ip-modal-label">Services Provided</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {p.servicesProvided.split(',').map((s, i) => (
                        <span key={i} className="ip-plan-cat" style={{ fontSize: '0.8rem' }}>{s.trim()}</span>
                      ))}
                    </div>
                  </div>
                )}
                {p.targetValue != null && (
                  <div className="ip-modal-section">
                    <div className="ip-modal-label">Target Value</div>
                    <p>{p.targetValue}</p>
                  </div>
                )}
                {p.createdAt && (
                  <div className="ip-modal-section">
                    <div className="ip-modal-label">Created</div>
                    <p>{formatDate(p.createdAt)}</p>
                  </div>
                )}
                {p.updatedAt && (
                  <div className="ip-modal-section">
                    <div className="ip-modal-label">Last Updated</div>
                    <p>{formatDate(p.updatedAt)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default InterventionPlansPage
