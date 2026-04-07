import type { Resident } from '../types/Resident'
import type { ProcessRecording } from '../types/ProcessRecording'
import type { HomeVisitation } from '../types/HomeVisitation'
import type { InterventionPlan } from '../types/InterventionPlan'

export type ReadinessLevel = 'Not Ready' | 'Building' | 'Almost' | 'Ready'

export interface ReadinessFactor {
  key: string
  label: string
  score: number // 0-1
  weight: number
}

export interface ReadinessResult {
  residentId: number
  score: number // 0-100
  level: ReadinessLevel
  topPositive: ReadinessFactor | null
  topBlocker: ReadinessFactor | null
  factors: ReadinessFactor[]
}

const RISK_RANK: Record<string, number> = { Low: 0, Medium: 1, High: 2 }
const DAYS = (n: number) => n * 24 * 60 * 60 * 1000
const within = (iso: string | null, days: number) => {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() <= DAYS(days)
}
const clamp = (n: number) => Math.max(0, Math.min(1, n))

// === Individual signals (each returns 0-1) ===

function riskTrajectory(r: Resident): number {
  const init = r.initialRiskLevel ?? ''
  const curr = r.currentRiskLevel ?? ''
  if (!init || !curr) return 0.3
  const i = RISK_RANK[init] ?? 1
  const c = RISK_RANK[curr] ?? 1
  // Big improvement (High → Low) = 1.0; escalation = 0
  if (c < i) return c === 0 ? 1.0 : 0.7
  if (c === i) return c === 0 ? 0.85 : c === 1 ? 0.45 : 0.15
  return 0
}

function planCompletion(plans: InterventionPlan[]): number {
  if (plans.length === 0) return 0.3
  const completed = plans.filter((p) => p.status === 'Completed').length
  return completed / plans.length
}

function sessionProgress(recordings: ProcessRecording[]): number {
  const recent = recordings.filter((r) => within(r.sessionDate, 60))
  if (recent.length === 0) return 0.3
  const progress = recent.filter((r) => r.progressNoted === true).length
  const concerns = recent.filter((r) => r.concernsFlagged === true).length
  // raw range: -1 to 1 → normalize to 0-1
  const raw = (progress - concerns) / recent.length
  return clamp((raw + 1) / 2)
}

function familyEnvironment(visits: HomeVisitation[]): number {
  const recent = visits.filter((v) => within(v.visitDate, 90))
  if (recent.length === 0) return 0.3
  let total = 0
  recent.forEach((v) => {
    let s = 0.5
    switch (v.familyCooperationLevel) {
      case 'High': s = 1; break
      case 'Medium': s = 0.6; break
      case 'Low': s = 0.2; break
    }
    if (v.safetyConcernsNoted === true) s *= 0.3
    total += s
  })
  return total / recent.length
}

// === Composite ===

const WEIGHTS = {
  risk: 30,
  plans: 25,
  sessions: 25,
  family: 20,
}

export function computeReadiness(
  resident: Resident,
  recordings: ProcessRecording[],
  visitations: HomeVisitation[],
  plans: InterventionPlan[],
): ReadinessResult {
  const rRecordings = recordings.filter((p) => p.residentId === resident.residentId)
  const rVisits = visitations.filter((v) => v.residentId === resident.residentId)
  const rPlans = plans.filter((p) => p.residentId === resident.residentId)

  const factors: ReadinessFactor[] = [
    { key: 'risk', label: 'Risk trajectory', score: riskTrajectory(resident), weight: WEIGHTS.risk },
    { key: 'plans', label: 'Intervention plans completed', score: planCompletion(rPlans), weight: WEIGHTS.plans },
    { key: 'sessions', label: 'Recent session progress', score: sessionProgress(rRecordings), weight: WEIGHTS.sessions },
    { key: 'family', label: 'Family home environment', score: familyEnvironment(rVisits), weight: WEIGHTS.family },
  ]

  const score = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0),
  )

  const level: ReadinessLevel =
    score >= 80 ? 'Ready' : score >= 60 ? 'Almost' : score >= 40 ? 'Building' : 'Not Ready'

  const sorted = [...factors].sort((a, b) => b.score - a.score)
  const topPositive = sorted[0] && sorted[0].score >= 0.5 ? sorted[0] : null
  const topBlocker = sorted[sorted.length - 1] && sorted[sorted.length - 1].score < 0.6
    ? sorted[sorted.length - 1]
    : null

  return {
    residentId: resident.residentId,
    score,
    level,
    topPositive,
    topBlocker,
    factors,
  }
}
