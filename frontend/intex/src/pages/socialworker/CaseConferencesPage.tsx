import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchResidents,
  fetchInterventionPlans,
} from '../../services/socialWorkerService'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import type { Resident } from '../../types/Resident'
import type { InterventionPlan } from '../../types/InterventionPlan'
import './CaseConferencesPage.css'

type Conference = {
  plan: InterventionPlan
  resident: Resident
  date: Date
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysFromToday(d: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function CaseConferencesPage() {
  const navigate = useNavigate()
  const [residents, setResidents] = useState<Resident[]>([])
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchResidents()
      .then(async (rs) => {
        setResidents(rs)
        // Fetch plans per resident in parallel — /api/interventionplans without filter
        // returns only current SW's plans, but we need one query for the SW-wide view
        const all = await fetchInterventionPlans()
        setPlans(all)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const residentMap = useMemo(() => {
    const m = new Map<number, Resident>()
    residents.forEach((r) => m.set(r.residentId, r))
    return m
  }, [residents])

  const conferences: Conference[] = useMemo(() => {
    return plans
      .filter((p) => p.caseConferenceDate && p.residentId != null)
      .map((p) => {
        const resident = residentMap.get(p.residentId!)
        return resident ? { plan: p, resident, date: new Date(p.caseConferenceDate!) } : null
      })
      .filter((c): c is Conference => c !== null)
  }, [plans, residentMap])

  const todayMs = new Date().setHours(0, 0, 0, 0)

  const upcoming = useMemo(
    () =>
      conferences
        .filter((c) => c.date.getTime() >= todayMs)
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [conferences, todayMs],
  )

  const past = useMemo(
    () =>
      conferences
        .filter((c) => c.date.getTime() < todayMs)
        .sort((a, b) => b.date.getTime() - a.date.getTime()),
    [conferences, todayMs],
  )

  if (loading) return <LoadingSpinner size="lg" />
  if (error) return <p className="cc-error">Error: {error}</p>

  return (
    <div className="cc-page">
      <header className="cc-header">
        <div>
          <h1>Case Conferences</h1>
          <p className="cc-sub">
            Multidisciplinary reviews that create or revise intervention plans.
          </p>
        </div>
        <button
          type="button"
          className="cc-schedule-btn"
          onClick={() => navigate('/socialworker/dashboard/intervention-plans')}
        >
          + Schedule Conference
        </button>
      </header>

      <section className="cc-section">
        <div className="cc-section-header">
          <h2>Upcoming</h2>
          <span className="cc-count">{upcoming.length}</span>
        </div>
        {upcoming.length === 0 ? (
          <p className="cc-empty">No upcoming conferences. Schedule one from the Intervention Plans page.</p>
        ) : (
          <ul className="cc-list">
            {upcoming.map(({ plan, resident, date }) => {
              const days = daysFromToday(date)
              return (
                <li key={`up-${plan.planId}`} className="cc-card cc-card--upcoming">
                  <div className="cc-card-date">
                    <div className="cc-card-date-main">{formatDate(plan.caseConferenceDate)}</div>
                    <div className="cc-card-date-rel">
                      {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}
                    </div>
                  </div>
                  <div className="cc-card-body">
                    <button
                      type="button"
                      className="cc-card-resident"
                      onClick={() =>
                        navigate(`/socialworker/dashboard/residents/${resident.residentId}`)
                      }
                    >
                      {resident.internalCode ?? `#${resident.residentId}`} · Age {resident.presentAge ?? '—'}
                    </button>
                    <div className="cc-card-cat">{plan.planCategory ?? 'Case Conference'}</div>
                    {plan.planDescription && <p className="cc-card-desc">{plan.planDescription}</p>}
                    {plan.status && (
                      <span className="cc-card-status">{plan.status}</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="cc-section">
        <div className="cc-section-header">
          <h2>Past</h2>
          <span className="cc-count">{past.length}</span>
        </div>
        {past.length === 0 ? (
          <p className="cc-empty">No past conferences on record.</p>
        ) : (
          <ul className="cc-list">
            {past.map(({ plan, resident }) => (
              <li key={`past-${plan.planId}`} className="cc-card">
                <div className="cc-card-date">
                  <div className="cc-card-date-main">{formatDate(plan.caseConferenceDate)}</div>
                </div>
                <div className="cc-card-body">
                  <button
                    type="button"
                    className="cc-card-resident"
                    onClick={() =>
                      navigate(`/socialworker/dashboard/residents/${resident.residentId}`)
                    }
                  >
                    {resident.internalCode ?? `#${resident.residentId}`} · Age {resident.presentAge ?? '—'}
                  </button>
                  <div className="cc-card-cat">{plan.planCategory ?? 'Case Conference'}</div>
                  {plan.planDescription && <p className="cc-card-desc">{plan.planDescription}</p>}
                  {plan.status && (
                    <span className="cc-card-status">{plan.status}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default CaseConferencesPage
