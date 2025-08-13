interface VehicleData {
  year: number;
  make: string;
  model: string;
  odometer: number;
}

interface CoverageData {
  plan: 'powertrain' | 'gold' | 'platinum';
  deductible: number;
}

interface LocationData {
  zip: string;
  state: string;
}

interface PricingEstimate {
  plans: {
    powertrain: {
      monthly: number;
      total: number;
      features: string[];
    };
    gold: {
      monthly: number;
      total: number;
      features: string[];
    };
    platinum: {
      monthly: number;
      total: number;
      features: string[];
    };
  };
  recommended: 'powertrain' | 'gold' | 'platinum';
  disclaimers: string[];
}

export function calculateQuote(
  vehicle: VehicleData,
  coverage: CoverageData,
  location: LocationData
): PricingEstimate {
  // Base pricing by plan
  const basePricing = {
    powertrain: { monthly: 79, total: 948 },
    gold: { monthly: 129, total: 1548 },
    platinum: { monthly: 199, total: 2388 },
  };

  // Adjustments based on vehicle age
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - vehicle.year;
  let ageMultiplier = 1.0;
  
  if (vehicleAge <= 3) {
    ageMultiplier = 0.9; // 10% discount for newer vehicles
  } else if (vehicleAge >= 10) {
    ageMultiplier = 1.3; // 30% increase for older vehicles
  }

  // Adjustments based on mileage
  let mileageMultiplier = 1.0;
  if (vehicle.odometer > 100000) {
    mileageMultiplier = 1.2; // 20% increase for high mileage
  } else if (vehicle.odometer < 30000) {
    mileageMultiplier = 0.95; // 5% discount for low mileage
  }

  // State-based adjustments (simplified)
  let stateMultiplier = 1.0;
  const highCostStates = ['CA', 'NY', 'FL'];
  if (highCostStates.includes(location.state)) {
    stateMultiplier = 1.1; // 10% increase for high-cost states
  }

  // Calculate adjusted pricing
  const totalMultiplier = ageMultiplier * mileageMultiplier * stateMultiplier;

  const adjustedPricing = {
    powertrain: {
      monthly: Math.round(basePricing.powertrain.monthly * totalMultiplier),
      total: Math.round(basePricing.powertrain.total * totalMultiplier),
      features: [
        'Engine & transmission coverage',
        '24/7 roadside assistance',
        'Nationwide service network',
        'Rental car coverage',
      ],
    },
    gold: {
      monthly: Math.round(basePricing.gold.monthly * totalMultiplier),
      total: Math.round(basePricing.gold.total * totalMultiplier),
      features: [
        'Everything in Powertrain',
        'Air conditioning & heating',
        'Electrical system coverage',
        'Fuel system protection',
        'Enhanced rental coverage',
      ],
    },
    platinum: {
      monthly: Math.round(basePricing.platinum.monthly * totalMultiplier),
      total: Math.round(basePricing.platinum.total * totalMultiplier),
      features: [
        'Everything in Gold',
        'High-tech component coverage',
        'EV battery protection',
        'Wear & tear items included',
        'Premium roadside assistance',
      ],
    },
  };

  // Determine recommended plan based on vehicle
  let recommended: 'powertrain' | 'gold' | 'platinum' = 'gold';
  if (vehicleAge <= 3 && vehicle.odometer < 50000) {
    recommended = 'platinum';
  } else if (vehicleAge >= 8 || vehicle.odometer > 80000) {
    recommended = 'powertrain';
  }

  return {
    plans: adjustedPricing,
    recommended,
    disclaimers: [
      'Coverage varies by plan and vehicle.',
      'Waiting period and exclusions may apply.',
      'Prices shown are estimates and may vary based on final underwriting.',
      'Terms and conditions apply.',
    ],
  };
}
