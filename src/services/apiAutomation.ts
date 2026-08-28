// Client for the latest run of the API automation suite
// (Sav-Money/qa-api-automation).
//
// The report is a GitHub Actions artifact on an INTERNAL repo, so reading it
// needs a credential that must never reach the browser. This talks to a
// server-side endpoint instead, which holds the token and returns only the
// numbers. In dev that endpoint is the Vite plugin in vite/apiAutomation.ts;
// a deployed build needs the same route served by a real backend.

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
}

export type AutomationState =
  | { status: 'loading' }
  /** No token configured — the feature is off rather than broken. */
  | { status: 'not-configured'; message: string }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: AutomationSummary }

export async function fetchLatestAutomationRun(signal?: AbortSignal): Promise<AutomationState> {
  try {
    const res = await fetch('/api/automation/latest', { signal })

    if (res.status === 501) {
      const body = (await res.json()) as { message?: string }
      return {
        status: 'not-configured',
        message: body.message ?? 'Automation reporting is not configured.',
      }
    }

    if (!res.ok) {
      // A static build has no such route, so the dev server's JSON is absent
      // and we get the SPA's index.html back instead of an error payload.
      const body = await res.text()
      let message = `Request failed (${res.status}).`
      try {
        message = (JSON.parse(body) as { message?: string }).message ?? message
      } catch {
        message = 'No automation endpoint is available in this build.'
      }
      return { status: 'error', message }
    }

    return { status: 'ready', data: (await res.json()) as AutomationSummary }
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') return { status: 'loading' }
    return { status: 'error', message: e instanceof Error ? e.message : String(e) }
  }
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
