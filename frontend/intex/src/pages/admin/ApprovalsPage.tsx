import { useState, useEffect } from 'react'
import { api } from '../../services/apiService'
import type { AdmissionChecklist, CaseConferenceRequest } from '../../services/apiService'
import './ApprovalsPage.css'

type Filter = 'Pending' | 'Approved' | 'Rejected' | 'All'
type Section = 'checklists' | 'conferences'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const safe = iso.includes('T') ? iso : iso + 'T00:00:00'
  return new Date(safe).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function parseItems(json: string): string[] {
  try { return JSON.parse(json) } catch { return [] }
}

export default function ApprovalsPage() {
  const [section, setSection] = useState<Section>('checklists')

  // ── Admission checklists ──
  const [checklists, setChecklists] = useState<AdmissionChecklist[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState<Filter>('Pending')
  const [notes, setNotes]           = useState<Record<number, string>>({})
  const [acting, setActing]         = useState<Record<number, boolean>>({})
  const [error, setError]           = useState<string | null>(null)

  // ── Conference requests ──
  const [confRequests, setConfRequests] = useState<CaseConferenceRequest[]>([])
  const [confLoading, setConfLoading]   = useState(true)
  const [confFilter, setConfFilter]     = useState<Filter>('Pending')
  const [confNotes, setConfNotes]       = useState<Record<number, string>>({})
  const [confActing, setConfActing]     = useState<Record<number, boolean>>({})
  const [counterForm, setCounterForm]   = useState<{ id: number; date: string; time: string } | null>(null)

  useEffect(() => {
    api.getAdmissionChecklists()
      .then(setChecklists)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
    api.getCaseConferenceRequests()
      .then(setConfRequests)
      .catch(() => {})
      .finally(() => setConfLoading(false))
  }, [])

  const filtered = filter === 'All'
    ? checklists
    : checklists.filter((c) => c.status === filter)

  const counts = {
    Pending:  checklists.filter((c) => c.status === 'Pending').length,
    Approved: checklists.filter((c) => c.status === 'Approved').length,
    Rejected: checklists.filter((c) => c.status === 'Rejected').length,
    All:      checklists.length,
  }

  async function handleApprove(id: number) {
    setActing((p) => ({ ...p, [id]: true }))
    try {
      const updated = await api.approveChecklist(id, notes[id])
      setChecklists((prev) => prev.map((c) => c.checklistId === id ? updated : c))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approval failed')
    } finally {
      setActing((p) => ({ ...p, [id]: false }))
    }
  }

  async function handleReject(id: number) {
    setActing((p) => ({ ...p, [id]: true }))
    try {
      const updated = await api.rejectChecklist(id, notes[id])
      setChecklists((prev) => prev.map((c) => c.checklistId === id ? updated : c))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rejection failed')
    } finally {
      setActing((p) => ({ ...p, [id]: false }))
    }
  }

  // ── Conference handlers ──
  async function handleConfApprove(id: number) {
    setConfActing((p) => ({ ...p, [id]: true }))
    try {
      const updated = await api.approveCaseConferenceRequest(id, confNotes[id])
      setConfRequests((prev) => prev.map((r) => r.requestId === id ? updated : r))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approval failed')
    } finally {
      setConfActing((p) => ({ ...p, [id]: false }))
    }
  }

  async function handleConfReject(id: number) {
    setConfActing((p) => ({ ...p, [id]: true }))
    try {
      const updated = await api.rejectCaseConferenceRequest(id, confNotes[id])
      setConfRequests((prev) => prev.map((r) => r.requestId === id ? updated : r))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rejection failed')
    } finally {
      setConfActing((p) => ({ ...p, [id]: false }))
    }
  }

  async function handleCounterPropose(id: number) {
    if (!counterForm || counterForm.id !== id) return
    setConfActing((p) => ({ ...p, [id]: true }))
    try {
      const updated = await api.counterProposeConference(id, {
        counterDate: counterForm.date,
        counterTime: counterForm.time,
        notes: confNotes[id],
      })
      setConfRequests((prev) => prev.map((r) => r.requestId === id ? updated : r))
      setCounterForm(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Counter-propose failed')
    } finally {
      setConfActing((p) => ({ ...p, [id]: false }))
    }
  }

  const confFiltered = confFilter === 'All'
    ? confRequests
    : confRequests.filter((r) => {
        if (confFilter === 'Approved') return r.status === 'Approved' || r.status === 'Accepted'
        return r.status === confFilter
      })

  const confCounts = {
    Pending:  confRequests.filter((r) => r.status === 'Pending' || r.status === 'Counter-Proposed').length,
    Approved: confRequests.filter((r) => r.status === 'Approved' || r.status === 'Accepted').length,
    Rejected: confRequests.filter((r) => r.status === 'Rejected').length,
    All:      confRequests.length,
  }

  function parseAgenda(json: string): { residentId: number; notes: string }[] {
    try { return JSON.parse(json) } catch { return [] }
  }
  function parseResidentIds(json: string): number[] {
    try { return JSON.parse(json) } catch { return [] }
  }

  return (
    <div className="ap-page">
      <div className="ap-header">
        <div>
          <h1 className="ap-title">Approvals</h1>
          <p className="ap-sub">Review submissions and requests from social workers.</p>
        </div>
      </div>

      {/* Section toggle */}
      <div className="ap-section-toggle">
        <button
          type="button"
          className={`ap-section-btn${section === 'checklists' ? ' ap-section-btn--active' : ''}`}
          onClick={() => setSection('checklists')}
        >
          Admission Checklists
          {counts.Pending > 0 && <span className="ap-badge">{counts.Pending}</span>}
        </button>
        <button
          type="button"
          className={`ap-section-btn${section === 'conferences' ? ' ap-section-btn--active' : ''}`}
          onClick={() => setSection('conferences')}
        >
          Conference Requests
          {confCounts.Pending > 0 && <span className="ap-badge">{confCounts.Pending}</span>}
        </button>
      </div>

      {section === 'checklists' && <>
      {/* Filter tabs */}
      <div className="ap-tabs">
        {(['Pending', 'Approved', 'Rejected', 'All'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`ap-tab${filter === f ? ' ap-tab--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
            <span className="ap-tab-count">{counts[f]}</span>
          </button>
        ))}
      </div>

      {error && <p className="ap-error">{error}</p>}

      {loading ? (
        <p className="ap-empty">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="ap-empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <p>No {filter === 'All' ? '' : filter.toLowerCase() + ' '}submissions.</p>
        </div>
      ) : (
        <div className="ap-list">
          {filtered.map((c) => {
            const items = parseItems(c.checkedItems)
            const isPending = c.status === 'Pending'
            return (
              <div key={c.checklistId} className={`ap-card ap-card--${c.status.toLowerCase()}`}>
                {/* Card header */}
                <div className="ap-card-header">
                  <div className="ap-card-meta">
                    <span className="ap-resident-code">{c.residentCode ?? `#${c.residentId}`}</span>
                    <span className={`ap-status-badge ap-status--${c.status.toLowerCase()}`}>{c.status}</span>
                    <span className={`ap-facility-badge${c.residentInFacility ? '' : ' ap-facility-badge--not'}`}>
                      {c.residentInFacility ? 'In facility' : 'Not yet admitted'}
                    </span>
                  </div>
                  <div className="ap-card-dates">
                    <span>Submitted {formatDate(c.submittedAt)}</span>
                    {c.reviewedAt && <span>· Reviewed {formatDate(c.reviewedAt)}</span>}
                  </div>
                </div>

                <p className="ap-sw-email">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  {c.socialWorkerEmail ?? '—'}
                </p>

                {/* Checked items */}
                <div className="ap-items-section">
                  <p className="ap-items-label">
                    {c.residentInFacility ? 'Facility intake checklist' : 'Legal documents checklist'}
                    <span className="ap-items-count">{items.length} item{items.length !== 1 ? 's' : ''} confirmed</span>
                  </p>
                  <ul className="ap-items-list">
                    {items.map((item) => (
                      <li key={item} className="ap-item">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-success)', flexShrink: 0 }}>
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Admin notes (already reviewed) */}
                {!isPending && c.adminNotes && (
                  <div className="ap-reviewed-notes">
                    <span className="ap-reviewed-by">Note from {c.reviewedBy ?? 'admin'}:</span> {c.adminNotes}
                  </div>
                )}

                {/* Actions (pending only) */}
                {isPending && (
                  <div className="ap-actions">
                    <input
                      type="text"
                      className="ap-notes-input"
                      placeholder="Optional note for the social worker…"
                      value={notes[c.checklistId] ?? ''}
                      onChange={(e) => setNotes((p) => ({ ...p, [c.checklistId]: e.target.value }))}
                      disabled={acting[c.checklistId]}
                    />
                    <div className="ap-action-btns">
                      <button
                        type="button"
                        className="ap-btn ap-btn--reject"
                        disabled={acting[c.checklistId]}
                        onClick={() => handleReject(c.checklistId)}
                      >
                        {acting[c.checklistId] ? '…' : 'Reject'}
                      </button>
                      <button
                        type="button"
                        className="ap-btn ap-btn--approve"
                        disabled={acting[c.checklistId]}
                        onClick={() => handleApprove(c.checklistId)}
                      >
                        {acting[c.checklistId] ? '…' : 'Approve'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      </>}

      {/* ── Conference Requests Section ── */}
      {section === 'conferences' && <>
        <div className="ap-tabs">
          {(['Pending', 'Approved', 'Rejected', 'All'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`ap-tab${confFilter === f ? ' ap-tab--active' : ''}`}
              onClick={() => setConfFilter(f)}
            >
              {f}
              <span className="ap-tab-count">{confCounts[f]}</span>
            </button>
          ))}
        </div>

        {confLoading ? (
          <p className="ap-empty">Loading…</p>
        ) : confFiltered.length === 0 ? (
          <div className="ap-empty-state">
            <p>No {confFilter === 'All' ? '' : confFilter.toLowerCase() + ' '}conference requests.</p>
          </div>
        ) : (
          <div className="ap-list">
            {confFiltered.map((r) => {
              const isPending = r.status === 'Pending'
              const isCounter = r.status === 'Counter-Proposed'
              const residentIds = parseResidentIds(r.residentIds)
              const agenda = parseAgenda(r.agenda)
              const showCounterForm = counterForm?.id === r.requestId
              return (
                <div key={r.requestId} className={`ap-card ap-card--${r.status === 'Accepted' ? 'approved' : r.status.toLowerCase().replace('-', '')}`}>
                  <div className="ap-card-header">
                    <div className="ap-card-meta">
                      <span className="ap-resident-code">Conference</span>
                      <span className={`ap-status-badge ap-status--${r.status === 'Accepted' ? 'approved' : r.status === 'Counter-Proposed' ? 'pending' : r.status.toLowerCase()}`}>
                        {r.status}
                      </span>
                    </div>
                    <div className="ap-card-dates">
                      <span>Submitted {formatDate(r.submittedAt)}</span>
                      {r.reviewedAt && <span> · Reviewed {formatDate(r.reviewedAt)}</span>}
                    </div>
                  </div>

                  <p className="ap-sw-email">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    {r.requestedBy ?? '—'}
                  </p>

                  <div className="ap-conf-details">
                    <div className="ap-conf-row">
                      <span className="ap-conf-label">Requested</span>
                      <span>{r.requestedDate ? formatDate(r.requestedDate) : '—'} at {r.requestedTime ?? '—'}</span>
                    </div>
                    {(r.counterDate || r.counterTime) && (
                      <div className="ap-conf-row" style={{ color: 'var(--cove-tidal)', fontWeight: 600 }}>
                        <span className="ap-conf-label">Counter-Proposed</span>
                        <span>{r.counterDate ? formatDate(r.counterDate) : '—'} at {r.counterTime ?? '—'}</span>
                      </div>
                    )}
                    <div className="ap-conf-row">
                      <span className="ap-conf-label">Residents</span>
                      <span>{residentIds.length} resident{residentIds.length !== 1 ? 's' : ''}: {residentIds.map((id) => `#${id}`).join(', ')}</span>
                    </div>
                  </div>

                  {agenda.length > 0 && (
                    <div className="ap-items-section">
                      <p className="ap-items-label">Agenda</p>
                      <ul className="ap-items-list">
                        {agenda.map((a, i) => (
                          <li key={`${a.residentId}-${i}`} className="ap-item">
                            <strong>#{a.residentId}:</strong> {a.notes || '—'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!isPending && !isCounter && r.adminNotes && (
                    <div className="ap-reviewed-notes">
                      <span className="ap-reviewed-by">Note from {r.reviewedBy ?? 'admin'}:</span> {r.adminNotes}
                    </div>
                  )}

                  {(isPending || isCounter) && (
                    <div className="ap-actions">
                      <input
                        type="text"
                        className="ap-notes-input"
                        placeholder="Optional note…"
                        value={confNotes[r.requestId] ?? ''}
                        onChange={(e) => setConfNotes((p) => ({ ...p, [r.requestId]: e.target.value }))}
                        disabled={confActing[r.requestId]}
                      />

                      {showCounterForm && (
                        <div className="ap-counter-form">
                          <label className="ap-counter-field">
                            <span>Alternative Date</span>
                            <input
                              type="date"
                              value={counterForm.date}
                              onChange={(e) => setCounterForm((f) => f ? { ...f, date: e.target.value } : f)}
                            />
                          </label>
                          <label className="ap-counter-field">
                            <span>Alternative Time</span>
                            <select
                              value={counterForm.time}
                              onChange={(e) => setCounterForm((f) => f ? { ...f, time: e.target.value } : f)}
                            >
                              <option value="">Select…</option>
                              {['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'].map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      )}

                      <div className="ap-action-btns">
                        <button
                          type="button"
                          className="ap-btn ap-btn--reject"
                          disabled={confActing[r.requestId]}
                          onClick={() => handleConfReject(r.requestId)}
                        >
                          {confActing[r.requestId] ? '…' : 'Reject'}
                        </button>
                        {!showCounterForm ? (
                          <button
                            type="button"
                            className="ap-btn ap-btn--counter"
                            disabled={confActing[r.requestId]}
                            onClick={() => setCounterForm({ id: r.requestId, date: '', time: '' })}
                          >
                            Counter-Propose
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ap-btn ap-btn--counter"
                            disabled={confActing[r.requestId] || !counterForm.date || !counterForm.time}
                            onClick={() => handleCounterPropose(r.requestId)}
                          >
                            {confActing[r.requestId] ? '…' : 'Send Counter'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="ap-btn ap-btn--approve"
                          disabled={confActing[r.requestId]}
                          onClick={() => handleConfApprove(r.requestId)}
                        >
                          {confActing[r.requestId] ? '…' : 'Approve'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </>}
    </div>
  )
}
