export type CustomerAccount = {
  id: string;
  email: string;
  displayName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastLoginAt?: string | null;
};

export type CustomerPolicy = {
  id: string;
  leadId: string;
  package: string | null;
  expirationMiles: number | null;
  expirationDate: string | null;
  deductible: number | null;
  totalPremium: number | null;
  downPayment: number | null;
  policyStartDate: string | null;
  monthlyPayment: number | null;
  totalPayments: number | null;
  createdAt: string | null;
  lead: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    state?: string | null;
    zip?: string | null;
  } | null;
  vehicle: {
    id?: string;
    year?: number | null;
    make?: string | null;
    model?: string | null;
    trim?: string | null;
    vin?: string | null;
    odometer?: number | null;
  } | null;
};

export type CustomerClaim = {
  id: string;
  policyId: string | null;
  status: string;
  nextEstimate: string | null;
  nextPayment: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message: string;
  claimReason?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerPaymentProfile = {
  id: string;
  customerId: string;
  policyId: string;
  paymentMethod: string | null;
  accountName: string | null;
  accountIdentifier: string | null;
  autopayEnabled: boolean;
  notes: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type StoredSession = {
  email: string | null;
  displayName?: string | null;
};

const STORAGE_KEY = "customerPortalAuth";

function readStoredSession(): StoredSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { email: null, displayName: null };
    }
    const parsed = JSON.parse(raw) as StoredSession;
    return {
      email: typeof parsed.email === "string" ? parsed.email : null,
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : null,
    };
  } catch {
    return { email: null, displayName: null };
  }
}

function storeSession(email: string, displayName?: string | null) {
  const payload: StoredSession = {
    email,
    displayName: displayName ?? null,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function clearStoredSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getStoredCustomerEmail(): string | null {
  return readStoredSession().email;
}

export function getStoredCustomerName(): string | null {
  return readStoredSession().displayName ?? null;
}

export type CustomerSessionSnapshot = {
  customer: CustomerAccount;
  policies: CustomerPolicy[];
};

type AuthSuccess = {
  success: true;
  customer: CustomerAccount;
  policies: CustomerPolicy[];
};

type AuthFailure = {
  success: false;
  message: string;
};

export type AuthResult = AuthSuccess | AuthFailure;

type Credentials = {
  email: string;
  policyId: string;
};

function mapAuthResponse(data: unknown): AuthSuccess | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const payload = (data as { customer?: unknown; policies?: unknown }).customer;
  const policies = (data as { policies?: unknown }).policies;

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const customer = payload as CustomerAccount;
  if (!customer || typeof customer.email !== "string") {
    return null;
  }

  return {
    success: true,
    customer,
    policies: Array.isArray(policies) ? (policies as CustomerPolicy[]) : [],
  } as AuthSuccess;
}

async function handleAuthRequest(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<AuthResult> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        typeof (json as { message?: unknown }).message === "string"
          ? (json as { message: string }).message
          : "Unable to complete the request.";
      return { success: false, message };
    }

    const mapped = mapAuthResponse((json as { data?: unknown }).data);
    if (!mapped) {
      return { success: false, message: "Unexpected response from server." };
    }

    storeSession(mapped.customer.email, mapped.customer.displayName ?? null);
    return mapped;
  } catch {
    return { success: false, message: "Unable to reach the server. Please try again." };
  }
}

export async function loginCustomer(payload: Credentials): Promise<AuthResult> {
  return handleAuthRequest("/api/customer/login", payload);
}

export async function checkCustomerSession(): Promise<CustomerSessionSnapshot | null> {
  try {
    const response = await fetch("/api/customer/session", {
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearStoredSession();
      }
      return null;
    }

    const json = await response.json().catch(() => ({}));
    const data = (json as { data?: unknown }).data;
    if (!data || typeof data !== "object") {
      return null;
    }

    const authenticated = (data as { authenticated?: unknown }).authenticated;
    if (!authenticated) {
      return null;
    }

    const mapped = mapAuthResponse(data);
    if (!mapped) {
      return null;
    }

    storeSession(mapped.customer.email, mapped.customer.displayName ?? null);
    return { customer: mapped.customer, policies: mapped.policies };
  } catch {
    return null;
  }
}

export async function logoutCustomer(): Promise<void> {
  clearStoredSession();
  try {
    await fetch("/api/customer/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // ignore network errors during logout
  }
}

export async function fetchCustomerJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || response.statusText);
  }

  return response.json() as Promise<T>;
}
