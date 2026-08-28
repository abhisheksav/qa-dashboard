# QA Test Execution Dashboard

A professional, self-contained web app for manual QA engineers to organize, execute, and track test
cases — no Jira or TestRail required. Clean light/dark UI, fully keyboard- and mobile-friendly.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npm test           # route + interaction smoke tests (vitest + jsdom)
```

The app ships with a realistic demo dataset (34 test cases, 8 suites, 8 runs, 11 bugs). All data
persists in browser localStorage; reset it anytime from **Settings → Data → Reset workspace**.

## Sign in

QA access is gated behind a login screen:

- **Email**: `abhishek@sav.money`
- **Password**: `Sav@12345`

The session persists across reloads; sign out from the sidebar footer (or the header on mobile).
This is client-side demo gating only — the credentials live in the bundle, so anyone with the built
files can read them. For real security, swap `src/store/useAuthStore.ts` for a server-backed auth
provider behind the same `login`/`logout` interface; the route guard and UI need no changes.

## Features

- **Dashboard** — sprint-scoped QA overview: sprint selector (defaults to the current sprint), KPI
  tiles (total / passed / failed / blocked / in progress), test-cases-by-type and execution-status
  donuts, execution and pass-vs-fail trends, a per-run executions table, and an **All Test Cases**
  section filterable across every sprint by sprint, type, status, priority and assignee.
- **API Automation** — latest run of the [qa-api-automation](https://github.com/Sav-Money/qa-api-automation)
  suite: totals and pass rate, the failing tests with their captured errors and retry counts, recent
  workflow runs, and a **Run tests** control that dispatches any of the suites (smoke, regression,
  sav-gold, …). A condensed summary also sits on the dashboard. Needs a server-side endpoint —
  see [docs/api-automation.md](docs/api-automation.md).
- **Test Suites** — create, rename, duplicate, delete, execute. A case can belong to many suites.
- **Test Cases** — TanStack Table with search + module/priority/status/suite filters (URL-driven,
  shareable), bulk select → assign-to-suites / delete, full editor with dynamic steps,
  **Excel/CSV import** (with template) and **Excel export**.
- **Execute Suite** — sequential runner with case sidebar, step checklist, actual result/comments,
  **Pass / Fail / Block / Skip**. Fail opens a pre-filled bug form (summary, description with repro
  steps, severity, priority, environment, build, screenshot upload) and auto-links the bug.
- **Test Runs** — every execution stored: run ID, date, tester, suite, build, pass rate, duration,
  per-status counts. Click through to full per-case results.
- **Bug Tracker** — severity/status/assignee filters, linked test cases, screenshots, full CRUD.
- **Reports** — pass vs fail, daily execution trend, module-wise failures, bug severity
  distribution, overall execution progress, per-suite (Smoke/Regression) progress. Sprint + build
  filters scope the run-based charts.
- **Global search** (Ctrl+K) — finds test cases, suites, bugs, runs, and builds.
- **Theme** — light / dark / system, applied before first paint (no flash).

## Tech stack

React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui-style primitives (Radix) · React Router ·
TanStack Table · React Hook Form · Zustand (persisted) · Recharts · SheetJS + PapaParse.

## Architecture

```
src/
  types/          Domain model (TestCase, TestSuite, TestRun, Bug, …)
  data/seed.ts    Demo dataset — internally consistent (case status derives from latest run)
  services/
    persistence.ts    StateStorage driver abstraction (local now, remote later)
  store/          Zustand stores: domain data (persisted) + theme
  lib/            stats selectors, import/export, utils
  components/
    ui/           Button, Dialog, Select, Table, … (shadcn-style)
    layout/       AppShell, sidebar, global search, theme toggle
    charts/       Theme-aware chart tokens + tooltip/legend
    shared/       Status/priority/severity badges, KPI card, StartRunDialog
    cases/        Case form + assign-to-suites dialogs
  pages/          One file per route
```

**Backend**: the app is fully local — all data persists to browser localStorage. Persistence flows
through the `StateStorage` driver in `services/persistence.ts`, so a remote driver can swap in
without touching stores or UI if a backend is added later.

**Future integrations**: Jira, TestRail, Zephyr, Playwright, GitHub Actions, Jenkins, BrowserStack,
and Slack each have a config surface in **Settings → Integrations**; credentials are stored per
integration and the sync contract lives behind the same persistence boundary.

## Import format

`Import → Download Template` produces the canonical sheet. Recognized columns (case-insensitive):
Title (required), Module, Priority, Preconditions, Test Steps (one per line, `action => expected`),
Test Data, Expected Result, Actual Result, Status, Comments, Sprint. Both `.xlsx` and `.csv` work;
exported files round-trip.

## Notes

- `xlsx` is installed from the official SheetJS CDN (`0.20.3`) because the npm registry copy is
  stale and carries known advisories — keep it pinned that way.
- Recharts and SheetJS are code-split; they load only when Reports or import/export are used.
