export interface ProcessRecording {
  recordingId: number
  residentId: number | null
  sessionDate: string | null
  socialWorker: string | null
  sessionType: string | null
  sessionDurationMinutes: number | null
  emotionalStateObserved: string | null
  emotionalStateEnd: string | null
  sessionNarrative: string | null
  interventionsApplied: string | null
  followUpActions: string | null
  progressNoted: boolean | null
  concernsFlagged: boolean | null
  referralMade: boolean | null
}
