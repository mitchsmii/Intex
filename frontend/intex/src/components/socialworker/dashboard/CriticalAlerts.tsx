import { useMemo } from 'react'
import type { Resident } from '../../../types/Resident'
import type { IncidentReport } from '../../../types/IncidentReport'
import type { HomeVisitation } from '../../../types/HomeVisitation'
import type { ProcessRecording } from '../../../types/ProcessRecording'
import type { Assessment } from '../../../types/Assessment'

export type AlertSource =
  | 'incident'
  | 'safety'
  | 'session'
  | 'risk'
  | 'mh-suicide-bdi'
  | 'mh-suicide-screen'
  | 'mh-ptsd'

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
  assessments?: Assessment[]
  onAlertClick?: (alert: Alert) => void
}

const DAYS = (n: number) => n * 24 * 60 * 60 * 1000
const within = (iso: string | null, days: number) => {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() <= DAYS(days)
}

/**
 * Pure alert derivation — exported so TodaysPriorities (and any future
 * consumer) can reuse the exact same signal logic without duplicating it.
 */
export function buildAlerts(params: {
  residents: Resident[]
  incidents: IncidentReport[]
  visitations: HomeVisitation[]
  recordings: ProcessRecording[]
  assessments?: Assessment[]
}): Alert[] {
  const { residents, incidents, visitations, recordings, assessments = [] } = params
  const codeOf = new Map<number, string>()
  residents.forEach((r) => codeOf.set(r.residentId, r.internalCode ?? `#${r.residentId}`))
  const out: Alert[] = []
  // 1. Unresolved incident reports
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
  // 2. Home visit safety concerns in last 30 days
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
  // 3. Flagged process recordings in last 14 days
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
  // 4. Risk-level escalations
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
  // 5. Mental health alerts
  assessments.forEach((a) => {
    if (a.residentId == null) return
    const code = codeOf.get(a.residentId) ?? `#${a.residentId}`
    if (a.instrument === 'BDI' && a.responsesJson && within(a.administeredDate, 14)) {
      try {
        const parsed = JSON.parse(a.responsesJson)
        const item9 = parsed?.items?.['9'] ?? parsed?.items?.[9]
        if (typeof item9 === 'number' && item9 >= 2) {
          out.push({
            key: `mh-bdi-${a.assessmentId}`,
            source: 'mh-suicide-bdi',
            severity: 'high',
            residentId: a.residentId,
            residentCode: code,
            title: 'BDI item 9: suicidal ideation',
            detail: a.immediateAction ?? 'Item-9 score ≥ 2 — review safety plan',
            date: a.administeredDate,
          })
        }
      } catch { /* ignore */ }
    }
    if (
      a.instrument === 'SUICIDE_RISK' &&
      within(a.administeredDate, 30) &&
      (a.severityBand === 'High' || a.severityBand === 'Emergency')
    ) {
      out.push({
        key: `mh-suicide-${a.assessmentId}`,
        source: 'mh-suicide-screen',
        severity: 'high',
        residentId: a.residentId,
        residentCode: code,
        title: `Suicide risk: ${a.severityBand}`,
        detail: a.immediateAction ?? `${a.tickCount ?? 0}/6 ticks on suicide screen`,
        date: a.administeredDate,
      })
    }
    if (
      a.instrument === 'PCL5' &&
      within(a.administeredDate, 30) &&
      a.totalScore != null &&
      a.totalScore >= 33
    ) {
      out.push({
        key: `mh-ptsd-${a.assessmentId}`,
        source: 'mh-ptsd',
        severity: 'medium',
        residentId: a.residentId,
        residentCode: code,
        title: 'PCL-5: probable PTSD',
        detail: `Score ${a.totalScore} ≥ 33 — trauma-informed care plan recommended`,
        date: a.administeredDate,
      })
    }
  })
  return out.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1
    const da = a.date ? new Date(a.date).getTime() : 0
    const db = b.date ? new Date(b.date).getTime() : 0
    return db - da
  })
}

function CriticalAlerts({
  residents,
  incidents,
  visitations,
  recordings,
  assessments = [],
  onAlertClick,
}: Props) {
  const codeOf = useMemo(() => {
    const m = new Map<number, string>()
    residents.forEach((r) => m.set(r.residentId, r.internalCode ?? `#${r.residentId}`))
    return m
  }, [residents])

  const alerts: Alert[] = useMemo(() => {
    // Keep the legacy inline derivation below as-is so nothing about the
    // existing CriticalAlerts card changes during the A/B period.
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

    // 5. Mental health alerts from clinical assessments
    assessments.forEach((a) => {
      if (a.residentId == null) return
      const code = codeOf.get(a.residentId) ?? `#${a.residentId}`

      // BDI item-9 suicidal ideation in last 14 days
      if (a.instrument === 'BDI' && a.responsesJson && within(a.administeredDate, 14)) {
        try {
          const parsed = JSON.parse(a.responsesJson)
          const item9 = parsed?.items?.['9'] ?? parsed?.items?.[9]
          if (typeof item9 === 'number' && item9 >= 2) {
            out.push({
              key: `mh-bdi-${a.assessmentId}`,
              source: 'mh-suicide-bdi',
              severity: 'high',
              residentId: a.residentId,
              residentCode: code,
              title: 'BDI item 9: suicidal ideation',
              detail: a.immediateAction ?? 'Item-9 score ≥ 2 — review safety plan',
              date: a.administeredDate,
            })
          }
        } catch {
          // ignore
        }
      }

      // Suicide screen High/Emergency in last 30 days
      if (
        a.instrument === 'SUICIDE_RISK' &&
        within(a.administeredDate, 30) &&
        (a.severityBand === 'High' || a.severityBand === 'Emergency')
      ) {
        out.push({
          key: `mh-suicide-${a.assessmentId}`,
          source: 'mh-suicide-screen',
          severity: 'high',
          residentId: a.residentId,
          residentCode: code,
          title: `Suicide risk: ${a.severityBand}`,
          detail: a.immediateAction ?? `${a.tickCount ?? 0}/6 ticks on suicide screen`,
          date: a.administeredDate,
        })
      }

      // PCL-5 ≥ 33 (provisional PTSD) in last 30 days
      if (
        a.instrument === 'PCL5' &&
        within(a.administeredDate, 30) &&
        a.totalScore != null &&
        a.totalScore >= 33
      ) {
        out.push({
          key: `mh-ptsd-${a.assessmentId}`,
          source: 'mh-ptsd',
          severity: 'medium',
          residentId: a.residentId,
          residentCode: code,
          title: 'PCL-5: probable PTSD',
          detail: `Score ${a.totalScore} ≥ 33 — trauma-informed care plan recommended`,
          date: a.administeredDate,
        })
      }
    })

    // Sort: high severity first, then by date desc
    return out.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1
      const da = a.date ? new Date(a.date).getTime() : 0
      const db = b.date ? new Date(b.date).getTime() : 0
      return db - da
    })
  }, [incidents, visitations, recordings, residents, assessments, codeOf])

  const sourceLabel: Record<AlertSource, string> = {
    incident: 'Incident',
    safety: 'Home Visit',
    session: 'Session',
    risk: 'Risk',
    'mh-suicide-bdi': 'BDI',
    'mh-suicide-screen': 'Suicide',
    'mh-ptsd': 'PTSD',
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
