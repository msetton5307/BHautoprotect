const NHTSA_API_BASE_URL = "https://vpic.nhtsa.dot.gov/api/vehicles";

interface NhtsaResponse<Result> {
  Count: number;
  Message: string;
  SearchCriteria: string | null;
  Results: Result[];
}

interface NhtsaVehicleTypeMakeResult {
  MakeId: number;
  MakeName: string;
  VehicleTypeId: number;
  VehicleTypeName: string;
}

interface NhtsaModelResult {
  Make_ID: number;
  Make_Name: string;
  Model_ID: number;
  Model_Name: string;
}

export interface VehicleMake {
  id: number;
  name: string;
}

const MAINSTREAM_US_CAR_MAKES = [
  "Acura",
  "Alfa Romeo",
  "Aston Martin",
  "Audi",
  "Bentley",
  "BMW",
  "Buick",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ferrari",
  "Fiat",
  "Ford",
  "Genesis",
  "GMC",
  "Honda",
  "Hyundai",
  "Infiniti",
  "Jaguar",
  "Jeep",
  "Kia",
  "Lamborghini",
  "Land Rover",
  "Lexus",
  "Lincoln",
  "Maserati",
  "Mazda",
  "McLaren",
  "Mercedes-Benz",
  "MINI",
  "Mitsubishi",
  "Nissan",
  "Porsche",
  "Ram",
  "Rivian",
  "Rolls-Royce",
  "Subaru",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

const MAINSTREAM_US_CAR_MAKE_SET = new Set(
  MAINSTREAM_US_CAR_MAKES.map((make) => make.trim().toLowerCase()),
);

function dedupeAndSort(values: Array<string | undefined | null>): string[] {
  const normalized = new Map<string, string>();

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (!normalized.has(key)) {
      normalized.set(key, trimmed);
    }
  }

  return Array.from(normalized.values()).sort((a, b) => a.localeCompare(b));
}

async function fetchFromNhtsa<ResultType>(
  endpoint: string,
  signal?: AbortSignal,
): Promise<NhtsaResponse<ResultType>> {
  const response = await fetch(`${NHTSA_API_BASE_URL}/${endpoint}`, {
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch vehicle data (${response.status})`);
  }

  return (await response.json()) as NhtsaResponse<ResultType>;
}

export async function fetchVehicleMakes(signal?: AbortSignal): Promise<VehicleMake[]> {
  const data = await fetchFromNhtsa<NhtsaVehicleTypeMakeResult>(
    "GetMakesForVehicleType/car?format=json",
    signal,
  );
  const makesByName = new Map<string, VehicleMake>();

  for (const result of data.Results ?? []) {
    const normalizedName = result.MakeName?.trim();
    if (!normalizedName) continue;

    if (!MAINSTREAM_US_CAR_MAKE_SET.has(normalizedName.toLowerCase())) {
      continue;
    }

    const key = normalizedName.toLowerCase();
    const makeId = Number(result.MakeId);
    if (!Number.isFinite(makeId)) {
      continue;
    }

    if (!makesByName.has(key)) {
      makesByName.set(key, {
        id: makeId,
        name: normalizedName,
      });
    }
  }

  return Array.from(makesByName.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function isValidModelYear(year?: string | null): year is string {
  if (!year) return false;

  const trimmedYear = year.trim();
  if (!/^\d{4}$/.test(trimmedYear)) {
    return false;
  }

  const numericYear = Number(trimmedYear);
  if (!Number.isFinite(numericYear)) {
    return false;
  }

  const currentYear = new Date().getFullYear();

  return numericYear >= 1900 && numericYear <= currentYear + 1;
}

export async function fetchVehicleModels(
  make: VehicleMake,
  year?: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const trimmedMake = make.name.trim();
  if (!trimmedMake) {
    return [];
  }

  const trimmedYear = year?.trim();
  if (!isValidModelYear(trimmedYear)) {
    return [];
  }

  const endpoint = `GetModelsForMakeIdYear/makeId/${encodeURIComponent(
    String(make.id),
  )}/modelyear/${encodeURIComponent(trimmedYear)}?format=json`;

  const data = await fetchFromNhtsa<NhtsaModelResult>(endpoint, signal);
  const models = data.Results?.map((result) => result.Model_Name) ?? [];

  return dedupeAndSort(models);
}
