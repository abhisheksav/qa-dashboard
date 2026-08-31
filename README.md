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

The app ships with a realistic demo dataset (34 test cases, 8 suites, 8 runs, 11 bugs). By default
all data persists in browser localStorage; reset it anytime from **Settings → Data → Reset workspace**.

### Shared backend (optional)

To store data centrally instead of per-browser — Postgres 16 behind a small API, so every signed-in
tester sees the same workspace — see [server/README.md](server/README.md). Quick version:

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec api node scripts/create-user.js you@example.com "a-real-password" "Your Name"
```

Then set `VITE_API_URL` in `.env` (already done by the copy above) and `npm run dev`. Leave it unset
to keep running fully local.

## Sign in

**With no backend configured** (`VITE_API_URL` unset), a dev-only demo login applies:

- **Email**: `abhishek@sav.money`
- **Password**: `Sav@12345`

This credential only works under `npm run dev` — it's guarded by `import.meta.env.DEV`, which Vite
strips from a production build, so it does not exist in anything deployed.

**With the backend configured**, sign-in is real: accounts are created with
`server/scripts/create-user.js`, there is no public sign-up, and `src/store/useAuthStore.ts` calls
the API instead of checking the hardcoded pair above.

The session persists across reloads; sign out from the sidebar footer (or the header on mobile).

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
    persistence.ts    StateStorage driver abstraction (localStorage)
    apiClient.ts      HTTP client for the standalone backend (server/)
    remoteSync.ts     Hydrate + diff-push sync against the API, when configured
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

**Backend**: fully local by default (localStorage). An optional standalone backend — Postgres 16 +
a small Express API, in `server/` — stores the same data centrally instead; see
[server/README.md](server/README.md). The Zustand store stays synchronous either way: `remoteSync.ts`
hydrates on sign-in and pushes only changed rows on every store change, without any store or page
needing to become async.

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
