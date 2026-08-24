import { beforeEach, describe, expect, it } from 'vitest'
import { useDataStore } from '@/store/useDataStore'

beforeEach(() => {
  localStorage.clear()
  useDataStore.getState().resetToSeed()
})

describe('importAutomatedRun', () => {
  it('records results, marks cases Automated, and opens a bug for each failure', () => {
    const before = useDataStore.getState()
    // TC-003 is seeded as Manual — this run proves it now actually executes via Playwright.
    expect(before.testCases.find((c) => c.id === 'TC-003')?.executionType).toBe('Manual')

    const run = useDataStore.getState().importAutomatedRun({
      suiteId: 'SUITE-004',
      suiteName: 'API',
      tester: 'Playwright (CI)',
      build: '2.6.0',
      environment: 'QA',
      sprint: 'Sprint 24',
      results: [
        { caseId: 'TC-003', status: 'Passed', actualResult: 'Passed via Playwright', durationSec: 3 },
        // TC-005 has no bug in the seed data, so this proves the run created a fresh one.
        { caseId: 'TC-005', status: 'Failed', actualResult: 'expected 200 got 500', durationSec: 1 },
        // Unknown case IDs (e.g. a deleted case) are silently dropped.
        { caseId: 'TC-999', status: 'Passed', actualResult: '', durationSec: 1 },
      ],
    })

    expect(run).toBeDefined()
    expect(run?.status).toBe('Completed')
    expect(run?.caseIds).toEqual(['TC-003', 'TC-005'])

    const after = useDataStore.getState()
    const tc003 = after.testCases.find((c) => c.id === 'TC-003')!
    const tc005 = after.testCases.find((c) => c.id === 'TC-005')!
    expect(tc003.executionType).toBe('Automated')
    expect(tc003.status).toBe('Passed')
    expect(tc005.executionType).toBe('Automated')
    expect(tc005.status).toBe('Failed')
    expect(tc005.bugIds).toHaveLength(1)

    const bug = after.bugs.find((b) => b.id === tc005.bugIds[0])
    expect(bug).toBeDefined()
    expect(bug?.linkedCaseId).toBe('TC-005')
    expect(bug?.linkedRunId).toBe(run!.id)
    expect(bug?.status).toBe('Open')
    expect(bug?.description).toContain('expected 200 got 500')
  })

  it('returns undefined when no result matches an existing case', () => {
    const run = useDataStore.getState().importAutomatedRun({
      suiteId: 'SUITE-004',
      suiteName: 'API',
      tester: 'Playwright (CI)',
      build: '2.6.0',
      environment: 'QA',
      sprint: 'Sprint 24',
      results: [{ caseId: 'TC-999', status: 'Passed', actualResult: '', durationSec: 1 }],
    })
    expect(run).toBeUndefined()
  })
})
