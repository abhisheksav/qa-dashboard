import type { Bug, CaseStatus, ExecutionType, RunStats, TestCase, TestRun } from '@/types'

// Archived cases are retired — they're excluded from every library-wide
// stat below (KPIs, progress, pass rate, suite coverage) but their past run
// results stay untouched, since runs freeze their own case list.
export function activeCases(cases: TestCase[]): TestCase[] {
  return cases.filter((c) => c.lifecycleStatus !== 'Archived')
}

export function runStats(run: TestRun): RunStats {
  const total = run.caseIds.length
  const results = Object.values(run.results)
  const count = (s: CaseStatus) => results.filter((r) => r.status === s).length
  const passed = count('Passed')
  const failed = count('Failed')
  const blocked = count('Blocked')
  const skipped = count('Skipped')
  const executed = passed + failed + blocked + skipped
  const notExecuted = total - executed
  const decided = passed + failed
  const durationSec = run.completedAt
    ? (new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000
    : results.reduce((acc, r) => acc + (r.durationSec ?? 0), 0)
  return {
    total,
    passed,
    failed,
    blocked,
    skipped,
    notExecuted,
    executed,
    passRate: decided > 0 ? Math.round((passed / decided) * 100) : 0,
    progress: total > 0 ? Math.round((executed / total) * 100) : 0,
    durationSec,
  }
}

export function caseStatusCounts(cases: TestCase[]): Record<CaseStatus, number> {
  const counts: Record<CaseStatus, number> = {
    'Not Executed': 0,
    Passed: 0,
    Failed: 0,
    Blocked: 0,
    Skipped: 0,
  }
  for (const c of activeCases(cases)) counts[c.status]++
  return counts
}

export function overallPassRate(cases: TestCase[]): number {
  const counts = caseStatusCounts(cases)
  const decided = counts.Passed + counts.Failed
  return decided > 0 ? Math.round((counts.Passed / decided) * 100) : 0
}

export function executionProgress(cases: TestCase[]): number {
  const active = activeCases(cases)
  if (active.length === 0) return 0
  const counts = caseStatusCounts(active)
  const executed = active.length - counts['Not Executed']
  return Math.round((executed / active.length) * 100)
}

export function executionTypeCounts(cases: TestCase[]): Record<ExecutionType, number> {
  const counts: Record<ExecutionType, number> = { Manual: 0, Automated: 0 }
  for (const c of activeCases(cases)) counts[c.executionType]++
  return counts
}

export function automationCoverage(cases: TestCase[]): number {
  const active = activeCases(cases)
  if (active.length === 0) return 0
  return Math.round((executionTypeCounts(active).Automated / active.length) * 100)
}

export function suiteLastRun(runs: TestRun[], suiteId: string): TestRun | undefined {
  return runs
    .filter((r) => r.suiteId === suiteId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
}

export function suiteProgress(cases: TestCase[], suiteId: string) {
  const suiteCases = activeCases(cases).filter((c) => c.suiteIds.includes(suiteId))
  return {
    total: suiteCases.length,
    counts: caseStatusCounts(suiteCases),
    passRate: overallPassRate(suiteCases),
    progress: executionProgress(suiteCases),
  }
}

export interface DailyTrendPoint {
  date: string
  label: string
  passed: number
  failed: number
  blocked: number
  skipped: number
}

export function dailyExecutionTrend(runs: TestRun[], days = 14): DailyTrendPoint[] {
  const points: DailyTrendPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    points.push({
      date: key,
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      passed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
    })
  }
  const byDate = new Map(points.map((p) => [p.date, p]))
  for (const run of runs) {
    for (const r of Object.values(run.results)) {
      const key = (r.executedAt ?? run.startedAt).slice(0, 10)
      const p = byDate.get(key)
      if (!p) continue
      if (r.status === 'Passed') p.passed++
      else if (r.status === 'Failed') p.failed++
      else if (r.status === 'Blocked') p.blocked++
      else if (r.status === 'Skipped') p.skipped++
    }
  }
  return points
}

export function moduleFailures(cases: TestCase[], runs: TestRun[]) {
  const byModule = new Map<string, number>()
  const caseModule = new Map(cases.map((c) => [c.id, c.module]))
  for (const run of runs) {
    for (const r of Object.values(run.results)) {
      if (r.status !== 'Failed') continue
      const mod = caseModule.get(r.caseId) ?? 'Unknown'
      byModule.set(mod, (byModule.get(mod) ?? 0) + 1)
    }
  }
  return [...byModule.entries()]
    .map(([module, failures]) => ({ module, failures }))
    .sort((a, b) => b.failures - a.failures)
}

export function bugSeverityDistribution(bugs: Bug[]) {
  const order = ['Critical', 'High', 'Medium', 'Low'] as const
  return order.map((severity) => ({
    severity,
    count: bugs.filter((b) => b.severity === severity).length,
  }))
}

export interface CaseHistoryEntry {
  runId: string
  status: CaseStatus
  actualResult: string
  bugId?: string
  tester: string
  build: string
  environment: string
  executedAt?: string
  durationSec?: number
}

// Every past execution of a single case, across all runs, newest first —
// the "Historical data for a test case execution" view.
export function caseExecutionHistory(runs: TestRun[], caseId: string): CaseHistoryEntry[] {
  const entries: CaseHistoryEntry[] = []
  for (const run of runs) {
    const result = run.results[caseId]
    if (!result) continue
    entries.push({
      runId: run.id,
      status: result.status,
      actualResult: result.actualResult,
      bugId: result.bugId,
      tester: run.tester,
      build: run.build,
      environment: run.environment,
      executedAt: result.executedAt,
      durationSec: result.durationSec,
    })
  }
  return entries.sort((a, b) => (b.executedAt ?? '').localeCompare(a.executedAt ?? ''))
}

export function todaysResults(runs: TestRun[]) {
  const today = new Date().toISOString().slice(0, 10)
  const counts = { passed: 0, failed: 0, blocked: 0, skipped: 0, total: 0 }
  for (const run of runs) {
    for (const r of Object.values(run.results)) {
      if ((r.executedAt ?? run.startedAt).slice(0, 10) !== today) continue
      counts.total++
      if (r.status === 'Passed') counts.passed++
      else if (r.status === 'Failed') counts.failed++
      else if (r.status === 'Blocked') counts.blocked++
      else if (r.status === 'Skipped') counts.skipped++
    }
  }
  return counts
}
