import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Gauge, Percent, ClipboardCheck, PlayCircle, ArrowRight, Bot, Hand } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { KpiCard } from '@/components/shared/KpiCard'
import { RunStatusBadge } from '@/components/shared/badges'
import { StartRunDialog } from '@/components/shared/StartRunDialog'
import { useDataStore } from '@/store/useDataStore'
import {
  activeCases,
  caseStatusCounts,
  executionProgress,
  executionTypeCounts,
  overallPassRate,
  runStats,
  todaysResults,
} from '@/lib/stats'
import { relativeTime } from '@/lib/utils'
import { statusColor, executionTypeColor } from '@/components/charts/chart-theme'

export function DashboardPage() {
  const navigate = useNavigate()
  const { testCases, suites, runs } = useDataStore()
  const [runSuiteId, setRunSuiteId] = useState<string | null>(null)

  // Archived cases are retired — they're dropped from every count/bar below
  // (the run history that produced them is untouched).
  const activeTestCases = useMemo(() => activeCases(testCases), [testCases])
  const archivedCount = testCases.length - activeTestCases.length
  const counts = useMemo(() => caseStatusCounts(testCases), [testCases])
  const execCounts = useMemo(() => executionTypeCounts(testCases), [testCases])
  const automationPct =
    activeTestCases.length > 0 ? Math.round((execCounts.Automated / activeTestCases.length) * 100) : 0
  const passRate = useMemo(() => overallPassRate(testCases), [testCases])
  const progress = useMemo(() => executionProgress(testCases), [testCases])
  const today = useMemo(() => todaysResults(runs), [runs])
  const pendingReview = useMemo(
    () => testCases.filter((c) => c.reviewStatus === 'Pending').length,
    [testCases],
  )

  const smoke = suites.find((s) => s.name === 'Smoke')

  const recentRuns = useMemo(
    () => [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 5),
    [runs],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Test execution at a glance</p>
        </div>
        {smoke && (
          <Button onClick={() => setRunSuiteId(smoke.id)}>
            <PlayCircle /> Run Smoke Suite
          </Button>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4 stagger">
        <KpiCard
          label="Total Test Cases"
          value={activeTestCases.length}
          icon={FileText}
          sub={archivedCount > 0 ? `${archivedCount} archived (excluded)` : undefined}
          onClick={() => navigate('/cases')}
        />
        <KpiCard
          label="Execution Progress"
          value={`${progress}%`}
          icon={Gauge}
          sub={`${activeTestCases.length - counts['Not Executed']} of ${activeTestCases.length} executed`}
        />
        <KpiCard label="Pass Rate" value={`${passRate}%`} icon={Percent} sub="of executed results" />
        <KpiCard
          label="Pending Review"
          value={pendingReview}
          icon={ClipboardCheck}
          sub="waiting for approval"
          onClick={() => navigate('/review')}
        />
      </div>

      <Card className="p-4">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted gap-[2px]">
          {(['Passed', 'Failed', 'Blocked', 'Skipped', 'Not Executed'] as const)
            .filter((s) => counts[s] > 0)
            .map((s) => (
              <span
                key={s}
                style={{ width: `${(counts[s] / activeTestCases.length) * 100}%`, background: statusColor[s] }}
                title={`${s}: ${counts[s]}`}
              />
            ))}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(['Passed', 'Failed', 'Blocked', 'Skipped', 'Not Executed'] as const)
            .filter((s) => counts[s] > 0)
            .map((s) => (
              <button
                key={s}
                onClick={() => navigate(`/cases?status=${s}`)}
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer"
              >
                <span className="h-2 w-2 rounded-sm" style={{ background: statusColor[s] }} />
                {s} {counts[s]}
              </button>
            ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold">Manual vs Automated</h2>
          <span className="text-xs text-muted-foreground">
            {execCounts.Automated} automated · {execCounts.Manual} pending automation · {automationPct}% coverage
          </span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted gap-[2px]">
          {(['Manual', 'Automated'] as const)
            .filter((t) => execCounts[t] > 0)
            .map((t) => (
              <span
                key={t}
                style={{ width: `${(execCounts[t] / activeTestCases.length) * 100}%`, background: executionTypeColor[t] }}
                title={`${t}: ${execCounts[t]}`}
              />
            ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/cases?execution=Manual')}
            className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 cursor-pointer"
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full shrink-0"
              style={{ background: `color-mix(in srgb, ${executionTypeColor.Manual} 15%, transparent)`, color: executionTypeColor.Manual }}
            >
              <Hand className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-lg font-semibold leading-none tabular-nums">{execCounts.Manual}</span>
              <span className="block text-xs text-muted-foreground mt-1">Manual test cases</span>
            </span>
          </button>
          <button
            onClick={() => navigate('/cases?execution=Automated')}
            className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 cursor-pointer"
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full shrink-0"
              style={{ background: `color-mix(in srgb, ${executionTypeColor.Automated} 15%, transparent)`, color: executionTypeColor.Automated }}
            >
              <Bot className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-lg font-semibold leading-none tabular-nums">{execCounts.Automated}</span>
              <span className="block text-xs text-muted-foreground mt-1">Automated test cases</span>
            </span>
          </button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent Test Runs</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/runs')}>
              View all <ArrowRight />
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentRuns.map((run) => {
              const stats = runStats(run)
              return (
                <button
                  key={run.id}
                  onClick={() => navigate(`/runs/${run.id}`)}
                  className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 cursor-pointer"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium text-sm">{run.id}</span>
                    <span className="text-sm text-muted-foreground">{run.suiteName}</span>
                    <RunStatusBadge status={run.status} />
                    <span className="ml-auto text-xs text-faint">{relativeTime(run.startedAt)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted gap-[2px]">
                      {stats.passed > 0 && (
                        <span style={{ width: `${(stats.passed / stats.total) * 100}%`, background: statusColor.Passed }} />
                      )}
                      {stats.failed > 0 && (
                        <span style={{ width: `${(stats.failed / stats.total) * 100}%`, background: statusColor.Failed }} />
                      )}
                      {stats.blocked > 0 && (
                        <span style={{ width: `${(stats.blocked / stats.total) * 100}%`, background: statusColor.Blocked }} />
                      )}
                      {stats.skipped > 0 && (
                        <span style={{ width: `${(stats.skipped / stats.total) * 100}%`, background: statusColor.Skipped }} />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                      {stats.passRate}% pass · {stats.executed}/{stats.total}
                    </span>
                  </div>
                </button>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today's Execution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {today.total === 0 ? (
              <p className="text-sm text-muted-foreground">No test cases executed today yet.</p>
            ) : (
              <>
                <div>
                  <p className="text-3xl font-semibold leading-none">{today.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">test cases executed today</p>
                </div>
                <div className="space-y-2.5">
                  {(
                    [
                      ['Passed', today.passed],
                      ['Failed', today.failed],
                      ['Blocked', today.blocked],
                      ['Skipped', today.skipped],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="flex items-center gap-2.5">
                      <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: statusColor[label] }} />
                      <span className="text-sm w-20">{label}</span>
                      <Progress
                        value={today.total > 0 ? (value / today.total) * 100 : 0}
                        className="flex-1 h-1.5"
                        indicatorClassName={
                          label === 'Passed'
                            ? 'bg-status-good'
                            : label === 'Failed'
                              ? 'bg-status-critical'
                              : label === 'Blocked'
                                ? 'bg-status-serious'
                                : 'bg-status-neutral'
                        }
                      />
                      <span className="text-sm tabular-nums w-6 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <StartRunDialog suiteId={runSuiteId} onOpenChange={(o) => !o && setRunSuiteId(null)} />
    </div>
  )
}
