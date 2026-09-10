<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Quản lý người dùng</h1>
      <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
        <button @click="createBulkUserPlayer" class="btn-secondary w-full sm:w-auto">
          Tạo nhanh tài khoản/cầu thủ
        </button>
        <button @click="showAddForm = true" class="btn-primary w-full sm:w-auto">
          Thêm người dùng
        </button>
      </div>
    </div>

    <!-- Filter Section -->
    <div class="card p-4">
      <div class="grid max-w-2xl gap-4 sm:grid-cols-2">
        <div>
        <label class="form-label">Lọc theo tên đăng nhập</label>
        <input
          v-model="usernameFilter"
          type="text"
          class="form-input"
          placeholder="Nhập tên đăng nhập..."
        >
        </div>
        <div>
          <label class="form-label">Lọc theo tên cầu thủ</label>
          <input
            v-model="playerNameFilter"
            type="text"
            class="form-input"
            placeholder="Nhập tên cầu thủ..."
          >
        </div>
      </div>
    </div>

    <!-- Users Cards -->
    <div class="card p-0 sm:p-6 overflow-hidden">
      <!-- Loading State -->
      <div v-if="isLoading" class="p-8 text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p class="mt-2 text-gray-600">Đang tải người dùng...</p>
      </div>
      
      <!-- Error State -->
      <div v-else-if="error" class="p-8 text-center">
        <div class="text-red-600 mb-2">⚠️ Lỗi</div>
        <p class="text-gray-600">{{ error }}</p>
        <button @click="onMounted" class="mt-2 btn-primary">Thử lại</button>
      </div>
      
      <!-- Empty State -->
      <div v-else-if="filteredUsers.length === 0" class="p-8 text-center">
        <div class="text-gray-400 mb-2">👥 Không tìm thấy người dùng</div>
        <p class="text-gray-600" v-if="usernameFilter || playerNameFilter">
          Không có người dùng nào khớp với bộ lọc.
        </p>
        <p class="text-gray-600" v-else>
          Chưa có người dùng nào trong hệ thống.
        </p>
        <button @click="showAddForm = true" class="mt-2 btn-primary">Thêm người dùng đầu tiên</button>
      </div>
      
      <!-- Users Grid -->
      <div v-else class="p-4 sm:p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div 
            v-for="user in filteredUsers" 
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
                </div>
              </div>
              
              <!-- Status Badge -->
              <span 
                :class="user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'" 
                class="px-2 py-1 text-xs font-medium rounded-full"
              >
                {{ user.isActive ? 'Đang hoạt động' : 'Đã khóa' }}
              </span>
            </div>
            
            <!-- User Details -->
            <div class="space-y-3">
              <!-- Role -->
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-500">Vai trò:</span>
                <span :class="getRoleClasses(user.role)" class="px-2 py-1 text-xs font-medium rounded-full">
                  {{ getRoleLabel(user.role) }}
                </span>
              </div>

              <div class="flex items-center justify-between gap-3">
                <span class="text-sm text-gray-500">Email:</span>
                <span class="truncate text-right text-sm text-gray-900" :title="user.email">{{ user.email || 'Chưa có email' }}</span>
              </div>
              
              <!-- Linked Player -->
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-500">Cầu thủ:</span>
                <div class="flex items-center justify-end gap-1 text-right">
                  <button
                    type="button"
                    class="rounded p-1 text-gray-400 transition-colors hover:bg-primary-50 hover:text-primary-600"
                    title="Chỉnh sửa liên kết cầu thủ"
                    aria-label="Chỉnh sửa liên kết cầu thủ"
                    @click="openPlayerLinkModal(user)"
                  >
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487a2.1 2.1 0 113 2.97L8.25 19.07 4 20l.93-4.25L16.862 4.487z"/></svg>
                  </button>
                  <div>
                    <div class="text-sm font-medium text-gray-900">
                      {{ getLinkedPlayerDisplay(user) }}
                  </div>
                  <div v-if="user.player" class="text-xs text-gray-500">
                    {{ getLinkedPlayerPosition(user) }}
                  </div>
                  </div>
                </div>
              </div>
              
              <!-- Last Login -->
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-500">Đăng nhập gần nhất:</span>
                <span class="text-sm text-gray-900">{{ formatDate(user.lastLogin) }}</span>
              </div>
            </div>
            
            <!-- Actions -->
            <div class="flex space-x-2 mt-4 pt-4 border-t border-gray-100">
              <button
                @click="editUser(user)"
                class="flex-1 bg-primary-50 text-primary-600 hover:bg-primary-100 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Chỉnh sửa
              </button>
              <button
                v-if="user.id !== authStore.currentUser?.id"
                @click="deleteUser(user.id)"
                class="flex-1 bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Player Link Modal -->
    <div v-if="linkingUser" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50 p-4" @click.self="closePlayerLinkModal">
      <div class="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-xl" role="dialog" aria-modal="true" aria-labelledby="player-link-modal-title">
        <div class="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 id="player-link-modal-title" class="text-lg font-semibold text-gray-900">Liên kết cầu thủ</h2>
            <p class="mt-1 text-sm text-gray-500">Chọn cầu thủ cho tài khoản {{ linkingUser.username }}</p>
          </div>
          <button type="button" class="text-2xl leading-none text-gray-400 hover:text-gray-700" aria-label="Đóng" @click="closePlayerLinkModal">×</button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <p v-if="linkingUser.player || linkingUser.playerId" class="mb-4 rounded-lg bg-primary-50 p-3 text-sm text-primary-800">
            Đang liên kết: <strong>{{ getLinkedPlayerName(linkingUser) }}</strong>
          </p>
          <p class="mb-3 text-sm text-gray-600">Cầu thủ chưa liên kết với tài khoản nào:</p>
          <div v-if="paginatedLinkablePlayers.length" class="space-y-2">
            <button
              v-for="player in paginatedLinkablePlayers"
              :key="player.id"
              type="button"
              class="flex w-full items-center justify-between rounded-lg border-2 px-4 py-3 text-left transition-colors"
              :class="selectedLinkedPlayerId === player.id ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-gray-200 text-gray-800 hover:border-primary-300'"
              :aria-pressed="selectedLinkedPlayerId === player.id"
              @click="selectedLinkedPlayerId = selectedLinkedPlayerId === player.id ? '' : player.id"
            >
              <span class="font-medium">{{ player.name }}</span>
              <span class="flex items-center gap-2 text-sm"><span>{{ player.position }} · Tier {{ player.tier }}</span><span class="flex h-5 w-5 items-center justify-center rounded border" :class="selectedLinkedPlayerId === player.id ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 bg-white'">{{ selectedLinkedPlayerId === player.id ? '✓' : '' }}</span></span>
            </button>
          </div>
          <p v-else class="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">Không còn cầu thủ nào chưa được liên kết.</p>

          <div v-if="linkablePlayerPageCount > 1" class="mt-5 flex items-center justify-center gap-3">
            <button type="button" class="btn-secondary px-3 py-1.5 text-sm" :disabled="linkablePlayerPage === 1" @click="linkablePlayerPage--">Trước</button>
            <span class="text-sm text-gray-600">Trang {{ linkablePlayerPage }} / {{ linkablePlayerPageCount }}</span>
            <button type="button" class="btn-secondary px-3 py-1.5 text-sm" :disabled="linkablePlayerPage === linkablePlayerPageCount" @click="linkablePlayerPage++">Sau</button>
          </div>
        </div>

        <div class="flex flex-wrap justify-end gap-3 border-t p-4">
          <button type="button" class="btn-secondary" @click="closePlayerLinkModal">Đóng</button>
          <button type="button" class="rounded-md bg-red-50 px-4 py-2 font-medium text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50" :disabled="!(linkingUser.player || linkingUser.playerId) || playerLinkSaving" @click="unlinkLinkedPlayer">Hủy liên kết</button>
          <button type="button" class="btn-primary" :disabled="!selectedLinkedPlayerId || playerLinkSaving" @click="linkSelectedPlayer">{{ playerLinkSaving ? 'Đang lưu...' : 'Liên kết' }}</button>
        </div>
      </div>
    </div>

    <!-- Add/Edit User Modal -->
    <div v-if="showAddForm || editingUser" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 class="text-lg font-semibold mb-4">
          {{ editingUser ? 'Chỉnh sửa người dùng' : 'Thêm người dùng' }}
        </h2>
        
        <form @submit.prevent="submitForm" class="space-y-4">
          <div>
            <label class="form-label">Tên đăng nhập</label>
            <input
              v-model="formData.username"
              type="text"
              required
              class="form-input"
              placeholder="Nhập tên đăng nhập"
            >
          </div>

          <div>
            <label class="form-label">Email</label>
            <input
              v-model="formData.email"
              type="email"
              required
              class="form-input"
              placeholder="Nhập địa chỉ email"
            >
          </div>
          
          <div v-if="!editingUser">
            <label class="form-label">Mật khẩu</label>
            <input
              v-model="formData.password"
              type="password"
              required
              class="form-input"
              placeholder="Nhập mật khẩu"
            >
          </div>
          
          <div>
            <label class="form-label">Vai trò</label>
            <select v-model="formData.role" required class="form-input">
              <option value="">Chọn vai trò</option>
              <option value="admin">Quản trị viên</option>
              <option value="mod">Điều hành viên</option>
              <option value="user">Người dùng</option>
            </select>
          </div>
          
          <div>
            <label class="form-label">Cầu thủ liên kết (không bắt buộc)</label>
            <select v-model="formData.playerId" class="form-input">
              <option value="">Chọn cầu thủ</option>
              <option v-for="player in availablePlayers" :key="player.id" :value="player.id">
                {{ player.name }} ({{ player.position }})
              </option>
              <!-- Show currently linked player even if not in available list -->
              <option 
                v-if="(editingUser?.playerId || editingUser?.player?.id) && !availablePlayers.find(p => p.id === (editingUser?.playerId || editingUser?.player?.id))"
                :value="editingUser.playerId || editingUser.player?.id"
              >
                {{ editingUser.player?.name || 'Không xác định' }} (hiện tại)
              </option>
            </select>
            <div v-if="formData.playerId" class="text-xs text-gray-500 mt-1">
              Đã chọn: {{ getPlayerNameById(formData.playerId) }}
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
              Người dùng đang hoạt động
            </label>
          </div>
          
          <div class="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              @click="cancelForm"
              class="btn-secondary"
            >
              Hủy
            </button>
            <button type="submit" class="btn-primary">
              {{ editingUser ? 'Cập nhật' : 'Tạo mới' }}
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
const usernameFilter = ref('')
const playerNameFilter = ref('')
const linkingUser = ref<User | null>(null)
const selectedLinkedPlayerId = ref('')
const linkablePlayerPage = ref(1)
const playerLinkSaving = ref(false)
const PLAYERS_PER_LINK_PAGE = 5

const normalizeSearchText = (value: string) => value
  .toLocaleLowerCase('vi')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .trim()

const filteredUsers = computed(() => {
  const usernameQuery = normalizeSearchText(usernameFilter.value)
  const playerQuery = normalizeSearchText(playerNameFilter.value)

  return users.value.filter(user => {
    const usernameMatches = !usernameQuery || normalizeSearchText(user.username).includes(usernameQuery)
    const playerName = normalizeSearchText(getLinkedPlayerName(user))
    const playerMatches = !playerQuery || playerName.includes(playerQuery)
    return usernameMatches && playerMatches
  })
})

// Fetch data when component mounts
onMounted(async () => {
  isLoading.value = true
  error.value = null
  
  try {
    // Load up to 100 users (system maximum)
    await authStore.fetchUsers()
    
    // Fetch players separately and don't block on it
    playersStore.fetchPlayers().catch(err => console.warn('Failed to fetch players:', err))
  } catch (err) {
    console.error('Error fetching users:', err)
    error.value = err instanceof Error ? err.message : 'Không thể tải danh sách người dùng'
  } finally {
    isLoading.value = false
  }
})

// Helper function to safely format dates
const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return 'Chưa từng đăng nhập'
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleDateString()
  } catch {
    return 'Ngày không hợp lệ'
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

const linkablePlayers = computed(() => {
  const linkedPlayerIds = new Set(
    users.value
      .map(user => user.playerId || user.player?.id)
      .filter((playerId): playerId is string => Boolean(playerId))
  )

  return players.value
    .filter(player => !linkedPlayerIds.has(player.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
})

const linkablePlayerPageCount = computed(() => Math.max(1, Math.ceil(linkablePlayers.value.length / PLAYERS_PER_LINK_PAGE)))

const paginatedLinkablePlayers = computed(() => {
  const start = (linkablePlayerPage.value - 1) * PLAYERS_PER_LINK_PAGE
  return linkablePlayers.value.slice(start, start + PLAYERS_PER_LINK_PAGE)
})

function getRoleClasses(role: UserRole) {
  const classes = {
    admin: 'bg-red-100 text-red-800',
    mod: 'bg-yellow-100 text-yellow-800',
    user: 'bg-blue-100 text-blue-800'
  }
  return classes[role] || classes.user
}

function getRoleLabel(role: UserRole) {
  const labels: Record<UserRole, string> = {
    admin: 'Quản trị viên',
    mod: 'Điều hành viên',
    user: 'Người dùng'
  }
  return labels[role]
}

function getLinkedPlayerName(user: User): string {
  if (user.player) return user.player.name
  if (user.playerId) {
    // Fallback to finding player by ID if player object not populated
    const player = players.value.find(p => p.id === user.playerId)
    return player ? player.name : 'Không xác định'
  }
  return 'Chưa liên kết'
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
  return player ? player.name : 'Không xác định'
}

function editUser(user: User) {
  editingUser.value = user
  
  // Use nextTick to ensure reactive updates
  nextTick(() => {
    formData.value = {
      username: user.username,
      email: user.email || '',
      password: '',
      role: user.role,
      playerId: user.playerId || user.player?.id || '',
      isActive: user.isActive
    }
  })
}

function openPlayerLinkModal(user: User) {
  linkingUser.value = user
  selectedLinkedPlayerId.value = ''
  linkablePlayerPage.value = 1
}

function closePlayerLinkModal() {
  if (playerLinkSaving.value) return
  linkingUser.value = null
  selectedLinkedPlayerId.value = ''
}

async function unlinkLinkedPlayer() {
  if (!linkingUser.value) return

  playerLinkSaving.value = true
  try {
    const success = await authStore.updateUser(linkingUser.value.id, { playerId: null } as any)
    if (!success) {
      alert('Không thể hủy liên kết cầu thủ. Vui lòng thử lại.')
      return
    }
    playerLinkSaving.value = false
    closePlayerLinkModal()
  } finally {
    playerLinkSaving.value = false
  }
}

async function linkSelectedPlayer() {
  if (!linkingUser.value || !selectedLinkedPlayerId.value) return

  playerLinkSaving.value = true
  try {
    const success = await authStore.updateUser(linkingUser.value.id, { playerId: selectedLinkedPlayerId.value })
    if (!success) {
      alert('Không thể liên kết cầu thủ. Vui lòng thử lại.')
      return
    }
    playerLinkSaving.value = false
    closePlayerLinkModal()
  } finally {
    playerLinkSaving.value = false
  }
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
  if (confirm('Bạn có chắc muốn xóa người dùng này?')) {
    authStore.deleteUser(id)
  }
}

async function createBulkUserPlayer() {
  const success = await authStore.createBulkUserPlayer()
  if (success) {
    // Optionally show success message or refresh players list
    playersStore.fetchPlayers().catch(err => console.warn('Failed to refresh players:', err))
  } else {
    alert('Không thể tạo tài khoản và cầu thủ. Vui lòng thử lại.')
  }
}
</script>
