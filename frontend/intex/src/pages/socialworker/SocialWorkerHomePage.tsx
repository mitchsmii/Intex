import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  fetchResidents,
  fetchUpcomingEvents,
  fetchActionItems,
  fetchIncidentReports,
  fetchHomeVisitations,
  fetchProcessRecordings,
  fetchInterventionPlans,
  fetchAssessments,
} from '../../services/socialWorkerService'
import { api } from '../../services/apiService'
import type { CaseConferenceRequest } from '../../services/apiService'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import ReadinessPipeline from '../../components/socialworker/dashboard/ReadinessPipeline'
import { buildAlerts } from '../../components/socialworker/dashboard/CriticalAlerts'
import TodaysPriorities from '../../components/socialworker/dashboard/TodaysPriorities'
import WeekCalendar from '../../components/socialworker/dashboard/WeekCalendar'
import MentalHealthSnapshot from '../../components/socialworker/dashboard/MentalHealthSnapshot'
import ResidentCard from '../../components/socialworker/dashboard/ResidentCard'
import type { Resident } from '../../types/Resident'
import type { ScheduleEvent } from '../../types/ScheduleEvent'
import type { ActionItem } from '../../types/ActionItem'
import type { IncidentReport } from '../../types/IncidentReport'
import type { HomeVisitation } from '../../types/HomeVisitation'
import type { ProcessRecording } from '../../types/ProcessRecording'
import type { InterventionPlan } from '../../types/InterventionPlan'
import type { Assessment } from '../../types/Assessment'
import '../../components/socialworker/dashboard/dashboard.css'
import './SocialWorkerHomePage.css'

function SocialWorkerHomePage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user } = useAuth()
  const base = pathname.startsWith('/admin') ? '/admin/sw' : '/socialworker/dashboard'
  const [residents, setResidents] = useState<Resident[]>([])
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [actions, setActions] = useState<ActionItem[]>([])
  const [incidents, setIncidents] = useState<IncidentReport[]>([])
  const [visitations, setVisitations] = useState<HomeVisitation[]>([])
  const [recordings, setRecordings] = useState<ProcessRecording[]>([])
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  type DashTab = 'today' | 'wellbeing' | 'residents'
  const [tab, setTab] = useState<DashTab>('today')
  const [confRequests, setConfRequests] = useState<CaseConferenceRequest[]>([])
  const [confActing, setConfActing] = useState<Record<number, boolean>>({})

  useEffect(() => {
    fetchResidents()
      .then(async (r) => {
        setResidents(r)
        const [ev, ai, inc, vis, rec, pl, asm] = await Promise.all([
          fetchUpcomingEvents(r),
          fetchActionItems(r),
          fetchIncidentReports({ unresolvedOnly: true }),
          fetchHomeVisitations({ limit: 500 }),
          fetchProcessRecordings({ limit: 500 }),
          fetchInterventionPlans(),
          fetchAssessments(),
        ])
        setEvents(ev)
        setActions(ai)
        setIncidents(inc)
        setVisitations(vis)
        setRecordings(rec)
        setPlans(pl)
        setAssessments(asm)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    api.getCaseConferenceRequests().then(setConfRequests).catch(() => {})
  }, [])

  // Must sit above any conditional return so hook order stays stable.
  const mergedAlerts = useMemo(
    () => buildAlerts({ residents, incidents, visitations, recordings, assessments }),
    [residents, incidents, visitations, recordings, assessments],
  )

  if (loading) return <LoadingSpinner size="lg" />
  if (error) return <p className="sw-home-error">Error: {error}</p>

  const goToResident = (r: Resident) =>
    navigate(`${base}/residents/${r.residentId}`)
  const goToResidentById = (id: number) =>
    navigate(`${base}/residents/${id}`)

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const rawName = user?.username ?? ''
  const firstName = rawName
    ? rawName.charAt(0).toUpperCase() + rawName.slice(1).split(/[@.\s]/)[0]
    : ''
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="sw-dash">
      <header className="sw-dash-masthead sw-dash-masthead--compact">
        <div className="sw-dash-masthead-line">
          <h1>
            {greeting}
            {firstName ? (
              <>
                , <em>{firstName}</em>
              </>
            ) : null}
            .
          </h1>
          <div className="sw-dash-chips">
            <span className="sw-dash-chip">{today}</span>
            <span className="sw-dash-chip">
              <strong>{incidents.length}</strong> open{' '}
              {incidents.length === 1 ? 'incident' : 'incidents'}
            </span>
            <span className="sw-dash-chip">
              <strong>{actions.length}</strong> {actions.length === 1 ? 'task' : 'tasks'}
            </span>
            <span className="sw-dash-chip">
              <strong>{residents.length}</strong> residents
            </span>
          </div>
        </div>
      </header>

      <nav className="sw-dash-tabs">
        <button
          type="button"
          className={`sw-dash-tab-btn${tab === 'today' ? ' sw-dash-tab-active' : ''}`}
          onClick={() => setTab('today')}
        >
          Today
        </button>
        <button
          type="button"
          className={`sw-dash-tab-btn${tab === 'wellbeing' ? ' sw-dash-tab-active' : ''}`}
          onClick={() => setTab('wellbeing')}
        >
          Wellbeing
        </button>
        <button
          type="button"
          className={`sw-dash-tab-btn${tab === 'residents' ? ' sw-dash-tab-active' : ''}`}
          onClick={() => setTab('residents')}
        >
          Residents
        </button>
      </nav>

      {tab === 'today' && (
        <div className="sw-dash-tab-content">
          <TodaysPriorities
            alerts={mergedAlerts}
            actions={actions}
            onSelect={goToResidentById}
          />
          {confRequests.filter((r) => ['Pending', 'Counter-Proposed', 'Approved', 'Accepted'].includes(r.status)).length > 0 && (
            <section className="conf-req-card">
              <h3 className="conf-req-title">Conference Requests</h3>
              <ul className="conf-req-list">
                {confRequests
                  .filter((r) => ['Pending', 'Counter-Proposed', 'Approved', 'Accepted'].includes(r.status))
                  .map((r) => {
                    const fmtDate = (iso: string | null) =>
                      iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'
                    const isCounter = r.status === 'Counter-Proposed'
                    const isConfirmed = r.status === 'Approved' || r.status === 'Accepted'
                    return (
                      <li key={r.requestId} className={`conf-req-row conf-req-row--${isConfirmed ? 'confirmed' : isCounter ? 'counter' : 'pending'}`}>
                        <div className="conf-req-info">
                          <span className={`conf-req-status conf-req-status--${isConfirmed ? 'confirmed' : isCounter ? 'counter' : 'pending'}`}>
                            {isConfirmed ? 'Confirmed' : isCounter ? 'Counter-Proposed' : 'Awaiting approval'}
                          </span>
                          <span className="conf-req-date">
                            {isCounter
                              ? `${fmtDate(r.counterDate)} at ${r.counterTime ?? '—'}`
                              : `${fmtDate(r.requestedDate)} at ${r.requestedTime ?? '—'}`
                            }
                          </span>
                          <span className="conf-req-residents">
                            {(() => { try { return JSON.parse(r.residentIds).length } catch { return 0 } })()}
                            {' '}resident{(() => { try { return JSON.parse(r.residentIds).length !== 1 ? 's' : '' } catch { return 's' } })()}
                          </span>
                        </div>
                        {isCounter && (
                          <div className="conf-req-actions">
                            <span className="conf-req-hint">Admin suggested a different time</span>
                            <button
                              type="button"
                              className="conf-req-btn conf-req-btn--accept"
                              disabled={confActing[r.requestId]}
                              onClick={async () => {
                                setConfActing((p) => ({ ...p, [r.requestId]: true }))
                                try {
                                  const updated = await api.acceptCaseConferenceRequest(r.requestId)
                                  setConfRequests((prev) => prev.map((x) => x.requestId === r.requestId ? updated : x))
                                } catch { /* ignore */ }
                                setConfActing((p) => ({ ...p, [r.requestId]: false }))
                              }}
                            >
                              {confActing[r.requestId] ? '…' : 'Accept'}
                            </button>
                          </div>
                        )}
                      </li>
                    )
                  })}
              </ul>
            </section>
          )}

          <WeekCalendar
            events={events}
            onEventClick={(ev) => goToResidentById(ev.residentId)}
          />
        </div>
      )}

      {tab === 'wellbeing' && (
        <div className="sw-dash-tab-content">
          <ReadinessPipeline
            residents={residents}
            recordings={recordings}
            visitations={visitations}
            plans={plans}
            assessments={assessments}
            onResidentClick={goToResidentById}
          />
          <MentalHealthSnapshot
            residents={residents}
            assessments={assessments}
            onResidentClick={goToResidentById}
          />
        </div>
      )}

      {tab === 'residents' && (
        <div className="sw-dash-tab-content">
          <section className="sw-dash-section">
            <header className="sw-dash-section-header">
              <h2>My Residents</h2>
              <span className="sw-dash-mock">{residents.length} total</span>
            </header>
            <div className="sw-dash-grid">
              {residents.map((r) => (
                <ResidentCard key={r.residentId} resident={r} onClick={goToResident} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default SocialWorkerHomePage
