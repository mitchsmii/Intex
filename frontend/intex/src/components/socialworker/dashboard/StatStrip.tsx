import type { Resident } from '../../../types/Resident'
import type { ActionItem } from '../../../types/ActionItem'

interface Props {
  residents: Resident[]
  actionItems: ActionItem[]
}

function StatStrip({ residents, actionItems }: Props) {
  const active = residents.filter((r) => r.caseStatus === 'Active').length
  const highRisk = residents.filter((r) => r.currentRiskLevel === 'High').length
  const overdue = actionItems.filter((a) => a.reason === 'overdue-visit').length

  const stats = [
    { label: 'My Residents', value: residents.length, tone: 'default' },
    { label: 'Active Cases', value: active, tone: 'primary' },
    { label: 'High Risk', value: highRisk, tone: 'error' },
    { label: 'Overdue Visits', value: overdue, tone: 'warning' },
  ]

  return (
    <div className="sw-dash-stats">
      {stats.map((s) => (
        <div key={s.label} className={`sw-dash-stat sw-dash-stat--${s.tone}`}>
          <span className="sw-dash-stat-value">{s.value}</span>
          <span className="sw-dash-stat-label">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

export default StatStrip
