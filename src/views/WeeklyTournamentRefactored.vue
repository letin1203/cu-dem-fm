<template>
    <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Đá hằng tuần</h1>
      
      <button
        v-if="authStore.hasPermission('canEditTournaments') && canCreateNew"
        @click="createWeeklyTournament"
        :disabled="loading"
        class="btn-primary w-full sm:w-auto"
        :class="{ 'opacity-50 cursor-not-allowed': loading }"
      >
        {{ loading ? 'Đang tạo...' : 'Tạo mới' }}
      </button>
    </div>

    <!-- Tournament List -->
    <TournamentList
      :tournaments="weeklyTournaments"
      :players="players"
      :attendance-details-map="attendanceDetailsMap"
      :tournament-team-players-map="tournamentTeamPlayersMap"
      :additional-costs-map="additionalCostsMap"
      :system-settings="systemStore.currentSettings"
      :current-user="authStore.currentUser"
      :generate-teams-loading="generateTeamsLoading"
      :clear-teams-loading="clearTeamsLoading"
      :attendance-loading="attendanceLoading"
      :end-tournament-loading="endTournamentLoading"
      :additional-costs-loading="additionalCostsLoading"
      :delete-additional-costs-loading="deleteAdditionalCostsLoading"
      :get-detailed-money-change="getDetailedMoneyChange"
      :show-filters="true"
      @generate-teams="generateTeams"
      @clear-teams="clearTeams"
      @update-score="updateTeamScore"
      @update-attendance="updatePlayerAttendance"
      @toggle-water="toggleWater"
      @toggle-bet="toggleBet"
      @confirm-end-tournament="confirmEndTournament"
      @add-additional-cost="addAdditionalCost"
      @delete-additional-cost="deleteAdditionalCost"
      @toggle-attendance="toggleAttendance"
      @delete-tournament="deleteTournament"
    />

    <!-- Clear Teams Confirmation Modal -->
    <div 
      v-if="showClearTeamsModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      @click.self="showClearTeamsModal = false"
    >
      <div class="bg-white rounded-lg max-w-md w-full p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Xóa đội</h3>
        <p class="text-gray-600 mb-6">
          Bạn có chắc muốn xóa toàn bộ đội của giải đấu này? Thao tác này không thể hoàn tác.
        </p>
        <div class="flex justify-end space-x-3">
          <button
            @click="showClearTeamsModal = false"
            class="btn-secondary"
          >
            Hủy
          </button>
          <button
            @click="confirmClearTeams"
            :disabled="clearTeamsLoading.has(clearTeamsTournamentId)"
            class="btn-danger"
          >
            {{ clearTeamsLoading.has(clearTeamsTournamentId) ? 'Đang xóa...' : 'Xóa đội' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'
import { useTournamentsStore } from '../stores/tournaments'
import { usePlayersStore } from '../stores/players'
import { useSystemStore } from '../stores/system'
import { apiClient } from '../api/client'
import TournamentList from '../components/tournament/TournamentList.vue'
import type { Player, Team } from '../types'

const toast = useToast()

const router = useRouter()
const authStore = useAuthStore()
const tournamentsStore = useTournamentsStore()
const playersStore = usePlayersStore()
const systemStore = useSystemStore()

// Local state
const loading = ref(false)
const showClearTeamsModal = ref(false)
const clearTeamsTournamentId = ref('')
const endTournamentLoading = ref(false)
const additionalCostsLoading = ref(false)

// Reactive sets for loading states
const generateTeamsLoading = ref(new Set<string>())
const clearTeamsLoading = ref(new Set<string>())
const attendanceLoading = ref(new Set<string>())
const deleteAdditionalCostsLoading = ref(new Set<string>())

// Maps for organizing data
const attendanceDetailsMap = ref(new Map<string, any[]>())
const tournamentTeamPlayersMap = ref(new Map<string, any[]>())
const additionalCostsMap = ref(new Map<string, any[]>())

// Computed properties
const weeklyTournaments = computed(() => {
  return tournamentsStore.tournaments.filter(t => t.type === 'WEEKLY')
})

const players = computed(() => playersStore.players)

// Get next Monday (or today if today is Monday)
const nextMonday = computed(() => {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.
  
  if (dayOfWeek === 1) {
    // Today is Monday
    return new Date(today.getFullYear(), today.getMonth(), today.getDate())
  } else {
    // Calculate next Monday
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
    const nextMondayDate = new Date(today)
    nextMondayDate.setDate(today.getDate() + daysUntilMonday)
    return new Date(nextMondayDate.getFullYear(), nextMondayDate.getMonth(), nextMondayDate.getDate())
  }
})

// Get ongoing tournament (filter by status = 'UPCOMING' or 'ONGOING')
const ongoingTournament = computed(() => {
  return weeklyTournaments.value.find(tournament => 
    tournament.status === 'UPCOMING' || tournament.status === 'ONGOING'
  )
})

const canCreateNew = computed(() => {
  // Don't allow creating if there's an ongoing tournament
  if (ongoingTournament.value) return false
  
  // Only one weekly tournament may exist for a given calendar date.
  const targetDate = nextMonday.value
  const targetDateStr = toLocalDateKey(targetDate)
  
  const tournamentForNextMonday = weeklyTournaments.value.find(tournament => {
    const tournamentDateStr = toLocalDateKey(new Date(tournament.startDate))
    return tournamentDateStr === targetDateStr
  })
  
  return !tournamentForNextMonday
})

const hasActiveTournament = computed(() => {
  return weeklyTournaments.value.some(t => t.status === 'ONGOING' || t.status === 'UPCOMING')
})

const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Lifecycle
onMounted(async () => {
  await fetchData()
})

// Methods
const fetchData = async () => {
  try {
    await Promise.all([
      tournamentsStore.fetchTournaments(),
      playersStore.fetchPlayers(),
      systemStore.fetchSystemSettings()
    ])
    
    // Fetch attendance details for each tournament
    for (const tournament of weeklyTournaments.value) {
      await fetchAttendanceDetails(tournament.id)
      fetchTournamentTeamPlayers(tournament.id)
      fetchAdditionalCosts(tournament.id)
    }
  } catch (error) {
    console.error('Failed to fetch data:', error)
    toast.error('Không thể tải dữ liệu giải đấu')
  }
}

const fetchAttendanceDetails = async (tournamentId: string) => {
  try {
    const response = await apiClient.get(`/tournaments/${tournamentId}/attendance-details`)
    if (response.success && Array.isArray(response.data)) {
      attendanceDetailsMap.value.set(tournamentId, response.data)
    }
  } catch (error) {
    console.error(`Failed to fetch attendance details for tournament ${tournamentId}:`, error)
  }
}

const fetchTournamentTeamPlayers = (tournamentId: string) => {
  const tournament = tournamentsStore.tournaments.find(t => t.id === tournamentId)
  if (tournament && tournament.tournamentTeamPlayers) {
    // Store the raw tournament team players array for the tournament
    tournamentTeamPlayersMap.value.set(tournamentId, tournament.tournamentTeamPlayers)
  }
}

const fetchAdditionalCosts = (tournamentId: string) => {
  const tournament = tournamentsStore.tournaments.find(t => t.id === tournamentId)
  if (tournament && tournament.additionalCosts) {
    additionalCostsMap.value.set(tournamentId, tournament.additionalCosts)
  }
}

const createWeeklyTournament = async () => {
  if (!canCreateNew.value || loading.value) return
  
  try {
    loading.value = true
    
    // Create dates in local time
    const startDate = new Date(nextMonday.value)
    startDate.setHours(19, 0, 0, 0) // 7:00 PM local time
    
    const endDate = new Date(nextMonday.value)
    endDate.setHours(21, 0, 0, 0) // 9:00 PM local time
    
    // Convert to ISO strings to preserve the exact time we want
    const startDateISO = startDate.toISOString()
    const endDateISO = endDate.toISOString()
    
    const tournamentData = {
      name: `Giải đấu hằng tuần - ${formatDate(startDate)}`,
      type: 'WEEKLY' as const,
      status: 'UPCOMING' as const,
      startDate: startDateISO,
      endDate: endDateISO
    }
    
    await tournamentsStore.addTournament(tournamentData)
    await fetchData()
    toast.success('Đã tạo giải đấu hằng tuần!')
  } catch (err: any) {
    console.error('Create weekly tournament error:', err)
    toast.error(err.response?.data?.error || 'Không thể tạo giải đấu hằng tuần')
  } finally {
    loading.value = false
  }
}

const formatNextMonday = (date: Date) => {
  return date.toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Helper functions
const formatDate = (date: string | Date): string => {
  if (!date) return 'Không có'
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  } catch {
    return 'Ngày không hợp lệ'
  }
}

const generateTeams = async (tournamentId: string) => {
  generateTeamsLoading.value.add(tournamentId)
  try {
    const response = await apiClient.post(`/tournaments/${tournamentId}/generate-teams`)
    if (response.success) {
      toast.success('Đã chia đội thành công!')
      await fetchData()
    } else {
      toast.error(response.error || 'Không thể chia đội')
    }
  } catch (error: any) {
    console.error('Generate teams error:', error)
    toast.error(error.response?.data?.error || 'Không thể chia đội')
  } finally {
    generateTeamsLoading.value.delete(tournamentId)
  }
}

const clearTeams = (tournamentId: string) => {
  clearTeamsTournamentId.value = tournamentId
  showClearTeamsModal.value = true
}

const confirmClearTeams = async () => {
  const tournamentId = clearTeamsTournamentId.value
  clearTeamsLoading.value.add(tournamentId)
  
  try {
    const response = await apiClient.put(`/tournaments/${tournamentId}/clear-teams`)
    if (response.success) {
      toast.success('Đã xóa đội thành công!')
      await fetchData()
    } else {
      toast.error(response.error || 'Không thể xóa đội')
    }
  } catch (error: any) {
    console.error('Clear teams error:', error)
    toast.error(error.response?.data?.error || 'Không thể xóa đội')
  } finally {
    clearTeamsLoading.value.delete(tournamentId)
    showClearTeamsModal.value = false
    clearTeamsTournamentId.value = ''
  }
}

const updateTeamScore = async (tournamentId: string, teamId: string, score: number) => {
  try {
    const response = await apiClient.put(`/tournaments/${tournamentId}/scores`, {
      teamId,
      score
    })
    
    if (response.success) {
      await fetchData()
    } else {
      toast.error(response.error || 'Không thể cập nhật điểm')
    }
  } catch (error: any) {
    console.error('Update score error:', error)
    toast.error(error.response?.data?.error || 'Không thể cập nhật điểm')
  }
}

const updatePlayerAttendance = async (tournamentId: string, playerId: string, status: string) => {
  attendanceLoading.value.add(playerId)
  try {
    const response = await apiClient.put(`/tournaments/${tournamentId}/attendance`, {
      playerId,
      status
    })
    
    if (response.success) {
      await fetchAttendanceDetails(tournamentId)
    } else {
      toast.error(response.error || 'Không thể cập nhật điểm danh')
    }
  } catch (error: any) {
    console.error('Update attendance error:', error)
    toast.error(error.response?.data?.error || 'Không thể cập nhật điểm danh')
  } finally {
    attendanceLoading.value.delete(playerId)
  }
}

const toggleWater = async (tournamentId: string, playerId: string) => {
  attendanceLoading.value.add(playerId)
  try {
    const response = await apiClient.put(`/tournaments/${tournamentId}/attendance`, {
      playerId,
      toggleWater: true
    })
    
    if (response.success) {
      await fetchAttendanceDetails(tournamentId)
    } else {
      toast.error(response.error || 'Không thể cập nhật nước')
    }
  } catch (error: any) {
    console.error('Toggle water error:', error)
    toast.error(error.response?.data?.error || 'Không thể cập nhật nước')
  } finally {
    attendanceLoading.value.delete(playerId)
  }
}

const toggleBet = async (tournamentId: string, playerId: string) => {
  attendanceLoading.value.add(playerId)
  try {
    const response = await apiClient.put(`/tournaments/${tournamentId}/attendance`, {
      playerId,
      toggleBet: true
    })
    
    if (response.success) {
      await fetchAttendanceDetails(tournamentId)
    } else {
      toast.error(response.error || 'Không thể cập nhật cược')
    }
  } catch (error: any) {
    console.error('Toggle bet error:', error)
    toast.error(error.response?.data?.error || 'Không thể cập nhật cược')
  } finally {
    attendanceLoading.value.delete(playerId)
  }
}

const confirmEndTournament = async (tournamentId: string) => {
  endTournamentLoading.value = true
  try {
    const response = await apiClient.put(`/tournaments/${tournamentId}/end`, {})
    
    if (response.success) {
      const data = response.data as any
      let message = 'Đã kết thúc giải đấu!'
      
      if (data.winner) {
        message += ` Đội thắng: ${data.winner.name} (${data.winner.score} điểm).`
      }
      
      if (data.loser) {
        message += ` Đội thua: ${data.loser.name} (${data.loser.score} điểm).`
      }
      
      if (data.playersUpdated > 0) {
        message += ` Đã cập nhật tiền cho ${data.playersUpdated} cầu thủ.`
      }
      
      toast.success(message)
      await fetchData()
    } else {
      toast.error(response.error || 'Không thể kết thúc giải đấu')
    }
  } catch (error: any) {
    console.error('End tournament error:', error)
    toast.error(error.response?.data?.error || 'Không thể kết thúc giải đấu')
  } finally {
    endTournamentLoading.value = false
  }
}

const addAdditionalCost = async (cost: { tournamentId: string; description: string; amount: number }) => {
  additionalCostsLoading.value = true
  try {
    const response = await apiClient.post(`/additional-costs`, {
      tournamentId: cost.tournamentId,
      description: cost.description,
      amount: cost.amount
    })
    
    if (response.success) {
      toast.success('Đã thêm chi phí phát sinh!')
      // Refresh tournament data to get updated costs
      await tournamentsStore.fetchTournaments()
      fetchAdditionalCosts(cost.tournamentId)
    } else {
      toast.error(response.error || 'Không thể thêm chi phí phát sinh')
    }
  } catch (error: any) {
    console.error('Add additional cost error:', error)
    toast.error(error.response?.data?.error || 'Không thể thêm chi phí phát sinh')
  } finally {
    additionalCostsLoading.value = false
  }
}

const deleteAdditionalCost = async (costId: string) => {
  deleteAdditionalCostsLoading.value.add(costId)
  try {
    const response = await apiClient.delete(`/additional-costs/${costId}`)
    
    if (response.success) {
      toast.success('Đã xóa chi phí phát sinh!')
      await fetchData()
    } else {
      toast.error(response.error || 'Không thể xóa chi phí phát sinh')
    }
  } catch (error: any) {
    console.error('Delete additional cost error:', error)
    toast.error(error.response?.data?.error || 'Không thể xóa chi phí phát sinh')
  } finally {
    deleteAdditionalCostsLoading.value.delete(costId)
  }
}

const toggleAttendance = async (tournamentId: string) => {
  if (attendanceLoading.value.has(tournamentId)) return
  attendanceLoading.value.add(tournamentId)
  try {
    const playerId = authStore.currentUser?.player?.id
    if (!playerId) throw new Error('Không tìm thấy mã cầu thủ')
    const attendanceDetails = attendanceDetailsMap.value.get(tournamentId) || []
    const userAttendance = attendanceDetails.find((a: any) => a.player?.id === playerId)
    let newStatus = 'ATTEND'
    let payload: any = { playerId }
    if (userAttendance) {
      if (userAttendance.status === 'ATTEND') {
        newStatus = 'NOT_ATTEND'
        payload = { playerId, status: newStatus, withWater: false, bet: false }
      } else {
        newStatus = 'ATTEND'
        payload = { playerId, status: newStatus }
      }
    } else {
      payload = { playerId, status: newStatus }
    }
    const response = await apiClient.put(`/tournaments/${tournamentId}/attendance`, payload)
    if (response.success) {
      toast.success('Đã cập nhật điểm danh!')
      // Force refresh and reactivity
      await fetchAttendanceDetails(tournamentId)
      // Reassign the map to trigger reactivity
      attendanceDetailsMap.value = new Map(attendanceDetailsMap.value)
    } else {
      toast.error(response.error || 'Không thể cập nhật điểm danh')
    }
  } catch (error: any) {
    console.error('Error toggling attendance:', error)
    toast.error(error.response?.data?.error || 'Không thể cập nhật điểm danh')
  } finally {
    attendanceLoading.value.delete(tournamentId)
  }
}

const deleteTournament = async (tournamentId: string) => {
  if (confirm('Bạn có chắc muốn xóa giải đấu này? Thao tác này không thể hoàn tác.')) {
    try {
      const response = await apiClient.delete(`/tournaments/${tournamentId}`)
      
      if (response.success) {
        toast.success('Đã xóa giải đấu!')
        await fetchData()
      } else {
        toast.error(response.error || 'Không thể xóa giải đấu')
      }
    } catch (error: any) {
      console.error('Error deleting tournament:', error)
      toast.error('Không thể xóa giải đấu')
    }
  }
}

const getDetailedMoneyChange = (tournamentId: string, team: Team, player: Player) => {
  if (!systemStore.currentSettings) return { changes: [], total: 0 }
  
  const tournament = weeklyTournaments.value.find(t => t.id === tournamentId)
  if (!tournament) return { changes: [], total: 0 }
  
  const changes: Array<{type: string, amount: number, description: string}> = []
  
  // This is a simplified version - you can expand this based on your business logic
  const costPerPlayer = 10000 // Base cost
  changes.push({
    type: 'cost',
    amount: -costPerPlayer,
    description: 'Chi phí giải đấu mỗi cầu thủ'
  })
  
  const total = changes.reduce((sum, change) => sum + change.amount, 0)
  
  return { changes, total }
}
</script>
