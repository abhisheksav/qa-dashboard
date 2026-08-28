import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  GitBranch,
  Info,
  Loader2,
  Play,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'
import { chart } from '@/components/charts/chart-theme'
import {
  DISPATCH_TARGETS,
  dispatchAutomationRun,
  fetchAutomationRuns,
  fetchLatestAutomationRun,
  formatDuration,
  type AutomationSummary,
  type DispatchTarget,
  type FailedTest,
  type Loaded,
  type RunRow,
} from '@/services/apiAutomation'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------ shared bits */

function StateMessage({ state }: { state: Loaded<unknown> }) {
  if (state.status === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    )
  }
  if (state.status === 'not-configured') {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>{state.message}</p>
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-status-critical/30 bg-status-critical/5 p-4 text-sm">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-status-critical" />
        <div>
          <p className="font-medium text-status-critical">Could not load</p>
          <p className="text-muted-foreground mt-0.5 break-words">{state.message}</p>
        </div>
      </div>
    )
  }
  return null
}

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className="text-2xl font-semibold tabular-nums leading-none"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

function ConclusionPill({ status, conclusion }: { status?: string; conclusion: string | null }) {
  const live = status === 'in_progress' || status === 'queued'
  const label = live ? status!.replace('_', ' ') : (conclusion ?? 'unknown')
  return (
    <span
      className={cn(
        'text-xs font-medium rounded-full px-2 py-0.5 whitespace-nowrap',
        live && 'bg-primary/10 text-primary',
        !live && conclusion === 'success' && 'bg-status-good/10 text-status-good',
        !live && conclusion === 'failure' && 'bg-status-critical/10 text-status-critical',
        !live && conclusion !== 'success' && conclusion !== 'failure' && 'bg-muted text-muted-foreground',
      )}
    >
      {label}
    </span>
  )
}

/* --------------------------------------------------------- failed tests */

function FailureRow({ failure }: { failure: FailedTest }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <TableCell className="align-top">
          <button
            type="button"
            className="flex items-start gap-1.5 text-left"
            aria-expanded={open}
            aria-label={`${open ? 'Hide' : 'Show'} error for ${failure.title}`}
          >
            <ChevronDown
              className={cn('h-4 w-4 mt-0.5 shrink-0 transition-transform', !open && '-rotate-90')}
            />
            <span className="font-medium">{failure.id ?? '—'}</span>
          </button>
        </TableCell>
        <TableCell className="align-top">
          <span className="block">{failure.title.replace(/^[A-Z][A-Z0-9-]*:\s*/, '')}</span>
          <span className="text-xs text-muted-foreground">{failure.file}</span>
        </TableCell>
        <TableCell className="align-top whitespace-nowrap text-status-critical">
          {failure.status}
        </TableCell>
        <TableCell className="align-top text-right tabular-nums whitespace-nowrap">
          {failure.attempts > 1 ? `${failure.attempts} attempts` : '1 attempt'}
        </TableCell>
        <TableCell className="align-top text-right tabular-nums whitespace-nowrap">
          {failure.durationSec}s
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/40">
            <pre className="text-xs whitespace-pre-wrap break-words font-mono max-h-64 overflow-y-auto">
              {failure.error || 'No error message captured for this test.'}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ page */

export function ApiAutomationPage() {
  const [latest, setLatest] = useState<Loaded<AutomationSummary>>({ status: 'loading' })
  const [runs, setRuns] = useState<Loaded<{ runs: RunRow[] }>>({ status: 'loading' })
  const [target, setTarget] = useState<DispatchTarget>('smoke')
  const [confirming, setConfirming] = useState(false)
  const [dispatching, setDispatching] = useState(false)

  const loadLatest = useCallback((refresh = false, signal?: AbortSignal) => {
    setLatest({ status: 'loading' })
    void fetchLatestAutomationRun({ signal, refresh }).then((next) => {
      if (!signal?.aborted) setLatest(next)
    })
  }, [])

  const loadRuns = useCallback((signal?: AbortSignal) => {
    void fetchAutomationRuns(signal).then((next) => {
      if (!signal?.aborted) setRuns(next)
    })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadLatest(false, controller.signal)
    loadRuns(controller.signal)
    return () => controller.abort()
  }, [loadLatest, loadRuns])

  async function runNow() {
    setDispatching(true)
    const result = await dispatchAutomationRun(target)
    setDispatching(false)
    setConfirming(false)

    if (result.status === 'ready') {
      toast.success(`Triggered "${target}"`, 'GitHub queues the run; it appears shortly below.')
      // GitHub creates the run asynchronously, so give it a moment to show up.
      setTimeout(() => loadRuns(), 4000)
    } else {
      // 'loading' only comes back on abort, which a dispatch never does.
      toast.error(
        'Could not trigger the run',
        'message' in result ? result.message : 'The request was interrupted.',
      )
    }
  }

  const data = latest.status === 'ready' ? latest.data : null

  return (
    <div className="flex flex-col gap-6 page-enter">
      {/* ---------------------------------------------------------- header */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold tracking-tight">API Automation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Latest report from{' '}
            <a
              href="https://github.com/Sav-Money/qa-api-automation"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Sav-Money/qa-api-automation
            </a>
            .
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={target} onValueChange={(v) => setTarget(v as DispatchTarget)}>
            <SelectTrigger className="w-48" aria-label="Test suite to run">
              <SelectValue placeholder="Suite" />
            </SelectTrigger>
            <SelectContent>
              {DISPATCH_TARGETS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => setConfirming(true)} disabled={dispatching}>
            {dispatching ? <Loader2 className="animate-spin" /> : <Play />}
            Run tests
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              loadLatest(true)
              loadRuns()
            }}
            disabled={latest.status === 'loading'}
            aria-label="Refresh report"
          >
            <RefreshCw className={latest.status === 'loading' ? 'animate-spin' : undefined} />
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------ latest run */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Latest Run</CardTitle>
          <CardDescription>
            {data
              ? `${data.workflowName} · run #${data.runNumber} · ${data.artifactName}`
              : 'Most recent report artifact.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {latest.status !== 'ready' ? (
            <StateMessage state={latest} />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
                <Stat label="Total" value={data!.total} />
                <Stat label="Passed" value={data!.passed} color={chart.good} />
                <Stat label="Failed" value={data!.failed + data!.broken} color={chart.critical} />
                <Stat label="Skipped" value={data!.skipped} color={chart.neutral} />
                <Stat label="Pass rate" value={`${data!.passRate.toFixed(1)}%`} />
                <Stat label="Duration" value={formatDuration(data!.durationMs)} />
              </div>

              {/* Proportional bar — skipped shown but excluded from pass rate. */}
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                {(
                  [
                    ['passed', data!.passed, chart.good],
                    ['failed', data!.failed + data!.broken, chart.critical],
                    ['skipped', data!.skipped, chart.neutral],
                  ] as const
                ).map(([key, value, color]) => (
                  <span
                    key={key}
                    style={{
                      width: `${(value / Math.max(data!.total, 1)) * 100}%`,
                      background: color,
                    }}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5" />
                  {data!.branch}
                </span>
                <span>{data!.event}</span>
                <span>
                  {new Date(data!.artifactCreatedAt).toLocaleString(undefined, {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <ConclusionPill conclusion={data!.conclusion} />
                <a
                  href={data!.runUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
                >
                  View on GitHub <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --------------------------------------------------- failed tests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Failed Tests {data && data.failures.length > 0 && `(${data.failures.length})`}
          </CardTitle>
          <CardDescription>Click a row to see the error the run captured.</CardDescription>
        </CardHeader>
        <CardContent>
          {latest.status !== 'ready' ? (
            <StateMessage state={latest} />
          ) : data!.failureDetailUnavailable ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                This artifact has no <code className="text-xs">test-results/results.json</code>, so
                per-test detail is unavailable — only the totals above.
              </p>
            </div>
          ) : data!.failures.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No failing tests in this run.
              {data!.skipped > 0 && ` ${data!.skipped} were skipped.`}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test ID</TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Attempts</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.failures.map((f) => (
                    <FailureRow key={`${f.file}:${f.title}`} failure={f} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --------------------------------------------------------- history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Workflow Runs</CardTitle>
          <CardDescription>Last 10 runs of the regression workflow.</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.status !== 'ready' ? (
            <StateMessage state={runs} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.data.runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium hover:underline"
                        >
                          #{r.runNumber}
                        </a>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {r.event}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {r.branch}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {r.actor || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(r.startedAt).toLocaleString(undefined, {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <ConclusionPill status={r.status} conclusion={r.conclusion} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Running the suite hits staging and notifies Slack, so it asks first
          rather than firing on a single click. */}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run the {target} suite?</DialogTitle>
            <DialogDescription>
              This triggers the API Automation Regression workflow on <strong>main</strong> in
              Sav-Money/qa-api-automation. It runs real tests against the staging environment and
              posts the result to the QA Slack channel.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={dispatching}>
              Cancel
            </Button>
            <Button onClick={() => void runNow()} disabled={dispatching}>
              {dispatching ? <Loader2 className="animate-spin" /> : <Play />}
              Run {target}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
