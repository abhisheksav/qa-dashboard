import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import {
  CalendarRange,
  CheckCircle2,
  CircleSlash,
  ClipboardList,
  Loader2,
  Search,
  X,
  XCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { KpiCard } from '@/components/shared/KpiCard'
import { AutomationRunCard } from '@/components/shared/AutomationRunCard'
import {
  fetchLatestAutomationRun,
  type AutomationSummary,
  type Loaded,
} from '@/services/apiAutomation'
import { PriorityBadge } from '@/components/shared/badges'
import { chart, axisTick, RTooltip, ChartLegend } from '@/components/charts/chart-theme'
import { useDataStore } from '@/store/useDataStore'
import { activeCases } from '@/lib/stats'
import {
  EXEC_STATUSES,
  TEST_TYPES,
  assigneeOf,
  countByExecStatus,
  countByTestType,
  currentSprint,
  execStatusOf,
  lastExecution,
  sprintExecutions,
  sprintScope,
  sprintTrend,
  testTypeOf,
  type ExecStatus,
  type TestType,
} from '@/lib/qaDashboard'
import { cn } from '@/lib/utils'

const ALL = '__all'

// Status colours extend the shared status palette with the two run-derived
// states, which have no entry there because they aren't CaseStatus values.
const execColor: Record<ExecStatus, string> = {
  Passed: chart.good,
  Failed: chart.critical,
  Blocked: chart.warning,
  'In Progress': chart.series[0],
  Aborted: chart.neutral,
  Skipped: chart.neutral,
  'Not Executed': 'var(--border)',
}

const typeColor: Record<TestType, string> = {
  'Automated API': chart.series[0],
  'Automated UI': chart.good,
  Manual: chart.warning,
}

function pct(n: number, total: number) {
  return total === 0 ? 0 : (n / total) * 100
}

function ExecStatusPill({ status }: { status: ExecStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ background: execColor[status] }}
        aria-hidden
      />
      {status}
    </span>
  )
}

/** Donut with a table of counts beside it — the layout used for both breakdowns. */
function BreakdownCard({
  title,
  description,
  data,
  colors,
  centerValue,
  centerLabel,
  footer,
}: {
  title: string
  description?: string
  data: { name: string; value: number }[]
  colors: Record<string, string>
  centerValue?: string
  centerLabel?: string
  footer?: ReactNode
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const shown = data.filter((d) => d.value > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-[minmax(0,220px)_1fr] items-center">
          <div className="relative h-[220px]">
            {total === 0 ? (
              <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                No data
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={shown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={88}
                      paddingAngle={2}
                      stroke="var(--card)"
                      strokeWidth={2}
                    >
                      {shown.map((d) => (
                        <Cell key={d.name} fill={colors[d.name] ?? chart.neutral} />
                      ))}
                    </Pie>
                    <Tooltip content={<RTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {centerValue && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-semibold leading-none">{centerValue}</span>
                    {centerLabel && (
                      <span className="text-[11px] text-muted-foreground mt-1">{centerLabel}</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((d) => (
                  <TableRow key={d.name}>
                    <TableCell className="flex items-center gap-2 whitespace-nowrap">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: colors[d.name] ?? chart.neutral }}
                        aria-hidden
                      />
                      {d.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{d.value}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {pct(d.value, total).toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-medium">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{total}</TableCell>
                  <TableCell className="text-right tabular-nums">100%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
        {footer}
      </CardContent>
    </Card>
  )
}

/**
 * The type donut counts this app's case library only. The API automation suite
 * is a separate population — its tests are not test cases here — so its totals
 * are shown as an explicitly labelled band rather than folded into the chart,
 * which would silently mix two different things.
 */
function SuiteTotals({ state }: { state: Loaded<AutomationSummary> }) {
  if (state.status !== 'ready') return null
  const d = state.data
  return (
    <div className="mt-5 pt-4 border-t border-dashed">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          API automation suite — not counted above
        </span>
        <Link to="/api-automation" className="text-xs text-primary hover:underline ml-auto">
          View report
        </Link>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mt-2 text-sm">
        <span className="font-semibold tabular-nums">{d.total} tests</span>
        <span className="tabular-nums text-status-good">{d.passed} passed</span>
        <span className="tabular-nums text-status-critical">
          {d.failed + d.broken} failed
        </span>
        <span className="tabular-nums text-muted-foreground">{d.skipped} skipped</span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        These run in{' '}
        <a
          href="https://github.com/Sav-Money/qa-api-automation"
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          qa-api-automation
        </a>{' '}
        and are not test cases in this library, so they do not appear in the chart.
      </p>
    </div>
  )
}

export function QaDashboardPage() {
  const cases = useDataStore((s) => s.testCases)
  const runs = useDataStore((s) => s.runs)
  const settings = useDataStore((s) => s.settings)

  const live = useMemo(() => activeCases(cases), [cases])

  // Fetched here rather than in each consumer: the summary card and the suite
  // totals below the type chart both need it, and the report artifact is large.
  const [automation, setAutomation] = useState<Loaded<AutomationSummary>>({ status: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    void fetchLatestAutomationRun({ signal: controller.signal }).then((next) => {
      if (!controller.signal.aborted) setAutomation(next)
    })
    return () => controller.abort()
  }, [])
  const sprints = settings.sprints
  const [sprint, setSprint] = useState(() => currentSprint(settings))
  const isCurrent = sprint === currentSprint(settings)

  /* ------------------------------------------------------ sprint dashboard */

  const sprintCases = useMemo(() => sprintScope(live, runs, sprint), [live, runs, sprint])

  const statusCounts = useMemo(
    () => countByExecStatus(sprintCases, runs, sprint),
    [sprintCases, runs, sprint],
  )
  const typeCounts = useMemo(() => countByTestType(sprintCases), [sprintCases])
  const trend = useMemo(() => sprintTrend(runs, sprint), [runs, sprint])
  const executions = useMemo(() => sprintExecutions(runs, live, sprint), [runs, live, sprint])

  const total = sprintCases.length
  const passRate = pct(statusCounts.Passed, statusCounts.Passed + statusCounts.Failed)

  const sprintDates = useMemo(() => {
    const scoped = runs.filter((r) => r.sprint === sprint)
    if (scoped.length === 0) return null
    const stamps = scoped.map((r) => r.startedAt).sort()
    const fmt = (s: string) =>
      new Date(s).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    return `${fmt(stamps[0])} – ${fmt(stamps[stamps.length - 1])}`
  }, [runs, sprint])

  /* ------------------------------------------------------- all test cases */
  // Filters live in the URL so a filtered view is shareable, matching /cases.

  const [params, setParams] = useSearchParams()
  const get = (k: string) => params.get(k) ?? ALL
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v === ALL || v === '') next.delete(k)
    else next.set(k, v)
    setParams(next, { replace: true })
  }
  const search = params.get('q') ?? ''
  const filtersActive = ['sprint', 'type', 'status', 'priority', 'assignee', 'q'].some((k) =>
    params.has(k),
  )

  const assignees = useMemo(
    () => [...new Set(runs.map((r) => r.tester).filter(Boolean))].sort(),
    [runs],
  )

  const fSprint = get('sprint')
  const fType = get('type')
  const fStatus = get('status')
  const fPriority = get('priority')
  const fAssignee = get('assignee')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return live
      .map((c) => ({
        c,
        type: testTypeOf(c),
        status: execStatusOf(runs, c.id),
        last: lastExecution(runs, c.id),
        assignee: assigneeOf(runs, c.id),
      }))
      .filter((r) => {
        if (fSprint !== ALL && r.c.sprint !== fSprint) return false
        if (fType !== ALL && r.type !== fType) return false
        if (fStatus !== ALL && r.status !== fStatus) return false
        if (fPriority !== ALL && r.c.priority !== fPriority) return false
        if (fAssignee !== ALL && r.assignee !== fAssignee) return false
        if (q && !`${r.c.id} ${r.c.title}`.toLowerCase().includes(q)) return false
        return true
      })
  }, [live, runs, fSprint, fType, fStatus, fPriority, fAssignee, search])

  return (
    <div className="flex flex-col gap-6 page-enter">
      {/* ------------------------------------------------------------ header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold tracking-tight">QA Test Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Execution health for a single sprint.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="sprint-select" className="text-sm text-muted-foreground">
            Sprint
          </label>
          <Select value={sprint} onValueChange={setSprint}>
            <SelectTrigger id="sprint-select" className="w-48">
              <SelectValue placeholder="Sprint" />
            </SelectTrigger>
            <SelectContent>
              {sprints.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === currentSprint(settings) ? `${s} (Current)` : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {sprintDates && (
          <span className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
            <CalendarRange className="h-4 w-4" />
            {sprintDates}
          </span>
        )}
      </div>

      {/* -------------------------------------------------------------- KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total Test Cases" value={total} icon={ClipboardList} />
        <KpiCard
          label="Passed"
          value={statusCounts.Passed}
          icon={CheckCircle2}
          iconClassName="text-status-good"
          sub={`${pct(statusCounts.Passed, total).toFixed(2)}%`}
        />
        <KpiCard
          label="Failed"
          value={statusCounts.Failed}
          icon={XCircle}
          iconClassName="text-status-critical"
          sub={`${pct(statusCounts.Failed, total).toFixed(2)}%`}
        />
        <KpiCard
          label="Blocked"
          value={statusCounts.Blocked}
          icon={CircleSlash}
          iconClassName="text-status-warning"
          sub={`${pct(statusCounts.Blocked, total).toFixed(2)}%`}
        />
        <KpiCard
          label="In Progress"
          value={statusCounts['In Progress']}
          icon={Loader2}
          sub={`${pct(statusCounts['In Progress'], total).toFixed(2)}%`}
        />
      </div>

      {/* ------------------------------------------------- api automation */}
      <AutomationRunCard state={automation} />

      {/* ------------------------------------------------------- breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard
          title="Test Cases by Type"
          description="Cases in this library, by execution type and category."
          data={TEST_TYPES.map((t) => ({ name: t, value: typeCounts[t] }))}
          colors={typeColor}
          footer={<SuiteTotals state={automation} />}
        />
        <BreakdownCard
          title="Test Case Execution Status"
          data={EXEC_STATUSES.map((s) => ({ name: s, value: statusCounts[s] }))}
          colors={execColor}
          centerValue={`${pct(statusCounts.Passed, total).toFixed(1)}%`}
          centerLabel="passed"
        />
      </div>

      {/* ------------------------------------------------------------ trends */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Execution Status Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <div className="h-[240px] grid place-items-center text-sm text-muted-foreground">
                No runs in this sprint
              </div>
            ) : (
              <>
                <ChartLegend
                  items={[
                    { label: 'Passed', color: chart.good, shape: 'line' },
                    { label: 'Failed', color: chart.critical, shape: 'line' },
                    { label: 'Blocked', color: chart.warning, shape: 'line' },
                    { label: 'In Progress', color: chart.series[0], shape: 'line' },
                  ]}
                />
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} stroke={chart.axis} />
                    <YAxis tick={axisTick} stroke={chart.axis} allowDecimals={false} />
                    <Tooltip content={<RTooltip />} />
                    <Line type="monotone" dataKey="passed" name="Passed" stroke={chart.good} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="failed" name="Failed" stroke={chart.critical} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="blocked" name="Blocked" stroke={chart.warning} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="inProgress" name="In Progress" stroke={chart.series[0]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Pass vs Fail Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <div className="h-[240px] grid place-items-center text-sm text-muted-foreground">
                No runs in this sprint
              </div>
            ) : (
              <>
                <ChartLegend
                  items={[
                    { label: 'Passed', color: chart.good },
                    { label: 'Failed', color: chart.critical },
                  ]}
                />
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} stroke={chart.axis} />
                    <YAxis tick={axisTick} stroke={chart.axis} allowDecimals={false} />
                    <Tooltip content={<RTooltip />} />
                    <Bar dataKey="passed" name="Passed" fill={chart.good} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="failed" name="Failed" fill={chart.critical} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Pass Percentage</CardTitle>
            <CardDescription>Of cases with a recorded result.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Passed', value: statusCounts.Passed },
                      { name: 'Failed', value: statusCounts.Failed },
                    ]}
                    dataKey="value"
                    startAngle={180}
                    endAngle={0}
                    cy="62%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={1}
                    stroke="var(--card)"
                    strokeWidth={2}
                  >
                    <Cell fill={chart.good} />
                    <Cell fill={chart.critical} />
                  </Pie>
                  <Tooltip content={<RTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-x-0 top-[46%] flex flex-col items-center pointer-events-none">
                <span className="text-3xl font-semibold text-status-good tabular-nums">
                  {passRate.toFixed(2)}%
                </span>
                <span className="text-sm text-muted-foreground mt-1">Pass Percentage</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* -------------------------------------------------- sprint executions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test Executions</CardTitle>
          <CardDescription>
            Runs recorded in {sprint}
            {isCurrent && ' (current sprint)'}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Execution</TableHead>
                  <TableHead>Sprint</TableHead>
                  <TableHead>Test Type</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Passed</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Blocked</TableHead>
                  <TableHead className="text-right">In Progress</TableHead>
                  <TableHead className="text-right">Pass %</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      No runs recorded in {sprint}.
                    </TableCell>
                  </TableRow>
                ) : (
                  executions.map((e) => (
                    <TableRow key={e.runId}>
                      <TableCell>
                        <Link to={`/runs/${e.runId}`} className="font-medium hover:underline">
                          {e.runId}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{e.sprint}</TableCell>
                      <TableCell className="whitespace-nowrap">{e.testType}</TableCell>
                      <TableCell className="text-right tabular-nums">{e.total}</TableCell>
                      <TableCell className="text-right tabular-nums text-status-good">{e.passed}</TableCell>
                      <TableCell className="text-right tabular-nums text-status-critical">{e.failed}</TableCell>
                      <TableCell className="text-right tabular-nums text-status-warning">{e.blocked}</TableCell>
                      <TableCell className="text-right tabular-nums">{e.inProgress}</TableCell>
                      <TableCell className="text-right tabular-nums">{e.passRate.toFixed(2)}%</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(e.startedAt).toLocaleDateString(undefined, {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'text-xs font-medium rounded-full px-2 py-0.5 whitespace-nowrap',
                            e.status === 'In Progress' && 'bg-primary/10 text-primary',
                            e.status === 'Completed' && 'bg-status-good/10 text-status-good',
                            e.status === 'Aborted' && 'bg-muted text-muted-foreground',
                          )}
                        >
                          {e.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------- all test cases */}
      <Card className="border-t-2 border-t-primary/40">
        <CardHeader>
          <CardTitle className="text-base">All Test Cases</CardTitle>
          <CardDescription>
            Every case across all sprints — independent of the sprint selected above.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search test cases"
                placeholder="Search ID or summary…"
                className="pl-8"
                value={search}
                onChange={(e) => setParam('q', e.target.value)}
              />
            </div>

            <Select value={fSprint} onValueChange={(v) => setParam('sprint', v)}>
              <SelectTrigger className="w-36" aria-label="Filter by sprint">
                <SelectValue placeholder="Sprint" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Sprints</SelectItem>
                {sprints.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={fType} onValueChange={(v) => setParam('type', v)}>
              <SelectTrigger className="w-44" aria-label="Filter by test type">
                <SelectValue placeholder="Test Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Types</SelectItem>
                {TEST_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={fStatus} onValueChange={(v) => setParam('status', v)}>
              <SelectTrigger className="w-40" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Statuses</SelectItem>
                {EXEC_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={fPriority} onValueChange={(v) => setParam('priority', v)}>
              <SelectTrigger className="w-36" aria-label="Filter by priority">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Priorities</SelectItem>
                {['Critical', 'High', 'Medium', 'Low'].map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={fAssignee} onValueChange={(v) => setParam('assignee', v)}>
              <SelectTrigger className="w-40" aria-label="Filter by assignee">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Assignees</SelectItem>
                {assignees.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>
                <X /> Clear
              </Button>
            )}

            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {rows.length} of {live.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test Case ID</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Sprint</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Execution Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      No test cases match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(({ c, type, status, last, assignee }) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium whitespace-nowrap">{c.id}</TableCell>
                      <TableCell className="max-w-[380px]">
                        <span className="block truncate" title={c.title}>{c.title}</span>
                        <span className="text-xs text-muted-foreground">{c.module}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ background: typeColor[type] }}
                            aria-hidden
                          />
                          {type}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{c.sprint || '—'}</TableCell>
                      <TableCell><PriorityBadge priority={c.priority} /></TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {assignee || '—'}
                      </TableCell>
                      <TableCell><ExecStatusPill status={status} /></TableCell>
                      <TableCell className="whitespace-nowrap">
                        {last ? (
                          <div className="flex flex-col">
                            <ExecStatusPill status={last.status} />
                            <span className="text-xs text-muted-foreground">
                              {last.executedAt
                                ? new Date(last.executedAt).toLocaleDateString(undefined, {
                                    day: '2-digit',
                                    month: 'short',
                                  })
                                : '—'}
                              {' · '}
                              <Link to={`/runs/${last.runId}`} className="hover:underline">
                                {last.runId}
                              </Link>
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Never executed</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
