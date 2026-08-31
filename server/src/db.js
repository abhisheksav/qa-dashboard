import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

pool.on('error', (err) => {
  // A dropped idle client shouldn't crash the process — the pool reconnects
  // the next query on its own.
  console.error('Unexpected Postgres pool error', err)
})
