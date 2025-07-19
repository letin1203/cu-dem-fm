<template>
  <div 
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">
          End Tournament
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

      <div class="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
        <div class="space-y-6">
          <!-- Winner/Loser Selection -->
          <div v-if="selectedWinningTeam && selectedLosingTeam" class="bg-gray-50 p-4 rounded-lg">
            <h4 class="font-medium text-gray-900 mb-3">Tournament Result</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="bg-green-50 p-3 rounded border border-green-200">
                <div class="text-green-800 font-medium">Winner</div>
                <div class="text-green-700">{{ selectedWinningTeam.name }} ({{ selectedWinningTeam.score }} points)</div>
              </div>
              <div class="bg-red-50 p-3 rounded border border-red-200">
                <div class="text-red-800 font-medium">Loser</div>
                <div class="text-red-700">{{ selectedLosingTeam.name }} ({{ selectedLosingTeam.score }} points)</div>
              </div>
            </div>
          </div>

          <!-- Preview Money Changes -->
          <div v-if="teams.length > 0" class="space-y-4">
            <h4 class="font-medium text-gray-900">Preview Money Changes</h4>
            
            <div 
              v-for="team in teams" 
              :key="team.id"
              class="border border-gray-200 rounded-lg p-4"
            >
              <h5 class="font-medium text-gray-900 mb-3 flex items-center">
                {{ team.name }}
                <span 
                  v-if="selectedWinningTeam && team.id === selectedWinningTeam.id"
                  class="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded"
                >
                  Winner
                </span>
                <span 
                  v-else-if="selectedLosingTeam && team.id === selectedLosingTeam.id"
                  class="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded"
                >
                  Loser
                </span>
              </h5>
              
              <div class="space-y-3">
                <div 
                  v-for="player in getAttendingPlayersInTeam(team.id)"
                  :key="player.id"
                  class="bg-gray-50 p-3 rounded"
                >
                  <div class="flex justify-between items-start mb-2">
                    <div>
                      <div class="font-medium text-gray-900">{{ player.name }}</div>
                      <div class="text-sm text-gray-600">Current: {{ player.money.toLocaleString() }} VND</div>
                    </div>
                  </div>
                  
                  <div class="space-y-1 text-sm">
                    <div 
                      v-for="change in getDetailedMoneyChange(tournamentId, team, player).changes" 
                      :key="change.type"
                      class="flex justify-between"
                      :class="change.amount >= 0 ? 'text-green-600' : 'text-red-600'"
                    >
                      <span>{{ change.description }}:</span>
                      <span>{{ change.amount >= 0 ? '+' : '' }}{{ change.amount.toLocaleString() }} VND</span>
                    </div>
                  </div>
                  
                  <div class="flex justify-between items-center text-sm pt-2 border-t border-gray-200 mt-2">
                    <span class="font-medium">Total Change:</span>
                    <span 
                      class="font-medium"
                      :class="getDetailedMoneyChange(tournamentId, team, player).total >= 0 ? 'text-green-600' : 'text-red-600'"
                    >
                      {{ getDetailedMoneyChange(tournamentId, team, player).total >= 0 ? '+' : '' }}{{ getDetailedMoneyChange(tournamentId, team, player).total.toLocaleString() }} VND
                    </span>
                  </div>
                  
                  <div class="flex justify-between items-center text-sm text-gray-600 mt-1">
                    <span>New Balance:</span>
                    <span>{{ (player.money + getDetailedMoneyChange(tournamentId, team, player).total).toLocaleString() }} VND</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end space-x-3 p-6 border-t border-gray-200">
        <button
          @click="$emit('close')"
          class="btn-secondary"
        >
          Cancel
        </button>
        <button
          @click="$emit('confirm')"
          :disabled="!canEndTournament || confirmLoading"
          class="btn-danger"
        >
          {{ confirmLoading ? 'Ending...' : 'Confirm End Tournament' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Team, Player } from '../../types'

interface MoneyChange {
  type: string
  amount: number
  description: string
}

interface Props {
  isOpen: boolean
  tournamentId: string
  teams: Team[]
  selectedWinningTeam?: Team
  selectedLosingTeam?: Team
  attendanceDetails: any[]
  tournamentTeamPlayers: any[]
  confirmLoading: boolean
  getDetailedMoneyChange: (tournamentId: string, team: Team, player: Player) => { changes: MoneyChange[], total: number }
}

const props = defineProps<Props>()

const canEndTournament = computed(() => {
  return props.selectedWinningTeam && 
         props.selectedLosingTeam && 
         props.selectedWinningTeam.id !== props.selectedLosingTeam.id &&
         (props.selectedWinningTeam.score || 0) !== (props.selectedLosingTeam.score || 0)
})

const getAttendingPlayersInTeam = (teamId: string) => {
  const teamPlayerIds = props.tournamentTeamPlayers
    .filter(ttp => ttp.teamId === teamId)
    .map(ttp => ttp.playerId)
  
  return props.attendanceDetails
    .filter(detail => detail.status === 'ATTENDING' && teamPlayerIds.includes(detail.playerId))
    .map(detail => detail.player)
    .filter(Boolean)
}

defineEmits<{
  'close': []
  'confirm': []
}>()
</script>
