import { useState, useEffect } from 'react'
import { api } from '../../../services/apiService'
import type { Resident, Safehouse } from '../../../services/apiService'
import '../ManageUsersPage.css'

type SortKey = 'code' | 'caseNo' | 'age' | 'safehouse' | 'worker' | 'risk' | 'reint' | 'status' | 'admitted'
type Dir = 'asc' | 'desc'

function SortTh({ label, col, sort, dir, onSort }: {
  label: string; col: SortKey; sort: SortKey; dir: Dir; onSort: (c: SortKey) => void
}) {
  const active = sort === col
  return (
    <th className={`mu-th-sort${active ? ' mu-th-active' : ''}`} onClick={() => onSort(col)}>
      {label}<span className="mu-sort-icon">{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
    </th>
  )
}

const RISK_ORDER: Record<string, number> = { Low: 0, Medium: 1, High: 2, Critical: 3 }

export default function ResidentsManagePage() {
  const [residents,    setResidents]    = useState<Resident[]>([])
  const [safehouses,   setSafehouses]   = useState<Safehouse[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [sortCol,      setSortCol]      = useState<SortKey>('code')
  const [sortDir,      setSortDir]      = useState<Dir>('asc')

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

  function ageNum(dob: string | null) {
    if (!dob) return -1
    return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
  }

  function toggleSort(col: SortKey) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const displayed = residents
    .filter(r => {
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
    .sort((a, b) => {
      let cmp = 0
      if (sortCol === 'code')     cmp = (a.internalCode ?? '').localeCompare(b.internalCode ?? '')
      else if (sortCol === 'caseNo')   cmp = (a.caseControlNo ?? '').localeCompare(b.caseControlNo ?? '')
      else if (sortCol === 'age')      cmp = ageNum(a.dateOfBirth) - ageNum(b.dateOfBirth)
      else if (sortCol === 'safehouse') cmp = shName(a.safehouseId ?? null).localeCompare(shName(b.safehouseId ?? null))
      else if (sortCol === 'worker')   cmp = (a.assignedSocialWorker ?? '').localeCompare(b.assignedSocialWorker ?? '')
      else if (sortCol === 'risk')     cmp = (RISK_ORDER[a.currentRiskLevel ?? ''] ?? -1) - (RISK_ORDER[b.currentRiskLevel ?? ''] ?? -1)
      else if (sortCol === 'reint')    cmp = (a.reintegrationStatus ?? '').localeCompare(b.reintegrationStatus ?? '')
      else if (sortCol === 'status')   cmp = (a.dateClosed ? 1 : 0) - (b.dateClosed ? 1 : 0)
      else if (sortCol === 'admitted') cmp = (a.dateOfAdmission ?? '').localeCompare(b.dateOfAdmission ?? '')
      return sortDir === 'asc' ? cmp : -cmp
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
          <p className="mu-subtitle">{active} active · {closed} closed · {reint} reintegrated</p>
        </div>
        <div className="mu-header-actions">
          <select className="mu-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="active">Active Only</option>
            <option value="closed">Closed Only</option>
            <option value="all">All Residents</option>
          </select>
          <input className="mu-search" type="search" placeholder="Search by code or worker…"
            value={search} onChange={e => setSearch(e.target.value)} />
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

      {loading ? <p className="mu-empty">Loading…</p> : (
        <div className="mu-card">
          <table className="mu-table">
            <thead>
              <tr>
                <SortTh label="Code"          col="code"      sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Case No."      col="caseNo"    sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Age"           col="age"       sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Safehouse"     col="safehouse" sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Social Worker" col="worker"    sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Risk Level"    col="risk"      sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Reintegration" col="reint"     sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Status"        col="status"    sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Admitted"      col="admitted"  sort={sortCol} dir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && (
                <tr><td colSpan={9} className="mu-empty-cell">No residents found.</td></tr>
              )}
              {displayed.map(r => {
                const a = ageNum(r.dateOfBirth)
                return (
                  <tr key={r.residentId}>
                    <td className="mu-td-name">{r.internalCode ?? `R-${r.residentId}`}</td>
                    <td className="mu-muted">{r.caseControlNo ?? '—'}</td>
                    <td>{a >= 0 ? String(a) : '—'}</td>
                    <td>{shName(r.safehouseId ?? null)}</td>
                    <td>{r.assignedSocialWorker ?? '—'}</td>
                    <td><span className={`mu-badge ${riskClass(r.currentRiskLevel)}`}>{r.currentRiskLevel ?? '—'}</span></td>
                    <td>{r.reintegrationStatus ?? '—'}</td>
                    <td><span className={`mu-badge ${r.dateClosed ? 'mu-badge-off' : 'mu-badge-ok'}`}>{r.dateClosed ? 'Closed' : 'Active'}</span></td>
                    <td>{r.dateOfAdmission ? new Date(r.dateOfAdmission).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
