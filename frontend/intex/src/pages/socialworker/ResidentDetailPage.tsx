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

  const lastContactDays = useMemo(() => {
    const lastRecording = recordings[0]?.sessionDate
    const lastVisit = visits[0]?.visitDate
    const a = lastRecording ? new Date(lastRecording).getTime() : 0
    const b = lastVisit ? new Date(lastVisit).getTime() : 0
    const latest = Math.max(a, b)
    if (latest === 0) return null
    return Math.floor((Date.now() - latest) / (1000 * 60 * 60 * 24))
  }, [recordings, visits])

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

      <div className="rd-grid">
        {/* Case Information */}
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
            <dt>Reintegration Type</dt>
            <dd>{resident.reintegrationType ?? '—'}</dd>
            <dt>Reintegration Status</dt>
            <dd>{resident.reintegrationStatus ?? '—'}</dd>
            <dt>Length of Stay</dt>
            <dd>{resident.lengthOfStay ?? '—'}</dd>
            <dt>Assigned Social Worker</dt>
            <dd>{resident.assignedSocialWorker ?? '—'}</dd>
            <dt>Referral Source</dt>
            <dd>{resident.referralSource ?? '—'}</dd>
          </dl>
        </section>

        {/* Health & Wellbeing */}
        <section className="rd-card">
          <h2>Health & Wellbeing</h2>
          {!latestHealth ? (
            <p className="rd-empty">No health records yet.</p>
          ) : (
            <>
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
            </>
          )}
        </section>

        {/* Education */}
        <section className="rd-card">
          <h2>Education</h2>
          {!latestEducation ? (
            <p className="rd-empty">No education records yet.</p>
          ) : (
            <>
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
            </>
          )}
        </section>

        {/* Recent Activity */}
        <section className="rd-card">
          <h2>Recent Activity</h2>
          <dl className="rd-dl">
            <dt>Process Recordings</dt>
            <dd>{recordings.length === 5 ? '5+' : recordings.length} recent</dd>
            <dt>Last Recording</dt>
            <dd>{formatDate(recordings[0]?.sessionDate)}</dd>
            <dt>Home Visits</dt>
            <dd>{visits.length === 5 ? '5+' : visits.length} recent</dd>
            <dt>Last Visit</dt>
            <dd>{formatDate(visits[0]?.visitDate)}</dd>
          </dl>
          <div className="rd-contact">
            {lastContactDays == null ? (
              <span className="rd-contact-pill rd-contact-pill--unknown">No contact on record</span>
            ) : (
              <span className={`rd-contact-pill ${
                lastContactDays < 14 ? 'rd-contact-pill--good'
                  : lastContactDays < 30 ? 'rd-contact-pill--warn'
                  : 'rd-contact-pill--bad'
              }`}>
                {lastContactDays} day{lastContactDays === 1 ? '' : 's'} since last contact
              </span>
            )}
          </div>
        </section>

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
      </div>
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
