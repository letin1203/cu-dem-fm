<template>
  <div class="space-y-6">
    <!-- Filter Tabs -->
    <div v-if="showFilters" class="border-b border-gray-200">
      <nav class="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
        <button
          v-for="filter in filters"
          :key="filter"
          @click="activeFilter = filter"
          class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 transition-colors"
          :class="activeFilter === filter
            ? 'border-primary-500 text-primary-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
        >
          {{ filter }}
        </button>
      </nav>
    </div>

    <!-- Tournament Content -->
    <div v-if="showFilters">
      <!-- Ongoing Tournament Tab -->
      <div v-if="activeFilter === 'Ongoing'">
        <div v-if="ongoingTournament" class="card transition-colors duration-200">
          <TournamentCard
            :tournament="ongoingTournament"
            :attendance-details="attendanceDetailsMap.get(ongoingTournament.id) || []"
            :tournament-team-players="tournamentTeamPlayersMap.get(ongoingTournament.id) || []"
            :additional-costs="additionalCostsMap.get(ongoingTournament.id) || []"
            :system-settings="systemSettings"
            :attendance-loading="attendanceLoading.has(ongoingTournament.id)"
            :current-user="currentUser"
            :total-players="players.length"
            :generate-teams-loading="generateTeamsLoading.has(ongoingTournament.id)"
            :clear-teams-loading="clearTeamsLoading.has(ongoingTournament.id)"
            :water-loading="false"
            :bet-loading="false"
            @generate-teams="handleGenerateTeams"
            @clear-teams="handleClearTeams"
            @end-tournament="handleEndTournament"
            @open-attendance="handleOpenAttendance"
            @open-additional-costs="handleOpenAdditionalCosts"
            @update-score="handleUpdateScore"
            @toggle-attendance="handleToggleAttendance"
            @delete-tournament="handleDeleteTournament"
          />
        </div>
        <div v-else class="text-center py-12">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No ongoing tournament</h3>
          <p class="mt-1 text-sm text-gray-500">There are no ongoing tournaments at the moment.</p>
        </div>
      </div>

      <!-- Old Tournament Tab -->
      <div v-else-if="activeFilter === 'Old Tournament'">
        <div v-if="oldTournaments.length === 0" class="text-center py-12">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No old tournaments</h3>
          <p class="mt-1 text-sm text-gray-500">No completed tournaments found.</p>
        </div>
        <div v-else class="space-y-4">
          <TournamentCard
            v-for="tournament in oldTournaments"
            :key="tournament.id"
            :tournament="tournament"
            :attendance-details="attendanceDetailsMap.get(tournament.id) || []"
            :tournament-team-players="tournamentTeamPlayersMap.get(tournament.id) || []"
            :additional-costs="additionalCostsMap.get(tournament.id) || []"
            :system-settings="systemSettings"
            :attendance-loading="attendanceLoading.has(tournament.id)"
            :current-user="currentUser"
            :total-players="players.length"
            :generate-teams-loading="generateTeamsLoading.has(tournament.id)"
            :clear-teams-loading="clearTeamsLoading.has(tournament.id)"
            :water-loading="false"
            :bet-loading="false"
            @generate-teams="handleGenerateTeams"
            @clear-teams="handleClearTeams"
            @end-tournament="handleEndTournament"
            @open-attendance="handleOpenAttendance"
            @open-additional-costs="handleOpenAdditionalCosts"
            @update-score="handleUpdateScore"
            @toggle-attendance="handleToggleAttendance"
            @delete-tournament="handleDeleteTournament"
          />
        </div>
      </div>
    </div>

    <!-- Fallback: All tournaments (when no filters) -->
    <div v-else>
      <div v-if="tournaments.length === 0" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">No tournaments found</h3>
        <p class="mt-1 text-sm text-gray-500">Get started by creating a new tournament.</p>
      </div>
      <div v-else class="space-y-4">
        <TournamentCard
          v-for="tournament in tournaments"
          :key="tournament.id"
          :tournament="tournament"
          :attendance-details="attendanceDetailsMap.get(tournament.id) || []"
          :tournament-team-players="tournamentTeamPlayersMap.get(tournament.id) || []"
          :additional-costs="additionalCostsMap.get(tournament.id) || []"
          :system-settings="systemSettings"
          :attendance-loading="attendanceLoading.has(tournament.id)"
          :current-user="currentUser"
          :total-players="players.length"
          :generate-teams-loading="generateTeamsLoading.has(tournament.id)"
          :clear-teams-loading="clearTeamsLoading.has(tournament.id)"
          :water-loading="false"
          :bet-loading="false"
          @generate-teams="handleGenerateTeams"
          @clear-teams="handleClearTeams"
          @end-tournament="handleEndTournament"
          @open-attendance="handleOpenAttendance"
          @open-additional-costs="handleOpenAdditionalCosts"
          @update-score="handleUpdateScore"
          @toggle-attendance="handleToggleAttendance"
          @delete-tournament="handleDeleteTournament"
        />
      </div>
    </div>

    <!-- Modals -->
    <AttendanceModal
      :is-open="showAttendanceModal"
      :tournament-id="selectedTournamentId"
      :filter="attendanceFilter"
      :players="players"
      :attendance-details="attendanceDetailsMap.get(selectedTournamentId) || []"
      :attendance-loading="attendanceLoading"
      @close="showAttendanceModal = false"
      @toggle-water="handleToggleWater"
      @toggle-bet="handleToggleBet"
    />

    <EndTournamentModal
      :is-open="showEndTournamentModal"
      :tournament-id="endTournamentId"
      :teams="endTournamentTeams"
      :selected-winning-team="selectedWinningTeam ?? undefined"
      :selected-losing-team="selectedLosingTeam ?? undefined"
      :attendance-details="attendanceDetailsMap.get(endTournamentId) || []"
      :tournament-team-players="tournamentTeamPlayersMap.get(endTournamentId) || []"
      :confirm-loading="endTournamentLoading"
      :get-detailed-money-change="getDetailedMoneyChange"
      @close="handleCloseEndTournamentModal"
      @confirm="handleConfirmEndTournament"
    />

    <AdditionalCostsModal
      :is-open="showAdditionalCostsModal"
      :tournament-id="selectedTournamentId"
      :additional-costs="additionalCostsMap.get(selectedTournamentId) || []"
      :attending-players-count="getAttendingCount(selectedTournamentId)"
      :loading="additionalCostsLoading"
      :delete-loading="deleteAdditionalCostsLoading"
      @close="showAdditionalCostsModal = false"
      @add-cost="handleAddAdditionalCost"
      @delete-cost="handleDeleteAdditionalCost"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import TournamentCard from './TournamentCard.vue'
import AttendanceModal from './AttendanceModal.vue'
import EndTournamentModal from './EndTournamentModal.vue'
import AdditionalCostsModal from './AdditionalCostsModal.vue'
import type { Tournament, Player, Team } from '../../types'

interface Props {
  tournaments: Tournament[]
  players: Player[]
  attendanceDetailsMap: Map<string, any[]>
  tournamentTeamPlayersMap: Map<string, any[]>
  additionalCostsMap: Map<string, any[]>
  systemSettings: any
  currentUser: any
  generateTeamsLoading: Set<string>
  clearTeamsLoading: Set<string>
  attendanceLoading: Set<string>
  endTournamentLoading: boolean
  additionalCostsLoading: boolean
  deleteAdditionalCostsLoading: Set<string>
  getDetailedMoneyChange: (tournamentId: string, team: Team, player: Player) => { changes: any[], total: number }
  showFilters?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showFilters: false
})

// Local state
const activeFilter = ref('Ongoing')
const showAttendanceModal = ref(false)
const showEndTournamentModal = ref(false)
const showAdditionalCostsModal = ref(false)
const selectedTournamentId = ref('')
const attendanceFilter = ref('')
const endTournamentId = ref('')
const endTournamentTeams = ref<Team[]>([])
const selectedWinningTeam = ref<Team | null>(null)
const selectedLosingTeam = ref<Team | null>(null)

// Filter configuration
const filters = ['Ongoing', 'Old Tournament']

// Computed properties
const ongoingTournament = computed(() => {
  return props.tournaments.find(tournament => 
    tournament.status === 'UPCOMING' || tournament.status === 'ONGOING'
  )
})

const oldTournaments = computed(() => {
  return props.tournaments.filter(tournament => 
    tournament.status === 'COMPLETED'
  ).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
})

const filteredTournaments = computed(() => {
  if (!props.showFilters) return props.tournaments
  
  if (activeFilter.value === 'Ongoing') {
    return ongoingTournament.value ? [ongoingTournament.value] : []
  } else if (activeFilter.value === 'Old Tournament') {
    return oldTournaments.value
  }
  return props.tournaments
})

const getFilterCount = (filter: string) => {
  if (filter === 'Ongoing') {
    return ongoingTournament.value ? 1 : 0
  } else if (filter === 'Old Tournament') {
    return oldTournaments.value.length
  }
  return 0
}

// Helper functions
const getAttendingCount = (tournamentId: string) => {
  const attendanceDetails = props.attendanceDetailsMap.get(tournamentId) || []
  return attendanceDetails.filter(detail => detail.status === 'ATTEND').length
}

// Event handlers
const handleGenerateTeams = (tournamentId: string) => {
  emits('generate-teams', tournamentId)
}

const handleClearTeams = (tournamentId: string) => {
  emits('clear-teams', tournamentId)
}

const handleEndTournament = (tournamentId: string) => {
  const tournament = props.tournaments.find(t => t.id === tournamentId)
  if (!tournament) return

  endTournamentId.value = tournamentId
  endTournamentTeams.value = tournament.teams || []
  
  // Auto-select winner and loser based on scores
  if (endTournamentTeams.value.length >= 2) {
    const sortedTeams = [...endTournamentTeams.value].sort((a, b) => (b.score || 0) - (a.score || 0))
    selectedWinningTeam.value = sortedTeams[0]
    selectedLosingTeam.value = sortedTeams[sortedTeams.length - 1]
  }
  
  showEndTournamentModal.value = true
}

const handleOpenAttendance = (tournamentId: string, filter: string) => {
  selectedTournamentId.value = tournamentId
  attendanceFilter.value = filter
  showAttendanceModal.value = true
}

const handleOpenAdditionalCosts = (tournamentId: string) => {
  selectedTournamentId.value = tournamentId
  showAdditionalCostsModal.value = true
}

const handleUpdateScore = (tournamentId: string, teamId: string, score: number) => {
  emits('update-score', tournamentId, teamId, score)
}

const handleUpdateAttendance = (tournamentId: string, playerId: string, status: string) => {
  emits('update-attendance', tournamentId, playerId, status)
}

const handleToggleWater = (tournamentId: string, playerId: string) => {
  emits('toggle-water', tournamentId, playerId)
}

const handleToggleBet = (tournamentId: string, playerId: string) => {
  emits('toggle-bet', tournamentId, playerId)
}

const handleCloseEndTournamentModal = () => {
  showEndTournamentModal.value = false
  endTournamentId.value = ''
  endTournamentTeams.value = []
  selectedWinningTeam.value = null
  selectedLosingTeam.value = null
}

const handleConfirmEndTournament = () => {
  emits('confirm-end-tournament', endTournamentId.value)
}

const handleAddAdditionalCost = (cost: { tournamentId: string; description: string; amount: number }) => {
  emits('add-additional-cost', cost)
}

const handleDeleteAdditionalCost = (costId: string) => {
  emits('delete-additional-cost', costId)
}

const handleToggleAttendance = (tournamentId: string) => {
  emits('toggle-attendance', tournamentId)
}

const handleDeleteTournament = (tournamentId: string) => {
  emits('delete-tournament', tournamentId)
}

const emits = defineEmits<{
  'generate-teams': [tournamentId: string]
  'clear-teams': [tournamentId: string]
  'update-score': [tournamentId: string, teamId: string, score: number]
  'update-attendance': [tournamentId: string, playerId: string, status: string]
  'toggle-water': [tournamentId: string, playerId: string]
  'toggle-bet': [tournamentId: string, playerId: string]
  'confirm-end-tournament': [tournamentId: string]
  'add-additional-cost': [cost: { tournamentId: string; description: string; amount: number }]
  'delete-additional-cost': [costId: string]
  'toggle-attendance': [tournamentId: string]
  'delete-tournament': [tournamentId: string]
}>()
</script>
