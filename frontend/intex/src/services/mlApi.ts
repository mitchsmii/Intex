// In dev, route through Vite's proxy (/ml-api) to avoid CORS.
// In production, call the Azure ML API directly.
const ML_BASE_URL =
  import.meta.env.VITE_ML_API_URL ??
  (import.meta.env.DEV
    ? '/ml-api'
    : 'https://lighthouse-ml-api-intex.azurewebsites.net')

async function mlPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${ML_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`ML API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export interface DonorChurnInput {
  total_donation_count: number
  total_amount: number
  avg_donation_amount: number
  days_since_first_donation: number
  donation_type_variety: number
  is_recurring_donor: boolean
  [key: string]: number | boolean
}

export interface DonorChurnResult {
  is_lapsed: boolean
  probability: number
}

export function predictDonorChurn(input: DonorChurnInput): Promise<DonorChurnResult> {
  return mlPost<DonorChurnResult>('/predict/donor-churn', input)
}

export interface FeatureImportance {
  feature: string
  importance: number
}

export async function fetchDonorChurnFeatureImportance(): Promise<FeatureImportance[]> {
  const res = await fetch(`${ML_BASE_URL}/feature-importance/donor-churn`)
  if (!res.ok) throw new Error(`ML API error ${res.status}: /feature-importance/donor-churn`)
  const data = (await res.json()) as { features: FeatureImportance[] }
  return data.features
}

export interface SocialEngagementInput {
  post_hour: number
  caption_length: number
  num_hashtags: number
  mentions_count: number
  boost_budget_php: number
  is_boosted: boolean
  features_resident_story: boolean
  has_call_to_action?: boolean
  [key: string]: number | boolean | undefined
}

export interface SocialEngagementResult {
  will_generate_donation: boolean
  probability: number
}

export function predictSocialEngagement(
  input: SocialEngagementInput,
): Promise<SocialEngagementResult> {
  return mlPost<SocialEngagementResult>('/predict/social-engagement', input)
}

export async function fetchSocialEngagementFeatureImportance(): Promise<FeatureImportance[]> {
  const res = await fetch(`${ML_BASE_URL}/feature-importance/social-engagement`)
  if (!res.ok) throw new Error(`ML API error ${res.status}: /feature-importance/social-engagement`)
  const data = (await res.json()) as { features: FeatureImportance[] }
  return data.features
}

export async function fetchResidentRiskFeatureImportance(): Promise<FeatureImportance[]> {
  const res = await fetch(`${ML_BASE_URL}/feature-importance/resident-risk`)
  if (!res.ok) throw new Error(`ML API error ${res.status}: /feature-importance/resident-risk`)
  const data = (await res.json()) as { features: FeatureImportance[] }
  return data.features
}

export interface ResidentRiskInput {
  days_in_care: number
  initial_risk_level_enc: number
  total_sessions: number
  pct_concerns_flagged: number
  pct_progress_noted: number
  pct_referral_made: number
  emotional_improvement_rate: number
  avg_general_health_score: number
  avg_sleep_quality_score: number
  health_trend_slope: number
  avg_attendance_rate: number
  total_incidents: number
  unresolved_incidents: number
  total_home_visits: number
  pct_visits_safety_concerns: number
  [key: string]: number | boolean | undefined
}

export interface ResidentRiskResult {
  is_high_risk: boolean
  probability: number
}

export function predictResidentRisk(
  input: ResidentRiskInput,
): Promise<ResidentRiskResult> {
  return mlPost<ResidentRiskResult>('/predict/resident-risk', input)
}

export interface EducationOutcomeInput {
  early_health_mean: number
  early_attendance_mean: number
  early_progress_mean: number
  early_emotional_improvement_rate: number
  early_attendance_slope: number
  initial_progress: number
  [key: string]: number | boolean | undefined
}

export interface EducationOutcomeResult {
  will_complete: boolean
  probability: number
}

export function predictEducationOutcome(
  input: EducationOutcomeInput,
): Promise<EducationOutcomeResult> {
  return mlPost<EducationOutcomeResult>('/predict/education-outcome', input)
}

export interface ReintegrationJourneyInput {
  days_in_care: number
  risk_improved: number
  abuse_complexity: number
  avg_health_score: number
  avg_nutrition_score: number
  avg_sleep_score: number
  avg_energy_score: number
  health_record_count: number
  health_trend: number
  avg_education_progress: number
  avg_attendance_rate: number
  education_record_count: number
  total_counseling_sessions: number
  pct_sessions_with_progress: number
  pct_sessions_with_concerns: number
  total_intervention_plans: number
  completed_plans: number
  active_plans: number
  plan_completion_rate: number
  total_visitations: number
  avg_family_cooperation: number
  pct_safety_concerns: number
  avg_visit_outcome: number
  total_incidents: number
  avg_incident_severity: number
  unresolved_incidents: number
  days_since_last_incident: number
  [key: string]: number
}

export interface ReintegrationJourneyResult {
  cluster_id: number
  cluster_name: string
  centroid_distances: Record<string, number>
}

export function predictReintegrationJourney(
  input: ReintegrationJourneyInput,
): Promise<ReintegrationJourneyResult> {
  return mlPost<ReintegrationJourneyResult>('/predict/reintegration-journey', input)
}

export async function fetchReintegrationFeatureImportance(): Promise<FeatureImportance[]> {
  const res = await fetch(`${ML_BASE_URL}/feature-importance/reintegration-journey`)
  if (!res.ok) throw new Error(`ML API error ${res.status}: /feature-importance/reintegration-journey`)
  const data = (await res.json()) as { features: FeatureImportance[] }
  return data.features
}
