<template>
  <nav class="bg-white shadow-lg">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <!-- Logo -->
        <div class="flex items-center">
          <router-link to="/weekly-tournament" class="flex items-center space-x-2">
            <svg class="h-6 w-6 sm:h-8 sm:w-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span class="text-lg sm:text-xl font-bold text-gray-900 hidden xs:block">Football Manager</span>
            <span class="text-lg font-bold text-gray-900 xs:hidden">FM</span>
          </router-link>
        </div>
        
        <!-- Desktop Navigation -->
        <div class="hidden md:flex items-center space-x-2 lg:space-x-6 xl:space-x-8">
          <router-link
            v-for="item in visibleNavigationItems"
            :key="item.name"
            :to="item.path"
            class="text-gray-600 hover:text-primary-600 px-2 lg:px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-1 whitespace-nowrap"
            :class="{ 'text-primary-600 bg-primary-50': $route.path === item.path }"
          >
            <component :is="item.icon" class="w-4 h-4 lg:w-5 lg:h-5 flex-shrink-0" />
            <span class="hidden lg:block">{{ item.name }}</span>
          </router-link>
          
          <!-- User Menu -->
          <div class="relative ml-3">
            <button
              @click="userMenuOpen = !userMenuOpen"
              class="flex items-center space-x-2 text-gray-600 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium"
            >
              <div class="h-6 w-6 rounded-full bg-primary-100 flex items-center justify-center">
                <span class="text-primary-600 font-medium text-xs">
                  {{ authStore.currentUser?.username.charAt(0).toUpperCase() }}
                </span>
              </div>
              <span class="hidden lg:block">{{ authStore.currentUser?.username }}</span>
              <span class="px-2 py-1 text-xs rounded-full" :class="getRoleClasses(authStore.currentUser?.role || 'user')">
                {{ authStore.currentUser?.role.toUpperCase() }}
              </span>
            </button>
            
            <!-- User Dropdown -->
            <div v-if="userMenuOpen" class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
              <div class="py-1">
                <div class="px-4 py-2 text-sm text-gray-700 border-b">
                  <div class="font-medium">{{ authStore.currentUser?.username }}</div>
                  <div class="text-xs text-gray-500">{{ authStore.currentUser?.email }}</div>
                </div>
                <router-link 
                  to="/my-profile" 
                  @click="userMenuOpen = false"
                  class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  My Player Profile
                </router-link>
                <button
                  @click="handleLogout"
                  :disabled="isLoggingOut"
                  class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  <span v-if="isLoggingOut">Signing out...</span>
                  <span v-else>Sign out</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Mobile menu button -->
        <div class="md:hidden flex items-center">
          <button
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="text-gray-600 hover:text-primary-600 p-2 rounded-md"
            :class="{ 'text-primary-600': mobileMenuOpen }"
          >
            <svg v-if="!mobileMenuOpen" class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg v-else class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile Navigation Menu -->
    <div v-if="mobileMenuOpen" class="md:hidden bg-white border-t border-gray-200">
      <div class="px-2 pt-2 pb-3 space-y-1">
        <router-link
          v-for="item in visibleNavigationItems"
          :key="item.name"
          :to="item.path"
          @click="mobileMenuOpen = false"
          class="text-gray-600 hover:text-primary-600 hover:bg-primary-50 flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium transition-colors"
          :class="{ 'text-primary-600 bg-primary-50': $route.path === item.path }"
        >
          <component :is="item.icon" class="w-5 h-5" />
          <span>{{ item.name }}</span>
        </router-link>
        
        <!-- Mobile User Info -->
        <div class="border-t pt-3 mt-3">
          <div class="px-3 py-2 text-sm">
            <div class="font-medium text-gray-900">{{ authStore.currentUser?.username }}</div>
            <div class="text-xs text-gray-500">{{ authStore.currentUser?.email }}</div>
            <span class="inline-block mt-1 px-2 py-1 text-xs rounded-full" :class="getRoleClasses(authStore.currentUser?.role || 'user')">
              {{ authStore.currentUser?.role.toUpperCase() }}
            </span>
          </div>
          <router-link 
            to="/my-profile" 
            @click="mobileMenuOpen = false"
            class="text-gray-600 hover:text-primary-600 hover:bg-primary-50 block px-3 py-2 rounded-md text-base font-medium transition-colors"
          >
            My Player Profile
          </router-link>
          <button
            @click="handleLogout"
            :disabled="isLoggingOut"
            class="w-full text-left text-gray-600 hover:text-primary-600 hover:bg-primary-50 block px-3 py-2 rounded-md text-base font-medium transition-colors disabled:opacity-50"
          >
            <span v-if="isLoggingOut">Signing out...</span>
            <span v-else>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { usePlayersStore } from '../stores/players'
import { 
  TrophyIcon,
  CalendarIcon,
  UserGroupIcon,
  UsersIcon,
  CogIcon,
  CircleStackIcon
} from '@heroicons/vue/24/outline'
import type { UserRole } from '../types'

const router = useRouter()
const authStore = useAuthStore()
const playersStore = usePlayersStore()

const mobileMenuOpen = ref(false)
const userMenuOpen = ref(false)

const navigationItems = [
  { name: 'Weekly Tour', path: '/weekly-tournament', icon: TrophyIcon, permission: 'canViewTournaments' },
  // { name: 'Tournaments', path: '/tournaments', icon: TrophyIcon, permission: 'canViewTournaments' },
  // { name: 'Matches', path: '/matches', icon: CalendarIcon, permission: 'canViewMatches' },
  { name: 'Teams', path: '/teams', icon: UserGroupIcon, permission: 'canViewTeams' },
  { name: 'Players', path: '/players', icon: UsersIcon, permission: 'canViewPlayers' },
  { name: 'Users', path: '/users', icon: CogIcon, permission: 'canManageUsers' },
  { name: 'Settings', path: '/system-settings', icon: CogIcon, role: 'admin' },
  { name: 'DB Admin', path: '/database-admin', icon: CircleStackIcon, role: 'admin' }
]

const visibleNavigationItems = computed(() => {
  return navigationItems.filter(item => {
    // Check for permission-based access
    if (item.permission) {
      return authStore.hasPermission(item.permission as any)
    }
    // Check for role-based access
    if (item.role) {
      return authStore.hasRole(item.role as any)
    }
    return true
  })
})

const linkedPlayer = computed(() => {
  if (!authStore.currentUser?.playerId) return null
  return playersStore.players.find(p => p.id === authStore.currentUser?.playerId)
})

function getRoleClasses(role: UserRole) {
  const classes = {
    admin: 'bg-red-100 text-red-800',
    mod: 'bg-yellow-100 text-yellow-800',
    user: 'bg-blue-100 text-blue-800'
  }
  return classes[role] || classes.user
}

const isLoggingOut = ref(false)

async function handleLogout() {
  if (isLoggingOut.value) return // Prevent multiple logout attempts
  
  try {
    isLoggingOut.value = true
    userMenuOpen.value = false
    mobileMenuOpen.value = false
    
    // Perform logout
    await authStore.logout()
    
    // Redirect to login page
    await router.push('/login')
  } catch (error) {
    console.error('Logout error:', error)
    // Ensure redirect happens even if logout fails
    await router.push('/login')
  } finally {
    isLoggingOut.value = false
  }
}
</script>
