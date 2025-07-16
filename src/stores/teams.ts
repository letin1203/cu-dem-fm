import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Team, TeamStats } from '../types'
import { apiClient } from '@/api/client'

export const useTeamsStore = defineStore('teams', () => {
  const teams = ref<Team[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const totalTeams = computed(() => teams.value.length)
  
  const leaderboard = computed(() => 
    teams.value
      .sort((a, b) => {
        if (b.stats.points !== a.stats.points) {
          return b.stats.points - a.stats.points
        }
        const goalDiffA = a.stats.goalsFor - a.stats.goalsAgainst
        const goalDiffB = b.stats.goalsFor - b.stats.goalsAgainst
        return goalDiffB - goalDiffA
      })
  )

  async function fetchTeams() {
    // Prevent concurrent fetches
    if (loading.value) return
    
    try {
      loading.value = true
      error.value = null
      const response = await apiClient.get('/teams')
      if (response.success && response.data) {
        const data = response.data as any
        teams.value = data.teams || []
      }
    } catch (err) {
      error.value = 'Failed to fetch teams'
      console.error('Fetch teams error:', err)
    } finally {
      loading.value = false
    }
  }

  async function addTeam(team: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      loading.value = true
      error.value = null
      const response = await apiClient.post<Team>('/teams', team)
      if (response.data) {
        teams.value.push(response.data)
        return response.data
      }
    } catch (err) {
      error.value = 'Failed to add team'
      console.error('Add team error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateTeam(id: string, updates: Partial<Team>) {
    try {
      loading.value = true
      error.value = null
      const response = await apiClient.put<Team>(`/teams/${id}`, updates)
      const index = teams.value.findIndex((t: Team) => t.id === id)
      if (index !== -1 && response.data) {
        teams.value[index] = response.data
      }
    } catch (err) {
      error.value = 'Failed to update team'
      console.error('Update team error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteTeam(id: string) {
    try {
      loading.value = true
      error.value = null
      await apiClient.delete(`/teams/${id}`)
      const index = teams.value.findIndex((t: Team) => t.id === id)
      if (index !== -1) {
        teams.value.splice(index, 1)
      }
    } catch (err) {
      error.value = 'Failed to delete team'
      console.error('Delete team error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  function getTeamById(id: string) {
    return teams.value.find((t: Team) => t.id === id)
  }

  return {
    teams,
    loading,
    error,
    totalTeams,
    leaderboard,
    fetchTeams,
    addTeam,
    updateTeam,
    deleteTeam,
    getTeamById
  }
})
