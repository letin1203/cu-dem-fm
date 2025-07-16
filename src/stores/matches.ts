import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Match, MatchEvent } from '../types'
import { apiClient } from '@/api/client'

export const useMatchesStore = defineStore('matches', () => {
  const matches = ref<Match[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const upcomingMatches = computed(() => {
    const matchesArray = Array.isArray(matches.value) ? matches.value : []
    return matchesArray.filter((m: Match) => m.status === 'SCHEDULED')
  })

  const liveMatches = computed(() => {
    const matchesArray = Array.isArray(matches.value) ? matches.value : []
    return matchesArray.filter((m: Match) => m.status === 'LIVE')
  })

  const completedMatches = computed(() => {
    const matchesArray = Array.isArray(matches.value) ? matches.value : []
    return matchesArray.filter((m: Match) => m.status === 'COMPLETED')
  })

  const recentMatches = computed(() => {
    const matchesArray = Array.isArray(matches.value) ? matches.value : []
    return matchesArray
      .filter((m: Match) => m.status === 'COMPLETED')
      .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
      .slice(0, 5)
  })

  async function fetchMatches() {
    // Prevent concurrent fetches
    if (loading.value) return
    
    try {
      loading.value = true
      error.value = null
      const response = await apiClient.get('/matches')
      if (response.success && response.data) {
        const data = response.data as any
        const matchesArray = data.matches || []
        // Ensure all matches have events arrays initialized
        matches.value = matchesArray.map((match: Match) => ({
          ...match,
          events: match.events || []
        }))
      }
    } catch (err) {
      error.value = 'Failed to fetch matches'
      console.error('Fetch matches error:', err)
    } finally {
      loading.value = false
    }
  }

  async function addMatch(match: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      loading.value = true
      error.value = null
      
      // Transform the match data to match API schema
      const apiPayload = {
        tournamentId: match.tournamentId,
        homeTeamId: match.homeTeam.id,
        awayTeamId: match.awayTeam.id,
        scheduledDate: match.scheduledDate instanceof Date 
          ? match.scheduledDate.toISOString() 
          : new Date(match.scheduledDate).toISOString(),
        venue: match.venue || ''
      }
      
      const response = await apiClient.post<Match>('/matches', apiPayload)
      if (response.data) {
        // Ensure the match has an events array initialized
        const newMatch = {
          ...response.data,
          events: response.data.events || []
        }
        matches.value.push(newMatch)
      }
    } catch (err) {
      error.value = 'Failed to add match'
      console.error('Add match error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateMatch(id: string, updates: Partial<Match>) {
    try {
      loading.value = true
      error.value = null
      
      // Transform the updates to match API schema
      const apiUpdates: any = { ...updates }
      
      if (updates.homeTeam) {
        apiUpdates.homeTeamId = updates.homeTeam.id
        delete apiUpdates.homeTeam
      }
      
      if (updates.awayTeam) {
        apiUpdates.awayTeamId = updates.awayTeam.id
        delete apiUpdates.awayTeam
      }
      
      if (updates.scheduledDate) {
        apiUpdates.scheduledDate = updates.scheduledDate instanceof Date
          ? updates.scheduledDate.toISOString()
          : new Date(updates.scheduledDate).toISOString()
      }
      
      const response = await apiClient.put<Match>(`/matches/${id}`, apiUpdates)
      const index = matches.value.findIndex((m: Match) => m.id === id)
      if (index !== -1 && response.data) {
        matches.value[index] = response.data
      }
    } catch (err) {
      error.value = 'Failed to update match'
      console.error('Update match error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteMatch(id: string) {
    try {
      loading.value = true
      error.value = null
      await apiClient.delete(`/matches/${id}`)
      const index = matches.value.findIndex((m: Match) => m.id === id)
      if (index !== -1) {
        matches.value.splice(index, 1)
      }
    } catch (err) {
      error.value = 'Failed to delete match'
      console.error('Delete match error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  function getMatchById(id: string) {
    return matches.value.find((m: Match) => m.id === id)
  }

  function getMatchesByTournament(tournamentId: string) {
    return matches.value.filter((m: Match) => m.tournamentId === tournamentId)
  }

  async function addMatchEvent(matchId: string, event: Omit<MatchEvent, 'id' | 'matchId'>) {
    try {
      loading.value = true
      error.value = null
      const response = await apiClient.post<MatchEvent>(`/matches/${matchId}/events`, event)
      if (response.data) {
        const match = matches.value.find(m => m.id === matchId)
        if (match) {
          match.events.push(response.data)
        }
      }
    } catch (err) {
      error.value = 'Failed to add match event'
      console.error('Add match event error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteMatchEvent(matchId: string, eventId: string) {
    try {
      loading.value = true
      error.value = null
      await apiClient.delete(`/matches/${matchId}/events/${eventId}`)
      const match = matches.value.find(m => m.id === matchId)
      if (match) {
        const eventIndex = match.events.findIndex(e => e.id === eventId)
        if (eventIndex !== -1) {
          match.events.splice(eventIndex, 1)
        }
      }
    } catch (err) {
      error.value = 'Failed to delete match event'
      console.error('Delete match event error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateMatchEvents(matchId: string, events: MatchEvent[]) {
    try {
      loading.value = true
      error.value = null
      
      const match = matches.value.find(m => m.id === matchId)
      if (!match) return
      
      // Get current events from the match
      const currentEvents = match.events || []
      const newEvents = events.filter(e => e.tempId) // Events with tempId are new
      const existingEvents = events.filter(e => !e.tempId && e.id) // Events with real id
      
      // Delete removed events
      const removedEvents = currentEvents.filter(current => 
        !existingEvents.find(existing => existing.id === current.id)
      )
      
      for (const removedEvent of removedEvents) {
        if (removedEvent.id) {
          await deleteMatchEvent(matchId, removedEvent.id)
        }
      }
      
      // Add new events
      for (const newEvent of newEvents) {
        const eventData = {
          type: newEvent.type,
          minute: newEvent.minute,
          playerId: newEvent.playerId,
          team: newEvent.team,
          description: newEvent.description
        }
        await addMatchEvent(matchId, eventData)
      }
      
    } catch (err) {
      error.value = 'Failed to update match events'
      console.error('Update match events error:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function startMatch(matchId: string) {
    try {
      await updateMatch(matchId, { status: 'LIVE', currentMinute: 0 })
    } catch (err) {
      console.error('Start match error:', err)
      throw err
    }
  }

  async function endMatch(matchId: string) {
    try {
      await updateMatch(matchId, { status: 'COMPLETED', currentMinute: undefined })
    } catch (err) {
      console.error('End match error:', err)
      throw err
    }
  }

  async function updateScore(matchId: string, homeScore: number, awayScore: number) {
    try {
      await updateMatch(matchId, { homeScore, awayScore })
    } catch (err) {
      console.error('Update score error:', err)
      throw err
    }
  }

  return {
    matches,
    loading,
    error,
    upcomingMatches,
    liveMatches,
    completedMatches,
    recentMatches,
    fetchMatches,
    addMatch,
    updateMatch,
    deleteMatch,
    getMatchById,
    getMatchesByTournament,
    addMatchEvent,
    deleteMatchEvent,
    updateMatchEvents,
    startMatch,
    endMatch,
    updateScore
  }
})
