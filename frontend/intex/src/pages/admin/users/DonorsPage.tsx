import { useState, useEffect } from 'react'
import { api } from '../../../services/apiService'
import type { Supporter, Donation } from '../../../services/apiService'
import { predictDonorChurn } from '../../../services/mlApi'
import { DONOR_CHURN_THRESHOLDS } from '../../../config/donorChurnThresholds'
import type { MlCachedPrediction } from '../../../services/apiService'
import DeleteConfirmModal from '../../../components/common/DeleteConfirmModal'
import '../ManageUsersPage.css'

function fmtAmt(n: number | null, currency?: string | null) {
  if (n == null || n === 0) return '—'
  const sym = currency === 'PHP' ? '₱' : '$'
  return sym + n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}


type SortKey = 'name' | 'email' | 'region' | 'channel' | 'count' | 'total' | 'recurring' | 'status' | 'risk' | 'firstDate'
type Dir = 'asc' | 'desc'

function getRiskTier(prob: number | undefined): { label: string; className: string } {
  if (prob === undefined) return { label: 'Loading…', className: 'mu-badge-off' }
  if (prob >= DONOR_CHURN_THRESHOLDS.donorsCriticalRisk) return { label: 'Critical', className: 'mu-badge-critical' }
  if (prob >= DONOR_CHURN_THRESHOLDS.donorsModerateRisk) return { label: 'Moderate', className: 'mu-badge-warn' }
  return { label: 'Low Risk', className: 'mu-badge-ok' }
}

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

function AddDonorModal({ onClose, onSave }: { onClose: () => void; onSave: (s: Supporter) => void }) {
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [phone,     setPhone]     = useState('')
  const [channel,   setChannel]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  async function handleSubmit() {
    if (!firstName.trim() && !lastName.trim()) { setError('At least a first or last name is required.'); return }
    setSaving(true); setError('')
    try {
      const created = await api.createSupporter({
        firstName:          firstName.trim() || undefined,
        lastName:           lastName.trim()  || undefined,
        email:              email.trim()     || undefined,
        phone:              phone.trim()     || undefined,
        acquisitionChannel: channel.trim()   || undefined,
        supporterType:      'Individual',
        status:             'Active',
      })
      onSave(created)
    } catch { setError('Failed to save. Please try again.') }
    finally   { setSaving(false) }
  }

  return (
    <div className="mu-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mu-modal">
        <h2 className="mu-modal-title">Add Donor</h2>
        <div className="mu-form-two-col">
          <div className="mu-form-row">
            <label className="mu-form-label">First Name</label>
            <input className="mu-form-input" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Maria" />
          </div>
          <div className="mu-form-row">
            <label className="mu-form-label">Last Name</label>
            <input className="mu-form-input" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Santos" />
          </div>
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
          <label className="mu-form-label">Acquisition Channel</label>
          <input className="mu-form-input" value={channel} onChange={e => setChannel(e.target.value)} placeholder="e.g. Facebook, Referral" />
        </div>
        {error && <p style={{ color: 'var(--color-error)', fontSize: '0.82rem', margin: 0 }}>{error}</p>}
        <div className="mu-modal-actions">
          <button className="mu-btn mu-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="mu-btn mu-btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Add Donor'}</button>
        </div>
      </div>
    </div>
  )
}

export default function DonorsPage() {
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [donations,  setDonations]  = useState<Donation[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [chanFilter, setChanFilter] = useState('')
  const [kpiFilter,   setKpiFilter]   = useState<string | null>(null)
  const [sortCol,     setSortCol]     = useState<SortKey>('name')
  const [sortDir,     setSortDir]     = useState<Dir>('asc')
  const [valueFilter, setValueFilter] = useState('')
  const [showAdd,     setShowAdd]     = useState(false)
  const [churnScores, setChurnScores] = useState<Record<number, number>>({})
  const [deleteTarget, setDeleteTarget] = useState<Supporter | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { setValueFilter('') }, [sortCol])

  useEffect(() => {
    Promise.allSettled([
      api.getSupporters().then(setSupporters),
      api.getDonations().then(setDonations),
    ]).finally(() => setLoading(false))
  }, [])

  const donors = supporters.filter(s => !s.organizationName && (!!s.firstName || !!s.lastName))

  const donationsBySupporter = (id: number) => donations.filter(d => d.supporterId === id)
  const totalBySupporter     = (id: number) => donationsBySupporter(id).reduce((s, d) => s + (d.amount ?? 0), 0)
  const isRecurring          = (id: number) => donationsBySupporter(id).some(d => d.isRecurring)

  // Load cached ML predictions instead of calling ML API per-donor at runtime
  useEffect(() => {
    api.getMlPredictions('donor-churn')
      .then((preds: MlCachedPrediction[]) => {
        const map: Record<number, number> = {}
        preds.forEach(p => { map[p.entityId] = p.probability })
        setChurnScores(map)
      })
      .catch(() => { /* predictions unavailable — page still works */ })
  }, [])

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

  const channels = [...new Set(donors.map(d => d.acquisitionChannel).filter(Boolean))] as string[]

  const pinValue = (d: Supporter): string => {
    if (sortCol === 'channel')   return d.acquisitionChannel ?? ''
    if (sortCol === 'status')    return d.status ?? ''
    if (sortCol === 'recurring') return isRecurring(d.supporterId) ? 'Monthly' : 'One-Time'
    if (sortCol === 'region')    return [d.region, d.country].filter(Boolean).join(', ')
    return ''
  }

  const discreteOptions: string[] = (() => {
    if (sortCol === 'channel')   return [...new Set(donors.map(d => d.acquisitionChannel).filter(Boolean))].sort() as string[]
    if (sortCol === 'status')    return [...new Set(donors.map(d => d.status).filter(Boolean))].sort() as string[]
    if (sortCol === 'recurring') return ['Monthly', 'One-Time']
    if (sortCol === 'region')    return [...new Set(donors.map(d => [d.region, d.country].filter(Boolean).join(', ')).filter(Boolean))].sort()
    return []
  })()

  const filtered = donors
    .filter(d => {
      if (kpiFilter === 'recurring' && !isRecurring(d.supporterId))    return false
      if (kpiFilter === 'active'    && d.status !== 'Active')           return false
      if (kpiFilter === 'critical'  && (churnScores[d.supporterId] ?? 0) < DONOR_CHURN_THRESHOLDS.donorsCriticalRisk) return false
      if (valueFilter && pinValue(d) !== valueFilter) return false
      const matchSearch = !search ||
        (d.displayName ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (`${d.firstName ?? ''} ${d.lastName ?? ''}`).toLowerCase().includes(search.toLowerCase()) ||
        (d.email ?? '').toLowerCase().includes(search.toLowerCase())
      const matchChan = !chanFilter || d.acquisitionChannel === chanFilter
      return matchSearch && matchChan
    })
    .sort((a, b) => {
      let cmp = 0
      const nameA = a.displayName ?? `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim()
      const nameB = b.displayName ?? `${b.firstName ?? ''} ${b.lastName ?? ''}`.trim()
      if      (sortCol === 'name')      cmp = nameA.localeCompare(nameB)
      else if (sortCol === 'email')     cmp = (a.email ?? '').localeCompare(b.email ?? '')
      else if (sortCol === 'region')    cmp = ([a.region, a.country].filter(Boolean).join(', ')).localeCompare([b.region, b.country].filter(Boolean).join(', '))
      else if (sortCol === 'channel')   cmp = (a.acquisitionChannel ?? '').localeCompare(b.acquisitionChannel ?? '')
      else if (sortCol === 'count')     cmp = donationsBySupporter(a.supporterId).length - donationsBySupporter(b.supporterId).length
      else if (sortCol === 'total')     cmp = totalBySupporter(a.supporterId) - totalBySupporter(b.supporterId)
      else if (sortCol === 'recurring') cmp = (isRecurring(a.supporterId) ? 1 : 0) - (isRecurring(b.supporterId) ? 1 : 0)
      else if (sortCol === 'status')    cmp = (a.status ?? '').localeCompare(b.status ?? '')
      else if (sortCol === 'risk')      cmp = (churnScores[a.supporterId] ?? 0) - (churnScores[b.supporterId] ?? 0)
      else if (sortCol === 'firstDate') cmp = (a.firstDonationDate ?? '').localeCompare(b.firstDonationDate ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })

  const totalRaised = donors.reduce((s, d) => s + totalBySupporter(d.supporterId), 0)
  const currency    = donations[0]?.currencyCode ?? 'USD'
  const recurring   = donors.filter(d => isRecurring(d.supporterId)).length
  return (
    <div className="mu-page">
      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget ? (deleteTarget.displayName ?? `${deleteTarget.firstName ?? ''} ${deleteTarget.lastName ?? ''}`.trim()) : ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
      {showAdd && (
        <AddDonorModal
          onClose={() => setShowAdd(false)}
          onSave={s => { setSupporters(prev => [...prev, s]); setShowAdd(false) }}
        />
      )}

      <div className="mu-header">
        <div>
          <h1 className="mu-title">Donors</h1>
          <p className="mu-subtitle">{donors.length} individual donors · {recurring} recurring</p>
        </div>
        <div className="mu-header-actions">
          <select className="mu-select" value={chanFilter} onChange={e => setChanFilter(e.target.value)}>
            <option value="">All Channels</option>
            {channels.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="mu-search" type="search" placeholder="Search by name or email…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="mu-kpi-row">
        {([
          { label: 'Total Donors',     display: String(donors.length),                                    num: donors.length,                                    den: null,           key: null },
          { label: 'Recurring Donors', display: null,                                                      num: recurring,                                        den: donors.length,  key: 'recurring' },
          { label: 'Active Status',    display: null,                                                      num: donors.filter(d => d.status === 'Active').length, den: donors.length,  key: 'active' },
          { label: 'Critical Risk',    display: null,                                                      num: donors.filter(d => (churnScores[d.supporterId] ?? 0) >= DONOR_CHURN_THRESHOLDS.donorsCriticalRisk).length, den: donors.length,  key: 'critical' },
          { label: 'Total Raised',     display: fmtAmt(totalRaised, currency),                            num: 0,                                                den: null,           key: null },
        ] as { label: string; display: string | null; num: number; den: number | null; key: string | null }[]).map(k => (
          <div
            key={k.label}
            className={`mu-kpi${k.key ? ' mu-kpi-clickable' : ''}${kpiFilter === k.key && k.key ? ' mu-kpi-active' : ''}`}
            onClick={k.key ? () => setKpiFilter(f => f === k.key ? null : k.key) : undefined}
          >
            <div className="mu-kpi-value">
              {k.display ?? (<>{k.num}{k.den != null && <span className="mu-kpi-denom">/{k.den}</span>}</>)}
            </div>
            <div className="mu-kpi-label">{k.label}</div>
          </div>
        ))}
        <button className="mu-kpi-add-card" onClick={() => setShowAdd(true)}>
          <div className="mu-kpi-add-icon">+</div>
          <div className="mu-kpi-label">Add Donor</div>
        </button>
      </div>

      {!loading && (
        <div className="mu-sort-bar">
          <span className="mu-sort-bar-label">Sort by</span>
          <select className="mu-sort-select" value={sortCol} onChange={e => setSortCol(e.target.value as SortKey)}>
            <option value="name">Name</option>
            <option value="email">Email</option>
            <option value="region">Region</option>
            <option value="channel">Channel</option>
            <option value="count">Donations</option>
            <option value="total">Total Given</option>
            <option value="recurring">Recurring</option>
            <option value="status">Status</option>
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
                <SortTh label="Name"        col="name"      sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Email"       col="email"     sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <th>Phone</th>
                <SortTh label="Region"      col="region"    sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Channel"     col="channel"   sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Donations"   col="count"     sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Total Given" col="total"     sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Recurring"   col="recurring" sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Status"      col="status"    sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Lapse Risk"  col="risk"      sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="First Gift"  col="firstDate" sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={12} className="mu-empty-cell">No donors found.</td></tr>
              )}
              {filtered.map(s => {
                const ds = donationsBySupporter(s.supporterId)
                const tot = totalBySupporter(s.supporterId)
                const rec = isRecurring(s.supporterId)
                const risk = churnScores[s.supporterId]
                const riskTier = getRiskTier(risk)
                return (
                  <tr key={s.supporterId}>
                    <td className="mu-td-name">
                      {s.displayName ?? (`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || '—')}
                    </td>
                    <td>{s.email ?? '—'}</td>
                    <td>{s.phone ?? '—'}</td>
                    <td>{[s.region, s.country].filter(Boolean).join(', ') || '—'}</td>
                    <td className="mu-muted">{s.acquisitionChannel ?? '—'}</td>
                    <td className="mu-td-num">{ds.length || '—'}</td>
                    <td className="mu-td-num">{ds.length ? fmtAmt(tot, ds[0]?.currencyCode) : '—'}</td>
                    <td>
                      <span className={`mu-badge ${rec ? 'mu-badge-ok' : 'mu-badge-off'}`}>
                        {rec ? 'Monthly' : 'One-Time'}
                      </span>
                    </td>
                    <td>
                      <span className={`mu-badge ${s.status === 'Active' ? 'mu-badge-ok' : 'mu-badge-off'}`}>
                        {s.status ?? '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`mu-badge ${riskTier.className}`}>
                        {riskTier.label}
                      </span>
                      <div className="mu-muted">
                        {risk === undefined ? '—' : `${(risk * 100).toFixed(1)}%`}
                      </div>
                    </td>
                    <td>{s.firstDonationDate ? new Date(s.firstDonationDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</td>
                    <td>
                      <button
                        className="mu-btn mu-btn-danger"
                        onClick={() => setDeleteTarget(s)}
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
