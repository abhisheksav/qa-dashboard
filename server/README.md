# QA Dashboard backend — Postgres 16 + Express

A small standalone API in front of Postgres 16, so the dashboard's test cases,
suites, runs and bugs live in one shared database instead of each browser's
localStorage. No Supabase, no third-party hosting dependency — this runs
anywhere Docker (or Node + Postgres) runs.

## Quick start

From the **repo root** (not this folder):

```bash
cp .env.example .env          # sets VITE_API_URL for the frontend
echo "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")" > .env.docker

docker compose --env-file .env.docker up -d --build
```

That starts two containers:

- **postgres** — Postgres 16, with `schema.sql` applied automatically the
  first time (Postgres only runs init scripts when the data volume is empty)
- **api** — this Express app, on `http://localhost:4000`

Check it came up:

```bash
curl http://localhost:4000/health   # {"ok":true}
```

Create your first login — there is no public sign-up page, on purpose (see
*Security* below):

```bash
docker compose exec api node scripts/create-user.js you@example.com "a-real-password" "Your Name"
```

Then, from the repo root:

```bash
npm install
npm run dev
```

Sign in with the account you just created. First sign-in against an empty
database starts an empty workspace — there is nothing to migrate from,
unlike a browser that already had local data.

## Running without Docker

Point `DATABASE_URL` (see `.env.example` in this folder) at any Postgres 16
instance, apply the schema once, then run the API directly:

```bash
psql "$DATABASE_URL" -f schema.sql
cp .env.example .env    # fill in DATABASE_URL and JWT_SECRET
npm install
npm run create-user -- you@example.com "a-real-password" "Your Name"
npm start
```

## How syncing works

The frontend's Zustand store stays fully synchronous — no page or action had
to become async to support this. `src/services/remoteSync.ts` in the main app
sits beside it:

- **On sign-in**, `GET /api/state` pulls every table down and replaces the
  store's contents.
- **On every store change**, it diffs against the last snapshot and sends
  only the rows that actually changed to `POST /api/sync`, debounced 400ms.
  The server applies upserts and deletes inside one transaction, so a save
  either lands completely or not at all.

Sending only changed rows (rather than the whole workspace on every
keystroke) keeps payloads small and means two testers editing different
cases don't stomp on each other. **Conflict resolution is last-write-wins
per row** — there's no realtime push and no operational-transform merge, so
two people editing the *same* case at the same time means the later save
wins and the first person's browser doesn't know until it reloads. Fine for
a small team working on separate areas; adding a WebSocket broadcast on
successful sync would close that gap if it becomes a problem.

## API surface

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/auth/login` | — | `{ email, password }` → `{ token, user }` |
| `GET /api/auth/me` | Bearer | Confirms the token and returns the user |
| `GET /api/state` | Bearer | Full workspace hydrate |
| `POST /api/sync` | Bearer | `{ testCases, suites, runs, bugs, settings, integrations }`, each with `{ upsert: [...], deleteIds: [...] }` — pushes a diff |
| `GET /health` | — | `{ ok: true }` once the DB is reachable |

Tokens are JWTs signed with `JWT_SECRET`, sent as `Authorization: Bearer <token>`.

## Security

- **No public registration endpoint.** Accounts exist only if someone runs
  `create-user.js` on the server. This is a deliberate choice, not an
  oversight — a QA tool with unrestricted sign-up on the open internet is a
  bad idea. If you want self-service accounts later, that's a routes.js
  change plus a decision about who's allowed to invite whom.
- **`JWT_SECRET` is the whole security model for sessions.** Anyone who has
  it can mint a valid token for any user. Set a real random value (the
  quick-start command above generates one) — never ship the example value
  from `.env.example`.
- **Passwords are hashed with bcrypt** (`create-user.js`, cost factor 12),
  never stored or logged in plain text.
- **CORS is locked to `CORS_ORIGIN`.** Set it to the dashboard's actual
  deployed URL in production; the default `*`-friendly local setup is for
  dev only.
- Put this API **behind TLS** in production (a reverse proxy — nginx,
  Caddy, Traefik — terminating HTTPS in front of it is the usual shape).
  Nothing here does TLS itself.

## Known limitations

- **Bug screenshots are stored as base64 text in Postgres**, matching the
  client's `screenshotDataUrl` field as-is. That's simple and needs no
  second service, but it bloats the `bugs` table — fine for a QA team's
  volume of screenshots, worth moving to object storage (S3-compatible, or
  a `bytea` + a static file server) if that ever becomes a real size.
- **No database migrations tooling.** `schema.sql` is applied once, on first
  container start. A future schema change needs a manual `ALTER TABLE` (or
  adopt a migration tool — node-pg-migrate, Prisma Migrate, etc. — if the
  schema is going to keep evolving).
- **Single shared login pool, no per-module access control.** Anyone who can
  sign in can read and write everything, matching how the browser-only
  version always worked. The Product Owner mapping in Settings is
  informational, not enforced — see the app's own docs if you want to change
  that.
