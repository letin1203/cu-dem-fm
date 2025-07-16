import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'

const router = Router()

// Add authentication middleware for all database routes
router.use(authenticate)

// Additional admin check middleware
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    })
  }
  next()
}

// Apply admin check to all routes
router.use(requireAdmin)

// Get database statistics
router.get('/stats', async (req, res) => {
  try {
    const [users, players, teams, tournaments] = await Promise.all([
      prisma.user.count(),
      prisma.player.count(),
      prisma.team.count(),
      prisma.tournament.count()
    ])

    res.json({
      success: true,
      data: {
        users,
        players,
        teams,
        tournaments
      }
    })
  } catch (error) {
    console.error('Database stats error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get database statistics'
    })
  }
})

// Get table data with pagination
router.get('/table/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 50
    const offset = (page - 1) * limit

    // Validate table name to prevent SQL injection
    const allowedTables = [
      'users', 'players', 'teams', 'tournaments', 'matches', 
      'player_stats', 'system_settings', 'additional_costs',
      'tournament_player_attendances', 'match_events'
    ]

    if (!allowedTables.includes(tableName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid table name'
      })
    }

    // Map frontend table names to actual Prisma model names
    const tableMap: Record<string, any> = {
      users: prisma.user,
      players: prisma.player,
      teams: prisma.team,
      tournaments: prisma.tournament,
      matches: prisma.match,
      player_stats: prisma.playerStats,
      system_settings: prisma.systemSettings,
      additional_costs: prisma.additionalCost,
      tournament_player_attendances: prisma.tournamentPlayerAttendance,
      match_events: prisma.matchEvent
    }

    const model = tableMap[tableName]
    if (!model) {
      return res.status(400).json({
        success: false,
        error: 'Table not found'
      })
    }

    // Get data and total count
    const [data, total] = await Promise.all([
      model.findMany({
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      model.count()
    ])

    // Get column names from the first record
    const columns = data.length > 0 ? Object.keys(data[0]) : []

    return res.json({
      success: true,
      data: {
        data,
        columns,
        total,
        page,
        limit
      }
    })
  } catch (error) {
    console.error('Get table data error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to get table data'
    })
  }
})

// Execute custom SQL query
router.post('/query', async (req, res) => {
  try {
    const { query } = req.body

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required and must be a string'
      })
    }

    // Basic validation to prevent dangerous operations
    const dangerousKeywords = ['DROP DATABASE', 'DROP SCHEMA', 'TRUNCATE', 'DELETE FROM users', 'UPDATE users SET password']
    const upperQuery = query.toUpperCase()
    
    for (const keyword of dangerousKeywords) {
      if (upperQuery.includes(keyword)) {
        return res.status(400).json({
          success: false,
          error: `Dangerous operation detected: ${keyword}. This query is not allowed.`
        })
      }
    }

    // Execute raw SQL query
    const result = await prisma.$queryRawUnsafe(query)
    
    // Handle different types of results
    let data: any[] = []
    let columns: string[] = []

    if (Array.isArray(result)) {
      data = result
      if (data.length > 0) {
        columns = Object.keys(data[0])
      }
    } else if (result && typeof result === 'object') {
      // For non-SELECT queries (INSERT, UPDATE, DELETE)
      data = [result]
      columns = Object.keys(result)
    }

    return res.json({
      success: true,
      data: {
        data,
        columns
      }
    })
  } catch (error: any) {
    console.error('Execute query error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute query'
    })
  }
})

export default router
