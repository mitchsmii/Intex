import { useState, useEffect } from 'react'
import { fetchResidents, fetchSafehouses } from '../../services/socialWorkerService'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import type { Resident } from '../../types/Resident'
import './SocialWorkerHomePage.css'

function SocialWorkerHomePage() {
  const [residents, setResidents] = useState<Resident[]>([])
  const [safehouseCount, setSafehouseCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchResidents(), fetchSafehouses()])
      .then(([r, s]) => {
        setResidents(r)
        setSafehouseCount(s.length)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner size="lg" />
  if (error) return <p className="sw-home-error">Error: {error}</p>

  const active = residents.filter((r) => r.caseStatus === 'Active').length
  const highRisk = residents.filter((r) => r.currentRiskLevel === 'High').length

  return (
    <div className="sw-home">
      <div className="sw-home-header">
        <h1>Dashboard</h1>
      </div>

      <div className="sw-home-stats">
        <div className="stat-card">
          <span className="stat-value">{residents.length}</span>
          <span className="stat-label">Total Residents</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{active}</span>
          <span className="stat-label">Active Cases</span>
        </div>
        <div className="stat-card stat-card--warning">
          <span className="stat-value">{highRisk}</span>
          <span className="stat-label">High Risk</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{safehouseCount}</span>
          <span className="stat-label">Safehouses</span>
        </div>
      </div>

      <div className="sw-home-recent">
        <h2>Recent Cases</h2>
        <div className="sw-home-cases">
          {residents.slice(0, 5).map((r) => (
            <div key={r.residentId} className="case-card">
              <div className="case-card-top">
                <span className="case-card-id">{r.internalCode}</span>
                <span className={`case-card-status case-card-status--${r.caseStatus?.toLowerCase()}`}>
                  {r.caseStatus}
                </span>
              </div>
              <p className="case-card-updated">
                {r.caseCategory} &middot; {r.currentRiskLevel} risk
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SocialWorkerHomePage
