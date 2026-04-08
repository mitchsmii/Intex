import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../services/apiService'
import type { Resident, Safehouse } from '../../../services/apiService'
import AddResidentWizard from './AddResidentWizard'
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
  const [kpiFilter,    setKpiFilter]    = useState<string | null>(null)
  const [sortCol,      setSortCol]      = useState<SortKey>('code')
  const [sortDir,      setSortDir]      = useState<Dir>('asc')
  const [showWizard,   setShowWizard]   = useState(false)

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

  function ageDisplay(r: Resident): string {
    if (r.dateOfBirth) {
      const years = Math.floor((Date.now() - new Date(r.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
      if (years >= 0) return String(years)
    }
    if (r.ageUponAdmission) return r.ageUponAdmission
    return '—'
  }

  function ageNum(r: Resident): number {
    if (r.dateOfBirth) {
      const years = Math.floor((Date.now() - new Date(r.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
      if (years >= 0) return years
    }
    return r.ageUponAdmission ? Number(r.ageUponAdmission) : -1
  }

  function toggleSort(col: SortKey) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const isArchived = (r: Resident) => r.caseStatus === 'Archived'
  const isActive   = (r: Resident) => !r.dateClosed && !isArchived(r)
  const isClosed   = (r: Resident) => !!r.dateClosed && !isArchived(r)

  const displayed = residents
    .filter(r => {
      if (statusFilter === 'active'   && !isActive(r))   return false
      if (statusFilter === 'closed'   && !isClosed(r))   return false
      if (statusFilter === 'archived' && !isArchived(r)) return false
      if (kpiFilter === 'active'   && !isActive(r))   return false
      if (kpiFilter === 'risk'     && r.currentRiskLevel !== 'High' && r.currentRiskLevel !== 'Critical') return false
      if (kpiFilter === 'reint'    && r.reintegrationStatus !== 'Reintegrated' && r.reintegrationStatus !== 'Completed') return false
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
      if (sortCol === 'code')      cmp = (a.internalCode ?? '').localeCompare(b.internalCode ?? '')
      else if (sortCol === 'caseNo')    cmp = (a.caseControlNo ?? '').localeCompare(b.caseControlNo ?? '')
      else if (sortCol === 'age')       cmp = ageNum(a) - ageNum(b)
      else if (sortCol === 'safehouse') cmp = shName(a.safehouseId ?? null).localeCompare(shName(b.safehouseId ?? null))
      else if (sortCol === 'worker')    cmp = (a.assignedSocialWorker ?? '').localeCompare(b.assignedSocialWorker ?? '')
      else if (sortCol === 'risk')      cmp = (RISK_ORDER[a.currentRiskLevel ?? ''] ?? -1) - (RISK_ORDER[b.currentRiskLevel ?? ''] ?? -1)
      else if (sortCol === 'reint')     cmp = (a.reintegrationStatus ?? '').localeCompare(b.reintegrationStatus ?? '')
      else if (sortCol === 'status')    cmp = (a.dateClosed ? 1 : 0) - (b.dateClosed ? 1 : 0)
      else if (sortCol === 'admitted')  cmp = (a.dateOfAdmission ?? '').localeCompare(b.dateOfAdmission ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })

  const activeCount   = residents.filter(isActive).length
  const closedCount   = residents.filter(isClosed).length
  const archivedCount = residents.filter(isArchived).length
  const highRisk      = residents.filter(r => (r.currentRiskLevel === 'High' || r.currentRiskLevel === 'Critical') && isActive(r)).length
  const reint         = residents.filter(r => r.reintegrationStatus === 'Reintegrated' || r.reintegrationStatus === 'Completed').length

  const riskClass = (lvl: string | null) => {
    if (lvl === 'High' || lvl === 'Critical') return 'mu-badge-warn'
    if (lvl === 'Medium') return 'mu-badge-med'
    return 'mu-badge-ok'
  }

  const statusLabel = (r: Resident) => {
    if (isArchived(r)) return 'Archived'
    if (r.dateClosed)  return 'Closed'
    return 'Active'
  }

  const statusBadgeClass = (r: Resident) => {
    if (isArchived(r)) return 'mu-badge-archived'
    if (r.dateClosed)  return 'mu-badge-off'
    return 'mu-badge-ok'
  }

  return (
    <div className="mu-page">
      <div className="mu-header">
        <div>
          <h1 className="mu-title">Residents</h1>
          <p className="mu-subtitle">
            {activeCount} active · {closedCount} closed · {reint} reintegrated
            {archivedCount > 0 && ` · ${archivedCount} archived`}
          </p>
        </div>
        <div className="mu-header-actions">
          <select className="mu-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="active">Active Only</option>
            <option value="closed">Closed Only</option>
            <option value="archived">Archived</option>
            <option value="all">All Residents</option>
          </select>
          <input className="mu-search" type="search" placeholder="Search by code or worker…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="mu-kpi-row">
        {([
          { label: 'Active Residents',     value: String(activeCount), key: 'active' },
          { label: 'High / Critical Risk', value: String(highRisk),    key: 'risk',  warn: highRisk > 0 },
          { label: 'Reintegrated',         value: String(reint),       key: 'reint' },
          { label: 'Total on Record',      value: String(residents.length), key: 'total' },
        ] as { label: string; value: string; key: string; warn?: boolean }[]).map(k => (
          <div
            key={k.label}
            className={`mu-kpi mu-kpi-clickable${k.warn ? ' mu-kpi-warn' : ''}${kpiFilter === k.key ? ' mu-kpi-active' : ''}`}
            onClick={() => setKpiFilter(f => f === k.key ? null : k.key)}
          >
            <div className="mu-kpi-value">{k.value}</div>
            <div className="mu-kpi-label">{k.label}</div>
          </div>
        ))}
        <div className="mu-kpi mu-kpi-add-card" onClick={() => setShowWizard(true)}>
          <div className="mu-kpi-add-icon">+</div>
          <div className="mu-kpi-label">Add Resident</div>
        </div>
      </div>

      {showWizard && (
        <AddResidentWizard
          safehouses={safehouses}
          residents={residents}
          onClose={() => setShowWizard(false)}
          onCreated={(r) => {
            setResidents(prev => [r, ...prev])
            setShowWizard(false)
          }}
        />
      )}

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
              {displayed.map(r => (
                <tr key={r.residentId}>
                  <td>
                    <Link className="mu-td-link" to={`/admin/residents/${r.residentId}`}>
                      {r.internalCode ?? `R-${r.residentId}`}
                    </Link>
                  </td>
                  <td className="mu-muted">{r.caseControlNo ?? '—'}</td>
                  <td>{ageDisplay(r)}</td>
                  <td>{shName(r.safehouseId ?? null)}</td>
                  <td>{r.assignedSocialWorker ?? '—'}</td>
                  <td><span className={`mu-badge ${riskClass(r.currentRiskLevel)}`}>{r.currentRiskLevel ?? '—'}</span></td>
                  <td>{r.reintegrationStatus ?? '—'}</td>
                  <td><span className={`mu-badge ${statusBadgeClass(r)}`}>{statusLabel(r)}</span></td>
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
