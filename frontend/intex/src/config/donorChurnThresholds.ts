export const DONOR_CHURN_THRESHOLDS = {
  // Reports page bands for High / Medium / Low donor lapse risk.
  reportsHighRisk: 0.7,
  reportsMediumRisk: 0.4,
  // Donors page tiering for Critical / Moderate / Low Risk.
  donorsCriticalRisk: 0.85,
  donorsModerateRisk: 0.5,
  // Shared proxy used in lapse-rate segmentation calculations.
  lapsedProxy: 0.5,
} as const
