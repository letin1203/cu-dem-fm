<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Tournaments</h1>
      <button 
        v-if="authStore.hasPermission('canEditTournaments')"
        @click="showAddForm = true" 
        class="btn-primary w-full sm:w-auto"
      >
        Create New Tournament
      </button>
    </div>

    <!-- Tournaments Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      <div
        v-for="tournament in tournaments"
        :key="tournament.id"
        class="card hover:shadow-lg transition-shadow"
      >
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">{{ tournament.name }}</h3>
          <span
            :class="getStatusClasses(tournament.status)"
            class="px-2 py-1 text-xs font-medium rounded-full"
          >
            {{ tournament.status }}
          </span>
        </div>
        
        <div class="space-y-2 text-sm text-gray-600 mb-4">
          <div>Type: {{ tournament.type }}</div>
          <div>Start Date: {{ formatDate(tournament.startDate) }}</div>
          <div v-if="tournament.endDate">
            End Date: {{ formatDate(tournament.endDate) }}
          </div>
          <div>Teams: {{ tournament.teams.length }}</div>
          <div>Matches: {{ tournament.matches.length }}</div>
        </div>
        
        <div class="flex justify-between items-center">
          <div class="flex space-x-2">
            <button
              v-if="authStore.hasPermission('canEditTournaments')"
              @click="editTournament(tournament)"
              class="text-primary-600 hover:text-primary-800 text-sm"
            >
              Edit
            </button>
            <button
              v-if="authStore.hasPermission('canDeleteTournaments')"
              @click="deleteTournament(tournament.id)"
              class="text-red-600 hover:text-red-800 text-sm"
            >
              Delete
            </button>
          </div>
          <button
            @click="viewTournament(tournament)"
            class="btn-primary text-sm py-1 px-3"
          >
            View Details
          </button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Tournament Modal -->
    <div v-if="showAddForm || editingTournament" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 class="text-lg font-semibold mb-4">
          {{ editingTournament ? 'Edit Tournament' : 'Create New Tournament' }}
        </h2>

        <!-- Add/Edit Teams Section -->
        <div class="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 class="font-medium text-gray-900 mb-3">Teams</h3>
          
          <!-- Current Teams -->
          <div v-if="formData.teams.length > 0" class="space-y-2 mb-4">
            <div
              v-for="team in formData.teams"
              :key="team.id"
              class="flex justify-between items-center p-2 bg-white rounded border"
            >
              <span class="text-sm">{{ team.name }}</span>
              <button
                type="button"
                @click="removeTeamFromTournament(team.id)"
                class="text-red-600 hover:text-red-800 text-sm"
              >
                Remove
              </button>
            </div>
          </div>
          <div v-else class="text-sm text-gray-500 mb-4">
            No teams added yet
          </div>
          
          <!-- Add Team -->
          <div class="flex space-x-2">
            <select v-model="selectedTeamId" class="form-input flex-1">
              <option value="">Select a team</option>
              <option 
                v-for="team in availableTeams" 
                :key="team.id" 
                :value="team.id"
              >
                {{ team.name }}
              </option>
            </select>
            <button
              type="button"
              @click="addTeamToTournament"
              :disabled="!selectedTeamId"
              class="btn-primary text-sm"
            >
              Add Team
            </button>
          </div>
        </div>
        
        <form @submit.prevent="submitForm" class="space-y-4">
          <div>
            <label class="form-label">Tournament Name</label>
            <input
              v-model="formData.name"
              type="text"
              required
              class="form-input"
              placeholder="Enter tournament name"
            >
          </div>
          
          <div>
            <label class="form-label">Type</label>
            <select v-model="formData.type" required class="form-input">
              <option value="">Select type</option>
              <option value="league">League</option>
              <option value="knockout">Knockout</option>
              <option value="group">Group Stage</option>
            </select>
          </div>
          
          <div>
            <label class="form-label">Status</label>
            <select v-model="formData.status" required class="form-input">
              <option value="UPCOMING">Upcoming</option>
              <option value="ONGOING">Ongoing</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          
          <div>
            <label class="form-label">Start Date</label>
            <input
              v-model="formData.startDate"
              type="date"
              required
              class="form-input"
            >
          </div>
          
          <div>
            <label class="form-label">End Date (Optional)</label>
            <input
              v-model="formData.endDate"
              type="date"
              class="form-input"
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
              {{ editingTournament ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Tournament Details Modal -->
    <div v-if="selectedTournament" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-4xl max-h-96 overflow-y-auto">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-xl font-semibold">{{ selectedTournament.name }}</h2>
          <button @click="selectedTournament = null" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 class="font-medium text-gray-900 mb-3">Tournament Details</h3>
            <div class="space-y-2 text-sm">
              <div>Type: {{ selectedTournament.type }}</div>
              <div>Status: 
                <span :class="getStatusClasses(selectedTournament.status)" class="px-2 py-1 text-xs font-medium rounded-full ml-1">
                  {{ selectedTournament.status }}
                </span>
              </div>
              <div>Start Date: {{ formatDate(selectedTournament.startDate) }}</div>
              <div v-if="selectedTournament.endDate">
                End Date: {{ formatDate(selectedTournament.endDate) }}
              </div>
              <div v-if="selectedTournament.winner">
                Winner: {{ selectedTournament.winner.name }}
              </div>
            </div>
          </div>
          
          <div>
            <h3 class="font-medium text-gray-900 mb-3">Participating Teams</h3>
            <div v-if="selectedTournament.teams.length === 0" class="text-gray-500 text-sm">
              No teams registered yet
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="team in selectedTournament.teams"
                :key="team.id"
                class="flex justify-between items-center p-2 bg-gray-50 rounded"
              >
                <span>{{ team.name }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="mt-6">
          <h3 class="font-medium text-gray-900 mb-3">Matches</h3>
          <div v-if="selectedTournament.matches.length === 0" class="text-gray-500 text-sm">
            No matches scheduled yet
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="match in selectedTournament.matches"
              :key="match.id"
              class="flex justify-between items-center p-3 bg-gray-50 rounded"
            >
              <div>
                {{ match.homeTeam.name }} vs {{ match.awayTeam.name }}
              </div>
              <div class="text-sm text-gray-500">
                {{ formatDate(match.scheduledDate) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTournamentsStore } from '../stores/tournaments'
import { useTeamsStore } from '../stores/teams'
import { useAuthStore } from '../stores/auth'
import type { Tournament, Team } from '../types'

const tournamentsStore = useTournamentsStore()
const teamsStore = useTeamsStore()
const authStore = useAuthStore()

const tournaments = computed(() => 
  tournamentsStore.tournaments.filter(tournament => tournament.type !== 'WEEKLY')
)
const loading = computed(() => tournamentsStore.loading || teamsStore.loading)
const error = computed(() => tournamentsStore.error || teamsStore.error)
const showAddForm = ref(false)
const editingTournament = ref<Tournament | null>(null)
const selectedTournament = ref<Tournament | null>(null)
const selectedTeamId = ref('')

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

onMounted(async () => {
  await Promise.all([
    tournamentsStore.fetchTournaments(),
    teamsStore.fetchTeams()
  ])
})

const formData = ref({
  name: '',
  type: '',
  status: 'UPCOMING',
  startDate: '',
  endDate: '',
  teams: [] as Team[]
})

const availableTeams = computed(() => {
  // Get teams that are not already in the tournament
  return teamsStore.teams.filter(team => 
    !formData.value.teams.some(selectedTeam => selectedTeam.id === team.id)
  )
})

function addTeamToTournament() {
  if (!selectedTeamId.value) return
  
  const team = teamsStore.teams.find(t => t.id === selectedTeamId.value)
  if (team && !formData.value.teams.some(t => t.id === team.id)) {
    formData.value.teams.push(team)
    selectedTeamId.value = ''
  }
}

function removeTeamFromTournament(teamId: string) {
  formData.value.teams = formData.value.teams.filter(team => team.id !== teamId)
}

function getStatusClasses(status: string) {
  const classes = {
    UPCOMING: 'bg-yellow-100 text-yellow-800',
    ONGOING: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-gray-100 text-gray-800'
  }
  return classes[status as keyof typeof classes] || classes.UPCOMING
}

function editTournament(tournament: Tournament) {
  editingTournament.value = tournament
  
  // Helper function to safely format date for input
  const formatDateForInput = (date: string | Date | null | undefined): string => {
    if (!date) return ''
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date
      return dateObj.toISOString().split('T')[0]
    } catch {
      return ''
    }
  }
  
  formData.value = {
    name: tournament.name,
    type: tournament.type,
    status: tournament.status,
    startDate: formatDateForInput(tournament.startDate),
    endDate: formatDateForInput(tournament.endDate),
    teams: [...tournament.teams]
  }
}

function viewTournament(tournament: Tournament) {
  selectedTournament.value = tournament
}

function submitForm() {
  const tournamentData = {
    name: formData.value.name,
    type: formData.value.type as 'league' | 'knockout' | 'group',
    status: formData.value.status as 'UPCOMING' | 'ONGOING' | 'COMPLETED',
    startDate: new Date(formData.value.startDate),
    endDate: formData.value.endDate ? new Date(formData.value.endDate) : undefined,
    teams: formData.value.teams,
    matches: []
  }

  if (editingTournament.value) {
    tournamentsStore.updateTournament(editingTournament.value.id, tournamentData)
  } else {
    tournamentsStore.addTournament(tournamentData)
  }
  
  cancelForm()
}

function cancelForm() {
  showAddForm.value = false
  editingTournament.value = null
  selectedTeamId.value = ''
  formData.value = {
    name: '',
    type: '',
    status: 'UPCOMING',
    startDate: '',
    endDate: '',
    teams: []
  }
}

function deleteTournament(id: string) {
  if (confirm('Are you sure you want to delete this tournament?')) {
    tournamentsStore.deleteTournament(id)
  }
}
</script>
