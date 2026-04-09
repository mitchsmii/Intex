export interface EducationRecord {
  educationRecordId: number
  residentId: number | null
  recordDate: string | null
  educationLevel: string | null
  schoolName: string | null
  enrollmentStatus: string | null
  attendanceRate: number | null
  progressPercent: number | null
  completionStatus: string | null
  notes: string | null
}
