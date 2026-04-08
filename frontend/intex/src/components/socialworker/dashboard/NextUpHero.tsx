import { useNavigate, useLocation } from 'react-router-dom'
import type { ScheduleEvent } from '../../../types/ScheduleEvent'

interface Props {
  events: ScheduleEvent[]
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `Today · ${time}`
  if (isTomorrow) return `Tomorrow · ${time}`
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + time
}

function NextUpHero({ events }: Props) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const base = pathname.startsWith('/admin') ? '/admin/sw' : '/socialworker/dashboard'

  const next = [...events]
    .filter((e) => new Date(e.date).getTime() >= Date.now() - 60 * 60 * 1000)
    .sort((a, b) => a.date.localeCompare(b.date))[0]

  return (
    <section className="sw-dash-nextup">
      <div className="sw-dash-nextup-main">
        <span className="sw-dash-nextup-eyebrow">Next up</span>
        {next ? (
          <>
            <h2 className="sw-dash-nextup-title">
              {next.type === 'HomeVisit' ? 'Home visit' : 'Case conference'} with{' '}
              <em>{next.residentCode}</em>
            </h2>
            <p className="sw-dash-nextup-meta">
              {formatWhen(next.date)}
              {next.location ? <> · {next.location}</> : null}
            </p>
          </>
        ) : (
          <>
            <h2 className="sw-dash-nextup-title">Nothing scheduled</h2>
            <p className="sw-dash-nextup-meta">Your next 7 days are clear.</p>
          </>
        )}
      </div>
      <div className="sw-dash-nextup-actions">
        {next && (
          <button
            type="button"
            className="sw-dash-nextup-btn sw-dash-nextup-btn--primary"
            onClick={() => navigate(`${base}/residents/${next.residentId}`)}
          >
            Open resident
          </button>
        )}
        <button
          type="button"
          className="sw-dash-nextup-btn"
          onClick={() => navigate(`${base}/process-recordings`)}
        >
          New recording
        </button>
        <button
          type="button"
          className="sw-dash-nextup-btn"
          onClick={() => navigate(`${base}/home-visits`)}
        >
          Log visit
        </button>
      </div>
    </section>
  )
}

export default NextUpHero
