import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Player, PlayerStats } from '@/types'
import { apiClient } from '@/api/client'

export const usePlayersStore = defineStore('players', () => {
  const players = ref<Player[]>([])
  const loading = ref(false)
  const loadingAll = ref(false)
  const error = ref<string | null>(null)
  const currentPage = ref(1)
  const limit = ref(100) // Load 100 players initially
  const totalPlayers = ref(0)
  const totalPages = ref(0)
  const hasMore = computed(() => currentPage.value < totalPages.value)
  const isShowingAll = computed(() => players.value.length >= totalPlayers.value)

  const topScorers = computed(() => 
    players.value
      .sort((a, b) => b.stats.goals - a.stats.goals)
      .slice(0, 5)
  )
  const topTierPlayers = computed(() =>
    players.value
      .filter(p => p.tier >= 8)
      .sort((a, b) => b.tier - a.tier)
  )

  async function fetchPlayers() {
    // Prevent concurrent fetches
    if (loading.value) return
    
    try {
      loading.value = true
      currentPage.value = 1
      players.value = []
      error.value = null
      
      const response = await apiClient.get('/players', {
        params: {
          page: currentPage.value,
          limit: limit.value
        }
      })
      
      if (response.success && response.data) {
        const data = response.data as any
        players.value = data.players || []
        
        // Update pagination info
        if (data.pagination) {
          totalPlayers.value = data.pagination.total
          totalPages.value = data.pagination.pages
        }
      }
    } catch (err) {
      error.value = 'Failed to fetch players'
      console.error('Fetch players error:', err)
    } finally {
      loading.value = false
    }
  }

  async function loadAllPlayers() {
    if (loadingAll.value || isShowingAll.value) return
    
    try {
      loadingAll.value = true
      error.value = null
      
      // Fetch all remaining players
      const response = await apiClient.get('/players', {
        params: {
          page: 1,
          limit: totalPlayers.value // Load all players
        }
      })
      
      if (response.success && response.data) {
        const data = response.data as any
        players.value = data.players || []
        
        // Update pagination info
        if (data.pagination) {
          totalPlayers.value = data.pagination.total
          totalPages.value = data.pagination.pages
        }
      }
    } catch (err) {
      error.value = 'Failed to load all players'
      console.error('Load all players error:', err)
    } finally {
      loadingAll.value = false
    }
  }

  async function addPlayer(player: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      loading.value = true
      error.value = null
      const response = await apiClient.post<Player>('/players', player)
      if (response.data) {
        players.value.push(response.data)
      }
    } catch (err) {
      error.value = 'Failed to add player'
      console.error('Add player error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updatePlayer(id: string, updates: Partial<Player>) {
    try {
      loading.value = true
      error.value = null
      const response = await apiClient.put<Player>(`/players/${id}`, updates)
      const index = players.value.findIndex(p => p.id === id)
      if (index !== -1 && response.data) {
        players.value[index] = response.data
      }
    } catch (err) {
      error.value = 'Failed to update player'
      console.error('Update player error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deletePlayer(id: string) {
    try {
      loading.value = true
      error.value = null
      await apiClient.delete(`/players/${id}`)
      const index = players.value.findIndex(p => p.id === id)
      if (index !== -1) {
        players.value.splice(index, 1)
      }
    } catch (err) {
      error.value = 'Failed to delete player'
      console.error('Delete player error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  function getPlayerById(id: string) {
    return players.value.find(p => p.id === id)
  }

  function getPlayersByTeam(teamId: string) {
    return players.value.filter(p => p.teamId === teamId)
  }

  async function assignPlayerToTeam(playerId: string, teamId: string) {
    try {
      await updatePlayer(playerId, { teamId })
    } catch (err) {
      console.error('Assign player to team error:', err)
      throw err
    }
  }

  async function removePlayerFromTeam(playerId: string) {
    try {
      await updatePlayer(playerId, { teamId: undefined })
    } catch (err) {
      console.error('Remove player from team error:', err)
      throw err
    }
  }

  return {
    players,
    loading,
    loadingAll,
    error,
    currentPage,
    limit,
    totalPlayers,
    totalPages,
    hasMore,
    isShowingAll,
    topScorers,
    topTierPlayers,
    fetchPlayers,
    loadAllPlayers,
    addPlayer,
    updatePlayer,
    deletePlayer,
    getPlayerById,
    getPlayersByTeam,
    assignPlayerToTeam,
    removePlayerFromTeam
  }
})
