import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Tournaments from '../views/Tournaments.vue'
import WeeklyTournament from '../views/WeeklyTournament.vue'
import Matches from '../views/Matches.vue'
import Players from '../views/Players.vue'
import Teams from '../views/Teams.vue'
import Users from '../views/Users.vue'
import PlayerProfile from '../views/PlayerProfile.vue'
import Login from '../components/Login.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: Login,
      meta: { requiresGuest: true }
    },
    {
      path: '/',
      redirect: '/weekly-tournament' // Redirect root to weekly tournament as default
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
    }
  ]
})

// Navigation guard
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  // Initialize auth from localStorage
  authStore.initializeAuth()

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresGuest = to.matched.some(record => record.meta.requiresGuest)
  const permission = to.meta.permission as string

  if (requiresGuest && authStore.isAuthenticated) {
    // If user is logged in and trying to access guest routes (like login), redirect to weekly tournament
    next('/weekly-tournament')
  } else if (requiresAuth && !authStore.isAuthenticated) {
    // If route requires auth and user is not logged in, redirect to login
    next('/login')
  } else if (permission && !authStore.hasPermission(permission as any)) {
    // If user doesn't have permission for this route, redirect to weekly tournament
    next('/weekly-tournament')
  } else {
    next()
  }
})

export default router
