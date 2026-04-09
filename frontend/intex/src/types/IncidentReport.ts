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
