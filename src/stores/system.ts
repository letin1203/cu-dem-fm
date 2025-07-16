import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SystemSettings, AdditionalCost } from '../types'
import { apiClient } from '../api/client'

export const useSystemStore = defineStore('system', () => {
  const settings = ref<SystemSettings | null>(null)
  const additionalCosts = ref<AdditionalCost[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isLoading = computed(() => loading.value)
  const currentSettings = computed(() => settings.value)

  // Actions
  async function fetchSystemSettings(): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      const response = await apiClient.getSystemSettings()
      if (response.success && response.data) {
        settings.value = response.data as SystemSettings
      }
    } catch (err) {
      console.error('Failed to fetch system settings:', err)
      error.value = err instanceof Error ? err.message : 'Failed to fetch system settings'
    } finally {
      loading.value = false
    }
  }

  async function updateSystemSettings(data: Partial<SystemSettings>): Promise<boolean> {
    loading.value = true
    error.value = null
    
    try {
      const response = await apiClient.updateSystemSettings(data)
      if (response.success && response.data) {
        settings.value = response.data as SystemSettings
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to update system settings:', err)
      error.value = err instanceof Error ? err.message : 'Failed to update system settings'
      return false
    } finally {
      loading.value = false
    }
  }

  async function fetchAdditionalCosts(tournamentId: string): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      const response = await apiClient.getAdditionalCosts(tournamentId)
      if (response.success && response.data) {
        additionalCosts.value = response.data as AdditionalCost[]
      }
    } catch (err) {
      console.error('Failed to fetch additional costs:', err)
      error.value = err instanceof Error ? err.message : 'Failed to fetch additional costs'
    } finally {
      loading.value = false
    }
  }

  async function createAdditionalCost(data: { tournamentId: string; description: string; amount: number }): Promise<boolean> {
    loading.value = true
    error.value = null
    
    try {
      const response = await apiClient.createAdditionalCost(data)
      if (response.success && response.data) {
        additionalCosts.value.unshift(response.data as AdditionalCost)
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to create additional cost:', err)
      error.value = err instanceof Error ? err.message : 'Failed to create additional cost'
      return false
    } finally {
      loading.value = false
    }
  }

  async function updateAdditionalCost(id: string, data: { description?: string; amount?: number }): Promise<boolean> {
    loading.value = true
    error.value = null
    
    try {
      const response = await apiClient.updateAdditionalCost(id, data)
      if (response.success && response.data) {
        const index = additionalCosts.value.findIndex(cost => cost.id === id)
        if (index !== -1) {
          additionalCosts.value[index] = response.data as AdditionalCost
        }
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to update additional cost:', err)
      error.value = err instanceof Error ? err.message : 'Failed to update additional cost'
      return false
    } finally {
      loading.value = false
    }
  }

  async function deleteAdditionalCost(id: string): Promise<boolean> {
    loading.value = true
    error.value = null
    
    try {
      const response = await apiClient.deleteAdditionalCost(id)
      if (response.success) {
        additionalCosts.value = additionalCosts.value.filter(cost => cost.id !== id)
        return true
      }
      return false
    } catch (err) {
      console.error('Failed to delete additional cost:', err)
      error.value = err instanceof Error ? err.message : 'Failed to delete additional cost'
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    settings,
    additionalCosts,
    loading,
    error,
    
    // Computed
    isLoading,
    currentSettings,
    
    // Actions
    fetchSystemSettings,
    updateSystemSettings,
    fetchAdditionalCosts,
    createAdditionalCost,
    updateAdditionalCost,
    deleteAdditionalCost
  }
})
