// snake_case in Postgres, camelCase in the client. One place to keep both
// sides honest instead of scattering column names through the route handlers.

const str = (v, fallback = '') => (typeof v === 'string' ? v : fallback)
const opt = (v) => (typeof v === 'string' && v.length > 0 ? v : undefined)
const arr = (v) => (Array.isArray(v) ? v : [])

export function caseToRow(c) {
  return {
    id: c.id,
    title: c.title,
    module: c.module ?? '',
    sub_module: c.subModule ?? null,
    case_type: c.caseType ?? null,
    priority: c.priority,
    execution_type: c.executionType,
    automation_remark: c.automationRemark ?? null,
    category: c.category ?? null,
    lifecycle_status: c.lifecycleStatus,
    version: c.version,
    story_id: c.storyId ?? null,
    preconditions: c.preconditions ?? '',
    steps: JSON.stringify(c.steps ?? []),
    test_data: c.testData ?? '',
    expected_result: c.expectedResult ?? '',
    actual_result: c.actualResult ?? '',
    status: c.status,
    comments: c.comments ?? '',
    bug_ids: c.bugIds ?? [],
    suite_ids: c.suiteIds ?? [],
    sprint: c.sprint ?? '',
    review_status: c.reviewStatus,
    uploaded_by: c.uploadedBy ?? null,
    upload_name: c.uploadName ?? null,
    reviewed_by: c.reviewedBy ?? null,
    reviewed_at: c.reviewedAt ?? null,
    review_comment: c.reviewComment ?? null,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  }
}

export function rowToCase(r) {
  return {
    id: str(r.id),
    title: str(r.title),
    module: str(r.module),
    subModule: opt(r.sub_module),
    caseType: opt(r.case_type),
    priority: str(r.priority, 'Medium'),
    executionType: str(r.execution_type, 'Manual'),
    automationRemark: opt(r.automation_remark),
    category: opt(r.category),
    lifecycleStatus: str(r.lifecycle_status, 'Active'),
    version: typeof r.version === 'number' ? r.version : 1,
    storyId: opt(r.story_id),
    preconditions: str(r.preconditions),
    steps: Array.isArray(r.steps) ? r.steps : [],
    testData: str(r.test_data),
    expectedResult: str(r.expected_result),
    actualResult: str(r.actual_result),
    status: str(r.status, 'Not Executed'),
    comments: str(r.comments),
    bugIds: arr(r.bug_ids),
    suiteIds: arr(r.suite_ids),
    sprint: str(r.sprint),
    reviewStatus: str(r.review_status, 'Pending'),
    uploadedBy: opt(r.uploaded_by),
    uploadName: opt(r.upload_name),
    reviewedBy: opt(r.reviewed_by),
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : undefined,
    reviewComment: opt(r.review_comment),
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }
}

export function suiteToRow(s) {
  return {
    id: s.id,
    name: s.name,
    description: s.description ?? '',
    owner: s.owner ?? '',
    status: s.status,
    created_at: s.createdAt,
  }
}

export function rowToSuite(r) {
  return {
    id: str(r.id),
    name: str(r.name),
    description: str(r.description),
    owner: str(r.owner),
    status: str(r.status, 'Active'),
    createdAt: new Date(r.created_at).toISOString(),
  }
}

export function runToRow(r) {
  return {
    id: r.id,
    suite_id: r.suiteId ?? '',
    suite_name: r.suiteName ?? '',
    tester: r.tester ?? '',
    build: r.build ?? '',
    environment: r.environment ?? '',
    sprint: r.sprint ?? '',
    status: r.status,
    started_at: r.startedAt,
    completed_at: r.completedAt ?? null,
    case_ids: r.caseIds ?? [],
    results: JSON.stringify(r.results ?? {}),
  }
}

export function rowToRun(r) {
  return {
    id: str(r.id),
    suiteId: str(r.suite_id),
    suiteName: str(r.suite_name),
    tester: str(r.tester),
    build: str(r.build),
    environment: str(r.environment),
    sprint: str(r.sprint),
    status: str(r.status, 'In Progress'),
    startedAt: new Date(r.started_at).toISOString(),
    completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : undefined,
    caseIds: arr(r.case_ids),
    results: r.results && typeof r.results === 'object' ? r.results : {},
  }
}

export function bugToRow(b) {
  return {
    id: b.id,
    summary: b.summary,
    description: b.description ?? '',
    severity: b.severity,
    priority: b.priority,
    status: b.status,
    linked_case_id: b.linkedCaseId ?? null,
    linked_run_id: b.linkedRunId ?? null,
    assigned_to: b.assignedTo ?? '',
    environment: b.environment ?? '',
    build: b.build ?? '',
    screenshot_name: b.screenshotName ?? null,
    screenshot_data_url: b.screenshotDataUrl ?? null,
    created_at: b.createdAt,
  }
}

export function rowToBug(r) {
  return {
    id: str(r.id),
    summary: str(r.summary),
    description: str(r.description),
    severity: str(r.severity, 'Medium'),
    priority: str(r.priority, 'Medium'),
    status: str(r.status, 'Open'),
    linkedCaseId: opt(r.linked_case_id),
    linkedRunId: opt(r.linked_run_id),
    assignedTo: str(r.assigned_to),
    environment: str(r.environment),
    build: str(r.build),
    screenshotName: opt(r.screenshot_name),
    screenshotDataUrl: opt(r.screenshot_data_url),
    createdAt: new Date(r.created_at).toISOString(),
  }
}
