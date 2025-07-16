<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Matches</h1>
      <button 
        v-if="authStore.hasPermission('canEditMatches')"
        @click="openAddForm" 
        class="btn-primary w-full sm:w-auto"
      >
        Schedule New Match
      </button>
    </div>

    <!-- Filter Tabs -->
    <div class="border-b border-gray-200">
      <nav class="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
        <button
          v-for="filter in filters"
          :key="filter"
          @click="activeFilter = filter"
          :class="[
            'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0',
            activeFilter === filter
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          {{ filter }}
        </button>
      </nav>
    </div>

    <!-- Matches List -->
    <div class="space-y-3 sm:space-y-4">
      <div
        v-for="match in filteredMatches"
        :key="match.id"
        class="card hover:shadow-lg transition-shadow"
      >
        <!-- Mobile Layout -->
        <div class="block sm:hidden">
          <div class="flex items-center justify-between mb-3">
            <div class="text-xs text-gray-500">
              {{ formatDate(match.scheduledDate) }}
            </div>
          </div>
          
          <div class="text-center">
            <div class="flex items-center justify-between">
              <div class="text-right flex-1">
                <div class="font-medium text-gray-900 text-sm">{{ match.homeTeam.name }}</div>
                <div class="text-xs text-gray-500">Home</div>
              </div>
              
              <div class="mx-4">
                <span v-if="match.homeScore !== undefined && match.awayScore !== undefined" 
                      class="text-xl font-bold text-gray-900">
                  {{ match.homeScore }} - {{ match.awayScore }}
                </span>
                <span v-else class="text-lg text-gray-400">VS</span>
              </div>
              
              <div class="text-left flex-1">
                <div class="font-medium text-gray-900 text-sm">{{ match.awayTeam.name }}</div>
                <div class="text-xs text-gray-500">Away</div>
              </div>
            </div>
          </div>
          
          <div class="flex justify-center space-x-4 mt-4">
            <button
              v-if="authStore.hasPermission('canEditMatches')"
              @click="editMatch(match)"
              class="text-primary-600 hover:text-primary-800 text-sm"
            >
              Edit
            </button>
            <button
              v-if="authStore.hasPermission('canDeleteMatches')"
              @click="deleteMatch(match.id)"
              class="text-red-600 hover:text-red-800 text-sm"
            >
              Delete
            </button>
          </div>
        </div>

        <!-- Desktop Layout -->
        <div class="hidden sm:flex items-center justify-between">
          <div class="flex items-center space-x-6">
            <!-- Teams -->
            <div class="flex items-center space-x-4">
              <div class="text-right">
                <div class="font-medium text-gray-900">{{ match.homeTeam.name }}</div>
                <div class="text-sm text-gray-500">Home</div>
              </div>
              
              <div class="flex items-center space-x-2">
                <span v-if="match.homeScore !== undefined && match.awayScore !== undefined" 
                      class="text-2xl font-bold text-gray-900">
                  {{ match.homeScore }} - {{ match.awayScore }}
                </span>
                <span v-else class="text-lg text-gray-400">VS</span>
              </div>
              
              <div>
                <div class="font-medium text-gray-900">{{ match.awayTeam.name }}</div>
                <div class="text-sm text-gray-500">Away</div>
              </div>
            </div>
          </div>
          
          <div class="flex items-center space-x-4">
            <!-- Match Info -->
            <div class="text-right">
              <div class="text-sm text-gray-900">
                {{ formatDate(match.scheduledDate) }}
              </div>
              <div class="text-sm text-gray-500">
                {{ formatTime(match.scheduledDate) }}
              </div>
              <div v-if="match.venue" class="text-xs text-gray-400">
                {{ match.venue }}
              </div>
            </div>
            
            <!-- Status -->
            
            <!-- Actions -->
            <div class="flex space-x-2">
              <button
                v-if="authStore.hasPermission('canEditMatches')"
                @click="editMatch(match)"
                class="text-primary-600 hover:text-primary-800"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                v-if="authStore.hasPermission('canDeleteMatches')"
                @click="deleteMatch(match.id)"
                class="text-red-600 hover:text-red-800"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Match Events -->
        <div v-if="match.events && match.events.length > 0" class="mt-4 pt-4 border-t border-gray-200">
          <h4 class="text-sm font-medium text-gray-900 mb-3">Match Events</h4>
          
          <!-- Two-column layout for events -->
          <div class="grid grid-cols-2 gap-4">
            <!-- Home Team Events (Left) -->
            <div class="space-y-2">
              <h5 class="text-xs font-medium text-blue-800 bg-blue-50 px-2 py-1 rounded text-center">
                {{ match.homeTeam.name }}
              </h5>
              <div class="space-y-1">
                <div
                  v-for="event in getHomeEvents(match.events)"
                  :key="event.id"
                  class="p-2 bg-blue-50/50 rounded border border-blue-100"
                >
                  <div class="text-sm">
                    <div class="font-medium text-blue-900">{{ event.player?.name || event.playerName || 'Unknown Player' }}</div>
                    <div class="text-xs text-blue-600 capitalize flex items-center justify-between">
                      <span>{{ getEventTypeDisplay(event.type) }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="getHomeEvents(match.events).length === 0" class="text-xs text-blue-400 text-center py-2">
                  No events
                </div>
              </div>
            </div>
            
            <!-- Away Team Events (Right) -->
            <div class="space-y-2">
              <h5 class="text-xs font-medium text-red-800 bg-red-50 px-2 py-1 rounded text-center">
                {{ match.awayTeam.name }}
              </h5>
              <div class="space-y-1">
                <div
                  v-for="event in getAwayEvents(match.events)"
                  :key="event.id"
                  class="p-2 bg-red-50/50 rounded border border-red-100"
                >
                  <div class="text-sm">
                    <div class="font-medium text-red-900">{{ event.player?.name || event.playerName || 'Unknown Player' }}</div>
                    <div class="text-xs text-red-600 capitalize flex items-center justify-between">
                      <span>{{ getEventTypeDisplay(event.type) }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="getAwayEvents(match.events).length === 0" class="text-xs text-red-400 text-center py-2">
                  No events
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Match Modal -->
    <div v-if="showAddForm || editingMatch" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        <!-- Modal Header -->
        <div class="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0 bg-white rounded-t-lg">
          <h2 class="text-lg sm:text-xl font-semibold text-gray-900">
            {{ editingMatch ? 'Edit Match' : 'Schedule New Match' }}
          </h2>
          <button
            @click="cancelForm"
            class="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
            type="button"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- Scrollable Content -->
        <div class="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain smooth-scroll relative"
             style="scrollbar-width: thin; scrollbar-color: #cbd5e1 #f1f5f9;">
          <!-- Scroll fade indicators -->
          <div class="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-white to-transparent pointer-events-none z-10"></div>
          <div class="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white to-transparent pointer-events-none z-10"></div>
          <form @submit.prevent="submitForm" class="space-y-4 sm:space-y-6">
          
          <!-- Score Input -->
          <div v-if="editingMatch || formData.status === 'COMPLETED' || formData.status === 'LIVE'" class="grid grid-cols-2 gap-4">
            <div>
              <label class="form-label">Home Score</label>
              <input
                v-model.number="formData.homeScore"
                type="number"
                min="0"
                class="form-input"
              >
            </div>
            <div>
              <label class="form-label">Away Score</label>
              <input
                v-model.number="formData.awayScore"
                type="number"
                min="0"
                class="form-input"
              >
            </div>
          </div>

          <!-- Events Management -->
          <div v-if="editingMatch" class="space-y-4">
            <div class="border rounded-lg p-4 bg-gray-50">
              <h3 class="text-lg font-medium text-gray-900 mb-4">Events</h3>
              
              <!-- Add New Event Form -->
              <div class="mb-6">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
                  <div>
                    <label class="form-label">Event Type</label>
                    <select v-model="newEvent.type" class="form-input">
                      <option value="">Select Event</option>
                      <option value="GOAL">Goal</option>
                      <option value="OWN_GOAL">Own Goal</option>
                      <option value="YELLOW_CARD">Yellow Card</option>
                      <option value="RED_CARD">Red Card</option>
                    </select>
                  </div>
                  
                  <div>
                    <label class="form-label">Team</label>
                    <select v-model="newEvent.team" class="form-input">
                      <option value="">Select Team</option>
                      <option value="HOME">{{ homeTeamName }}</option>
                      <option value="AWAY">{{ awayTeamName }}</option>
                    </select>
                  </div>
                  
                  <div>
                    <label class="form-label">Player</label>
                    <select v-model="newEvent.playerId" class="form-input">
                      <option value="">Select Player</option>
                      <option
                        v-for="player in getTeamPlayers(newEvent.team)"
                        :key="player.id"
                        :value="player.id"
                      >
                        {{ player.name }} ({{ player.position }})
                      </option>
                    </select>
                  </div>
                </div>
                
                <button
                  @click="addEvent"
                  type="button"
                  class="btn-primary text-sm"
                  :disabled="!canAddEvent"
                >
                  Add Event
                </button>
              </div>

              <!-- Existing Events -->
              <div v-if="matchEvents.length > 0" class="space-y-3">
                <div class="flex items-center justify-between">
                  <span v-if="matchEvents.length > 3" class="text-xs text-gray-400 flex items-center space-x-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <span>Scroll to see all</span>
                  </span>
                </div>
                
                <!-- Two-column layout for events -->
                <div class="grid grid-cols-2 gap-4">
                  <!-- Home Team Events (Left) -->
                  <div class="space-y-2">
                    <h4 class="text-sm font-medium text-blue-800 bg-blue-50 px-2 py-1 rounded text-center">
                      {{ homeTeamName }}
                    </h4>
                    <div class="max-h-48 overflow-y-auto space-y-2 pr-1 overscroll-contain smooth-scroll rounded-lg border border-blue-100 p-2 relative bg-blue-50/30"
                         style="scrollbar-width: thin; scrollbar-color: #3b82f6 #eff6ff;">
                      <div
                        v-for="(event, index) in homeEvents"
                        :key="event.tempId || event.id"
                        class="flex items-center justify-between p-2 bg-white rounded border border-blue-200 hover:shadow-sm transition-shadow"
                      >
                        <div class="text-sm flex-1">
                          <div class="font-medium text-blue-900">{{ event.player?.name || event.playerName || 'Unknown Player' }}</div>
                          <div class="text-xs text-blue-600 capitalize">{{ getEventTypeDisplay(event.type) }}</div>
                        </div>
                        <button
                          @click="removeEvent(getEventIndex(event))"
                          class="text-red-600 hover:text-red-800 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors ml-2"
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                      <div v-if="homeEvents.length === 0" class="text-xs text-blue-400 text-center py-4">
                        No events
                      </div>
                    </div>
                  </div>
                  
                  <!-- Away Team Events (Right) -->
                  <div class="space-y-2">
                    <h4 class="text-sm font-medium text-red-800 bg-red-50 px-2 py-1 rounded text-center">
                      {{ awayTeamName }}
                    </h4>
                    <div class="max-h-48 overflow-y-auto space-y-2 pr-1 overscroll-contain smooth-scroll rounded-lg border border-red-100 p-2 relative bg-red-50/30"
                         style="scrollbar-width: thin; scrollbar-color: #ef4444 #fef2f2;">
                      <div
                        v-for="(event, index) in awayEvents"
                        :key="event.tempId || event.id"
                        class="flex items-center justify-between p-2 bg-white rounded border border-red-200 hover:shadow-sm transition-shadow"
                      >
                        <div class="text-sm flex-1">
                          <div class="font-medium text-red-900">{{ event.player?.name || event.playerName || 'Unknown Player' }}</div>
                          <div class="text-xs text-red-600 capitalize">{{ getEventTypeDisplay(event.type) }}</div>
                        </div>
                        <button
                          @click="removeEvent(getEventIndex(event))"
                          class="text-red-600 hover:text-red-800 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors ml-2"
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                      <div v-if="awayEvents.length === 0" class="text-xs text-red-400 text-center py-4">
                        No events
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label class="form-label">Tournament</label>
            <select v-model="formData.tournamentId" required class="form-input">
              <option value="">Select tournament</option>
              <option v-for="tournament in tournaments" :key="tournament.id" :value="tournament.id">
                {{ tournament.name }}
              </option>
            </select>
          </div>
          
          <div>
            <label class="form-label">Home Team</label>
            <select v-model="formData.homeTeamId" required class="form-input">
              <option value="">Select home team</option>
              <option v-for="team in teams" :key="team.id" :value="team.id">
                {{ team.name }}
              </option>
            </select>
          </div>
          
          <div>
            <label class="form-label">Away Team</label>
            <select v-model="formData.awayTeamId" required class="form-input">
              <option value="">Select away team</option>
              <option v-for="team in teams" :key="team.id" :value="team.id" :disabled="team.id === formData.homeTeamId">
                {{ team.name }}
              </option>
            </select>
          </div>
          
          <div>
            <label class="form-label">Date & Time</label>
            <input
              v-model="formData.scheduledDate"
              type="datetime-local"
              required
              class="form-input"
            >
          </div>

          <div>
            <label class="form-label">Venue (Optional)</label>
            <input
              v-model="formData.venue"
              type="text"
              class="form-input"
              placeholder="Stadium name"
            >
          </div>

          <div>
            <label class="form-label">Status</label>
            <select v-model="formData.status" required class="form-input">
              <option value="SCHEDULED">Scheduled</option>
              <option value="LIVE">Live</option>
              <option value="COMPLETED">Completed</option>
              <option value="POSTPONED">Postponed</option>
            </select>
          </div>
          </form>
        </div>
        
        <!-- Modal Footer -->
        <div class="flex-shrink-0 border-t border-gray-200 p-4 sm:p-6 bg-white rounded-b-lg">
          <div class="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              type="button"
              @click="cancelForm"
              class="btn-secondary w-full sm:w-auto order-2 sm:order-1 py-3 sm:py-2"
            >
              Cancel
            </button>
            <button 
              @click="submitForm" 
              class="btn-primary w-full sm:w-auto order-1 sm:order-2 py-3 sm:py-2"
            >
              {{ editingMatch ? 'Update Match' : 'Schedule Match' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMatchesStore } from '../stores/matches'
import { useTournamentsStore } from '../stores/tournaments'
import { useTeamsStore } from '../stores/teams'
import { usePlayersStore } from '../stores/players'
import { useAuthStore } from '../stores/auth'
import type { Match, MatchEvent } from '../types'

const matchesStore = useMatchesStore()
const tournamentsStore = useTournamentsStore()
const teamsStore = useTeamsStore()
const playersStore = usePlayersStore()
const authStore = useAuthStore()

const matches = computed(() => matchesStore.matches)
const tournaments = computed(() => tournamentsStore.tournaments)
const teams = computed(() => teamsStore.teams)
const players = computed(() => playersStore.players)
const loading = computed(() => 
  matchesStore.loading || tournamentsStore.loading || teamsStore.loading || playersStore.loading
)
const error = computed(() => 
  matchesStore.error || tournamentsStore.error || teamsStore.error || playersStore.error
)

// Helper function to safely format dates
const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return 'N/A'
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleDateString()
  } catch {
    return 'Invalid Date'
  }
}

// Helper function to safely format time
const formatTime = (date: string | Date | null | undefined): string => {
  if (!date) return 'N/A'
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return 'Invalid Time'
  }
}

onMounted(async () => {
  await Promise.all([
    matchesStore.fetchMatches(),
    tournamentsStore.fetchTournaments(),
    teamsStore.fetchTeams(),
    playersStore.fetchPlayers()
  ])
})

const filters = ['Current Tournament', 'Old Matches']
const activeFilter = ref('Current Tournament')

const showAddForm = ref(false)
const editingMatch = ref<Match | null>(null)

const formData = ref({
  tournamentId: '',
  homeTeamId: '',
  awayTeamId: '',
  scheduledDate: '',
  venue: '',
  status: 'SCHEDULED',
  homeScore: 0,
  awayScore: 0
})

// Event management
const matchEvents = ref<(MatchEvent & { tempId?: string })[]>([])
const newEvent = ref({
  type: '',
  team: '',
  playerId: ''
})

// Computed properties for goals (for score calculation)
const homeGoals = computed(() => matchEvents.value.filter(event => 
  event.team === 'HOME' && (event.type === 'GOAL' || event.type === 'OWN_GOAL')
))
const awayGoals = computed(() => matchEvents.value.filter(event => 
  event.team === 'AWAY' && (event.type === 'GOAL' || event.type === 'OWN_GOAL')
))

// Computed properties for form
const homeTeamName = computed(() => {
  const team = teamsStore.getTeamById(formData.value.homeTeamId)
  return team?.name || 'Home Team'
})

const awayTeamName = computed(() => {
  const team = teamsStore.getTeamById(formData.value.awayTeamId)
  return team?.name || 'Away Team'
})

const canAddEvent = computed(() => 
  newEvent.value.type && 
  newEvent.value.team && 
  newEvent.value.playerId
)

// Computed properties for event display
const homeEvents = computed(() => 
  matchEvents.value.filter(event => event.team === 'HOME')
)

const awayEvents = computed(() => 
  matchEvents.value.filter(event => event.team === 'AWAY')
)

// Computed properties for filtered matches
const filteredMatches = computed(() => {
  // Ensure tournaments and matches are arrays and not null/undefined
  const tournamentsArray = Array.isArray(tournaments?.value) ? tournaments.value : []
  const matchesArray = Array.isArray(matches?.value) ? matches.value : []
  
  if (activeFilter.value === 'Current Tournament') {
    // Get ongoing tournaments
    const ongoingTournaments = tournamentsArray.filter(t => t.status === 'ONGOING')
    const ongoingTournamentIds = ongoingTournaments.map(t => t.id)
    return matchesArray.filter((match: Match) => ongoingTournamentIds.includes(match.tournamentId))
  } else {
    // Old matches - matches from completed tournaments or old matches
    const ongoingTournaments = tournamentsArray.filter(t => t.status === 'ONGOING')
    const ongoingTournamentIds = ongoingTournaments.map(t => t.id)
    return matchesArray.filter((match: Match) => !ongoingTournamentIds.includes(match.tournamentId))
  }
})

// Get current tournament for auto-selection
const currentTournament = computed(() => {
  return tournaments.value.find(t => t.status === 'ONGOING')
})

function getEventTypeDisplay(type: string) {
  const typeMap = {
    'GOAL': 'Goal',
    'OWN_GOAL': 'Own Goal',
    'YELLOW_CARD': 'Yellow Card',
    'RED_CARD': 'Red Card',
    'SUBSTITUTION': 'Substitution',
    // Legacy support for lowercase
    'goal': 'Goal',
    'own_goal': 'Own Goal',
    'yellow_card': 'Yellow Card',
    'red_card': 'Red Card',
    'substitution': 'Substitution'
  }
  return typeMap[type as keyof typeof typeMap] || type
}

function getHomeEvents(events: MatchEvent[]) {
  return events ? events.filter(event => event.team === 'HOME').sort((a, b) => a.minute - b.minute) : []
}

function getAwayEvents(events: MatchEvent[]) {
  return events ? events.filter(event => event.team === 'AWAY').sort((a, b) => a.minute - b.minute) : []
}

// ...existing code...

function getTeamPlayers(team: string) {
  if (!team || (team !== 'HOME' && team !== 'AWAY' && team !== 'home' && team !== 'away')) return []
  const isHome = team === 'HOME' || team === 'home'
  const teamId = isHome ? formData.value.homeTeamId : formData.value.awayTeamId
  return players.value.filter(player => player.teamId === teamId)
}

function addEvent() {
  if (!canAddEvent.value) return
  
  const player = players.value.find(p => p.id === newEvent.value.playerId)
  if (!player) return
  
  const event: MatchEvent & { tempId: string } = {
    id: '', // Will be set when match is saved
    tempId: Date.now().toString(),
    matchId: editingMatch.value?.id || '',
    type: newEvent.value.type as 'GOAL' | 'OWN_GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'SUBSTITUTION',
    minute: 90, // Default minute since we removed minute input
    playerId: newEvent.value.playerId,
    player: {
      id: player.id,
      name: player.name
    },
    playerName: player.name,
    team: newEvent.value.team as 'HOME' | 'AWAY'
  }
  
  matchEvents.value.push(event)
  
  // Reset new event form
  newEvent.value = {
    type: '',
    team: '',
    playerId: ''
  }
}

function removeEvent(index: number) {
  matchEvents.value.splice(index, 1)
}

function getEventIndex(event: MatchEvent & { tempId?: string }): number {
  return matchEvents.value.findIndex(e => 
    (e.tempId && event.tempId && e.tempId === event.tempId) || 
    (e.id && event.id && e.id === event.id)
  )
}

function editMatch(match: Match) {
  editingMatch.value = match
  const homeTeam = teamsStore.getTeamById(match.homeTeam.id)
  const awayTeam = teamsStore.getTeamById(match.awayTeam.id)
  
  // Handle scheduledDate which might be a string or Date object
  let formattedDate: string
  if (match.scheduledDate instanceof Date) {
    formattedDate = match.scheduledDate.toISOString().slice(0, 16)
  } else if (typeof match.scheduledDate === 'string') {
    // If it's a string, parse it to Date first
    const dateObj = new Date(match.scheduledDate)
    formattedDate = dateObj.toISOString().slice(0, 16)
  } else {
    // Fallback to current date
    formattedDate = new Date().toISOString().slice(0, 16)
  }
  
  formData.value = {
    tournamentId: match.tournamentId,
    homeTeamId: match.homeTeam.id,
    awayTeamId: match.awayTeam.id,
    scheduledDate: formattedDate,
    venue: match.venue || '',
    status: match.status,
    homeScore: match.homeScore ?? 0,
    awayScore: match.awayScore ?? 0
  }
  
  // Load existing events
  matchEvents.value = match.events || []
  showAddForm.value = true
}

function openAddForm() {
  editingMatch.value = null
  matchEvents.value = []
  newEvent.value = {
    type: '',
    team: '',
    playerId: ''
  }
  
  // Auto-select current tournament if on Current Tournament tab
  const autoSelectTournament = activeFilter.value === 'Current Tournament' && currentTournament.value
  
  formData.value = {
    tournamentId: autoSelectTournament ? currentTournament.value!.id : '',
    homeTeamId: '',
    awayTeamId: '',
    scheduledDate: '',
    venue: '',
    status: 'SCHEDULED',
    homeScore: 0,
    awayScore: 0
  }
  showAddForm.value = true
}

async function submitForm() {
  const homeTeam = teamsStore.getTeamById(formData.value.homeTeamId)
  const awayTeam = teamsStore.getTeamById(formData.value.awayTeamId)
  
  if (!homeTeam || !awayTeam) return

  // Prepare match data without events
  const matchData = {
    tournamentId: formData.value.tournamentId,
    homeTeam: { id: homeTeam.id, name: homeTeam.name },
    awayTeam: { id: awayTeam.id, name: awayTeam.name },
    scheduledDate: new Date(formData.value.scheduledDate),
    venue: formData.value.venue,
    status: formData.value.status as 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'POSTPONED',
    homeScore: formData.value.homeScore,
    awayScore: formData.value.awayScore,
    events: [] // Don't send events with match data
  }

  try {
    if (editingMatch.value) {
      // Update match first
      await matchesStore.updateMatch(editingMatch.value.id, matchData)
      
      // Then handle events separately
      if (matchEvents.value.length > 0) {
        await matchesStore.updateMatchEvents(editingMatch.value.id, matchEvents.value)
      }
    } else {
      // Create new match
      await matchesStore.addMatch(matchData)
      
      // For new matches, events will be empty initially
      // Events can be added later when editing the match
    }
    
    // Refresh matches list to ensure we have the latest data
    await matchesStore.fetchMatches()
  } catch (error) {
    console.error('Error saving match:', error)
    // Don't close form on error so user can retry
    return
  }
  
  cancelForm()
}

function cancelForm() {
  showAddForm.value = false
  editingMatch.value = null
  matchEvents.value = []
  newEvent.value = {
    type: '',
    team: '',
    playerId: ''
  }
  formData.value = {
    tournamentId: '',
    homeTeamId: '',
    awayTeamId: '',
    scheduledDate: '',
    venue: '',
    status: 'SCHEDULED',
    homeScore: 0,
    awayScore: 0
  }
}

function deleteMatch(id: string) {
  if (confirm('Are you sure you want to delete this match?')) {
    matchesStore.deleteMatch(id)
  }
}
</script>
