<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Players</h1>
      <button 
        v-if="authStore.hasPermission('canEditPlayers')"
        @click="showAddForm = true" 
        class="btn-primary w-full sm:w-auto"
      >
        Add New Player
      </button>
    </div>

    <!-- Players Table/Cards -->
    <div class="card p-0 sm:p-6 overflow-hidden">
      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-8">
        <div class="text-red-600 mb-2">{{ error }}</div>
        <button @click="playersStore.fetchPlayers()" class="btn-secondary">
          Try Again
        </button>
      </div>

      <!-- Empty State -->
      <div v-else-if="players.length === 0" class="text-center py-8">
        <div class="text-gray-500 mb-4">No players found</div>
        <button 
          v-if="authStore.hasPermission('canEditPlayers')"
          @click="showAddForm = true" 
          class="btn-primary"
        >
          Add First Player
        </button>
      </div>

      <!-- Players Content -->
      <div v-else>
        <!-- Mobile Cards View -->
      <div class="block sm:hidden">
        <div
          v-for="player in players"
          :key="player.id"
          class="border-b border-gray-200 p-4 last:border-b-0"
        >
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center space-x-3">
              <div class="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span class="text-primary-600 font-medium text-sm">
                  {{ player.name.split(' ').map(n => n[0]).join('') }}
                </span>
              </div>
              <div>
                <div class="text-sm font-medium text-gray-900">{{ player.name }}</div>
                <div class="text-xs text-gray-500">{{ player.position }} • Born {{ player.yearOfBirth }}</div>
              </div>
            </div>
            <div class="flex space-x-2">
              <button
                v-if="authStore.hasPermission('canEditPlayers')"
                @click="editPlayer(player)"
                class="text-primary-600 hover:text-primary-800 p-1"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                v-if="authStore.hasPermission('canDeletePlayers')"
                @click="deletePlayer(player.id)"
                class="text-red-600 hover:text-red-800 p-1"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-3 text-xs justify-between">
            <div>
              <div class="flex items-center mt-1">
                <div class="flex">
                  <div 
                    v-for="star in 10" 
                    :key="star"
                    :class="star <= player.tier ? 'text-yellow-400' : 'text-gray-300'"
                    class="w-3 h-3"
                  >
                    ★
                  </div>
                </div>
              </div>
            </div>
            <div class="text-right">
              <span class="text-gray-500">Money:</span>
              <span class="text-sm font-medium">${{ player.money.toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Desktop Table View -->
      <div class="hidden sm:block overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Position
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Born
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tier
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Money
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="player in players" :key="player.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-10 w-10">
                    <div class="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span class="text-primary-600 font-medium">
                        {{ player.name.split(' ').map(n => n[0]).join('') }}
                      </span>
                    </div>
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">{{ player.name }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ player.position }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ player.yearOfBirth }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <div class="flex items-center">
                  <div class="flex">
                    <div 
                      v-for="star in 10" 
                      :key="star"
                      :class="star <= player.tier ? 'text-yellow-400' : 'text-gray-300'"
                      class="w-3 h-3"
                    >
                      ★
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${{ player.money.toLocaleString() }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex space-x-2">
                  <button
                    v-if="authStore.hasPermission('canEditPlayers')"
                    @click="editPlayer(player)"
                    class="text-primary-600 hover:text-primary-900"
                  >
                    Edit
                  </button>
                  <button
                    v-if="authStore.hasPermission('canDeletePlayers')"
                    @click="deletePlayer(player.id)"
                    class="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                  <span v-if="!authStore.hasPermission('canEditPlayers')" class="text-gray-400 text-sm">
                    View Only
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    </div>

    <!-- Add/Edit Player Modal -->
    <div v-if="showAddForm || editingPlayer" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 class="text-lg font-semibold mb-4">
          {{ editingPlayer ? 'Edit Player' : 'Add New Player' }}
        </h2>
        
        <form @submit.prevent="submitForm" class="space-y-4">
          <div>
            <label class="form-label">Player Name</label>
            <input
              v-model="formData.name"
              type="text"
              required
              class="form-input"
              placeholder="Enter player name"
            >
          </div>
          
          <div>
            <label class="form-label">Position</label>
            <select v-model="formData.position" required class="form-input">
              <option value="">Select position</option>
              <option value="Goalkeeper">Goalkeeper</option>
              <option value="Defender">Defender</option>
              <option value="Midfielder">Midfielder</option>
              <option value="Forward">Forward</option>
            </select>
          </div>
          
          <div>
            <label class="form-label">Year of Birth</label>
            <input
              v-model="formData.yearOfBirth"
              type="number"
              required
              min="1960"
              max="2010"
              class="form-input"
              placeholder="e.g., 1987"
            >
          </div>
          
          <div>
            <label class="form-label">Tier (1-10)</label>
            <select v-model="formData.tier" required class="form-input">
              <option value="">Select tier</option>
              <option v-for="tier in 10" :key="tier" :value="tier">
                {{ tier }} {{ '★'.repeat(tier) }}
              </option>
            </select>
          </div>
          
          <div>
            <label class="form-label">Money ($)</label>
            <input
              v-model="formData.money"
              type="number"
              required
              min="0"
              step="1000"
              class="form-input"
              placeholder="e.g., 50000"
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
              {{ editingPlayer ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePlayersStore } from '../stores/players'
import { useTeamsStore } from '../stores/teams'
import { useAuthStore } from '../stores/auth'
import type { Player } from '../types'

const playersStore = usePlayersStore()
const teamsStore = useTeamsStore()
const authStore = useAuthStore()

const players = computed(() => playersStore.players)
const loading = computed(() => playersStore.loading)
const error = computed(() => playersStore.error)
const showAddForm = ref(false)
const editingPlayer = ref<Player | null>(null)

onMounted(async () => {
  await Promise.all([
    playersStore.fetchPlayers(),
    teamsStore.fetchTeams()
  ])
})

onMounted(async () => {
  await playersStore.fetchPlayers()
  await teamsStore.fetchTeams()
})

const formData = ref({
  name: '',
  position: '',
  yearOfBirth: '',
  tier: '',
  money: ''
})

function editPlayer(player: Player) {
  editingPlayer.value = player
  formData.value = {
    name: player.name,
    position: player.position,
    yearOfBirth: player.yearOfBirth.toString(),
    tier: player.tier.toString(),
    money: player.money.toString()
  }
}

function submitForm() {
  const playerData = {
    name: formData.value.name,
    position: formData.value.position,
    yearOfBirth: parseInt(formData.value.yearOfBirth),
    tier: parseInt(formData.value.tier),
    money: parseInt(formData.value.money),
    teamId: undefined, // Remove team assignment from player creation
    stats: {
      gamesPlayed: 0,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      minutesPlayed: 0
    }
  }

  if (editingPlayer.value) {
    playersStore.updatePlayer(editingPlayer.value.id, playerData)
      .then(() => cancelForm())
      .catch(() => {
        // Error is handled by the store
      })
  } else {
    playersStore.addPlayer(playerData)
      .then(() => cancelForm())
      .catch(() => {
        // Error is handled by the store
      })
  }
}

function cancelForm() {
  showAddForm.value = false
  editingPlayer.value = null
  formData.value = {
    name: '',
    position: '',
    yearOfBirth: '',
    tier: '',
    money: ''
  }
}

function deletePlayer(id: string) {
  if (confirm('Are you sure you want to delete this player?')) {
    playersStore.deletePlayer(id)
  }
}
</script>
