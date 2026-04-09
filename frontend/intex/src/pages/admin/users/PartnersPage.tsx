import { useState, useEffect } from 'react'
import { api } from '../../../services/apiService'
import type { Supporter, Donation } from '../../../services/apiService'
import DeleteConfirmModal from '../../../components/common/DeleteConfirmModal'
import '../ManageUsersPage.css'

const PARTNER_TYPES = ['Organization', 'NGO', 'Church', 'Corporate', 'Government', 'Foundation']

function fmtAmt(n: number | null, currency?: string | null) {
  if (n == null || n === 0) return '—'
  const sym = currency === 'USD' ? '$' : '₱'
  return sym + n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

type SortKey = 'name' | 'type' | 'region' | 'status' | 'total' | 'firstDate'
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

function AddPartnerModal({ onClose, onSave }: { onClose: () => void; onSave: (s: Supporter) => void }) {
  const [orgName,  setOrgName]  = useState('')
  const [type,     setType]     = useState('Organization')
  const [email,    setEmail]    = useState('')
  const [phone,    setPhone]    = useState('')
  const [region,   setRegion]   = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit() {
    if (!orgName.trim()) { setError('Organization name is required.'); return }
    setSaving(true); setError('')
    try {
      const created = await api.createSupporter({
        organizationName: orgName.trim(),
        supporterType:    type,
        email:            email.trim() || undefined,
        phone:            phone.trim() || undefined,
        region:           region.trim() || undefined,
        status:           'Active',
      })
      onSave(created)
    } catch { setError('Failed to save. Please try again.') }
    finally   { setSaving(false) }
  }

  return (
    <div className="mu-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mu-modal">
        <h2 className="mu-modal-title">Add Partner / Organization</h2>
        <div className="mu-form-row">
          <label className="mu-form-label">Organization Name *</label>
          <input className="mu-form-input" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. Cebu Foundation Inc." />
        </div>
        <div className="mu-form-row">
          <label className="mu-form-label">Partner Type</label>
          <select className="mu-form-input mu-select" value={type} onChange={e => setType(e.target.value)}>
            {PARTNER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="mu-form-row">
          <label className="mu-form-label">Email</label>
          <input className="mu-form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@org.com" />
        </div>
        <div className="mu-form-row">
          <label className="mu-form-label">Phone</label>
          <input className="mu-form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+63 9XX XXX XXXX" />
        </div>
        <div className="mu-form-row">
          <label className="mu-form-label">Region / Country</label>
          <input className="mu-form-input" value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Cebu, Philippines" />
        </div>
        {error && <p style={{ color: 'var(--color-error)', fontSize: '0.82rem', margin: 0 }}>{error}</p>}
        <div className="mu-modal-actions">
          <button className="mu-btn mu-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="mu-btn mu-btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Add Partner'}</button>
        </div>
      </div>
    </div>
  )
}

export default function PartnersPage() {
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [donations,  setDonations]  = useState<Donation[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [kpiFilter,   setKpiFilter]   = useState<string | null>(null)
  const [sortCol,     setSortCol]     = useState<SortKey>('name')
  const [sortDir,     setSortDir]     = useState<Dir>('asc')
  const [valueFilter, setValueFilter] = useState('')
  const [showAdd,     setShowAdd]     = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Supporter | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { setValueFilter('') }, [sortCol])

  useEffect(() => {
    Promise.allSettled([
      api.getSupporters().then(setSupporters),
      api.getDonations().then(setDonations),
    ]).finally(() => setLoading(false))
  }, [])

  const partners = supporters.filter(s => !!s.organizationName || (!s.firstName && !s.lastName))

  const totalBySupporter = (id: number) =>
    donations.filter(d => d.supporterId === id).reduce((s, d) => s + (d.amount ?? 0), 0)

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteSupporter(deleteTarget.supporterId)
      setSupporters(prev => prev.filter(s => s.supporterId !== deleteTarget.supporterId))
      setDeleteTarget(null)
    } catch { /* ignore */ }
    finally { setDeleting(false) }
  }

  function toggleSort(col: SortKey) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const types = [...new Set(partners.map(p => p.supporterType).filter(Boolean))] as string[]

  const pinValue = (p: Supporter): string => {
    if (sortCol === 'type')   return p.supporterType ?? ''
    if (sortCol === 'status') return p.status ?? ''
    if (sortCol === 'region') return [p.region, p.country].filter(Boolean).join(', ')
    return ''
  }

  const discreteOptions: string[] = (() => {
    if (sortCol === 'type')   return [...new Set(partners.map(p => p.supporterType).filter(Boolean))].sort() as string[]
    if (sortCol === 'status') return [...new Set(partners.map(p => p.status).filter(Boolean))].sort() as string[]
    if (sortCol === 'region') return [...new Set(partners.map(p => [p.region, p.country].filter(Boolean).join(', ')).filter(Boolean))].sort()
    return []
  })()

  const filtered = partners
    .filter(p => {
      if (kpiFilter === 'active'  && p.status !== 'Active') return false
      if (kpiFilter === 'donated' && !donations.some(d => d.supporterId === p.supporterId)) return false
      if (valueFilter && pinValue(p) !== valueFilter) return false
      const matchSearch = !search ||
        (p.displayName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (p.organizationName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (p.email ?? '').toLowerCase().includes(search.toLowerCase())
      const matchType = !typeFilter || (p.supporterType ?? '').includes(typeFilter)
      return matchSearch && matchType
    })
    .sort((a, b) => {
      let va = '', vb = ''
      const nameA = a.organizationName ?? a.displayName ?? `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim()
      const nameB = b.organizationName ?? b.displayName ?? `${b.firstName ?? ''} ${b.lastName ?? ''}`.trim()
      if      (sortCol === 'name')      { va = nameA; vb = nameB }
      else if (sortCol === 'type')      { va = a.supporterType ?? ''; vb = b.supporterType ?? '' }
      else if (sortCol === 'region')    { va = [a.region, a.country].filter(Boolean).join(', '); vb = [b.region, b.country].filter(Boolean).join(', ') }
      else if (sortCol === 'status')    { va = a.status ?? ''; vb = b.status ?? '' }
      else if (sortCol === 'total')     { return sortDir === 'asc' ? totalBySupporter(a.supporterId) - totalBySupporter(b.supporterId) : totalBySupporter(b.supporterId) - totalBySupporter(a.supporterId) }
      else if (sortCol === 'firstDate') { va = a.firstDonationDate ?? ''; vb = b.firstDonationDate ?? '' }
      const cmp = va.localeCompare(vb)
      return sortDir === 'asc' ? cmp : -cmp
    })

  return (
    <div className="mu-page">
      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget ? (deleteTarget.organizationName ?? deleteTarget.displayName ?? `${deleteTarget.firstName ?? ''} ${deleteTarget.lastName ?? ''}`.trim()) : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
      {showAdd && (
        <AddPartnerModal
          onClose={() => setShowAdd(false)}
          onSave={s => { setSupporters(prev => [...prev, s]); setShowAdd(false) }}
        />
      )}

      <div className="mu-header">
        <div>
          <h1 className="mu-title">Partners &amp; Organizations</h1>
          <p className="mu-subtitle">{partners.length} partner organizations on record</p>
        </div>
        <div className="mu-header-actions">
          <select className="mu-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="mu-search" type="search" placeholder="Search partners…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="mu-kpi-row">
        {([
          { label: 'Total Partners',  num: partners.length,                                                                            den: null,             key: null },
          { label: 'Active',          num: partners.filter(p => p.status === 'Active').length,                                         den: partners.length,  key: 'active' },
          { label: 'With Donations',  num: partners.filter(p => donations.some(d => d.supporterId === p.supporterId)).length,          den: partners.length,  key: 'donated' },
          { label: 'Unique Types',    num: types.length,                                                                               den: null,             key: null },
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
          <div className="mu-kpi-label">Add Partner</div>
        </button>
      </div>

      {!loading && (
        <div className="mu-sort-bar">
          <span className="mu-sort-bar-label">Sort by</span>
          <select className="mu-sort-select" value={sortCol} onChange={e => setSortCol(e.target.value as SortKey)}>
            <option value="name">Organization</option>
            <option value="type">Type</option>
            <option value="region">Region</option>
            <option value="status">Status</option>
            <option value="total">Total Contributed</option>
            <option value="firstDate">First Gift</option>
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
                <SortTh label="Organization"      col="name"      sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Type"              col="type"      sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <th>Contact</th>
                <SortTh label="Region / Country"  col="region"    sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Status"            col="status"    sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Total Contributed" col="total"     sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="First Gift"        col="firstDate" sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="mu-empty-cell">No partners found.</td></tr>
              )}
              {filtered.map(p => {
                const ds = donations.filter(d => d.supporterId === p.supporterId)
                const tot = totalBySupporter(p.supporterId)
                return (
                  <tr key={p.supporterId}>
                    <td className="mu-td-name">
                      {p.organizationName ?? p.displayName ?? (`${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || '—')}
                    </td>
                    <td><span className="mu-badge mu-badge-type">{p.supporterType ?? '—'}</span></td>
                    <td>
                      {p.email && <div className="mu-contact-line">{p.email}</div>}
                      {p.phone && <div className="mu-contact-line mu-muted">{p.phone}</div>}
                      {!p.email && !p.phone && '—'}
                    </td>
                    <td>{[p.region, p.country].filter(Boolean).join(', ') || '—'}</td>
                    <td><span className={`mu-badge ${p.status === 'Active' ? 'mu-badge-ok' : 'mu-badge-off'}`}>{p.status ?? '—'}</span></td>
                    <td className="mu-td-num">{ds.length ? fmtAmt(tot, ds[0]?.currencyCode) : '—'}</td>
                    <td>{p.firstDonationDate ? new Date(p.firstDonationDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</td>
                    <td>
                      <button
                        className="mu-btn mu-btn-danger"
                        onClick={() => setDeleteTarget(p)}
                        disabled={deleting}
                        style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                      >
                        Delete
                      </button>
                    </td>
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
