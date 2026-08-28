import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, GitBranch, Info, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { chart } from '@/components/charts/chart-theme'
import {
  fetchLatestAutomationRun,
  formatDuration,
  type AutomationSummary,
  type Loaded,
} from '@/services/apiAutomation'

// Compact summary of the API automation suite's latest run. The full section —
// failed tests and manual triggering — lives at /api-automation.

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className="text-xl font-semibold tabular-nums leading-none"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

export function AutomationRunCard() {
  const [state, setState] = useState<Loaded<AutomationSummary>>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    void fetchLatestAutomationRun({ signal: controller.signal }).then((next) => {
      if (!controller.signal.aborted) setState(next)
    })
    return () => controller.abort()
  }, [])

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">API Automation — Latest Run</CardTitle>
          <CardDescription>
            {state.status === 'ready'
              ? `${state.data.repo} · run #${state.data.runNumber}`
              : 'Sav-Money/qa-api-automation'}
          </CardDescription>
        </div>
        <Link
          to="/api-automation"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0"
        >
          Details <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>

      <CardContent>
        {state.status === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Fetching the latest report…
          </div>
        )}

        {state.status === 'not-configured' && (
          <div className="flex items-start gap-2.5 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>{state.message}</p>
          </div>
        )}

        {state.status === 'error' && (
          <div className="flex items-start gap-2.5 rounded-lg border border-status-critical/30 bg-status-critical/5 p-4 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-status-critical" />
            <div>
              <p className="font-medium text-status-critical">Could not load the latest run</p>
              <p className="text-muted-foreground mt-0.5 break-words">{state.message}</p>
            </div>
          </div>
        )}

        {state.status === 'ready' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <Stat label="Total" value={state.data.total} />
              <Stat label="Passed" value={state.data.passed} color={chart.good} />
              <Stat
                label="Failed"
                value={state.data.failed + state.data.broken}
                color={chart.critical}
              />
              <Stat label="Skipped" value={state.data.skipped} color={chart.neutral} />
              <Stat label="Pass rate" value={`${state.data.passRate.toFixed(1)}%`} />
            </div>

            {/* Proportional bar — skipped shown but excluded from pass rate. */}
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
              {(
                [
                  ['passed', state.data.passed, chart.good],
                  ['failed', state.data.failed + state.data.broken, chart.critical],
                  ['skipped', state.data.skipped, chart.neutral],
                ] as const
              ).map(([key, value, color]) => (
                <span
                  key={key}
                  style={{
                    width: `${(value / Math.max(state.data.total, 1)) * 100}%`,
                    background: color,
                  }}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />
                {state.data.branch}
              </span>
              <span>{state.data.event}</span>
              <span>{formatDuration(state.data.durationMs)}</span>
              <span>
                {new Date(state.data.artifactCreatedAt).toLocaleString(undefined, {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {state.data.failures.length > 0 && (
                <Link to="/api-automation" className="text-status-critical hover:underline">
                  {state.data.failures.length} failing test
                  {state.data.failures.length === 1 ? '' : 's'}
                </Link>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
