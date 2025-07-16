import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, UserRole, LoginCredentials, AuthState, Permission } from '../types'
import { apiClient } from '../api/client'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('auth_token'))
  const isLoading = ref(false)
  const users = ref<User[]>([]) // This will be populated from API

  const isAuthenticated = computed(() => currentUser.value !== null && token.value !== null)
  
  const authState = computed((): AuthState => ({
    user: currentUser.value,
    isAuthenticated: isAuthenticated.value,
    isLoading: isLoading.value
  }))

  const permissions = computed((): Permission => {
    if (!currentUser.value) {
      return {
        canViewDashboard: false,
        canViewPlayers: false,
        canEditPlayers: false,
        canViewTeams: false,
        canEditTeams: false,
        canViewTournaments: false,
        canEditTournaments: false,
        canViewMatches: false,
        canEditMatches: false,
        canViewStatistics: false,
        canManageUsers: false
      }
    }

    const role = currentUser.value.role

    switch (role) {
      case 'admin':
        return {
          canViewDashboard: true,
          canViewPlayers: true,
          canEditPlayers: true,
          canViewTeams: true,
          canEditTeams: true,
          canViewTournaments: true,
          canEditTournaments: true,
          canViewMatches: true,
          canEditMatches: true,
          canViewStatistics: true,
          canManageUsers: true
        }
      case 'mod':
        return {
          canViewDashboard: true,
          canViewPlayers: true,
          canEditPlayers: false,
          canViewTeams: true,
          canEditTeams: false,
          canViewTournaments: true,
          canEditTournaments: false,
          canViewMatches: true,
          canEditMatches: true,
          canViewStatistics: true,
          canManageUsers: false
        }
      case 'user':
      default:
        return {
          canViewDashboard: true,
          canViewPlayers: true,
          canEditPlayers: false,
          canViewTeams: true,
          canEditTeams: false,
          canViewTournaments: true,
          canEditTournaments: false,
          canViewMatches: true,
          canEditMatches: false,
          canViewStatistics: true,
          canManageUsers: false
        }
    }
  })

  async function login(credentials: LoginCredentials): Promise<boolean> {
    isLoading.value = true
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const user = users.value.find(
        u => u.username === credentials.username && 
        u.password === credentials.password && 
        u.isActive
      )
      
      if (user) {
        currentUser.value = { ...user }
        currentUser.value.lastLogin = new Date()
        
        // Store in localStorage for persistence
        localStorage.setItem('auth_user', JSON.stringify(currentUser.value))
        
        return true
      }
      
      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    } finally {
      isLoading.value = false
    }
  }

  function logout() {
    currentUser.value = null
    localStorage.removeItem('auth_user')
  }

  function initializeAuth() {
    const storedUser = localStorage.getItem('auth_user')
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        // Verify user still exists and is active
        const validUser = users.value.find(u => u.id === user.id && u.isActive)
        if (validUser) {
          currentUser.value = user
        } else {
          localStorage.removeItem('auth_user')
        }
      } catch (error) {
        console.error('Error parsing stored user:', error)
        localStorage.removeItem('auth_user')
      }
    }
  }

  function hasPermission(permission: keyof Permission): boolean {
    return permissions.value[permission]
  }

  function isRole(role: UserRole): boolean {
    return currentUser.value?.role === role
  }

  function addUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) {
    const newUser: User = {
      ...user,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    }
    users.value.push(newUser)
    return newUser
  }

  function updateUser(id: string, updates: Partial<User>) {
    const index = users.value.findIndex(u => u.id === id)
    if (index !== -1) {
      users.value[index] = {
        ...users.value[index],
        ...updates,
        updatedAt: new Date()
      }
    }
  }

  function deleteUser(id: string) {
    const index = users.value.findIndex(u => u.id === id)
    if (index !== -1) {
      users.value.splice(index, 1)
    }
  }

  return {
    users: computed(() => users.value),
    currentUser: computed(() => currentUser.value),
    isAuthenticated,
    isLoading: computed(() => isLoading.value),
    authState,
    permissions,
    login,
    logout,
    initializeAuth,
    hasPermission,
    isRole,
    addUser,
    updateUser,
    deleteUser
  }
})
