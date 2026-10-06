import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { createMatchSchema, updateMatchSchema, createMatchEventSchema, matchQuerySchema } from '../schemas/validation';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all matches with pagination and filters
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, tournamentId, teamId, status } = matchQuerySchema.parse(req.query);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (tournamentId) where.tournamentId = tournamentId;
    if (teamId) {
      where.OR = [
        { homeTeamId: teamId },
        { awayTeamId: teamId },
      ];
    }
    if (status) where.status = status;

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        skip,
        take: limit,
        include: {
          tournament: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
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
          events: {
            include: {
              player: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: {
              minute: 'asc',
            },
          },
          _count: {
            select: {
              events: true,
            },
          },
        },
        orderBy: {
          scheduledDate: 'desc',
        },
      }),
      prisma.match.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        matches,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid query parameters',
    });
  }
});

// Get match by ID
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
          },
        },
        homeTeam: {
          include: {
            players: {
              select: {
                id: true,
                name: true,
                position: true,
                tier: true,
                avatar: true,
              },
            },
          },
        },
        awayTeam: {
          include: {
            players: {
              select: {
                id: true,
                name: true,
                position: true,
                tier: true,
                avatar: true,
              },
            },
          },
        },
        events: {
          include: {
            player: {
              select: {
                id: true,
                name: true,
                position: true,
                avatar: true,
              },
            },
          },
          orderBy: {
            minute: 'asc',
          },
        },
      },
    });

    if (!match) {
      res.status(404).json({
        success: false,
        error: 'Match not found',
      });
      return;
    }

    res.json({
      success: true,
      data: match,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch match',
    });
  }
});

// Create new match
router.post('/', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const matchData = createMatchSchema.parse(req.body);

    // Verify tournament and teams exist
    const [tournament, homeTeam, awayTeam] = await Promise.all([
      prisma.tournament.findUnique({ where: { id: matchData.tournamentId } }),
      prisma.team.findUnique({ where: { id: matchData.homeTeamId } }),
      prisma.team.findUnique({ where: { id: matchData.awayTeamId } }),
    ]);

    if (!tournament) {
      res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
      return;
    }

    if (!homeTeam || !awayTeam) {
      res.status(404).json({
        success: false,
        error: 'One or both teams not found',
      });
      return;
    }

    if (matchData.homeTeamId === matchData.awayTeamId) {
      res.status(400).json({
        success: false,
        error: 'Home and away teams cannot be the same',
      });
      return;
    }

    // Verify both teams are in the tournament
    const [homeInTournament, awayInTournament] = await Promise.all([
      prisma.tournamentTeam.findUnique({
        where: {
          tournamentId_teamId: {
            tournamentId: matchData.tournamentId,
            teamId: matchData.homeTeamId,
          },
        },
      }),
      prisma.tournamentTeam.findUnique({
        where: {
          tournamentId_teamId: {
            tournamentId: matchData.tournamentId,
            teamId: matchData.awayTeamId,
          },
        },
      }),
    ]);

    if (!homeInTournament || !awayInTournament) {
      res.status(400).json({
        success: false,
        error: 'Both teams must be part of the tournament',
      });
      return;
    }

    const match = await prisma.match.create({
      data: matchData,
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
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
      },
    });

    res.status(201).json({
      success: true,
      data: match,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid match data',
    });
  }
});

// Update match
router.put('/:id', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = updateMatchSchema.parse(req.body);

    const existingMatch = await prisma.match.findUnique({
      where: { id },
      include: {
        homeTeam: { select: { stats: true } },
        awayTeam: { select: { stats: true } },
      },
    });

    if (!existingMatch) {
      res.status(404).json({
        success: false,
        error: 'Match not found',
      });
      return;
    }

    const updateStatsForResult = async (homeScore: number, awayScore: number, multiplier: 1 | -1): Promise<void> => {
      const homeWin = homeScore > awayScore;
      const awayWin = awayScore > homeScore;
      const draw = homeScore === awayScore;

      if (existingMatch.homeTeam.stats) {
        await prisma.teamStats.update({
          where: { teamId: existingMatch.homeTeamId },
          data: {
            gamesPlayed: { increment: multiplier },
            wins: homeWin ? { increment: multiplier } : undefined,
            draws: draw ? { increment: multiplier } : undefined,
            losses: awayWin ? { increment: multiplier } : undefined,
            goalsFor: { increment: multiplier * homeScore },
            goalsAgainst: { increment: multiplier * awayScore },
            points: { increment: multiplier * (homeWin ? 3 : draw ? 1 : 0) },
          },
        });
      }

      if (existingMatch.awayTeam.stats) {
        await prisma.teamStats.update({
          where: { teamId: existingMatch.awayTeamId },
          data: {
            gamesPlayed: { increment: multiplier },
            wins: awayWin ? { increment: multiplier } : undefined,
            draws: draw ? { increment: multiplier } : undefined,
            losses: homeWin ? { increment: multiplier } : undefined,
            goalsFor: { increment: multiplier * awayScore },
            goalsAgainst: { increment: multiplier * homeScore },
            points: { increment: multiplier * (awayWin ? 3 : draw ? 1 : 0) },
          },
        });
      }
    };

    const finalStatus = updateData.status ?? existingMatch.status;
    const finalHomeScore = updateData.homeScore ?? existingMatch.homeScore;
    const finalAwayScore = updateData.awayScore ?? existingMatch.awayScore;

    // Roll the old result back before applying the new one. This lets an admin
    // correct a completed result without accumulating table points twice.
    if (existingMatch.status === 'COMPLETED' && existingMatch.homeScore !== null && existingMatch.awayScore !== null) {
      await updateStatsForResult(existingMatch.homeScore, existingMatch.awayScore, -1);
    }
    if (finalStatus === 'COMPLETED' && finalHomeScore !== null && finalAwayScore !== null) {
      await updateStatsForResult(finalHomeScore, finalAwayScore, 1);
    }

    const match = await prisma.match.update({
      where: { id },
      data: updateData,
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
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
        events: {
          include: {
            player: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            minute: 'asc',
          },
        },
      },
    });

    res.json({
      success: true,
      data: match,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid match data',
    });
  }
});

// Delete match
router.delete('/:id', authenticate, authorize(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingMatch = await prisma.match.findUnique({
      where: { id },
    });

    if (!existingMatch) {
      res.status(404).json({
        success: false,
        error: 'Match not found',
      });
      return;
    }

    if (existingMatch.status === 'COMPLETED') {
      res.status(400).json({
        success: false,
        error: 'Cannot delete completed match',
      });
      return;
    }

    await prisma.match.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Match deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete match',
    });
  }
});

// Add match event
router.post('/:id/events', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const eventData = createMatchEventSchema.parse({ ...req.body, matchId: id });

    const match = await prisma.match.findUnique({ where: { id } });

    if (!match) {
      res.status(404).json({
        success: false,
        error: 'Match not found',
      });
      return;
    }

    // Verify player is in one of the teams
    const assignments = await prisma.tournamentTeamPlayer.findMany({
      where: { tournamentId: match.tournamentId, teamId: { in: [match.homeTeamId, match.awayTeamId] } },
      select: { playerId: true },
    });
    const allPlayerIds = assignments.map((assignment) => assignment.playerId);

    if (!allPlayerIds.includes(eventData.playerId)) {
      res.status(400).json({
        success: false,
        error: 'Player is not part of either team',
      });
      return;
    }

    const event = await prisma.matchEvent.create({
      data: eventData,
      include: {
        player: {
          select: {
            id: true,
            name: true,
            position: true,
            avatar: true,
          },
        },
      },
    });

    // Update player stats for goals, cards, etc.
    if (eventData.type === 'GOAL' || eventData.type === 'OWN_GOAL') {
      await prisma.playerStats.upsert({
        where: { playerId: eventData.playerId },
        update: {
          goals: eventData.type === 'GOAL' ? { increment: 1 } : undefined,
        },
        create: {
          playerId: eventData.playerId,
          goals: eventData.type === 'GOAL' ? 1 : 0,
        },
      });
    } else if (eventData.type === 'YELLOW_CARD') {
      await prisma.playerStats.upsert({
        where: { playerId: eventData.playerId },
        update: { yellowCards: { increment: 1 } },
        create: { playerId: eventData.playerId, yellowCards: 1 },
      });
    } else if (eventData.type === 'RED_CARD') {
      await prisma.playerStats.upsert({
        where: { playerId: eventData.playerId },
        update: { redCards: { increment: 1 } },
        create: { playerId: eventData.playerId, redCards: 1 },
      });
    }

    res.status(201).json({
      success: true,
      data: event,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid event data',
    });
  }
});

// Delete match event
router.delete('/:id/events/:eventId', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, eventId } = req.params;

    const event = await prisma.matchEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      res.status(404).json({
        success: false,
        error: 'Event not found',
      });
      return;
    }

    if (event.matchId !== id) {
      res.status(400).json({
        success: false,
        error: 'Event does not belong to this match',
      });
      return;
    }

    // Reverse player stats updates
    if (event.type === 'GOAL') {
      await prisma.playerStats.update({
        where: { playerId: event.playerId },
        data: { goals: { decrement: 1 } },
      });
    } else if (event.type === 'YELLOW_CARD') {
      await prisma.playerStats.update({
        where: { playerId: event.playerId },
        data: { yellowCards: { decrement: 1 } },
      });
    } else if (event.type === 'RED_CARD') {
      await prisma.playerStats.update({
        where: { playerId: event.playerId },
        data: { redCards: { decrement: 1 } },
      });
    }

    await prisma.matchEvent.delete({
      where: { id: eventId },
    });

    res.json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete event',
    });
  }
});

export { router as matchRoutes };
