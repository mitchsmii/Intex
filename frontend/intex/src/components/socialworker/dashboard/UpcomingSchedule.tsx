import type { ScheduleEvent } from '../../../types/ScheduleEvent'

interface Props {
  events: ScheduleEvent[]
}

function formatDay(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function UpcomingSchedule({ events }: Props) {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date))
  const grouped = new Map<string, ScheduleEvent[]>()
  sorted.forEach((e) => {
    const day = formatDay(e.date)
    if (!grouped.has(day)) grouped.set(day, [])
    grouped.get(day)!.push(e)
  })

  return (
    <section className="sw-dash-section">
      <header className="sw-dash-section-header">
        <h2>Upcoming Schedule</h2>
        <span className="sw-dash-mock">next 7 days</span>
      </header>
      {grouped.size === 0 ? (
        <p className="sw-dash-empty">No upcoming visits or conferences.</p>
      ) : (
        <div className="sw-dash-schedule">
          {Array.from(grouped.entries()).map(([day, items]) => (
            <div key={day} className="sw-dash-schedule-day">
              <div className="sw-dash-schedule-date">{day}</div>
              <ul>
                {items.map((e) => (
                  <li key={e.id} className="sw-dash-schedule-event">
                    <span className={`event-type event-type--${e.type.toLowerCase()}`}>
                      {e.type === 'HomeVisit' ? 'Home Visit' : 'Case Conf.'}
                    </span>
                    <span className="event-time">{formatTime(e.date)}</span>
                    <span className="event-resident">{e.residentCode}</span>
                    {e.location && <span className="event-location">{e.location}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default UpcomingSchedule
