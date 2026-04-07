import { useState, useEffect } from 'react'
import { api } from '../../../services/apiService'
import type { SocialWorker, Safehouse } from '../../../services/apiService'
import '../ManageUsersPage.css'

export default function SocialWorkersPage() {
  const [workers,    setWorkers]    = useState<SocialWorker[]>([])
  const [safehouses, setSafehouses] = useState<Safehouse[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')

  useEffect(() => {
    Promise.allSettled([
      api.getSocialWorkers().then(setWorkers),
      api.getSafehouses().then(setSafehouses),
    ]).finally(() => setLoading(false))
  }, [])

  const shName = (id: number | null) => {
    if (!id) return '—'
    const sh = safehouses.find(s => s.safehouseId === id)
    return sh ? (sh.safehouseCode ?? sh.name ?? `SH${id}`) : `SH${id}`
  }

  const filtered = workers.filter(w =>
    !search || w.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (w.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

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
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Safehouse</th>
                <th>Status</th>
                <th>Since</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="mu-empty-cell">No social workers found.</td></tr>
              )}
              {filtered.map(w => (
                <tr key={w.socialWorkerId}>
                  <td className="mu-td-name">{w.fullName}</td>
                  <td>{w.email ?? '—'}</td>
                  <td>{w.phone ?? '—'}</td>
                  <td>{shName(w.safehouseId)}</td>
                  <td>
                    <span className={`mu-badge ${w.status === 'Active' ? 'mu-badge-ok' : 'mu-badge-off'}`}>
                      {w.status}
                    </span>
                  </td>
                  <td>{new Date(w.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
