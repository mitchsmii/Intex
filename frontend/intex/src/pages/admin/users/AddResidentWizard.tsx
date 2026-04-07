import { useState, useEffect, useMemo } from 'react'
import { api } from '../../../services/apiService'
import type { Safehouse, Resident } from '../../../services/apiService'
import './AddResidentWizard.css'

interface Props {
  safehouses: Safehouse[]
  residents: Resident[]
  onClose: () => void
  onCreated: (r: Resident) => void
}

interface WizardState {
  age: string
  safehouseId: number | null
  swFullName: string
  swEmail: string
  riskLevel: string
}

const STEPS = ['Resident Info', 'Safehouse', 'Social Worker', 'Risk Level', 'Review']

export default function AddResidentWizard({ safehouses, residents, onClose, onCreated }: Props) {
  const [step, setStep] = useState(0)
  const [codes, setCodes] = useState<{ internalCode: string; caseControlNo: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<WizardState>({
    age: '',
    safehouseId: null,
    swFullName: '',
    swEmail: '',
    riskLevel: '',
  })

  useEffect(() => {
    api.getNextResidentCode().then(setCodes).catch(() => {})
  }, [])

  // Derive top-5 least-loaded SW codes from residents already loaded
  const swOptions = useMemo(() => {
    const counts = new Map<string, number>()
    residents.forEach(r => {
      if (!r.assignedSocialWorker) return
      if (!counts.has(r.assignedSocialWorker)) counts.set(r.assignedSocialWorker, 0)
      if (!r.dateClosed) counts.set(r.assignedSocialWorker, counts.get(r.assignedSocialWorker)! + 1)
    })
    return [...counts.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
  }, [residents])

  const availableSafehouses = safehouses.filter(s => {
    if (s.status && s.status.toLowerCase() !== 'active') return false
    const cap = s.capacityGirls ?? 999
    const occ = s.currentOccupancy ?? 0
    return occ < cap
  })

  const selectedSafehouse = safehouses.find(s => s.safehouseId === form.safehouseId)

  function canAdvance() {
    if (step === 0) return form.age.trim() !== '' && Number(form.age) > 0
    if (step === 1) return form.safehouseId !== null
    if (step === 2) return form.swFullName !== ''
    if (step === 3) return form.riskLevel !== ''
    return true
  }

  async function handleSubmit() {
    if (form.safehouseId === null) return
    setSubmitting(true)
    setError(null)
    try {
      const resident = await api.createResident({
        age: Number(form.age),
        safehouseId: form.safehouseId,
        assignedSocialWorker: form.swFullName,
        swEmail: form.swEmail || undefined,
        riskLevel: form.riskLevel,
      })
      onCreated(resident)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create resident')
      setSubmitting(false)
    }
  }

  return (
    <div className="wizard-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="wizard-modal">
        {/* Header */}
        <div className="wizard-header">
          <h2 className="wizard-title">Add New Resident</h2>
          <button className="wizard-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Steps */}
        <div className="wizard-steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`wizard-step${i === step ? ' wizard-step-active' : i < step ? ' wizard-step-done' : ''}`}>
              <div className="wizard-step-dot">{i < step ? '✓' : i + 1}</div>
              {i === step && <span className="wizard-step-label">{s}</span>}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="wizard-body">
          {/* Step 0: Resident Info */}
          {step === 0 && (
            <div className="wizard-section">
              <p className="wizard-section-hint">The following codes are auto-generated and guaranteed unique.</p>
              <div className="wizard-code-row">
                <div className="wizard-code-box">
                  <span className="wizard-code-label">Internal Code</span>
                  <span className={`wizard-code-value${!codes ? ' wizard-code-placeholder' : ''}`}>
                    {codes?.internalCode ?? 'LS-????'}
                  </span>
                </div>
                <div className="wizard-code-box">
                  <span className="wizard-code-label">Case Control No.</span>
                  <span className={`wizard-code-value${!codes ? ' wizard-code-placeholder' : ''}`}>
                    {codes?.caseControlNo ?? 'CC-????'}
                  </span>
                </div>
              </div>
              <label className="wizard-label">
                Age upon admission
                <input
                  className="wizard-input"
                  type="number"
                  min={1}
                  max={25}
                  placeholder="e.g. 14"
                  value={form.age}
                  onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                  autoFocus
                />
              </label>
            </div>
          )}

          {/* Step 1: Safehouse */}
          {step === 1 && (
            <div className="wizard-section">
              <p className="wizard-section-hint">Showing safehouses with available capacity.</p>
              <div className="wizard-option-list">
                {availableSafehouses.length === 0 && (
                  <p className="wizard-empty">No safehouses with available capacity.</p>
                )}
                {availableSafehouses.map(s => {
                  const occ = s.currentOccupancy ?? 0
                  const cap = s.capacityGirls ?? 0
                  const avail = cap - occ
                  return (
                    <button
                      key={s.safehouseId}
                      className={`wizard-option${form.safehouseId === s.safehouseId ? ' wizard-option-selected' : ''}`}
                      onClick={() => setForm(f => ({ ...f, safehouseId: s.safehouseId }))}
                    >
                      <div className="wizard-option-title">{s.name ?? s.safehouseCode ?? `SH-${s.safehouseId}`}</div>
                      <div className="wizard-option-meta">
                        {s.city && <span>{s.city}</span>}
                        <span className="wizard-capacity">{occ}/{cap} occupied · <strong>{avail} open</strong></span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 2: Social Worker */}
          {step === 2 && (
            <div className="wizard-section">
              <p className="wizard-section-hint">Top 5 social workers with the fewest active residents — sorted by current load.</p>
              <div className="wizard-option-list">
                {swOptions.length === 0 && (
                  <p className="wizard-empty">No social worker assignments found in resident records.</p>
                )}
                {swOptions.map(({ name, count }) => {
                  const busy = count >= 10
                  return (
                    <button
                      key={name}
                      className={`wizard-option${form.swFullName === name ? ' wizard-option-selected' : ''}${busy ? ' wizard-option-busy' : ''}`}
                      onClick={() => setForm(f => ({ ...f, swFullName: name, swEmail: '' }))}
                    >
                      <div className="wizard-option-title">{name}</div>
                      <div className="wizard-option-meta">
                        <span className={`wizard-load${busy ? ' wizard-load-high' : count >= 6 ? ' wizard-load-med' : ''}`}>
                          {count} active resident{count !== 1 ? 's' : ''}{busy ? ' — high load' : ''}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 3: Risk Level */}
          {step === 3 && (
            <div className="wizard-section">
              <p className="wizard-section-hint">Select the initial risk assessment for this resident.</p>
              <div className="wizard-risk-grid">
                {[
                  { value: 'Low', desc: 'Stable situation, low immediate danger' },
                  { value: 'Medium', desc: 'Some concerns, regular monitoring needed' },
                  { value: 'High', desc: 'Significant risk, close supervision required' },
                ].map(r => (
                  <button
                    key={r.value}
                    className={`wizard-risk-card wizard-risk-${r.value.toLowerCase()}${form.riskLevel === r.value ? ' wizard-risk-selected' : ''}`}
                    onClick={() => setForm(f => ({ ...f, riskLevel: r.value }))}
                  >
                    <div className="wizard-risk-label">{r.value}</div>
                    <div className="wizard-risk-desc">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="wizard-section">
              <p className="wizard-section-hint">Review all details before submitting. Date of admission will be set to today.</p>
              <div className="wizard-review-grid">
                <div className="wizard-review-row">
                  <span className="wizard-review-label">Internal Code</span>
                  <span className={`wizard-review-value${!codes ? ' wizard-review-pending' : ''}`}>
                    {codes?.internalCode ?? 'Auto-generated on submit'}
                  </span>
                </div>
                <div className="wizard-review-row">
                  <span className="wizard-review-label">Case Control No.</span>
                  <span className={`wizard-review-value${!codes ? ' wizard-review-pending' : ''}`}>
                    {codes?.caseControlNo ?? 'Auto-generated on submit'}
                  </span>
                </div>
                <div className="wizard-review-row">
                  <span className="wizard-review-label">Age</span>
                  <span className="wizard-review-value">{form.age}</span>
                </div>
                <div className="wizard-review-row">
                  <span className="wizard-review-label">Safehouse</span>
                  <span className="wizard-review-value">{selectedSafehouse?.name ?? '—'}</span>
                </div>
                <div className="wizard-review-row">
                  <span className="wizard-review-label">Social Worker</span>
                  <span className="wizard-review-value">{form.swFullName}</span>
                </div>
                <div className="wizard-review-row">
                  <span className="wizard-review-label">Risk Level</span>
                  <span className={`wizard-review-value wizard-review-risk wizard-review-risk--${form.riskLevel.toLowerCase()}`}>{form.riskLevel}</span>
                </div>
                <div className="wizard-review-row">
                  <span className="wizard-review-label">Date of Admission</span>
                  <span className="wizard-review-value">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>
              {error && <p className="wizard-error">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="wizard-footer">
          <button className="wizard-btn wizard-btn-ghost" onClick={step === 0 ? onClose : () => setStep(s => s - 1)}>
            {step === 0 ? 'Cancel' : '← Back'}
          </button>
          {step < 4 ? (
            <button
              className="wizard-btn wizard-btn-primary"
              disabled={!canAdvance()}
              onClick={() => setStep(s => s + 1)}
            >
              Next →
            </button>
          ) : (
            <button
              className="wizard-btn wizard-btn-primary"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Creating…' : 'Create Resident'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
