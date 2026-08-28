import { execFileSync } from 'node:child_process'
import { inflateRawSync } from 'node:zlib'
import type { Connect, Plugin } from 'vite'

// Dev-server endpoints backing the API Automation section, which reads the
// latest run of Sav-Money/qa-api-automation and can trigger a new one.
//
// Why this lives in the dev server and not in the app: the suite publishes its
// report as a GitHub Actions *artifact* on an INTERNAL repo, so reading it
// needs a credential — and dispatching a workflow needs one with `workflow`
// scope. A browser bundle cannot hold either; anything shipped to the client is
// readable by whoever loads the page. The token stays here, server-side, and
// the browser only ever sees extracted results.
//
// This makes the integration work under `npm run dev` today. A deployed build
// needs the same routes from a real backend — see docs/api-automation.md.
//
//   GET  /api/automation/latest    latest report: totals + failed tests
//   GET  /api/automation/runs      recent workflow runs
//   POST /api/automation/dispatch  { target } → trigger a run

const DEFAULT_REPO = 'Sav-Money/qa-api-automation'
const ARTIFACT_PREFIX = 'playwright-report'
const SUMMARY_PATH = 'allure-report/widgets/summary.json'
const RESULTS_PATH = 'test-results/results.json'
const WORKFLOW_FILE = 'api-regression.yml'

export const DISPATCH_TARGETS = [
  'smoke',
  'recurring-buys-gold',
  'sav-gold',
  'auth',
  'onboarding',
  'regression',
  'all',
] as const

export interface FailedTest {
  /** Leading id token in the test title, e.g. "KYC-GATE-001". */
  id: string | null
  title: string
  file: string
  suite: string
  status: string
  /** Total attempts, so a flaky-then-failed test is distinguishable. */
  attempts: number
  durationSec: number
  error: string
}

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
  failures: FailedTest[]
  /** True when results.json was missing, so an empty list means "unknown". */
  failureDetailUnavailable: boolean
}

export interface RunRow {
  id: number
  runNumber: number
  name: string
  event: string
  branch: string
  status: string
  conclusion: string | null
  startedAt: string
  updatedAt: string
  url: string
  actor: string
}

/* ------------------------------------------------------------------ unzip */
// Minimal ZIP reader: locate one known file in the central directory and
// inflate it. Enough for pulling small JSON out of the report bundle without
// pulling in a zip dependency for a dev-only path.

function readZipEntry(zip: Buffer, endsWith: string): Buffer | null {
  // End of Central Directory record, scanned backwards past any comment.
  let eocd = -1
  for (let i = zip.length - 22; i >= 0 && i > zip.length - 22 - 0xffff; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return null

  const entryCount = zip.readUInt16LE(eocd + 10)
  let offset = zip.readUInt32LE(eocd + 16)

  for (let i = 0; i < entryCount; i++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) return null
    const method = zip.readUInt16LE(offset + 10)
    const compressedSize = zip.readUInt32LE(offset + 20)
    const nameLen = zip.readUInt16LE(offset + 28)
    const extraLen = zip.readUInt16LE(offset + 30)
    const commentLen = zip.readUInt16LE(offset + 32)
    const localOffset = zip.readUInt32LE(offset + 42)
    const name = zip.subarray(offset + 46, offset + 46 + nameLen).toString('utf8')

    if (name.endsWith(endsWith)) {
      // The local header repeats name/extra lengths, which can differ from the
      // central directory's, so re-read them rather than reusing the values.
      const localNameLen = zip.readUInt16LE(localOffset + 26)
      const localExtraLen = zip.readUInt16LE(localOffset + 28)
      const start = localOffset + 30 + localNameLen + localExtraLen
      const data = zip.subarray(start, start + compressedSize)
      return method === 0 ? Buffer.from(data) : inflateRawSync(data)
    }
    offset += 46 + nameLen + extraLen + commentLen
  }
  return null
}

/* --------------------------------------------------- playwright json parse */

interface PWResult {
  status?: string
  duration?: number
  error?: { message?: string }
  errors?: { message?: string }[]
}
interface PWSpec {
  title: string
  ok?: boolean
  tests?: { results?: PWResult[] }[]
}
interface PWSuite {
  title?: string
  file?: string
  specs?: PWSpec[]
  suites?: PWSuite[]
}

// Test ids the suite uses look like KYC-GATE-001 / SIP-VAL-027 / GO-API-003 —
// an uppercase prefix with at least one dash-joined segment, then digits.
const ID_PATTERN = /^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)/

// Playwright can report an ANSI-coloured message; strip the sequences so the
// UI shows plain text. The escape is spelled out as \u001b rather than a
// literal control byte, which is invisible in an editor and trivial to break.
// eslint-disable-next-line no-control-regex -- matching ESC is the entire point
const ANSI = /\u001b\[[0-9;]*m/g

function extractFailures(json: unknown): FailedTest[] {
  const out: FailedTest[] = []

  const walk = (suites: PWSuite[] | undefined, trail: string[], file: string) => {
    for (const suite of suites ?? []) {
      const nextFile = suite.file ?? file
      const nextTrail = suite.title ? [...trail, suite.title] : trail

      for (const spec of suite.specs ?? []) {
        const results = (spec.tests ?? []).flatMap((t) => t.results ?? [])
        const last = results[results.length - 1]
        const failed =
          spec.ok === false ||
          (last?.status !== undefined && ['failed', 'timedOut', 'interrupted'].includes(last.status))
        if (!failed) continue

        const message = last?.error?.message ?? last?.errors?.[0]?.message ?? ''
        out.push({
          id: ID_PATTERN.exec(spec.title)?.[1] ?? null,
          title: spec.title,
          file: nextFile,
          suite: nextTrail.join(' › '),
          status: last?.status ?? 'failed',
          attempts: results.length,
          durationSec: Math.round(((last?.duration ?? 0) / 1000) * 10) / 10,
          error: message.replace(ANSI, '').trim().slice(0, 1200),
        })
      }
      walk(suite.suites, nextTrail, nextFile)
    }
  }

  walk((json as { suites?: PWSuite[] }).suites, [], '')
  return out
}

/* ----------------------------------------------------------------- github */

async function gh(path: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(
      `GitHub ${path} → ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
    )
  }
  return res
}

export async function fetchLatestAutomationRun(
  token: string,
  repo = DEFAULT_REPO,
): Promise<AutomationSummary> {
  const artifacts = (await (
    await gh(`/repos/${repo}/actions/artifacts?per_page=30`, token)
  ).json()) as {
    artifacts: {
      id: number
      name: string
      expired: boolean
      created_at: string
      workflow_run?: { id: number }
    }[]
  }

  const artifact = artifacts.artifacts.find(
    (a) => !a.expired && a.name.startsWith(ARTIFACT_PREFIX) && a.workflow_run?.id,
  )
  if (!artifact) throw new Error('No unexpired report artifact found on this repository.')

  const run = (await (
    await gh(`/repos/${repo}/actions/runs/${artifact.workflow_run!.id}`, token)
  ).json()) as {
    id: number
    run_number: number
    html_url: string
    name: string
    event: string
    head_branch: string
    conclusion: string | null
    run_started_at: string
  }

  const zip = Buffer.from(
    await (await gh(`/repos/${repo}/actions/artifacts/${artifact.id}/zip`, token)).arrayBuffer(),
  )

  const summaryRaw = readZipEntry(zip, SUMMARY_PATH)
  if (!summaryRaw) throw new Error(`${SUMMARY_PATH} not present in artifact ${artifact.name}.`)
  const summary = JSON.parse(summaryRaw.toString('utf8')) as {
    statistic: {
      failed: number
      broken: number
      skipped: number
      passed: number
      unknown: number
      total: number
    }
    time: { duration: number }
  }

  // Failure detail comes from Playwright's own JSON reporter, which carries the
  // per-test error; Allure's summary widget only has counts.
  const resultsRaw = readZipEntry(zip, RESULTS_PATH)
  const failures = resultsRaw ? extractFailures(JSON.parse(resultsRaw.toString('utf8'))) : []

  const s = summary.statistic
  // Skipped tests never ran, so they don't belong in a pass rate.
  const attempted = s.passed + s.failed + s.broken

  return {
    repo,
    runId: run.id,
    runNumber: run.run_number,
    runUrl: run.html_url,
    workflowName: run.name,
    event: run.event,
    branch: run.head_branch,
    conclusion: run.conclusion,
    startedAt: run.run_started_at,
    artifactName: artifact.name,
    artifactCreatedAt: artifact.created_at,
    durationMs: summary.time.duration,
    total: s.total,
    passed: s.passed,
    failed: s.failed,
    broken: s.broken,
    skipped: s.skipped,
    unknown: s.unknown,
    passRate: attempted === 0 ? 0 : (s.passed / attempted) * 100,
    failures,
    failureDetailUnavailable: !resultsRaw,
  }
}

export async function listRuns(token: string, repo = DEFAULT_REPO): Promise<RunRow[]> {
  const data = (await (
    await gh(`/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=10`, token)
  ).json()) as {
    workflow_runs: {
      id: number
      run_number: number
      name: string
      event: string
      head_branch: string
      status: string
      conclusion: string | null
      run_started_at: string
      updated_at: string
      html_url: string
      actor?: { login?: string }
      triggering_actor?: { login?: string }
    }[]
  }

  return data.workflow_runs.map((r) => ({
    id: r.id,
    runNumber: r.run_number,
    name: r.name,
    event: r.event,
    branch: r.head_branch,
    status: r.status,
    conclusion: r.conclusion,
    startedAt: r.run_started_at,
    updatedAt: r.updated_at,
    url: r.html_url,
    actor: r.triggering_actor?.login ?? r.actor?.login ?? '',
  }))
}

export async function dispatchWorkflow(
  token: string,
  target: string,
  repo = DEFAULT_REPO,
  ref = 'main',
): Promise<void> {
  await gh(`/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`, token, {
    method: 'POST',
    body: JSON.stringify({ ref, inputs: { target } }),
  })
}

/**
 * GITHUB_TOKEN from the environment, falling back to whatever the GitHub CLI
 * is already signed in as. The fallback means a developer who has run
 * `gh auth login` needs no extra setup, and no credential is written to disk.
 */
function resolveToken(): string | null {
  const fromEnv = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  if (fromEnv) return fromEnv
  try {
    const out = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: process.platform === 'win32',
    })
    return out.trim() || null
  } catch {
    return null
  }
}

/* ----------------------------------------------------------------- plugin */

const NOT_CONFIGURED =
  'No GitHub credential available. Run `gh auth login`, or set GITHUB_TOKEN in .env with access to Sav-Money/qa-api-automation.'

function send(res: Parameters<Connect.NextHandleFunction>[1], code: number, body: unknown) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

export function apiAutomationPlugin(): Plugin {
  // Artifacts are immutable once uploaded and the zip is multi-megabyte, so a
  // short cache keeps repeated loads from re-downloading it.
  let cache: { at: number; data: AutomationSummary } | null = null
  const TTL_MS = 5 * 60 * 1000

  return {
    name: 'qa-api-automation',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/automation', async (req, res) => {
        const route = (req.url ?? '/').split('?')[0].replace(/\/$/, '')
        const repo = process.env.QA_AUTOMATION_REPO ?? DEFAULT_REPO
        const token = resolveToken()

        if (!token) {
          send(res, 501, { error: 'not-configured', message: NOT_CONFIGURED })
          return
        }

        try {
          if (route === '/latest') {
            // `?refresh=1` bypasses the cache for the manual refresh control.
            const fresh = (req.url ?? '').includes('refresh=1')
            if (!fresh && cache && Date.now() - cache.at < TTL_MS) {
              send(res, 200, cache.data)
              return
            }
            const data = await fetchLatestAutomationRun(token, repo)
            cache = { at: Date.now(), data }
            send(res, 200, data)
            return
          }

          if (route === '/runs') {
            send(res, 200, { runs: await listRuns(token, repo) })
            return
          }

          if (route === '/dispatch') {
            if (req.method !== 'POST') {
              send(res, 405, { error: 'method-not-allowed', message: 'Use POST.' })
              return
            }
            const body = JSON.parse((await readBody(req)) || '{}') as { target?: string }
            const target = body.target ?? 'smoke'
            if (!(DISPATCH_TARGETS as readonly string[]).includes(target)) {
              send(res, 400, {
                error: 'bad-target',
                message: `Unknown target "${target}". Expected one of: ${DISPATCH_TARGETS.join(', ')}.`,
              })
              return
            }
            await dispatchWorkflow(token, target, repo)
            // GitHub queues the run asynchronously, so the new run is not in
            // /runs immediately — the client polls rather than expecting it.
            send(res, 202, { ok: true, target })
            return
          }

          send(res, 404, { error: 'not-found', message: `No route ${route}.` })
        } catch (e: unknown) {
          send(res, 502, {
            error: 'request-failed',
            message: e instanceof Error ? e.message : String(e),
          })
        }
      })
    },
  }
}
