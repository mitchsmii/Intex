import { useState, useEffect } from 'react'
import { api } from '../../../services/apiService'
import type { Resident, Safehouse } from '../../../services/apiService'
import '../ManageUsersPage.css'

export default function ResidentsManagePage() {
  const [residents,  setResidents]  = useState<Resident[]>([])
  const [safehouses, setSafehouses] = useState<Safehouse[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('active')

  useEffect(() => {
    Promise.allSettled([
      api.getResidents().then(setResidents),
      api.getSafehouses().then(setSafehouses),
    ]).finally(() => setLoading(false))
  }, [])

  const shName = (id: number | null) => {
    if (!id) return '—'
    const sh = safehouses.find(s => s.safehouseId === id)
    return sh ? (sh.safehouseCode ?? sh.name ?? `SH${id}`) : `SH${id}`
  }

  function age(dob: string | null) {
    if (!dob) return '—'
    const diff = Date.now() - new Date(dob).getTime()
    return String(Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)))
  }

  const displayed = residents.filter(r => {
    const isActive = !r.dateClosed
    if (statusFilter === 'active' && !isActive) return false
    if (statusFilter === 'closed' && isActive) return false
    if (search) {
      const q = search.toLowerCase()
      return (r.internalCode ?? '').toLowerCase().includes(q) ||
        (r.caseControlNo ?? '').toLowerCase().includes(q) ||
        (r.assignedSocialWorker ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const active   = residents.filter(r => !r.dateClosed).length
  const closed   = residents.filter(r => r.dateClosed).length
  const highRisk = residents.filter(r => (r.currentRiskLevel === 'High' || r.currentRiskLevel === 'Critical') && !r.dateClosed).length
  const reint    = residents.filter(r => r.reintegrationStatus === 'Reintegrated' || r.reintegrationStatus === 'Completed').length

  const riskClass = (lvl: string | null) => {
    if (lvl === 'High' || lvl === 'Critical') return 'mu-badge-warn'
    if (lvl === 'Medium') return 'mu-badge-med'
    return 'mu-badge-ok'
  }

  return (
    <div className="mu-page">
      <div className="mu-header">
        <div>
          <h1 className="mu-title">Residents</h1>
          <p className="mu-subtitle">{active} active · {closed} closed cases · {reint} reintegrated</p>
        </div>
        <div className="mu-header-actions">
          <select className="mu-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="active">Active Only</option>
            <option value="closed">Closed Only</option>
            <option value="all">All Residents</option>
          </select>
          <input
            className="mu-search"
            type="search"
            placeholder="Search by code or worker…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="mu-kpi-row">
        {[
          { label: 'Active Residents', value: String(active) },
          { label: 'High / Critical Risk', value: String(highRisk), warn: highRisk > 0 },
          { label: 'Reintegrated', value: String(reint) },
          { label: 'Total on Record', value: String(residents.length) },
        ].map(k => (
          <div key={k.label} className={`mu-kpi${k.warn ? ' mu-kpi-warn' : ''}`}>
            <div className="mu-kpi-value">{k.value}</div>
            <div className="mu-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="mu-empty">Loading…</p>
      ) : (
        <div className="mu-card">
          <table className="mu-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Case No.</th>
                <th>Age</th>
                <th>Safehouse</th>
                <th>Social Worker</th>
                <th>Risk Level</th>
                <th>Reintegration</th>
                <th>Status</th>
                <th>Admitted</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && (
                <tr><td colSpan={9} className="mu-empty-cell">No residents found.</td></tr>
              )}
              {displayed.map(r => (
                <tr key={r.residentId}>
                  <td className="mu-td-name">{r.internalCode ?? `R-${r.residentId}`}</td>
                  <td className="mu-muted">{r.caseControlNo ?? '—'}</td>
                  <td>{age(r.dateOfBirth)}</td>
                  <td>{shName(r.safehouseId)}</td>
                  <td>{r.assignedSocialWorker ?? '—'}</td>
                  <td>
                    <span className={`mu-badge ${riskClass(r.currentRiskLevel)}`}>
                      {r.currentRiskLevel ?? '—'}
                    </span>
                  </td>
                  <td>{r.reintegrationStatus ?? '—'}</td>
                  <td>
                    <span className={`mu-badge ${r.dateClosed ? 'mu-badge-off' : 'mu-badge-ok'}`}>
                      {r.dateClosed ? 'Closed' : 'Active'}
                    </span>
                  </td>
                  <td>{r.dateOfAdmission ? new Date(r.dateOfAdmission).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
