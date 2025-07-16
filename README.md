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
- **Routing**: Vue Router 4
- **State Management**: Pinia
- **UI Components**: Headless UI Vue
- **Icons**: Heroicons
- **Charts**: Chart.js with vue-chartjs
- **Form Validation**: VeeValidate with Zod
- **Utilities**: VueUse

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Navigation.vue   # Main navigation component
│   └── StatsCard.vue    # Statistics display card
├── views/              # Page components
│   ├── Dashboard.vue    # Main dashboard view
│   ├── Teams.vue        # Team management
│   ├── Players.vue      # Player management
│   ├── Tournaments.vue  # Tournament management
│   ├── Matches.vue      # Match management
│   └── Statistics.vue   # Statistics and analytics
├── stores/             # Pinia stores for state management
│   ├── players.ts       # Player data management
│   ├── teams.ts         # Team data management
│   ├── tournaments.ts   # Tournament data management
│   └── matches.ts       # Match data management
├── types/              # TypeScript type definitions
│   └── index.ts         # Main type definitions
└── router/             # Vue Router configuration
    └── index.ts         # Route definitions
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
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## 📊 Features Overview

### Dashboard
- Overview statistics cards
- Recent matches and top scorers
- League table preview

### Tournament Management
- Create tournaments with different formats
- Track tournament status and progress
- Manage participating teams

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
- Assign players to teams

### Statistics & Analytics
- Interactive charts and graphs
- Performance metrics and trends
- Top scorers and team rankings

## 🎨 Design System

The application uses Tailwind CSS with a custom color palette:

- **Primary**: Blue tones for main actions and branding
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

Each store provides CRUD operations and computed properties for data manipulation.

## 🚀 Deployment

To build for production:

```bash
npm run build
```

The built files will be in the `dist` directory, ready for deployment to any static hosting service.
