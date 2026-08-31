import { api, isApiConfigured } from './apiClient'
import { useDataStore } from '@/store/useDataStore'
import type { AppSettings, Bug, IntegrationConfig, TestCase, TestRun, TestSuite } from '@/types'

// Keeps the store synced with the standalone Postgres API.
//
// The Zustand store stays fully synchronous — no action or page had to
// become async. This module sits beside it:
//
//   startWorkspaceSync()   hydrates every table into the store once, on
//                          sign-in
//   (subscription)         on every store change, diffs against the last
//                          snapshot and pushes only the rows that actually
//                          changed, debounced
//
// Sending only the changed rows (rather than the whole state on every save)
// keeps payloads small and means two testers editing different cases don't
// clobber each other. Conflict resolution is last-write-wins *per row*.
//
// localStorage stays in place underneath (via services/persistence.ts) as an
// offline cache and first-paint source; the API/Postgres is the source of
// truth once signed in.

const FLUSH_DEBOUNCE_MS = 400

export type SyncState = 'disabled' | 'connecting' | 'synced' | 'saving' | 'error'

let state: SyncState = 'disabled'
let lastError: string | null = null
const listeners = new Set<(s: SyncState, err: string | null) => void>()

function setState(next: SyncState, err: string | null = null) {
  state = next
  lastError = err
  listeners.forEach((l) => l(state, lastError))
}

export function getSyncState() {
  return { state, error: lastError }
}

export function onSyncStateChange(fn: (s: SyncState, err: string | null) => void): () => void {
  listeners.add(fn)
  fn(state, lastError)
  return () => {
    listeners.delete(fn)
  }
}

/* ---------------------------------------------------------------- snapshots */

type Snapshot = {
  testCases: Map<string, string>
  suites: Map<string, string>
  runs: Map<string, string>
  bugs: Map<string, string>
  integrations: Map<string, string>
  settings: string
}

const index = <T extends { id: string }>(items: T[]) =>
  new Map(items.map((i) => [i.id, JSON.stringify(i)]))

function snapshotOf(s: ReturnType<typeof useDataStore.getState>): Snapshot {
  return {
    testCases: index(s.testCases),
    suites: index(s.suites),
    runs: index(s.runs),
    bugs: index(s.bugs),
    integrations: index(s.integrations),
    settings: JSON.stringify(s.settings),
  }
}

// Rows whose serialized form changed (or that are new), plus ids that vanished.
function diff<T extends { id: string }>(items: T[], prev: Map<string, string>) {
  const changed: T[] = []
  const seen = new Set<string>()
  for (const item of items) {
    seen.add(item.id)
    if (prev.get(item.id) !== JSON.stringify(item)) changed.push(item)
  }
  const removed = [...prev.keys()].filter((id) => !seen.has(id))
  return { changed, removed }
}

/* --------------------------------------------------------------------- sync */

let snapshot: Snapshot | null = null
let suppress = false // set while we write into the store ourselves
let unsubscribe: (() => void) | null = null
let starting = false
let timer: ReturnType<typeof setTimeout> | null = null
let inFlight: Promise<void> = Promise.resolve()

async function pushDiff() {
  if (!snapshot) return
  const s = useDataStore.getState()

  const cases = diff(s.testCases, snapshot.testCases)
  const suites = diff(s.suites, snapshot.suites)
  const runs = diff(s.runs, snapshot.runs)
  const bugs = diff(s.bugs, snapshot.bugs)
  const integrations = diff(s.integrations, snapshot.integrations)
  const settingsChanged = JSON.stringify(s.settings) !== snapshot.settings

  const nothingToDo =
    !settingsChanged &&
    [cases, suites, runs, bugs, integrations].every(
      (d) => d.changed.length === 0 && d.removed.length === 0,
    )
  if (nothingToDo) return

  setState('saving')

  await api.sync({
    suites: { upsert: suites.changed, deleteIds: suites.removed },
    testCases: { upsert: cases.changed, deleteIds: cases.removed },
    runs: { upsert: runs.changed, deleteIds: runs.removed },
    bugs: { upsert: bugs.changed, deleteIds: bugs.removed },
    integrations: integrations.changed.length ? { upsert: integrations.changed } : undefined,
    settings: settingsChanged ? s.settings : undefined,
  })

  snapshot = snapshotOf(useDataStore.getState())
  setState('synced')
}

function scheduleFlush() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    inFlight = inFlight.then(pushDiff).catch((e: unknown) => {
      setState('error', e instanceof Error ? e.message : String(e))
    })
  }, FLUSH_DEBOUNCE_MS)
}

async function hydrate() {
  const remote = await api.getState()

  suppress = true
  useDataStore.setState({
    suites: remote.suites as TestSuite[],
    testCases: remote.testCases as TestCase[],
    runs: remote.runs as TestRun[],
    bugs: remote.bugs as Bug[],
    ...(remote.settings
      ? { settings: { ...useDataStore.getState().settings, ...(remote.settings as Partial<AppSettings>) } }
      : {}),
    ...(remote.integrations.length
      ? { integrations: remote.integrations as IntegrationConfig[] }
      : {}),
  })
  suppress = false

  snapshot = snapshotOf(useDataStore.getState())
}

/**
 * Connect the store to the API. Safe to call repeatedly; a no-op when
 * VITE_API_URL is unset, in which case the app keeps running on
 * localStorage only.
 */
export async function startWorkspaceSync(): Promise<void> {
  if (!isApiConfigured()) {
    setState('disabled')
    return
  }
  if (unsubscribe || starting) return

  starting = true
  setState('connecting')
  try {
    await hydrate()
    setState('synced')

    unsubscribe = useDataStore.subscribe(() => {
      if (suppress) return
      scheduleFlush()
    })
  } catch (e: unknown) {
    setState('error', e instanceof Error ? e.message : String(e))
  } finally {
    starting = false
  }
}

export function stopWorkspaceSync() {
  if (timer) clearTimeout(timer)
  timer = null
  unsubscribe?.()
  unsubscribe = null
  snapshot = null
  setState('disabled')
}

/** Force any debounced writes out — used before sign-out. */
export async function flushWorkspaceSync(): Promise<void> {
  if (!isApiConfigured() || !snapshot) return
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  await inFlight
  await pushDiff().catch((e: unknown) => {
    setState('error', e instanceof Error ? e.message : String(e))
  })
}
