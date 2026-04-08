const ML_BASE_URL =
  import.meta.env.VITE_ML_API_URL ??
  'https://lighthouse-ml-api-intex.azurewebsites.net'

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
