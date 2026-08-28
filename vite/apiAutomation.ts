import { execFileSync } from 'node:child_process'
import { inflateRawSync } from 'node:zlib'
import type { Plugin } from 'vite'

// Dev-server endpoint that surfaces the latest run of the API automation suite
// (Sav-Money/qa-api-automation) on the dashboard.
//
// Why this lives in the dev server and not in the app: the suite publishes its
// report as a GitHub Actions *artifact* on an INTERNAL repo, so reading it
// needs a credential. A browser bundle cannot hold one — anything shipped to
// the client is readable by whoever loads the page. So the token stays here,
// server-side, and the browser only ever sees the extracted numbers.
//
// This makes the integration work under `npm run dev` today. For a deployed
// build the same contract has to be served by a real backend route; see
// docs/api-automation.md for the response shape.

const DEFAULT_REPO = 'Sav-Money/qa-api-automation'
const ARTIFACT_PREFIX = 'playwright-report'
const SUMMARY_PATH = 'allure-report/widgets/summary.json'

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
}

/* ------------------------------------------------------------------ unzip */
// Minimal ZIP reader: locate one known file in the central directory and
// inflate it. Enough for pulling a single small JSON out of the report bundle
// without pulling in a zip dependency for a dev-only feature.

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

/* ----------------------------------------------------------------- github */

async function gh(path: string, token: string): Promise<Response> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) throw new Error(`GitHub ${path} → ${res.status} ${res.statusText}`)
  return res
}

export async function fetchLatestAutomationRun(
  token: string,
  repo = DEFAULT_REPO,
): Promise<AutomationSummary> {
  const artifacts = (await (await gh(`/repos/${repo}/actions/artifacts?per_page=30`, token)).json()) as {
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
  const raw = readZipEntry(zip, SUMMARY_PATH)
  if (!raw) throw new Error(`${SUMMARY_PATH} not present in artifact ${artifact.name}.`)

  const summary = JSON.parse(raw.toString('utf8')) as {
    statistic: { failed: number; broken: number; skipped: number; passed: number; unknown: number; total: number }
    time: { duration: number }
  }
  const s = summary.statistic
  // Skipped tests never ran, so they don't belong in a pass rate.
  const attempted = s.passed + s.failed + s.broken
  const executed = attempted === 0 ? 0 : (s.passed / attempted) * 100

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
    passRate: executed,
  }
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

export function apiAutomationPlugin(): Plugin {
  // Artifacts are immutable once uploaded and the zip is multi-megabyte, so a
  // short cache keeps repeated dashboard loads from re-downloading it.
  let cache: { at: number; data: AutomationSummary } | null = null
  const TTL_MS = 5 * 60 * 1000

  return {
    name: 'qa-api-automation',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/automation/latest', async (_req, res) => {
        res.setHeader('Content-Type', 'application/json')

        const token = resolveToken()
        if (!token) {
          res.statusCode = 501
          res.end(
            JSON.stringify({
              error: 'not-configured',
              message:
                'No GitHub credential available. Run `gh auth login`, or set GITHUB_TOKEN in .env with read access to Sav-Money/qa-api-automation.',
            }),
          )
          return
        }

        if (cache && Date.now() - cache.at < TTL_MS) {
          res.end(JSON.stringify(cache.data))
          return
        }

        try {
          const data = await fetchLatestAutomationRun(
            token,
            process.env.QA_AUTOMATION_REPO ?? DEFAULT_REPO,
          )
          cache = { at: Date.now(), data }
          res.end(JSON.stringify(data))
        } catch (e: unknown) {
          res.statusCode = 502
          res.end(
            JSON.stringify({
              error: 'fetch-failed',
              message: e instanceof Error ? e.message : String(e),
            }),
          )
        }
      })
    },
  }
}
