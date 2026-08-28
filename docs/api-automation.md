# API automation integration

The **API Automation** section (`/api-automation`) shows the latest run of the API automation
suite ([Sav-Money/qa-api-automation](https://github.com/Sav-Money/qa-api-automation)): totals,
the failing tests with their errors, recent workflow runs, and a control to trigger a new run.
A condensed summary card also sits on the dashboard.

## Why there is a server-side endpoint

The suite publishes its report as a **GitHub Actions artifact** — it is not committed to the repo
and not published to Pages. The repo is also `INTERNAL`, so reading either the artifact list or the
zip requires a GitHub credential.

A browser cannot hold that credential. Anything in the bundle is readable by whoever loads the page,
and a token with read access to the org's repos is not something to hand out. So the token stays on
the server, and the browser only ever receives the extracted numbers.

```
browser  ──GET /api/automation/latest──▶  server (holds token)
                                            │
                                            ├─▶ GET /repos/{repo}/actions/artifacts
                                            ├─▶ GET /repos/{repo}/actions/runs/{id}
                                            └─▶ GET /repos/{repo}/actions/artifacts/{id}/zip
                                                 └─ extract allure-report/widgets/summary.json
```

## In development

[`vite/apiAutomation.ts`](../vite/apiAutomation.ts) implements the endpoint as a Vite dev-server
plugin. It resolves a token from, in order:

1. `GITHUB_TOKEN` or `GH_TOKEN` in the environment or `.env`
2. `gh auth token` — whatever the GitHub CLI is signed in as

The second means anyone who has run `gh auth login` needs no setup, and no credential is written to
disk. Responses are cached for 5 minutes, since the artifact zip is several megabytes and artifacts
are immutable once uploaded.

Point it at a different repo with `QA_AUTOMATION_REPO=owner/name`.

## In a deployed build

**This does not work in a static build.** `npm run build` produces static files with no server, so
`/api/automation/latest` returns the SPA's `index.html` and the card shows an error. Whatever hosts
the app must serve this route.

The response contract:

```jsonc
{
  "repo": "Sav-Money/qa-api-automation",
  "runId": 33145777954,
  "runNumber": 103,
  "runUrl": "https://github.com/Sav-Money/qa-api-automation/actions/runs/33145777954",
  "workflowName": "API Automation Regression",
  "event": "schedule",          // schedule | push | workflow_dispatch
  "branch": "main",
  "conclusion": "failure",      // workflow conclusion, null while running
  "startedAt": "2026-08-28T05:46:25Z",
  "artifactName": "playwright-report-regression",
  "artifactCreatedAt": "2026-08-28T05:58:10Z",
  "durationMs": 622107,
  "total": 200,
  "passed": 180,
  "failed": 4,
  "broken": 0,
  "skipped": 16,
  "unknown": 0,
  "passRate": 97.83            // passed / (passed + failed + broken) — skipped excluded
}
```

Return `501` with `{ "error": "not-configured", "message": "…" }` when no credential is available;
the UI then renders a neutral "not configured" state rather than an error.

### `GET /api/automation/runs`

Last 10 runs of `api-regression.yml`, for the history table.

```jsonc
{ "runs": [ { "id": 33145777954, "runNumber": 103, "name": "API Automation Regression",
              "event": "schedule", "branch": "main", "status": "completed",
              "conclusion": "failure", "startedAt": "…", "updatedAt": "…",
              "url": "https://github.com/…", "actor": "Vishal-savMoney" } ] }
```

### `POST /api/automation/dispatch`

Triggers the workflow on `main`. Body: `{ "target": "smoke" }`, where target is one of
`smoke`, `recurring-buys-gold`, `sav-gold`, `auth`, `onboarding`, `regression`, `all` —
matching the workflow's own `workflow_dispatch` choice input.

Responds `202 { "ok": true, "target": "smoke" }`. GitHub queues the run asynchronously, so it does
not appear in `/runs` immediately; the UI re-polls after a few seconds. Unknown targets are
rejected with `400` before any GitHub call is made.

**This needs a token with `workflow` scope**, unlike the read-only routes. Running the suite hits
the staging environment and posts to the QA Slack channel, so the UI asks for confirmation before
dispatching rather than firing on a single click.

A simpler alternative worth considering: add a step to the suite's own workflow that publishes this
JSON somewhere the dashboard can read directly, which removes the need for a token-bearing proxy
entirely.

## Failure detail

Per-test failures come from `test-results/results.json` (Playwright's own JSON reporter) inside the
same artifact — Allure's `summary.json` widget carries only counts. When that file is absent the
API sets `failureDetailUnavailable: true`, so an empty `failures` list means "unknown" rather than
"none failed".

## Known gap: results are not linked to test cases

The section lists the failing tests with their ids, error text and retry counts, but those results
are **not linked to test cases in this app**.

The app's Playwright importer ([`src/lib/playwrightImport.ts`](../src/lib/playwrightImport.ts))
matches results back to test cases by a `TC-###` tag in the test title. The real suite uses a
different convention entirely:

```
SG-REFUND-001: order auto-refunds when card name mismatches KYC name
GO-PH-013:     phone OTP verified successfully
SIP-FEE-001:   DAILY SIP checkout total excludes platform fee vs WEEKLY
GO-CC-003 (+ GO-API-002): send-otp accepts +91 country code
```

**None of the 200 tests carry a `TC-###` tag**, so the importer currently matches zero of them.
Closing this needs a decision on which way the mapping should go — either the suite adopts `TC-###`
tags, or the dashboard learns the `SG-`/`GO-`/`SIP-` scheme and the test case library is keyed to
match. Note the fourth example above references two IDs in one test, so the mapping is not
necessarily one-to-one.
