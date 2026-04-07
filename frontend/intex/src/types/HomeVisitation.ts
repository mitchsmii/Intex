export interface HomeVisitation {
  visitationId: number
  residentId: number | null
  visitDate: string | null
  socialWorker: string | null
  visitType: string | null
  locationVisited: string | null
  familyMembersPresent: string | null
  purpose: string | null
  observations: string | null
  familyCooperationLevel: string | null
  safetyConcernsNoted: boolean | null
  followUpNeeded: boolean | null
  followUpNotes: string | null
  visitOutcome: string | null
}
