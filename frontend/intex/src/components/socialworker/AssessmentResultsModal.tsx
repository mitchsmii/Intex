import type { Assessment } from '../../types/Assessment'
import { TEMPLATES } from '../../data/assessmentTemplates'
import type { SuicideRiskSections } from '../../utils/assessmentScoring'

interface Props {
  assessment: Assessment
  onClose: () => void
}

const SUICIDE_LABELS: { key: keyof SuicideRiskSections; label: string }[] = [
  { key: 'ideation', label: 'Has had thoughts of suicide' },
  { key: 'plan', label: 'Has a plan for how they would do it' },
  { key: 'immediatePlan', label: 'Plan is immediate (next 24 hours)' },
  { key: 'history', label: 'Previous suicide attempt(s)' },
  { key: 'stressors', label: 'Current major stressors present' },
  { key: 'noProtectivePeople', label: 'No protective people in life' },
  { key: 'noProtectiveCoping', label: 'No protective coping strategies' },
]

function formatDate(iso: string): string {
  const safe = iso.includes('T') ? iso : iso + 'T00:00:00'
  return new Date(safe).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function AssessmentResultsModal({ assessment, onClose }: Props) {
  const a = assessment
  const template = TEMPLATES[a.instrument]
  let parsed: Record<string, unknown> = {}
  try {
    if (a.responsesJson) parsed = JSON.parse(a.responsesJson)
  } catch { /* empty */ }

  const items: Record<string, number> | undefined =
    parsed.items as Record<string, number> | undefined

  const isSuicide = a.instrument === 'SUICIDE_RISK'
  const isSumBased = !isSuicide && template?.items

  return (
    <div className="arm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="arm-modal">
        <header className="arm-header">
          <div>
            <h2 className="arm-title">{template?.fullName ?? a.instrument}</h2>
            <p className="arm-meta">
              {formatDate(a.administeredDate)} · Administered by {a.administeredBy}
            </p>
          </div>
          <button type="button" className="arm-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="arm-summary">
          <div className="arm-summary-item">
            <div className="arm-summary-label">Score</div>
            <div className="arm-summary-value">{a.totalScore ?? a.tickCount ?? '—'}</div>
          </div>
          <div className="arm-summary-item">
            <div className="arm-summary-label">Severity</div>
            <div className="arm-summary-value">{a.severityBand ?? '—'}</div>
          </div>
          {a.worstEvent && (
            <div className="arm-summary-item arm-summary-item--wide">
              <div className="arm-summary-label">Worst Event</div>
              <div className="arm-summary-value arm-summary-value--small">{a.worstEvent}</div>
            </div>
          )}
        </div>

        <div className="arm-body">
          {/* Sum-based instruments: BDI, BAI, PCL-5 */}
          {isSumBased && template.items && (
            <ol className="arm-items">
              {template.items.map((item) => {
                const selected = items?.[String(item.index)]
                return (
                  <li key={item.index} className="arm-item">
                    <div className="arm-item-q">
                      <span className="arm-item-num">{item.index + 1}.</span>
                      {item.question}
                    </div>
                    <div className="arm-options">
                      {item.options.map((opt) => {
                        const isSelected = selected === opt.value
                        return (
                          <div
                            key={opt.value}
                            className={`arm-option${isSelected ? ' arm-option--selected' : ''}`}
                          >
                            <span className="arm-option-val">{opt.value}</span>
                            <span className="arm-option-label">{opt.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}

          {/* Suicide Risk: boolean sections */}
          {isSuicide && (
            <ul className="arm-suicide-list">
              {SUICIDE_LABELS.map(({ key, label }) => {
                const checked = !!(parsed as Record<string, boolean>)[key]
                return (
                  <li key={key} className={`arm-suicide-item${checked ? ' arm-suicide-item--yes' : ''}`}>
                    <span className="arm-suicide-check">{checked ? '✓' : '—'}</span>
                    <span>{label}</span>
                  </li>
                )
              })}
            </ul>
          )}

          {/* No responses stored */}
          {!isSumBased && !isSuicide && (
            <p className="arm-empty">No item-level responses recorded for this assessment.</p>
          )}
        </div>

        {(a.observationNotes || a.immediateAction) && (
          <div className="arm-notes">
            {a.observationNotes && (
              <div className="arm-note-block">
                <div className="arm-note-label">Observation Notes</div>
                <p>{a.observationNotes}</p>
              </div>
            )}
            {a.immediateAction && (
              <div className="arm-note-block arm-note-block--alert">
                <div className="arm-note-label">Immediate Action Taken</div>
                <p>{a.immediateAction}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default AssessmentResultsModal
