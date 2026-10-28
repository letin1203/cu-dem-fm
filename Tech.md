# 🏈 Cu Dem FM - Tech Stack Summary

## 🎨 **Frontend (FE)**

### **Core Framework**
- **Vue 3** `v3.5.x` - Progressive JavaScript framework with Composition API
- **TypeScript** `v5.8.x` - Type-safe JavaScript development
- **Vite** `v7.x` - Fast build tool and dev server

### **UI & Styling**
- **Tailwind CSS** `v3.4.x` - Utility-first CSS framework
- **Heroicons Vue** `v2.2.x` - Hand-crafted SVG icons
- **PostCSS** `v8.5.x` - CSS processing tool
- **Autoprefixer** - CSS vendor prefixing

### **State Management & Routing**
- **Pinia** `v3.0.x` - Vue store library
- **Vue Router** `v4.5.x` - Official router for Vue.js (lazy-loaded views)

### **Data Visualization & UX**
- **Vue Toastification** `v2.0.0-rc.5` - Toast notifications
- **SheetJS (`xlsx`)** - Excel export, imported on demand

### **HTTP Client**
- **Axios** `v1.20.x` - Promise-based HTTP client

> Chart.js, VeeValidate, Headless UI and VueUse are **not** dependencies.
> Statistics are rendered with plain Tailwind markup, and forms use native
> validation. Add a library only when a feature actually needs it.

---

## ⚙️ **Backend (BE)**

### **Runtime & Framework**
- **Node.js** 20.17.0 (see `.nvmrc`)
- **Express.js** `v4.18.x` - Web application framework
- **TypeScript** `v5.3.x` - Type-safe development
- **TSX** - TypeScript execution for development
- **Vitest** - Unit tests for pure domain logic

### **Database & ORM**
- **Prisma** `v5.7.x` - Modern database toolkit and ORM
- **Prisma Client** - Type-safe database client

### **Authentication & Security**
- **JWT** `v9.0.x` - JSON Web Tokens with per-user token versioning
- **bcryptjs** `v2.4.x` - Password hashing
- **Helmet** `v7.1.x` - Security middleware
- **CORS** `v2.8.x` - Cross-origin resource sharing
- **Express Rate Limit** `v7.1.x` - Rate limiting middleware

### **Validation**
- **Zod** `v3.22.x` - Request schema validation (backend only)

---

## 🗄️ **Database (DB)**

- **PostgreSQL** (Supabase in production)
- **Prisma Schema** + 40+ versioned migrations in `backend/prisma/migrations`
- `CUID` primary keys, `createdAt`/`updatedAt` timestamps, foreign keys with
  explicit `onDelete` behaviour
- Money is stored as integer VND (`Int`), never float
- Soft delete for tournaments (`status = 'DELETED'` + `deletedReason`)

---

## 🏗️ **Architecture Patterns**

### **Frontend**
- Composition API with `<script setup>`
- Route-level code splitting
- Pinia stores for shared state (`auth`, `players`, `teams`, `tournaments`,
  `matches`, `system`)
- `src/composables/` for stateful feature slices extracted out of large views
  (`usePinnedPoll`, `useDeadmatches`, `useOldTournaments`,
  `useTournamentCostEstimate`)
- One Axios instance in `src/api/client.ts`; the base URL comes from
  `VITE_API_BASE_URL`

### **Backend**
- RESTful API under `/api`
- Express middleware stack: helmet → cors → compression → morgan → rate limit
  → body parsing → routes → error handler
- `authenticate` / `authorize(roles)` guards on every non-public route
- Pure domain logic in `src/services/` (`teamGeneration.ts`, `settlement.ts`)
  so it can be unit tested without a database
- Shared route helpers in `src/lib/` (`tournamentRules.ts`, `adminSql.ts`)

---

## 📦 **Project Structure**

```
cu-dem-fm/
├── src/                       # Vue 3 frontend
│   ├── api/client.ts          # Single Axios instance + endpoint helpers
│   ├── components/            # Reusable UI (incl. tournament/ modals)
│   ├── composables/           # Extracted stateful feature slices
│   ├── router/index.ts        # Lazy-loaded routes + permission guard
│   ├── stores/                # Pinia stores
│   ├── types/index.ts         # Shared frontend types
│   └── views/                 # Page components
└── backend/
    ├── prisma/
    │   ├── schema.prisma
    │   └── migrations/
    └── src/
        ├── index.ts           # Express app + route mounting
        ├── lib/               # Shared helpers (prisma, rules, SQL guard)
        ├── middleware/        # auth, error handling
        ├── routes/            # Endpoint modules
        │   ├── tournaments.ts             # CRUD, teams, list/detail
        │   ├── tournamentAttendance.ts    # Attendance + friend attendance
        │   ├── tournamentSocial.ts        # Swap, challenge, invite, deadmatch
        │   ├── tournamentSplit.ts         # Preview + generate teams
        │   └── tournamentSettlement.ts    # Scores + end tournament
        ├── schemas/           # Zod validation
        ├── scripts/           # Seed and one-off scripts
        └── services/          # Pure domain logic (+ *.test.ts)
```

---

## 🧪 **Tests**

```bash
cd backend
npm test        # vitest run
npm run test:watch
```

Covered: settlement math (cost per player, GK discount, bets, water,
deadmatch/battle stakes, league standings) and team generation invariants
(GK pairing, Tier 1–2 spread, battle separation, friend invites, no input
mutation).

The frontend build is type-checked by `vue-tsc` in `npm run build`, and ESLint
runs in CI.

---

## 🚀 **Deployment**

- **Frontend**: Vercel (`vercel.json`); `VITE_API_BASE_URL` is supplied by the
  Vercel project env or the `deploy.yml` secret, never hardcoded.
- **Backend**: Render; `CORS_ORIGIN` must list each allowed frontend origin
  (comma separated).
- **Database**: Supabase PostgreSQL via `DATABASE_URL`.

Required backend env vars: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (or
`FRONTEND_URL`), `NODE_ENV=production`, `PORT`.

Optional: `RATE_LIMIT_*`, `AUTH_RATE_LIMIT_*`, `DATABASE_ADMIN_ALLOW_WRITES`
(keep `false` in production), `RUN_STARTUP_DATA_SYNC` (keep `false`).
