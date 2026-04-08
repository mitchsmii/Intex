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
  }, [])

  // Must sit above any conditional return so the hook order stays stable.
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
