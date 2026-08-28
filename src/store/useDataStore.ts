import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  AppSettings,
  Bug,
  CaseResult,
  CaseStatus,
  IntegrationConfig,
  IntegrationId,
  LifecycleStatus,
  ReviewStatus,
  TestCase,
  TestRun,
  TestSuite,
} from '@/types'
import {
  LEGACY_DEFAULT_MODULES,
  SAV_MODULES,
  seedBugs,
  seedIntegrations,
  seedRuns,
  seedSettings,
  seedSuites,
  seedTestCases,
} from '@/data/seed'
import { createDriver } from '@/services/persistence'
import { nextSequentialId } from '@/lib/utils'

interface DataState {
  testCases: TestCase[]
  suites: TestSuite[]
  runs: TestRun[]
  bugs: Bug[]
  settings: AppSettings
  integrations: IntegrationConfig[]

  addCase: (
    data: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt' | 'reviewStatus' | 'lifecycleStatus' | 'version'> & {
      reviewStatus?: ReviewStatus
      lifecycleStatus?: LifecycleStatus
    },
  ) => TestCase
  updateCase: (id: string, patch: Partial<TestCase>) => void
  deleteCases: (ids: string[]) => void
  importCases: (
    rows: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>[],
    meta?: { uploadedBy?: string; uploadName?: string },
  ) => number
  reviewCases: (ids: string[], decision: ReviewStatus, opts?: { reviewedBy?: string; comment?: string }) => void
  assignCasesToSuites: (caseIds: string[], suiteIds: string[]) => void
  removeCaseFromSuite: (caseId: string, suiteId: string) => void

  addSuite: (data: Omit<TestSuite, 'id' | 'createdAt'>) => TestSuite
  updateSuite: (id: string, patch: Partial<TestSuite>) => void
  deleteSuite: (id: string) => void
  duplicateSuite: (id: string) => TestSuite | undefined

  startRun: (suiteId: string, opts: { tester: string; build: string; environment: string; sprint: string }) => TestRun | undefined
  // Executes hand-picked cases (one or many) without requiring a suite —
  // e.g. "run just this case" from the Test Cases table.
  startAdHocRun: (
    caseIds: string[],
    opts: { tester: string; build: string; environment: string; sprint: string },
  ) => TestRun | undefined
  recordResult: (runId: string, result: CaseResult) => void
  completeRun: (runId: string) => void
  abortRun: (runId: string) => void
  deleteRun: (id: string) => void
  // Turns parsed Playwright JSON-reporter results into a completed TestRun:
  // updates the matched cases (status + marks them Automated), and opens a
  // Bug for every failure, linked back to the run and case.
  importAutomatedRun: (params: {
    suiteId: string
    suiteName: string
    tester: string
    build: string
    environment: string
    sprint: string
    startedAt?: string
    results: { caseId: string; status: CaseStatus; actualResult: string; durationSec: number }[]
  }) => TestRun | undefined

  addBug: (data: Omit<Bug, 'id' | 'createdAt'>) => Bug
  updateBug: (id: string, patch: Partial<Bug>) => void
  deleteBug: (id: string) => void

  updateSettings: (patch: Partial<AppSettings>) => void
  updateIntegration: (id: IntegrationId, patch: Partial<Omit<IntegrationConfig, 'id'>>) => void
  resetToSeed: () => void
}

// Sprint names follow the SV1 Jira board. Kept beside the migration that
// introduces them so the two cannot drift apart.
// Known Product Owners per SAV module. Kept beside the migration that
// introduces them so both stay in step with the seed.
const DEFAULT_PRODUCT_OWNERS: Record<string, string> = {
  'SAV Wealth': 'Satyankar Bajaj',
  'SAV Gold': 'Kartik Nawal',
  'SAV Card': 'Priyank Shah',
}

const SPRINT_LIST = ['Sprint 108', 'Sprint 109', 'Sprint 110', 'Sprint 111', 'Sprint 112', 'Sprint 113', 'Sprint 114', 'Sprint 115']

const now = () => new Date().toISOString()

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      testCases: seedTestCases,
      suites: seedSuites,
      runs: seedRuns,
      bugs: seedBugs,
      settings: seedSettings,
      integrations: seedIntegrations,

      addCase: (data) => {
        const id = nextSequentialId('TC', get().testCases.map((c) => c.id))
        const tcase: TestCase = {
          ...data,
          reviewStatus: data.reviewStatus ?? 'Approved',
          lifecycleStatus: data.lifecycleStatus ?? 'Active',
          version: 1,
          id,
          createdAt: now(),
          updatedAt: now(),
        }
        set((s) => ({ testCases: [...s.testCases, tcase] }))
        return tcase
      },

      updateCase: (id, patch) =>
        set((s) => ({
          testCases: s.testCases.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: now() } : c)),
        })),

      deleteCases: (ids) =>
        set((s) => ({
          testCases: s.testCases.filter((c) => !ids.includes(c.id)),
        })),

      importCases: (rows, meta) => {
        const existing = get().testCases.map((c) => c.id)
        const added: TestCase[] = []
        for (const row of rows) {
          const id = nextSequentialId('TC', [...existing, ...added.map((c) => c.id)])
          added.push({
            ...row,
            uploadedBy: meta?.uploadedBy ?? row.uploadedBy,
            uploadName: meta?.uploadName ?? row.uploadName,
            id,
            createdAt: now(),
            updatedAt: now(),
          })
        }
        set((s) => ({ testCases: [...s.testCases, ...added] }))
        return added.length
      },

      reviewCases: (ids, decision, opts) =>
        set((s) => ({
          testCases: s.testCases.map((c) =>
            ids.includes(c.id)
              ? {
                  ...c,
                  reviewStatus: decision,
                  reviewedBy: decision === 'Pending' ? undefined : opts?.reviewedBy,
                  reviewedAt: decision === 'Pending' ? undefined : now(),
                  reviewComment: decision === 'Rejected' ? opts?.comment || undefined : undefined,
                  updatedAt: now(),
                }
              : c,
          ),
        })),

      assignCasesToSuites: (caseIds, suiteIds) =>
        set((s) => ({
          testCases: s.testCases.map((c) =>
            caseIds.includes(c.id)
              ? { ...c, suiteIds: [...new Set([...c.suiteIds, ...suiteIds])], updatedAt: now() }
              : c,
          ),
        })),

      removeCaseFromSuite: (caseId, suiteId) =>
        set((s) => ({
          testCases: s.testCases.map((c) =>
            c.id === caseId ? { ...c, suiteIds: c.suiteIds.filter((id) => id !== suiteId) } : c,
          ),
        })),

      addSuite: (data) => {
        const id = nextSequentialId('SUITE', get().suites.map((x) => x.id))
        const suite: TestSuite = { ...data, id, createdAt: now() }
        set((s) => ({ suites: [...s.suites, suite] }))
        return suite
      },

      updateSuite: (id, patch) =>
        set((s) => ({ suites: s.suites.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),

      deleteSuite: (id) =>
        set((s) => ({
          suites: s.suites.filter((x) => x.id !== id),
          testCases: s.testCases.map((c) =>
            c.suiteIds.includes(id) ? { ...c, suiteIds: c.suiteIds.filter((sid) => sid !== id) } : c,
          ),
        })),

      duplicateSuite: (id) => {
        const src = get().suites.find((x) => x.id === id)
        if (!src) return undefined
        const newId = nextSequentialId('SUITE', get().suites.map((x) => x.id))
        const copy: TestSuite = { ...src, id: newId, name: `${src.name} (Copy)`, createdAt: now() }
        set((s) => ({
          suites: [...s.suites, copy],
          testCases: s.testCases.map((c) =>
            c.suiteIds.includes(id) ? { ...c, suiteIds: [...c.suiteIds, newId] } : c,
          ),
        }))
        return copy
      },

      startRun: (suiteId, opts) => {
        const suite = get().suites.find((x) => x.id === suiteId)
        if (!suite) return undefined
        const caseIds = get()
          .testCases.filter((c) => c.suiteIds.includes(suiteId) && c.lifecycleStatus !== 'Archived')
          .map((c) => c.id)
        if (caseIds.length === 0) return undefined
        const id = nextSequentialId('RUN', get().runs.map((r) => r.id))
        const run: TestRun = {
          id,
          suiteId,
          suiteName: suite.name,
          tester: opts.tester,
          build: opts.build,
          environment: opts.environment,
          sprint: opts.sprint,
          status: 'In Progress',
          startedAt: now(),
          caseIds,
          results: {},
        }
        set((s) => ({ runs: [...s.runs, run] }))
        return run
      },

      startAdHocRun: (caseIds, opts) => {
        const cases = get().testCases.filter((c) => caseIds.includes(c.id) && c.lifecycleStatus !== 'Archived')
        if (cases.length === 0) return undefined
        const id = nextSequentialId('RUN', get().runs.map((r) => r.id))
        const run: TestRun = {
          id,
          suiteId: 'ADHOC',
          suiteName: cases.length === 1 ? `Ad-hoc: ${cases[0].id}` : `Ad-hoc Execution (${cases.length} cases)`,
          tester: opts.tester,
          build: opts.build,
          environment: opts.environment,
          sprint: opts.sprint,
          status: 'In Progress',
          startedAt: now(),
          caseIds: cases.map((c) => c.id),
          results: {},
        }
        set((s) => ({ runs: [...s.runs, run] }))
        return run
      },

      recordResult: (runId, result) =>
        set((s) => ({
          runs: s.runs.map((r) =>
            r.id === runId ? { ...r, results: { ...r.results, [result.caseId]: result } } : r,
          ),
          testCases: s.testCases.map((c) =>
            c.id === result.caseId
              ? {
                  ...c,
                  status: result.status,
                  actualResult: result.actualResult,
                  comments: result.comments || c.comments,
                  bugIds: result.bugId && !c.bugIds.includes(result.bugId) ? [...c.bugIds, result.bugId] : c.bugIds,
                  updatedAt: now(),
                }
              : c,
          ),
        })),

      completeRun: (runId) =>
        set((s) => ({
          runs: s.runs.map((r) => (r.id === runId ? { ...r, status: 'Completed', completedAt: now() } : r)),
        })),

      abortRun: (runId) =>
        set((s) => ({
          runs: s.runs.map((r) => (r.id === runId ? { ...r, status: 'Aborted', completedAt: now() } : r)),
        })),

      deleteRun: (id) => set((s) => ({ runs: s.runs.filter((r) => r.id !== id) })),

      importAutomatedRun: (params) => {
        const existingCaseIds = new Set(get().testCases.map((c) => c.id))
        const results = params.results.filter((r) => existingCaseIds.has(r.caseId))
        if (results.length === 0) return undefined

        const runId = nextSequentialId('RUN', get().runs.map((r) => r.id))
        const startedAt = params.startedAt ?? now()
        const completedAt = now()
        const runResults: Record<string, CaseResult> = {}
        const newBugs: Bug[] = []

        for (const r of results) {
          let bugId: string | undefined
          if (r.status === 'Failed') {
            const tcase = get().testCases.find((c) => c.id === r.caseId)!
            const bug: Bug = {
              id: nextSequentialId('BUG', [...get().bugs.map((b) => b.id), ...newBugs.map((b) => b.id)]),
              summary: `${r.caseId}: ${tcase.title} — failed via Playwright (build ${params.build})`,
              description: r.actualResult || 'Automated test failed. See the CI job for the full log.',
              severity: tcase.priority === 'Low' ? 'Medium' : tcase.priority,
              priority: tcase.priority,
              status: 'Open',
              linkedCaseId: r.caseId,
              linkedRunId: runId,
              assignedTo: params.tester,
              environment: params.environment,
              build: params.build,
              createdAt: completedAt,
            }
            newBugs.push(bug)
            bugId = bug.id
          }
          runResults[r.caseId] = {
            caseId: r.caseId,
            status: r.status,
            actualResult: r.actualResult || (r.status === 'Passed' ? 'Passed via Playwright' : ''),
            comments: '',
            bugId,
            executedAt: completedAt,
            durationSec: r.durationSec,
          }
        }

        const run: TestRun = {
          id: runId,
          suiteId: params.suiteId,
          suiteName: params.suiteName,
          tester: params.tester,
          build: params.build,
          environment: params.environment,
          sprint: params.sprint,
          status: 'Completed',
          startedAt,
          completedAt,
          caseIds: results.map((r) => r.caseId),
          results: runResults,
        }

        set((s) => ({
          runs: [...s.runs, run],
          bugs: [...s.bugs, ...newBugs],
          testCases: s.testCases.map((c) => {
            const r = runResults[c.id]
            if (!r) return c
            return {
              ...c,
              status: r.status,
              actualResult: r.actualResult,
              executionType: 'Automated',
              bugIds: r.bugId && !c.bugIds.includes(r.bugId) ? [...c.bugIds, r.bugId] : c.bugIds,
              updatedAt: completedAt,
            }
          }),
        }))

        return run
      },

      addBug: (data) => {
        const id = nextSequentialId('BUG', get().bugs.map((b) => b.id))
        const bug: Bug = { ...data, id, createdAt: now() }
        set((s) => ({ bugs: [...s.bugs, bug] }))
        return bug
      },

      updateBug: (id, patch) =>
        set((s) => ({ bugs: s.bugs.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),

      deleteBug: (id) =>
        set((s) => ({
          bugs: s.bugs.filter((b) => b.id !== id),
          testCases: s.testCases.map((c) =>
            c.bugIds.includes(id) ? { ...c, bugIds: c.bugIds.filter((bid) => bid !== id) } : c,
          ),
        })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      updateIntegration: (id, patch) =>
        set((s) => ({
          integrations: s.integrations.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),

      resetToSeed: () =>
        set({
          testCases: seedTestCases,
          suites: seedSuites,
          runs: seedRuns,
          bugs: seedBugs,
          settings: seedSettings,
          integrations: seedIntegrations,
        }),
    }),
    {
      name: 'qa-dashboard-data',
      storage: createJSONStorage(() => createDriver()),
      version: 9,
      migrate: (persisted, version) => {
        const state = persisted as DataState
        if (version < 2 && state.settings) {
          const current = state.settings.modules ?? []
          const untouched =
            current.length === LEGACY_DEFAULT_MODULES.length &&
            current.every((m, i) => m === LEGACY_DEFAULT_MODULES[i])
          state.settings = {
            ...state.settings,
            modules: untouched
              ? [...SAV_MODULES]
              : [...SAV_MODULES.filter((m) => !current.includes(m)), ...current],
          }
        }
        if (version < 3) {
          // Sample testers were replaced by the real QA team; existing cases
          // predate the review workflow and count as already approved.
          const rename: Record<string, string> = {
            'Abhishek Tripathi': 'Abhishek',
            'Priya Sharma': 'Vishal',
            'Rahul Verma': 'Abhishek',
            'Sneha Patel': 'Vishal',
          }
          const fix = (name: string) => rename[name] ?? name
          if (state.settings) {
            const testers = [...new Set((state.settings.testers ?? []).map(fix))]
            state.settings = {
              ...state.settings,
              testers: testers.length > 0 ? testers : ['Abhishek', 'Vishal'],
              currentTester: fix(state.settings.currentTester ?? 'Abhishek'),
            }
          }
          state.suites = state.suites?.map((x) => ({ ...x, owner: fix(x.owner) }))
          state.runs = state.runs?.map((r) => ({ ...r, tester: fix(r.tester) }))
          state.bugs = state.bugs?.map((b) => ({ ...b, assignedTo: fix(b.assignedTo) }))
          state.testCases = state.testCases?.map((c) => ({ ...c, reviewStatus: c.reviewStatus ?? 'Approved' }))
        }
        if (version < 4) {
          // The Sanity and Release Testing demo suites were dropped; run
          // history is kept (runs carry their suite name as a string).
          const removed = new Set(
            (state.suites ?? [])
              .filter((s) => ['sanity', 'release testing'].includes(s.name.trim().toLowerCase()))
              .map((s) => s.id),
          )
          if (removed.size > 0) {
            state.suites = state.suites?.filter((s) => !removed.has(s.id))
            state.testCases = state.testCases?.map((c) =>
              c.suiteIds.some((id) => removed.has(id))
                ? { ...c, suiteIds: c.suiteIds.filter((id) => !removed.has(id)) }
                : c,
            )
          }
        }
        if (version < 5) {
          // executionType is new; cases created before it default to Manual.
          state.testCases = state.testCases?.map((c) => ({
            ...c,
            executionType: c.executionType ?? 'Manual',
          }))
        }
        if (version < 6) {
          // lifecycleStatus/version are new; existing cases are Active v1.
          state.testCases = state.testCases?.map((c) => ({
            ...c,
            lifecycleStatus: c.lifecycleStatus ?? 'Active',
            version: c.version ?? 1,
          }))
          if (state.settings && !state.settings.categories) {
            state.settings = { ...state.settings, categories: ['API', 'Backend', 'Device'] }
          }
        }
        if (version < 9 && state.settings) {
          // Product Owner per module is new. Seed the known SAV owners without
          // clobbering anything already set; modules with no owner yet simply
          // have no entry and are shown as unassigned.
          state.settings = {
            ...state.settings,
            productOwners: { ...DEFAULT_PRODUCT_OWNERS, ...(state.settings.productOwners ?? {}) },
          }
        }
        if (version < 8 && state.settings) {
          // Sprint naming moved to the SV1 Jira board (Sprint 108+). Only
          // rewrite a workspace still on the untouched demo pair, so anyone who
          // curated their own sprint list keeps it.
          const LEGACY = ['Sprint 23', 'Sprint 24']
          const current = state.settings.sprints ?? []
          const untouched =
            current.length === LEGACY.length && current.every((sp, i) => sp === LEGACY[i])

          if (untouched) {
            const rename: Record<string, string> = {
              'Sprint 23': 'Sprint 109',
              'Sprint 24': 'Sprint 110',
            }
            const fix = (sp: string) => rename[sp] ?? sp

            state.settings = {
              ...state.settings,
              sprints: SPRINT_LIST,
              activeSprint: 'Sprint 110',
            }
            state.testCases = state.testCases?.map((c) => ({ ...c, sprint: fix(c.sprint) }))
            state.runs = state.runs?.map((r) => ({ ...r, sprint: fix(r.sprint) }))
            // The demo suite is named after the sprint it covers.
            state.suites = state.suites?.map((su) =>
              su.name === 'Sprint 24 Testing'
                ? {
                    ...su,
                    name: 'Sprint 110 Testing',
                    description: 'Stories and fixes delivered in Sprint 110.',
                  }
                : su,
            )
          }
        }
        if (version < 7 && state.settings) {
          // activeSprint is new. It used to be inferred as the last entry of
          // `sprints`, so seed that as the starting value — it preserves the
          // behaviour an existing workspace already had, and the user can
          // change it in Settings once future sprints are added to the list.
          const sprints = state.settings.sprints ?? []
          state.settings = {
            ...state.settings,
            activeSprint: state.settings.activeSprint || sprints[sprints.length - 1] || '',
          }
        }
        return state
      },
    },
  ),
)
