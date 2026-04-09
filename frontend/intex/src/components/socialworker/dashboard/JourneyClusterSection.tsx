import { useEffect, useState } from 'react'
import { api } from '../../../services/apiService'
import type { Resident } from '../../../types/Resident'

interface Props {
  residents: Resident[]
  onResidentClick?: (residentId: number) => void
}

const CLUSTER_NAMES: Record<number, string> = {
  0: 'Newly Admitted \u2014 Onboarding Needed',
  1: 'Established \u2014 Active Care',
}

type ClusterInfo = { clusterId: number; clusterName: string }

function JourneyClusterSection({ residents, onResidentClick }: Props) {
  const [clusterMap, setClusterMap] = useState<Map<number, ClusterInfo>>(new Map())

  useEffect(() => {
    api.getMlPredictions('reintegration-journey')
      .then((preds) => {
        const map = new Map<number, ClusterInfo>()
        for (const p of preds) {
          const clusterId = Math.round(p.probability)
          map.set(p.entityId, {
            clusterId,
            clusterName: CLUSTER_NAMES[clusterId] ?? 'Developing Profile \u2014 Monitor & Support',
          })
        }
        setClusterMap(map)
      })
      .catch(() => {})
  }, [])

  const active = residents.filter((r) => r.caseStatus === 'Active')

  // Group residents by cluster
  const groups = new Map<string, Resident[]>()
  const unclustered: Resident[] = []
  for (const r of active) {
    const info = clusterMap.get(r.residentId)
    if (info) {
      const list = groups.get(info.clusterName) ?? []
      list.push(r)
      groups.set(info.clusterName, list)
    } else {
      unclustered.push(r)
    }
  }

  if (clusterMap.size === 0) return null

  const clusterOrder = [
    'Newly Admitted \u2014 Onboarding Needed',
    'Established \u2014 Active Care',
    'Developing Profile \u2014 Monitor & Support',
  ]

  return (
    <section className="sw-dash-section">
      <header className="sw-dash-section-header">
        <h2>Journey Profiles</h2>
        <span className="sw-dash-mock">
          {clusterMap.size} profiled · ML clustering
        </span>
      </header>
      <div className="journey-cluster-groups">
        {clusterOrder.map((name) => {
          const list = groups.get(name)
          if (!list || list.length === 0) return null
          const variant = name.includes('Onboarding') ? 'onboarding' : name.includes('Active') ? 'active' : 'developing'
          return (
            <div key={name} className="journey-cluster-group">
              <div className="journey-cluster-header">
                <span className={`journey-cluster-badge journey-cluster-badge--${variant}`}>
                  {name}
                </span>
                <span className="journey-cluster-count">{list.length} resident{list.length !== 1 ? 's' : ''}</span>
              </div>
              <ul className="journey-cluster-list">
                {list.map((r) => (
                  <li key={r.residentId}>
                    <button
                      type="button"
                      className="journey-cluster-row"
                      onClick={() => onResidentClick?.(r.residentId)}
                    >
                      <span className="journey-cluster-code">{r.internalCode ?? `#${r.residentId}`}</span>
                      <span className="journey-cluster-meta">
                        Age {r.presentAge ?? '—'} · {r.reintegrationType ?? 'Type TBD'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default JourneyClusterSection
