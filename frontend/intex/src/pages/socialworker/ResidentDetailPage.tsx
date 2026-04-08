import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import type { Alert } from '../../components/socialworker/dashboard/CriticalAlerts'
import {
  fetchResident,
  fetchSafehouses,
  fetchEducationRecords,
  fetchHealthWellbeingRecords,
  fetchProcessRecordings,
  fetchHomeVisitations,
  fetchIncidentReports,
  fetchAssessments,
} from '../../services/socialWorkerService'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import IncidentBanner from '../../components/socialworker/IncidentBanner'
import type { Resident } from '../../types/Resident'
import type { Safehouse } from '../../types/Safehouse'
import type { EducationRecord } from '../../types/EducationRecord'
import type { HealthWellbeingRecord } from '../../types/HealthWellbeingRecord'
import type { ProcessRecording } from '../../types/ProcessRecording'
import type { HomeVisitation } from '../../types/HomeVisitation'
import type { IncidentReport } from '../../types/IncidentReport'
import type { Assessment, Instrument } from '../../types/Assessment'
import { severityBucket } from '../../utils/assessmentScoring'
import './ResidentDetailPage.css'

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const SUB_CAT_LABELS: Array<[keyof Resident, string]> = [
  ['subCatOrphaned', 'Orphaned'],
  ['subCatTrafficked', 'Trafficked'],
  ['subCatChildLabor', 'Child Labor'],
  ['subCatPhysicalAbuse', 'Physical Abuse'],
  ['subCatSexualAbuse', 'Sexual Abuse'],
  ['subCatOsaec', 'OSAEC'],
  ['subCatCicl', 'CICL'],
  ['subCatAtRisk', 'At-Risk'],
  ['subCatStreetChild', 'Street Child'],
  ['subCatChildWithHiv', 'HIV+'],
]

function ResidentDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const incomingAlert = (location.state as { alert?: Alert } | null)?.alert ?? null
  const [alertDismissed, setAlertDismissed] = useState(false)
  const residentId = id ? Number(id) : null

  const [resident, setResident] = useState<Resident | null>(null)
  const [safehouseName, setSafehouseName] = useState<string | null>(null)
  const [education, setEducation] = useState<EducationRecord[]>([])
  const [health, setHealth] = useState<HealthWellbeingRecord[]>([])
  const [recordings, setRecordings] = useState<ProcessRecording[]>([])
  const [visits, setVisits] = useState<HomeVisitation[]>([])
  const [incidents, setIncidents] = useState<IncidentReport[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (residentId == null) return
    setLoading(true)
    Promise.all([
      fetchResident(residentId),
      fetchSafehouses().catch(() => [] as Safehouse[]),
      fetchEducationRecords({ residentId }),
      fetchHealthWellbeingRecords({ residentId }),
      fetchProcessRecordings({ residentId, limit: 5 }),
      fetchHomeVisitations({ residentId, limit: 5 }),
      fetchIncidentReports({ residentId }),
      fetchAssessments({ residentId }),
    ])
      .then(([r, sh, edu, hw, rec, vis, inc, asm]) => {
        setResident(r)
        const matched = sh.find((s) => s.safehouseId === r.safehouseId)
        setSafehouseName(matched?.name ?? null)
        setEducation(edu)
        setHealth(hw)
        setRecordings(rec)
        setVisits(vis)
        setIncidents(inc)
        setAssessments(asm)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [residentId])

  const latestHealth = useMemo<HealthWellbeingRecord | null>(() => {
    if (health.length === 0) return null
    return [...health].sort((a, b) => {
      const ad = a.recordDate ? new Date(a.recordDate).getTime() : 0
      const bd = b.recordDate ? new Date(b.recordDate).getTime() : 0
      return bd - ad
    })[0]
  }, [health])

  const latestEducation = useMemo<EducationRecord | null>(() => {
    if (education.length === 0) return null
    return [...education].sort((a, b) => {
      const ad = a.recordDate ? new Date(a.recordDate).getTime() : 0
      const bd = b.recordDate ? new Date(b.recordDate).getTime() : 0
      return bd - ad
    })[0]
  }, [education])

  const unresolvedIncidents = useMemo(() => {
    const sevRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
    return incidents
      .filter((i) => i.resolved !== true)
      .sort((a, b) => {
        const sa = sevRank[(a.severity ?? '').toLowerCase()] ?? 3
        const sb = sevRank[(b.severity ?? '').toLowerCase()] ?? 3
        if (sa !== sb) return sa - sb
        const ad = a.incidentDate ? new Date(a.incidentDate).getTime() : 0
        const bd = b.incidentDate ? new Date(b.incidentDate).getTime() : 0
        return bd - ad
      })
  }, [incidents])

  function handleResolved(updated: IncidentReport) {
    setIncidents((prev) =>
      prev.map((i) => (i.incidentId === updated.incidentId ? updated : i)),
    )
  }

  const latestAssessmentByInstrument = useMemo(() => {
    const map = new Map<Instrument, Assessment>()
    for (const a of assessments) {
      const existing = map.get(a.instrument)
      if (
        !existing ||
        new Date(a.administeredDate).getTime() > new Date(existing.administeredDate).getTime()
      ) {
        map.set(a.instrument, a)
      }
    }
    return map
  }, [assessments])

  const lastContact = useMemo(() => {
    const lastRecording = recordings[0]?.sessionDate
    const lastVisit = visits[0]?.visitDate
    const a = lastRecording ? new Date(lastRecording).getTime() : 0
    const b = lastVisit ? new Date(lastVisit).getTime() : 0
    const latest = Math.max(a, b)
    if (latest === 0) return { days: null as number | null, kind: null as string | null }
    const days = Math.floor((Date.now() - latest) / (1000 * 60 * 60 * 24))
    const kind = a >= b ? 'Process recording' : 'Home visit'
    return { days, kind }
  }, [recordings, visits])
  const lastContactDays = lastContact.days

  type TimelineItem = {
    id: string
    date: string
    kind: 'recording' | 'visit' | 'assessment' | 'incident'
    title: string
    detail?: string | null
    severity?: 'high' | 'medium' | 'low' | null
  }
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = []
    for (const r of recordings) {
      if (!r.sessionDate) continue
      items.push({
        id: `r-${r.recordingId}`,
        date: r.sessionDate,
        kind: 'recording',
        title: 'Process recording',
        detail: r.sessionType ?? r.emotionalStateObserved ?? null,
      })
    }
    for (const v of visits) {
      if (!v.visitDate) continue
      items.push({
        id: `v-${v.visitationId}`,
        date: v.visitDate,
        kind: 'visit',
        title: 'Home visit',
        detail: v.purpose ?? v.visitOutcome ?? null,
      })
    }
    for (const a of assessments) {
      items.push({
        id: `a-${a.assessmentId}`,
        date: a.administeredDate,
        kind: 'assessment',
        title: `${a.instrument} assessment`,
        detail: a.severityBand ?? null,
      })
    }
    for (const i of incidents) {
      if (!i.incidentDate) continue
      items.push({
        id: `i-${i.incidentId}`,
        date: i.incidentDate,
        kind: 'incident',
        title: i.incidentType ?? 'Incident',
        detail: i.description ?? null,
        severity: (i.severity ?? null) as TimelineItem['severity'],
      })
    }
    return items
      .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())
      .slice(0, 12)
  }, [recordings, visits, assessments, incidents])

  if (loading) return <LoadingSpinner size="lg" />
  if (error) return <p className="rd-error">Error: {error}</p>
  if (!resident) return <p className="rd-error">Resident not found.</p>

  const subCats = SUB_CAT_LABELS.filter(([key]) => resident[key] === true).map(([, label]) => label)

  return (
    <div className="rd-page">
      <Link to="/socialworker/dashboard/residents" className="rd-back">
        ← Back to Residents
      </Link>

      {unresolvedIncidents.length > 0 && (
        <section className="rd-incidents">
          {unresolvedIncidents.map((inc) => (
            <IncidentBanner
              key={inc.incidentId}
              incident={inc}
              residentId={residentId!}
              onResolved={handleResolved}
            />
          ))}
        </section>
      )}

      {incomingAlert && !alertDismissed && incomingAlert.source !== 'incident' && (
        <div className={`rd-alert-banner rd-alert-banner--${incomingAlert.severity}`}>
          <div className="rd-alert-banner-body">
            <div className="rd-alert-banner-top">
              <span className={`rd-alert-tag rd-alert-tag--${incomingAlert.source}`}>
                {incomingAlert.source === 'safety' ? 'Home Visit'
                  : incomingAlert.source === 'session' ? 'Session'
                  : 'Risk'}
              </span>
              <span className="rd-alert-title">{incomingAlert.title}</span>
              {incomingAlert.date && (
                <span className="rd-alert-date">
                  {new Date(incomingAlert.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>
            <p className="rd-alert-detail">{incomingAlert.detail}</p>
            <p className="rd-alert-context">
              You were brought here from a Critical Alert on the dashboard.
            </p>
          </div>
          <button
            type="button"
            className="rd-alert-dismiss"
            onClick={() => setAlertDismissed(true)}
            aria-label="Dismiss alert"
          >
            ×
          </button>
        </div>
      )}

      <header className="rd-header">
        <h1>{resident.internalCode ?? `#${resident.residentId}`}</h1>
        <div className="rd-header-meta">
          <span>Age {resident.presentAge ?? '—'}</span>
          <span>·</span>
          <span className={`rd-risk rd-risk--${(resident.currentRiskLevel ?? 'unknown').toLowerCase()}`}>
            {resident.currentRiskLevel ?? 'Unknown'} Risk
          </span>
          <span>·</span>
          <span className={`rd-status rd-status--${(resident.caseStatus ?? '').toLowerCase()}`}>
            {resident.caseStatus ?? 'Unknown'}
          </span>
          {resident.caseCategory && (
            <>
              <span>·</span>
              <span>{resident.caseCategory}</span>
            </>
          )}
          {safehouseName && (
            <>
              <span>·</span>
              <span>{safehouseName}</span>
            </>
          )}
          {resident.dateOfAdmission && (
            <>
              <span>·</span>
              <span>Admitted {formatDate(resident.dateOfAdmission)}</span>
            </>
          )}
        </div>
      </header>

      {/* Status strip — the "are they okay / am I behind" answer */}
      <section className="rd-status-strip">
        <div className="rd-status-cell">
          <div className="rd-status-label">Last contact</div>
          <div className="rd-status-value">
            {lastContactDays == null
              ? '—'
              : `${lastContactDays} day${lastContactDays === 1 ? '' : 's'} ago`}
          </div>
          <div className="rd-status-sub">
            {lastContact.kind ?? 'No contact on record'}
          </div>
        </div>
        <div className="rd-status-cell">
          <div className="rd-status-label">Mental health</div>
          <div className="rd-status-mh">
            {(['BDI', 'PCL5', 'SUICIDE_RISK'] as Instrument[]).map((inst) => {
              const latest = latestAssessmentByInstrument.get(inst)
              const bucket = latest ? severityBucket(latest.severityBand) : 'neutral'
              const label = inst === 'PCL5' ? 'PCL-5' : inst === 'SUICIDE_RISK' ? 'Suicide' : 'BDI'
              return (
                <div key={inst} className={`rd-status-mh-chip rd-status-mh-chip--${bucket}`}>
                  <span className="rd-status-mh-label">{label}</span>
                  <span className="rd-status-mh-value">
                    {latest ? (latest.totalScore ?? latest.tickCount ?? '—') : '—'}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="rd-status-sub">
            {assessments.length === 0
              ? 'Not screened'
              : `${assessments.length} on record`}
          </div>
        </div>
        <div className="rd-status-cell">
          <div className="rd-status-label">Open items</div>
          <div className="rd-status-value">
            {unresolvedIncidents.length}
          </div>
          <div className="rd-status-sub">
            {unresolvedIncidents.length === 1 ? 'unresolved incident' : 'unresolved incidents'}
          </div>
        </div>
      </section>

      <div className="rd-grid">
        {/* Activity Timeline — chronological narrative, the primary view */}
        <section className="rd-card rd-card--timeline">
          <h2>Activity</h2>
          {timeline.length === 0 ? (
            <p className="rd-empty">No recorded activity yet.</p>
          ) : (
            <ol className="rd-timeline">
              {timeline.map((t) => (
                <li key={t.id} className={`rd-timeline-item rd-timeline-item--${t.kind}`}>
                  <div className="rd-timeline-dot" aria-hidden />
                  <div className="rd-timeline-body">
                    <div className="rd-timeline-top">
                      <span className="rd-timeline-title">{t.title}</span>
                      <span className="rd-timeline-date">{formatDate(t.date)}</span>
                    </div>
                    {t.detail && <div className="rd-timeline-detail">{t.detail}</div>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Right column: Mental Health + compact Case Info */}
        <div className="rd-side">
          {/* Mental Health Snapshot */}
          <section className="rd-card">
            <h2>Mental Health</h2>
            {assessments.length === 0 ? (
              <p className="rd-empty">No assessments on record. Schedule one from the Assessments page.</p>
            ) : (
              <>
                <div className="rd-mh-grid">
                  {(['PCL5', 'BDI', 'BAI', 'SUICIDE_RISK'] as Instrument[]).map((inst) => {
                    const latest = latestAssessmentByInstrument.get(inst)
                    const bucket = latest ? severityBucket(latest.severityBand) : 'neutral'
                    const label = inst === 'PCL5' ? 'PCL-5'
                      : inst === 'SUICIDE_RISK' ? 'Suicide Risk'
                      : inst
                    return (
                      <div key={inst} className={`rd-mh-cell rd-mh-cell--${bucket}`}>
                        <div className="rd-mh-label">{label}</div>
                        <div className="rd-mh-value">
                          {latest ? (latest.totalScore ?? latest.tickCount ?? '—') : '—'}
                        </div>
                        <div className="rd-mh-band">{latest?.severityBand ?? 'No data'}</div>
                      </div>
                    )
                  })}
                </div>
                <div className="rd-mh-meta">
                  {assessments.length} {assessments.length === 1 ? 'assessment' : 'assessments'} on record
                </div>
              </>
            )}
          </section>

          {/* Case Information — reference, compact */}
          <section className="rd-card">
            <h2>Case Information</h2>
            <dl className="rd-dl">
              <dt>Category</dt>
              <dd>{resident.caseCategory ?? '—'}</dd>
              {subCats.length > 0 && (
                <>
                  <dt>Sub-categories</dt>
                  <dd>
                    <div className="rd-chips">
                      {subCats.map((c) => (
                        <span key={c} className="rd-chip">{c}</span>
                      ))}
                    </div>
                  </dd>
                </>
              )}
              <dt>Reintegration</dt>
              <dd>
                {resident.reintegrationType ?? '—'}
                {resident.reintegrationStatus ? ` · ${resident.reintegrationStatus}` : ''}
              </dd>
              <dt>Length of Stay</dt>
              <dd>{resident.lengthOfStay ?? '—'}</dd>
              <dt>Assigned SW</dt>
              <dd>{resident.assignedSocialWorker ?? '—'}</dd>
              <dt>Referral</dt>
              <dd>{resident.referralSource ?? '—'}</dd>
            </dl>
          </section>
        </div>
      </div>

      {/* Reference cards — only render if data exists */}
      {(latestHealth || latestEducation) && (
        <div className="rd-grid rd-grid--refs">
          {latestHealth && (
            <section className="rd-card">
              <h2>Health & Wellbeing</h2>
              <div className="rd-scores">
                <ScoreBar label="General Health" value={latestHealth.generalHealthScore} />
                <ScoreBar label="Nutrition" value={latestHealth.nutritionScore} />
                <ScoreBar label="Sleep Quality" value={latestHealth.sleepQualityScore} />
                <ScoreBar label="Energy Level" value={latestHealth.energyLevelScore} />
              </div>
              <div className="rd-vitals">
                {latestHealth.heightCm != null && <span>Height: {latestHealth.heightCm} cm</span>}
                {latestHealth.weightKg != null && <span>Weight: {latestHealth.weightKg} kg</span>}
                {latestHealth.bmi != null && <span>BMI: {latestHealth.bmi}</span>}
              </div>
              <div className="rd-checkups">
                <CheckupChip label="Medical" done={latestHealth.medicalCheckupDone} />
                <CheckupChip label="Dental" done={latestHealth.dentalCheckupDone} />
                <CheckupChip label="Psychological" done={latestHealth.psychologicalCheckupDone} />
              </div>
              <div className="rd-record-date">
                Last record: {formatDate(latestHealth.recordDate)} · {health.length} total
              </div>
            </section>
          )}

          {latestEducation && (
            <section className="rd-card">
              <h2>Education</h2>
              <div className="rd-edu-top">
                {latestEducation.enrollmentStatus && (
                  <span className="rd-enrollment">{latestEducation.enrollmentStatus}</span>
                )}
                {latestEducation.educationLevel && (
                  <span className="rd-edu-level">{latestEducation.educationLevel}</span>
                )}
              </div>
              {latestEducation.schoolName && (
                <div className="rd-school">{latestEducation.schoolName}</div>
              )}
              <PercentBar label="Attendance" value={latestEducation.attendanceRate} />
              <PercentBar label="Progress" value={latestEducation.progressPercent} />
              {latestEducation.completionStatus && (
                <div className="rd-completion">
                  Completion: <strong>{latestEducation.completionStatus}</strong>
                </div>
              )}
              <div className="rd-record-date">
                Last record: {formatDate(latestEducation.recordDate)} · {education.length} total
              </div>
            </section>
          )}
        </div>
      )}

      {(!latestHealth || !latestEducation) && (
        <p className="rd-refs-empty">
          {!latestHealth && !latestEducation
            ? 'No health or education records on file.'
            : !latestHealth
              ? 'No health records on file.'
              : 'No education records on file.'}
        </p>
      )}
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const pct = value != null ? Math.max(0, Math.min(100, (value / 10) * 100)) : 0
  return (
    <div className="rd-score">
      <div className="rd-score-row">
        <span>{label}</span>
        <span className="rd-score-val">{value != null ? value.toFixed(1) : '—'}/10</span>
      </div>
      <div className="rd-score-bar">
        <div
          className={`rd-score-fill ${
            pct >= 70 ? 'rd-score-fill--good'
              : pct >= 40 ? 'rd-score-fill--mid'
              : 'rd-score-fill--low'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function PercentBar({ label, value }: { label: string; value: number | null }) {
  const pct = value != null ? Math.max(0, Math.min(100, value)) : 0
  return (
    <div className="rd-score">
      <div className="rd-score-row">
        <span>{label}</span>
        <span className="rd-score-val">{value != null ? `${value.toFixed(0)}%` : '—'}</span>
      </div>
      <div className="rd-score-bar">
        <div
          className={`rd-score-fill ${
            pct >= 85 ? 'rd-score-fill--good'
              : pct >= 70 ? 'rd-score-fill--mid'
              : 'rd-score-fill--low'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function CheckupChip({ label, done }: { label: string; done: boolean | null }) {
  return (
    <span className={`rd-checkup ${done ? 'rd-checkup--done' : 'rd-checkup--due'}`}>
      {done ? '✓' : '·'} {label}
    </span>
  )
}

export default ResidentDetailPage
