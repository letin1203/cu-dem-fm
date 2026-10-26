import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import type { Permission } from '../types'

// Views are lazy-loaded so the initial bundle stays small; WeeklyTournament
// alone is several hundred KB.
const Tournaments = () => import('../views/Tournaments.vue')
const WeeklyTournament = () => import('../views/WeeklyTournament.vue')
const Matches = () => import('../views/Matches.vue')
const Players = () => import('../views/Players.vue')
const Teams = () => import('../views/Teams.vue')
const Users = () => import('../views/Users.vue')
const PlayerProfile = () => import('../views/PlayerProfile.vue')
const SystemSettings = () => import('../views/SystemSettings.vue')
const DatabaseAdmin = () => import('../views/DatabaseAdmin.vue')
const MoneyTopUpApprovals = () => import('../views/MoneyTopUpApprovals.vue')
const Login = () => import('../components/Login.vue')
const ResetPassword = () => import('../components/ResetPassword.vue')
const Stats = () => import('../views/Stats.vue')
const TeamSplitTest = () => import('../views/TeamSplitTest.vue')

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
      path: '/reset-password',
      name: 'resetPassword',
      component: ResetPassword,
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
      path: '/stats',
      name: 'stats',
      component: Stats,
      meta: { requiresAuth: true, permission: 'canViewPlayers' }
    },
    { path: '/test-chia-team', name: 'teamSplitTest', component: TeamSplitTest, meta: { requiresAuth: true, allowGuest: true } },
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
    },
    {
      path: '/duyet-nap-tien',
      name: 'moneyTopUpApprovals',
      component: MoneyTopUpApprovals,
      meta: { requiresAuth: true, roles: ['admin', 'mod'] }
    }
  ]
})

// Navigation guard
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  // A reset link must always open as a guest, even when another account was remembered.
  if (to.name === 'resetPassword') {
    authStore.clearSession()
    next()
    return
  }
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresGuest = to.matched.some(record => record.meta.requiresGuest)
  // Guests are normally confined to the weekly tournament screen; a route can
  // opt in with meta.allowGuest when it is safe for them to open.
  const allowGuest = to.matched.some(record => record.meta.allowGuest)

  if (requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if (authStore.currentUser?.role === 'guest' && !allowGuest && to.path !== '/weekly-tournament') {
    next('/weekly-tournament')
  } else if (requiresGuest && authStore.isAuthenticated) {
    next('/')
  } else if (to.meta.roles && !(to.meta.roles as string[]).includes(authStore.currentUser?.role || '')) {
    next('/')
  } else if (to.meta.role && to.meta.role !== authStore.currentUser?.role) {
    next('/')
  } else if (to.meta.permission && !authStore.hasPermission(to.meta.permission as keyof Permission)) {
    next('/')
  } else {
    next()
  }
})

export default router
