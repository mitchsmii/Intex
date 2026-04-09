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
            const 