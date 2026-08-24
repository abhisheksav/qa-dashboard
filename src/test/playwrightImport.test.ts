import { describe, expect, it } from 'vitest'
import { parsePlaywrightJson } from '@/lib/playwrightImport'

function report(suites: unknown[], startTime = '2026-01-01T10:00:00.000Z') {
  return { suites, stats: { startTime } }
}

describe('parsePlaywrightJson', () => {
  it('matches nested specs to case IDs and maps statuses', () => {
    const raw = report([
      {
        title: 'api.spec.ts',
        suites: [
          {
            title: 'API tests',
            specs: [
              {
                title: 'TC-025: GET /products returns 200',
                tests: [{ results: [{ status: 'passed', duration: 120 }] }],
              },
              {
                title: 'TC_026 POST /orders validates payload',
                tests: [{ results: [{ status: 'failed', duration: 340, error: { message: 'expected 422 got 500' } }] }],
              },
              {
                title: 'TC-027: rate limiting',
                tests: [{ results: [{ status: 'skipped', duration: 0 }] }],
              },
              {
                title: 'a smoke check with no tag',
                tests: [{ results: [{ status: 'passed', duration: 50 }] }],
              },
            ],
          },
        ],
      },
    ])

    const result = parsePlaywrightJson(raw)
    expect(result.matched).toHaveLength(3)
    expect(result.unmatchedTitles).toEqual(['a smoke check with no tag'])
    expect(result.startedAt).toBe('2026-01-01T10:00:00.000Z')

    const byId = Object.fromEntries(result.matched.map((m) => [m.caseId, m]))
    expect(byId['TC-025'].status).toBe('Passed')
    expect(byId['TC-025'].durationSec).toBe(0)
    expect(byId['TC-026'].status).toBe('Failed')
    expect(byId['TC-026'].error).toBe('expected 422 got 500')
    expect(byId['TC-027'].status).toBe('Skipped')
  })

  it('treats a retried test as its worst outcome across attempts', () => {
    const raw = report([
      {
        title: 'suite',
        specs: [
          {
            title: 'TC-001: flaky-then-fixed',
            tests: [{ results: [{ status: 'failed', duration: 100 }, { status: 'passed', duration: 90 }] }],
          },
        ],
      },
    ])
    const result = parsePlaywrightJson(raw)
    expect(result.matched[0].status).toBe('Failed')
    expect(result.matched[0].durationSec).toBe(0) // (100+90)ms rounds to 0s
  })

  it('rejects a file that is not a Playwright JSON report', () => {
    expect(() => parsePlaywrightJson({ notASuite: true })).toThrow(/Playwright JSON report/)
  })
})
