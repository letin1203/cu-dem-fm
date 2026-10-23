<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Football Management Application Instructions

This is a Vue 3 TypeScript application for managing football organizations with the following key features:

## Tech Stack
- Vue 3 with Composition API and TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Vue Router for navigation (lazy-loaded routes)
- Pinia for state management
- vue-toastification for notifications
- SheetJS (`xlsx`) for Excel export, imported on demand
- Express + Prisma + PostgreSQL backend in `backend/`

## Project Structure
- Use Composition API with `<script setup>` syntax
- Implement proper TypeScript types for all data models
- Use Pinia stores for global state management
- Follow Vue 3 best practices and conventions
- Use Tailwind CSS utility classes for styling
- Implement responsive design principles

## Key Features
1. **Weekly Tournament**: attendance, team splitting, settlement (main screen)
2. **Tournament Management**: create, edit, soft/permanent delete
3. **Match Management**: schedule matches, record scores, track history
4. **Player Management**: profiles, statistics, balances, top-up approvals
5. **Team Management**: team creation, rosters, statistics
6. **Statistics**: leaderboards and performance metrics
7. **Authentication**: JWT with per-user token versioning

## Code Guidelines
- Use TypeScript interfaces for all data models
- Implement proper error handling and loading states
- Use Vue 3 reactivity system effectively
- Follow component composition patterns
- Implement proper form validation
- Use semantic HTML and accessibility best practices
