// Talks to the standalone Postgres-backed API in server/. Configured via
// VITE_API_URL (see .env.example) — unset, the app falls back to
// localStorage-only mode with the dev demo login, same as it always did.

const TOKEN_KEY = 'qa-dashboard-token'

export function isApiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_API_URL)
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = import.meta.env.VITE_API_URL as string
  const token = getToken()

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.message ?? `Request failed (${res.status}).`)
  }
  return res.json() as Promise<T>
}

export interface LoginResponse {
  token: string
  user: { email: string; name: string }
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ email: string; name: string }>('/api/auth/me'),

  getState: () => request<RemoteState>('/api/state'),

  sync: (payload: SyncPayload) =>
    request<{ ok: boolean }>('/api/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}

export { ApiError }

// Kept loose (not importing the app's own domain types) so this client has no
// dependency on the store — it's a plain HTTP layer, the shapes line up with
// server/src/mapping.js on the wire and get typed properly by the caller.
export interface RemoteState {
  suites: unknown[]
  testCases: unknown[]
  runs: unknown[]
  bugs: unknown[]
  settings: unknown | null
  integrations: unknown[]
}

export interface SyncPayload {
  suites?: { upsert: unknown[]; deleteIds: string[] }
  testCases?: { upsert: unknown[]; deleteIds: string[] }
  runs?: { upsert: unknown[]; deleteIds: string[] }
  bugs?: { upsert: unknown[]; deleteIds: string[] }
  integrations?: { upsert: unknown[] }
  settings?: unknown
}
