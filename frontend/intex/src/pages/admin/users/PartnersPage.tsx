import { useState, useEffect } from 'react'
import { api } from '../../../services/apiService'
import type { Partner } from '../../../services/apiService'
import '../ManageUsersPage.css'

type SortKey = 'name' | 'type' | 'role' | 'region' | 'status' | 'startDate'
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

export default function PartnersPage() {
  const [partners,    setPartners]    = useState<Partner[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [typeFilter,  setTypeFilter]  = useState('')
  const [roleFilter,  setRoleFilter]  = useState('')
  const [kpiFilter,   setKpiFilter]   = useState<string | null>(null)
  const [sortCol,     setSortCol]     = useState<SortKey>('name')
  const [sortDir,     setSortDir]     = useState<Dir>('asc')
  const [valueFilter, setValueFilter] = useState('')

  useEffect(() => { setValueFilter('') }, [sortCol])

  useEffect(() => {
    api.getPartners()
      .then(setPartners)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function toggleSort(col: SortKey) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const types = [...new Set(partners.map(p => p.partnerType).filter(Boolean))].sort() as string[]
  const roles = [...new Set(partners.map(p => p.roleType).filter(Boolean))].sort() as string[]

  const pinValue = (p: Partner): string => {
    if (sortCol === 'type')   return p.partnerType ?? ''
    if (sortCol === 'role')   return p.roleType ?? ''
    if (sortCol === 'status') return p.status ?? ''
    if (sortCol === 'region') return p.region ?? ''
    return ''
  }

  const discreteOptions: string[] = (() => {
    if (sortCol === 'type')   return types
    if (sortCol === 'role')   return roles
    if (sortCol === 'status') return [...new Set(partners.map(p => p.status).filter(Boolean))].sort() as string[]
    if (sortCol === 'region') return [...new Set(partners.map(p => p.region).filter(Boolean))].sort() as string[]
    return []
  })()

  const filtered = partners
    .filter(p => {
      if (kpiFilter === 'active'   && p.status !== 'Active')   return false
      if (kpiFilter === 'inactive' && p.status !== 'Inactive') return false
      if (valueFilter && pinValue(p) !== valueFilter) return false
      const q = search.toLowerCase()
      const matchSearch = !q ||
        (p.partnerName ?? '').toLowerCase().includes(q) ||
        (p.contactName ?? '').toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q) ||
        (p.roleType ?? '').toLowerCase().includes(q)
      const matchType = !typeFilter || p.partnerType === typeFilter
      const matchRole = !roleFilter || p.roleType === roleFilter
      return matchSearch && matchType && matchRole
    })
    .sort((a, b) => {
      let va = '', vb = ''
      if      (sortCol === 'name')      { va = a.partnerName ?? ''; vb = b.partnerName ?? '' }
      else if (sortCol === 'type')      { va = a.partnerType ?? ''; vb = b.partnerType ?? '' }
      else if (sortCol === 'role')      { va = a.roleType ?? ''; vb = b.roleType ?? '' }
      else if (sortCol === 'region')    { va = a.region ?? ''; vb = b.region ?? '' }
      else if (sortCol === 'status')    { va = a.status ?? ''; vb = b.status ?? '' }
      else if (sortCol === 'startDate') { va = a.startDate ?? ''; vb = b.startDate ?? '' }
      const cmp = va.localeCompare(vb)
      return sortDir === 'asc' ? cmp : -cmp
    })

  return (
    <div className="mu-page">
      <div className="mu-header">
        <div>
          <h1 className="mu-title">Partners</h1>
          <p className="mu-subtitle">{partners.length} partners on record</p>
        </div>
        <div className="mu-header-actions">
          <select className="mu-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="mu-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">All Roles</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input className="mu-search" type="search" placeholder="Search partners…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="mu-kpi-row">
        {([
          { label: 'Total Partners', num: partners.length,                                        den: null,            key: null },
          { label: 'Active',         num: partners.filter(p => p.status === 'Active').length,     den: partners.length, key: 'active' },
          { label: 'Inactive',       num: partners.filter(p => p.status === 'Inactive').length,   den: partners.length, key: 'inactive' },
          { label: 'Unique Roles',   num: roles.length,                                           den: null,            key: null },
        ] as { label: string; num: number; den: number | null; key: string | null }[]).map(k => (
          <div
            key={k.label}
            className={`mu-kpi${k.key ? ' mu-kpi-clickable' : ''}${kpiFilter === k.key && k.key ? ' mu-kpi-active' : ''}`}
            onClick={k.key ? () => setKpiFilter(f => f === k.key ? null : k.key) : undefined}
          >
            <div className="mu-kpi-value">
              {k.num}{k.den != null && <span className="mu-kpi-denom">/{k.den}</span>}
            </div>
            <div className="mu-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {!loading && (
        <div className="mu-sort-bar">
          <span className="mu-sort-bar-label">Sort by</span>
          <select className="mu-sort-select" value={sortCol} onChange={e => setSortCol(e.target.value as SortKey)}>
            <option value="name">Name</option>
            <option value="type">Type</option>
            <option value="role">Role</option>
            <option value="region">Region</option>
            <option value="status">Status</option>
            <option value="startDate">Start Date</option>
          </select>
          <button className="mu-sort-dir-btn" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
            {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
          </button>
          {discreteOptions.length > 0 && (
            <select className="mu-sort-value-select" value={valueFilter} onChange={e => setValueFilter(e.target.value)}>
              <option value="">All values</option>
              {discreteOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
        </div>
      )}

      {loading ? <p className="mu-empty">Loading…</p> : (
        <div className="mu-card">
          <table className="mu-table">
            <thead>
              <tr>
                <th>ID</th>
                <SortTh label="Name"       col="name"      sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Type"       col="type"      sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Role"       col="role"      sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <th>Contact</th>
                <SortTh label="Region"     col="region"    sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Status"     col="status"    sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Start Date" col="startDate" sort={sortCol} dir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="mu-empty-cell">No partners found.</td></tr>
              )}
              {filtered.map(p => (
                <tr key={p.partnerId}>
                  <td className="mu-muted" style={{ fontSize: '0.8rem' }}>#{p.partnerId}</td>
                  <td className="mu-td-name">{p.partnerName ?? '—'}</td>
                  <td><span className="mu-badge mu-badge-type">{p.partnerType ?? '—'}</span></td>
                  <td><span className="mu-badge mu-badge-role">{p.roleType ?? '—'}</span></td>
                  <td>
                    {p.email && <div className="mu-contact-line">{p.email}</div>}
                    {p.phone && <div className="mu-contact-line mu-muted">{p.phone}</div>}
                    {!p.email && !p.phone && '—'}
                  </td>
                  <td>{p.region ?? '—'}</td>
                  <td><span className={`mu-badge ${p.status === 'Active' ? 'mu-badge-ok' : 'mu-badge-off'}`}>{p.status ?? '—'}</span></td>
                  <td>{p.startDate ? new Date(p.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
