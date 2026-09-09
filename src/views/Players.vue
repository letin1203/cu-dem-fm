<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Cầu thủ</h1>
      <button 
        v-if="authStore.hasPermission('canEditPlayers')"
        @click="showAddForm = true" 
        class="btn-primary w-full sm:w-auto"
      >
        Thêm cầu thủ
      </button>
    </div>

    <!-- Filter Section -->
    <div class="card p-4 space-y-4">
      <div class="max-w-md">
        <label class="form-label">Tìm theo tên cầu thủ</label>
        <input
          v-model="playerNameFilter"
          type="text"
          class="form-input"
          placeholder="Nhập tên cầu thủ..."
        >
      </div>
      
      <!-- Tier Filter -->
      <div>
        <label class="form-label">Lọc theo Tier</label>
        <div class="flex flex-wrap gap-2 mt-2">
          <button
            @click="selectedTierRange = null"
            :class="selectedTierRange === null 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
            class="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Tất cả Tier
          </button>
          <button
            v-for="tierRange in tierRanges"
            :key="tierRange.key"
            @click="selectedTierRange = tierRange.key"
            :class="selectedTierRange === tierRange.key 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
            class="px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1"
          >
            <span>{{ tierRange.stars }}</span>
            <span>{{ tierRange.label }}</span>
          </button>
        </div>
      </div>

      <div class="max-w-md">
        <label class="form-label">Sắp xếp</label>
        <select v-model="sortBy" class="form-input mt-2">
          <option value="tier">Tier (mạnh đến yếu)</option>
          <option value="money-asc">Tiền (thấp đến cao)</option>
        </select>
      </div>
    </div>

    <!-- Players Table/Cards -->
    <div class="card p-0 sm:p-6 overflow-hidden">
      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-8">
        <div class="text-red-600 mb-2">{{ error }}</div>
        <button @click="playersStore.fetchPlayers()" class="btn-secondary">
          Thử lại
        </button>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredPlayers.length === 0" class="text-center py-8">
        <div class="text-gray-500 mb-4" v-if="playerNameFilter || selectedTierRange">
          Không có cầu thủ nào phù hợp với bộ lọc hiện tại.
        </div>
        <div class="text-gray-500 mb-4" v-else>
          Chưa có cầu thủ nào.
        </div>
        <button 
          v-if="authStore.hasPermission('canEditPlayers')"
          @click="showAddForm = true" 
          class="btn-primary"
        >
          Thêm cầu thủ đầu tiên
        </button>
      </div>

      <!-- Players Content -->
      <div v-else>
        <!-- Mobile Cards View -->
      <div class="block sm:hidden">
        <div
          v-for="player in filteredPlayers"
          :key="player.id"
          class="border-b border-gray-200 p-4 last:border-b-0"
        >
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center space-x-3">
              <div class="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span class="text-primary-600 font-medium text-sm">
                  {{ player.name.split(' ').map(n => n[0]).join('') }}
                </span>
              </div>
              <div>
                <div class="text-sm font-medium text-gray-900">{{ player.name }}</div>
                <div class="text-xs text-gray-500">{{ displayPosition(player.position) }} • Năm sinh {{ player.yearOfBirth }}</div>
              </div>
            </div>
            <div class="flex space-x-2">
              <button @click="openMoneyHistory(player)" class="text-green-600 hover:text-green-800 p-1" title="Xem lịch sử tiền">
                ₫
              </button>
              <button
                v-if="authStore.hasPermission('canEditPlayers')"
                @click="editPlayer(player)"
                class="text-primary-600 hover:text-primary-800 p-1"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                v-if="authStore.hasPermission('canDeletePlayers')"
                @click="deletePlayer(player.id)"
                class="text-red-600 hover:text-red-800 p-1"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-3 text-xs justify-between">
            <div>
              <div class="flex items-center mt-1">
                <div class="flex">
                  <div 
                    v-for="star in 6" 
                    :key="star"
                    :class="star <= 7 - player.tier ? 'text-yellow-400' : 'text-gray-300'"
                    class="w-3 h-3"
                  >
                    ★
                  </div>
                </div>
              </div>
            </div>
            <div class="text-right">
              <span class="text-gray-500">Tiền:</span>
              <span class="text-sm font-medium">{{ player.money.toLocaleString('vi-VN') }} ₫</span>
            </div>
          </div>
        </div>
        
        <!-- Load All Players Button for Mobile -->
        <div v-if="!playersStore.isShowingAll" class="text-center mt-6 p-4 border-t border-gray-200">
          <button
            @click="loadAllPlayers"
            :disabled="playersStore.loadingAll"
            class="btn-primary w-full"
            :class="{ 'opacity-50 cursor-not-allowed': playersStore.loadingAll }"
          >
            <span v-if="playersStore.loadingAll" class="flex items-center justify-center">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Đang tải tất cả cầu thủ...
            </span>
            <span v-else>
              Tải tất cả cầu thủ (còn {{ remainingPlayersCount }})
            </span>        </button>
      </div>
      </div>

      <!-- Desktop Table View -->
      <div class="hidden sm:block overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tên
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vị trí
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Năm sinh
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tier
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tiền
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="player in filteredPlayers" :key="player.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-10 w-10">
                    <div class="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span class="text-primary-600 font-medium">
                        {{ player.name.split(' ').map(n => n[0]).join('') }}
                      </span>
                    </div>
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">{{ player.name }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ displayPosition(player.position) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ player.yearOfBirth }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <div class="flex items-center">
                  <div class="flex">
                    <div 
                      v-for="star in 6" 
                      :key="star"
                      :class="star <= 7 - player.tier ? 'text-yellow-400' : 'text-gray-300'"
                      class="w-3 h-3"
                    >
                      ★
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ player.money.toLocaleString('vi-VN') }} ₫
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex space-x-2">
                  <button @click="openMoneyHistory(player)" class="text-green-600 hover:text-green-900" title="Xem lịch sử tiền">
                    Lịch sử tiền
                  </button>
                  <button
                    v-if="authStore.hasPermission('canEditPlayers')"
                    @click="editPlayer(player)"
                    class="text-primary-600 hover:text-primary-900"
                  >
                    Sửa
                  </button>
                  <button
                    v-if="authStore.hasPermission('canDeletePlayers')"
                    @click="deletePlayer(player.id)"
                    class="text-red-600 hover:text-red-900"
                  >
                    Xóa
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Load All Players Button -->
      <div v-if="!playersStore.isShowingAll" class="text-center mt-6 p-6 border-t border-gray-200">
        <button
          @click="loadAllPlayers"
          :disabled="playersStore.loadingAll"
          class="btn-primary"
          :class="{ 'opacity-50 cursor-not-allowed': playersStore.loadingAll }"
        >
          <span v-if="playersStore.loadingAll" class="flex items-center justify-center">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Đang tải tất cả cầu thủ...
          </span>
          <span v-else>
            Tải tất cả cầu thủ (còn {{ remainingPlayersCount }})
          </span>
        </button>
      </div>
      </div>
    </div>

    <PlayerMoneyDetailModal
      :is-open="showMoneyHistory"
      :player="selectedMoneyPlayer"
      :history="moneyHistory"
      :pagination="moneyHistoryPagination"
      :loading="moneyHistoryLoading"
      :error="moneyHistoryError"
      @close="showMoneyHistory = false"
      @page-change="loadMoneyHistory"
    />

    <!-- Add/Edit Player Modal -->
    <div v-if="showAddForm || editingPlayer" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 class="text-lg font-semibold mb-4">
          {{ editingPlayer ? 'Chỉnh sửa cầu thủ' : 'Thêm cầu thủ' }}
        </h2>
        
        <form @submit.prevent="submitForm" class="space-y-4">
          <div>
            <label class="form-label">Tên cầu thủ</label>
            <input
              v-model="formData.name"
              type="text"
              required
              class="form-input"
              placeholder="Nhập tên cầu thủ"
            >
          </div>
          
          <div>
            <label class="form-label">Vị trí</label>
            <select v-model="formData.position" required class="form-input">
              <option value="">Chọn vị trí</option>
              <option value="GK">GK - Thủ môn</option>
              <option value="DEF">DEF - Hậu vệ</option>
              <option value="MID">MID - Tiền vệ</option>
              <option value="FWD">FWD - Tiền đạo</option>
            </select>
          </div>
          
          <div>
            <label class="form-label">Năm sinh</label>
            <input
              v-model="formData.yearOfBirth"
              type="number"
              required
              min="1960"
              max="2010"
              class="form-input"
              placeholder="VD: 1987"
            >
          </div>
          
          <div>
            <label class="form-label">Tier (1-6, Tier 1 mạnh nhất)</label>
            <select v-model="formData.tier" required class="form-input">
              <option value="">Chọn Tier</option>
              <option v-for="tier in 6" :key="tier" :value="tier">
                Tier {{ tier }} {{ '★'.repeat(7 - tier) }}
              </option>
            </select>
          </div>
          
          <div>
            <label class="form-label">Tiền (₫)</label>
            <input
              v-model="formData.money"
              type="number"
              :readonly="!!editingPlayer"
              :required="!editingPlayer"
              min="0"
              step="1000"
              class="form-input"
              :class="{ 'bg-gray-100 cursor-not-allowed': editingPlayer }"
              placeholder="VD: 50000"
            >
            <button v-if="editingPlayer" type="button" @click="openAdminTopUp" class="btn-secondary w-full mt-2">Nạp tiền</button>
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
              {{ editingPlayer ? 'Cập nhật' : 'Tạo cầu thủ' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="showAdminTopUpModal" class="fixed inset-0 z-[70] bg-gray-900/50 flex items-center justify-center p-4" @click.self="showAdminTopUpModal = false">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 class="text-lg font-semibold text-gray-900">Nạp tiền cho {{ editingPlayer?.name }}</h2>
        <p class="text-sm text-gray-500 mt-1 mb-4">Khoản nạp của Admin/Mod được duyệt tự động.</p>
        <img src="/quy-momo.jpg" alt="Mã QR MoMo nạp quỹ" class="w-full max-w-xs mx-auto rounded-lg border border-gray-200 mb-5">
        <div class="grid grid-cols-2 gap-3"><button v-for="amount in topUpAmounts" :key="amount" type="button" @click="selectedTopUpAmount = amount" class="rounded-lg border px-4 py-3 font-medium transition-colors" :class="selectedTopUpAmount === amount ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'">{{ amount.toLocaleString('vi-VN') }} ₫</button></div>
        <div class="mt-4"><label class="form-label">Lý do</label><textarea v-model="adminTopUpReason" rows="3" class="form-input" /></div>
        <div class="flex justify-end gap-3 mt-6"><button type="button" @click="showAdminTopUpModal = false" class="btn-secondary">Hủy</button><button type="button" @click="submitAdminTopUp" :disabled="submittingAdminTopUp" class="btn-primary">{{ submittingAdminTopUp ? 'Đang nạp...' : 'Xác nhận' }}</button></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { usePlayersStore } from '../stores/players'
import { useTeamsStore } from '../stores/teams'
import { useAuthStore } from '../stores/auth'
import { apiClient } from '../api/client'
import { useToast } from 'vue-toastification'
import PlayerMoneyDetailModal from '../components/PlayerMoneyDetailModal.vue'
import type { Player, PlayerMoneyHistory } from '../types'

const playersStore = usePlayersStore()
const teamsStore = useTeamsStore()
const authStore = useAuthStore()
const toast = useToast()

const players = computed(() => playersStore.players)
const loading = computed(() => playersStore.loading)
const error = computed(() => playersStore.error)
const showAddForm = ref(false)
const editingPlayer = ref<Player | null>(null)
const playerNameFilter = ref('')
const selectedTierRange = ref<string | null>(null)
const sortBy = ref<'tier' | 'money-asc'>('tier')
const showMoneyHistory = ref(false)
const selectedMoneyPlayer = ref<Player | null>(null)
const moneyHistory = ref<PlayerMoneyHistory[]>([])
const moneyHistoryLoading = ref(false)
const moneyHistoryError = ref<string | null>(null)
const moneyHistoryPagination = ref({ page: 1, pages: 0, total: 0 })
const showAdminTopUpModal = ref(false)
const submittingAdminTopUp = ref(false)
const selectedTopUpAmount = ref(100000)
const adminTopUpReason = ref('')
const topUpAmounts = [50000, 100000, 200000, 500000]

// Tier ranges configuration
const tierRanges = [
  { key: '1-2', label: 'Tier 1–2 (Mạnh)', stars: '★★★★★★–★★★★★', min: 1, max: 2 },
  { key: '3-4', label: 'Tier 3–4', stars: '★★★★–★★★', min: 3, max: 4 },
  { key: '5-6', label: 'Tier 5–6', stars: '★★–★', min: 5, max: 6 }
]

const positionLabels: Record<string, string> = {
  GK: 'GK - Thủ môn',
  DEF: 'DEF - Hậu vệ',
  MID: 'MID - Tiền vệ',
  FWD: 'FWD - Tiền đạo',
  Goalkeeper: 'Thủ môn',
  Defender: 'Hậu vệ',
  Midfielder: 'Tiền vệ',
  Forward: 'Tiền đạo'
}

function displayPosition(position: string) {
  return positionLabels[position] || position
}

// Computed properties for pagination and filtering
const filteredPlayers = computed(() => {
  let result = players.value
  
  // Apply name filter if provided
  if (playerNameFilter.value) {
    result = result.filter(player => 
      player.name.toLowerCase().includes(playerNameFilter.value.toLowerCase())
    )
  }
  
  // Apply tier filter if provided
  if (selectedTierRange.value) {
    const tierRange = tierRanges.find(range => range.key === selectedTierRange.value)
    if (tierRange) {
      result = result.filter(player => 
        player.tier >= tierRange.min && player.tier <= tierRange.max
      )
    }
  }
  
  // Tier 1 is the strongest. Copy before sorting so the store state is not mutated.
  return [...result].sort((a, b) => {
    if (sortBy.value === 'money-asc') return a.money - b.money || a.tier - b.tier
    return a.tier - b.tier || a.name.localeCompare(b.name, 'vi')
  })
})

const remainingPlayersCount = computed(() => {
  return Math.max(0, playersStore.totalPlayers - players.value.length)
})

// Load all players function
const loadAllPlayers = async () => {
  await playersStore.loadAllPlayers()
}

onMounted(async () => {
  await Promise.all([
    playersStore.fetchPlayers(), // Load first 100 players
    teamsStore.fetchTeams()
  ])
})

// Watch for filter changes and reset pagination when filter is cleared
watch(playerNameFilter, (newValue, oldValue) => {
  // If filter is cleared (from something to empty), reload all players
  if (oldValue && !newValue) {
    playersStore.fetchPlayers()
  }
})

watch(selectedTierRange, (newValue, oldValue) => {
  // If tier filter is cleared (from something to null), reload all players
  if (oldValue && !newValue) {
    playersStore.fetchPlayers()
  }
})

const formData = ref({
  name: '',
  position: '',
  yearOfBirth: '',
  tier: '',
  money: ''
})

function editPlayer(player: Player) {
  editingPlayer.value = player
  formData.value = {
    name: player.name,
    position: player.position,
    yearOfBirth: player.yearOfBirth.toString(),
    tier: player.tier.toString(),
    money: player.money.toString()
  }
}

function submitForm() {
  const playerData = {
    name: formData.value.name,
    position: formData.value.position,
    yearOfBirth: parseInt(formData.value.yearOfBirth),
    tier: parseInt(formData.value.tier),
    money: parseInt(formData.value.money),
    teamId: undefined, // Remove team assignment from player creation
    stats: {
      gamesPlayed: 0,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      minutesPlayed: 0
    }
  }

  if (editingPlayer.value) {
    playersStore.updatePlayer(editingPlayer.value.id, playerData)
      .then(() => cancelForm())
      .catch(() => {
        // Error is handled by the store
      })
  } else {
    playersStore.addPlayer(playerData)
      .then(() => {
        cancelForm()
        // Refresh the players list to include the new player
        playersStore.fetchPlayers()
      })
      .catch(() => {
        // Error is handled by the store
      })
  }
}

function cancelForm() {
  showAddForm.value = false
  editingPlayer.value = null
  formData.value = {
    name: '',
    position: '',
    yearOfBirth: '',
    tier: '',
    money: ''
  }
}

function deletePlayer(id: string) {
  if (confirm('Bạn có chắc chắn muốn xóa cầu thủ này không?')) {
    playersStore.deletePlayer(id).then(() => {
      // If we're on a page beyond the first and have no more players on current page,
      // we might need to reload to adjust pagination
      if (playersStore.players.length === 0 && playersStore.currentPage > 1) {
        playersStore.fetchPlayers()
      }
    })
  }
}

function openAdminTopUp() {
  if (!editingPlayer.value) return
  selectedTopUpAmount.value = 100000
  adminTopUpReason.value = `${authStore.currentUser?.username || 'Admin/Mod'} nạp tiền dùm ${editingPlayer.value.name}`
  showAdminTopUpModal.value = true
}

async function submitAdminTopUp() {
  if (!editingPlayer.value) return
  submittingAdminTopUp.value = true
  try {
    const response = await apiClient.createAdminMoneyTopUp(editingPlayer.value.id, selectedTopUpAmount.value, adminTopUpReason.value)
    if (!response.success) throw new Error(response.error || 'Không thể nạp tiền')
    editingPlayer.value.money += selectedTopUpAmount.value
    formData.value.money = editingPlayer.value.money.toString()
    showAdminTopUpModal.value = false
    await playersStore.fetchPlayers()
    toast.success('Đã nạp tiền và duyệt tự động')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Không thể nạp tiền')
  } finally {
    submittingAdminTopUp.value = false
  }
}

async function openMoneyHistory(player: Player) {
  selectedMoneyPlayer.value = player
  showMoneyHistory.value = true
  await loadMoneyHistory(1)
}

async function loadMoneyHistory(page: number) {
  if (!selectedMoneyPlayer.value) return
  moneyHistoryLoading.value = true
  moneyHistoryError.value = null
  try {
    const response = await apiClient.getPlayerMoneyHistory(selectedMoneyPlayer.value.id, { page, limit: 5 })
    if (!response.success || !response.data) throw new Error(response.error || 'Không thể tải lịch sử biến động tiền')
    const data = response.data as { history: PlayerMoneyHistory[]; pagination: { page: number; pages: number; total: number } }
    moneyHistory.value = data.history
    moneyHistoryPagination.value = data.pagination
  } catch (error) {
    moneyHistory.value = []
    moneyHistoryError.value = error instanceof Error ? error.message : 'Không thể tải lịch sử biến động tiền'
  } finally {
    moneyHistoryLoading.value = false
  }
}
</script>
