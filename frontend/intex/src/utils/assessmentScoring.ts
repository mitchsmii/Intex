import type { Severity } from '../types/Assessment'

// =====================================================================
// BDI — Beck Depression Inventory (21 items, 0-3 each, 0-63 total)
// =====================================================================

export interface BDIResult {
  total: number
  severity: Severity
  item9Score: number
  requiresImmediateAction: boolean
}

export function scoreBDI(items: Record<number, number>): BDIResult {
  const total = Object.values(items).reduce((sum, v) => sum + (v ?? 0), 0)
  const item9Score = items[9] ?? 0
  const severity: Severity =
    total <= 10 ? 'Minimal'
      : total <= 16 ? 'Mild'
      : total <= 20 ? 'Borderline'
      : total <= 30 ? 'Moderate'
      : total <= 40 ? 'Severe'
      : 'Extreme'
  // Item 9 ≥ 2 means active suicidal ideation — always requires immediate action
  const requiresImmediateAction = item9Score >= 2 || severity === 'Severe' || severity === 'Extreme'
  return { total, severity, item9Score, requiresImmediateAction }
}

// =====================================================================
// BAI — Beck Anxiety Inventory (21 items, 0-3 each, 0-63 total)
// =====================================================================

export interface BAIResult {
  total: number
  severity: Severity
  requiresImmediateAction: boolean
}

export function scoreBAI(items: Record<number, number>): BAIResult {
  const total = Object.values(items).reduce((sum, v) => sum + (v ?? 0), 0)
  const severity: Severity =
    total <= 21 ? 'Low'
      : total <= 35 ? 'Moderate'
      : 'Severe'
  return { total, severity, requiresImmediateAction: severity === 'Severe' }
}

// =====================================================================
// PCL-5 — PTSD Checklist for DSM-5 (20 items, 0-4 each, 0-80 total)
// Subscales follow DSM-5 clusters B/C/D/E.
// Provisional PTSD threshold: total ≥ 33.
// =====================================================================

export interface PCL5Result {
  total: number
  severity: Severity
  subscales: {
    intrusion: number      // cluster B: items 1-5
    avoidance: number      // cluster C: items 6-7
    negativeAlterations: number // cluster D: items 8-14
    arousal: number        // cluster E: items 15-20
  }
  requiresImmediateAction: boolean
}

export function scorePCL5(items: Record<number, number>): PCL5Result {
  const sumRange = (start: number, end: number) => {
    let s = 0
    for (let i = start; i <= end; i++) s += items[i] ?? 0
    return s
  }
  const intrusion = sumRange(1, 5)
  const avoidance = sumRange(6, 7)
  const negativeAlterations = sumRange(8, 14)
  const arousal = sumRange(15, 20)
  const total = intrusion + avoidance + negativeAlterations + arousal
  const severity: Severity = total >= 33 ? 'ProbablePTSD' : 'NotPTSD'
  return {
    total,
    severity,
    subscales: { intrusion, avoidance, negativeAlterations, arousal },
    requiresImmediateAction: false,
  }
}

// =====================================================================
// Suicide Risk Screen (SWSPHN) — 6 sections, tick count → severity
// =====================================================================

export interface SuicideRiskSections {
  ideation: boolean
  plan: boolean
  history: boolean
  stressors: boolean
  noProtectivePeople: boolean
  noProtectiveCoping: boolean
  immediatePlan: boolean // "immediate or next 24 hours"
}

export interface SuicideRiskResult {
  tickCount: number
  severity: Severity
  requiresImmediateAction: boolean
}

export function scoreSuicideRisk(s: SuicideRiskSections): SuicideRiskResult {
  const ticks =
    Number(s.ideation) +
    Number(s.plan) +
    Number(s.history) +
    Number(s.stressors) +
    Number(s.noProtectivePeople) +
    Number(s.noProtectiveCoping)

  let severity: Severity
  if (s.immediatePlan && ticks >= 4) severity = 'Emergency'
  else if (ticks >= 4) severity = 'High'
  else if (ticks >= 2) severity = 'Moderate'
  else severity = 'Low'

  // Always require immediate action notes for High and Emergency
  const requiresImmediateAction = severity === 'High' || severity === 'Emergency'
  return { tickCount: ticks, severity, requiresImmediateAction }
}

// =====================================================================
// Severity → color bucket (for UI badges)
// =====================================================================

export type SeverityBucket = 'good' | 'warn' | 'bad' | 'neutral'

export function severityBucket(sev: Severity | null): SeverityBucket {
  if (!sev) return 'neutral'
  switch (sev) {
    case 'Minimal':
    case 'Low':
    case 'NotPTSD':
      return 'good'
    case 'Mild':
    case 'Borderline':
    case 'Moderate':
      return 'warn'
    case 'Severe':
    case 'Extreme':
    case 'High':
    case 'Emergency':
    case 'ProbablePTSD':
      return 'bad'
    default:
      return 'neutral'
  }
}
