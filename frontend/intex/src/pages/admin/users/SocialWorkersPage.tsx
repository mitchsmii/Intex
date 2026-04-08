import { useState, useEffect } from 'react'
import { api } from '../../../services/apiService'
import type { SocialWorker, Safehouse, Resident } from '../../../services/apiService'
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

function AddSocialWorkerModal({
  safehouses,
  onClose,
  onSave,
}: {
  safehouses: Safehouse[]
  onClose: () => void
  onSave: (w: SocialWorker) => void
}) {
  const [fullName,    setFullName]    = useState('')
  const [email,       setEmail]       = useState('')
  const [phone,       setPhone]       = useState('')
  const [safehouseId, setSafehouseId] = useState<number | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  async function handleSubmit() {
    if (!fullName.trim()) { setError('Name is required.'); return }
    setSaving(true)
    setError('')
    try {
      const created = await api.createSocialWorker({
        fullName: fullName.trim(),
        email:    email.trim() || undefined,
        phone:    phone.trim() || undefined,
        safehouseId: safehouseId ?? undefined,
        status: 'Active',
      })
      onSave(created)
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mu-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mu-modal">
        <h2 className="mu-modal-title">Add Social Worker</h2>

        <div className="mu-form-row">
          <label className="mu-form-label">Full Name *</label>
          <input className="mu-form-input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Maria Santos" />
        </div>
        <div className="mu-form-row">
          <label className="mu-form-label">Email</label>
          <input className="mu-form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
        </div>
        <div className="mu-form-row">
          <label className="mu-form-label">Phone</label>
          <input className="mu-form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+63 9XX XXX XXXX" />
        </div>
        <div className="mu-form-row">
          <label className="mu-form-label">Safehouse Assignment</label>
          <select className="mu-form-input mu-select" value={safehouseId ?? ''} onChange={e => setSafehouseId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">— Unassigned —</option>
            {safehouses.map(s => (
              <option key={s.safehouseId} value={s.safehouseId}>
                {s.safehouseCode ?? s.name ?? `SH${s.safehouseId}`}
              </option>
            ))}
          </select>
        </div>

        {error && <p style={{ color: 'var(--color-error)', fontSize: '0.82rem', margin: 0 }}>{error}</p>}

        <div className="mu-modal-actions">
          <button className="mu-btn mu-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="mu-btn mu-btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Add Social Worker'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SocialWorkersPage() {
  const [workers,    setWorkers]    = useState<SocialWorker[]>([])
  const [safehouses, setSafehouses] = useState<Safehouse[]>([])
  const [residents,  setResidents]  = useState<Resident[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [kpiFilter,  setKpiFilter]  = useState<string | null>(null)
  const [sortCol,    setSortCol]    = useState<SortKey>('fullName')
  const [sortDir,    setSortDir]    = useState<Dir>('asc')
  const [valueFilter, setValueFilter] = useState('')
  const [showAdd,    setShowAdd]    = useState(false)

  useEffect(() => { setValueFilter('') }, [sortCol])

  useEffect(() => {
    Promise.allSettled([
      api.getResidents(),
      api.getSafehouses(),
      api.getSocialWorkers(),
    ]).then(([resResult, shResult, swResult]) => {
      const residentList = resResult.status  === 'fulfilled' ? resResult.value  as Resident[]    : []
      const shList       = shResult.status   === 'fulfilled' ? shResult.value   as Safehouse[]   : []
      const swTable      = swResult.status   === 'fulfilled' ? swResult.value   as SocialWorker[] : []

      setSafehouses(shList)
      setResidents(residentList)

      if (swTable.length > 0) {
        setWorkers(swTable)
      } else {
        const names = [...new Set(
          residentList
            .map((r: Resident) => r.assignedSocialWorker)
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
      }
    }).finally(() => setLoading(false))
  }, [])

  const shName = (id: number | null) => {
    if (!id) return '—'
    const sh = safehouses.find(s => s.safehouseId === id)
    return sh ? (sh.safehouseCode ?? sh.name ?? `SH${id}`) : `SH${id}`
  }

  const assignedResidents = (w: SocialWorker) =>
    residents.filter(r => r.assignedSocialWorker === w.fullName)

  function toggleSort(col: SortKey) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const pinValue = (w: SocialWorker): string => {
    if (sortCol === 'status')    return w.status
    if (sortCol === 'safehouse') return shName(w.safehouseId ?? null)
    return ''
  }

  const discreteOptions: string[] = (() => {
    if (sortCol === 'status')    return [...new Set(workers.map(w => w.status).filter(Boolean))].sort()
    if (sortCol === 'safehouse') return [...new Set(workers.map(w => shName(w.safehouseId ?? null)).filter(v => v !== '—'))].sort()
    return []
  })()

  const filtered = workers
    .filter(w => {
      if (kpiFilter === 'active'   && w.status !== 'Active') return false
      if (kpiFilter === 'assigned' && !w.safehouseId)        return false
      if (valueFilter && pinValue(w) !== valueFilter) return false
      return !search || w.fullName.toLowerCase().includes(search.toLowerCase()) ||
        (w.email ?? '').toLowerCase().includes(search.toLowerCase())
    })
    .sort((a, b) => {
      let va = '', vb = ''
      if (sortCol === 'fullName')    { va = a.fullName; vb = b.fullName }
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
      {showAdd && (
        <AddSocialWorkerModal
          safehouses={safehouses}
          onClose={() => setShowAdd(false)}
          onSave={w => { setWorkers(prev => [...prev, w]); setShowAdd(false) }}
        />
      )}

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
        {([
          { label: 'Total Social Workers',   num: workers.length,                                                               den: null,              key: null },
          { label: 'Active',                 num: active,                                                                        den: workers.length,    key: 'active' },
          { label: 'Assigned to Safehouses', num: workers.filter(w => w.safehouseId).length,                                    den: workers.length,    key: 'assigned' },
          { label: 'Safehouses with Staff',  num: new Set(workers.filter(w => w.safehouseId).map(w => w.safehouseId)).size,     den: safehouses.length, key: null },
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
        <button className="mu-kpi-add-card" onClick={() => setShowAdd(true)}>
          <div className="mu-kpi-add-icon">+</div>
          <div className="mu-kpi-label">Add Social Worker</div>
        </button>
      </div>

      {!loading && (
        <div className="mu-sort-bar">
          <span className="mu-sort-bar-label">Sort by</span>
          <select className="mu-sort-select" value={sortCol} onChange={e => setSortCol(e.target.value as SortKey)}>
            <option value="fullName">Name</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="safehouse">Safehouse</option>
            <option value="status">Status</option>
            <option value="createdAt">Since</option>
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
                <th>Residents</th>
                <SortTh label="Since"      col="createdAt" sort={sortCol} dir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="mu-empty-cell">No social workers found.</td></tr>
              )}
              {filtered.map((w, i) => {
                const res = assignedResidents(w)
                return (
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
                    <td>
                      {res.length === 0 ? (
                        <span className="mu-muted">—</span>
                      ) : (
                        <div className="mu-resident-chips">
                          {res.slice(0, 3).map(r => (
                            <span key={r.residentId} className="mu-chip">
                              {r.internalCode ?? `R-${r.residentId}`}
                            </span>
                          ))}
                          {res.length > 3 && (
                            <span className="mu-chip mu-chip-more">+{res.length - 3}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>{w.createdAt ? new Date(w.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</td>
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
