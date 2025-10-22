const NHTSA_API_BASE_URL = "https://vpic.nhtsa.dot.gov/api/vehicles";

interface NhtsaResponse<Result> {
  Count: number;
  Message: string;
  SearchCriteria: string | null;
  Results: Result[];
}

interface NhtsaMakeResult {
  Make_ID: number;
  Make_Name: string;
}

interface NhtsaModelResult {
  Make_ID: number;
  Make_Name: string;
  Model_ID: number;
  Model_Name: string;
}

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

export async function fetchVehicleMakes(signal?: AbortSignal): Promise<string[]> {
  const data = await fetchFromNhtsa<NhtsaMakeResult>("GetAllMakes?format=json", signal);
  const makes = data.Results?.map((result) => result.Make_Name) ?? [];

  return dedupeAndSort(makes);
}

export async function fetchVehicleModels(
  make: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const trimmedMake = make.trim();
  if (!trimmedMake) {
    return [];
  }

  const endpoint = `GetModelsForMake/${encodeURIComponent(trimmedMake)}?format=json`;
  const data = await fetchFromNhtsa<NhtsaModelResult>(endpoint, signal);
  const models = data.Results?.map((result) => result.Model_Name) ?? [];

  return dedupeAndSort(models);
}

