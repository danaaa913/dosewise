# DoseWise — Standalone

B2B pharmacy medicine exchange platform for Jordan-based pharmacies.

## Requirements

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- PostgreSQL 14+ (local or remote)

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your `DATABASE_URL` and `SESSION_SECRET`.

### 3. Create the database

In PostgreSQL:
```sql
CREATE DATABASE dosewise;
```

### 4. Apply database migrations (source of truth)

```bash
pnpm migrate
```

Versioned Drizzle migrations in `backend/drizzle/` are the single source of truth for the database schema. They create all tables, enums, indexes and foreign keys from scratch. Each applied migration is recorded in the `__drizzle_migrations` tracker table inside the auto-created `drizzle` schema (`drizzle.__drizzle_migrations`); PostgreSQL-only, this is Drizzle's default. Migrations are journal-driven (versioned), not idempotent: do not mix manual schema edits or `db:push` with the migration history on the same database.

### 5. Seed with test data

```bash
pnpm seed
```

### 6. Start the app

```bash
pnpm dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8080

## Test Credentials

Pharmacy accounts below are seeded by `pnpm seed` (development data only):

| Role | Email | Password |
|------|-------|----------|
| Admin | set via `ADMIN_EMAIL` in `.env` | set via `ADMIN_PASSWORD` |
| Pharmacy 1 | user1@test.com | user123 |
| Pharmacy 2 | user2@test.com | user123 |
| Pharmacy 3 | user3@test.com | user123 |

The administrator account is **not** hardcoded. It is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` environment variables at startup and its password hash is refreshed by `pnpm seed`. The server refuses to start if required secrets are missing.

Admin login is at: http://localhost:5173/admin

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start both frontend and backend in dev mode |
| `pnpm build` | Build both for production |
| `pnpm seed` | Seed database with test data |
| `pnpm db:push` | Development shortcut — push schema from code directly (not the migration path; avoid once migrations are applied) |
| `pnpm migrate` | Apply versioned Drizzle migrations (source of truth; tracked in `drizzle.__drizzle_migrations`) |

## Stack

- **Frontend**: React 19 + Vite + Tailwind CSS + Wouter
- **Backend**: Express 5 + Drizzle ORM + PostgreSQL
- **Auth**: Session-based (express-session + bcryptjs)
