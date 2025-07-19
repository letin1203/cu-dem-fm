import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Tournaments from '../views/Tournaments.vue'
import WeeklyTournament from '../views/WeeklyTournament.vue'
// ...existing code...
import Matches from '../views/Matches.vue'
import Players from '../views/Players.vue'
import Teams from '../views/Teams.vue'
import Users from '../views/Users.vue'
import PlayerProfile from '../views/PlayerProfile.vue'
import SystemSettings from '../views/SystemSettings.vue'
import DatabaseAdmin from '../views/DatabaseAdmin.vue'
import Login from '../components/Login.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/weekly-tournament'
    },
    {
      path: '/login',
      name: 'login',
      component: Login,
      meta: { requiresGuest: true }
    },
    {
      path: '/matches',
      name: 'matches',
      component: Matches,
      meta: { requiresAuth: true, permission: 'canViewMatches' }
    },
    {
      path: '/tournaments',
      name: 'tournaments',
      component: Tournaments,
      meta: { requiresAuth: true, permission: 'canViewTournaments' }
    },
    {
      path: '/weekly-tournament',
      name: 'weeklyTournament',
      component: WeeklyTournament,
      meta: { requiresAuth: true, permission: 'canViewTournaments' }
    },
    {
      path: '/players',
      name: 'players',
      component: Players,
      meta: { requiresAuth: true, permission: 'canViewPlayers' }
    },
    {
      path: '/my-profile',
      name: 'playerProfile',
      component: PlayerProfile,
      meta: { requiresAuth: true }
    },
    {
      path: '/teams',
      name: 'teams',
      component: Teams,
      meta: { requiresAuth: true, permission: 'canViewTeams' }
    },
    {
      path: '/users',
      name: 'users',
      component: Users,
      meta: { requiresAuth: true, permission: 'canManageUsers' }
    },
    {
      path: '/system-settings',
      name: 'systemSettings',
      component: SystemSettings,
      meta: { requiresAuth: true, role: 'admin' }
    },
    {
      path: '/database-admin',
      name: 'databaseAdmin',
      component: DatabaseAdmin,
      meta: { requiresAuth: true, role: 'admin' }
    }
  ]
})

// Navigation guard
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresGuest = to.matched.some(record => record.meta.requiresGuest)

  if (requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if (requiresGuest && authStore.isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
