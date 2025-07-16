<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">User Management</h1>
      <button @click="showAddForm = true" class="btn-primary w-full sm:w-auto">
        Add New User
      </button>
    </div>

    <!-- Users Cards -->
    <div class="card p-0 sm:p-6 overflow-hidden">
      <!-- Loading State -->
      <div v-if="isLoading" class="p-8 text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p class="mt-2 text-gray-600">Loading users...</p>
      </div>
      
      <!-- Error State -->
      <div v-else-if="error" class="p-8 text-center">
        <div class="text-red-600 mb-2">⚠️ Error</div>
        <p class="text-gray-600">{{ error }}</p>
        <button @click="onMounted" class="mt-2 btn-primary">Retry</button>
      </div>
      
      <!-- Empty State -->
      <div v-else-if="users.length === 0" class="p-8 text-center">
        <div class="text-gray-400 mb-2">👥 No users found</div>
        <p class="text-gray-600">No users are currently registered in the system.</p>
        <button @click="showAddForm = true" class="mt-2 btn-primary">Add First User</button>
      </div>
      
      <!-- Users Grid -->
      <div v-else class="p-4 sm:p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div 
            v-for="user in users" 
            :key="user.id" 
            class="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 hover:shadow-lg transition-shadow"
          >
            <!-- User Header -->
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center space-x-3">
                <div class="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
                  <span class="text-primary-600 font-semibold text-lg">
                    {{ user.username.charAt(0).toUpperCase() }}
                  </span>
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900">{{ user.username }}</h3>
                  <p class="text-sm text-gray-500">{{ user.email }}</p>
                </div>
              </div>
              
              <!-- Status Badge -->
              <span 
                :class="user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'" 
                class="px-2 py-1 text-xs font-medium rounded-full"
              >
                {{ user.isActive ? 'Active' : 'Inactive' }}
              </span>
            </div>
            
            <!-- User Details -->
            <div class="space-y-3">
              <!-- Role -->
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-500">Role:</span>
                <span :class="getRoleClasses(user.role)" class="px-2 py-1 text-xs font-medium rounded-full">
                  {{ user.role.toUpperCase() }}
                </span>
              </div>
              
              <!-- Linked Player -->
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-500">Player:</span>
                <div class="text-right">
                  <div class="text-sm font-medium text-gray-900">
                    {{ getLinkedPlayerDisplay(user) }}
                  </div>
                  <div v-if="user.player" class="text-xs text-gray-500">
                    {{ getLinkedPlayerPosition(user) }}
                  </div>
                </div>
              </div>
              
              <!-- Last Login -->
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-500">Last Login:</span>
                <span class="text-sm text-gray-900">{{ formatDate(user.lastLogin) }}</span>
              </div>
            </div>
            
            <!-- Actions -->
            <div class="flex space-x-2 mt-4 pt-4 border-t border-gray-100">
              <button
                @click="editUser(user)"
                class="flex-1 bg-primary-50 text-primary-600 hover:bg-primary-100 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Edit
              </button>
              <button
                v-if="user.id !== authStore.currentUser?.id"
                @click="deleteUser(user.id)"
                class="flex-1 bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit User Modal -->
    <div v-if="showAddForm || editingUser" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 class="text-lg font-semibold mb-4">
          {{ editingUser ? 'Edit User' : 'Add New User' }}
        </h2>
        
        <form @submit.prevent="submitForm" class="space-y-4">
          <div>
            <label class="form-label">Username</label>
            <input
              v-model="formData.username"
              type="text"
              required
              class="form-input"
              placeholder="Enter username"
            >
          </div>
          
          <div>
            <label class="form-label">Email</label>
            <input
              v-model="formData.email"
              type="email"
              required
              class="form-input"
              placeholder="Enter email"
            >
          </div>
          
          <div v-if="!editingUser">
            <label class="form-label">Password</label>
            <input
              v-model="formData.password"
              type="password"
              required
              class="form-input"
              placeholder="Enter password"
            >
          </div>
          
          <div>
            <label class="form-label">Role</label>
            <select v-model="formData.role" required class="form-input">
              <option value="">Select role</option>
              <option value="admin">Admin</option>
              <option value="mod">Moderator</option>
              <option value="user">User</option>
            </select>
          </div>
          
          <div>
            <label class="form-label">Linked Player (Optional)</label>
            <select v-model="formData.playerId" class="form-input">
              <option value="">Select player</option>
              <option v-for="player in availablePlayers" :key="player.id" :value="player.id">
                {{ player.name }} ({{ player.position }})
              </option>
              <!-- Show currently linked player even if not in available list -->
              <option 
                v-if="(editingUser?.playerId || editingUser?.player?.id) && !availablePlayers.find(p => p.id === (editingUser?.playerId || editingUser?.player?.id))"
                :value="editingUser.playerId || editingUser.player?.id"
              >
                {{ editingUser.player?.name || 'Unknown Player' }} (Current)
              </option>
            </select>
            <div v-if="formData.playerId" class="text-xs text-gray-500 mt-1">
              Selected: {{ getPlayerNameById(formData.playerId) }}
            </div>
          </div>
          
          <div class="flex items-center">
            <input
              id="isActive"
              v-model="formData.isActive"
              type="checkbox"
              class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            >
            <label for="isActive" class="ml-2 block text-sm text-gray-900">
              Active User
            </label>
          </div>
          
          <div class="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              @click="cancelForm"
              class="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" class="btn-primary">
              {{ editingUser ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useAuthStore } from '../stores/auth'
import { usePlayersStore } from '../stores/players'
import type { User, UserRole } from '../types'

const authStore = useAuthStore()
const playersStore = usePlayersStore()

const users = computed(() => authStore.users)
const players = computed(() => playersStore.players)
const showAddForm = ref(false)
const editingUser = ref<User | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

// Fetch data when component mounts
onMounted(async () => {
  isLoading.value = true
  error.value = null
  
  try {
    await authStore.fetchUsers()
    
    // Fetch players separately and don't block on it
    playersStore.fetchPlayers().catch(err => console.warn('Failed to fetch players:', err))
  } catch (err) {
    console.error('Error fetching users:', err)
    error.value = err instanceof Error ? err.message : 'Failed to load users'
  } finally {
    isLoading.value = false
  }
})

// Helper function to safely format dates
const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return 'Never'
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleDateString()
  } catch {
    return 'Invalid Date'
  }
}

const formData = ref({
  username: '',
  email: '',
  password: '',
  role: '' as UserRole | '',
  playerId: '',
  isActive: true
})

const availablePlayers = computed(() => {
  // Get players that are not already linked to users (excluding current editing user)
  const linkedPlayerIds = users.value
    .filter(user => user.id !== editingUser.value?.id)
    .map(user => user.playerId || user.player?.id)
    .filter(Boolean)
  
  // If editing a user, include their currently linked player in available options
  const currentUserPlayerId = editingUser.value?.playerId || editingUser.value?.player?.id
  
  return players.value.filter(player => {
    // Include if not linked to another user
    const isNotLinkedToOther = !linkedPlayerIds.includes(player.id)
    // Or if it's the current user's linked player
    const isCurrentUserPlayer = currentUserPlayerId === player.id
    
    return isNotLinkedToOther || isCurrentUserPlayer
  })
})

function getRoleClasses(role: UserRole) {
  const classes = {
    admin: 'bg-red-100 text-red-800',
    mod: 'bg-yellow-100 text-yellow-800',
    user: 'bg-blue-100 text-blue-800'
  }
  return classes[role] || classes.user
}

function getLinkedPlayerName(user: User): string {
  if (user.player) return user.player.name
  if (user.playerId) {
    // Fallback to finding player by ID if player object not populated
    const player = players.value.find(p => p.id === user.playerId)
    return player ? player.name : 'Unknown Player'
  }
  return 'None'
}

function getLinkedPlayerDisplay(user: User): string {
  return getLinkedPlayerName(user)
}

function getLinkedPlayerPosition(user: User): string {
  if (user.player) {
    return `${user.player.position} - Tier ${user.player.tier}`
  }
  if (user.playerId) {
    // Fallback to finding player by ID if player object not populated
    const player = players.value.find(p => p.id === user.playerId)
    return player ? `${player.position} - Tier ${player.tier}` : ''
  }
  return ''
}

function getPlayerNameById(playerId: string): string {
  const player = players.value.find(p => p.id === playerId)
  return player ? player.name : 'Unknown Player'
}

function editUser(user: User) {
  editingUser.value = user
  
  // Use nextTick to ensure reactive updates
  nextTick(() => {
    formData.value = {
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      playerId: user.playerId || user.player?.id || '',
      isActive: user.isActive
    }
  })
}

function submitForm() {
  const userData = {
    username: formData.value.username,
    email: formData.value.email,
    password: formData.value.password,
    role: formData.value.role as UserRole,
    playerId: formData.value.playerId || undefined,
    isActive: formData.value.isActive
  }

  if (editingUser.value) {
    // Don't update password if not provided
    const updateData: Partial<User> = { ...userData }
    if (!updateData.password) {
      const { password, ...dataWithoutPassword } = updateData
      authStore.updateUser(editingUser.value.id, dataWithoutPassword)
    } else {
      authStore.updateUser(editingUser.value.id, updateData)
    }
  } else {
    authStore.addUser(userData)
  }
  
  cancelForm()
}

function cancelForm() {
  showAddForm.value = false
  editingUser.value = null
  formData.value = {
    username: '',
    email: '',
    password: '',
    role: '',
    playerId: '',
    isActive: true
  }
}

function deleteUser(id: string) {
  if (confirm('Are you sure you want to delete this user?')) {
    authStore.deleteUser(id)
  }
}
</script>
