import { useState, useEffect } from 'react'
import { api } from '../../services/apiService'
import type { AdmissionChecklist } from '../../services/apiService'
import './ApprovalsPage.css'

type Filter = 'Pending' | 'Approved' | 'Rejected' | 'All'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function parseItems(json: string): string[] {
  try { return JSON.parse(json) } catch { return [] }
}

export default function ApprovalsPage() {
  const [checklists, setChecklists] = useState<AdmissionChecklist[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState<Filter>('Pending')
  const [notes, setNotes]           = useState<Record<number, string>>({})
  const [acting, setActing]         = useState<Record<number, boolean>>({})
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    api.getAdmissionChecklists()
      .then(setChecklists)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
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

  return (
    <div className="ap-page">
      <div className="ap-header">
        <div>
          <h1 className="ap-title">Admission Approvals</h1>
          <p className="ap-sub">Review and act on checklist submissions from social workers.</p>
        </div>
      </div>

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
    </div>
  )
}
