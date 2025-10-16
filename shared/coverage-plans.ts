export type CoveragePlanId = 'basic' | 'gold' | 'silver';

export type CoveragePlanDefinition = {
  id: CoveragePlanId;
  name: string;
  features: readonly string[];
  description?: string;
};

const CORE_PLAN_FEATURES = [
  'Engine',
  'Transmission',
  'Cooling System',
  'Brake System',
  'Electrical System',
  'Drive Axle',
  'Trip Interruption',
  'Gas Refill',
  'Roadside Assistance',
  'Rental Car',
] as const;

export const COVERAGE_PLANS: Record<CoveragePlanId, CoveragePlanDefinition> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    features: CORE_PLAN_FEATURES,
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    description: 'Most Comprehensive!',
    features: [
      'Engine',
      'Transmission',
      'Seals & Gaskets',
      'Cooling System',
      'Brake System',
      'Electrical System',
      'Drive Axle',
      'Trip Interruption',
      'Gas Refill',
      'Roadside Assistance',
      'Rental Car',
      'Lock Out',
      'Steering System',
      'ABS Brakes',
      'AC System',
      'Heating System',
      'Fuel System',
      'Turbo/Supercharger',
      'Hi-Tech',
      'Front Suspension',
      'Back Suspension',
      'AWD 4x4',
      'Hybrid & EV Components',
    ],
  },
  silver: {
    id: 'silver',
    name: 'Silver',
    features: [
      'Engine',
      'Transmission',
      'Cooling System',
      'Brake System',
      'Electrical System',
      'Drive Axle',
      'Trip Interruption',
      'Gas Refill',
      'Roadside Assistance',
      'Rental Car',
      'Lock Out',
      'Steering System',
    ],
  },
};

export const COVERAGE_PLAN_IDS = Object.keys(COVERAGE_PLANS) as CoveragePlanId[];

export const getCoveragePlanDefinition = (
  plan: string | null | undefined,
): CoveragePlanDefinition | null => {
  if (!plan) {
    return null;
  }

  if (plan in COVERAGE_PLANS) {
    return COVERAGE_PLANS[plan as CoveragePlanId];
  }

  return null;
};
