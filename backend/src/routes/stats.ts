import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get dashboard statistics
router.get('/dashboard', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [
      totalPlayers,
      totalTeams,
      totalTournaments,
      totalMatches,
      activeTournaments,
      liveMatches,
      completedMatches,
      topScorers,
      recentMatches,
    ] = await Promise.all([
      // Basic counts
      prisma.player.count(),
      prisma.team.count(),
      prisma.tournament.count(),
      prisma.match.count(),
      
      // Active data
      prisma.tournament.count({
        where: { status: 'ONGOING' },
      }),
      prisma.match.count({
        where: { status: 'LIVE' },
      }),
      prisma.match.count({
        where: { status: 'COMPLETED' },
      }),
      
      // Top scorers
      prisma.playerStats.findMany({
        where: { goals: { gt: 0 } },
        include: {
          player: {
            select: {
              id: true,
              name: true,
              position: true,
              avatar: true,
              team: {
                select: {
                  id: true,
                  name: true,
                  logo: true,
                },
              },
            },
          },
        },
        orderBy: { goals: 'desc' },
        take: 10,
      }),
      
      // Recent matches
      prisma.match.findMany({
        include: {
          homeTeam: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
          awayTeam: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
          tournament: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { scheduledDate: 'desc' },
        take: 5,
      }),
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalPlayers,
          totalTeams,
          totalTournaments,
          totalMatches,
          activeTournaments,
          liveMatches,
          completedMatches,
        },
        topScorers: topScorers.map((stat: any) => ({
          player: stat.player,
          goals: stat.goals,
          assists: stat.assists,
          gamesPlayed: stat.gamesPlayed,
        })),
        recentMatches,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
    });
  }
});

// Get player statistics
router.get('/players', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { teamId, position } = req.query;

    const where: any = {};
    if (teamId) where.player = { teamId };
    if (position) where.player = { ...where.player, position };

    const [
      playerStats,
      topScorers,
      topAssists,
      mostCards,
      positionDistribution,
    ] = await Promise.all([
      // All player stats
      prisma.playerStats.findMany({
        where,
        include: {
          player: {
            select: {
              id: true,
              name: true,
              position: true,
              tier: true,
              avatar: true,
              team: {
                select: {
                  id: true,
                  name: true,
                  logo: true,
                },
              },
            },
          },
        },
        orderBy: { goals: 'desc' },
      }),
      
      // Top scorers
      prisma.playerStats.findMany({
        where: { ...where, goals: { gt: 0 } },
        include: {
          player: {
            select: {
              id: true,
              name: true,
              position: true,
              avatar: true,
              team: { select: { name: true, logo: true } },
            },
          },
        },
        orderBy: { goals: 'desc' },
        take: 10,
      }),
      
      // Top assists
      prisma.playerStats.findMany({
        where: { ...where, assists: { gt: 0 } },
        include: {
          player: {
            select: {
              id: true,
              name: true,
              position: true,
              avatar: true,
              team: { select: { name: true, logo: true } },
            },
          },
        },
        orderBy: { assists: 'desc' },
        take: 10,
      }),
      
      // Most cards
      prisma.playerStats.findMany({
        where: {
          ...where,
          OR: [
            { yellowCards: { gt: 0 } },
            { redCards: { gt: 0 } },
          ],
        },
        include: {
          player: {
            select: {
              id: true,
              name: true,
              position: true,
              avatar: true,
              team: { select: { name: true, logo: true } },
            },
          },
        },
        orderBy: [
          { redCards: 'desc' },
          { yellowCards: 'desc' },
        ],
        take: 10,
      }),
      
      // Position distribution
      prisma.player.groupBy({
        by: ['position'],
        _count: { position: true },
        where: teamId ? { teamId: teamId as string } : undefined,
      }),
    ]);

    res.json({
      success: true,
      data: {
        playerStats,
        topScorers,
        topAssists,
        mostCards,
        positionDistribution: positionDistribution.map((group: any) => ({
          position: group.position,
          count: group._count.position,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch player statistics',
    });
  }
});

// Get team statistics
router.get('/teams', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [
      teamStats,
      topTeams,
      teamPerformance,
    ] = await Promise.all([
      // All team stats
      prisma.teamStats.findMany({
        include: {
          team: {
            select: {
              id: true,
              name: true,
              logo: true,
              founded: true,
            },
          },
        },
        orderBy: { points: 'desc' },
      }),
      
      // Top performing teams
      prisma.teamStats.findMany({
        where: { gamesPlayed: { gt: 0 } },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
        },
        orderBy: [
          { points: 'desc' },
          { wins: 'desc' },
          { goalsFor: 'desc' },
        ],
        take: 10,
      }),
      
      // Team performance metrics
      prisma.teamStats.aggregate({
        _avg: {
          points: true,
          wins: true,
          draws: true,
          losses: true,
          goalsFor: true,
          goalsAgainst: true,
        },
        _sum: {
          gamesPlayed: true,
          goalsFor: true,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        teamStats,
        topTeams,
        averages: teamPerformance._avg,
        totals: teamPerformance._sum,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team statistics',
    });
  }
});

// Get tournament statistics
router.get('/tournaments', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [
      tournamentOverview,
      tournamentsByType,
      tournamentsByStatus,
      recentTournaments,
    ] = await Promise.all([
      // Tournament overview
      prisma.tournament.aggregate({
        _count: true,
      }),
      
      // Tournaments by type
      prisma.tournament.groupBy({
        by: ['type'],
        _count: { type: true },
      }),
      
      // Tournaments by status
      prisma.tournament.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      
      // Recent tournaments with stats
      prisma.tournament.findMany({
        include: {
          _count: {
            select: {
              teams: true,
              matches: true,
            },
          },
          winner: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
        },
        orderBy: { startDate: 'desc' },
        take: 10,
      }),
    ]);

    res.json({
      success: true,
      data: {
        overview: tournamentOverview,
        byType: tournamentsByType.map((group: any) => ({
          type: group.type,
          count: group._count.type,
        })),
        byStatus: tournamentsByStatus.map((group: any) => ({
          status: group.status,
          count: group._count.status,
        })),
        recentTournaments,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tournament statistics',
    });
  }
});

// Get match statistics
router.get('/matches', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [
      matchOverview,
      matchesByStatus,
      averageGoals,
      recentEvents,
      goalDistribution,
    ] = await Promise.all([
      // Match overview
      prisma.match.aggregate({
        _count: true,
        _avg: {
          homeScore: true,
          awayScore: true,
        },
      }),
      
      // Matches by status
      prisma.match.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      
      // Average goals per match
      prisma.match.findMany({
        where: {
          status: 'COMPLETED',
          homeScore: { not: null },
          awayScore: { not: null },
        },
        select: {
          homeScore: true,
          awayScore: true,
        },
      }),
      
      // Recent match events
      prisma.matchEvent.findMany({
        include: {
          player: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          match: {
            select: {
              id: true,
              homeTeam: { select: { name: true } },
              awayTeam: { select: { name: true } },
              scheduledDate: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      
      // Goal distribution by minute
      prisma.matchEvent.groupBy({
        by: ['minute'],
        where: { type: 'GOAL' },
        _count: { minute: true },
        orderBy: { minute: 'asc' },
      }),
    ]);

    // Calculate total goals per match
    const totalGoals = averageGoals.reduce((sum: number, match: any) => {
      return sum + (match.homeScore || 0) + (match.awayScore || 0);
    }, 0);
    const avgGoalsPerMatch = averageGoals.length > 0 ? totalGoals / averageGoals.length : 0;

    res.json({
      success: true,
      data: {
        overview: {
          ...matchOverview,
          averageGoalsPerMatch: avgGoalsPerMatch,
        },
        byStatus: matchesByStatus.map((group: any) => ({
          status: group.status,
          count: group._count.status,
        })),
        recentEvents,
        goalDistribution: goalDistribution.map((group: any) => ({
          minute: group.minute,
          goals: group._count.minute,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch match statistics',
    });
  }
});

export { router as statsRoutes };
