import { useState, useEffect } from 'react'
import { api } from '../../../services/apiService'
import type { SocialWorker, Safehouse } from '../../../services/apiService'
import '../ManageUsersPage.css'

type SortKey = 'fullName' | 'email' | 'phone' | 'safehouse' | 'status' | 'createdAt'
type Dir = 'asc' | 'desc'

function SortTh({ label, col, sort, dir, onSort }: {
  label: string; col: SortKey; sort: SortKey; dir: Dir; onSort: (c: SortKey) => void
}) {
  const active = sort === col
  return (
    <th className={`mu-th-sort${active ? ' mu-th-active' : ''}`} onClick={() => onSort(col)}>
      {label}
      <span className="mu-sort-icon">{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
    </th>
  )
}

export default function SocialWorkersPage() {
  const [workers,    setWorkers]    = useState<SocialWorker[]>([])
  const [safehouses, setSafehouses] = useState<Safehouse[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [sortCol,    setSortCol]    = useState<SortKey>('fullName')
  const [sortDir,    setSortDir]    = useState<Dir>('asc')

  useEffect(() => {
    Promise.allSettled([
      api.getSocialWorkers().then(sw => {
        if (sw.length > 0) {
          setWorkers(sw)
        } else {
          // Fallback: derive distinct social worker codes from residents
          api.getResidents().then(residents => {
            const names = [...new Set(
              residents
                .map(r => r.assignedSocialWorker)
                .filter((n): n is string => !!n && n.trim() !== '')
            )].sort()
            const derived: SocialWorker[] = names.map((name, i) => ({
              socialWorkerId: -(i + 1),
              fullName: name,
              firstName: null,
              lastName: null,
              email: null,
              phone: null,
              safehouseId: null,
              status: 'Active',
              createdAt: '',
              updatedAt: '',
            }))
            setWorkers(derived)
          })
        }
      }),
      api.getSafehouses().then(setSafehouses),
    ]).finally(() => setLoading(false))
  }, [])

  const shName = (id: number | null) => {
    if (!id) return '—'
    const sh = safehouses.find(s => s.safehouseId === id)
    return sh ? (sh.safehouseCode ?? sh.name ?? `SH${id}`) : `SH${id}`
  }

  function toggleSort(col: SortKey) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const filtered = workers
    .filter(w =>
      !search || w.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (w.email ?? '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let va = '', vb = ''
      if (sortCol === 'fullName')  { va = a.fullName; vb = b.fullName }
      else if (sortCol === 'email')  { va = a.email ?? ''; vb = b.email ?? '' }
      else if (sortCol === 'phone')  { va = a.phone ?? ''; vb = b.phone ?? '' }
      else if (sortCol === 'safehouse') { va = shName(a.safehouseId ?? null); vb = shName(b.safehouseId ?? null) }
      else if (sortCol === 'status') { va = a.status; vb = b.status }
      else if (sortCol === 'createdAt') { va = a.createdAt; vb = b.createdAt }
      const cmp = va.localeCompare(vb)
      return sortDir === 'asc' ? cmp : -cmp
    })

  const active   = workers.filter(w => w.status === 'Active').length
  const inactive = workers.filter(w => w.status !== 'Active').length

  return (
    <div className="mu-page">
      <div className="mu-header">
        <div>
          <h1 className="mu-title">Social Workers</h1>
          <p className="mu-subtitle">{active} active · {inactive} inactive</p>
        </div>
        <div className="mu-header-actions">
          <input
            className="mu-search"
            type="search"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="mu-kpi-row">
        {[
          { label: 'Total Social Workers', value: String(workers.length) },
          { label: 'Active', value: String(active) },
          { label: 'Assigned to Safehouses', value: String(workers.filter(w => w.safehouseId).length) },
          { label: 'Safehouses with Staff', value: String(new Set(workers.filter(w => w.safehouseId).map(w => w.safehouseId)).size) },
        ].map(k => (
          <div key={k.label} className="mu-kpi">
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
                <SortTh label="Name"       col="fullName"  sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Email"      col="email"     sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Phone"      col="phone"     sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Safehouse"  col="safehouse" sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Status"     col="status"    sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Since"      col="createdAt" sort={sortCol} dir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="mu-empty-cell">No social workers found.</td></tr>
              )}
              {filtered.map((w, i) => (
                <tr key={w.socialWorkerId || i}>
                  <td className="mu-td-name">{w.fullName}</td>
                  <td>{w.email ?? '—'}</td>
                  <td>{w.phone ?? '—'}</td>
                  <td>{shName(w.safehouseId ?? null)}</td>
                  <td>
                    <span className={`mu-badge ${w.status === 'Active' ? 'mu-badge-ok' : 'mu-badge-off'}`}>
                      {w.status}
                    </span>
                  </td>
                  <td>{w.createdAt ? new Date(w.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
