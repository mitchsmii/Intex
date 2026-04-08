const BASE_URL =
  import.meta.env.VITE_API_URL ??
  'https://intexbackend-dragb9ahdsfvejfe.centralus-01.azurewebsites.net'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

async function authGet<T>(path: string): Promise<T> {
  const token = localStorage.getItem('cove_token')
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
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
  supporterType: string | null
  displayName: string | null
  organizationName: string | null
  firstName: string | null
  lastName: string | null
  relationshipType: string | null
  region: string | null
  country: string | null
  email: string | null
  phone: string | null
  status: string | null
  firstDonationDate: string | null
  acquisitionChannel: string | null
  createdAt: string | null
}

// Donation with supporter name joined in (from GET /api/donations)
export interface Donation {
  donationId: number
  supporterId: number | null
  supporterName: string
  amount: number | null
  estimatedValue: number | null
  donationDate: string | null
  isRecurring: boolean | null
  donationType: string | null
  channelSource: string | null
  currencyCode: string | null
  campaignName: string | null
  notes: string | null
}

// Raw donation row (from GET /api/donations/by-supporter/{id})
export interface DonationRaw {
  donationId: number
  supporterId: number | null
  donationType: string | null
  donationDate: string | null
  channelSource: string | null
  currencyCode: string | null
  amount: number | null
  estimatedValue: number | null
  impactUnit: string | null
  isRecurring: boolean | null
  campaignName: string | null
  notes: string | null
}

export interface AllocationSummary {
  total: number
  breakdown: { programArea: string; amountAllocated: number }[]
}

export interface SafehouseMonthlyMetric {
  metricId: number
  safehouseId: number | null
  monthStart: string | null
  monthEnd: string | null
  activeResidents: number | null
  avgEducationProgress: number | null
  avgHealthScore: number | null
  processRecordingCount: number | null
  homeVisitationCount: number | null
  incidentCount: number | null
  notes: string | null
}

export interface IncidentReport {
  incidentId: number
  residentId: number | null
  safehouseId: number | null
  incidentDate: string | null
  incidentType: string | null
  severity: string | null
  description: string | null
  responseTaken: string | null
  resolved: boolean | null
  resolutionDate: string | null
  reportedBy: string | null
  followUpRequired: boolean | null
}

export interface UpcomingPlan {
  planId: number
  residentId: number | null
  residentCode: string | null
  safehouseId: number | null
  assignedSocialWorker: string | null
  planCategory: string | null
  planDescription: string | null
  caseConferenceDate: string | null
  targetDate: string | null
  status: string | null
}

export interface SocialWorker {
  socialWorkerId: number
  fullName: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  safehouseId: number | null
  status: string
  createdAt: string
  updatedAt: string
}

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

export interface SwNotification {
  notificationId: number
  recipientEmail: string
  message: string
  relatedResidentCode: string | null
  isRead: boolean
  createdAt: string
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

// ── POST helpers ──────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

async function authPost<T>(path: string, body: unknown): Promise<T> {
  const token = localStorage.getItem('cove_token')
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

async function authPatch(path: string): Promise<void> {
  const token = localStorage.getItem('cove_token')
  await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

// ── API calls ──────────────────────────────────────────────────────────────

export const api = {
  getSafehouses:              () => get<Safehouse[]>('/api/safehouses'),
  getResidents:               () => authGet<Resident[]>('/api/residents'),
  getSupporters:              () => get<Supporter[]>('/api/supporters'),
  lookupSupporter:            (firstName: string, lastName: string, email: string) =>
    get<Supporter>(`/api/supporters/lookup?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&email=${encodeURIComponent(email)}`),
  lookupSupporterByEmail:     (email: string) =>
    authGet<Supporter>(`/api/supporters/lookup-by-email?email=${encodeURIComponent(email)}`),
  chatWithVanessa:            (messages: { role: 'vanessa' | 'user'; content: string }[]) =>
    authPost<{ reply: string }>('/api/vanessa/chat', { messages }),
  getDonations:               () => get<Donation[]>('/api/donations'),
  getDonationsBySupporter:    (id: number) => get<DonationRaw[]>(`/api/donations/by-supporter/${id}`),
  getDonationsMonthlySummary: () => get<MonthlyDonationSummary[]>('/api/donations/summary/monthly'),
  getTopSupporters:           (top = 5) => get<TopSupporter[]>(`/api/donations/top-supporters?top=${top}`),
  getDonationsTotal:          () => get<{ total: number }>('/api/donations/total'),
  upsertSupporter:            (body: { firstName: string; lastName: string; email: string; phone?: string; displayName?: string }) =>
    post<Supporter>('/api/supporters/upsert', body),
  createDonation:             (body: { supporterId: number; amount: number; currencyCode: string; isRecurring: boolean; donationType?: string; channelSource?: string; notes?: string }) =>
    post<DonationRaw>('/api/donations', body),
  getAllocationSummary:       () => get<AllocationSummary>('/api/donationallocations/summary'),
  getLatestMetrics:           () => get<SafehouseMonthlyMetric[]>('/api/safehousemonthlymetrics/latest'),
  getIncidentReports:         () => authGet<IncidentReport[]>('/api/incidentreports'),
  getUpcomingPlans:           () => authGet<UpcomingPlan[]>('/api/interventionplans/upcoming'),
  getResidentPublicCounts:    () => get<{ totalServed: number; activeResidents: number; reintegrated: number }>('/api/residents/public-counts'),
  getSocialWorkers:           () => get<SocialWorker[]>('/api/socialworkers'),
  getInterventionPlans:       () => get<InterventionPlan[]>('/api/interventionplans'),
  getNextResidentCode:        () => authGet<{ internalCode: string; caseControlNo: string }>('/api/residents/next-code'),
  createResident:             (body: { age: number; safehouseId: number; assignedSocialWorker: string; swEmail?: string; riskLevel: string }) =>
    authPost<Resident>('/api/residents', body),
  createSocialWorker:         (body: { fullName: string; email?: string; phone?: string; safehouseId?: number | null; status?: string }) =>
    authPost<SocialWorker>('/api/socialworkers', body),
  createSupporter:            (body: { firstName?: string; lastName?: string; displayName?: string; organizationName?: string; email?: string; phone?: string; supporterType?: string; status?: string; acquisitionChannel?: string }) =>
    authPost<Supporter>('/api/supporters', body),
  getUnreadNotificationCount: () => authGet<number>('/api/notifications/unread-count'),
  getNotifications:           () => authGet<SwNotification[]>('/api/notifications'),
  markAllNotificationsRead:   () => authPatch('/api/notifications/mark-all-read'),
}
