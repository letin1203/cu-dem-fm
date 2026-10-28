# Football Management Application

A comprehensive Vue 3 TypeScript web application for managing football organizations, tournaments, teams, players, and statistics.

## 🚀 Features

- **Tournament Management**: Create and manage tournaments with different formats (league, knockout, group stage)
- **Match Management**: Schedule matches, record scores, track match events and history
- **Team Management**: Create teams, manage rosters, track team statistics
- **Player Management**: Maintain player profiles with detailed statistics
- **Statistics Dashboard**: Comprehensive charts and analytics for performance tracking
- **Responsive Design**: Modern, mobile-friendly interface

## 🛠️ Tech Stack

- **Frontend Framework**: Vue 3 with Composition API and TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: Vue Router 4 (lazy-loaded routes)
- **State Management**: Pinia
- **Icons**: Heroicons
- **Notifications**: vue-toastification
- **Excel export**: SheetJS (`xlsx`, loaded on demand)
- **Backend**: Express + Prisma + PostgreSQL
- **Auth**: JWT with per-user token versioning (logout revokes tokens)
- **Tests**: Vitest (backend domain logic)

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Navigation.vue   # Main navigation component
│   ├── tournament/      # Tournament modals and cards
│   └── ...
├── composables/         # Extracted stateful feature slices
│   ├── usePinnedPoll.ts
│   ├── useDeadmatches.ts
│   ├── useOldTournaments.ts
│   └── useTournamentCostEstimate.ts
├── views/               # Page components (lazy-loaded)
│   ├── WeeklyTournament.vue  # Main attendance/settlement screen
│   ├── Teams.vue        # Team management
│   ├── Players.vue      # Player management
│   ├── Tournaments.vue  # Tournament management
│   ├── Matches.vue      # Match management
│   └── Stats.vue        # Statistics and analytics
├── stores/              # Pinia stores for state management
├── types/               # TypeScript type definitions
├── api/client.ts        # Single Axios instance + endpoint helpers
└── router/              # Vue Router configuration

backend/src/
├── routes/
│   ├── tournaments.ts             # CRUD, teams, list/detail
│   ├── tournamentAttendance.ts    # Attendance + friend attendance
│   ├── tournamentSocial.ts        # Swap, challenge, invite, deadmatch
│   ├── tournamentSplit.ts         # Team-split preview + generation
│   └── tournamentSettlement.ts    # Scores + end tournament
├── services/
│   ├── teamGeneration.ts          # Balanced team algorithm (+ tests)
│   └── settlement.ts              # Pure settlement math (+ tests)
└── lib/                           # prisma, tournament rules, SQL guard
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v20.19.0 or higher)
- npm or yarn

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:5173`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Type-check (`vue-tsc`) and build for production
- `npm run preview` - Preview production build
- `npm run lint` - ESLint
- `npm run typecheck` - Type-check without building
- `npm test` - Run backend unit tests with Vitest

### Frontend environment

The API base URL is read from `VITE_API_BASE_URL` (see `.env.example`). It
defaults to `http://localhost:3001/api`, so no local `.env` is required unless
you point the app at a different backend.

## 📊 Features Overview

### Weekly Tournament (main screen)
- Attendance registration with 5-a-side / 7-a-side pitch choices
- Balanced team generation by tier, with GK protection
- Swap requests, challenges, deadmatches and friend invites
- End-of-tournament settlement: per-player cost, GK discount, water,
  betting, no-show penalty, and a full money-history audit trail

### Tournament Management
- Create tournaments with different formats (score / league)
- Track tournament status and progress
- Manage participating teams, soft delete and permanent delete

### Match Management
- Schedule matches between teams
- Record match results and events
- Filter matches by status (scheduled, live, completed)

### Team Management
- Create and edit team information
- View team statistics and performance
- Manage team rosters

### Player Management
- Maintain detailed player profiles
- Track individual statistics (goals, assists, cards, etc.)
- Assign players to teams, manage balances and top-up approvals

### Statistics & Analytics
- Performance metrics and trends
- Top scorers and team rankings

## 🎨 Design System

The application uses Tailwind CSS with a custom color palette:

- **Primary**: Lavender tones for main actions and branding
- **Secondary**: Soft pink accents
- **Success**: Green for positive actions and success states
- **Warning**: Yellow for cautionary information
- **Danger**: Red for destructive actions and errors

## 🔧 Development

### Code Guidelines

- Use Composition API with `<script setup>` syntax
- Implement proper TypeScript types for all data models
- Follow Vue 3 best practices and conventions
- Use Tailwind CSS utility classes for styling
- Implement responsive design principles

### State Management

The application uses Pinia for state management with separate stores for:
- Players
- Teams
- Tournaments
- Matches
- System settings
- Auth

Each store provides CRUD operations and computed properties for data manipulation.

### Backend

```bash
cd backend
npm install
npx prisma generate
npm run dev          # http://localhost:3001
```

Environment variables are documented in `backend/.env.example`. Notable ones:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Token signing key (required) |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | Login attempts per window (default 10) |
| `DATABASE_ADMIN_ALLOW_WRITES` | Allow non-SELECT queries in the DB admin page |
| `RUN_STARTUP_DATA_SYNC` | Run one-off roster/avatar repairs on boot |
| `SEED_ADMIN_PASSWORD` / `SEED_MOD_PASSWORD` / `SEED_USER_PASSWORD` | Seed script passwords |

## 🚀 Deployment

To build for production:

```bash
npm run build
```

The built files will be in the `dist` directory, ready for deployment to any static hosting service.
