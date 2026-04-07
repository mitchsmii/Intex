import type { Resident } from '../../../types/Resident'
import ResidentCard from './ResidentCard'

interface Props {
  residents: Resident[]
  onResidentClick?: (r: Resident) => void
}

const GROUP_ORDER = ['Foster Care', 'Family Reunification', 'Independent Living', 'Other']

function normalizeType(t: string | null): string {
  if (!t) return 'Other'
  if (GROUP_ORDER.includes(t)) return t
  return 'Other'
}

function ReintegrationPipeline({ residents, onResidentClick }: Props) {
  const inPipeline = residents.filter(
    (r) => r.reintegrationStatus && r.reintegrationStatus.trim() !== '',
  )

  const groups = new Map<string, Resident[]>()
  GROUP_ORDER.forEach((g) => groups.set(g, []))
  inPipeline.forEach((r) => {
    const key = normalizeType(r.reintegrationType)
    groups.get(key)!.push(r)
  })

  return (
    <section className="sw-dash-section sw-dash-hero">
      <header className="sw-dash-section-header">
        <h2>Reintegration Pipeline</h2>
        <span className="sw-dash-mock">
          {inPipeline.length} {inPipeline.length === 1 ? 'resident' : 'residents'} in progress
        </span>
      </header>
      {inPipeline.length === 0 ? (
        <p className="sw-dash-empty">No residents currently in the reintegration pipeline.</p>
      ) : (
        <div className="sw-dash-pipeline">
          {GROUP_ORDER.map((group) => {
            const list = groups.get(group)!
            if (list.length === 0) return null
            return (
              <div key={group} className="sw-dash-pipeline-col">
                <h3>
                  {group} <span className="count">{list.length}</span>
                </h3>
                <div className="sw-dash-pipeline-cards">
                  {list.map((r) => (
                    <ResidentCard
                      key={r.residentId}
                      resident={r}
                      onClick={onResidentClick}
                      trailing={
                        <span className="pipeline-status">{r.reintegrationStatus}</span>
                      }
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default ReintegrationPipeline
