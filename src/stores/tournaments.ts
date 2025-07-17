import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tournament, Match, CreateTournamentRequest } from '../types'
import { apiClient } from '@/api/client'

export const useTournamentsStore = defineStore('tournaments', () => {
  const tournaments = ref<Tournament[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const activeTournaments = computed(() => 
    tournaments.value.filter((t: Tournament) => t.status === 'ONGOING')
  )
  
  const upcomingTournaments = computed(() =>
    tournaments.value.filter((t: Tournament) => t.status === 'UPCOMING')
  )

  async function fetchTournaments() {
    // Prevent concurrent fetches
    if (loading.value) return
    
    try {
      loading.value = true
      error.value = null
      const response = await apiClient.get('/tournaments')
      if (response.success && response.data) {
        const data = response.data as any
        const rawTournaments = data.tournaments || []
        
        console.log('Raw tournaments from API:', rawTournaments)
        
        // Transform API format to expected frontend format
        tournaments.value = rawTournaments.map((tournament: any) => {
          const transformedTournament = {
            ...tournament,
            teams: tournament.teams?.map((teamEntry: any) => {
              const team = {
                ...teamEntry.team,
                score: teamEntry.team.score !== undefined ? teamEntry.team.score : 0
              }
              console.log(`Transformed team: ${team.name}, score: ${team.score}`)
              return team
            }) || []
          }
          return transformedTournament
        })
        
        console.log('Transformed tournaments:', tournaments.value)
      }
    } catch (err) {
      error.value = 'Failed to fetch tournaments'
      console.error('Fetch tournaments error:', err)
    } finally {
      loading.value = false
    }
  }

  async function addTournament(tournament: CreateTournamentRequest | Omit<Tournament, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      loading.value = true
      error.value = null
      const response = await apiClient.post<Tournament>('/tournaments', tournament)
      if (response.data) {
        tournaments.value.push(response.data)
      }
    } catch (err) {
      error.value = 'Failed to add tournament'
      console.error('Add tournament error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateTournament(id: string, updates: Partial<Tournament>) {
    try {
      loading.value = true
      error.value = null
      const response = await apiClient.put<Tournament>(`/tournaments/${id}`, updates)
      const index = tournaments.value.findIndex((t: Tournament) => t.id === id)
      if (index !== -1 && response.data) {
        tournaments.value[index] = response.data
      }
    } catch (err) {
      error.value = 'Failed to update tournament'
      console.error('Update tournament error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteTournament(id: string) {
    try {
      loading.value = true
      error.value = null
      await apiClient.delete(`/tournaments/${id}`)
      const index = tournaments.value.findIndex((t: Tournament) => t.id === id)
      if (index !== -1) {
        tournaments.value.splice(index, 1)
      }
    } catch (err) {
      error.value = 'Failed to delete tournament'
      console.error('Delete tournament error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  function getTournamentById(id: string) {
    return tournaments.value.find((t: Tournament) => t.id === id)
  }

  return {
    tournaments,
    loading,
    error,
    activeTournaments,
    upcomingTournaments,
    fetchTournaments,
    addTournament,
    updateTournament,
    deleteTournament,
    getTournamentById
  }
})
