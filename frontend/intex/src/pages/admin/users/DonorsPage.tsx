import { useState, useEffect } from 'react'
import { api } from '../../../services/apiService'
import type { Supporter, Donation } from '../../../services/apiService'
import '../ManageUsersPage.css'

function fmtAmt(n: number | null, currency?: string | null) {
  if (n == null || n === 0) return '—'
  const sym = currency === 'USD' ? '$' : '₱'
  return sym + n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

const INDIVIDUAL_TYPES = ['Individual', 'Person', 'Alumni', 'Volunteer', 'Staff', '']

type SortKey = 'name' | 'email' | 'region' | 'channel' | 'count' | 'total' | 'recurring' | 'status' | 'firstDate'
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

export default function DonorsPage() {
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [donations,  setDonations]  = useState<Donation[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [chanFilter, setChanFilter] = useState('')
  const [sortCol,    setSortCol]    = useState<SortKey>('name')
  const [sortDir,    setSortDir]    = useState<Dir>('asc')

  useEffect(() => {
    Promise.allSettled([
      api.getSupporters().then(setSupporters),
      api.getDonations().then(setDonations),
    ]).finally(() => setLoading(false))
  }, [])

  const donors = supporters.filter(s =>
    !s.supporterType ||
    INDIVIDUAL_TYPES.some(t => (s.supporterType ?? '').toLowerCase() === t.toLowerCase())
  )

  const donationsBySupporter = (id: number) => donations.filter(d => d.supporterId === id)
  const totalBySupporter     = (id: number) => donationsBySupporter(id).reduce((s, d) => s + (d.amount ?? 0), 0)
  const isRecurring          = (id: number) => donationsBySupporter(id).some(d => d.isRecurring)

  function toggleSort(col: SortKey) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const channels = [...new Set(donors.map(d => d.acquisitionChannel).filter(Boolean))] as string[]

  const filtered = donors
    .filter(d => {
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
      else if (sortCol === 'firstDate') cmp = (a.firstDonationDate ?? '').localeCompare(b.firstDonationDate ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    })

  const totalRaised = donors.reduce((s, d) => s + totalBySupporter(d.supporterId), 0)
  const currency    = donations[0]?.currencyCode ?? 'PHP'
  const recurring   = donors.filter(d => isRecurring(d.supporterId)).length

  return (
    <div className="mu-page">
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
        {[
          { label: 'Total Donors',     value: String(donors.length) },
          { label: 'Recurring Donors', value: String(recurring) },
          { label: 'Active Status',    value: String(donors.filter(d => d.status === 'Active').length) },
          { label: 'Total Raised',     value: fmtAmt(totalRaised, currency) },
        ].map(k => (
          <div key={k.label} className="mu-kpi">
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
                <SortTh label="Name"        col="name"      sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Email"       col="email"     sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <th>Phone</th>
                <SortTh label="Region"      col="region"    sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Channel"     col="channel"   sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Donations"   col="count"     sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Total Given" col="total"     sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Recurring"   col="recurring" sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Status"      col="status"    sort={sortCol} dir={sortDir} onSort={toggleSort} />
                <SortTh label="First Gift"  col="firstDate" sort={sortCol} dir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="mu-empty-cell">No donors found.</td></tr>
              )}
              {filtered.map(s => {
                const ds = donationsBySupporter(s.supporterId)
                const tot = totalBySupporter(s.supporterId)
                const rec = isRecurring(s.supporterId)
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
                    <td>{s.firstDonationDate ? new Date(s.firstDonationDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</td>
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
