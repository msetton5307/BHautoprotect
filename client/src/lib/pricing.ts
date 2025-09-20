export interface VehicleInfo {
  year: number;
  make: string;
  model: string;
  odometer: number;
}

export interface CoverageInfo {
  plan: "basic" | "silver" | "gold";
  deductible: number;
}

export interface LocationInfo {
  zip: string;
  state: string;
}

export interface QuoteEstimate {
  plan: CoverageInfo["plan"];
  deductible: number;
  termMonths: number;
  priceMonthly: number; // in cents
  priceTotal: number; // in cents
}

/**
 * Simple quote estimation utility used by both client and server.
 * The algorithm is intentionally simple and should be replaced with
 * real pricing logic in production.
 */
export function calculateQuote(
  vehicle: VehicleInfo,
  coverage: CoverageInfo,
  _location: LocationInfo
): QuoteEstimate {
  const currentYear = new Date().getFullYear();
  const age = Math.max(0, currentYear - vehicle.year);

  // Base monthly price by coverage plan in dollars
  let basePrice = 0;
  switch (coverage.plan) {
    case "basic":
      basePrice = 60;
      break;
    case "silver":
      basePrice = 80;
      break;
    case "gold":
      basePrice = 100;
      break;
  }

  // Adjust based on vehicle age and mileage
  basePrice += age * 2; // +$2 per year of age
  basePrice += vehicle.odometer / 10000; // +$1 per 10k miles

  const priceMonthly = Math.round(basePrice * 100); // convert to cents
  const termMonths = 36;
  const priceTotal = priceMonthly * termMonths;

  return {
    plan: coverage.plan,
    deductible: coverage.deductible,
    termMonths,
    priceMonthly,
    priceTotal,
  };
}
