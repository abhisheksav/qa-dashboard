import type { AppSettings, CaseStatus, TestCase, TestRun } from '@/types'

// Derivations backing the sprint QA dashboard.
//
// Everything here is computed from the existing model rather than stored, so
// no migration was needed and imported sheets work immediately. Two shapes the
// dashboard asks for don't exist as fields:
//
//   TestType    the model has executionType (Manual|Automated) and category
//               (API|Backend|Device) separately, never a combined "Automated
//               API" — testTypeOf() joins them, and is the single place to
//               change if the mapping should differ.
//   ExecStatus  CaseStatus has no "In Progress" or "Aborted". Both are facts
//               about the *run* a case sits in, not the case, so they're read
//               back off the run — see execStatusOf().

export type TestType = 'Automated API' | 'Automated UI' | 'Manual'
export const TEST_TYPES: TestType[] = ['Automated API', 'Automated UI', 'Manual']

export type ExecStatus = CaseStatus | 'In Progress' | 'Aborted'
export const EXEC_STATUSES: ExecStatus[] = [
  'Passed',
  'Failed',
  'Blocked',
  'In Progress',
  'Aborted',
  'Skipped',
  'Not Executed',
]

// Only the API category is a genuine service-layer test. "Backend" is what
// seed's categoryFor() assigns to every module it doesn't recognise, so it
// covers plenty of UI-driven cases ("Add item to cart updates badge") and
// must not be read as API — everything automated that isn't API is UI.
const API_CATEGORIES = new Set(['API'])

export function testTypeOf(c: TestCase): TestType {
  if (c.executionType === 'Manual') return 'Manual'
  return API_CATEGORIES.has(c.category ?? '') ? 'Automated API' : 'Automated UI'
}

/**
 * Cases the sprint covers. Runs carry their own `sprint`, independent of the
 * one on a case, so a Sprint 24 run can execute Sprint 23 cases — taking only
 * `case.sprint === sprint` would drop those and leave the KPIs contradicting
 * the executions table. The scope is therefore the union: cases planned into
 * the sprint, plus any case its runs actually touched.
 */
export function sprintScope(cases: TestCase[], runs: TestRun[], sprint: string): TestCase[] {
  const executed = new Set(runs.filter((r) => r.sprint === sprint).flatMap((r) => r.caseIds))
  return cases.filter((c) => c.sprint === sprint || executed.has(c.id))
}

/**
 * The sprint the dashboard opens on. Reads the explicitly configured active
 * sprint (Settings -> Data), falling back to the last in the list only when
 * none is set — the board lists future sprints after the active one, so the
 * last entry is usually the wrong answer.
 */
export function currentSprint(settings: AppSettings): string {
  if (settings.activeSprint && settings.sprints.includes(settings.activeSprint)) {
    return settings.activeSprint
  }
  return settings.activeSprint || settings.sprints[settings.sprints.length - 1] || ''
}

export interface ExecutionRecord {
  status: CaseStatus
  executedAt?: string
  tester: string
  runId: string
  build: string
}

/**
 * Most recent recorded result for a case, newest first. `sprint` scopes the
 * search to that sprint's runs; omit it to search every run.
 */
export function lastExecution(
  runs: TestRun[],
  caseId: string,
  sprint?: string,
): ExecutionRecord | undefined {
  let best: ExecutionRecord | undefined
  let bestAt = ''
  for (const run of runs) {
    if (sprint && run.sprint !== sprint) continue
    const result = run.results[caseId]
    if (!result) continue
    const at = result.executedAt ?? run.startedAt
    if (!best || at > bestAt) {
      bestAt = at
      best = {
        status: result.status,
        executedAt: result.executedAt,
        tester: run.tester,
        runId: run.id,
        build: run.build,
      }
    }
  }
  return best
}

/**
 * What the case's execution looks like right now. A recorded result always
 * wins; with none, being scheduled into a live or abandoned run is itself the
 * status, which is where "In Progress" and "Aborted" come from.
 */
export function execStatusOf(runs: TestRun[], caseId: string, sprint?: string): ExecStatus {
  const scoped = sprint ? runs.filter((r) => r.sprint === sprint) : runs

  // Being queued in a live run with no result yet outranks any earlier result:
  // the case is on someone's screen right now. Checking this first matters —
  // re-running a suite is routine, so if a stale pass took precedence the
  // In Progress count would sit at zero permanently.
  for (const run of scoped) {
    if (run.status === 'In Progress' && run.caseIds.includes(caseId) && !run.results[caseId]) {
      return 'In Progress'
    }
  }

  const executed = lastExecution(runs, caseId, sprint)
  if (executed) return executed.status

  // Never executed, but it was scheduled into a run somebody abandoned.
  for (const run of scoped) {
    if (run.status === 'Aborted' && run.caseIds.includes(caseId)) return 'Aborted'
  }
  return 'Not Executed'
}

/** Who last ran this case. Test cases have no owner field; execution has a tester. */
export function assigneeOf(runs: TestRun[], caseId: string): string {
  return lastExecution(runs, caseId)?.tester ?? ''
}

export function countByTestType(cases: TestCase[]): Record<TestType, number> {
  const out = { 'Automated API': 0, 'Automated UI': 0, Manual: 0 } as Record<TestType, number>
  for (const c of cases) out[testTypeOf(c)]++
  return out
}

export function countByExecStatus(
  cases: TestCase[],
  runs: TestRun[],
  sprint?: string,
): Record<ExecStatus, number> {
  const out = Object.fromEntries(EXEC_STATUSES.map((s) => [s, 0])) as Record<ExecStatus, number>
  for (const c of cases) out[execStatusOf(runs, c.id, sprint)]++
  return out
}

export interface SprintTrendPoint {
  date: string
  label: string
  passed: number
  failed: number
  blocked: number
  inProgress: number
}

/**
 * Daily execution outcomes across a sprint's runs. The window is derived from
 * the runs themselves rather than "last N days", so a sprint that ended a
 * while ago still charts instead of rendering an empty axis.
 */
export function sprintTrend(runs: TestRun[], sprint: string, maxDays = 21): SprintTrendPoint[] {
  const scoped = runs.filter((r) => r.sprint === sprint)
  if (scoped.length === 0) return []

  const stamps = scoped.flatMap((run) => [
    run.startedAt,
    ...Object.values(run.results).map((r) => r.executedAt ?? run.startedAt),
  ])
  const start = new Date(stamps.reduce((a, b) => (a < b ? a : b)).slice(0, 10))
  const end = new Date(stamps.reduce((a, b) => (a > b ? a : b)).slice(0, 10))

  const points: SprintTrendPoint[] = []
  for (let d = new Date(start); d <= end && points.length < maxDays; d.setDate(d.getDate() + 1)) {
    points.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      passed: 0,
      failed: 0,
      blocked: 0,
      inProgress: 0,
    })
  }

  const byDate = new Map(points.map((p) => [p.date, p]))
  for (const run of scoped) {
    for (const result of Object.values(run.results)) {
      const point = byDate.get((result.executedAt ?? run.startedAt).slice(0, 10))
      if (!point) continue
      if (result.status === 'Passed') point.passed++
      else if (result.status === 'Failed') point.failed++
      else if (result.status === 'Blocked') point.blocked++
    }
    // Cases still queued in a live run land on the day the run opened.
    if (run.status === 'In Progress') {
      const point = byDate.get(run.startedAt.slice(0, 10))
      if (point) point.inProgress += run.caseIds.filter((id) => !run.results[id]).length
    }
  }
  return points
}

export interface SprintExecutionRow {
  runId: string
  sprint: string
  testType: string
  total: number
  passed: number
  failed: number
  blocked: number
  inProgress: number
  passRate: number
  startedAt: string
  completedAt?: string
  status: TestRun['status']
}

/** Per-run rollup for the sprint, shaped for the executions table. */
export function sprintExecutions(
  runs: TestRun[],
  cases: TestCase[],
  sprint: string,
): SprintExecutionRow[] {
  const typeOf = new Map(cases.map((c) => [c.id, testTypeOf(c)]))

  return runs
    .filter((r) => r.sprint === sprint)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((run) => {
      const results = Object.values(run.results)
      const passed = results.filter((r) => r.status === 'Passed').length
      const failed = results.filter((r) => r.status === 'Failed').length
      const blocked = results.filter((r) => r.status === 'Blocked').length
      const executed = passed + failed + blocked

      // Runs mix types; label by the dominant one rather than implying purity.
      const counts = new Map<string, number>()
      for (const id of run.caseIds) {
        const t = typeOf.get(id)
        if (t) counts.set(t, (counts.get(t) ?? 0) + 1)
      }
      const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
      const mixed = counts.size > 1

      return {
        runId: run.id,
        sprint: run.sprint,
        testType: dominant ? (mixed ? `${dominant[0]} +${counts.size - 1}` : dominant[0]) : '—',
        total: run.caseIds.length,
        passed,
        failed,
        blocked,
        inProgress: run.status === 'In Progress' ? run.caseIds.length - results.length : 0,
        passRate: executed === 0 ? 0 : (passed / executed) * 100,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        status: run.status,
      }
    })
}
