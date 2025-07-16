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
      <div v-else-if="authStore.hasPermission('canEditTournaments')" class="text-sm text-gray-500">
        Weekly tournament already exists for {{ formatNextMonday(nextMonday) }}
      </div>
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

    <!-- Loading State -->
    <div v-if="tournamentsStore.loading" class="text-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
      <p class="mt-2 text-gray-600">Loading tournaments...</p>
    </div>

    <!-- Tournaments Content -->
    <div v-else>
      <!-- Ongoing Tournament Tab -->
      <div v-if="activeFilter === 'Ongoing'">
        <div v-if="ongoingTournament" 
             class="card transition-colors duration-200"
             :class="getCardBackgroundClass(ongoingTournament.id)">
          <div class="flex flex-col space-y-4">
            <!-- Tournament Info -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div>
                <h3 class="text-lg font-semibold text-gray-900">{{ ongoingTournament.name }}</h3>
                <div class="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-600">
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                        :class="getStatusBadge(ongoingTournament.status)">
                    {{ ongoingTournament.status }}
                  </span>
                  <span>{{ formatDate(ongoingTournament.startDate) }}</span>
                  <span>{{ formatTime(ongoingTournament.startDate) }}</span>
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <button
                  v-if="authStore.hasPermission('canEditTournaments')"
                  @click="editTournament(ongoingTournament)"
                  class="text-blue-600 hover:text-blue-800"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  v-if="authStore.hasPermission('canDeleteTournaments')"
                  @click="deleteTournament(ongoingTournament.id)"
                  class="text-red-600 hover:text-red-800"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            
            <!-- Attendance Progress Bar -->
            <div v-if="attendanceStats.has(ongoingTournament.id)" class="mt-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-gray-200">
              <div class="flex justify-between items-center mb-3">
                <span class="text-sm font-semibold text-gray-800">Player Attendance</span>
                <span class="text-sm font-medium text-gray-700 bg-white px-2 py-1 rounded-full">
                  {{ getAttendanceStats(ongoingTournament.id)?.attendingCount || 0 }} / {{ getAttendanceStats(ongoingTournament.id)?.totalPlayers || 0 }}
                </span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-4 mb-3 shadow-inner">
                <div 
                  class="bg-gradient-to-r from-green-500 to-green-600 h-4 rounded-full transition-all duration-700 ease-out shadow-sm relative overflow-hidden"
                  :style="{ width: `${getAttendancePercentage(ongoingTournament.id)}%` }"
                >
                  <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-2 text-xs">
                <button 
                  @click="openAttendanceModal(ongoingTournament.id, 'attending')"
                  class="text-center p-2 bg-green-100 rounded-lg hover:bg-green-200 transition-colors cursor-pointer"
                >
                  <div class="font-semibold text-green-800">{{ getAttendanceStats(ongoingTournament.id)?.attendingCount || 0 }}</div>
                  <div class="text-green-600">Attending</div>
                </button>
                <button 
                  @click="openAttendanceModal(ongoingTournament.id, 'not-attending')"
                  class="text-center p-2 bg-red-100 rounded-lg hover:bg-red-200 transition-colors cursor-pointer"
                >
                  <div class="font-semibold text-red-800">{{ getAttendanceStats(ongoingTournament.id)?.notAttendingCount || 0 }}</div>
                  <div class="text-red-600">Not Attending</div>
                </button>
                <div class="text-center p-2 bg-blue-100 rounded-lg">
                  <div class="font-semibold text-blue-800">{{ getAttendanceStats(ongoingTournament.id)?.responseRate || 0 }}%</div>
                  <div class="text-blue-600">Response Rate</div>
                </div>
              </div>
            </div>

            <!-- Tournament Teams Display -->
            <div v-if="getTournamentTeams(ongoingTournament).length > 0" class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 class="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.196-2.196M5 20h5v-2a3 3 0 015.196-2.196M12 4v.01M12 4a7 7 0 018 7c0 2-1 3-1 3s-1 1-1 3v2H8v-2s-1-1-1-3c0-2 1-3 1-3a7 7 0 018-7z" />
                </svg>
                Tournament Teams ({{ getTournamentTeams(ongoingTournament).length }})
              </h4>
              
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <div
                  v-for="team in getTournamentTeams(ongoingTournament)"
                  :key="team.id"
                  class="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <!-- Team Header -->
                  <div class="flex items-center mb-3">
                    <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                      <span class="text-white font-bold text-lg">{{ team.name.charAt(team.name.length - 1) }}</span>
                    </div>
                    <div>
                      <h5 class="font-semibold text-gray-900">{{ team.name }}</h5>
                      <p class="text-sm text-gray-600">{{ team.players?.length || 0 }} players</p>
                    </div>
                  </div>

                  <!-- Team Players -->
                  <div v-if="team.players && team.players.length > 0" class="space-y-2">
                    <div
                      v-for="player in team.players"
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
                  <div v-if="team.players && team.players.length > 0" class="mt-3 pt-3 border-t border-gray-200">
                    <div class="flex justify-between text-xs text-gray-600">
                      <span>Total Tier: {{ team.players.reduce((sum: number, p: any) => sum + p.tier, 0) }}</span>
                      <span>Avg: {{ (team.players.reduce((sum: number, p: any) => sum + p.tier, 0) / team.players.length).toFixed(1) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Attendance Toggle Button -->
            <div v-if="getAttendanceButtonText(ongoingTournament.id) !== 'No Player'" class="flex justify-center pt-2 border-t border-gray-200">
              <button
                @click="toggleAttendance(ongoingTournament.id)"
                :disabled="attendanceLoading.has(ongoingTournament.id)"
                class="px-6 py-2 rounded-lg font-medium transition-colors duration-200"
                :class="[
                  attendanceLoading.has(ongoingTournament.id)
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:shadow-md',
                  getAttendanceButtonText(ongoingTournament.id) === 'Attend'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                ]"
              >
                {{ attendanceLoading.has(ongoingTournament.id) ? 'Loading...' : getAttendanceButtonText(ongoingTournament.id) }}
              </button>
            </div>
            
            <!-- Random Team Button (Admin/Mod only) -->
            <div v-if="authStore.hasPermission('canEditTournaments') && getTournamentTeams(ongoingTournament).length === 0" class="flex flex-col items-center pt-2 border-t border-gray-200">
              <button
                @click="generateRandomTeams(ongoingTournament.id)"
                :disabled="!canGenerateTeams(ongoingTournament.id) || teamGenerationLoading"
                class="px-6 py-2 rounded-lg font-medium transition-colors duration-200"
                :class="[
                  !canGenerateTeams(ongoingTournament.id) || teamGenerationLoading
                    ? 'opacity-50 cursor-not-allowed bg-gray-400 text-white' 
                    : 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md'
                ]"
              >
                {{ teamGenerationLoading ? 'Generating...' : 'Random Team' }}
              </button>
              <div class="text-xs text-gray-500 mt-1 text-center">
                <span v-if="!canGenerateTeams(ongoingTournament.id)">
                  Need {{ 10 - (getAttendanceStats(ongoingTournament.id)?.attendingCount || 0) }} more attending players
                </span>
                <span v-else>
                  Will create {{ getTeamCount(ongoingTournament.id) }} balanced teams
                </span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-8">
          <p class="text-gray-600">No ongoing weekly tournament</p>
          <p class="text-sm text-gray-500 mt-1">Next tournament: {{ formatNextMonday(nextMonday) }}</p>
        </div>
      </div>

      <!-- Old Tournaments Tab -->
      <div v-else-if="activeFilter === 'Old Tournament'">
        <div class="space-y-3 sm:space-y-4">
          <div
            v-for="tournament in oldTournaments"
            :key="tournament.id"
            class="card hover:shadow-lg transition-shadow"
          >
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div>
                <h3 class="text-lg font-semibold text-gray-900">{{ tournament.name }}</h3>
                <div class="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-600">
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                        :class="getStatusBadge(tournament.status)">
                    {{ tournament.status }}
                  </span>
                  <span>{{ formatDate(tournament.startDate) }}</span>
                  <span>{{ formatTime(tournament.startDate) }}</span>
                  <span>{{ tournament.teams.length }} teams</span>
                  <span v-if="tournament.winner" class="text-yellow-600 font-medium">
                    🏆 {{ tournament.winner.name }}
                  </span>
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <button
                  v-if="authStore.hasPermission('canEditTournaments')"
                  @click="editTournament(tournament)"
                  class="text-blue-600 hover:text-blue-800"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  v-if="authStore.hasPermission('canDeleteTournaments')"
                  @click="deleteTournament(tournament.id)"
                  class="text-red-600 hover:text-red-800"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Load More Button -->
        <div v-if="hasMoreOldTournaments" class="text-center mt-6">
          <button
            @click="loadMoreOldTournaments"
            :disabled="loadingMore"
            class="btn-secondary"
            :class="{ 'opacity-50 cursor-not-allowed': loadingMore }"
          >
            {{ loadingMore ? 'Loading...' : 'Load More' }}
          </button>
        </div>

        <!-- No tournaments message -->
        <div v-if="oldTournaments.length === 0 && !tournamentsStore.loading" class="text-center py-8">
          <p class="text-gray-600">No old weekly tournaments found</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Attendance Details Modal -->
  <div v-if="showAttendanceModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click="closeAttendanceModal">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden" @click.stop>
      <!-- Modal Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">{{ attendanceModalTitle }}</h3>
        <button 
          @click="closeAttendanceModal"
          class="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Modal Content -->
      <div class="p-6 overflow-y-auto max-h-[60vh]">
        <!-- Loading State -->
        <div v-if="attendanceModalLoading" class="text-center py-8">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p class="text-gray-600 mt-2">Loading players...</p>
        </div>
        
        <!-- No Data State -->
        <div v-else-if="getFilteredModalData().length === 0" class="text-center py-8">
          <p class="text-gray-600">No players {{ attendanceModalType === 'attending' ? 'attending' : 'not attending' }} this tournament.</p>
        </div>
        
        <!-- Player List -->
        <div v-else class="space-y-3">
          <div 
            v-for="attendance in getFilteredModalData()" 
            :key="attendance.id"
            class="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <!-- Player Avatar -->
            <div class="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center mr-4">
              <img 
                v-if="attendance.player.avatar" 
                :src="attendance.player.avatar" 
                :alt="attendance.player.name"
                class="w-12 h-12 rounded-full object-cover"
              />
              <span v-else class="text-gray-600 font-medium text-lg">
                {{ attendance.player.name.charAt(0).toUpperCase() }}
              </span>
            </div>

            <!-- Player Info -->
            <div class="flex-1">
              <h4 class="font-semibold text-gray-900">{{ attendance.player.name }}</h4>
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600">{{ attendance.player.position }}</span>
                <span class="flex items-center text-sm text-gray-600">
                  <span class="ml-1">
                    {{ '⭐'.repeat(attendance.player.tier) }}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
        <p class="text-sm text-gray-600">
          {{ getFilteredModalData().length }} player{{ getFilteredModalData().length !== 1 ? 's' : '' }} {{ attendanceModalType === 'attending' ? 'attending' : 'not attending' }}
        </p>
        <button 
          @click="closeAttendanceModal"
          class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useTournamentsStore } from '../stores/tournaments'
import { useAuthStore } from '../stores/auth'
import { useTeamsStore } from '../stores/teams'
import type { Tournament, CreateTournamentRequest, TournamentPlayerAttendance, TournamentAttendanceStats, TournamentAttendanceDetails } from '../types'
import { apiClient } from '../api/client'

const toast = useToast()
const tournamentsStore = useTournamentsStore()
const authStore = useAuthStore()
const teamsStore = useTeamsStore()

const loading = ref(false)
const loadingMore = ref(false)
const activeFilter = ref('Ongoing')
const filters = ['Ongoing', 'Old Tournament']

// Attendance tracking
const attendanceMap = ref<Map<string, TournamentPlayerAttendance>>(new Map())
const attendanceLoading = ref<Set<string>>(new Set())
const attendanceStats = ref<Map<string, TournamentAttendanceStats>>(new Map())

// Modal for attendance details
const showAttendanceModal = ref(false)
const attendanceModalData = ref<TournamentAttendanceDetails[]>([])
const attendanceModalTitle = ref('')
const attendanceModalType = ref<'attending' | 'not-attending'>('attending')
const attendanceModalLoading = ref(false)

// Team generation
const teamGenerationLoading = ref(false)

// Pagination for old tournaments
const oldTournamentPage = ref(1)
const oldTournamentLimit = 5
const hasMoreOldTournaments = ref(true)

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

// Get tournaments filtered for weekly tournaments
const weeklyTournaments = computed(() => {
  return tournamentsStore.tournaments.filter(tournament => 
    tournament.type === 'WEEKLY'
  )
})

// Get ongoing tournament (filter by status = 'ONGOING')
const ongoingTournament = computed(() => {
  return weeklyTournaments.value.find(tournament => 
    tournament.status === 'UPCOMING'
  )
})

// Check if we can create a new tournament
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

// Get old tournaments (completed or past)
const oldTournaments = ref<Tournament[]>([])

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

const formatTime = (date: string | Date): string => {
  if (!date) return 'N/A'
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return 'Invalid Time'
  }
}

const formatNextMonday = (date: Date): string => {
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  })
}

const getStatusBadge = (status: string) => {
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

// Attendance functions
const fetchAttendance = async (tournamentId: string): Promise<void> => {
  try {
    const response = await apiClient.get<TournamentPlayerAttendance>(`/tournaments/${tournamentId}/attendance`)
    if (response.success) {
      // If response.data is empty object {}, user has no player record
      if (response.data && Object.keys(response.data).length > 0) {
        attendanceMap.value.set(tournamentId, response.data)
      } else {
        // User has no player record, set a special marker
        const noPlayerMarker = { 
          id: '', 
          tournamentId, 
          playerId: '', 
          status: 'NO_PLAYER' as any,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        attendanceMap.value.set(tournamentId, noPlayerMarker)
      }
    }
  } catch (err: any) {
    console.error('Fetch attendance error:', err)
    // Silent error for attendance fetch - we don't want to spam the user with toasts
  }
}

const toggleAttendance = async (tournamentId: string): Promise<void> => {
  if (attendanceLoading.value.has(tournamentId)) return
  
  const currentAttendance = attendanceMap.value.get(tournamentId)
  
  // Don't allow toggle if user has no player
  if (!currentAttendance || (currentAttendance as any).status === 'NO_PLAYER') {
    return
  }
  
  try {
    attendanceLoading.value.add(tournamentId)
    
    const currentStatus = currentAttendance.status || 'NULL'
    
    // Toggle between ATTEND and NOT_ATTEND
    const newStatus = currentStatus === 'ATTEND' ? 'NOT_ATTEND' : 'ATTEND'
    
    const response = await apiClient.put<TournamentPlayerAttendance>(
      `/tournaments/${tournamentId}/attendance`,
      { status: newStatus }
    )
    
    if (response.success && response.data) {
      attendanceMap.value.set(tournamentId, response.data)
      // Refresh attendance stats
      await fetchAttendanceStats(tournamentId)
    }
  } catch (err: any) {
    console.error('Toggle attendance error:', err)
    toast.error(err.response?.data?.error || 'Failed to update attendance')
  } finally {
    attendanceLoading.value.delete(tournamentId)
  }
}

const getAttendanceButtonText = (tournamentId: string): string => {
  const attendance = attendanceMap.value.get(tournamentId)
  if (!attendance || (attendance as any).status === 'NO_PLAYER') return 'No Player'
  if (attendance.status === 'NULL') return 'Attend'
  return attendance.status === 'ATTEND' ? 'Not Attend' : 'Attend'
}

const getCardBackgroundClass = (tournamentId: string): string => {
  const attendance = attendanceMap.value.get(tournamentId)
  if (!attendance || (attendance as any).status === 'NO_PLAYER' || attendance.status === 'NULL') return ''
  return attendance.status === 'ATTEND' ? 'bg-green-50' : 'bg-red-50'
}

// Attendance statistics functions
const fetchAttendanceStats = async (tournamentId: string): Promise<void> => {
  try {
    const response = await apiClient.get<TournamentAttendanceStats>(`/tournaments/${tournamentId}/attendance-stats`)
    if (response.success && response.data) {
      attendanceStats.value.set(tournamentId, response.data)
    }
  } catch (err: any) {
    console.error('Fetch attendance stats error:', err)
    // Silent error for attendance stats fetch
  }
}

const getAttendanceStats = (tournamentId: string): TournamentAttendanceStats | undefined => {
  return attendanceStats.value.get(tournamentId)
}

const getAttendancePercentage = (tournamentId: string): number => {
  const stats = attendanceStats.value.get(tournamentId)
  if (!stats || stats.totalPlayers === 0) return 0
  return Math.round((stats.attendingCount / stats.totalPlayers) * 100)
}

// Modal functions
const fetchAttendanceDetails = async (tournamentId: string): Promise<void> => {
  try {
    attendanceModalLoading.value = true
    const response = await apiClient.get<TournamentAttendanceDetails[]>(`/tournaments/${tournamentId}/attendance-details`)
    if (response.success && response.data) {
      attendanceModalData.value = response.data
    }
  } catch (err: any) {
    console.error('Fetch attendance details error:', err)
    toast.error('Failed to load attendance details')
    attendanceModalData.value = []
  } finally {
    attendanceModalLoading.value = false
  }
}

const openAttendanceModal = async (tournamentId: string, type: 'attending' | 'not-attending'): Promise<void> => {
  attendanceModalType.value = type
  attendanceModalTitle.value = type === 'attending' ? 'Players Attending' : 'Players Not Attending'
  showAttendanceModal.value = true
  attendanceModalData.value = [] // Clear previous data
  
  await fetchAttendanceDetails(tournamentId)
}

const closeAttendanceModal = (): void => {
  showAttendanceModal.value = false
  attendanceModalData.value = []
  attendanceModalLoading.value = false
}

const getFilteredModalData = (): TournamentAttendanceDetails[] => {
  const targetStatus = attendanceModalType.value === 'attending' ? 'ATTEND' : 'NOT_ATTEND'
  return attendanceModalData.value.filter(item => item.status === targetStatus)
}

// Team generation functions
const canGenerateTeams = (tournamentId: string): boolean => {
  const stats = attendanceStats.value.get(tournamentId)
  return stats ? stats.attendingCount >= 10 : false
}

const getTeamCount = (tournamentId: string): number => {
  const stats = attendanceStats.value.get(tournamentId)
  if (!stats) return 0
  
  const playerCount = stats.attendingCount
  if (playerCount < 15) return 2
  if (playerCount < 20) return 3
  return 4
}

// Helper function to get teams with players from tournament data
const getTournamentTeams = (tournament: Tournament): any[] => {
  if (!tournament.teams) return []
  
  // Tournament teams come as { team: { id, name, logo, players } } structure
  return tournament.teams.map((tournamentTeam: any) => {
    const team = tournamentTeam.team || tournamentTeam
    return {
      id: team.id,
      name: team.name,
      logo: team.logo,
      players: team.players || []
    }
  })
}

const generateRandomTeams = async (tournamentId: string): Promise<void> => {
  if (!canGenerateTeams(tournamentId) || teamGenerationLoading.value) return
  
  const stats = attendanceStats.value.get(tournamentId)
  if (!stats) return
  
  try {
    teamGenerationLoading.value = true
    
    const response = await apiClient.post(`/tournaments/${tournamentId}/generate-teams`)
    
    if (response.success) {
      // Show success message with team details
      const data = response.data as any
      toast.success(`Teams generated successfully! Created ${data.teamCount} teams for ${data.playerCount} players`)
      
      // Refresh tournament data
      await fetchData()
    }
  } catch (err: any) {
    console.error('Generate teams error:', err)
    toast.error(err.response?.data?.error || 'Failed to generate teams')
  } finally {
    teamGenerationLoading.value = false
  }
}

// Create new weekly tournament
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
    
    const tournamentData: CreateTournamentRequest = {
      name: `Weekly Tournament - ${formatDate(startDate)}`,
      type: 'WEEKLY' as const,
      status: 'UPCOMING' as const,
      startDate: startDateISO
      // endDate and teamIds are optional for weekly tournaments
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

// Load old tournaments with pagination
const loadOldTournaments = async (page: number = 1, append: boolean = false) => {
  try {
    if (page === 1) {
      oldTournaments.value = []
    }
    
    // Filter completed weekly tournaments, sorted by start date descending
    const allWeeklyTournaments = weeklyTournaments.value
      .filter(t => t.status === 'COMPLETED' || new Date(t.startDate) < new Date())
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    
    const startIndex = (page - 1) * oldTournamentLimit
    const endIndex = startIndex + oldTournamentLimit
    const pageData = allWeeklyTournaments.slice(startIndex, endIndex)
    
    if (append) {
      oldTournaments.value.push(...pageData)
    } else {
      oldTournaments.value = pageData
    }
    
    hasMoreOldTournaments.value = endIndex < allWeeklyTournaments.length
  } catch (err: any) {
    console.error('Load old tournaments error:', err)
    toast.error('Failed to load old tournaments')
  }
}

const loadMoreOldTournaments = async () => {
  if (loadingMore.value || !hasMoreOldTournaments.value) return
  
  try {
    loadingMore.value = true
    oldTournamentPage.value++
    await loadOldTournaments(oldTournamentPage.value, true)
  } finally {
    loadingMore.value = false
  }
}

// Tournament actions
const editTournament = (tournament: Tournament) => {
  // Navigate to regular tournaments page with edit functionality
  // Since we're reusing tournament functionality
  console.log('Edit tournament:', tournament.id)
  // You can implement this based on your tournament editing needs
}

const deleteTournament = async (id: string) => {
  if (!confirm('Are you sure you want to delete this weekly tournament?')) return
  
  try {
    await tournamentsStore.deleteTournament(id)
    await fetchData()
    toast.success('Tournament deleted successfully!')
  } catch (err: any) {
    console.error('Delete tournament error:', err)
    toast.error(err.response?.data?.error || 'Failed to delete tournament')
  }
}

// Fetch all data
const fetchData = async () => {
  try {
    await Promise.all([
      tournamentsStore.fetchTournaments(),
      teamsStore.fetchTeams()
    ])
    await loadOldTournaments(1)
    
    // Fetch attendance for all weekly tournaments
    const weeklyTournamentIds = weeklyTournaments.value.map(t => t.id)
    await Promise.all([
      ...weeklyTournamentIds.map(id => fetchAttendance(id)),
      ...weeklyTournamentIds.map(id => fetchAttendanceStats(id))
    ])
  } catch (err: any) {
    console.error('Fetch data error:', err)
    toast.error(err.response?.data?.error || 'Failed to load data')
  }
}

// Initialize
onMounted(async () => {
  await fetchData()
})

// Scroll listener for infinite scroll on old tournaments
const handleScroll = () => {
  if (activeFilter.value !== 'Old Tournament') return
  
  const scrollHeight = document.documentElement.scrollHeight
  const scrollTop = document.documentElement.scrollTop
  const clientHeight = document.documentElement.clientHeight
  
  if (scrollTop + clientHeight >= scrollHeight - 100 && hasMoreOldTournaments.value && !loadingMore.value) {
    loadMoreOldTournaments()
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>
