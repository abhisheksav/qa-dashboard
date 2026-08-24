import { beforeEach, describe, expect, it } from 'vitest'
import { useDataStore } from '@/store/useDataStore'

beforeEach(() => {
  localStorage.clear()
  useDataStore.getState().resetToSeed()
})

describe('startAdHocRun', () => {
  it('executes hand-picked cases without a suite', () => {
    const run = useDataStore.getState().startAdHocRun(['TC-001', 'TC-003'], {
      tester: 'Abhishek',
      build: '2.5.0',
      environment: 'QA',
      sprint: 'Sprint 24',
    })
    expect(run).toBeDefined()
    expect(run?.suiteId).toBe('ADHOC')
    expect(run?.suiteName).toBe('Ad-hoc Execution (2 cases)')
    expect(run?.status).toBe('In Progress')
    expect(run?.caseIds).toEqual(['TC-001', 'TC-003'])
  })

  it('labels a single-case run with the case ID', () => {
    const run = useDataStore.getState().startAdHocRun(['TC-001'], {
      tester: 'Abhishek',
      build: '2.5.0',
      environment: 'QA',
      sprint: 'Sprint 24',
    })
    expect(run?.suiteName).toBe('Ad-hoc: TC-001')
  })

  it('excludes archived cases and returns undefined if nothing is left', () => {
    // TC-021 is seeded as Archived.
    expect(useDataStore.getState().testCases.find((c) => c.id === 'TC-021')?.lifecycleStatus).toBe('Archived')
    const run = useDataStore.getState().startAdHocRun(['TC-021'], {
      tester: 'Abhishek',
      build: '2.5.0',
      environment: 'QA',
      sprint: 'Sprint 24',
    })
    expect(run).toBeUndefined()
  })
})
