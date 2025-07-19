<template>
  <div 
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-lg max-w-4xl w-full max-h-[75vh] overflow-hidden">
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">
          {{ getModalTitle() }}
        </h3>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="p-6 overflow-y-auto max-h-[calc(75vh-140px)]">
        <div v-if="filteredPlayers.length === 0" class="text-center py-8 text-gray-500">
          No players found for the selected filter.
        </div>
         <div v-else class="space-y-3">
          <div 
            v-for="player in filteredPlayers" 
            :key="player.id"
            class="flex items-center p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors w-full"
          >
            <!-- Player Avatar -->
            <div class="flex-shrink-0 mr-4">
              <img
                v-if="player.avatar"
                :src="player.avatar"
                :alt="player.name"
                class="w-10 h-10 rounded-full object-cover"
              />
              <div
                v-else
                class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium"
              >
                {{ player.name.charAt(0).toUpperCase() }}
              </div>
            </div>
            
            <!-- Player Info - Takes full width -->
            <div class="flex-1 min-w-0">
              <!-- Player Name Row with Water Toggle Button -->
              <div class="flex items-center justify-between w-full">
                <h4 class="font-semibold text-gray-900 truncate">{{ player.name }}</h4>
                
                <!-- Water Toggle Button (right aligned) -->
                <div class="flex items-center ml-4">
                  <button
                    @click="handleToggleWater(player.id)"
                    :disabled="attendanceLoading.has(player.id)"
                    class="text-xs px-2 py-1 rounded-full transition-colors whitespace-nowrap"
                    :class="getPlayerAttendance(player.id)?.withWater 
                      ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                    :title="getPlayerAttendance(player.id)?.withWater ? 'Click to remove water preference' : 'Click to add water preference'"
                  >
                    <div v-if="attendanceLoading.has(player.id)" class="flex items-center">
                      <div class="animate-spin rounded-full h-3 w-3 border-b border-current mr-1"></div>
                      <span>Loading...</span>
                    </div>
                    <span v-else>
                      {{ getPlayerAttendance(player.id)?.withWater ? '💧 Water' : '🚫 No Water' }}
                    </span>
                  </button>
                </div>
              </div>
              
              <!-- Player Details Row -->
              <div class="flex items-center justify-between mt-1 w-full">
                <span class="text-sm text-gray-600">{{ player.position }}</span>
                <span class="flex items-center text-sm text-gray-600">
                  <span class="ml-1">
                    {{ '⭐'.repeat(player.tier) }}
                  </span>
                </span>
              </div>

              <!-- Button Block: Attend, Water, Bet -->
              <div class="flex space-x-2 mt-2">
                <!-- Attend Button -->
                <button
                  @click="handleUpdateAttendance(player.id, 'ATTENDING')"
                  :disabled="attendanceLoading.has(player.id)"
                  class="px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                  :class="[
                    attendanceLoading.has(player.id)
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:shadow-md',
                    getPlayerAttendance(player.id)?.status === 'ATTENDING'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  ]"
                >
                  <div class="flex items-center space-x-1">
                    <span>{{ attendanceLoading.has(player.id) ? 'Loading...' : (getPlayerAttendance(player.id)?.status === 'ATTENDING' ? 'Attended' : 'Attend') }}</span>
                    <svg 
                      v-if="getPlayerAttendance(player.id)?.status === 'ATTENDING'" 
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
                  @click="handleToggleWater(player.id)"
                  :disabled="attendanceLoading.has(player.id)"
                  class="px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                  :class="[
                    attendanceLoading.has(player.id)
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:shadow-md',
                    getPlayerAttendance(player.id)?.withWater
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  ]"
                >
                  <div class="flex items-center space-x-1">
                    <span>{{ attendanceLoading.has(player.id) ? 'Loading...' : (getPlayerAttendance(player.id)?.withWater ? 'Water ✓' : 'Water') }}</span>
                  </div>
                </button>
                <!-- Bet Button -->
                <button
                  @click="handleToggleBet(player.id)"
                  :disabled="attendanceLoading.has(player.id)"
                  class="px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                  :class="[
                    attendanceLoading.has(player.id)
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:shadow-md',
                    getPlayerAttendance(player.id)?.bet
                      ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  ]"
                >
                  <div class="flex items-center space-x-1">
                    <span>{{ attendanceLoading.has(player.id) ? 'Loading...' : (getPlayerAttendance(player.id)?.bet ? 'Bet ✓' : 'Bet') }}</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-between items-center space-x-3 p-6 border-t border-gray-200">
        <span class="text-sm text-gray-600">
          {{ filteredPlayers.length }} players {{ filter === 'attending' ? 'attending' : filter === 'not-attending' ? 'not attending' : filter }}
        </span>
        <button
          @click="$emit('close')"
          class="btn-secondary"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Player } from '../../types'

interface AttendanceDetail {
  id: string
  playerId: string
  status: string
  withWater: boolean
  bet: boolean
  player: Player
}

interface Props {
  isOpen: boolean
  tournamentId: string
  filter: string
  players: Player[]
  attendanceDetails: AttendanceDetail[]
  attendanceLoading: Set<string>
}

const props = defineProps<Props>()

const filteredPlayers = computed(() => {
  switch (props.filter) {
    case 'attending':
      return props.players.filter(player => {
        const attendance = getPlayerAttendance(player.id)
        return attendance?.status === 'ATTEND'
      })
    case 'not-attending':
      return props.players.filter(player => {
        const attendance = getPlayerAttendance(player.id)
        return attendance?.status === 'NOT_ATTEND'
      })
    case 'water':
      return props.players.filter(player => {
        const attendance = getPlayerAttendance(player.id)
        return attendance?.withWater === true
      })
    case 'betting':
      return props.players.filter(player => {
        const attendance = getPlayerAttendance(player.id)
        return attendance?.bet === true
      })
    default:
      return props.players
  }
})

const getModalTitle = () => {
  switch (props.filter) {
    case 'attending':
      return 'Players Attending'
    case 'not-attending':
      return 'Players Not Attending'
    case 'water':
      return 'Players with Water'
    case 'betting':
      return 'Players Betting'
    default:
      return 'All Players'
  }
}

const getPlayerAttendance = (playerId: string) => {
  return props.attendanceDetails.find(detail => detail.playerId === playerId)
}

const handleToggleWater = (playerId: string) => {
  emits('toggle-water', props.tournamentId, playerId)
}

const handleToggleBet = (playerId: string) => {
  emits('toggle-bet', props.tournamentId, playerId)
}

const handleUpdateAttendance = (playerId: string, status: string) => {
  emits('update-attendance', props.tournamentId, playerId, status)
}

const emits = defineEmits<{
  'close': []
  'toggle-water': [tournamentId: string, playerId: string]
  'toggle-bet': [tournamentId: string, playerId: string]
  'update-attendance': [tournamentId: string, playerId: string, status: string]
}>()
</script>
