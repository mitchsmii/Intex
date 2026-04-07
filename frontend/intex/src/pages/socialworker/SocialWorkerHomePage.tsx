import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  fetchResidents,
  fetchUpcomingEvents,
  fetchActionItems,
  fetchIncidentReports,
  fetchHomeVisitations,
  fetchProcessRecordings,
  fetchInterventionPlans,
} from '../../services/socialWorkerService'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import StatStrip from '../../components/socialworker/dashboard/StatStrip'
import UpcomingSchedule from '../../components/socialworker/dashboard/UpcomingSchedule'
import ReadinessPipeline from '../../components/socialworker/dashboard/ReadinessPipeline'
import ActionItems from '../../components/socialworker/dashboard/ActionItems'
import CriticalAlerts, { type Alert } from '../../components/socialworker/dashboard/CriticalAlerts'
import ResidentCard from '../../components/socialworker/dashboard/ResidentCard'
import type { Resident } from '../../types/Resident'
import type { ScheduleEvent } from '../../types/ScheduleEvent'
import type { ActionItem } from '../../types/ActionItem'
import type { IncidentReport } from '../../types/IncidentReport'
import type { HomeVisitation } from '../../types/HomeVisitation'
import type { ProcessRecording } from '../../types/ProcessRecording'
import type { InterventionPlan } from '../../types/InterventionPlan'
import '../../components/socialworker/dashboard/dashboard.css'
import './SocialWorkerHomePage.css'

function SocialWorkerHomePage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const base = pathname.startsWith('/admin') ? '/admin/sw' : '/socialworker/dashboard'
  const [residents, setResidents] = useState<Resident[]>([])
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [actions, setActions] = useState<ActionItem[]>([])
  const [incidents, setIncidents] = useState<IncidentReport[]>([])
  const [visitations, setVisitations] = useState<HomeVisitation[]>([])
  const [recordings, setRecordings] = useState<ProcessRecording[]>([])
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchResidents()
      .then(async (r) => {
        setResidents(r)
        const [ev, ai, inc, vis, rec, pl] = await Promise.all([
          fetchUpcomingEvents(r),
          fetchActionItems(r),
          fetchIncidentReports({ unresolvedOnly: true }),
          fetchHomeVisitations({ limit: 500 }),
          fetchProcessRecordings({ limit: 500 }),
          fetchInterventionPlans(),
        ])
        setEvents(ev)
        setActions(ai)
        setIncidents(inc)
        setVisitations(vis)
        setRecordings(rec)
        setPlans(pl)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

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

  return (
    <div className="sw-dash">
      <div className="sw-dash-header">
        <div>
          <h1>Welcome back</h1>
          <div className="sw-dash-header-meta">{today}</div>
        </div>
        <button
          type="button"
          className="sw-dash-add-btn"
          onClick={() => navigate(`${base}/residents`)}
        >
          + Add Resident
        </button>
      </div>

      <StatStrip residents={residents} actionItems={actions} />

      <CriticalAlerts
        residents={residents}
        incidents={incidents}
        visitations={visitations}
        recordings={recordings}
        onAlertClick={(alert: Alert) =>
          navigate(`/socialworker/dashboard/residents/${alert.residentId}`, {
            state: { alert },
          })
        }
      />

      <ReadinessPipeline
        residents={residents}
        recordings={recordings}
        visitations={visitations}
        plans={plans}
        onResidentClick={goToResidentById}
      />

      <UpcomingSchedule events={events} />

      <ActionItems items={actions} onItemClick={goToResidentById} />

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
  )
}

export default SocialWorkerHomePage
