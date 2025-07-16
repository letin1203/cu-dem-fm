import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Player, PlayerStats } from '@/types'
import { apiClient } from '@/api/client'

export const usePlayersStore = defineStore('players', () => {
  const players = ref<Player[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const totalPlayers = computed(() => players.value.length)
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
      error.value = null
      const response = await apiClient.get('/players')
      if (response.success && response.data) {
        const data = response.data as any
        players.value = data.players || []
      }
    } catch (err) {
      error.value = 'Failed to fetch players'
      console.error('Fetch players error:', err)
    } finally {
      loading.value = false
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
    error,
    totalPlayers,
    topScorers,
    topTierPlayers,
    fetchPlayers,
    addPlayer,
    updatePlayer,
    deletePlayer,
    getPlayerById,
    getPlayersByTeam,
    assignPlayerToTeam,
    removePlayerFromTeam
  }
})
