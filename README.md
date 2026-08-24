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

### 4. Push the database schema

```bash
pnpm db:push
```

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

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@dosewise.com | admin123 |
| Pharmacy 1 | user1@test.com | user123 |
| Pharmacy 2 | user2@test.com | user123 |
| Pharmacy 3 | user3@test.com | user123 |

Admin login is at: http://localhost:5173/admin

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start both frontend and backend in dev mode |
| `pnpm build` | Build both for production |
| `pnpm seed` | Seed database with test data |
| `pnpm db:push` | Push schema changes to the database |
| `pnpm migrate` | Run idempotent migrations |

## Stack

- **Frontend**: React 19 + Vite + Tailwind CSS + Wouter
- **Backend**: Express 5 + Drizzle ORM + PostgreSQL
- **Auth**: Session-based (express-session + bcryptjs)
