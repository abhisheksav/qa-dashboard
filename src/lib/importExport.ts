import Papa from 'papaparse'
import type { CaseStatus, ExecutionType, LifecycleStatus, Priority, TestCase, TestSuite } from '@/types'
import { CASE_STATUSES, EXECUTION_TYPES, LIFECYCLE_STATUSES, PRIORITIES } from '@/types'
import { uid } from '@/lib/utils'

export type ImportedCase = Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>

// Export/template columns follow the team's sheet format:
// TC ID | Module | Test Scenario | Preconditions | Test Steps | Expected Result | Priority | Type | Status | Bug
const HEADERS = [
  'TC ID',
  'Module',
  'Sub Module',
  'Test Scenario',
  'Preconditions',
  'Test Steps',
  'Test Data',
  'Expected Result',
  'Actual Result',
  'Priority',
  'Type',
  'Category',
  'Execution',
  'Remark',
  'Lifecycle',
  'Story',
  'Status',
  'Bug',
  'Comments',
  'Suites',
  'Sprint',
] as const

const WIDE_COLUMNS = new Set(['Test Scenario', 'Test Steps', 'Expected Result'])

export async function exportCasesToExcel(cases: TestCase[], suites: TestSuite[], fileName = 'test-cases.xlsx') {
  const XLSX = await import('xlsx')
  const suiteName = new Map(suites.map((s) => [s.id, s.name]))
  const rows = cases.map((c) => ({
    'TC ID': c.id,
    Module: c.module,
    'Sub Module': c.subModule ?? '',
    'Test Scenario': c.title,
    Preconditions: c.preconditions,
    'Test Steps': c.steps.map((s, i) => `${i + 1}. ${s.action}${s.expected ? ` => ${s.expected}` : ''}`).join('\n'),
    'Test Data': c.testData,
    'Expected Result': c.expectedResult,
    'Actual Result': c.actualResult,
    Priority: c.priority,
    Type: c.caseType ?? '',
    Category: c.category ?? '',
    Execution: c.executionType,
    Remark: c.automationRemark ?? '',
    Lifecycle: c.lifecycleStatus,
    Story: c.storyId ?? '',
    Status: c.status,
    Bug: c.bugIds.join(', '),
    Comments: c.comments,
    Suites: c.suiteIds.map((id) => suiteName.get(id) ?? id).join(', '),
    Sprint: c.sprint,
  }))
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...HEADERS] })
  ws['!cols'] = HEADERS.map((h) => ({ wch: WIDE_COLUMNS.has(h) ? 40 : 16 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Test Cases')
  XLSX.writeFile(wb, fileName)
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Column aliases per field, in priority order — the first alias found in the
// sheet wins, so a sheet carrying both "Test Case Description" and "Test
// Scenario" maps deterministically. Names are matched after normalizeHeader,
// so "Pre-Requisite", "pre requisite" and "Prerequisite" are all the same.
const FIELD_ALIASES = {
  id: ['testcaseid', 'tcid', 'tcno', 'testcaseno', 'caseid', 'id'],
  title: [
    'title', 'testcasetitle', 'testcasename', 'testcase', 'casetitle', 'name',
    'testcasedescription', 'casedescription', 'description', 'summary', 'testdescription',
  ],
  scenario: ['testscenario', 'scenario', 'scenariodescription'],
  module: ['module', 'modulename', 'component', 'feature', 'featurename', 'functionality', 'area'],
  subModule: ['submodule', 'section', 'subsection', 'subarea', 'screen'],
  caseType: ['type', 'testtype', 'casetype'],
  category: ['category', 'testcategory', 'testlayer', 'layer'],
  executionType: [
    'execution', 'executiontype', 'automation', 'automationstatus', 'manualautomated',
    'manualauto', 'testmode', 'runmode',
  ],
  priority: ['priority', 'testpriority', 'severity'],
  preconditions: ['preconditions', 'precondition', 'prerequisites', 'prerequisite', 'prereq'],
  steps: [
    'teststeps', 'steps', 'stepstoexecute', 'stepstoreproduce', 'stepstofollow',
    'executionsteps', 'procedure', 'teststep', 'actions', 'action',
  ],
  testData: ['testdata', 'inputdata', 'input', 'inputs', 'data'],
  expectedResult: [
    'expectedresult', 'expectedresults', 'expectedoutput', 'expectedoutcome',
    'expectedbehaviour', 'expectedbehavior', 'expected',
  ],
  actualResult: [
    'actualresult', 'actualresults', 'actualoutput', 'actualoutcome',
    'actualbehaviour', 'actualbehavior', 'actual',
  ],
  status: ['status', 'teststatus', 'executionstatus', 'testresult', 'passfail', 'result'],
  bug: ['bug', 'bugs', 'bugid', 'bugids', 'defect', 'defectid', 'jira', 'jiraid', 'issue', 'issueid', 'ticket'],
  comments: ['comments', 'comment', 'remarks', 'remark', 'notes', 'note', 'observations', 'observation'],
  automationRemark: [
    'automationremark', 'whymanual', 'reasonmanual', 'manualreason',
    'automationnotes', 'automationreason', 'notautomatedreason',
  ],
  lifecycleStatus: ['lifecycle', 'lifecyclestatus', 'casestate', 'casestatus', 'activestatus'],
  storyId: ['story', 'storyid', 'jirastory', 'userstory', 'parentstory', 'epicstory'],
  sprint: ['sprint', 'sprintno', 'sprintname'],
} as const

type MappedField = keyof typeof FIELD_ALIASES

const ALL_ALIASES = new Set<string>(Object.values(FIELD_ALIASES).flat())

// Sheets often carry a merged banner/title row above the real header row
// (e.g. "Sav Money • Corporate Events Calendar — Manual Test Case Suite"),
// so the header row is found by looking for the row with the most
// recognizable column names, not assumed to be row 1. Any banner text above
// it is kept — it names the upload folder in Review & Approval.
function matrixToRows(matrix: unknown[][]): { rows: Record<string, unknown>[]; banner?: string } {
  if (matrix.length === 0) return { rows: [] }
  let headerIdx = 0
  let best = 0
  const scan = Math.min(matrix.length, 10)
  for (let i = 0; i < scan; i++) {
    const score = matrix[i].filter((cell) => ALL_ALIASES.has(normalizeHeader(String(cell ?? '')))).length
    if (score > best) {
      best = score
      headerIdx = i
    }
  }
  if (best < 2) headerIdx = 0
  let banner: string | undefined
  for (let i = 0; i < headerIdx; i++) {
    const text = matrix[i].map((c) => String(c ?? '').trim()).find((t) => t !== '')
    if (text) {
      banner = text
      break
    }
  }
  const headers = matrix[headerIdx].map((h) => String(h ?? '').trim())
  const rows = matrix.slice(headerIdx + 1).map((row) => {
    const obj: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i]
    })
    return obj
  })
  return { rows, banner }
}

// "Sav Money • Corporate Events Calendar — Manual Test Case Suite" → the
// segment that names the feature ("Corporate Events Calendar").
function cleanSheetTitle(raw: string): string | undefined {
  const segments = raw
    .split(/[•|]|—|–| - /)
    .map((s) => s.trim())
    .filter(Boolean)
  const longest = segments.sort((a, b) => b.length - a.length)[0] ?? raw.trim()
  return longest ? longest.slice(0, 60) : undefined
}

function pickFields(raw: Record<string, unknown>): Partial<Record<MappedField, string>> {
  const byHeader: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue
    const text = String(value).trim()
    if (text !== '') byHeader[normalizeHeader(key)] = text
  }
  const mapped: Partial<Record<MappedField, string>> = {}
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [MappedField, readonly string[]][]) {
    for (const alias of aliases) {
      if (byHeader[alias] !== undefined) {
        mapped[field] = byHeader[alias]
        break
      }
    }
  }
  return mapped
}

function toPriority(v: string): Priority {
  const exact = PRIORITIES.find((p) => p.toLowerCase() === v.trim().toLowerCase())
  if (exact) return exact
  // P0–P3 tags, severity words, Jira-style labels
  const norm = v.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (['p0', 'blocker', 'critical', 'highest', 'showstopper', 'sev1', 's1'].includes(norm)) return 'Critical'
  if (['p1', 'high', 'major', 'urgent', 'sev2', 's2'].includes(norm)) return 'High'
  if (['p2', 'medium', 'med', 'normal', 'moderate', 'sev3', 's3'].includes(norm)) return 'Medium'
  if (['p3', 'p4', 'low', 'minor', 'trivial', 'lowest', 'sev4', 's4'].includes(norm)) return 'Low'
  return 'Medium'
}

function toExecutionType(v: string): ExecutionType {
  const exact = EXECUTION_TYPES.find((t) => t.toLowerCase() === v.trim().toLowerCase())
  if (exact) return exact
  const norm = v.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (['automated', 'automation', 'auto', 'automatic', 'script', 'scripted'].includes(norm)) return 'Automated'
  return 'Manual'
}

function toLifecycleStatus(v: string): LifecycleStatus {
  const exact = LIFECYCLE_STATUSES.find((s) => s.toLowerCase() === v.trim().toLowerCase())
  if (exact) return exact
  const norm = v.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (['inactive', 'disabled', 'onhold', 'paused'].includes(norm)) return 'Inactive'
  if (['archived', 'archive', 'retired', 'deprecated', 'obsolete'].includes(norm)) return 'Archived'
  return 'Active'
}

function toStatus(v: string): CaseStatus {
  const exact = CASE_STATUSES.find((s) => s.toLowerCase() === v.trim().toLowerCase())
  if (exact) return exact
  const norm = v.toLowerCase().replace(/[^a-z]/g, '')
  if (['pass', 'passed', 'ok', 'success'].includes(norm)) return 'Passed'
  if (['fail', 'failed', 'failure'].includes(norm)) return 'Failed'
  if (['block', 'blocked', 'onhold', 'hold'].includes(norm)) return 'Blocked'
  if (['skip', 'skipped', 'na', 'notapplicable'].includes(norm)) return 'Skipped'
  return 'Not Executed'
}

function parseSteps(text: string) {
  return text
    .split(/\r?\n|;/)
    // Strip "1.", "1)", "Step 1:", "Step 1 -" prefixes without touching
    // numbers that start real text ("2FA enabled").
    .map((s) => s.replace(/^\s*(?:step\s*\d+\s*[:.)-]\s*|\d+\s*[.)]\s*)/i, '').trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/=>|->/)
      const action = parts[0].trim()
      const expected = parts.slice(1).join(' ').trim()
      return { id: uid(), action, expected: expected || undefined }
    })
}

// "SV1-11466", "https://savmoney.atlassian.net/browse/SV1-11466" or a
// comma-separated mix of both — URLs are reduced to their issue key.
function parseBugIds(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      if (/^https?:\/\//i.test(t)) {
        try {
          const segments = new URL(t).pathname.split('/').filter(Boolean)
          return segments[segments.length - 1] ?? t
        } catch {
          return t
        }
      }
      return t
    })
}

function rowToCase(raw: Record<string, unknown>, assignModule?: string): ImportedCase | null {
  const mapped = pickFields(raw)
  let title = mapped.title
  let comments = mapped.comments ?? ''
  if (!title) {
    // Sheets that only carry a "Test Scenario" column use it as the title...
    title = mapped.scenario
  } else if (mapped.scenario && mapped.scenario !== title) {
    // ...otherwise the scenario is kept so no information from the sheet is lost.
    comments = comments ? `Scenario: ${mapped.scenario}\n${comments}` : `Scenario: ${mapped.scenario}`
  }
  if (!title) return null
  // When the upload assigns a module, the sheet's own (finer-grained) Module
  // column is preserved as the sub-module instead of being thrown away.
  const fileModule = mapped.module
  let module: string
  let subModule = mapped.subModule
  if (assignModule) {
    module = assignModule
    if (fileModule && !subModule && fileModule !== assignModule) subModule = fileModule
  } else {
    module = fileModule || 'General'
  }
  return {
    title,
    module,
    subModule,
    category: mapped.category,
    caseType: mapped.caseType,
    executionType: toExecutionType(mapped.executionType ?? ''),
    automationRemark: toExecutionType(mapped.executionType ?? '') === 'Manual' ? mapped.automationRemark : undefined,
    lifecycleStatus: toLifecycleStatus(mapped.lifecycleStatus ?? ''),
    version: 1,
    storyId: mapped.storyId,
    priority: toPriority(mapped.priority ?? ''),
    preconditions: mapped.preconditions ?? '',
    steps: parseSteps(mapped.steps ?? ''),
    testData: mapped.testData ?? '',
    expectedResult: mapped.expectedResult ?? '',
    actualResult: mapped.actualResult ?? '',
    status: toStatus(mapped.status ?? ''),
    comments,
    bugIds: parseBugIds(mapped.bug ?? ''),
    suiteIds: [],
    sprint: mapped.sprint ?? '',
    // Uploaded cases enter the review queue before joining the library.
    reviewStatus: 'Pending',
  }
}

// Tab names that don't tell us anything about the module.
const GENERIC_SHEET_NAME = /^(sheet\s*\d*|template|test\s*cases?|cases|data|master|final|qa)$/i

const EXCEL_EXTENSIONS = ['xlsx', 'xls', 'xlsm', 'xlsb', 'ods']

export interface ParseOptions {
  // Tag every imported case with this module; the sheet's own Module column
  // is kept as each case's sub-module.
  assignModule?: string
}

export interface ParsedImport {
  cases: ImportedCase[]
  // Feature name found in the sheet's banner row, if any — suggested as the
  // upload folder name in Review & Approval.
  sheetTitle?: string
}

export async function parseImportFile(file: File, opts?: ParseOptions): Promise<ParsedImport> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const sheets: { matrix: unknown[][]; sheetModule?: string }[] = []
  if (ext === 'csv' || ext === 'tsv') {
    const text = await file.text()
    const parsed = Papa.parse<unknown[]>(text, { skipEmptyLines: true })
    sheets.push({ matrix: parsed.data })
  } else if (EXCEL_EXTENSIONS.includes(ext)) {
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    for (const name of wb.SheetNames) {
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '' })
      if (matrix.length === 0) continue
      sheets.push({ matrix, sheetModule: GENERIC_SHEET_NAME.test(name.trim()) ? undefined : name.trim() })
    }
  } else {
    throw new Error('Unsupported file type — use .xlsx, .xls, .xlsm, .csv or .tsv')
  }
  // A workbook with one tab per module is imported tab by tab: the tab name
  // outranks the module picked in the UI. For a single-sheet file the UI
  // choice wins and the tab name is only a fallback.
  const multiSheet = sheets.length > 1
  const cases: ImportedCase[] = []
  let sheetTitle: string | undefined
  for (const { matrix, sheetModule } of sheets) {
    const assignModule = multiSheet
      ? sheetModule ?? opts?.assignModule
      : opts?.assignModule ?? sheetModule
    const { rows, banner } = matrixToRows(matrix)
    if (banner && !sheetTitle) sheetTitle = cleanSheetTitle(banner)
    for (const raw of rows) {
      const c = rowToCase(raw, assignModule)
      if (c) cases.push(c)
    }
  }
  return { cases, sheetTitle }
}

export async function downloadImportTemplate() {
  const XLSX = await import('xlsx')
  // Mirrors the team's sheet format one-to-one.
  const sample = [
    {
      'TC ID': 'TC_01',
      Module: 'Discover – Entry',
      'Test Scenario': 'Corporate Events section is displayed on the Discover page',
      Preconditions: 'User is logged in; corporate events exist for the US market',
      'Test Steps': '1. Launch the app and log in\n2. Go to the Discover tab\n3. Scroll to the Corporate Events section',
      'Expected Result': "A 'Corporate Events' section is visible with a heading and a 'See all' link",
      Priority: 'P0',
      Type: 'Functional',
      Category: 'Backend',
      Execution: 'Manual',
      Remark: '',
      Lifecycle: 'Active',
      Story: '',
      Status: 'Pass',
      Bug: '',
    },
  ]
  const ws = XLSX.utils.json_to_sheet(sample)
  ws['!cols'] = Object.keys(sample[0]).map(() => ({ wch: 30 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Template')
  XLSX.writeFile(wb, 'test-case-import-template.xlsx')
}
