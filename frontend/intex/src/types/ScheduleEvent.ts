export type ScheduleEventType = 'HomeVisit' | 'CaseConference'

export interface ScheduleEvent {
  id: string
  type: ScheduleEventType
  residentId: number
  residentCode: string
  date: string // ISO
  location?: string
  notes?: string
}
