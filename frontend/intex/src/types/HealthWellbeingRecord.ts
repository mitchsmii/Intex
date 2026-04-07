export interface HealthWellbeingRecord {
  healthRecordId: number
  residentId: number | null
  recordDate: string | null
  generalHealthScore: number | null
  nutritionScore: number | null
  sleepQualityScore: number | null
  energyLevelScore: number | null
  heightCm: number | null
  weightKg: number | null
  bmi: number | null
  medicalCheckupDone: boolean | null
  dentalCheckupDone: boolean | null
  psychologicalCheckupDone: boolean | null
  notes: string | null
}
