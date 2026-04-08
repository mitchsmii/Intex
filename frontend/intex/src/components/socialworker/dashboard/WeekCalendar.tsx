import { useMemo, useState } from 'react'
import type { ScheduleEvent } from '../../../types/ScheduleEvent'

/**
 * Google-calendar-style week view. 7 day columns × hourly rows, with events
 * absolutely positioned on each day column by their start time. Events don't
 * currently carry a duration, so each block is rendered as a flat 60-minute
 * slot — good enough to see the shape of the week without cramming details.
 */

interface Props {
  events: ScheduleEvent[]
  onEventClick?: (event: ScheduleEvent) => void
}

const START_HOUR = 6 // 6 AM
const END_HOUR = 20 // 8 PM
const HOUR_HEIGHT = 34 // px per hour (compact)
const EVENT_HEIGHT = 56 // px — taller than one slot so all 3 text lines fit
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function startOfWeek(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  out.setDate(out.getDate() - out.getDay()) // Sunday-start
  return out
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatHour(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  const suffix = hour < 12 ? 'am' : 'pm'
  return `${h12}${suffix}`
}

function formatEventTime(iso: string): string {
  const d = new Date(iso)
  let h = d.getHours()
  const m = d.getMinutes()
  const suffix = h < 12 ? 'a' : 'p'
  h = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h}${suffix}` : `${h}:${m.toString().padStart(2, '0')}${suffix}`
}

function WeekCalendar({ events, onEventClick }: Props) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const hours = useMemo(() => {
    const out: number[] = []
    for (let h = START_HOUR; h < END_HOUR; h++) out.push(h)
    return out
  }, [])

  // Group events by day index (0-6) so the rendering loop is cheap.
  const eventsByDay = useMemo(() => {
    const buckets: ScheduleEvent[][] = Array.from({ length: 7 }, () => [])
    events.forEach((ev) => {
      const d = new Date(ev.date)
      for (let i = 0; i < 7; i++) {
        if (sameDay(d, days[i])) {
          buckets[i].push(ev)
          break
        }
      }
    })
    return buckets
  }, [events, days])

  const today = new Date()
  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6)
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `${fmt(weekStart)} – ${fmt(end)}, ${end.getFullYear()}`
  }, [weekStart])

  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT

  return (
    <section className="wc-card">
      <header className="wc-header">
        <h2 className="wc-title">This Week</h2>
        <div className="wc-nav">
          <button
            type="button"
            className="wc-nav-btn"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            aria-label="Previous week"
          >
            ←
          </button>
          <button
            type="button"
            className="wc-nav-btn wc-nav-today"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
          >
            Today
          </button>
          <button
            type="button"
            className="wc-nav-btn"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            aria-label="Next week"
          >
            →
          </button>
          <span className="wc-range">{weekLabel}</span>
        </div>
      </header>

      <div className="wc-grid-wrap">
        {/* Day headers */}
        <div className="wc-day-headers">
          <div className="wc-gutter-spacer" />
          {days.map((d, i) => {
            const isToday = sameDay(d, today)
            return (
              <div
                key={i}
                className={`wc-day-header${isToday ? ' wc-day-header--today' : ''}`}
              >
                <div className="wc-day-name">{DAY_NAMES[i]}</div>
                <div className="wc-day-num">{d.getDate()}</div>
              </div>
            )
          })}
        </div>

        {/* Hour rows + day columns */}
        <div className="wc-body" style={{ height: totalHeight }}>
          {/* Hour labels on the left */}
          <div className="wc-gutter">
            {hours.map((h) => (
              <div
                key={h}
                className="wc-hour-label"
                style={{ height: HOUR_HEIGHT }}
              >
                {formatHour(h)}
              </div>
            ))}
          </div>

          {/* Seven day columns, each with hour grid lines + absolute events */}
          {days.map((d, i) => {
            const isToday = sameDay(d, today)
            return (
              <div
                key={i}
                className={`wc-day-col${isToday ? ' wc-day-col--today' : ''}`}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    className="wc-hour-slot"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {eventsByDay[i].map((ev) => {
                  const evDate = new Date(ev.date)
                  const hour = evDate.getHours()
                  const minute = evDate.getMinutes()
                  if (hour < START_HOUR || hour >= END_HOUR) return null
                  const top = (hour - START_HOUR) * HOUR_HEIGHT + (minute / 60) * HOUR_HEIGHT
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      className={`wc-event wc-event--${ev.type === 'HomeVisit' ? 'visit' : 'conference'}`}
                      style={{ top, height: EVENT_HEIGHT }}
                      onClick={() => onEventClick?.(ev)}
                      title={`${ev.type === 'HomeVisit' ? 'Home visit' : 'Case conference'} with ${ev.residentCode}${ev.location ? ' · ' + ev.location : ''}`}
                    >
                      <div className="wc-event-time">{formatEventTime(ev.date)}</div>
                      <div className="wc-event-title">
                        {ev.type === 'HomeVisit' ? 'Home visit' : 'Case conf.'} · {ev.residentCode}
                      </div>
                      {ev.location && <div className="wc-event-loc">{ev.location}</div>}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      <div className="wc-legend">
        <span className="wc-legend-item">
          <span className="wc-legend-dot wc-legend-dot--visit" /> Home visit
        </span>
        <span className="wc-legend-item">
          <span className="wc-legend-dot wc-legend-dot--conference" /> Case conference
        </span>
      </div>
    </section>
  )
}

export default WeekCalendar
