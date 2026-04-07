export interface InterventionPlan {
  planId: number
  residentId: number | null
  planCategory: string | null
  planDescription: string | null
  servicesProvided: string | null
  targetValue: number | null
  targetDate: string | null
  status: string | null
  caseConferenceDate: string | null
  createdAt: string | null
  updatedAt: string | null
}
