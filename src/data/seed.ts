import type {
  AppSettings,
  Bug,
  CaseResult,
  CaseStatus,
  IntegrationConfig,
  Priority,
  Severity,
  TestCase,
  TestRun,
  TestSuite,
} from '@/types'

function daysAgo(days: number, hour = 10, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

interface CaseDef {
  title: string
  module: string
  priority: Priority
  pre: string
  steps: [string, string?][]
  data: string
  expected: string
}

const caseDefs: CaseDef[] = [
  { title: 'Login with valid credentials', module: 'Authentication', priority: 'High', pre: 'Registered user account exists', steps: [['Navigate to the login page'], ['Enter a valid email and password'], ['Click the Sign In button']], data: 'user: qa.user@example.com / Passw0rd!', expected: 'User is redirected to the dashboard and a session cookie is set' },
  { title: 'Login with invalid password shows error', module: 'Authentication', priority: 'High', pre: 'Registered user account exists', steps: [['Navigate to the login page'], ['Enter a valid email and an incorrect password'], ['Click Sign In']], data: 'user: qa.user@example.com / wrongpass', expected: 'Inline error "Invalid email or password" is shown; no session is created' },
  { title: 'Password reset email flow', module: 'Authentication', priority: 'Medium', pre: 'User has access to registered mailbox', steps: [['Click "Forgot password" on the login page'], ['Submit the registered email'], ['Open the reset link from the email and set a new password']], data: 'qa.user@example.com', expected: 'Reset email arrives within 2 minutes; new password allows login' },
  { title: 'Session expires after 30 minutes idle', module: 'Authentication', priority: 'Medium', pre: 'User is logged in', steps: [['Stay idle for 30 minutes'], ['Attempt any authenticated action']], data: '—', expected: 'User is redirected to login with a session-expired message' },
  { title: 'SSO login via Google', module: 'Authentication', priority: 'High', pre: 'Google account linked to a user profile', steps: [['Click "Continue with Google"'], ['Complete the Google consent screen']], data: 'Google test account', expected: 'User is logged in and profile fields are pre-filled from Google' },
  { title: 'Guest checkout with card payment', module: 'Checkout', priority: 'Critical', pre: 'At least one item in the cart; user not logged in', steps: [['Proceed to checkout as guest'], ['Fill shipping address and select standard delivery'], ['Pay with a valid test card']], data: 'Card 4242 4242 4242 4242, exp 12/27', expected: 'Order is created, confirmation page shows order number' },
  { title: 'Checkout with saved address', module: 'Checkout', priority: 'High', pre: 'Logged-in user with a saved address', steps: [['Add an item to the cart and open checkout'], ['Select the saved address'], ['Complete payment']], data: 'Saved address: Home', expected: 'Saved address is pre-selected; order completes without re-entering details' },
  { title: 'Order confirmation email sent', module: 'Checkout', priority: 'Medium', pre: 'Order placed successfully', steps: [['Place an order'], ['Check the customer mailbox']], data: '—', expected: 'Confirmation email with order summary arrives within 5 minutes' },
  { title: 'Promo code applies discount', module: 'Checkout', priority: 'Medium', pre: 'Active promo code exists', steps: [['Add items worth over $50 to the cart'], ['Apply promo code at checkout']], data: 'Code: SAVE10 (10% off)', expected: 'Total is reduced by 10% and the discount line item is shown' },
  { title: 'Card payment with 3DS challenge', module: 'Payments', priority: 'Critical', pre: 'Cart ready for checkout', steps: [['Pay with a 3DS-enrolled test card'], ['Complete the challenge in the bank iframe']], data: 'Card 4000 0027 6000 3184', expected: 'Challenge completes and the order is confirmed' },
  { title: 'Refund issued to original payment method', module: 'Payments', priority: 'High', pre: 'A captured payment exists', steps: [['Open the order in admin'], ['Issue a full refund'], ['Verify payment provider dashboard']], data: 'Order from previous test', expected: 'Refund appears on the provider side and order status becomes Refunded' },
  { title: 'Declined payment shows retry option', module: 'Payments', priority: 'High', pre: 'Cart ready for checkout', steps: [['Pay with a decline test card']], data: 'Card 4000 0000 0000 0002', expected: 'Friendly decline message with a "Try another card" action; cart is preserved' },
  { title: 'Add item to cart updates badge', module: 'Cart', priority: 'High', pre: 'Catalog page is reachable', steps: [['Open any product page'], ['Click Add to Cart']], data: 'SKU: TSHIRT-BLK-M', expected: 'Header cart badge increments and a mini-cart toast is shown' },
  { title: 'Update quantity recalculates total', module: 'Cart', priority: 'Medium', pre: 'Cart contains one item', steps: [['Open the cart'], ['Change quantity from 1 to 3']], data: '—', expected: 'Line total and cart total update without a page reload' },
  { title: 'Remove item from cart', module: 'Cart', priority: 'Medium', pre: 'Cart contains at least one item', steps: [['Open the cart'], ['Click Remove on a line item']], data: '—', expected: 'Item disappears, totals update, empty state shows if cart is empty' },
  { title: 'Cart persists across sessions', module: 'Cart', priority: 'Low', pre: 'Logged-in user with items in cart', steps: [['Log out'], ['Log back in and open the cart']], data: '—', expected: 'Cart contents are unchanged after re-login' },
  { title: 'Search returns relevant products', module: 'Search', priority: 'High', pre: 'Catalog is indexed', steps: [['Type "running shoes" in the search bar'], ['Press Enter']], data: 'query: running shoes', expected: 'First page results are footwear; results load under 1s' },
  { title: 'Search with no results shows empty state', module: 'Search', priority: 'Low', pre: '—', steps: [['Search for a nonsense string']], data: 'query: xzqwv123', expected: 'Empty state with suggestions is displayed, no error' },
  { title: 'Filter results by price range', module: 'Search', priority: 'Medium', pre: 'Search results are displayed', steps: [['Open the price filter'], ['Set range $20–$50 and apply']], data: '—', expected: 'Only products priced within the range remain listed' },
  { title: 'Update profile name and avatar', module: 'Profile', priority: 'Low', pre: 'User is logged in', steps: [['Open Profile settings'], ['Change display name and upload an avatar'], ['Save']], data: 'avatar.png (200 KB)', expected: 'Changes persist after reload and avatar renders in the header' },
  { title: 'Change password from profile', module: 'Profile', priority: 'Medium', pre: 'User is logged in', steps: [['Open Security settings'], ['Enter current and new password'], ['Save and log in again with the new password']], data: 'new: N3wPassw0rd!', expected: 'Password change succeeds; old password no longer works' },
  { title: 'Delete account flow', module: 'Profile', priority: 'High', pre: 'Disposable test account exists', steps: [['Open Account settings'], ['Click Delete account and confirm via email link']], data: 'temp account', expected: 'Account is deactivated and login is rejected afterwards' },
  { title: 'Order shipped push notification', module: 'Notifications', priority: 'Medium', pre: 'Order in Processing state; push enabled', steps: [['Mark the order as shipped in admin'], ['Observe the device notification']], data: '—', expected: 'Push notification with tracking link arrives within 1 minute' },
  { title: 'Email preferences opt-out', module: 'Notifications', priority: 'Low', pre: 'User subscribed to marketing emails', steps: [['Open Notification preferences'], ['Toggle marketing emails off and save']], data: '—', expected: 'Preference persists and no marketing email is sent on next campaign' },
  { title: 'GET /products returns 200 with valid schema', module: 'API', priority: 'High', pre: 'API token available', steps: [['Send GET /api/v1/products'], ['Validate response against the JSON schema']], data: 'limit=20', expected: 'HTTP 200; body matches schema; pagination headers present' },
  { title: 'POST /orders validates payload', module: 'API', priority: 'Critical', pre: 'API token available', steps: [['Send POST /api/v1/orders with a missing address field']], data: '{ items: [...], address: null }', expected: 'HTTP 422 with field-level validation errors' },
  { title: 'Rate limiting returns 429', module: 'API', priority: 'Medium', pre: 'API token available', steps: [['Send 120 requests within one minute']], data: 'GET /api/v1/products', expected: 'Requests beyond the limit receive HTTP 429 with Retry-After' },
  { title: 'Auth token refresh endpoint', module: 'API', priority: 'High', pre: 'Valid refresh token', steps: [['Send POST /api/v1/auth/refresh with the refresh token']], data: '—', expected: 'New access token issued; old access token expires' },
  { title: 'Biometric login on mobile app', module: 'Mobile', priority: 'High', pre: 'App installed; biometrics enrolled', steps: [['Enable biometric login in app settings'], ['Kill the app, reopen, authenticate with fingerprint']], data: 'Pixel 8, Android 15', expected: 'User is logged in without typing credentials' },
  { title: 'Offline cart syncs when back online', module: 'Mobile', priority: 'Medium', pre: 'App logged in', steps: [['Enable airplane mode'], ['Add two items to the cart'], ['Disable airplane mode and wait 30s']], data: '—', expected: 'Cart syncs to server; badge count matches on web' },
  { title: 'Deep link opens product page', module: 'Mobile', priority: 'Low', pre: 'App installed', steps: [['Tap a product deep link from chat']], data: 'app://product/12345', expected: 'App opens directly on the product page' },
  { title: 'Admin can create product listing', module: 'Admin', priority: 'High', pre: 'Admin user logged in', steps: [['Open Admin > Products > New'], ['Fill title, price, stock and save']], data: 'title: QA Test Product', expected: 'Product appears in the catalog and storefront search' },
  { title: 'Bulk export orders to CSV', module: 'Admin', priority: 'Medium', pre: 'At least 50 orders exist', steps: [['Open Admin > Orders'], ['Select date range and click Export CSV']], data: 'range: last 30 days', expected: 'CSV downloads with one row per order and correct totals' },
  { title: 'Role-based access control enforced', module: 'Admin', priority: 'Critical', pre: 'Support-role user exists', steps: [['Log in as support role'], ['Attempt to open Admin > Settings']], data: 'support@example.com', expected: 'Access is denied with a 403 page; audit log records the attempt' },
]

const now = new Date().toISOString()

// Cases automated in CI (Playwright/API runners) — API contract checks plus a
// handful of stable, high-value smoke/regression flows. Everything else is
// executed by hand. 1-indexed to match caseDefs order.
const automatedCaseNums = new Set([1, 2, 13, 14, 17, 25, 26, 27, 28, 32, 34])

// Why each remaining Manual case hasn't been automated yet (or won't be) —
// shown as the Remark column in Test Cases and read by the reviewer/tester
// deciding what to pick up next for automation.
const manualRemarks: Record<number, string> = {
  3: 'Requires reading a real mailbox; not yet wired into CI.',
  4: 'The 30-minute idle wait makes this too slow for the CI pipeline.',
  5: "Blocked by Google's consent screen — no stable automation hook yet.",
  6: 'Automation candidate; scheduled for Sprint 25.',
  7: 'Automation candidate; scheduled for Sprint 25.',
  8: 'Requires mailbox verification; low ROI to automate.',
  9: 'Automation candidate; not yet scripted.',
  10: "3DS bank iframe isn't automatable in the current test environment.",
  11: 'Requires manually checking the payment provider dashboard.',
  12: 'Automation candidate; not yet scripted.',
  15: 'Automation candidate; not yet scripted.',
  16: 'Low priority; exploratory check only.',
  18: 'Low priority; exploratory check only.',
  19: 'Automation candidate; not yet scripted.',
  20: 'Requires uploading a real file; not automated yet.',
  21: 'Automation candidate; not yet scripted.',
  22: 'Destructive flow — kept manual on purpose to avoid deleting test accounts in CI.',
  23: 'Requires a physical or simulated device; not automated yet.',
  24: 'Low priority; exploratory check only.',
  29: "Requires a physical device's biometrics; can't run in CI.",
  30: 'Requires toggling airplane mode on a real device.',
  31: 'Automation candidate; not yet scripted.',
  33: 'Automation candidate; not yet scripted.',
}

// Testing-layer classification. Anything not API/Mobile is exercised through
// the app/web UI against backend business logic, so it defaults to Backend.
function categoryFor(module: string): string {
  if (module === 'API') return 'API'
  if (module === 'Mobile') return 'Device'
  return 'Backend'
}

// A case parked as Inactive (temporarily out of rotation) or Archived
// (retired) — everything else defaults to Active. 1-indexed.
const inactiveCaseNums = new Set([16, 24]) // low-priority exploratory checks, deprioritized
const archivedCaseNums = new Set([21, 33]) // superseded by newer cases

// Jira story each case was written against — only a subset carry one, since
// not every case traces back to a single story (e.g. cross-cutting checks).
const storyIds: Record<number, string> = {
  1: 'SV1-10201', 2: 'SV1-10201', 3: 'SV1-10201', 4: 'SV1-10204', 5: 'SV1-10205',
  6: 'SV1-10310', 7: 'SV1-10310', 9: 'SV1-10312',
  25: 'SV1-11466', 26: 'SV1-11466', 27: 'SV1-11470', 28: 'SV1-11470',
  29: 'SV1-10550', 30: 'SV1-10551',
}

export const seedTestCases: TestCase[] = caseDefs.map((def, i) => ({
  id: `TC-${String(i + 1).padStart(3, '0')}`,
  title: def.title,
  module: def.module,
  category: categoryFor(def.module),
  priority: def.priority,
  executionType: automatedCaseNums.has(i + 1) ? 'Automated' : 'Manual',
  automationRemark: manualRemarks[i + 1],
  lifecycleStatus: archivedCaseNums.has(i + 1) ? 'Archived' : inactiveCaseNums.has(i + 1) ? 'Inactive' : 'Active',
  version: 1,
  storyId: storyIds[i + 1],
  preconditions: def.pre,
  steps: def.steps.map(([action, expected], j) => ({ id: `s${j + 1}`, action, expected })),
  testData: def.data,
  expectedResult: def.expected,
  actualResult: '',
  status: 'Not Executed',
  comments: '',
  bugIds: [],
  suiteIds: [],
  sprint: i < 24 ? 'Sprint 109' : 'Sprint 110',
  reviewStatus: 'Approved',
  createdAt: daysAgo(30 - Math.floor(i / 3)),
  updatedAt: daysAgo(30 - Math.floor(i / 3)),
}))

const suiteMembership: Record<string, number[]> = {
  'SUITE-001': [1, 6, 10, 13, 17, 25, 26, 34],
  'SUITE-002': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 25, 26, 32, 34],
  'SUITE-004': [25, 26, 27, 28],
  'SUITE-005': [29, 30, 31],
  'SUITE-006': [1, 2, 6, 7, 13, 14, 15, 17, 18, 19, 20],
  'SUITE-008': [23, 24, 27, 28, 29, 30, 31, 32, 33],
}

export const seedSuites: TestSuite[] = [
  { id: 'SUITE-001', name: 'Smoke', description: 'Fast health check of critical user journeys before deeper testing.', owner: 'Abhishek', status: 'Active', createdAt: daysAgo(45) },
  { id: 'SUITE-002', name: 'Regression', description: 'Full regression coverage across all modules.', owner: 'Vishal', status: 'Active', createdAt: daysAgo(45) },
  { id: 'SUITE-004', name: 'API', description: 'Contract and behavior checks for the public REST API.', owner: 'Abhishek', status: 'Active', createdAt: daysAgo(38) },
  { id: 'SUITE-005', name: 'Mobile', description: 'Native app flows on Android and iOS devices.', owner: 'Vishal', status: 'Active', createdAt: daysAgo(35) },
  { id: 'SUITE-006', name: 'Web', description: 'Browser-based storefront coverage.', owner: 'Vishal', status: 'Active', createdAt: daysAgo(35) },
  { id: 'SUITE-008', name: 'Sprint 110 Testing', description: 'Stories and fixes delivered in Sprint 110.', owner: 'Abhishek', status: 'Draft', createdAt: daysAgo(12) },
]

for (const [suiteId, nums] of Object.entries(suiteMembership)) {
  for (const n of nums) {
    seedTestCases[n - 1].suiteIds.push(suiteId)
  }
}

const tc = (n: number) => `TC-${String(n).padStart(3, '0')}`

interface RunDef {
  id: string
  suiteId: string
  tester: string
  build: string
  environment: string
  sprint: string
  day: number
  hour: number
  durationMin: number
  inProgress?: boolean
  // caseNum -> [status, bugId?]
  outcomes: Record<number, [CaseStatus, string?]>
}

const runDefs: RunDef[] = [
  {
    id: 'RUN-001', suiteId: 'SUITE-001', tester: 'Abhishek', build: '2.4.0', environment: 'QA', sprint: 'Sprint 109', day: 13, hour: 10, durationMin: 55,
    outcomes: { 1: ['Passed'], 6: ['Passed'], 10: ['Passed'], 13: ['Passed'], 17: ['Passed'], 25: ['Passed'], 26: ['Failed', 'BUG-001'], 34: ['Passed'] },
  },
  {
    id: 'RUN-002', suiteId: 'SUITE-002', tester: 'Vishal', build: '2.4.0', environment: 'QA', sprint: 'Sprint 109', day: 11, hour: 9, durationMin: 340,
    outcomes: { 1: ['Passed'], 2: ['Passed'], 3: ['Passed'], 4: ['Failed', 'BUG-002'], 5: ['Passed'], 6: ['Passed'], 7: ['Passed'], 8: ['Failed', 'BUG-003'], 9: ['Passed'], 10: ['Passed'], 11: ['Passed'], 12: ['Passed'], 13: ['Passed'], 14: ['Passed'], 15: ['Passed'], 16: ['Skipped'], 17: ['Passed'], 18: ['Passed'], 19: ['Failed', 'BUG-004'], 20: ['Passed'], 21: ['Passed'], 22: ['Blocked'], 25: ['Passed'], 26: ['Passed'], 32: ['Passed'], 34: ['Passed'] },
  },
  {
    id: 'RUN-003', suiteId: 'SUITE-004', tester: 'Abhishek', build: '2.4.1', environment: 'Staging', sprint: 'Sprint 109', day: 8, hour: 14, durationMin: 40,
    outcomes: { 25: ['Passed'], 26: ['Passed'], 27: ['Failed', 'BUG-005'], 28: ['Passed'] },
  },
  {
    id: 'RUN-005', suiteId: 'SUITE-001', tester: 'Vishal', build: '2.5.0-rc1', environment: 'Staging', sprint: 'Sprint 110', day: 4, hour: 9, durationMin: 60,
    outcomes: { 1: ['Passed'], 6: ['Passed'], 10: ['Blocked', 'BUG-006'], 13: ['Passed'], 17: ['Passed'], 25: ['Passed'], 26: ['Passed'], 34: ['Passed'] },
  },
  {
    id: 'RUN-006', suiteId: 'SUITE-002', tester: 'Vishal', build: '2.5.0-rc1', environment: 'Staging', sprint: 'Sprint 110', day: 2, hour: 9, durationMin: 380,
    outcomes: { 1: ['Passed'], 2: ['Passed'], 3: ['Failed', 'BUG-007'], 4: ['Passed'], 5: ['Passed'], 6: ['Passed'], 7: ['Failed', 'BUG-008'], 8: ['Passed'], 9: ['Passed'], 10: ['Passed'], 11: ['Blocked'], 12: ['Passed'], 13: ['Passed'], 14: ['Passed'], 15: ['Passed'], 16: ['Passed'], 17: ['Passed'], 18: ['Passed'], 19: ['Passed'], 20: ['Passed'], 21: ['Passed'], 22: ['Skipped'], 25: ['Passed'], 26: ['Passed'], 32: ['Failed', 'BUG-009'], 34: ['Passed'] },
  },
  {
    id: 'RUN-007', suiteId: 'SUITE-005', tester: 'Vishal', build: '2.5.0-rc1', environment: 'Staging', sprint: 'Sprint 110', day: 1, hour: 13, durationMin: 75,
    outcomes: { 29: ['Passed'], 30: ['Failed', 'BUG-010'], 31: ['Passed'] },
  },
  {
    id: 'RUN-008', suiteId: 'SUITE-001', tester: 'Abhishek', build: '2.5.0', environment: 'UAT', sprint: 'Sprint 110', day: 0, hour: 9, durationMin: 25, inProgress: true,
    outcomes: { 1: ['Passed'], 6: ['Passed'], 10: ['Passed'], 13: ['Failed', 'BUG-011'], 17: ['Passed'] },
  },
]

export const seedRuns: TestRun[] = runDefs.map((def) => {
  const suite = seedSuites.find((s) => s.id === def.suiteId)!
  const caseIds = suiteMembership[def.suiteId].map(tc)
  const startedAt = daysAgo(def.day, def.hour)
  const perCaseSec = Math.round((def.durationMin * 60) / Math.max(1, Object.keys(def.outcomes).length))
  const results: Record<string, CaseResult> = {}
  let idx = 0
  for (const [numStr, [status, bugId]] of Object.entries(def.outcomes)) {
    const caseId = tc(Number(numStr))
    const executedAt = new Date(new Date(startedAt).getTime() + (idx + 1) * perCaseSec * 1000).toISOString()
    results[caseId] = {
      caseId,
      status,
      actualResult:
        status === 'Passed'
          ? 'Worked as expected'
          : status === 'Failed'
            ? 'Behavior did not match the expected result — see linked bug'
            : status === 'Blocked'
              ? 'Could not proceed due to environment/dependency issue'
              : '',
      comments: '',
      bugId,
      executedAt,
      durationSec: perCaseSec,
    }
    idx++
  }
  return {
    id: def.id,
    suiteId: def.suiteId,
    suiteName: suite.name,
    tester: def.tester,
    build: def.build,
    environment: def.environment,
    sprint: def.sprint,
    status: def.inProgress ? 'In Progress' : 'Completed',
    startedAt,
    completedAt: def.inProgress
      ? undefined
      : new Date(new Date(startedAt).getTime() + def.durationMin * 60000).toISOString(),
    caseIds,
    results,
  }
})

// Case status reflects the most recent run that executed it
{
  const latest: Record<string, { at: string; status: CaseStatus; bugId?: string }> = {}
  for (const run of seedRuns) {
    for (const r of Object.values(run.results)) {
      if (!latest[r.caseId] || (r.executedAt && r.executedAt > latest[r.caseId].at)) {
        latest[r.caseId] = { at: r.executedAt ?? run.startedAt, status: r.status, bugId: r.bugId }
      }
    }
  }
  for (const c of seedTestCases) {
    const l = latest[c.id]
    if (l) {
      c.status = l.status
      c.updatedAt = l.at
      if (l.status === 'Passed') c.actualResult = 'Worked as expected'
      if (l.status === 'Failed') c.actualResult = 'Behavior did not match the expected result'
    }
  }
  for (const run of seedRuns) {
    for (const r of Object.values(run.results)) {
      if (r.bugId) {
        const c = seedTestCases.find((x) => x.id === r.caseId)!
        if (!c.bugIds.includes(r.bugId)) c.bugIds.push(r.bugId)
      }
    }
  }
}

interface BugDef {
  id: string
  summary: string
  description: string
  severity: Severity
  priority: Priority
  status: Bug['status']
  caseNum: number
  runId: string
  assignedTo: string
  build: string
  environment: string
  day: number
}

const bugDefs: BugDef[] = [
  { id: 'BUG-001', summary: 'POST /orders accepts order with null address', description: 'Sending a payload with address: null returns 201 instead of 422. The order is created with an empty shipping address and fulfilment fails downstream.', severity: 'Critical', priority: 'Critical', status: 'Fixed', caseNum: 26, runId: 'RUN-001', assignedTo: 'Abhishek', build: '2.4.0', environment: 'QA', day: 13 },
  { id: 'BUG-002', summary: 'Idle session never expires', description: 'After 30+ minutes of inactivity the session cookie remains valid and authenticated actions still succeed. Expected redirect to login.', severity: 'High', priority: 'High', status: 'Closed', caseNum: 4, runId: 'RUN-002', assignedTo: 'Vishal', build: '2.4.0', environment: 'QA', day: 11 },
  { id: 'BUG-003', summary: 'Order confirmation email missing order items table', description: 'Confirmation email arrives but the items table renders as raw template variables ({{items}}).', severity: 'Medium', priority: 'Medium', status: 'Closed', caseNum: 8, runId: 'RUN-002', assignedTo: 'Vishal', build: '2.4.0', environment: 'QA', day: 11 },
  { id: 'BUG-004', summary: 'Price filter includes items outside selected range', description: 'With range $20–$50 applied, products priced $54.99 and $59.99 remain in the result list.', severity: 'Medium', priority: 'Low', status: 'Open', caseNum: 19, runId: 'RUN-002', assignedTo: 'Abhishek', build: '2.4.0', environment: 'QA', day: 11 },
  { id: 'BUG-005', summary: 'Rate limiter returns 500 instead of 429', description: 'Request 101+ within a minute triggers an unhandled exception in the throttle middleware; response is HTTP 500 with a stack trace.', severity: 'High', priority: 'High', status: 'Retest', caseNum: 27, runId: 'RUN-003', assignedTo: 'Abhishek', build: '2.4.1', environment: 'Staging', day: 8 },
  { id: 'BUG-006', summary: '3DS challenge iframe fails to load on staging', description: 'Bank simulator iframe times out on staging — appears to be a misconfigured provider webhook URL. Blocks all 3DS test cases.', severity: 'High', priority: 'Critical', status: 'In Progress', caseNum: 10, runId: 'RUN-005', assignedTo: 'Abhishek', build: '2.5.0-rc1', environment: 'Staging', day: 4 },
  { id: 'BUG-007', summary: 'Password reset link expires immediately', description: 'Reset links generated on 2.5.0-rc1 are already expired when opened, even seconds after the email arrives. Token TTL appears to be set in ms instead of seconds.', severity: 'High', priority: 'High', status: 'Open', caseNum: 3, runId: 'RUN-006', assignedTo: 'Vishal', build: '2.5.0-rc1', environment: 'Staging', day: 2 },
  { id: 'BUG-008', summary: 'Saved address dropdown empty on checkout', description: 'Checkout shows "No saved addresses" for users who have addresses saved. API call to /addresses returns 200 with data, but the dropdown does not render items.', severity: 'High', priority: 'High', status: 'Open', caseNum: 7, runId: 'RUN-006', assignedTo: 'Vishal', build: '2.5.0-rc1', environment: 'Staging', day: 2 },
  { id: 'BUG-009', summary: 'Product create form loses data on validation error', description: 'If price validation fails, the whole form resets and all entered fields are cleared.', severity: 'Medium', priority: 'Medium', status: 'In Progress', caseNum: 32, runId: 'RUN-006', assignedTo: 'Abhishek', build: '2.5.0-rc1', environment: 'Staging', day: 2 },
  { id: 'BUG-010', summary: 'Offline cart items duplicated after sync', description: 'Items added while offline appear twice after reconnecting — once from local state and once from the sync payload.', severity: 'Medium', priority: 'High', status: 'Open', caseNum: 30, runId: 'RUN-007', assignedTo: 'Vishal', build: '2.5.0-rc1', environment: 'Staging', day: 1 },
  { id: 'BUG-011', summary: 'Cart badge not updating on UAT build 2.5.0', description: 'Adding an item to the cart does not increment the header badge until a full page reload. Regression from the mini-cart refactor.', severity: 'Medium', priority: 'High', status: 'Open', caseNum: 13, runId: 'RUN-008', assignedTo: 'Abhishek', build: '2.5.0', environment: 'UAT', day: 0 },
]

export const seedBugs: Bug[] = bugDefs.map((b) => ({
  id: b.id,
  summary: b.summary,
  description: b.description,
  severity: b.severity,
  priority: b.priority,
  status: b.status,
  linkedCaseId: tc(b.caseNum),
  linkedRunId: b.runId,
  assignedTo: b.assignedTo,
  environment: b.environment,
  build: b.build,
  createdAt: daysAgo(b.day, 15),
}))

// Product modules shown in the sidebar and offered when creating/importing cases.
export const SAV_MODULES = [
  'Login / Signup / Onboarding',
  'SAV Card',
  'SAV Wealth',
  'SAV Gold',
  'Offboarding',
]

// Previous default list — used by the store migration to detect an untouched
// settings.modules and swap it for SAV_MODULES.
export const LEGACY_DEFAULT_MODULES = ['Authentication', 'Checkout', 'Payments', 'Cart', 'Search', 'Profile', 'Notifications', 'API', 'Mobile', 'Admin']

export const seedSettings: AppSettings = {
  currentTester: 'Abhishek',
  testers: ['Abhishek', 'Vishal'],
  builds: ['2.4.0', '2.4.1', '2.5.0-rc1', '2.5.0'],
  environments: ['QA', 'Staging', 'UAT', 'Production'],
  sprints: ['Sprint 108', 'Sprint 109', 'Sprint 110', 'Sprint 111', 'Sprint 112', 'Sprint 113', 'Sprint 114', 'Sprint 115'],
  activeSprint: 'Sprint 110',
  modules: [...SAV_MODULES],
  categories: ['API', 'Backend', 'Device'],
  defaultBuild: '2.5.0',
  defaultEnvironment: 'QA',
}

export const seedIntegrations: IntegrationConfig[] = [
  { id: 'jira', enabled: false, settings: { baseUrl: '', projectKey: '', email: '', apiToken: '' } },
  { id: 'testrail', enabled: false, settings: { baseUrl: '', projectId: '', apiKey: '' } },
  { id: 'zephyr', enabled: false, settings: { baseUrl: '', apiToken: '' } },
  { id: 'playwright', enabled: false, settings: { reportPath: '', resultsWebhook: '' } },
  { id: 'github-actions', enabled: false, settings: { repo: '', workflow: '', token: '' } },
  { id: 'jenkins', enabled: false, settings: { baseUrl: '', jobName: '', apiToken: '' } },
  { id: 'browserstack', enabled: false, settings: { username: '', accessKey: '' } },
  { id: 'slack', enabled: false, settings: { webhookUrl: '', channel: '' } },
]

export const seedVersion = 1

export { now as seedGeneratedAt }
