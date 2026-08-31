import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { router } from './routes.js'
import { pool } from './db.js'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set — copy .env.example to .env and fill it in.')
  process.exit(1)
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-to-a-long-random-string') {
  console.warn(
    'WARNING: JWT_SECRET is unset or still the example value. Sessions are only as safe as this secret — set a real one before anyone but you uses this.',
  )
}

const app = express()
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
// Bug screenshots ride along as base64 inside the sync payload, so the JSON
// limit needs real headroom — a few embedded images add up fast.
app.use(express.json({ limit: '25mb' }))

app.get('/health', async (_req, res) => {
  try {
    await pool.query('select 1')
    res.json({ ok: true })
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message })
  }
})

app.use('/api', router)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'internal', message: 'Something went wrong.' })
})

const port = Number(process.env.PORT) || 4000
app.listen(port, () => {
  console.log(`QA dashboard API listening on :${port}`)
})
