-- QA Test Execution Dashboard — Postgres 16 schema
-- Apply with: psql "$DATABASE_URL" -f schema.sql
-- (docker-compose runs this automatically on first container start via
--  the postgres image's /docker-entrypoint-initdb.d mechanism.)
--
-- Plain relational tables mirroring the app's TypeScript types 1:1
-- (snake_case here, camelCase in the client — server/src/mapping.js does the
-- conversion). Array and record fields stay denormalized as text[]/jsonb so a
-- row write is a single upsert with no join-table bookkeeping — the app never
-- queries "all suites a case belongs to" as a join, it just reads the array
-- off the case.

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------- users
-- One shared login per person (not per browser). No public self-registration
-- endpoint exists — accounts are created with scripts/create-user.js, so
-- "who has an account" stays an explicit decision.
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  name          text not null,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------------ suites
create table if not exists test_suites (
  id          text primary key,
  name        text        not null,
  description text        not null default '',
  owner       text        not null default '',
  status      text        not null default 'Active',
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------- cases
create table if not exists test_cases (
  id                text primary key,
  title             text        not null,
  module            text        not null default '',
  sub_module        text,
  case_type         text,
  priority          text        not null default 'Medium',
  execution_type    text        not null default 'Manual',
  automation_remark text,
  category          text,
  lifecycle_status  text        not null default 'Active',
  version           integer     not null default 1,
  story_id          text,
  preconditions     text        not null default '',
  steps             jsonb       not null default '[]'::jsonb,
  test_data         text        not null default '',
  expected_result   text        not null default '',
  actual_result     text        not null default '',
  status            text        not null default 'Not Executed',
  comments          text        not null default '',
  bug_ids           text[]      not null default '{}',
  suite_ids         text[]      not null default '{}',
  sprint            text        not null default '',
  review_status     text        not null default 'Pending',
  uploaded_by       text,
  upload_name       text,
  reviewed_by       text,
  reviewed_at       timestamptz,
  review_comment    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- -------------------------------------------------------------------- runs
-- `results` is a Record<caseId, CaseResult> kept as jsonb: a run's results
-- are always read and written together, so a child table would only add
-- round-trips for no benefit here.
create table if not exists test_runs (
  id           text primary key,
  suite_id     text        not null default '',
  suite_name   text        not null default '',
  tester       text        not null default '',
  build        text        not null default '',
  environment  text        not null default '',
  sprint       text        not null default '',
  status       text        not null default 'In Progress',
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  case_ids     text[]      not null default '{}',
  results      jsonb       not null default '{}'::jsonb
);

-- -------------------------------------------------------------------- bugs
-- Screenshots stay as base64 data URLs (matching the client type) rather than
-- object storage — a standalone Postgres box has nothing else to put them in
-- without adding a second service. See server/README.md if that outgrows a
-- text column later.
create table if not exists bugs (
  id                  text primary key,
  summary             text        not null,
  description         text        not null default '',
  severity            text        not null default 'Medium',
  priority            text        not null default 'Medium',
  status              text        not null default 'Open',
  linked_case_id      text,
  linked_run_id       text,
  assigned_to         text        not null default '',
  environment         text        not null default '',
  build               text        not null default '',
  screenshot_name     text,
  screenshot_data_url text,
  created_at          timestamptz not null default now()
);

-- ------------------------------------------------------------- app_settings
-- Single shared row (id pinned to 'default') holding the workspace dropdown
-- vocabularies: testers, builds, sprints, modules, product owners, etc.
create table if not exists app_settings (
  id         text primary key default 'default',
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------- integrations
create table if not exists integrations (
  id       text primary key,
  enabled  boolean not null default false,
  settings jsonb   not null default '{}'::jsonb
);

-- -------------------------------------------------------------------- index
create index if not exists idx_cases_module    on test_cases(module);
create index if not exists idx_cases_review    on test_cases(review_status);
create index if not exists idx_cases_lifecycle on test_cases(lifecycle_status);
create index if not exists idx_cases_sprint    on test_cases(sprint);
create index if not exists idx_bugs_case       on bugs(linked_case_id);
create index if not exists idx_bugs_status     on bugs(status);
create index if not exists idx_runs_started    on test_runs(started_at desc);
create index if not exists idx_runs_sprint     on test_runs(sprint);
