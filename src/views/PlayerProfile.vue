<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">My Player Profile</h1>
      <button 
        @click="refreshPlayerProfile" 
        :disabled="loading"
        class="btn-secondary inline-flex items-center space-x-2"
      >
        <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>{{ loading ? 'Refreshing...' : 'Refresh' }}</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-8">
      <div class="text-red-600 mb-2">{{ error }}</div>
      <button @click="fetchPlayerProfile" class="btn-secondary">
        Try Again
      </button>
    </div>

    <!-- No Player Linked -->
    <div v-else-if="!playerProfile" class="text-center py-8">
      <div class="text-gray-500 mb-4">
        <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <p class="text-lg font-medium">No Player Profile Found</p>
        <p class="text-sm">Your account is not linked to a player profile.</p>
      </div>
      <div class="text-sm text-gray-600">
        <p>Contact an administrator to link your account to a player profile.</p>
      </div>
    </div>

    <!-- Player Profile -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Player Info Card -->
      <div class="lg:col-span-1">
        <div class="card">
          <div class="text-center">
            <div class="mx-auto h-20 w-20 rounded-full bg-gray-300 flex items-center justify-center mb-4">
              <svg class="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 class="text-xl font-bold text-gray-900 mb-2">{{ playerProfile.name }}</h2>
            <p class="text-gray-600 mb-4">{{ playerProfile.position }}</p>
            
            <!-- Player Tier/Rating -->
            <div class="flex justify-center items-center mb-4">
              <span class="text-sm text-gray-500 mr-2">Rating:</span>
              <div class="flex items-center">
                <div 
                  v-for="star in playerProfile.tier" 
                  :key="star"
                  class="w-4 h-4 text-yellow-400 flex items-center justify-center"
                >
                  ★
                </div>
                <div 
                  v-for="emptyStar in (10 - playerProfile.tier)" 
                  :key="emptyStar"
                  class="w-4 h-4 text-gray-300 flex items-center justify-center"
                >
                  ★
                </div>
              </div>
              <span class="text-sm text-gray-600 ml-2">({{ playerProfile.tier }}/10)</span>
            </div>
          </div>

          <div class="border-t pt-4 space-y-3">
            <div class="flex justify-between">
              <span class="text-gray-600">Year of Birth:</span>
              <span class="font-medium">{{ playerProfile.yearOfBirth }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Age:</span>
              <span class="font-medium">{{ currentAge }} years old</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Money:</span>
              <span class="font-medium text-green-600">${{ playerProfile.money.toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Statistics Card -->
      <div class="lg:col-span-2">
        <div class="card">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Career Statistics</h3>
          
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div class="text-center p-4 bg-gray-50 rounded-lg">
              <div class="text-2xl font-bold text-blue-600">{{ playerProfile.stats?.gamesPlayed || 0 }}</div>
              <div class="text-sm text-gray-600">Games Played</div>
            </div>
            
            <div class="text-center p-4 bg-gray-50 rounded-lg">
              <div class="text-2xl font-bold text-green-600">{{ playerProfile.stats?.goals || 0 }}</div>
              <div class="text-sm text-gray-600">Goals</div>
            </div>
            
            <div class="text-center p-4 bg-gray-50 rounded-lg">
              <div class="text-2xl font-bold text-purple-600">{{ playerProfile.stats?.assists || 0 }}</div>
              <div class="text-sm text-gray-600">Assists</div>
            </div>
            
            <div class="text-center p-4 bg-gray-50 rounded-lg">
              <div class="text-2xl font-bold text-yellow-600">{{ playerProfile.stats?.yellowCards || 0 }}</div>
              <div class="text-sm text-gray-600">Yellow Cards</div>
            </div>
            
            <div class="text-center p-4 bg-gray-50 rounded-lg">
              <div class="text-2xl font-bold text-red-600">{{ playerProfile.stats?.redCards || 0 }}</div>
              <div class="text-sm text-gray-600">Red Cards</div>
            </div>
            
            <div class="text-center p-4 bg-gray-50 rounded-lg">
              <div class="text-2xl font-bold text-indigo-600">{{ formatMinutes(playerProfile.stats?.minutesPlayed || 0) }}</div>
              <div class="text-sm text-gray-600">Minutes Played</div>
            </div>
          </div>

          <!-- Additional Statistics -->
          <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="p-4 border rounded-lg">
              <h4 class="font-medium text-gray-900 mb-2">Performance Metrics</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-600">Goals per Game:</span>
                  <span class="font-medium">{{ goalsPerGame }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Assists per Game:</span>
                  <span class="font-medium">{{ assistsPerGame }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Minutes per Game:</span>
                  <span class="font-medium">{{ minutesPerGame }}</span>
                </div>
              </div>
            </div>

            <div class="p-4 border rounded-lg">
              <h4 class="font-medium text-gray-900 mb-2">Discipline Record</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-600">Cards per Game:</span>
                  <span class="font-medium">{{ cardsPerGame }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Total Cards:</span>
                  <span class="font-medium">{{ totalCards }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Discipline Rating:</span>
                  <span class="font-medium" :class="disciplineColor">{{ disciplineRating }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Matches (if available) -->
    <div v-if="playerProfile && recentMatches.length > 0" class="card">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Recent Matches</h3>
      <div class="space-y-2">
        <div 
          v-for="match in recentMatches.slice(0, 5)" 
          :key="match.id"
          class="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
        >
          <div class="flex items-center space-x-4">
            <div class="text-sm">
              <div class="font-medium">{{ match.homeTeam?.name }} vs {{ match.awayTeam?.name }}</div>
              <div class="text-gray-500">{{ formatMatchDate(match.scheduledDate) }}</div>
            </div>
          </div>
          <div class="text-right">
            <div class="font-medium">{{ match.homeScore }} - {{ match.awayScore }}</div>
            <div class="text-xs text-gray-500">{{ match.status }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { usePlayersStore } from '../stores/players'
import { useTeamsStore } from '../stores/teams'
import { useMatchesStore } from '../stores/matches'
import type { Player, Team, Match } from '../types'

const authStore = useAuthStore()
const playersStore = usePlayersStore()
const teamsStore = useTeamsStore()
const matchesStore = useMatchesStore()

const loading = ref(false)
const error = ref<string | null>(null)
const playerProfile = ref<Player | null>(null)
const recentMatches = ref<Match[]>([])

// Computed properties
const currentAge = computed(() => {
  if (!playerProfile.value) return 0
  return new Date().getFullYear() - playerProfile.value.yearOfBirth
})

const goalsPerGame = computed(() => {
  if (!playerProfile.value?.stats?.gamesPlayed || playerProfile.value.stats.gamesPlayed === 0) return '0.00'
  return (playerProfile.value.stats.goals / playerProfile.value.stats.gamesPlayed).toFixed(2)
})

const assistsPerGame = computed(() => {
  if (!playerProfile.value?.stats?.gamesPlayed || playerProfile.value.stats.gamesPlayed === 0) return '0.00'
  return (playerProfile.value.stats.assists / playerProfile.value.stats.gamesPlayed).toFixed(2)
})

const minutesPerGame = computed(() => {
  if (!playerProfile.value?.stats?.gamesPlayed || playerProfile.value.stats.gamesPlayed === 0) return '0'
  return Math.round(playerProfile.value.stats.minutesPlayed / playerProfile.value.stats.gamesPlayed)
})

const totalCards = computed(() => {
  if (!playerProfile.value?.stats) return 0
  return (playerProfile.value.stats.yellowCards || 0) + (playerProfile.value.stats.redCards || 0)
})

const cardsPerGame = computed(() => {
  if (!playerProfile.value?.stats?.gamesPlayed || playerProfile.value.stats.gamesPlayed === 0) return '0.00'
  return (totalCards.value / playerProfile.value.stats.gamesPlayed).toFixed(2)
})

const disciplineRating = computed(() => {
  const cards = totalCards.value
  const games = playerProfile.value?.stats?.gamesPlayed || 0
  
  if (games === 0) return 'N/A'
  
  const cardRate = cards / games
  if (cardRate === 0) return 'Excellent'
  if (cardRate <= 0.1) return 'Very Good'
  if (cardRate <= 0.3) return 'Good'
  if (cardRate <= 0.5) return 'Fair'
  return 'Poor'
})

const disciplineColor = computed(() => {
  const rating = disciplineRating.value
  switch (rating) {
    case 'Excellent':
    case 'Very Good':
      return 'text-green-600'
    case 'Good':
      return 'text-blue-600'
    case 'Fair':
      return 'text-yellow-600'
    case 'Poor':
      return 'text-red-600'
    default:
      return 'text-gray-600'
  }
})

// Helper functions
const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

const formatMatchDate = (date: Date | string): string => {
  const matchDate = typeof date === 'string' ? new Date(date) : date
  return matchDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Fetch player profile data
const fetchPlayerProfile = async () => {
  loading.value = true
  error.value = null

  try {
    // Check if user has a direct player object (from login response)
    if (authStore.currentUser?.player) {
      playerProfile.value = authStore.currentUser.player
      
      // Fetch teams data to get team information
      await teamsStore.fetchTeams()
      
      // Fetch recent matches where this player's team participated
      await matchesStore.fetchMatches()
      if (playerProfile.value.teamId) {
        recentMatches.value = matchesStore.matches
          .filter(match => 
            match.homeTeam.id === playerProfile.value?.teamId || 
            match.awayTeam.id === playerProfile.value?.teamId
          )
          .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
      }
      return
    }

    // Fallback: check for playerId and fetch from players store
    if (!authStore.currentUser?.playerId) {
      playerProfile.value = null
      return
    }

    // Fetch all players to get the current user's player profile
    await playersStore.fetchPlayers()
    
    // Find the player linked to the current user
    const linkedPlayer = playersStore.players.find(
      player => player.id === authStore.currentUser?.playerId
    )

    if (linkedPlayer) {
      playerProfile.value = linkedPlayer
      
      // Fetch teams data to get team information
      await teamsStore.fetchTeams()
      
      // Fetch recent matches where this player's team participated
      await matchesStore.fetchMatches()
      if (linkedPlayer.teamId) {
        recentMatches.value = matchesStore.matches
          .filter(match => 
            match.homeTeam.id === linkedPlayer.teamId || 
            match.awayTeam.id === linkedPlayer.teamId
          )
          .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
      }
    } else {
      playerProfile.value = null
    }
  } catch (err) {
    console.error('Error fetching player profile:', err)
    error.value = 'Failed to load player profile. Please try again.'
  } finally {
    loading.value = false
  }
}

// Refresh player profile with fresh data
const refreshPlayerProfile = async () => {
  // Force refresh by clearing cached data and getting fresh user data
  await authStore.getCurrentUser()
  await playersStore.fetchPlayers()
  await fetchPlayerProfile()
}

// Lifecycle
onMounted(() => {
  fetchPlayerProfile()
})
</script>
