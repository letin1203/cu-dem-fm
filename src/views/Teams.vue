<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Teams</h1>
      <button 
        v-if="authStore.hasPermission('canEditTeams')"
        @click="showAddForm = true" 
        class="btn-primary w-full sm:w-auto"
      >
        Add New Team
      </button>
    </div>

    <!-- Teams Grid -->
    <div v-if="loading" class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <div v-else-if="error" class="text-center py-8">
      <div class="text-red-600 mb-2">{{ error }}</div>
      <button @click="teamsStore.fetchTeams()" class="btn-secondary">
        Try Again
      </button>
    </div>

    <div v-else-if="teams.length === 0" class="text-center py-8">
      <div class="text-gray-500 mb-4">No teams found</div>
      <button @click="showAddForm = true" class="btn-primary">
        Add First Team
      </button>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      <div
        v-for="team in teams"
        :key="team.id"
        class="card hover:shadow-lg transition-shadow cursor-pointer"
        @click="selectedTeam = team"
      >
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">{{ team.name }}</h3>
          <div class="flex space-x-2">
            <button
              v-if="authStore.hasPermission('canEditTeams')"
              @click.stop="editTeam(team)"
              class="text-primary-600 hover:text-primary-800"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              v-if="authStore.hasPermission('canDeleteTeams')"
              @click.stop="deleteTeam(team.id)"
              class="text-red-600 hover:text-red-800"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        
        <div class="text-sm text-gray-500 mb-4">
          Players: {{ getTeamPlayers(team.id).length }}
        </div>
        
        <!-- Players List -->
        <div class="mb-4">
          <h4 class="font-medium text-gray-700 mb-2">Players</h4>
          <div v-if="getTeamPlayers(team.id).length === 0" class="text-xs text-gray-500">
            No players assigned
          </div>
          <div v-else class="text-xs text-gray-600">
            {{ getTeamPlayers(team.id).slice(0, 3).map(p => p.name).join(', ') }}
            <span v-if="getTeamPlayers(team.id).length > 3">
              +{{ getTeamPlayers(team.id).length - 3 }} more
            </span>
          </div>
        </div>

        <!-- Tournaments -->
        <div>
          <h4 class="font-medium text-gray-700 mb-2">Tournaments</h4>
          <div v-if="getTeamTournaments(team.id).length === 0" class="text-xs text-gray-500">
            No tournaments
          </div>
          <div v-else class="space-y-1">
            <div 
              v-for="tournament in getTeamTournaments(team.id).slice(0, 2)" 
              :key="tournament.id"
              class="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full inline-block mr-1"
            >
              {{ tournament.name }}
            </div>
            <div v-if="getTeamTournaments(team.id).length > 2" class="text-xs text-gray-500">
              +{{ getTeamTournaments(team.id).length - 2 }} more
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Team Modal -->
    <div v-if="showAddForm || editingTeam" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 class="text-lg font-semibold mb-4">
          {{ editingTeam ? 'Edit Team' : 'Add New Team' }}
        </h2>

        <!-- Add/Edit Players Section -->
        <div v-if="authStore.hasPermission('canEditTeams')" class="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 class="font-medium text-gray-900 mb-3">Players</h3>
          
          <!-- Current Players -->
          <div v-if="formData.players.length > 0" class="space-y-2 mb-4">
            <div
              v-for="player in formData.players"
              :key="player.id"
              class="flex justify-between items-center p-2 bg-white rounded border"
            >
              <div>
                <span class="text-sm font-medium">{{ player.name }}</span>
                <span class="text-xs text-gray-500 ml-2">{{ player.position }}</span>
              </div>
              <button
                type="button"
                @click="removePlayerFromTeamForm(player.id)"
                class="text-red-600 hover:text-red-800 text-sm"
              >
                Remove
              </button>
            </div>
          </div>
          <div v-else class="text-sm text-gray-500 mb-4">
            No players added yet
          </div>
          
          <!-- Add Player -->
          <div class="flex space-x-2">
            <select v-model="selectedPlayerIdForm" class="form-input flex-1">
              <option value="">Select a free agent</option>
              <option 
                v-for="player in availablePlayersForm" 
                :key="player.id" 
                :value="player.id"
              >
                {{ player.name }} ({{ player.position }})
              </option>
            </select>
            <button
              type="button"
              @click="addPlayerToTeamForm"
              :disabled="!selectedPlayerIdForm"
              class="btn-primary text-sm"
            >
              Add Player
            </button>
          </div>
        </div>
        
        <form @submit.prevent="submitForm" class="space-y-4">
          <div>
            <label class="form-label">Team Name</label>
            <input
              v-model="formData.name"
              type="text"
              required
              class="form-input"
              placeholder="Enter team name"
            >
          </div>
          
          <div class="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              @click="cancelForm"
              class="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" class="btn-primary">
              {{ editingTeam ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Team Details Modal -->
    <div v-if="selectedTeam && !showAddForm && !editingTeam" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-2xl max-h-96 overflow-y-auto">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold">{{ selectedTeam.name }}</h2>
          <button @click="selectedTeam = null" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div>
          <h3 class="font-medium text-gray-900 mb-2">Players</h3>
          <div v-if="teamPlayers.length === 0" class="text-gray-500 text-sm mb-4">
            No players assigned to this team
          </div>
          <div v-else class="space-y-2 mb-4">
            <div
              v-for="player in teamPlayers"
              :key="player.id"
              class="flex justify-between items-center p-2 bg-gray-50 rounded"
            >
              <div>
                <div class="font-medium">{{ player.name }}</div>
                <div class="text-sm text-gray-500">{{ player.position }} • Born {{ player.yearOfBirth }}</div>
              </div>
              <div class="flex items-center space-x-2">
                <div class="text-sm flex">
                  <div 
                    v-for="star in player.tier" 
                    :key="star"
                    class="w-3 h-3 text-yellow-400"
                  >
                    ★
                  </div>
                </div>
                <button
                  v-if="authStore.hasPermission('canEditTeams')"
                  @click="removePlayerFromTeam(player.id)"
                  class="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
          
          <!-- Add Player to Team -->
          <div v-if="authStore.hasPermission('canEditTeams')" class="border-t pt-4">
            <h4 class="text-sm font-medium text-gray-700 mb-2">Add Player to Team</h4>
            <div class="flex space-x-2">
              <select v-model="selectedPlayerId" class="form-input flex-1">
                <option value="">Select a free agent</option>
                <option 
                  v-for="player in availablePlayers" 
                  :key="player.id" 
                  :value="player.id"
                >
                  {{ player.name }} ({{ player.position }})
                </option>
              </select>
              <button
                @click="addPlayerToTeam"
                :disabled="!selectedPlayerId"
                class="btn-primary text-sm"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTeamsStore } from '../stores/teams'
import { usePlayersStore } from '../stores/players'
import { useTournamentsStore } from '../stores/tournaments'
import { useAuthStore } from '../stores/auth'
import type { Team, Player } from '../types'

const teamsStore = useTeamsStore()
const playersStore = usePlayersStore()
const tournamentsStore = useTournamentsStore()
const authStore = useAuthStore()

const teams = computed(() => teamsStore.teams)
const loading = computed(() => teamsStore.loading || playersStore.loading)
const error = computed(() => teamsStore.error || playersStore.error)
const showAddForm = ref(false)
const editingTeam = ref<Team | null>(null)
const selectedTeam = ref<Team | null>(null)
const selectedPlayerId = ref('')
const selectedPlayerIdForm = ref('')

onMounted(async () => {
  await Promise.all([
    teamsStore.fetchTeams(),
    playersStore.fetchPlayers(),
    tournamentsStore.fetchTournaments()
  ])
})

const formData = ref({
  name: '',
  players: [] as Player[]
})

const teamPlayers = computed(() => {
  if (!selectedTeam.value) return []
  return playersStore.getPlayersByTeam(selectedTeam.value.id)
})

const availablePlayers = computed(() => {
  // Get players that don't have a team assigned
  return playersStore.players.filter(player => !player.teamId)
})

const availablePlayersForm = computed(() => {
  // Get players that are not already in the form and don't have a team assigned
  return playersStore.players.filter(player => 
    !player.teamId && !formData.value.players.some(formPlayer => formPlayer.id === player.id)
  )
})

function addPlayerToTeamForm() {
  if (!selectedPlayerIdForm.value) return
  
  const player = playersStore.players.find(p => p.id === selectedPlayerIdForm.value)
  if (player && !formData.value.players.some(p => p.id === player.id)) {
    formData.value.players.push(player)
    selectedPlayerIdForm.value = ''
  }
}

function removePlayerFromTeamForm(playerId: string) {
  formData.value.players = formData.value.players.filter(player => player.id !== playerId)
}

function getTeamPlayers(teamId: string) {
  return playersStore.getPlayersByTeam(teamId)
}

function getTeamTournaments(teamId: string) {
  // Find tournaments that include this team
  return tournamentsStore.tournaments.filter(tournament => 
    tournament.teams.some(team => team.id === teamId)
  )
}

function addPlayerToTeam() {
  if (!selectedPlayerId.value || !selectedTeam.value) return
  
  playersStore.assignPlayerToTeam(selectedPlayerId.value, selectedTeam.value.id)
  selectedPlayerId.value = ''
}

function removePlayerFromTeam(playerId: string) {
  playersStore.removePlayerFromTeam(playerId)
}

function editTeam(team: Team) {
  editingTeam.value = team
  formData.value = {
    name: team.name,
    players: [...playersStore.getPlayersByTeam(team.id)]
  }
}

async function submitForm() {
  const teamData = {
    name: formData.value.name,
    founded: new Date(), // Use current date for new teams
    players: [],
    stats: {
      gamesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0
    }
  }

  try {
    let teamId: string

    if (editingTeam.value) {
      teamId = editingTeam.value.id
      await teamsStore.updateTeam(teamId, teamData)
    } else {
      const newTeam = await teamsStore.addTeam(teamData)
      teamId = newTeam?.id || ''
    }

    // Handle player assignments
    if (editingTeam.value) {
      // Remove all current players from the team
      const currentPlayers = playersStore.getPlayersByTeam(teamId)
      for (const player of currentPlayers) {
        await playersStore.removePlayerFromTeam(player.id)
      }
    }

    // Assign selected players to the team
    for (const player of formData.value.players) {
      await playersStore.assignPlayerToTeam(player.id, teamId)
    }

    cancelForm()
  } catch (error) {
    // Error is handled by the store
    console.error('Form submission error:', error)
  }
}

function cancelForm() {
  showAddForm.value = false
  editingTeam.value = null
  selectedPlayerIdForm.value = ''
  formData.value = {
    name: '',
    players: []
  }
}

function deleteTeam(id: string) {
  if (confirm('Are you sure you want to delete this team?')) {
    teamsStore.deleteTeam(id)
  }
}
</script>
