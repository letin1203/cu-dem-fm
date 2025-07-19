<template>
    <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Weekly Tournament</h1>
      
      <button
        v-if="authStore.hasPermission('canEditTournaments') && canCreateNew"
        @click="createWeeklyTournament"
        :disabled="loading"
        class="btn-primary w-full sm:w-auto"
        :class="{ 'opacity-50 cursor-not-allowed': loading }"
      >
        {{ loading ? 'Creating...' : 'Create New' }}
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
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Clear Teams</h3>
        <p class="text-gray-600 mb-6">
          Are you sure you want to clear all teams for this tournament? This action cannot be undone.
        </p>
        <div class="flex justify-end space-x-3">
          <button
            @click="showClearTeamsModal = false"
            class="btn-secondary"
          >
            Cancel
          </button>
          <button
            @click="confirmClearTeams"
            :disabled="clearTeamsLoading.has(clearTeamsTournamentId)"
            class="btn-danger"
          >
            {{ clearTeamsLoading.has(clearTeamsTournamentId) ? 'Clearing...' : 'Clear Teams' }}
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
  
  // Don't allow creating if there's already an upcoming tournament for next Monday
  const targetDate = nextMonday.value
  const targetDateStr = targetDate.toISOString().split('T')[0]
  
  const upcomingForNextMonday = weeklyTournaments.value.find(tournament => {
    const tournamentDate = new Date(tournament.startDate)
    const tournamentDateStr = tournamentDate.toISOString().split('T')[0]
    return tournamentDateStr === targetDateStr && tournament.status === 'UPCOMING'
  })
  
  return !upcomingForNextMonday
})

const hasActiveTournament = computed(() => {
  return weeklyTournaments.value.some(t => t.status === 'ONGOING' || t.status === 'UPCOMING')
})

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
    toast.error('Failed to load tournament data')
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
      name: `Weekly Tournament - ${formatDate(startDate)}`,
      type: 'WEEKLY' as const,
      status: 'UPCOMING' as const,
      startDate: startDateISO,
      endDate: endDateISO
    }
    
    await tournamentsStore.addTournament(tournamentData)
    await fetchData()
    toast.success('Weekly tournament created successfully!')
  } catch (err: any) {
    console.error('Create weekly tournament error:', err)
    toast.error(err.response?.data?.error || 'Failed to create weekly tournament')
  } finally {
    loading.value = false
  }
}

const formatNextMonday = (date: Date) => {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Helper functions
const formatDate = (date: string | Date): string => {
  if (!date) return 'N/A'
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  } catch {
    return 'Invalid Date'
  }
}

const generateTeams = async (tournamentId: string) => {
  generateTeamsLoading.value.add(tournamentId)
  try {
    const response = await apiClient.post(`/tournaments/${tournamentId}/generate-teams`)
    if (response.success) {
      toast.success('Teams generated successfully!')
      await fetchData()
    } else {
      toast.error(response.error || 'Failed to generate teams')
    }
  } catch (error: any) {
    console.error('Generate teams error:', error)
    toast.error(error.response?.data?.error || 'Failed to generate teams')
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
      toast.success('Teams cleared successfully!')
      await fetchData()
    } else {
      toast.error(response.error || 'Failed to clear teams')
    }
  } catch (error: any) {
    console.error('Clear teams error:', error)
    toast.error(error.response?.data?.error || 'Failed to clear teams')
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
      toast.error(response.error || 'Failed to update score')
    }
  } catch (error: any) {
    console.error('Update score error:', error)
    toast.error(error.response?.data?.error || 'Failed to update score')
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
      toast.error(response.error || 'Failed to update attendance')
    }
  } catch (error: any) {
    console.error('Update attendance error:', error)
    toast.error(error.response?.data?.error || 'Failed to update attendance')
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
      toast.error(response.error || 'Failed to toggle water')
    }
  } catch (error: any) {
    console.error('Toggle water error:', error)
    toast.error(error.response?.data?.error || 'Failed to toggle water')
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
      toast.error(response.error || 'Failed to toggle bet')
    }
  } catch (error: any) {
    console.error('Toggle bet error:', error)
    toast.error(error.response?.data?.error || 'Failed to toggle bet')
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
      let message = 'Tournament ended successfully!'
      
      if (data.winner) {
        message += ` Winner: ${data.winner.name} (${data.winner.score} points).`
      }
      
      if (data.loser) {
        message += ` Loser: ${data.loser.name} (${data.loser.score} points).`
      }
      
      if (data.playersUpdated > 0) {
        message += ` ${data.playersUpdated} players had money updated.`
      }
      
      toast.success(message)
      await fetchData()
    } else {
      toast.error(response.error || 'Failed to end tournament')
    }
  } catch (error: any) {
    console.error('End tournament error:', error)
    toast.error(error.response?.data?.error || 'Failed to end tournament')
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
      toast.success('Additional cost added successfully!')
      // Refresh tournament data to get updated costs
      await tournamentsStore.fetchTournaments()
      fetchAdditionalCosts(cost.tournamentId)
    } else {
      toast.error(response.error || 'Failed to add additional cost')
    }
  } catch (error: any) {
    console.error('Add additional cost error:', error)
    toast.error(error.response?.data?.error || 'Failed to add additional cost')
  } finally {
    additionalCostsLoading.value = false
  }
}

const deleteAdditionalCost = async (costId: string) => {
  deleteAdditionalCostsLoading.value.add(costId)
  try {
    const response = await apiClient.delete(`/additional-costs/${costId}`)
    
    if (response.success) {
      toast.success('Additional cost deleted successfully!')
      await fetchData()
    } else {
      toast.error(response.error || 'Failed to delete additional cost')
    }
  } catch (error: any) {
    console.error('Delete additional cost error:', error)
    toast.error(error.response?.data?.error || 'Failed to delete additional cost')
  } finally {
    deleteAdditionalCostsLoading.value.delete(costId)
  }
}

const toggleAttendance = async (tournamentId: string) => {
  if (attendanceLoading.value.has(tournamentId)) return
  attendanceLoading.value.add(tournamentId)
  try {
    const playerId = authStore.currentUser?.player?.id
    if (!playerId) throw new Error('No player ID')
    const attendanceDetails = attendanceDetailsMap.value.get(tournamentId) || []
    const userAttendance = attendanceDetails.find((a: any) => a.player?.id === playerId)
    let newStatus = 'ATTEND'
    if (userAttendance) {
      newStatus = userAttendance.status === 'ATTEND' ? 'NOT_ATTEND' : 'ATTEND'
    }
    const response = await apiClient.put(`/tournaments/${tournamentId}/attendance`, {
      playerId,
      status: newStatus
    })
    if (response.success) {
      toast.success('Attendance updated!')
      // Force refresh and reactivity
      await fetchAttendanceDetails(tournamentId)
      // Reassign the map to trigger reactivity
      attendanceDetailsMap.value = new Map(attendanceDetailsMap.value)
    } else {
      toast.error(response.error || 'Failed to update attendance')
    }
  } catch (error: any) {
    console.error('Error toggling attendance:', error)
    toast.error(error.response?.data?.error || 'Failed to update attendance')
  } finally {
    attendanceLoading.value.delete(tournamentId)
  }
}

const deleteTournament = async (tournamentId: string) => {
  if (confirm('Are you sure you want to delete this tournament? This action cannot be undone.')) {
    try {
      const response = await apiClient.delete(`/tournaments/${tournamentId}`)
      
      if (response.success) {
        toast.success('Tournament deleted successfully!')
        await fetchData()
      } else {
        toast.error(response.error || 'Failed to delete tournament')
      }
    } catch (error: any) {
      console.error('Error deleting tournament:', error)
      toast.error('Failed to delete tournament')
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
    description: 'Tournament cost per player'
  })
  
  const total = changes.reduce((sum, change) => sum + change.amount, 0)
  
  return { changes, total }
}
</script>
