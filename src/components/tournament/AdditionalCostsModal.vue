<template>
  <div 
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">
          Additional Costs
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
        <!-- Add New Cost Form -->
        <div class="bg-gray-50 p-4 rounded-lg mb-6">
          <h4 class="font-medium text-gray-900 mb-3">Add New Cost</h4>
          <form @submit.prevent="handleSubmit" class="space-y-4">
            <div>
              <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                id="description"
                v-model="form.description"
                type="text"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g., Venue rental, Equipment, etc."
              />
            </div>
            
            <div>
              <label for="amount" class="block text-sm font-medium text-gray-700 mb-1">
                Amount (VND)
              </label>
              <input
                id="amount"
                v-model.number="form.amount"
                type="number"
                min="0"
                step="1000"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0"
              />
            </div>
            
            <button
              type="submit"
              :disabled="loading || !form.description.trim() || !form.amount"
              class="btn-primary w-full"
            >
              {{ loading ? 'Adding...' : 'Add Cost' }}
            </button>
          </form>
        </div>

        <!-- Existing Costs -->
        <div v-if="additionalCosts.length > 0">
          <h4 class="font-medium text-gray-900 mb-3">Current Additional Costs</h4>
          <div class="space-y-3">
            <div 
              v-for="cost in additionalCosts"
              :key="cost.id"
              class="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
            >
              <div>
                <div class="font-medium text-gray-900">{{ cost.description }}</div>
                <div class="text-sm text-gray-600">{{ cost.amount.toLocaleString() }} VND</div>
              </div>
              <button
                @click="$emit('delete-cost', cost.id)"
                :disabled="deleteLoading.has(cost.id)"
                class="text-red-600 hover:text-red-800 transition-colors p-1"
                title="Delete cost"
              >
                <svg v-if="deleteLoading.has(cost.id)" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
          
          <!-- Total -->
          <div class="mt-4 p-3 bg-primary-50 rounded-lg">
            <div class="flex justify-between items-center">
              <span class="font-medium text-primary-900">Total Additional Costs:</span>
              <span class="font-semibold text-primary-900">
                {{ totalAdditionalCosts.toLocaleString() }} VND
              </span>
            </div>
            <div class="text-sm text-primary-700 mt-1">
              Cost per attending player: {{ costPerPlayer.toLocaleString() }} VND
            </div>
          </div>
        </div>
        
        <div v-else class="text-center py-8 text-gray-500">
          No additional costs added yet.
        </div>
      </div>

      <div class="flex justify-end space-x-3 p-6 border-t border-gray-200">
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
import { ref, computed } from 'vue'

interface AdditionalCost {
  id: string
  description: string
  amount: number
  tournamentId: string
}

interface Props {
  isOpen: boolean
  tournamentId: string
  additionalCosts: AdditionalCost[]
  attendingPlayersCount: number
  loading: boolean
  deleteLoading: Set<string>
}

const props = defineProps<Props>()

const form = ref({
  description: '',
  amount: 0
})

const totalAdditionalCosts = computed(() => {
  return props.additionalCosts.reduce((sum, cost) => sum + cost.amount, 0)
})

const costPerPlayer = computed(() => {
  if (props.attendingPlayersCount === 0) return 0
  return Math.floor(totalAdditionalCosts.value / props.attendingPlayersCount)
})

const handleSubmit = () => {
  if (!form.value.description.trim() || !form.value.amount) return
  
  emits('add-cost', {
    tournamentId: props.tournamentId,
    description: form.value.description.trim(),
    amount: form.value.amount
  })
  
  // Reset form
  form.value = {
    description: '',
    amount: 0
  }
}

const emits = defineEmits<{
  'close': []
  'add-cost': [cost: { tournamentId: string; description: string; amount: number }]
  'delete-cost': [costId: string]
}>()
</script>
