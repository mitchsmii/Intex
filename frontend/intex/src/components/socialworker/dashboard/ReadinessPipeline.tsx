import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../services/apiService'
import type { MlCachedPrediction } from '../../../services/apiService'
import type { Resident } from '../../../types/Resident'

interface Props {
  residents: Resident[]
  onResidentClick?: (residentId: number) => void
}

type ReadinessLevel = 'Ready' | 'Almost' | 'Building' | 'Not Ready'

function toLevel(probability: number): ReadinessLevel {
  if (probability >= 0.7) return 'Ready'
  if (probability >= 0.5) return 'Almost'
  if (probability >= 0.3) return 'Building'
  return 'Not Ready'
}

const LEVEL_CLASS: Record<ReadinessLevel, string> = {
  'Ready': 'level--ready',
  'Almost': 'level--almost',
  'Building': 'level--building',
  'Not Ready': 'level--notready',
}

function ReadinessPipeline({ residents, onResidentClick }: Props) {
  const [predictions, setPredictions] = useState<MlCachedPrediction[]>([])

  useEffect(() => {
    api.getMlPredictions('reintegration-readiness')
      .then(setPredictions)
      .catch(() => {})
  }, [])

  const ranked = useMemo(() => {
    const predMap = new Map(predictions.map((p) => [p.entityId, p]))
    return residents
      .filter((r) => r.caseStatus === 'Active')
      .map((r) => {
        const pred = predMap.get(r.residentId)
        const probability = pred?.probability ?? 0
        return {
          resident: r,
          probability,
          level: toLevel(probability),
        }
      })
      .sort((a, b) => b.probability - a.probability)
  }, [residents, predictions])

  return (
    <section className="sw-dash-section sw-dash-readiness">
      <header className="sw-dash-section-header">
        <h2>Reintegration Readiness</h2>
        <span className="sw-dash-mock">
          {ranked.length} active · ML reintegration model
        </span>
      </header>
      {ranked.length === 0 ? (
        <p className="sw-dash-empty">No active residents.</p>
      ) : (
        <ul className="readiness-list">
          {ranked.map(({ resident: r, probability, level }) => (
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
                      className={`readiness-bar-fill ${LEVEL_CLASS[level]}`}
                      style={{ width: `${Math.round(probability * 100)}%` }}
                    />
                  </div>
                  <div className="readiness-score-line">
                    <span className={`readiness-level ${LEVEL_CLASS[level]}`}>{level}</span>
                    <span className="readiness-number">{Math.round(probability * 100)}/100</span>
                  </div>
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
