// Client for the API automation suite (Sav-Money/qa-api-automation).
//
// The report is a GitHub Actions artifact on an INTERNAL repo and dispatching a
// run needs `workflow` scope, so both need a credential the browser must never
// hold. This talks to server-side routes that keep the token and return only
// results. In dev those routes come from vite/apiAutomation.ts; a deployed
// build needs the same contract from a real backend (docs/api-automation.md).

export const DISPATCH_TARGETS = [
  'smoke',
  'recurring-buys-gold',
  'sav-gold',
  'auth',
  'onboarding',
  'regression',
  'all',
] as const

export type DispatchTarget = (typeof DISPATCH_TARGETS)[number]

export interface FailedTest {
  /** Leading id token in the test title, e.g. "KYC-GATE-001". */
  id: string | null
  title: string
  file: string
  suite: string
  status: string
  attempts: number
  durationSec: number
  error: string
}

export interface AutomationSummary {
  repo: string
  runId: number
  runNumber: number
  runUrl: string
  workflowName: string
  event: string
  branch: string
  conclusion: string | null
  startedAt: string
  artifactName: string
  artifactCreatedAt: string
  durationMs: number
  total: number
  passed: number
  failed: number
  broken: number
  skipped: number
  unknown: number
  passRate: number
  failures: FailedTest[]
  failureDetailUnavailable: boolean
}

export interface RunRow {
  id: number
  runNumber: number
  name: string
  event: string
  branch: string
  status: string
  conclusion: string | null
  startedAt: string
  updatedAt: string
  url: string
  actor: string
}

export type Loaded<T> =
  | { status: 'loading' }
  /** No credential configured — the feature is off rather than broken. */
  | { status: 'not-configured'; message: string }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T }

async function request<T>(path: string, init?: RequestInit): Promise<Loaded<T>> {
  try {
    const res = await fetch(`/api/automation${path}`, init)

    if (res.status === 501) {
      const body = (await res.json()) as { message?: string }
      return {
        status: 'not-configured',
        message: body.message ?? 'Automation reporting is not configured.',
      }
    }

    if (!res.ok) {
      // A static build has no such route, so instead of an error payload the
      // SPA's index.html comes back — detect that and say so plainly.
      const text = await res.text()
      let message = `Request failed (${res.status}).`
      try {
        message = (JSON.parse(text) as { message?: string }).message ?? message
      } catch {
        message = 'No automation endpoint is available in this build.'
      }
      return { status: 'error', message }
    }

    return { status: 'ready', data: (await res.json()) as T }
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') return { status: 'loading' }
    return { status: 'error', message: e instanceof Error ? e.message : String(e) }
  }
}

export function fetchLatestAutomationRun(opts?: { signal?: AbortSignal; refresh?: boolean }) {
  return request<AutomationSummary>(`/latest${opts?.refresh ? '?refresh=1' : ''}`, {
    signal: opts?.signal,
  })
}

export function fetchAutomationRuns(signal?: AbortSignal) {
  return request<{ runs: RunRow[] }>('/runs', { signal })
}

export function dispatchAutomationRun(target: DispatchTarget) {
  return request<{ ok: boolean; target: string }>('/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }),
  })
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
