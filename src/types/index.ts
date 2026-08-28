export type Priority = 'Critical' | 'High' | 'Medium' | 'Low'
export type CaseStatus = 'Not Executed' | 'Passed' | 'Failed' | 'Blocked' | 'Skipped'
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low'
export type BugStatus = 'Open' | 'In Progress' | 'Fixed' | 'Retest' | 'Closed' | 'Reopened'
export type SuiteStatus = 'Active' | 'Draft' | 'Archived'
export type RunStatus = 'In Progress' | 'Completed' | 'Aborted'
export type ReviewStatus = 'Pending' | 'Approved' | 'Rejected'
export type ExecutionType = 'Manual' | 'Automated'
// Lifecycle of the case definition itself — distinct from CaseStatus, which
// is the outcome of its most recent execution.
export type LifecycleStatus = 'Active' | 'Inactive' | 'Archived'

export const PRIORITIES: Priority[] = ['Critical', 'High', 'Medium', 'Low']
export const CASE_STATUSES: CaseStatus[] = ['Not Executed', 'Passed', 'Failed', 'Blocked', 'Skipped']
export const SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low']
export const BUG_STATUSES: BugStatus[] = ['Open', 'In Progress', 'Fixed', 'Retest', 'Closed', 'Reopened']
export const SUITE_STATUSES: SuiteStatus[] = ['Active', 'Draft', 'Archived']
export const REVIEW_STATUSES: ReviewStatus[] = ['Pending', 'Approved', 'Rejected']
export const EXECUTION_TYPES: ExecutionType[] = ['Manual', 'Automated']
export const LIFECYCLE_STATUSES: LifecycleStatus[] = ['Active', 'Inactive', 'Archived']

export interface TestStep {
  id: string
  action: string
  expected?: string
}

export interface TestCase {
  id: string
  title: string
  module: string
  // Finer-grained area within the module, e.g. "Discover – Entry" — populated
  // from the sheet's own Module column when an upload assigns a SAV module.
  subModule?: string
  // Test type from the sheet, e.g. Functional / UI / Negative
  caseType?: string
  priority: Priority
  // Whether this case is executed by hand or by an automated script/runner
  // (Playwright, etc.) — drives the Manual vs Automated dashboard breakdown.
  executionType: ExecutionType
  // Why a Manual case hasn't been automated (or won't be) — e.g. blocked on a
  // real device, destructive flow kept manual on purpose, or a scheduled
  // automation candidate. Not meaningful for Automated cases.
  automationRemark?: string
  // Testing-layer classification (Device / Backend / API / …) — independent
  // of Module, which is the product area.
  category?: string
  // Lifecycle of the definition: Active is in normal use, Inactive is
  // temporarily out of rotation, Archived is retired and excluded from
  // suite execution and library-wide stats.
  lifecycleStatus: LifecycleStatus
  // Increments on every definition edit (title/steps/etc.) — not on
  // execution, review, or suite-membership changes.
  version: number
  // Jira story this case was written against, e.g. "SV1-11466".
  storyId?: string
  preconditions: string
  steps: TestStep[]
  testData: string
  expectedResult: string
  actualResult: string
  status: CaseStatus
  comments: string
  bugIds: string[]
  suiteIds: string[]
  sprint: string
  // Approval workflow: uploaded cases start Pending until a reviewer decides.
  reviewStatus: ReviewStatus
  uploadedBy?: string
  // Folder label grouping cases from one upload in Review & Approval —
  // taken from the sheet's banner title or the file name, editable at upload.
  uploadName?: string
  reviewedBy?: string
  reviewedAt?: string
  reviewComment?: string
  createdAt: string
  updatedAt: string
}

export interface TestSuite {
  id: string
  name: string
  description: string
  owner: string
  status: SuiteStatus
  createdAt: string
}

export interface CaseResult {
  caseId: string
  status: CaseStatus
  actualResult: string
  comments: string
  bugId?: string
  executedAt?: string
  durationSec?: number
}

export interface TestRun {
  id: string
  suiteId: string
  suiteName: string
  tester: string
  build: string
  environment: string
  sprint: string
  status: RunStatus
  startedAt: string
  completedAt?: string
  caseIds: string[]
  results: Record<string, CaseResult>
}

export interface Bug {
  id: string
  summary: string
  description: string
  severity: Severity
  priority: Priority
  status: BugStatus
  linkedCaseId?: string
  linkedRunId?: string
  assignedTo: string
  environment: string
  build: string
  screenshotName?: string
  screenshotDataUrl?: string
  createdAt: string
}

export interface AppSettings {
  currentTester: string
  testers: string[]
  builds: string[]
  environments: string[]
  sprints: string[]
  // Which sprint is currently in flight. Named explicitly rather than inferred
  // from the end of `sprints`, because the board lists future sprints after the
  // active one (Sprint 110 active, 111-115 future) so position means nothing.
  activeSprint: string
  // Product Owner who signs off test cases, keyed by module — each SAV module
  // has its own PO. Ownership lives here rather than on the case so it stays
  // correct when a PO changes, and so an uploaded case needs no extra column.
  productOwners: Record<string, string>
  modules: string[]
  categories: string[]
  defaultBuild: string
  defaultEnvironment: string
}

export interface IntegrationConfig {
  id: IntegrationId
  enabled: boolean
  settings: Record<string, string>
}

export type IntegrationId =
  | 'jira'
  | 'testrail'
  | 'zephyr'
  | 'playwright'
  | 'github-actions'
  | 'jenkins'
  | 'browserstack'
  | 'slack'

export interface RunStats {
  total: number
  passed: number
  failed: number
  blocked: number
  skipped: number
  notExecuted: number
  executed: number
  passRate: number
  progress: number
  durationSec: number
}
