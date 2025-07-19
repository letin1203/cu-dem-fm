<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
    <div class="p-4 sm:p-6">
      <!-- Tournament Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 mb-4">
        <div>
          <h3 class="text-lg font-semibold text-gray-900">{{ tournament.name }}</h3>
          <div class="flex items-center space-x-3">
            <span 
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              :class="getStatusBadgeClass(tournament.status)"
            >
              {{ tournament.status }}
            </span>
            <p class="text-sm text-gray-600">{{ formatDate(tournament.startDate) }} {{ formatTime(tournament.startDate) }}</p>
          </div>
        </div>
        
        <!-- Action Buttons - Money and Delete only, aligned right -->
        <div class="flex items-center space-x-2">
          <!-- Money/Additional Costs Button -->
          <button
            v-if="authStore.hasRole('admin')"
            @click="$emit('open-additional-costs', tournament.id)"
            class="text-green-600 hover:text-green-800"
            title="Manage Additional Costs"
          >
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </button>
          
          <!-- Delete Button -->
          <button
            v-if="authStore.hasPermission('canDeleteTournaments')"
            @click="$emit('delete-tournament', tournament.id)"
            class="text-red-600 hover:text-red-800"
            title="Delete Tournament"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Financial Information -->
      <div v-if="systemSettings" class="flex flex-wrap items-center gap-4 mt-2 text-sm mb-4">
        <span class="text-green-600 font-medium">
          💰 Sponsor: ${{ systemSettings.sponsorMoney.toLocaleString() }}
        </span>
        <span class="text-red-600 font-medium">
          🏟️ Stadium: ${{ systemSettings.stadiumCost.toLocaleString() }}
        </span>
        <span class="text-orange-600 font-medium">
          💸 Additional: ${{ getTournamentAdditionalCostsTotal().toLocaleString() }}
        </span>
        <span class="text-blue-600 font-medium">
          📊 Net: -${{ calculateTournamentNet().toLocaleString() }}
        </span>
        <span v-if="getAttendingCount() > 0" class="text-purple-600 font-medium">
          👥 Est. Cost per Player: -${{ calculateCostPerPlayer().toLocaleString() }}
        </span>
      </div>

      <!-- Attendance Progress Bar -->
      <div class="mt-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-gray-200 mb-4">
        <div class="flex justify-between items-center mb-3">
          <span class="text-sm font-semibold text-gray-800">Player Attendance</span>
          <span class="text-sm font-medium text-gray-700 bg-white px-2 py-1 rounded-full">
            {{ getAttendingCount() }} / {{ getTotalPlayersCount() }}
          </span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-4 mb-3 shadow-inner">
          <div 
            class="bg-gradient-to-r from-green-500 to-green-600 h-4 rounded-full transition-all duration-700 ease-out shadow-sm relative overflow-hidden"
            :style="{ width: `${getAttendancePercentage()}%` }"
          >
            <div class="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
          </div>
        </div>
        
        <!-- Attendance breakdown -->
        <div class="flex justify-between text-xs text-gray-600">
          <div class="flex space-x-4">
            <span 
              class="text-green-600 cursor-pointer hover:text-green-800 hover:underline"
              @click="$emit('open-attendance', tournament.id, 'attending')"
            >
              {{ getAttendingCount() }} Attending
            </span>
            <span 
              class="text-red-600 cursor-pointer hover:text-red-800 hover:underline"
              @click="$emit('open-attendance', tournament.id, 'not-attending')"
            >
              {{ getNotAttendingCount() }} Not Attending
            </span>
            <span 
              class="text-green-600 cursor-pointer hover:text-green-800 hover:underline"
              @click="$emit('open-attendance', tournament.id, 'water')"
            >
              {{ getWaterCount() }} Water
            </span>
            <span 
              class="text-yellow-600 cursor-pointer hover:text-yellow-800 hover:underline"
              @click="$emit('open-attendance', tournament.id, 'betting')"
            >
              {{ getBettingCount() }} Betting
            </span>
          </div>
        </div>
      </div>

      <!-- Attendance Toggle Button -->
      <div v-if="tournament.status === 'UPCOMING' && getAttendanceButtonText() !== 'No Player'" class="flex justify-center pt-2 border-t border-gray-200 mb-4">
        <div class="flex space-x-3">
          <!-- Attend Button -->
          <button
            @click="$emit('toggle-attendance', tournament.id)"
            :disabled="attendanceLoading"
            class="px-6 py-2 rounded-lg font-medium transition-colors duration-200"
            :class="[
              attendanceLoading
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:shadow-md',
              getAttendanceButtonText() === 'Attend'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : getAttendanceButtonText() === 'Attended'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-red-600 text-white hover:bg-red-700'
            ]"
          >
            <div class="flex items-center space-x-1">
              <span>{{ attendanceLoading ? 'Loading...' : getAttendanceButtonText() }}</span>
              <!-- Check icon (only shown when attended) -->
              <svg 
                v-if="getAttendanceButtonText() === 'Attended'" 
                class="w-4 h-4" 
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
            </div>
          </button>

          <!-- Water Button -->
          <button
            v-if="getUserAttendanceStatus() === 'ATTEND'"
            @click="$emit('toggle-water', tournament.id)"
            :disabled="waterLoading"
            class="px-4 py-2 rounded-lg font-medium transition-colors duration-200"
            :class="[
              waterLoading
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:shadow-md',
              getUserWaterStatus()
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            ]"
          >
            <div class="flex items-center space-x-1">
              <span>{{ waterLoading ? 'Loading...' : (getUserWaterStatus() ? 'Water ✓' : 'Water') }}</span>
            </div>
          </button>

          <!-- Bet Button -->
          <button
            v-if="getUserAttendanceStatus() === 'ATTEND'"
            @click="$emit('toggle-bet', tournament.id)"
            :disabled="betLoading"
            class="px-4 py-2 rounded-lg font-medium transition-colors duration-200"
            :class="[
              betLoading
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:shadow-md',
              getUserBetStatus()
                ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            ]"
          >
            <div class="flex items-center space-x-1">
              <span>{{ betLoading ? 'Loading...' : (getUserBetStatus() ? 'Bet ✓' : 'Bet') }}</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Random Team Button (Admin/Mod only) -->
      <div v-if="tournament.status === 'UPCOMING'" class="flex flex-col items-center pt-2 border-t border-gray-200 mb-4">
        <div class="flex space-x-3">
          <button
            v-if="authStore.hasPermission('canEditTournaments') && tournamentTeams.length === 0" 
            @click="$emit('generate-teams', tournament.id)"
            :disabled="!canGenerateTeams || generateTeamsLoading"
            class="px-6 py-2 rounded-lg font-medium transition-colors duration-200"
            :class="[
              !canGenerateTeams || generateTeamsLoading
                ? 'opacity-50 cursor-not-allowed bg-gray-400 text-white' 
                : 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md'
            ]"
          >
            {{ generateTeamsLoading ? 'Generating...' : 'Random Team' }}
          </button>
          <button
            v-if="authStore.hasPermission('canEditTournaments') && tournamentTeams.length > 0"
            @click="$emit('clear-teams', tournament.id)"
            :disabled="clearTeamsLoading"
            class="px-6 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 hover:shadow-md transition-colors duration-200"
          >
            {{ clearTeamsLoading ? 'Clearing...' : 'Clear Teams' }}
          </button>
        </div>
        
        <div v-if="canGenerateTeams && tournamentTeams.length === 0" class="text-sm text-gray-500 mt-2">
          Will create {{ getExpectedTeamCount() }} balanced teams
        </div>
      </div>

      <!-- Teams Display -->
      <div v-if="tournamentTeams.length > 0" class="space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="font-medium text-gray-900">Teams ({{ tournamentTeams.length }})</h4>
          <button
            v-if="authStore.hasPermission('canEditTournaments')"
            @click="$emit('open-additional-costs', tournament.id)"
            class="text-sm text-primary-600 hover:text-primary-800"
          >
            Additional Costs
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div 
            v-for="(team, index) in tournamentTeams" 
            :key="team.id"
            class="border border-gray-200 rounded-lg p-3"
          >
            <div class="flex items-center justify-between mb-2">
              <h5 class="font-medium text-gray-900">{{ team.name }}</h5>
              <div class="flex items-center space-x-2">
                <input
                  v-if="authStore.hasPermission('canEditTournaments')"
                  v-model.number="team.score"
                  @blur="$emit('update-score', tournament.id, team.id, team.score || 0)"
                  type="number"
                  min="0"
                  class="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Score"
                />
                <span v-else class="text-sm font-medium">{{ team.score || 0 }}</span>
              </div>
            </div>
            
            <div class="space-y-1">
              <div v-for="player in getTeamPlayers(team.id)" :key="player.id" class="text-sm text-gray-600">
                {{ player.name }} ({{ player.position }}, T{{ player.tier }})
              </div>
            </div>
            
            <div class="mt-2 text-xs text-gray-500">
              <span>GK: {{ getTeamGoalkeeperCount(team.id) }}</span>
              <span class="mx-2">•</span>
              <span>Tier 9+: {{ getTeamTier9PlusCount(team.id) }}</span>
              <span class="mx-2">•</span>
              <span>Total Tier: {{ getTeamTotalTier(team.id) }}</span>
            </div>
          </div>
        </div>

        <!-- Cost Summary -->
        <div class="bg-gray-50 p-3 rounded-lg text-sm">
          <div class="flex justify-between">
            <span>Cost per player:</span>
            <span>{{ calculateCostPerPlayer().toLocaleString() }} VND</span>
          </div>
        </div>
      </div>
      
      <div v-else class="text-center py-4 text-gray-500">
        No teams generated yet
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '../../stores/auth'
import type { Tournament } from '../../types'

interface Props {
  tournament: Tournament
  attendanceDetails: any[]
  tournamentTeamPlayers: any[]
  additionalCosts: any[]
  systemSettings: any
  attendanceLoading: boolean
  currentUser: any
  totalPlayers: number
  generateTeamsLoading: boolean
  clearTeamsLoading: boolean
  waterLoading: boolean
  betLoading: boolean
}

const props = defineProps<Props>()

const authStore = useAuthStore()

// Computed properties
const tournamentTeams = computed(() => {
  return props.tournament.teams || []
})

const canGenerateTeams = computed(() => {
  return authStore.hasPermission('canEditTournaments') && 
         getAttendingCount() >= 6 && 
         tournamentTeams.value.length === 0
})

const canClearTeams = computed(() => {
  return authStore.hasPermission('canEditTournaments') && 
         tournamentTeams.value.length > 0
})

const canEndTournament = computed(() => {
  return authStore.hasPermission('canEditTournaments') && 
         tournamentTeams.value.length > 0 && 
         props.tournament.status === 'ONGOING'
})

const canEndTournamentBasedOnScores = computed(() => {
  if (tournamentTeams.value.length < 2) return false
  
  const scores = tournamentTeams.value.map(team => team.score || 0)
  const maxScore = Math.max(...scores)
  const minScore = Math.min(...scores)
  
  return maxScore !== minScore
})

// Helper functions
const formatDate = (dateString: string | Date) => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const formatTime = (dateString: string | Date) => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'UPCOMING':
      return 'bg-blue-100 text-blue-800'
    case 'ONGOING':
      return 'bg-green-100 text-green-800'
    case 'COMPLETED':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getAttendingCount = () => {
  if (!props.attendanceDetails || !Array.isArray(props.attendanceDetails)) return 0
  return props.attendanceDetails.filter(detail => detail.status === 'ATTEND').length
}

const getNotAttendingCount = () => {
  if (!props.attendanceDetails || !Array.isArray(props.attendanceDetails)) return 0
  return props.attendanceDetails.filter(detail => detail.status === 'NOT_ATTEND').length
}

const getWaterCount = () => {
  if (!props.attendanceDetails || !Array.isArray(props.attendanceDetails)) return 0
  return props.attendanceDetails.filter(detail => detail.withWater === true).length
}

const getBettingCount = () => {
  if (!props.attendanceDetails || !Array.isArray(props.attendanceDetails)) return 0
  return props.attendanceDetails.filter(detail => detail.bet === true).length
}

const getTeamPlayers = (teamId: string) => {
  return props.tournamentTeamPlayers
    .filter(ttp => ttp.teamId === teamId)
    .map(ttp => ttp.player)
    .filter(Boolean)
}

const getTeamGoalkeeperCount = (teamId: string) => {
  return getTeamPlayers(teamId).filter(player => player.position === 'GK').length
}

const getTeamTier9PlusCount = (teamId: string) => {
  return getTeamPlayers(teamId).filter(player => player.tier >= 9).length
}

const getTeamTotalTier = (teamId: string) => {
  return getTeamPlayers(teamId).reduce((sum, player) => sum + player.tier, 0)
}

const getTotalPlayersCount = () => {
  // Use total players in the system, not just attendance details
  return props.totalPlayers || 0
}

const getAttendancePercentage = () => {
  const total = getTotalPlayersCount()
  if (total === 0) return 0
  return Math.round((getAttendingCount() / total) * 100)
}

const getExpectedTeamCount = () => {
  const attendingCount = getAttendingCount()
  if (attendingCount < 15) return 2
  if (attendingCount < 20) return 3
  return 4
}

const getTournamentAdditionalCostsTotal = () => {
  if (!props.additionalCosts) return 0
  return props.additionalCosts.reduce((total: number, cost: any) => total + cost.amount, 0)
}

const calculateTournamentNet = () => {
  if (!props.systemSettings) return 0
  const sponsor = props.systemSettings.sponsorMoney
  const stadium = props.systemSettings.stadiumCost
  const additional = getTournamentAdditionalCostsTotal()
  return Math.abs(sponsor - stadium - additional)
}

const calculateCostPerPlayer = () => {
  const attendingCount = getAttendingCount()
  if (attendingCount === 0) return 0
  return Math.round(calculateTournamentNet() / attendingCount)
}

const getAttendanceButtonText = () => {
  if (!props.currentUser) return 'No Player'
  
  const userAttendance = props.attendanceDetails.find(
    attendance => attendance.player.id === props.currentUser.playerId
  )
  
  if (!userAttendance) return 'Attend'
  
  switch (userAttendance.status) {
    case 'ATTEND':
      return 'Attended'
    case 'NOT_ATTEND':
      return 'Not Attend'
    default:
      return 'Attend'
  }
}

const getUserAttendanceStatus = () => {
  if (!props.currentUser) return null
  const userAttendance = props.attendanceDetails.find(
    attendance => attendance.player.id === props.currentUser.playerId
  )
  return userAttendance ? userAttendance.status : null
}

const getUserWaterStatus = () => {
  if (!props.currentUser) return false
  const userAttendance = props.attendanceDetails.find(
    attendance => attendance.player.id === props.currentUser.playerId
  )
  return userAttendance ? !!userAttendance.withWater : false
}

const getUserBetStatus = () => {
  if (!props.currentUser) return false
  const userAttendance = props.attendanceDetails.find(
    attendance => attendance.player.id === props.currentUser.playerId
  )
  return userAttendance ? !!userAttendance.bet : false
}

// Define emits
defineEmits<{
  'generate-teams': [tournamentId: string]
  'clear-teams': [tournamentId: string]
  'end-tournament': [tournamentId: string]
  'open-attendance': [tournamentId: string, filter: string]
  'open-additional-costs': [tournamentId: string]
  'update-score': [tournamentId: string, teamId: string, score: number]
  'toggle-attendance': [tournamentId: string]
  'toggle-water': [tournamentId: string]
  'toggle-bet': [tournamentId: string]
  'delete-tournament': [tournamentId: string]
}>()
</script>
