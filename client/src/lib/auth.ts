// Utility functions for storing and retrieving admin credentials
// Credentials are stored in localStorage so admin pages can reuse them

export type Credentials = {
  username: string;
  password: string;
};

const STORAGE_KEY = "adminAuth";

export function setCredentials(creds: Credentials): void {
  // Store credentials as base64 to reuse in Authorization header
  const token = btoa(`${creds.username}:${creds.password}`);
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};
  return { Authorization: `Basic ${token}` };
}

export function hasCredentials(): boolean {
  return getAuthToken() !== null;
}

