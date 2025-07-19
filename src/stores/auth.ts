import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, UserRole, LoginCredentials, AuthState, Permission } from '../types'
import { apiClient } from '../api/client'

export const useAuthStore = defineStore('auth', () => {
  // Restore currentUser from localStorage if available
  const storedUser = localStorage.getItem('current_user')
  const currentUser = ref<User | null>(storedUser ? JSON.parse(storedUser) : null)
  const token = ref<string | null>(localStorage.getItem('auth_token'))
  const isLoading = ref(false)
  const users = ref<User[]>([])

  // Only true if both token and currentUser are valid
  const isAuthenticated = computed(() => {
    return token.value !== null && currentUser.value !== null
  })
  
  const authState = computed((): AuthState => ({
    user: currentUser.value,
    isAuthenticated: isAuthenticated.value,
    isLoading: isLoading.value
  }))

  const userPermissions = computed((): Permission => {
    const role = currentUser.value?.role
    
    switch (role) {
      case 'admin':
        return {
          canViewPlayers: true,
          canEditPlayers: true,
          canDeletePlayers: true,
          canViewTeams: true,
          canEditTeams: true,
          canDeleteTeams: true,
          canViewTournaments: true,
          canEditTournaments: true,
          canDeleteTournaments: true,
          canViewMatches: true,
          canEditMatches: true,
          canDeleteMatches: true,
          canManageUsers: true
        }
      case 'mod':
        return {
          canViewPlayers: true,
          canEditPlayers: true,
          canDeletePlayers: false,
          canViewTeams: true,
          canEditTeams: true,
          canDeleteTeams: false,
          canViewTournaments: true,
          canEditTournaments: true,
          canDeleteTournaments: false,
          canViewMatches: true,
          canEditMatches: true,
          canDeleteMatches: false,
          canManageUsers: false
        }
      case 'user':
      default:
        return {
          canViewPlayers: true,
          canEditPlayers: false,
          canDeletePlayers: false,
          canViewTeams: true,
          canEditTeams: false,
          canDeleteTeams: false,
          canViewTournaments: true,
          canEditTournaments: false,
          canDeleteTournaments: false,
          canViewMatches: true,
          canEditMatches: false,
          canDeleteMatches: false,
          canManageUsers: false
        }
    }
  })

  async function login(credentials: LoginCredentials): Promise<boolean> {
    isLoading.value = true
    try {
      const response = await apiClient.login(credentials)
      if (response && response.success && response.data) {
        const data = response.data as any
        currentUser.value = {
          ...data.user,
          role: data.user.role.toLowerCase()
        }
        localStorage.setItem('current_user', JSON.stringify(currentUser.value))
        token.value = data.token
        localStorage.setItem('auth_token', data.token)
        return true
      }
      return false
    } catch (error) {
      console.error('Login failed:', error)
      return false
    } finally {
      isLoading.value = false
    }
  }

  function forceLogout(): void {
    currentUser.value = null
    token.value = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('current_user')
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
  }

  async function logout(shouldRedirect = false): Promise<void> {
    try {
      if (token.value) {
        await apiClient.logout()
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      currentUser.value = null
      token.value = null
      localStorage.removeItem('auth_token')
      localStorage.removeItem('current_user')
      if (shouldRedirect && typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
  }

  async function getCurrentUser(): Promise<void> {
    if (!token.value) {
      currentUser.value = null
      localStorage.removeItem('current_user')
      return
    }

    try {
      const response = await apiClient.getCurrentUser()
      if (response.success && response.data) {
        const userData = response.data as User
        currentUser.value = {
          ...userData,
          role: userData.role.toLowerCase() as UserRole
        }
        localStorage.setItem('current_user', JSON.stringify(currentUser.value))
      } else {
        token.value = null
        currentUser.value = null
        localStorage.removeItem('auth_token')
        localStorage.removeItem('current_user')
      }
    } catch (error) {
      console.error('Failed to get current user:', error)
      token.value = null
      currentUser.value = null
      localStorage.removeItem('auth_token')
      localStorage.removeItem('current_user')
    }
  }

  async function fetchUsers(): Promise<void> {
    if (!userPermissions.value.canManageUsers) {
      console.log('User does not have permission to manage users')
      return
    }
    
    try {
      console.log('Fetching users from API...')
      // Fetch up to 100 users (system max)
      const response = await apiClient.getUsers({ limit: 100 })
      console.log('API response:', response)
      
      if (response.success && response.data) {
        const data = response.data as any
        console.log('Raw users data:', data)
        
        // Convert all user roles to lowercase for frontend compatibility
        users.value = (data.users || []).map((user: any) => ({
          ...user,
          role: user.role.toLowerCase()
        }))
        
        console.log('Processed users:', users.value)
      } else {
        console.log('API response was not successful:', response)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  async function addUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<boolean> {
    try {
      // Convert role to uppercase for backend compatibility
      const backendUserData = {
        ...userData,
        role: userData.role.toUpperCase()
      }
      const response = await apiClient.post<User>('/users', backendUserData)
      if (response.success && response.data) {
        // Convert role to lowercase for frontend compatibility
        const newUser = {
          ...response.data,
          role: response.data.role.toLowerCase() as UserRole
        }
        users.value.push(newUser)
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to add user:', error)
      return false
    }
  }

  async function updateUser(id: string, userData: Partial<User>): Promise<boolean> {
    try {
      // Convert role to uppercase for backend compatibility if role is being updated
      const backendUserData = userData.role ? {
        ...userData,
        role: userData.role.toUpperCase()
      } : userData
      
      const response = await apiClient.updateUser(id, backendUserData)
      if (response.success && response.data) {
        const updatedUser = response.data as User
        // Convert role to lowercase for frontend compatibility
        const normalizedUser = {
          ...updatedUser,
          role: updatedUser.role.toLowerCase() as UserRole
        }
        // Update local state
        const index = users.value.findIndex(u => u.id === id)
        if (index !== -1) {
          users.value[index] = { ...users.value[index], ...normalizedUser }
        }
        // Update current user if it's the same user
        if (currentUser.value?.id === id) {
          currentUser.value = { ...currentUser.value, ...normalizedUser }
        }
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to update user:', error)
      return false
    }
  }

  async function deleteUser(id: string): Promise<boolean> {
    try {
      const response = await apiClient.deleteUser(id)
      if (response.success) {
        users.value = users.value.filter(user => user.id !== id)
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to delete user:', error)
      return false
    }
  }

  async function createBulkUserPlayer(): Promise<boolean> {
    try {
      const response = await apiClient.createBulkUserPlayer()
      if (response.success && response.data) {
        // Convert role to lowercase for frontend compatibility
        const responseData = response.data as any
        const newUser = {
          ...responseData.user,
          role: responseData.user.role.toLowerCase() as UserRole
        }
        users.value.push(newUser)
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to create bulk user+player:', error)
      return false
    }
  }

  async function updateUserStatus(id: string, isActive: boolean): Promise<boolean> {
    try {
      const response = await apiClient.updateUserStatus(id, isActive)
      if (response.success && response.data) {
        const userIndex = users.value.findIndex(user => user.id === id)
        if (userIndex !== -1) {
          users.value[userIndex] = {
            ...users.value[userIndex],
            isActive
          }
        }
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to update user status:', error)
      return false
    }
  }

  function hasPermission(permission: keyof Permission): boolean {
    return userPermissions.value[permission]
  }

  function hasRole(role: UserRole): boolean {
    return currentUser.value?.role === role
  }

  function hasAnyRole(roles: UserRole[]): boolean {
    return roles.some(role => hasRole(role))
  }

  // Initialize auth state from stored token
  async function initializeAuth() {
    const storedToken = localStorage.getItem('auth_token')
    if (storedToken) {
      token.value = storedToken
      try {
        await getCurrentUser()
      } catch (err) {
        token.value = null
        currentUser.value = null
        localStorage.removeItem('auth_token')
      }
    }
  }

  // Force clear cached data and re-authenticate
  async function clearAndReauthenticate() {
    currentUser.value = null
    token.value = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('current_user')
    const storedToken = localStorage.getItem('auth_token')
    if (storedToken) {
      token.value = storedToken
      await getCurrentUser()
    }
  }

  // Do not initialize auth state on store creation. Only initialize once in main.ts.

  return {
    // State
    currentUser,
    token,
    isLoading,
    users,

    // Getters
    isAuthenticated,
    authState,
    userPermissions,

    // Actions
    login,
    logout,
    forceLogout,
    getCurrentUser,
    fetchUsers,
    addUser,
    updateUser,
    deleteUser,
    createBulkUserPlayer,
    updateUserStatus,
    initializeAuth,
    clearAndReauthenticate,
    hasPermission,
    hasRole,
    hasAnyRole
  }
})
