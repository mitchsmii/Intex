import { useMemo } from 'react'
import type { Resident } from '../../../types/Resident'
import type { Assessment, Instrument } from '../../../types/Assessment'
import { severityBucket } from '../../../utils/assessmentScoring'
import './MentalHealthSnapshot.css'

interface Props {
  residents: Resident[]
  assessments: Assessment[]
  onResidentClick?: (residentId: number) => void
}

const INSTRUMENT_LABELS: Array<{ id: Instrument; short: string }> = [
  { id: 'PCL5', short: 'PTSD' },
  { id: 'BDI', short: 'BDI' },
  { id: 'BAI', short: 'BAI' },
  { id: 'SUICIDE_RISK', short: 'SR' },
]

interface RowData {
  resident: Resident
  latestByInstrument: Map<Instrument, Assessment>
  prevByInstrument: Map<Instrument, Assessment>
  mostRecentDate: number
}

function MentalHealthSnapshot({ residents, assessments, onResidentClick }: Props) {
  const rows: RowData[] = useMemo(() => {
    return residents
      .map((r) => {
        const own = assessments.filter((a) => a.residentId === r.residentId)
        const latestByInstrument = new Map<Instrument, Assessment>()
        const prevByInstrument = new Map<Instrument, Assessment>()
        for (const inst of INSTRUMENT_LABELS) {
          const sorted = own
            .filter((a) => a.instrument === inst.id)
            .sort(
              (a, b) =>
                new Date(b.administeredDate).getTime() - new Date(a.administeredDate).getTime(),
            )
          if (sorted.length >= 1) latestByInstrument.set(inst.id, sorted[0])
          if (sorted.length >= 2) prevByInstrument.set(inst.id, sorted[1])
        }
        const mostRecent = own.reduce(
          (acc, a) => Math.max(acc, new Date(a.administeredDate).getTime()),
          0,
        )
        return { resident: r, latestByInstrument, prevByInstrument, mostRecentDate: mostRecent }
      })
      .filter((row) => row.latestByInstrument.size > 0)
      .sort((a, b) => b.mostRecentDate - a.mostRecentDate)
  }, [residents, assessments])

  return (
    <section className="sw-dash-section">
      <header className="sw-dash-section-header">
        <h2>Mental Health Snapshot</h2>
        <span className="sw-dash-mock">latest scores per resident</span>
      </header>

      {rows.length === 0 ? (
        <p className="sw-dash-empty">No assessments on record for any of your residents yet.</p>
      ) : (
        <ul className="mhs-list">
          {rows.map(({ resident, latestByInstrument, prevByInstrument }) => (
            <li key={resident.residentId}>
              <button
                type="button"
                className="mhs-row"
                onClick={() => onResidentClick?.(resident.residentId)}
              >
                <div className="mhs-resident">
                  <span className="mhs-code">{resident.internalCode ?? `#${resident.residentId}`}</span>
                  <span className="mhs-meta">Age {resident.presentAge ?? '—'}</span>
                </div>
                <div className="mhs-chips">
                  {INSTRUMENT_LABELS.map(({ id, short }) => {
                    const latest = latestByInstrument.get(id)
                    const prev = prevByInstrument.get(id)
                    const bucket = latest ? severityBucket(latest.severityBand) : 'neutral'
                    let trend: 'up' | 'down' | 'flat' | null = null
                    if (latest && prev) {
                      const a = latest.totalScore ?? latest.tickCount ?? 0
                      const b = prev.totalScore ?? prev.tickCount ?? 0
                      trend = a < b ? 'down' : a > b ? 'up' : 'flat'
                    }
                    return (
                      <div key={id} className={`mhs-chip mhs-chip--${bucket}`}>
                        <div className="mhs-chip-name">{short}</div>
                        <div className="mhs-chip-value">
                          {latest ? (latest.totalScore ?? latest.tickCount ?? '—') : '—'}
                          {trend && (
                            <span className={`mhs-trend mhs-trend--${trend}`}>
                              {trend === 'down' ? '↓' : trend === 'up' ? '↑' : '→'}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default MentalHealthSnapshot
