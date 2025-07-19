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
          💰 Sponsor: {{ systemSettings.sponsorMoney.toLocaleString() }} VND
        </span>
        <span class="text-red-600 font-medium">
          🏟️ Stadium: {{ systemSettings.stadiumCost.toLocaleString() }} VND
        </span>
        <span class="text-orange-600 font-medium">
          💸 Additional: {{ getTournamentAdditionalCostsTotal().toLocaleString() }} VND
        </span>
        <span class="text-blue-600 font-medium">
          📊 Net: {{ calculateTournamentNet().toLocaleString() }} VND
        </span>
        <span v-if="getAttendingCount() > 0" class="text-purple-600 font-medium">
          👥 Est. Cost per Player: {{ calculateCostPerPlayer().toLocaleString() }} VND
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
              'bg-green-600 text-white hover:bg-green-700'
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
            @click="handleWaterClick"
            :disabled="waterLoading || waterDebounce"
            class="px-4 py-2 rounded-lg font-medium transition-colors duration-200"
            :class="[
              (waterLoading || waterDebounce) === true
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:shadow-md',
              getUserWaterStatus()
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            ]"
          >
            <div class="flex items-center space-x-1">
              <span>{{ waterLoading === true ? 'Loading...' : (getUserWaterStatus() ? 'Water ✓' : 'Water') }}</span>
            </div>
          </button>

          <!-- Bet Button -->
          <button
            v-if="getUserAttendanceStatus() === 'ATTEND'"
            @click="handleBetClick"
            :disabled="betLoading || betDebounce"
            class="px-4 py-2 rounded-lg font-medium transition-colors duration-200"
            :class="[
              (betLoading || betDebounce) === true
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:shadow-md',
              getUserBetStatus()
                ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            ]"
          >
            <div class="flex items-center space-x-1">
              <span>{{ betLoading === true ? 'Loading...' : (getUserBetStatus() ? 'Bet ✓' : 'Bet') }}</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Random Team Button (Admin/Mod only) -->
      <div v-if="tournament.status === 'UPCOMING' || tournament.status === 'ONGOING'" class="flex flex-col items-center pt-2 border-t border-gray-200 mb-4">
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
            v-if="authStore.hasPermission('canEditTournaments') && tournament.status === 'UPCOMING' && tournamentTeams.length > 0"
            @click="$emit('clear-teams', tournament.id)"
            :disabled="clearTeamsLoading"
            class="px-6 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 hover:shadow-md transition-colors duration-200"
          >
            {{ clearTeamsLoading ? 'Clearing...' : 'Clear Teams' }}
          </button>
          <button
            v-if="authStore.hasPermission('canEditTournaments') && tournament.status === 'UPCOMING' && tournamentTeams.length > 0"
            @click="$emit('start-tournament', tournament.id)"
            class="px-6 py-2 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 hover:shadow-md transition-colors duration-200"
          >
            Start Tournament
          </button>
          <button
            v-if="authStore.hasPermission('canEditTournaments') && tournament.status === 'ONGOING' && tournamentTeams.length > 0"
            @click="$emit('open-scores', tournament.id)"
            class="px-6 py-2 rounded-lg font-medium bg-primary-600 text-white hover:bg-primary-700 hover:shadow-md transition-colors duration-200"
          >
            Scores
          </button>
        </div>
        <div v-if="canGenerateTeams && tournamentTeams.length === 0" class="text-sm text-gray-500 mt-2">
          Will create {{ getExpectedTeamCount() }} balanced teams
        </div>
      </div>

      <!-- Teams Display -->
      <div v-if="tournamentTeams.length > 0" class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 class="text-lg font-semibold text-gray-800 mb-3 flex items-center">
          <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.196-2.196M5 20h5v-2a3 3 0 015.196-2.196M12 4v.01M12 4a7 7 0 018 7c0 2-1 3-1 3s-1 1-1 3v2H8v-2s-1-1-1-3c0-2 1-3 1-3a7 7 0 018-7z" />
          </svg>
          Tournament Teams ({{ tournamentTeams.length }})
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div
            v-for="team in tournamentTeams"
            :key="team.id"
            class="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
          >
            <!-- Team Header -->
            <div class="flex items-center mb-3">
              <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                <span class="text-white font-bold text-lg">{{ team.name }}</span>
              </div>
              <div class="flex-1">
                <div class="flex items-center justify-between">
                  <h5 class="font-semibold text-gray-900">{{ team.name }}</h5>
                  <span v-if="tournament.status === 'COMPLETED'" class="text-lg font-bold text-gray-600 flex items-center">
                    ⚽: {{ team.score || 0 }}
                  </span>
                  <input
                    v-else-if="authStore.hasPermission('canEditTournaments')"
                    v-model.number="team.score"
                    @blur="$emit('update-score', tournament.id, team.id, team.score || 0)"
                    type="number"
                    min="0"
                    class="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Score"
                  />
                  <span v-else class="text-sm font-medium">{{ team.score || 0 }}</span>
                </div>
                <p class="text-sm text-gray-600">{{ getTeamPlayers(team.id).length }} players</p>
              </div>
            </div>

            <!-- Team Players -->
            <div v-if="getTeamPlayers(team.id).length > 0" class="space-y-2">
              <div
                v-for="player in getTeamPlayers(team.id)"
                :key="player.id"
                class="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
              >
                <div class="flex items-center">
                  <div class="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center mr-2 text-xs font-medium">
                    {{ player.name.charAt(0).toUpperCase() }}
                  </div>
                  <span class="font-medium text-gray-900">{{ player.name }}</span>
                </div>
                <div class="flex items-center text-gray-600">
                  <span class="text-xs mr-1">{{ player.position }}</span>
                  <span class="text-xs">T{{ player.tier }}</span>
                </div>
              </div>
            </div>

            <!-- Team Stats -->
            <div v-if="getTeamPlayers(team.id).length > 0" class="mt-3 pt-3 border-t border-gray-200">
              <div class="flex justify-between text-xs text-gray-600">
                <span>Total Tier: {{ getTeamTotalTier(team.id) }}</span>
                <span>Avg: {{ (getTeamTotalTier(team.id) / getTeamPlayers(team.id).length).toFixed(1) }}</span>
              </div>
            </div>
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
import { computed, ref } from 'vue'
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

// Debounce for Bet button
const betDebounce = ref(false)
const waterDebounce = ref(false)

// ...existing code...

function handleBetClick() {
  if (betDebounce.value || props.betLoading) return
  betDebounce.value = true
  setTimeout(() => { betDebounce.value = false }, 500)
  emit('toggle-bet', props.tournament.id, props.currentUser.player.id)
}

function handleWaterClick() {
  if (waterDebounce.value || props.waterLoading) return
  waterDebounce.value = true
  setTimeout(() => { waterDebounce.value = false }, 500)
  emit('toggle-water', props.tournament.id, props.currentUser.player.id)
}

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

// Money calculation logic (ref WeeklyTournament.vue)
const calculateTournamentNet = () => {
  if (!props.systemSettings) return 0
  const sponsor = props.systemSettings.sponsorMoney || 0
  const stadium = props.systemSettings.stadiumCost || 0
  const additional = getTournamentAdditionalCostsTotal() || 0
  // Net = Stadium + Additional - Sponsor
  return stadium + additional - sponsor
}

const calculateCostPerPlayer = () => {
  const net = calculateTournamentNet()
  const attendingCount = getAttendingCount()
  if (attendingCount === 0) return 0
  const baseCost = net / attendingCount
  // Round up to nearest 5000 and add 5000
  const roundedUp = Math.ceil(baseCost / 5000) * 5000
  return roundedUp + 5000
}

const getAttendanceButtonText = () => {
  if (!props.currentUser || !props.currentUser.player) return 'No Player'
  const playerId = props.currentUser.player.id
  const userAttendance = props.attendanceDetails.find(
    attendance => attendance.player && attendance.player.id === playerId
  )
  // WeeklyTournament logic: If NOT_ATTEND, show 'Attend' and green button
  if (!userAttendance || userAttendance.status === 'NOT_ATTEND') return 'Attend'
  if (userAttendance.status === 'ATTEND') return 'Attended'
  return 'Attend'
}

const getUserAttendanceStatus = () => {
  if (!props.currentUser || !props.currentUser.player) return null
  const playerId = props.currentUser.player.id
  const userAttendance = props.attendanceDetails.find(
    attendance => attendance.player && attendance.player.id === playerId
  )
  return userAttendance ? userAttendance.status : null
}

const getUserWaterStatus = () => {
  if (!props.currentUser || !props.currentUser.player) return false
  const playerId = props.currentUser.player.id
  const userAttendance = props.attendanceDetails.find(
    attendance => attendance.player && attendance.player.id === playerId
  )
  return userAttendance ? !!userAttendance.withWater : false
}

const getUserBetStatus = () => {
  if (!props.currentUser || !props.currentUser.player) return false
  const playerId = props.currentUser.player.id
  const userAttendance = props.attendanceDetails.find(
    attendance => attendance.player && attendance.player.id === playerId
  )
  return userAttendance ? !!userAttendance.bet : false
}

// Define emits
const emit = defineEmits<{
  'generate-teams': [tournamentId: string]
  'clear-teams': [tournamentId: string]
  'end-tournament': [tournamentId: string]
  'open-attendance': [tournamentId: string, filter: string]
  'open-additional-costs': [tournamentId: string]
  'update-score': [tournamentId: string, teamId: string, score: number]
  'toggle-attendance': [tournamentId: string]
  'toggle-water': [tournamentId: string, playerId: string]
  'toggle-bet': [tournamentId: string, playerId: string]
  'delete-tournament': [tournamentId: string]
  'start-tournament': [tournamentId: string]
  'open-scores': [tournamentId: string]
}>()
</script>
