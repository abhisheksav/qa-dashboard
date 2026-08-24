import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, PlayCircle, Bug as BugIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RunStatusBadge, StatusBadge, PriorityBadge } from '@/components/shared/badges'
import { KpiCard } from '@/components/shared/KpiCard'
import { useDataStore } from '@/store/useDataStore'
import { runStats } from '@/lib/stats'
import { formatDateTime, formatDuration } from '@/lib/utils'
import { statusColor } from '@/components/charts/chart-theme'
import { CheckCircle2, XCircle, Ban, SkipForward, CircleDashed, Percent, Timer } from 'lucide-react'

export function RunDetailPage() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const { runs, testCases } = useDataStore()
  const run = runs.find((r) => r.id === runId)

  const rows = useMemo(() => {
    if (!run) return []
    return run.caseIds.map((caseId) => {
      const tcase = testCases.find((c) => c.id === caseId)
      const result = run.results[caseId]
      return { caseId, tcase, result }
    })
  }, [run, testCases])

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-muted-foreground">Run not found.</p>
        <Button variant="outline" onClick={() => navigate('/runs')}>Back to Test Runs</Button>
      </div>
    )
  }

  const stats = runStats(run)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/runs')} aria-label="Back to runs">
          <ArrowLeft />
        </Button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{run.id}</h1>
            <RunStatusBadge status={run.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {run.suiteName} · {run.tester} · Build {run.build} · {run.environment} · {run.sprint} ·
            started {formatDateTime(run.startedAt)}
          </p>
        </div>
        {run.status === 'In Progress' && (
          <Button className="ml-auto" onClick={() => navigate(`/execute/${run.id}`)}>
            <PlayCircle /> Continue Execution
          </Button>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-7">
        <KpiCard label="Pass Rate" value={`${stats.passRate}%`} icon={Percent} />
        <KpiCard label="Duration" value={formatDuration(stats.durationSec)} icon={Timer} />
        <KpiCard label="Passed" value={stats.passed} icon={CheckCircle2} iconClassName="bg-status-good/10 text-success-text" />
        <KpiCard label="Failed" value={stats.failed} icon={XCircle} iconClassName="bg-status-critical/10 text-status-critical" />
        <KpiCard label="Blocked" value={stats.blocked} icon={Ban} iconClassName="bg-status-serious/10 text-status-serious" />
        <KpiCard label="Skipped" value={stats.skipped} icon={SkipForward} />
        <KpiCard label="Not Executed" value={stats.notExecuted} icon={CircleDashed} />
      </div>

      {stats.total > 0 && (
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted gap-[2px]">
          {(['Passed', 'Failed', 'Blocked', 'Skipped', 'Not Executed'] as const)
            .map((s) => ({ s, n: stats[s === 'Not Executed' ? 'notExecuted' : (s.toLowerCase() as 'passed' | 'failed' | 'blocked' | 'skipped')] }))
            .filter(({ n }) => n > 0)
            .map(({ s, n }) => (
              <span
                key={s}
                style={{ width: `${(n / stats.total) * 100}%`, background: statusColor[s] }}
                title={`${s}: ${n}`}
              />
            ))}
        </div>
      )}

      <Card>
        <div className="rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Case ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Actual Result</TableHead>
                <TableHead>Bug</TableHead>
                <TableHead className="text-right">Executed At</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ caseId, tcase, result }) => (
                <TableRow key={caseId}>
                  <TableCell className="font-medium whitespace-nowrap">{caseId}</TableCell>
                  <TableCell>
                    <span className="block max-w-[22rem] truncate" title={tcase?.title}>
                      {tcase?.title ?? <span className="text-faint">(case deleted)</span>}
                    </span>
                  </TableCell>
                  <TableCell>
                    {tcase ? <Badge variant="secondary">{tcase.module}</Badge> : '—'}
                  </TableCell>
                  <TableCell>{tcase ? <PriorityBadge priority={tcase.priority} /> : '—'}</TableCell>
                  <TableCell>
                    <StatusBadge status={result?.status ?? 'Not Executed'} />
                  </TableCell>
                  <TableCell>
                    <span className="block max-w-[18rem] truncate text-muted-foreground" title={result?.actualResult}>
                      {result?.actualResult || '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {result?.bugId ? (
                      <Link
                        to={`/bugs?q=${encodeURIComponent(result.bugId)}`}
                        className="inline-flex items-center gap-1 text-xs text-status-critical hover:underline whitespace-nowrap"
                      >
                        <BugIcon className="h-3 w-3" /> {result.bugId}
                      </Link>
                    ) : (
                      <span className="text-faint text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground whitespace-nowrap text-xs">
                    {result?.executedAt ? formatDateTime(result.executedAt) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground text-xs">
                    {result?.durationSec != null ? formatDuration(result.durationSec) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
