// GigSetu Preventive Maintenance AI (MOCK MODULE — prototype)
// For institutional customers and housing societies. Synthetic building health
// profiles with explainable signals → preventive maintenance recommendations.
//
// PROTOTYPE LABEL: mock module — no real sensor/CRM integration. Designed to show
// how authorized building data would drive preventive dispatch.

import type { MaintenanceProfile, MaintenanceSignal, MaintenanceRecommendation } from './types'

const PROFILES: MaintenanceProfile[] = [
  {
    id: 'sai-heritage',
    name: 'Sai Heritage Society',
    type: 'Housing society · 18 years',
    buildingAgeYears: 18,
    units: 64,
    area: 'Kothrud',
    healthScore: 68,
    lastInspectionMonthsAgo: 8,
    signals: [
      { key: 'age', label: 'Building age', value: '18 years', trend: 'warn', note: 'Plumbing typically due for review at 15–20 years' },
      { key: 'water', label: 'Water complaints (90 days)', value: '+23%', trend: 'up', note: '12 water-related tickets vs 9 last quarter' },
      { key: 'pipes', label: 'Previous pipe failures', value: 'Increasing', trend: 'up', note: '3 failures in 18 months — 2 on the same riser' },
      { key: 'inspection', label: 'Last plumbing inspection', value: '8 months ago', trend: 'warn', note: 'Cooperative policy: every 6 months' },
      { key: 'load', label: 'Electrical load pattern', value: 'Normal', trend: 'flat', note: 'No anomaly in society common-area load' },
    ],
    recommendations: [
      {
        id: 'pm-plumb-1',
        categoryKey: 'plumber',
        title: 'Schedule preventive plumbing inspection',
        severity: 'HIGH',
        detail: 'Building age (18y) + rising water complaints (+23%) + repeat pipe failures on one riser strongly indicate a developing main-line issue.',
        action: 'Book a cooperative plumbing team for riser-wise pressure inspection; camera-scoping of the repeated failure segment.',
        suggestedWindow: 'Within 10 days · weekday morning slot',
        estCostRange: [1800, 3500],
      },
      {
        id: 'pm-elec-1',
        categoryKey: 'electrician',
        title: 'Common-area earthing check',
        severity: 'LOW',
        detail: '18-year-old wiring in stairwell lighting — no failures yet, preventive check recommended with the next visit.',
        action: 'Bundle a low-cost earthing & MCB review during the plumbing visit.',
        suggestedWindow: 'Same visit bundle',
        estCostRange: [600, 1200],
      },
    ],
    disclaimer: 'Mock module — synthetic building profile for prototype demonstration.',
  },
  {
    id: 'shivneri-hostel',
    name: 'Shivneri Boys Hostel',
    type: 'Institution · 11 years',
    buildingAgeYears: 11,
    units: 120,
    area: 'Bavdhan',
    healthScore: 81,
    lastInspectionMonthsAgo: 3,
    signals: [
      { key: 'age', label: 'Building age', value: '11 years', trend: 'flat', note: 'Within normal maintenance cycle' },
      { key: 'water', label: 'Water complaints (90 days)', value: 'Stable', trend: 'flat', note: '4 tickets — consistent with baseline' },
      { key: 'geyser', label: 'Geyser failures reported', value: '2 this month', trend: 'up', note: 'Both units >8 years old — batch replacement candidate' },
      { key: 'inspection', label: 'Last electrical inspection', value: '3 months ago', trend: 'flat', note: 'Compliant with institutional schedule' },
    ],
    recommendations: [
      {
        id: 'pm-appl-1',
        categoryKey: 'appliance',
        title: 'Batch geyser replacement plan',
        severity: 'MEDIUM',
        detail: 'Two geyser failures this month on units installed together — the remaining batch (6 units) is at end-of-life risk before winter.',
        action: 'Create a planned replacement work-order for 6 geysers before November peak.',
        suggestedWindow: 'Next 30 days · before winter peak',
        estCostRange: [9000, 14000],
      },
    ],
    disclaimer: 'Mock module — synthetic building profile for prototype demonstration.',
  },
]

export function getMaintenanceProfiles(): { ok: boolean; profiles: MaintenanceProfile[]; disclaimer: string } {
  return {
    ok: true,
    profiles: PROFILES,
    disclaimer: 'Preventive Maintenance AI — mock module with synthetic building profiles. Prototype only, designed for authorized integration with society CRM / sensor data.',
  }
}

// Signal builders kept exported so future real integrations can assemble profiles
export function signalFromComplaintTrend(current: number, previous: number): MaintenanceSignal {
  const pct = previous === 0 ? 100 : Math.round(((current - previous) / previous) * 100)
  return {
    key: 'water',
    label: 'Water complaints (90 days)',
    value: `${pct >= 0 ? '+' : ''}${pct}%`,
    trend: pct > 10 ? 'up' : pct < -10 ? 'down' : 'flat',
    note: `${current} water-related tickets vs ${previous} last quarter`,
  }
}
