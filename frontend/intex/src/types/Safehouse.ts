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
