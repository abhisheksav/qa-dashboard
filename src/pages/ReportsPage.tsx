import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from 'recharts'
import { X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDataStore } from '@/store/useDataStore'
import {
  bugSeverityDistribution,
  caseStatusCounts,
  dailyExecutionTrend,
  moduleFailures,
  suiteLastRun,
  suiteProgress,
} from '@/lib/stats'
import { axisTick, chart, statusColor, severityColor, RTooltip, ChartLegend } from '@/components/charts/chart-theme'

const sc = statusColor

const ALL = '__all__'

export function ReportsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { testCases, suites, runs, bugs } = useDataStore()

  const sprintFilter = searchParams.get('sprint') ?? ALL
  const buildFilter = searchParams.get('build') ?? ALL

  function setParam(key: string, value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === ALL) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  }

  const filteredRuns = useMemo(
    () =>
      runs.filter((r) => {
        if (sprintFilter !== ALL && r.sprint !== sprintFilter) return false
        if (buildFilter !== ALL && r.build !== buildFilter) return false
        return true
      }),
    [runs, sprintFilter, buildFilter],
  )

  const filteredBugs = useMemo(
    () => bugs.filter((b) => buildFilter === ALL || b.build === buildFilter),
    [bugs, buildFilter],
  )

  const sprints = useMemo(() => [...new Set(runs.map((r) => r.sprint))].sort(), [runs])
  const builds = useMemo(() => [...new Set(runs.map((r) => r.build))].sort(), [runs])

  // Pass vs Fail (from filtered run results)
  const passFail = useMemo(() => {
    const counts = { Passed: 0, Failed: 0, Blocked: 0, Skipped: 0 }
    for (const run of filteredRuns) {
      for (const r of Object.values(run.results)) {
        if (r.status in counts) counts[r.status as keyof typeof counts]++
      }
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0)
  }, [filteredRuns])
  const passFailTotal = passFail.reduce((a, d) => a + d.value, 0)

  const trend = useMemo(() => dailyExecutionTrend(filteredRuns, 14), [filteredRuns])
  const modFails = useMemo(() => moduleFailures(testCases, filteredRuns), [testCases, filteredRuns])
  const severityDist = useMemo(() => bugSeverityDistribution(filteredBugs), [filteredBugs])

  // Execution progress (current library state — not affected by run filters)
  const counts = useMemo(() => caseStatusCounts(testCases), [testCases])
  const progressData = useMemo(
    () => [
      {
        name: 'All Cases',
        Passed: counts.Passed,
        Failed: counts.Failed,
        Blocked: counts.Blocked,
        Skipped: counts.Skipped,
        'Not Executed': counts['Not Executed'],
      },
    ],
    [counts],
  )

  const suiteRows = useMemo(
    () =>
      suites
        .map((s) => ({ suite: s, stats: suiteProgress(testCases, s.id) }))
        .filter(({ stats }) => stats.total > 0),
    [suites, testCases],
  )

  const statusLegend = [
    { label: 'Passed', color: sc.Passed },
    { label: 'Failed', color: sc.Failed },
    { label: 'Blocked', color: sc.Blocked },
    { label: 'Skipped', color: sc.Skipped },
  ]

  const hasFilters = sprintFilter !== ALL || buildFilter !== ALL

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Execution and defect analytics</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={sprintFilter} onValueChange={(v) => setParam('sprint', v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Sprint" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Sprints</SelectItem>
            {sprints.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={buildFilter} onValueChange={(v) => setParam('build', v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Build" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Builds</SelectItem>
            {builds.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => setSearchParams({}, { replace: true })}>
            <X /> Clear
          </Button>
        )}
        <p className="text-xs text-faint ml-auto">
          Run-based charts respect the filters; progress charts reflect current library state.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 stagger">
        {/* Pass vs Fail */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pass vs Fail</CardTitle>
            <CardDescription>All recorded results{hasFilters ? ' (filtered)' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {passFailTotal === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">No results recorded.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-6">
                <div className="h-52 w-52 relative shrink-0 mx-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={passFail}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={62}
                        outerRadius={90}
                        paddingAngle={2}
                        stroke="var(--card)"
                        strokeWidth={2}
                      >
                        {passFail.map((d) => (
                          <Cell key={d.name} fill={statusColor[d.name]} />
                        ))}
                      </Pie>
                      <Tooltip content={<RTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-semibold leading-none">
                      {Math.round(((passFail.find((d) => d.name === 'Passed')?.value ?? 0) / passFailTotal) * 100)}%
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-1">passed</span>
                  </div>
                </div>
                <div className="space-y-2 flex-1 min-w-[10rem]">
                  {passFail.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: statusColor[d.name] }} />
                      <span className="text-muted-foreground flex-1">{d.name}</span>
                      <span className="font-medium tabular-nums">{d.value}</span>
                      <span className="text-xs text-faint tabular-nums w-10 text-right">
                        {Math.round((d.value / passFailTotal) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Execution Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Execution Trend</CardTitle>
            <CardDescription>Results per day, last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={axisTick}
                    tickLine={false}
                    axisLine={{ stroke: chart.axis }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<RTooltip />} cursor={{ stroke: chart.axis }} />
                  <Line type="monotone" dataKey="passed" name="Passed" stroke={sc.Passed} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: 'var(--card)', strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="failed" name="Failed" stroke={sc.Failed} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: 'var(--card)', strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="blocked" name="Blocked" stroke={sc.Blocked} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: 'var(--card)', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2">
              <ChartLegend
                items={[
                  { label: 'Passed', color: sc.Passed, shape: 'line' },
                  { label: 'Failed', color: sc.Failed, shape: 'line' },
                  { label: 'Blocked', color: sc.Blocked, shape: 'line' },
                ]}
              />
            </div>
          </CardContent>
        </Card>

        {/* Module-wise Failures */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Module-wise Failures</CardTitle>
            <CardDescription>Failed results by module{hasFilters ? ' (filtered)' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {modFails.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">No failures recorded.</p>
            ) : (
              <div style={{ height: Math.max(160, modFails.length * 36) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modFails} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 8 }}>
                    <CartesianGrid stroke={chart.grid} horizontal={false} />
                    <XAxis type="number" tick={axisTick} tickLine={false} axisLine={{ stroke: chart.axis }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="module"
                      tick={{ ...axisTick, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      width={92}
                    />
                    <Tooltip content={<RTooltip />} cursor={{ fill: 'var(--muted)' }} />
                    <Bar dataKey="failures" name="Failures" fill={sc.Failed} barSize={18} radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="failures" position="right" style={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bug Severity Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bug Severity Distribution</CardTitle>
            <CardDescription>{filteredBugs.length} bugs{buildFilter !== ALL ? ` on build ${buildFilter}` : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityDist} margin={{ top: 18, right: 12, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="severity" tick={{ ...axisTick, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={{ stroke: chart.axis }} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<RTooltip />} cursor={{ fill: 'var(--muted)' }} />
                  <Bar dataKey="count" name="Bugs" barSize={22} radius={[4, 4, 0, 0]}>
                    {severityDist.map((d) => (
                      <Cell key={d.severity} fill={severityColor[d.severity]} />
                    ))}
                    <LabelList dataKey="count" position="top" style={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[11px] text-faint">
              Severity colors follow the reserved status scale — Critical (red) → Low (green).
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Test Execution Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test Execution Progress</CardTitle>
          <CardDescription>Current status across all {testCases.length} test cases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                <XAxis type="number" hide domain={[0, testCases.length]} />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip content={<RTooltip />} cursor={{ fill: 'transparent' }} />
                {(['Passed', 'Failed', 'Blocked', 'Skipped', 'Not Executed'] as const).map((s) => (
                  <Bar key={s} dataKey={s} stackId="a" fill={statusColor[s]} barSize={22} stroke="var(--card)" strokeWidth={1} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend
            items={[...statusLegend, { label: 'Not Executed', color: statusColor['Not Executed'] }]}
          />
        </CardContent>
      </Card>

      {/* Suite progress (incl. Regression & Smoke) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suite Progress</CardTitle>
          <CardDescription>Execution progress per suite — Smoke and Regression included</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {suiteRows.map(({ suite, stats }) => {
            const lastRun = suiteLastRun(runs, suite.id)
            return (
              <button
                key={suite.id}
                onClick={() => navigate(lastRun ? `/runs/${lastRun.id}` : `/runs?suite=${suite.id}`)}
                className="flex w-full items-center gap-3 rounded-md p-2 -mx-2 text-left transition-colors hover:bg-muted/50 cursor-pointer"
                title={lastRun ? `Open ${suite.name}'s latest run (${lastRun.id})` : `View ${suite.name}'s runs`}
              >
                <span className="w-36 shrink-0 truncate text-sm font-medium" title={suite.name}>
                  {suite.name}
                </span>
                <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-muted gap-[2px]">
                  {(['Passed', 'Failed', 'Blocked', 'Skipped', 'Not Executed'] as const)
                    .filter((s) => stats.counts[s] > 0)
                    .map((s) => (
                      <span
                        key={s}
                        style={{ width: `${(stats.counts[s] / stats.total) * 100}%`, background: statusColor[s] }}
                        title={`${s}: ${stats.counts[s]}`}
                      />
                    ))}
                </div>
                <span className="w-24 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {stats.progress}% · {stats.passRate}% pass
                </span>
              </button>
            )
          })}
          <ChartLegend
            items={[...statusLegend, { label: 'Not Executed', color: statusColor['Not Executed'] }]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
