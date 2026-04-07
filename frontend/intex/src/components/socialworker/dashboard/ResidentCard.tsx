import type { Resident } from '../../../types/Resident'

interface Props {
  resident: Resident
  onClick?: (r: Resident) => void
  trailing?: React.ReactNode
}

function riskClass(level: string | null) {
  switch (level) {
    case 'High': return 'risk--high'
    case 'Medium': return 'risk--medium'
    case 'Low': return 'risk--low'
    default: return 'risk--unknown'
  }
}

function ResidentCard({ resident, onClick, trailing }: Props) {
  return (
    <button
      type="button"
      className="resident-card"
      onClick={() => onClick?.(resident)}
    >
      <div className="resident-card-top">
        <span className="resident-card-code">{resident.internalCode ?? `#${resident.residentId}`}</span>
        <span className={`risk-badge ${riskClass(resident.currentRiskLevel)}`}>
          {resident.currentRiskLevel ?? 'Unknown'}
        </span>
      </div>
      <div className="resident-card-meta">
        <span>Age {resident.presentAge ?? '—'}</span>
        <span>&middot;</span>
        <span>{resident.caseStatus ?? 'No status'}</span>
      </div>
      <div className="resident-card-sub">
        {resident.caseCategory ?? 'Uncategorized'}
        {resident.lengthOfStay ? ` · ${resident.lengthOfStay}` : ''}
      </div>
      {trailing && <div className="resident-card-trailing">{trailing}</div>}
    </button>
  )
}

export default ResidentCard
