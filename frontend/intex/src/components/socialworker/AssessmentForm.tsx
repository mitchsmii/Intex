import { useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { createAssessment } from '../../services/socialWorkerService'
import type { Assessment, Instrument, Severity } from '../../types/Assessment'
import { TEMPLATES } from '../../data/assessmentTemplates'
import {
  scoreBDI,
  scoreBAI,
  scorePCL5,
  scoreSuicideRisk,
  severityBucket,
  type SuicideRiskSections,
} from '../../utils/assessmentScoring'
import './AssessmentForm.css'

interface Props {
  residentId: number
  instrument: Instrument
  onCancel: () => void
  onSaved: (a: Assessment) => void
}

interface ScoreResult {
  total: number | null
  tickCount: number | null
  severity: Severity
  requiresImmediateAction: boolean
}

const initialSuicideSections: SuicideRiskSections = {
  ideation: false,
  plan: false,
  history: false,
  stressors: false,
  noProtectivePeople: false,
  noProtectiveCoping: false,
  immediatePlan: false,
}

function AssessmentForm({ residentId, instrument, onCancel, onSaved }: Props) {
  const { user } = useAuth()
  const template = TEMPLATES[instrument]
  const today = new Date().toISOString().slice(0, 10)

  const [paused, setPaused] = useState(false)
  const [items, setItems] = useState<Record<number, number>>({})
  const [suicide, setSuicide] = useState<SuicideRiskSections>(initialSuicideSections)
  const [worstEvent, setWorstEvent] = useState('')
  const [observationNotes, setObservationNotes] = useState('')
  const [immediateAction, setImmediateAction] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  const PAGE_SIZE = 5

  // Live scoring
  const score: ScoreResult = useMemo(() => {
    if (instrument === 'BDI') {
      const r = scoreBDI(items)
      return {
        total: r.total,
        tickCount: null,
        severity: r.severity,
        requiresImmediateAction: r.requiresImmediateAction,
      }
    }
    if (instrument === 'BAI') {
      const r = scoreBAI(items)
      return { total: r.total, tickCount: null, severity: r.severity, requiresImmediateAction: r.requiresImmediateAction }
    }
    if (instrument === 'PCL5') {
      const r = scorePCL5(items)
      return { total: r.total, tickCount: null, severity: r.severity, requiresImmediateAction: r.requiresImmediateAction }
    }
    const r = scoreSuicideRisk(suicide)
    return { total: null, tickCount: r.tickCount, severity: r.severity, requiresImmediateAction: r.requiresImmediateAction }
  }, [instrument, items, suicide])

  const isSumBased = instrument !== 'SUICIDE_RISK'
  const allItemsAnswered = isSumBased
    ? template.items?.every((it) => items[it.index] != null) ?? false
    : true // suicide risk has no required completeness check beyond consent

  // Pagination: split items into pages of PAGE_SIZE.
  // Sum-based: N question pages + 1 review page.
  // Suicide risk: 1 question page + 1 review page.
  const itemPages = useMemo(() => {
    if (!isSumBased || !template.items) return [] as typeof template.items[]
    const pages: Array<NonNullable<typeof template.items>> = []
    for (let i = 0; i < template.items.length; i += PAGE_SIZE) {
      pages.push(template.items.slice(i, i + PAGE_SIZE))
    }
    return pages
  }, [isSumBased, template.items])

  const totalQuestionPages = isSumBased ? itemPages.length : 1
  const totalPages = totalQuestionPages + 1 // +1 for review page
  const isReviewPage = page === totalPages - 1
  const isFirstPage = page === 0

  const currentItems = isSumBased ? itemPages[page] ?? [] : []

  const currentPageAnswered = useMemo(() => {
    if (isReviewPage) return true
    if (!isSumBased) return true
    return currentItems.every((it) => items[it.index] != null)
  }, [isReviewPage, isSumBased, currentItems, items])

  const worstEventSatisfied = instrument !== 'PCL5' || worstEvent.trim().length > 0
  const canGoNext =
    !paused && currentPageAnswered && (!isFirstPage || worstEventSatisfied)

  const requireWorstEvent = instrument === 'PCL5'
  const worstEventOk = !requireWorstEvent || worstEvent.trim().length > 0
  const immediateActionOk = !score.requiresImmediateAction || immediateAction.trim().length > 0
  const canSubmit = !paused && !submitting && allItemsAnswered && worstEventOk && immediateActionOk

  function setItem(idx: number, value: number) {
    setItems((prev) => ({ ...prev, [idx]: value }))
  }

  function buildResponsesJson(): string {
    if (instrument === 'PCL5') {
      const r = scorePCL5(items)
      return JSON.stringify({ items, subscales: r.subscales })
    }
    if (instrument === 'SUICIDE_RISK') {
      return JSON.stringify(suicide)
    }
    return JSON.stringify({ items })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const payload: Omit<Assessment, 'assessmentId' | 'createdAt'> = {
        residentId,
        instrument,
        administeredDate: today,
        administeredBy: user?.username ?? '',
        totalScore: score.total,
        tickCount: score.tickCount,
        severityBand: score.severity,
        responsesJson: buildResponsesJson(),
        worstEvent: requireWorstEvent ? worstEvent.trim() : null,
        immediateAction: immediateAction.trim() || null,
        observationNotes: observationNotes.trim() || null,
      }
      const created = await createAssessment(payload)
      onSaved(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assessment')
    } finally {
      setSubmitting(false)
    }
  }

  const bucket = severityBucket(score.severity)

  return (
    <form className="af-form" onSubmit={handleSubmit}>
      <header className="af-header">
        <div>
          <h3>{template.fullName}</h3>
          <p className="af-sub">{template.description}</p>
          <p className="af-meta">
            Administered today by <strong>{user?.username ?? '—'}</strong> · Timeframe: {template.timeframe}
          </p>
        </div>
        <button
          type="button"
          className={`af-pause-btn${paused ? ' af-pause-btn--paused' : ''}`}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
      </header>

      {paused && (
        <div className="af-paused-banner">
          Paused — take all the time you need. Click Resume when ready to continue.
        </div>
      )}

      {!paused && (
        <>
          {/* Progress header */}
          <div className="af-progress">
            <div className="af-progress-label">
              {isReviewPage
                ? 'Review & submit'
                : `Page ${page + 1} of ${totalQuestionPages}`}
            </div>
            <div className="af-progress-bar">
              <div
                className="af-progress-fill"
                style={{ width: `${((page + 1) / totalPages) * 100}%` }}
              />
            </div>
          </div>

          {/* PAGE 1 extras: worst event for PCL-5 */}
          {isFirstPage && requireWorstEvent && (
            <label className="af-field">
              <span>Worst event (in resident's words)</span>
              <textarea
                rows={2}
                placeholder="Describe the event the resident is keeping in mind for these questions…"
                value={worstEvent}
                onChange={(e) => setWorstEvent(e.target.value)}
                required
              />
            </label>
          )}

          {/* SUM-BASED QUESTIONS (paginated) */}
          {!isReviewPage && isSumBased && (
            <ol className="af-items" start={page * PAGE_SIZE + 1}>
              {currentItems.map((item) => (
                <li key={item.index} className="af-item">
                  <div className="af-item-question">{item.question}</div>
                  <div className="af-item-options">
                    {item.options.map((opt) => {
                      const selected = items[item.index] === opt.value
                      return (
                        <label
                          key={opt.value}
                          className={`af-opt${selected ? ' af-opt--selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name={`item-${item.index}`}
                            value={opt.value}
                            checked={selected}
                            onChange={() => setItem(item.index, opt.value)}
                          />
                          <span className="af-opt-value">{opt.value}</span>
                          <span className="af-opt-label">{opt.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </li>
              ))}
            </ol>
          )}

          {/* SUICIDE RISK SECTIONS (single question page, not paginated) */}
          {!isReviewPage && instrument === 'SUICIDE_RISK' && (
            <ol className="af-items">
              <SuicideSection
                title="1. Evidence of suicidal ideation"
                hint="Has things been so bad lately that you have thought about suicide?"
                checked={suicide.ideation}
                onChange={(v) => setSuicide((s) => ({ ...s, ideation: v }))}
              />
              <SuicideSection
                title="2. Current plan"
                hint="Have you made any current plans to take your own life?"
                checked={suicide.plan}
                onChange={(v) => setSuicide((s) => ({ ...s, plan: v }))}
              />
              <li className="af-item af-item--inline">
                <label className="af-checkbox">
                  <input
                    type="checkbox"
                    checked={suicide.immediatePlan}
                    onChange={(e) => setSuicide((s) => ({ ...s, immediatePlan: e.target.checked }))}
                  />
                  <span>Plan is <strong>immediate or in next 24 hours</strong> (escalates to Emergency)</span>
                </label>
              </li>
              <SuicideSection
                title="3. History of previous attempts"
                hint="Have you ever tried to take your own life before?"
                checked={suicide.history}
                onChange={(v) => setSuicide((s) => ({ ...s, history: v }))}
              />
              <SuicideSection
                title="4. Current stressors"
                hint="Have you been going through upsetting events lately? (relationship, family, abuse, loss, trauma)"
                checked={suicide.stressors}
                onChange={(v) => setSuicide((s) => ({ ...s, stressors: v }))}
              />
              <SuicideSection
                title="5. Lack of supportive people"
                hint="Tick if she has no one to support her (no family / friends / partner / service worker)."
                checked={suicide.noProtectivePeople}
                onChange={(v) => setSuicide((s) => ({ ...s, noProtectivePeople: v }))}
              />
              <SuicideSection
                title="6. No personal coping strategies"
                hint="Tick if she cannot identify reasons to live, prior coping strategies, or personal strengths."
                checked={suicide.noProtectiveCoping}
                onChange={(v) => setSuicide((s) => ({ ...s, noProtectiveCoping: v }))}
              />
            </ol>
          )}

          {/* REVIEW PAGE: score + notes + immediate action */}
          {isReviewPage && (
          <>
          <div className={`af-score af-score--${bucket}`}>
            <span className="af-score-label">Computed score</span>
            <span className="af-score-value">
              {isSumBased
                ? `${score.total ?? 0}${instrument === 'BDI' ? '/63' : instrument === 'BAI' ? '/63' : '/80'}`
                : `${score.tickCount ?? 0}/6 ticks`}
            </span>
            <span className="af-score-severity">{score.severity}</span>
          </div>

          <label className="af-field">
            <span>Observed during administration</span>
            <textarea
              rows={2}
              placeholder="Body language, hesitation, anything notable that the numbers don't capture…"
              value={observationNotes}
              onChange={(e) => setObservationNotes(e.target.value)}
            />
          </label>

          {score.requiresImmediateAction && (
            <div className="af-form-immediate-action">
              <label className="af-field">
                <span>⚠ Immediate action taken (REQUIRED)</span>
                <textarea
                  rows={3}
                  placeholder="What did you do RIGHT NOW in response? (notified supervisor, removed access to means, transported to ED, called emergency contact, safety plan written, etc.)"
                  value={immediateAction}
                  onChange={(e) => setImmediateAction(e.target.value)}
                  required
                />
              </label>
              {instrument === 'SUICIDE_RISK' && score.severity === 'Emergency' && (
                <div className="af-emergency-protocol">
                  <strong>EMERGENCY PROTOCOL:</strong> Do not leave resident alone. Arrange transport
                  to emergency department by ambulance. Police required if resident is unwilling to
                  be transported.
                </div>
              )}
              {instrument === 'SUICIDE_RISK' && score.severity === 'High' && (
                <div className="af-emergency-protocol">
                  <strong>HIGH RISK PROTOCOL:</strong> Arrange transport and referral to local
                  Community Mental Health Emergency Team or Emergency Department after hours.
                </div>
              )}
              {instrument === 'BDI' && (
                <div className="af-emergency-protocol">
                  <strong>BDI ITEM 9 PROTOCOL:</strong> Resident has expressed thoughts of self-harm.
                  Notify supervisor immediately and document a safety plan.
                </div>
              )}
            </div>
          )}

          {error && <div className="af-error">{error}</div>}
          </>
          )}

          {/* Navigation footer */}
          <div className="af-actions">
            <button
              type="button"
              className="af-btn af-btn--secondary"
              onClick={isFirstPage ? onCancel : () => setPage((p) => p - 1)}
              disabled={submitting}
            >
              {isFirstPage ? 'Cancel' : '← Previous'}
            </button>
            {isReviewPage ? (
              <button
                type="submit"
                className="af-btn af-btn--primary"
                disabled={!canSubmit}
              >
                {submitting ? 'Saving…' : 'Save Assessment'}
              </button>
            ) : (
              <button
                type="button"
                className="af-btn af-btn--primary"
                disabled={!canGoNext}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
              >
                Next →
              </button>
            )}
          </div>
        </>
      )}
    </form>
  )
}

interface SuicideSectionProps {
  title: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}

function SuicideSection({ title, hint, checked, onChange }: SuicideSectionProps) {
  return (
    <li className="af-item">
      <div className="af-item-question">{title}</div>
      <div className="af-item-hint">{hint}</div>
      <label className="af-checkbox">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>Tick if yes</span>
      </label>
    </li>
  )
}

export default AssessmentForm
