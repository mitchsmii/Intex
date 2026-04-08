import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom'
import { fetchResidents, fetchSafehouses } from '../../services/socialWorkerService'
import { api } from '../../services/apiService'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import type { Resident } from '../../types/Resident'
import type { Safehouse } from '../../types/Safehouse'
import './ResidentsPage.css'

function ResidentsPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const base = pathname.startsWith('/admin') ? '/admin/sw' : '/socialworker/dashboard'
  const ctx = useOutletContext<{ clearNotifications?: () => void } | null>()
  const [residents, setResidents] = useState<Resident[]>([])
  const [safehouses, setSafehouses] = useState<Safehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')

  useEffect(() => {
    Promise.all([fetchResidents(), fetchSafehouses()])
      .then(([r, s]) => {
        setResidents(r)
        setSafehouses(s)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Clear notification badge when SW views this page
  useEffect(() => {
    if (pathname.startsWith('/socialworker')) {
      api.markAllNotificationsRead().catch(() => {})
      ctx?.clearNotifications?.()
    }
  }, [pathname, ctx])

  const safehouseMap = useMemo(() => {
    const map = new Map<number, string>()
    safehouses.forEach((s) => {
      if (s.name) map.set(s.safehouseId, s.name)
    })
    return map
  }, [safehouses])

  const filtered = useMemo(() => {
    return residents.filter((r) => {
      if (search) {
        const q = search.toLowerCase()
        const matches =
          r.internalCode?.toLowerCase().includes(q) ||
          r.caseControlNo?.toLowerCase().includes(q) ||
          r.caseCategory?.toLowerCase().includes(q)
        if (!matches) return false
      }
      if (statusFilter && r.caseStatus !== statusFilter) return false
      if (riskFilter && r.currentRiskLevel !== riskFilter) return false
      return true
    })
  }, [residents, search, statusFilter, riskFilter])

  if (loading) return <LoadingSpinner size="lg" />
  if (error) return <p className="residents-error">Error: {error}</p>

  return (
    <div className="residents">
      <div className="residents-header">
        <h1>Residents</h1>
        <span className="residents-count">{filtered.length} residents</span>
      </div>

      <div className="residents-filters">
        <input
          type="text"
          className="residents-search"
          placeholder="Search by code or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="residents-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Closed">Closed</option>
          <option value="Transferred">Transferred</option>
        </select>
        <select
          className="residents-select"
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
        >
          <option value="">All Risk Levels</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      <div className="residents-grid">
        {filtered.map((r) => (
          <div key={r.residentId} className="resident-card" onClick={() => navigate(`${base}/residents/${r.residentId}`)}>
            <div className="resident-card-header">
              <div className="resident-avatar">
                {r.internalCode?.substring(0, 2) || '??'}
              </div>
              <div className="resident-id-group">
                <span className="resident-code">{r.internalCode}</span>
                <span className="resident-case-no">{r.caseControlNo}</span>
              </div>
            </div>

            <div className="resident-card-body">
              <div className="resident-badges">
                <span className={`badge badge-status badge-status--${r.caseStatus?.toLowerCase()}`}>
                  {r.caseStatus}
                </span>
                <span className={`badge badge-risk badge-risk--${r.currentRiskLevel?.toLowerCase()}`}>
                  {r.currentRiskLevel} Risk
                </span>
              </div>

              <div className="resident-details">
                <div className="resident-detail">
                  <span className="resident-label">Age</span>
                  <span className="resident-value">{r.presentAge || 'N/A'}</span>
                </div>
                <div className="resident-detail">
                  <span className="resident-label">Category</span>
                  <span className="resident-value">{r.caseCategory || 'N/A'}</span>
                </div>
                <div className="resident-detail">
                  <span className="resident-label">Safehouse</span>
                  <span className="resident-value">
                    {r.safehouseId ? safehouseMap.get(r.safehouseId) || 'Unknown' : 'N/A'}
                  </span>
                </div>
                <div className="resident-detail">
                  <span className="resident-label">Social Worker</span>
                  <span className="resident-value">{r.assignedSocialWorker || 'N/A'}</span>
                </div>
                <div className="resident-detail">
                  <span className="resident-label">Admitted</span>
                  <span className="resident-value">{r.dateOfAdmission || 'N/A'}</span>
                </div>
                <div className="resident-detail">
                  <span className="resident-label">Reintegration</span>
                  <span className="resident-value">{r.reintegrationStatus || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="residents-empty">No residents match your filters.</p>
      )}
    </div>
  )
}

export default ResidentsPage
