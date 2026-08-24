-- QA Test Execution Dashboard — Supabase schema
-- Apply with: supabase db push  (or run in the SQL editor)

create table if not exists test_suites (
  id text primary key,
  name text not null,
  description text default '',
  owner text default '',
  status text not null default 'Active',
  created_at timestamptz not null default now()
);

create table if not exists test_cases (
  id text primary key,
  title text not null,
  module text default '',
  priority text not null default 'Medium',
  preconditions text default '',
  steps jsonb not null default '[]',
  test_data text default '',
  expected_result text default '',
  actual_result text default '',
  status text not null default 'Not Executed',
  comments text default '',
  bug_ids text[] not null default '{}',
  sprint text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists suite_cases (
  suite_id text references test_suites(id) on delete cascade,
  case_id text references test_cases(id) on delete cascade,
  primary key (suite_id, case_id)
);

create table if not exists test_runs (
  id text primary key,
  suite_id text references test_suites(id),
  suite_name text not null,
  tester text default '',
  build text default '',
  environment text default '',
  sprint text default '',
  status text not null default 'In Progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  case_ids text[] not null default '{}'
);

create table if not exists case_results (
  run_id text references test_runs(id) on delete cascade,
  case_id text references test_cases(id),
  status text not null,
  actual_result text default '',
  comments text default '',
  bug_id text,
  executed_at timestamptz,
  duration_sec integer,
  primary key (run_id, case_id)
);

create table if not exists bugs (
  id text primary key,
  summary text not null,
  description text default '',
  severity text not null default 'Medium',
  priority text not null default 'Medium',
  status text not null default 'Open',
  linked_case_id text references test_cases(id),
  linked_run_id text references test_runs(id),
  assigned_to text default '',
  environment text default '',
  build text default '',
  screenshot_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_case_results_case on case_results(case_id);
create index if not exists idx_bugs_case on bugs(linked_case_id);
create index if not exists idx_runs_started on test_runs(started_at desc);
