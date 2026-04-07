import { useMemo } from 'react'
import type { Resident } from '../../../types/Resident'
import type { ProcessRecording } from '../../../types/ProcessRecording'
import type { HomeVisitation } from '../../../types/HomeVisitation'
import type { InterventionPlan } from '../../../types/InterventionPlan'
import { computeReadiness, type ReadinessLevel } from '../../../utils/readinessScore'

interface Props {
  residents: Resident[]
  recordings: ProcessRecording[]
  visitations: HomeVisitation[]
  plans: InterventionPlan[]
  onResidentClick?: (residentId: number) => void
}

const LEVEL_CLASS: Record<ReadinessLevel, string> = {
  'Ready': 'level--ready',
  'Almost': 'level--almost',
  'Building': 'level--building',
  'Not Ready': 'level--notready',
}

function ReadinessPipeline({ residents, recordings, visitations, plans, onResidentClick }: Props) {
  const ranked = useMemo(() => {
    return residents
      .filter((r) => r.caseStatus === 'Active')
      .map((r) => ({
        resident: r,
        readiness: computeReadiness(r, recordings, visitations, plans),
      }))
      .sort((a, b) => b.readiness.score - a.readiness.score)
  }, [residents, recordings, visitations, plans])

  return (
    <section className="sw-dash-section sw-dash-readiness">
      <header className="sw-dash-section-header">
        <h2>Reintegration Readiness</h2>
        <span className="sw-dash-mock">
          {ranked.length} active · ranked by composite score
        </span>
      </header>
      {ranked.length === 0 ? (
        <p className="sw-dash-empty">No active residents.</p>
      ) : (
        <ul className="readiness-list">
          {ranked.map(({ resident: r, readiness: s }) => (
            <li key={r.residentId}>
              <button
                type="button"
                className="readiness-row"
                onClick={() => onResidentClick?.(r.residentId)}
              >
                <div className="readiness-id">
                  <span className="readiness-code">{r.internalCode ?? `#${r.residentId}`}</span>
                  <span className="readiness-meta">
                    Age {r.presentAge ?? '—'} · {r.reintegrationType ?? 'Type TBD'}
                  </span>
                </div>

                <div className="readiness-bar-wrap">
                  <div className="readiness-bar">
                    <div
                      className={`readiness-bar-fill ${LEVEL_CLASS[s.level]}`}
                      style={{ width: `${s.score}%` }}
                    />
                  </div>
                  <div className="readiness-score-line">
                    <span className={`readiness-level ${LEVEL_CLASS[s.level]}`}>{s.level}</span>
                    <span className="readiness-number">{s.score}/100</span>
                  </div>
                </div>

                <div className="readiness-factors">
                  {s.topPositive && (
                    <span className="factor factor--positive" title={`${Math.round(s.topPositive.score * 100)}%`}>
                      ↑ {s.topPositive.label}
                    </span>
                  )}
                  {s.topBlocker && (
                    <span className="factor factor--blocker" title={`${Math.round(s.topBlocker.score * 100)}%`}>
                      ↓ {s.topBlocker.label}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default ReadinessPipeline
