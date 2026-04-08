export type Instrument = 'PCL5' | 'SUICIDE_RISK' | 'BDI' | 'BAI'

export type Severity =
  | 'Minimal'
  | 'Mild'
  | 'Borderline'
  | 'Moderate'
  | 'Severe'
  | 'Extreme'
  | 'Low'
  | 'High'
  | 'Emergency'
  | 'NotPTSD'
  | 'ProbablePTSD'

export interface Assessment {
  assessmentId: number
  residentId: number
  instrument: Instrument
  administeredDate: string // YYYY-MM-DD
  administeredBy: string
  totalScore: number | null
  tickCount: number | null
  severityBand: Severity | null
  responsesJson: string | null
  worstEvent: string | null
  immediateAction: string | null
  observationNotes: string | null
  createdAt: string
}
