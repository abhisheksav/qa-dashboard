import { Router } from 'express'
import { pool } from './db.js'
import { login, requireAuth } from './auth.js'
import {
  caseToRow,
  rowToCase,
  suiteToRow,
  rowToSuite,
  runToRow,
  rowToRun,
  bugToRow,
  rowToBug,
} from './mapping.js'

export const router = Router()

/* -------------------------------------------------------------------- auth */

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {}
  if (!email || !password) {
    return res.status(400).json({ error: 'bad-request', message: 'Email and password are required.' })
  }
  const result = await login(email, password)
  if (!result) {
    return res.status(401).json({ error: 'invalid-credentials', message: 'Invalid email or password.' })
  }
  res.json(result)
})

router.get('/auth/me', requireAuth, (req, res) => {
  res.json({ email: req.user.email, name: req.user.name })
})

/* ------------------------------------------------------------------ upsert */
// Generic "insert or update by primary key" builder — every table here has a
// text primary key and every row is a flat object of column -> value, so one
// function covers cases/suites/runs/bugs instead of four near-identical ones.

async function upsertRows(client, table, rows) {
  if (rows.length === 0) return
  const columns = Object.keys(rows[0])
  const updateSet = columns
    .filter((c) => c !== 'id')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ')

  for (const row of rows) {
    const values = columns.map((c) => row[c])
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
    await client.query(
      `insert into ${table} (${columns.join(', ')}) values (${placeholders})
       on conflict (id) do update set ${updateSet}`,
      values,
    )
  }
}

async function deleteRows(client, table, ids) {
  if (ids.length === 0) return
  await client.query(`delete from ${table} where id = any($1)`, [ids])
}

/* -------------------------------------------------------------- hydration */
// Full workspace, for the client to load on sign-in. Paginating isn't needed
// server-side the way it was against PostgREST's 1000-row cap — this is our
// own query, so it just selects everything.

router.get('/state', requireAuth, async (_req, res) => {
  const [suites, cases, runs, bugs, settingsRow, integrations] = await Promise.all([
    pool.query('select * from test_suites order by created_at'),
    pool.query('select * from test_cases order by created_at'),
    pool.query('select * from test_runs order by started_at desc'),
    pool.query('select * from bugs order by created_at desc'),
    pool.query("select data from app_settings where id = 'default'"),
    pool.query('select * from integrations'),
  ])

  res.json({
    suites: suites.rows.map(rowToSuite),
    testCases: cases.rows.map(rowToCase),
    runs: runs.rows.map(rowToRun),
    bugs: bugs.rows.map(rowToBug),
    settings: settingsRow.rows[0]?.data ?? null,
    integrations: integrations.rows.map((r) => ({
      id: r.id,
      enabled: r.enabled,
      settings: r.settings,
    })),
  })
})

/* ------------------------------------------------------------------- sync */
// One request per save, mirroring the client's diff — it already knows which
// rows changed, so it sends exactly those rather than the whole workspace.
// Wrapped in a transaction: a save either lands completely or not at all,
// never half-applied.

router.post('/sync', requireAuth, async (req, res) => {
  const body = req.body ?? {}
  const client = await pool.connect()

  try {
    await client.query('begin')

    if (body.suites?.upsert?.length) {
      await upsertRows(client, 'test_suites', body.suites.upsert.map(suiteToRow))
    }
    if (body.testCases?.upsert?.length) {
      await upsertRows(client, 'test_cases', body.testCases.upsert.map(caseToRow))
    }
    if (body.runs?.upsert?.length) {
      await upsertRows(client, 'test_runs', body.runs.upsert.map(runToRow))
    }
    if (body.bugs?.upsert?.length) {
      await upsertRows(client, 'bugs', body.bugs.upsert.map(bugToRow))
    }
    if (body.integrations?.upsert?.length) {
      await upsertRows(
        client,
        'integrations',
        body.integrations.upsert.map((i) => ({
          id: i.id,
          enabled: i.enabled,
          settings: JSON.stringify(i.settings ?? {}),
        })),
      )
    }
    if (body.settings) {
      await client.query(
        `insert into app_settings (id, data, updated_at) values ('default', $1, now())
         on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at`,
        [JSON.stringify(body.settings)],
      )
    }

    // Deletes run after upserts, matching the client's own ordering, so a case
    // moved between two edits in the same batch is never briefly absent from
    // both sides of the move.
    await deleteRows(client, 'test_suites', body.suites?.deleteIds ?? [])
    await deleteRows(client, 'test_cases', body.testCases?.deleteIds ?? [])
    await deleteRows(client, 'test_runs', body.runs?.deleteIds ?? [])
    await deleteRows(client, 'bugs', body.bugs?.deleteIds ?? [])

    await client.query('commit')
    res.json({ ok: true })
  } catch (err) {
    await client.query('rollback')
    console.error('sync failed', err)
    res.status(500).json({ error: 'sync-failed', message: err.message })
  } finally {
    client.release()
  }
})
