// Parses the output of Playwright's built-in JSON reporter
// (`playwright test --reporter=json > results.json`) and matches each spec
// back to a test case by a `TC-###` tag in its title, e.g.:
//   test('TC-025: GET /products returns 200 with valid schema', async ({ request }) => { ... })
//
// Allure (`allure-playwright`) stays the human-facing HTML report generated
// on the CI side — this parser reads Playwright's own JSON output instead,
// since it's a single self-contained file well suited to a browser upload,
// whereas Allure's raw results are many small per-test files.

export type PWOutcome = 'Passed' | 'Failed' | 'Skipped'

export interface ParsedPWResult {
  caseId: string
  title: string
  status: PWOutcome
  durationSec: number
  error?: string
}

export interface ParsedPWRun {
  matched: ParsedPWResult[]
  unmatchedTitles: string[]
  startedAt?: string
}

interface PWResultEntry {
  status?: string
  duration?: number
  error?: { message?: string }
  errors?: { message?: string }[]
}
interface PWTest {
  results?: PWResultEntry[]
}
interface PWSpec {
  title: string
  tests?: PWTest[]
}
interface PWSuite {
  title?: string
  specs?: PWSpec[]
  suites?: PWSuite[]
}
interface PWJson {
  suites?: PWSuite[]
  stats?: { startTime?: string }
}

const TC_ID_RE = /\bTC[-_]?0*(\d+)\b/i
const OUTCOME_RANK: Record<PWOutcome, number> = { Passed: 0, Skipped: 1, Failed: 2 }

function collectSpecs(suite: PWSuite, specs: PWSpec[]): PWSpec[] {
  for (const spec of suite.specs ?? []) specs.push(spec)
  for (const child of suite.suites ?? []) collectSpecs(child, specs)
  return specs
}

function specOutcome(spec: PWSpec): { status: PWOutcome; durationSec: number; error?: string } {
  let durationMs = 0
  let error: string | undefined
  let worst: PWOutcome = 'Passed'
  for (const test of spec.tests ?? []) {
    for (const result of test.results ?? []) {
      durationMs += result.duration ?? 0
      const raw = (result.status ?? '').toLowerCase()
      const mapped: PWOutcome = raw === 'passed' ? 'Passed' : raw === 'skipped' ? 'Skipped' : 'Failed'
      if (OUTCOME_RANK[mapped] > OUTCOME_RANK[worst]) worst = mapped
      if (mapped === 'Failed' && !error) {
        error = result.error?.message ?? result.errors?.[0]?.message
      }
    }
  }
  return { status: worst, durationSec: Math.round(durationMs / 1000), error }
}

export function parsePlaywrightJson(raw: unknown): ParsedPWRun {
  const data = raw as PWJson
  if (!data || !Array.isArray(data.suites)) {
    throw new Error("Not a Playwright JSON report — expected a top-level \"suites\" array.")
  }
  const specs = data.suites.flatMap((s) => collectSpecs(s, []))
  const matched: ParsedPWResult[] = []
  const unmatchedTitles: string[] = []
  for (const spec of specs) {
    const m = spec.title.match(TC_ID_RE)
    if (!m) {
      unmatchedTitles.push(spec.title)
      continue
    }
    const caseId = `TC-${m[1].padStart(3, '0')}`
    matched.push({ caseId, title: spec.title, ...specOutcome(spec) })
  }
  return { matched, unmatchedTitles, startedAt: data.stats?.startTime }
}
