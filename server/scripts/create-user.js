#!/usr/bin/env node
// Creates (or updates the password for) a login. Run on the server, not
// exposed as an API endpoint — there is no public sign-up, so "who has an
// account" is always an explicit decision, not whoever finds the URL first.
//
// Usage: node scripts/create-user.js <email> <password> <name>
//    or: npm run create-user -- <email> <password> "<name>"

import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { pool } from '../src/db.js'

const [, , email, password, ...nameParts] = process.argv
const name = nameParts.join(' ')

if (!email || !password || !name) {
  console.error('Usage: node scripts/create-user.js <email> <password> <name>')
  process.exit(1)
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.')
  process.exit(1)
}

const hash = await bcrypt.hash(password, 12)

await pool.query(
  `insert into users (email, password_hash, name)
   values ($1, $2, $3)
   on conflict (email) do update set password_hash = excluded.password_hash, name = excluded.name`,
  [email.trim().toLowerCase(), hash, name],
)

console.log(`OK: ${email} is ready to sign in.`)
await pool.end()
