import { useMemo } from 'react'
import type { Resident } from '../../../types/Resident'
import type { IncidentReport } from '../../../types/IncidentReport'
import type { HomeVisitation } from '../../../types/HomeVisitation'
import type { ProcessRecording } from '../../../types/ProcessRecording'

export type AlertSource = 'incident' | 'safety' | 'session' | 'risk'

export interface Alert {
  key: string
  source: AlertSource
  severity: 'high' | 'medium'
  residentId: number
  residentCode: string
  title: string
  detail: string
  date: string | null
}

interface Props {
  residents: Resident[]
  incidents: IncidentReport[]
  visitations: HomeVisitation[]
  recordings: ProcessRecording[]
  onAlertClick?: (alert: Alert) => void
}

const DAYS = (n: number) => n * 24 * 60 * 60 * 1000
const within = (iso: string | null, days: number) => {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() <= DAYS(days)
}

function CriticalAlerts({
  residents,
  incidents,
  visitations,
  recordings,
  onAlertClick,
}: Props) {
  const codeOf = useMemo(() => {
    const m = new Map<number, string>()
    residents.forEach((r) => m.set(r.residentId, r.internalCode ?? `#${r.residentId}`))
    return m
  }, [residents])

  const alerts: Alert[] = useMemo(() => {
    const out: Alert[] = []

    // 1. Unresolved incident reports — highest priority
    incidents
      .filter((i) => i.resolved !== true)
      .forEach((i) => {
        if (i.residentId == null) return
        out.push({
          key: `inc-${i.incidentId}`,
          source: 'incident',
          severity: i.severity?.toLowerCase() === 'high' ? 'high' : 'medium',
          residentId: i.residentId,
          residentCode: codeOf.get(i.residentId) ?? `#${i.residentId}`,
          title: `Unresolved ${i.severity ?? ''} incident`.trim(),
          detail: i.incidentType ?? i.description ?? 'Incident reported',
          date: i.incidentDate,
        })
      })

    // 2. Recent home visit safety concerns (last 30 days)
    visitations
      .filter((v) => v.safetyConcernsNoted === true && within(v.visitDate, 30))
      .forEach((v) => {
        if (v.residentId == null) return
        out.push({
          key: `vis-${v.visitationId}`,
          source: 'safety',
          severity: 'high',
          residentId: v.residentId,
          residentCode: codeOf.get(v.residentId) ?? `#${v.residentId}`,
          title: 'Safety concern noted on home visit',
          detail: v.followUpNotes ?? v.observations ?? 'Follow-up required',
          date: v.visitDate,
        })
      })

    // 3. Recent flagged process recordings (last 14 days)
    recordings
      .filter((p) => p.concernsFlagged === true && within(p.sessionDate, 14))
      .forEach((p) => {
        if (p.residentId == null) return
        out.push({
          key: `rec-${p.recordingId}`,
          source: 'session',
          severity: 'medium',
          residentId: p.residentId,
          residentCode: codeOf.get(p.residentId) ?? `#${p.residentId}`,
          title: 'Concerns flagged in session',
          detail: p.followUpActions ?? p.emotionalStateObserved ?? 'Review session notes',
          date: p.sessionDate,
        })
      })

    // 4. Risk-level escalations (initial → current)
    residents
      .filter(
        (r) =>
          r.currentRiskLevel === 'High' &&
          r.initialRiskLevel &&
          r.initialRiskLevel !== 'High',
      )
      .forEach((r) => {
        out.push({
          key: `risk-${r.residentId}`,
          source: 'risk',
          severity: 'high',
          residentId: r.residentId,
          residentCode: r.internalCode ?? `#${r.residentId}`,
          title: 'Risk level escalated',
          detail: `${r.initialRiskLevel} → High`,
          date: null,
        })
      })

    // Sort: high severity first, then by date desc
    return out.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1
      const da = a.date ? new Date(a.date).getTime() : 0
      const db = b.date ? new Date(b.date).getTime() : 0
      return db - da
    })
  }, [incidents, visitations, recordings, residents, codeOf])

  const sourceLabel: Record<AlertSource, string> = {
    incident: 'Incident',
    safety: 'Home Visit',
    session: 'Session',
    risk: 'Risk',
  }

  return (
    <section className="sw-dash-section sw-dash-alerts">
      <header className="sw-dash-section-header">
        <h2>Critical Alerts</h2>
        <span className="sw-dash-mock">{alerts.length} need attention</span>
      </header>
      {alerts.length === 0 ? (
        <p className="sw-dash-empty">No critical alerts. Everyone is safe.</p>
      ) : (
        <ul className="sw-dash-alert-list">
          {alerts.slice(0, 8).map((a) => (
            <li key={a.key}>
              <button
                type="button"
                className={`alert-row alert-row--${a.severity}`}
                onClick={() => onAlertClick?.(a)}
              >
                <span className={`alert-tag alert-tag--${a.source}`}>
                  {sourceLabel[a.source]}
                </span>
                <span className="alert-resident">{a.residentCode}</span>
                <span className="alert-title">{a.title}</span>
                <span className="alert-detail">{a.detail}</span>
                {a.date && (
                  <span className="alert-date">
                    {new Date(a.date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default CriticalAlerts
