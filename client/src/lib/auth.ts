// Utility functions for storing and retrieving admin credentials
// Credentials are stored in localStorage so admin pages can reuse them

export type Credentials = {
  username: string;
  password: string;
};

const STORAGE_KEY = "adminAuth";

type StoredCredentials = {
  token: string;
  username: string;
};

function encodeCredentials(username: string, password: string): string {
  return btoa(`${username}:${password}`);
}

function decodeUsername(token: string | null): string | null {
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

function readStoredCredentials(): { token: string | null; username: string | null } {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { token: null, username: null };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredCredentials> | string;
    if (typeof parsed === "string") {
      return { token: parsed, username: decodeUsername(parsed) };
    }
    const token = typeof parsed.token === "string" ? parsed.token : null;
    const username =
      typeof parsed.username === "string"
        ? parsed.username
        : decodeUsername(token);
    return { token, username };
  } catch {
    return { token: raw, username: decodeUsername(raw) };
  }
}

export function setCredentials(creds: Credentials): void {
  const token = encodeCredentials(creds.username, creds.password);
  const payload: StoredCredentials = { token, username: creds.username };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getAuthToken(): string | null {
  return readStoredCredentials().token;
}

export function getStoredUsername(): string | null {
  return readStoredCredentials().username;
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};
  return { Authorization: `Basic ${token}` };
}

export function hasCredentials(): boolean {
  return getAuthToken() !== null;
}

