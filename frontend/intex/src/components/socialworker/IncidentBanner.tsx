import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { IncidentReport } from '../../types/IncidentReport'
import { updateIncidentReport } from '../../services/socialWorkerService'
import './IncidentBanner.css'

interface Props {
  incident: IncidentReport
  residentId: number
  onResolved: (resolved: IncidentReport) => void
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function severityClass(sev: string | null): string {
  const s = (sev ?? '').toLowerCase()
  if (s === 'high') return 'ib--high'
  if (s === 'medium') return 'ib--medium'
  return 'ib--low'
}

function IncidentBanner({ incident, residentId, onResolved }: Props) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [showResolveForm, setShowResolveForm] = useState(false)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isResolved = incident.resolved === true

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault()
    if (!resolutionNotes.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const updated: IncidentReport = {
        ...incident,
        resolved: true,
        resolutionDate: today,
        responseTaken: incident.responseTaken
          ? `${incident.responseTaken}\n\nResolution: ${resolutionNotes.trim()}`
          : `Resolution: ${resolutionNotes.trim()}`,
      }
      await updateIncidentReport(incident.incidentId, updated)
      onResolved(updated)
      setShowResolveForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve incident')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`ib ${isResolved ? 'ib--resolved' : severityClass(incident.severity)}`}>
      <button
        type="button"
        className="ib-header"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <div className="ib-header-left">
          <span className={`ib-tag ib-tag--${(incident.severity ?? 'low').toLowerCase()}`}>
            {isResolved ? 'Resolved' : (incident.severity ?? 'Low')} Incident
          </span>
          <span className="ib-title">
            {incident.incidentType ?? 'Incident'}
          </span>
          {incident.incidentDate && (
            <span className="ib-date">{formatDate(incident.incidentDate)}</span>
          )}
        </div>
        <svg
          className={`ib-chevron${expanded ? ' ib-chevron--open' : ''}`}
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="ib-body">
          <dl className="ib-dl">
            {incident.description && (
              <>
                <dt>Description</dt>
                <dd>{incident.description}</dd>
              </>
            )}
            {incident.responseTaken && (
              <>
                <dt>Response Taken</dt>
                <dd className="ib-multiline">{incident.responseTaken}</dd>
              </>
            )}
            {incident.reportedBy && (
              <>
                <dt>Reported By</dt>
                <dd>{incident.reportedBy}</dd>
              </>
            )}
            <dt>Severity</dt>
            <dd>
              <span className={`ib-sev-pill ib-sev-pill--${(incident.severity ?? 'low').toLowerCase()}`}>
                {incident.severity ?? 'Low'}
              </span>
            </dd>
            <dt>Follow-Up Required</dt>
            <dd>
              <span className={`ib-yn ib-yn--${incident.followUpRequired ? 'yes' : 'no'}`}>
                {incident.followUpRequired ? 'Yes' : 'No'}
              </span>
            </dd>
            {isResolved && incident.resolutionDate && (
              <>
                <dt>Resolved On</dt>
                <dd>{formatDate(incident.resolutionDate)}</dd>
              </>
            )}
          </dl>

          {!isResolved && (
            <>
              <div className="ib-quick-links">
                <button
                  type="button"
                  className="ib-link"
                  onClick={() =>
                    navigate('/socialworker/dashboard/process-recordings', {
                      state: { preSelectedResidentId: residentId },
                    })
                  }
                >
                  Log Session About This →
                </button>
                <button
                  type="button"
                  className="ib-link"
                  onClick={() =>
                    navigate('/socialworker/dashboard/intervention-plans', {
                      state: { preSelectedResidentId: residentId },
                    })
                  }
                >
                  Create Intervention Plan →
                </button>
              </div>

              {!showResolveForm ? (
                <div className="ib-actions">
                  <button
                    type="button"
                    className="ib-resolve-btn"
                    onClick={() => setShowResolveForm(true)}
                  >
                    Resolve Incident
                  </button>
                </div>
              ) : (
                <form className="ib-resolve-form" onSubmit={handleResolve}>
                  <label>
                    <span>Resolution Notes</span>
                    <textarea
                      rows={3}
                      placeholder="What was done to close this out…"
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      required
                    />
                  </label>
                  {error && <div className="ib-error">{error}</div>}
                  <div className="ib-resolve-actions">
                    <button
                      type="button"
                      className="ib-link"
                      onClick={() => {
                        setShowResolveForm(false)
                        setResolutionNotes('')
                        setError(null)
                      }}
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="ib-resolve-btn"
                      disabled={submitting || !resolutionNotes.trim()}
                    >
                      {submitting ? 'Resolving…' : 'Confirm Resolve'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default IncidentBanner
