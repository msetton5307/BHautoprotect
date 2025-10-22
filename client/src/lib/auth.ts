// Utility functions for managing admin authentication state
// Session information is stored in localStorage so the SPA can
// determine whether to show the login form before calling the API.

export type Credentials = {
  username: string;
  password: string;
};

const STORAGE_KEY = "adminAuth";

type StoredSession = {
  username: string | null;
};

type AuthenticatedUser = {
  id?: string;
  username: string;
  role?: "admin" | "staff";
  fullName?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
};

function decodeLegacyUsername(token: string | null): string | null {
  if (!token) return null;
  try {
    const decoded = atob(token);
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) return null;
    return decoded.slice(0, separatorIndex);
  } catch {
    return null;
  }
}

function readStoredSession(): StoredSession {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { username: null };
  }

  try {
    const parsed = JSON.parse(raw) as { username?: unknown; token?: unknown } | string;
    if (typeof parsed === "string") {
      return { username: decodeLegacyUsername(parsed) };
    }

    if (parsed && typeof parsed === "object") {
      if (typeof (parsed as { username?: unknown }).username === "string") {
        return { username: (parsed as { username: string }).username };
      }
      if (typeof (parsed as { token?: unknown }).token === "string") {
        return { username: decodeLegacyUsername((parsed as { token: string }).token) };
      }
    }
  } catch {
    const legacyUsername = decodeLegacyUsername(raw);
    return { username: legacyUsername };
  }

  return { username: null };
}

function storeSession(username: string): void {
  const payload: StoredSession = { username };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function clearStoredSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getStoredUsername(): string | null {
  return readStoredSession().username;
}

export function hasCredentials(): boolean {
  return getStoredUsername() !== null;
}

type LoginResponse =
  | { success: true; user: AuthenticatedUser | null }
  | { success: false; message: string };

export async function login(credentials: Credentials): Promise<LoginResponse> {
  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(credentials),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      clearStoredSession();
      const message = typeof data?.message === "string"
        ? data.message
        : "Invalid username or password";
      return { success: false, message };
    }

    const user = data?.data as AuthenticatedUser | null | undefined;
    const username = typeof user?.username === "string" ? user.username : credentials.username;
    storeSession(username);
    return { success: true, user: user ?? { username } };
  } catch {
    clearStoredSession();
    return { success: false, message: "Unable to login. Please try again." };
  }
}

export async function checkSession(): Promise<boolean> {
  try {
    const response = await fetch("/api/admin/me", { credentials: "include" });
    if (!response.ok) {
      if (response.status === 401) {
        clearStoredSession();
      }
      return false;
    }

    const data = await response.json().catch(() => ({}));
    const user = data?.data as { username?: string } | null | undefined;
    if (user && typeof user.username === "string") {
      storeSession(user.username);
    }
    return true;
  } catch {
    return false;
  }
}

export function clearCredentials(): void {
  clearStoredSession();
  void fetch("/api/admin/logout", {
    method: "POST",
    credentials: "include",
  }).catch(() => undefined);
}

export function fetchWithAuth(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(input, { ...init, credentials: "include" });
}

export function getAuthHeaders(): Record<string, string> {
  return {};
}

