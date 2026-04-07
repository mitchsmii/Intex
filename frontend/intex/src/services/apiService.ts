const BASE_URL =
  import.meta.env.VITE_API_URL ??
  'https://intexbackend-dragb9ahdsfvejfe.centralus-01.azurewebsites.net'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface Safehouse {
  safehouseId: number
  safehouseCode: string | null
  name: string | null
  region: string | null
  city: string | null
  province: string | null
  country: string | null
  openDate: string | null
  status: string | null
  capacityGirls: number | null
  capacityStaff: number | null
  currentOccupancy: number | null
  notes: string | null
}

export interface Resident {
  residentId: number
  caseControlNo: string | null
  internalCode: string | null
  safehouseId: number | null
  caseStatus: string | null
  sex: string | null
  dateOfBirth: string | null
  dateOfAdmission: string | null
  assignedSocialWorker: string | null
  reintegrationStatus: string | null
  currentRiskLevel: string | null
  dateClosed: string | null
}

export interface Supporter {
  supporterId: number
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  isAnonymous: boolean | null
  createdAt: string | null
}

export interface Donation {
  donationId: number
  supporterId: number | null
  supporterName: string
  amount: number | null
  donationDate: string | null
  isRecurring: boolean | null
  frequency: string | null
  currency: string | null
  paymentMethod: string | null
  notes: string | null
}

export interface DonationRaw {
  donationId: number
  supporterId: number | null
  amount: number | null
  donationDate: string | null
  isRecurring: boolean | null
  frequency: string | null
  currency: string | null
  paymentMethod: string | null
  notes: string | null
}

export interface AllocationSummary {
  total: number
  breakdown: { programArea: string; amountAllocated: number }[]
}

export interface SafehouseMonthlyMetric {
  metricId: number
  safehouseId: number | null
  month: number | null
  year: number | null
  totalExpenses: number | null
  programExpenses: number | null
  adminExpenses: number | null
  occupancyRate: number | null
  incidentCount: number | null
}

export interface IncidentReport {
  incidentId: number
  residentId: number | null
  reportedBy: string | null
  reportDate: string | null
  incidentType: string | null
  severity: string | null
  description: string | null
  resolved: boolean | null
  resolutionNotes: string | null
}

export interface UpcomingPlan {
  planId: number
  residentId: number | null
  residentCode: string | null
  safehouseId: number | null
  assignedSocialWorker: string | null
  goals: string | null
  startDate: string | null
  endDate: string | null
  status: string | null
  createdBy: string | null
}

export interface MonthlyDonationSummary {
  year: number
  month: number
  total: number
  count: number
}

export interface TopSupporter {
  supporterId: number | null
  name: string
  total: number
  isRecurring: boolean | null
  firstDate: string | null
}

// ── API calls ──────────────────────────────────────────────────────────────

export const api = {
  getSafehouses:          () => get<Safehouse[]>('/api/safehouses'),
  getResidents:           () => get<Resident[]>('/api/residents'),
  getSupporters:          () => get<Supporter[]>('/api/supporters'),
  lookupSupporter:        (firstName: string, lastName: string, email: string) =>
    get<Supporter>(`/api/supporters/lookup?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&email=${encodeURIComponent(email)}`),
  getDonations:           () => get<Donation[]>('/api/donations'),
  getDonationsBySupporter:(id: number) => get<DonationRaw[]>(`/api/donations/by-supporter/${id}`),
  getDonationsMonthlySummary: () => get<MonthlyDonationSummary[]>('/api/donations/summary/monthly'),
  getTopSupporters:       (top = 5) => get<TopSupporter[]>(`/api/donations/top-supporters?top=${top}`),
  getAllocationSummary:   () => get<AllocationSummary>('/api/donationallocations/summary'),
  getLatestMetrics:       () => get<SafehouseMonthlyMetric[]>('/api/safehousemonthlymetrics/latest'),
  getIncidentReports:     () => get<IncidentReport[]>('/api/incidentreports'),
  getUpcomingPlans:       () => get<UpcomingPlan[]>('/api/interventionplans/upcoming'),
}
