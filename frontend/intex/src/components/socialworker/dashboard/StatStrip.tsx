import { useNavigate, useLocation } from 'react-router-dom'
import type { Resident } from '../../../types/Resident'
import type { ActionItem } from '../../../types/ActionItem'

interface Props {
  residents: Resident[]
  actionItems: ActionItem[]
}

function StatStrip({ residents, actionItems }: Props) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const base = pathname.startsWith('/admin') ? '/admin/sw' : '/socialworker/dashboard'

  const active = residents.filter((r) => r.caseStatus === 'Active').length
  const highRisk = residents.filter((r) => r.currentRiskLevel === 'High').length
  const overdue = actionItems.filter((a) => a.reason === 'overdue-visit').length

  const stats = [
    { label: 'My Residents', value: residents.length, tone: 'default', to: `${base}/residents` },
    { label: 'Active Cases', value: active, tone: 'primary', to: `${base}/residents?status=active` },
    { label: 'High Risk', value: highRisk, tone: 'error', to: `${base}/residents?risk=high` },
    { label: 'Overdue Visits', value: overdue, tone: 'warning', to: `${base}/home-visits?filter=overdue` },
  ]

  return (
    <div className="sw-dash-stats">
      {stats.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => navigate(s.to)}
          className={`sw-dash-stat sw-dash-stat--${s.tone} sw-dash-stat--clickable`}
        >
          <span className="sw-dash-stat-value">{s.value}</span>
          <span className="sw-dash-stat-label">{s.label}</span>
        </button>
      ))}
    </div>
  )
}

export default StatStrip
