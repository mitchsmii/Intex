export type ActionItemReason = 'overdue-visit' | 'plan-review' | 'high-risk'
export type ActionItemSeverity = 'low' | 'medium' | 'high'

export interface ActionItem {
  residentId: number
  residentCode: string
  reason: ActionItemReason
  severity: ActionItemSeverity
  detail?: string
}
