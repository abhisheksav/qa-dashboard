# API automation integration

The dashboard shows the latest run of the API automation suite
([Sav-Money/qa-api-automation](https://github.com/Sav-Money/qa-api-automation)) in the
**API Automation — Latest Run** card.

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
the card then renders a neutral "not configured" state rather than an error.

A simpler alternative worth considering: add a step to the suite's own workflow that publishes this
JSON somewhere the dashboard can read directly, which removes the need for a token-bearing proxy
entirely.

## Known gap: results are not linked to test cases

The card shows **totals only**. Per-case linking does not work yet.

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
