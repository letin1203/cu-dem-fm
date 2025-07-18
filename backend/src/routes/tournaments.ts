import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createTournamentSchema, updateTournamentSchema, paginationSchema, updateAttendanceSchema, updateTeamScoreSchema, updateTournamentScoresSchema } from '../schemas/validation';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all tournaments with pagination and filters
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const { status, type } = req.query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [tournaments, total] = await Promise.all([
      prisma.tournament.findMany({
        where,
        skip,
        take: limit,
        include: {
          teams: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  logo: true,
                  score: true,
                },
              },
            },
          },
          tournamentTeamPlayers: {
            include: {
              player: {
                select: {
                  id: true,
                  name: true,
                  position: true,
                  tier: true,
                  avatar: true,
                  money: true,
                },
              },
              team: {
                select: {
                  id: true,
                  name: true,
                  logo: true,
                  score: true,
                },
              },
            },
          },
          matches: {
            select: {
              id: true,
              status: true,
              homeScore: true,
              awayScore: true,
              scheduledDate: true,
              homeTeam: { select: { name: true } },
              awayTeam: { select: { name: true } },
            },
            orderBy: {
              scheduledDate: 'asc',
            },
          },
          winner: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
          _count: {
            select: {
              teams: true,
              matches: true,
            },
          },
        },
        orderBy: {
          startDate: 'desc',
        },
      }),
      prisma.tournament.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        tournaments,
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

// Get tournament by ID
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        teams: {
          include: {
            team: {
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
                stats: true,
              },
            },
          },
        },
        matches: {
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
          orderBy: {
            scheduledDate: 'asc',
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
    });

    if (!tournament) {
      res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
      return;
    }

    res.json({
      success: true,
      data: tournament,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tournament',
    });
  }
});

// Create new tournament
router.post('/', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { teamIds = [], ...tournamentData } = createTournamentSchema.parse(req.body);

    // Verify all teams exist (only if teamIds is provided and not empty)
    if (teamIds.length > 0) {
      const teams = await prisma.team.findMany({
        where: {
          id: {
            in: teamIds,
          },
        },
      });

      if (teams.length !== teamIds.length) {
        res.status(400).json({
          success: false,
          error: 'One or more teams not found',
        });
        return;
      }
    }

    const tournament = await prisma.tournament.create({
      data: {
        ...tournamentData,
        teams: teamIds.length > 0 ? {
          create: teamIds.map((teamId) => ({
            team: {
              connect: { id: teamId },
            },
          })),
        } : undefined,
      },
      include: {
        teams: {
          include: {
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
    });

    res.status(201).json({
      success: true,
      data: tournament,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid tournament data',
    });
  }
});

// Update tournament
router.put('/:id', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = updateTournamentSchema.parse(req.body);

    const existingTournament = await prisma.tournament.findUnique({
      where: { id },
    });

    if (!existingTournament) {
      res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
      return;
    }

    // If setting a winner, verify the team is part of the tournament
    if (updateData.winnerId) {
      const teamInTournament = await prisma.tournamentTeam.findFirst({
        where: {
          tournamentId: id,
          teamId: updateData.winnerId,
        },
      });

      if (!teamInTournament) {
        res.status(400).json({
          success: false,
          error: 'Winner team must be part of the tournament',
        });
        return;
      }
    }

    const tournament = await prisma.tournament.update({
      where: { id },
      data: updateData,
      include: {
        teams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                logo: true,
              },
            },
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
    });

    res.json({
      success: true,
      data: tournament,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid tournament data',
    });
  }
});

// Delete tournament
router.delete('/:id', authenticate, authorize(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingTournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        matches: true,
        teams: true,
        playerAttendances: true,
        additionalCosts: true,
      },
    });

    if (!existingTournament) {
      res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
      return;
    }

    // Check if tournament has matches
    if (existingTournament.matches.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete tournament with existing matches',
      });
      return;
    }

    // For weekly tournaments, we need to clean up the teams that were created specifically for this tournament
    let teamsDeleted = 0;
    if (existingTournament.type === 'WEEKLY' && existingTournament.teams.length > 0) {
      // Get the team IDs from tournament teams
      const teamIds = existingTournament.teams.map(tt => tt.teamId);
      
      // Reset players' teamId to null before deleting teams
      await prisma.player.updateMany({
        where: {
          teamId: {
            in: teamIds,
          },
        },
        data: {
          teamId: null,
        },
      });
      
      // Delete team stats first (if any)
      await prisma.teamStats.deleteMany({
        where: {
          teamId: {
            in: teamIds,
          },
        },
      });
      
      // Delete the actual teams
      const deletedTeams = await prisma.team.deleteMany({
        where: {
          id: {
            in: teamIds,
          },
        },
      });
      
      teamsDeleted = deletedTeams.count;
    }

    // Delete the tournament (cascade deletes will handle TournamentTeam, attendance, and additional costs)
    await prisma.tournament.delete({
      where: { id },
    });

    const message = existingTournament.type === 'WEEKLY' 
      ? `Weekly tournament deleted successfully. Removed ${teamsDeleted} teams, ${existingTournament.teams.length} team assignments, ${existingTournament.playerAttendances.length} attendance records, and ${existingTournament.additionalCosts.length} additional costs.`
      : `Tournament deleted successfully. Removed ${existingTournament.teams.length} team assignments, ${existingTournament.playerAttendances.length} attendance records, and ${existingTournament.additionalCosts.length} additional costs.`;

    res.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('Delete tournament error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete tournament',
    });
  }
});

// Add team to tournament
router.post('/:id/teams/:teamId', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, teamId } = req.params;

    const [tournament, team] = await Promise.all([
      prisma.tournament.findUnique({ where: { id } }),
      prisma.team.findUnique({ where: { id: teamId } }),
    ]);

    if (!tournament) {
      res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
      return;
    }

    if (!team) {
      res.status(404).json({
        success: false,
        error: 'Team not found',
      });
      return;
    }

    // Check if team is already in tournament
    const existingEntry = await prisma.tournamentTeam.findUnique({
      where: {
        tournamentId_teamId: {
          tournamentId: id,
          teamId,
        },
      },
    });

    if (existingEntry) {
      res.status(400).json({
        success: false,
        error: 'Team is already in this tournament',
      });
      return;
    }

    await prisma.tournamentTeam.create({
      data: {
        tournamentId: id,
        teamId,
      },
    });

    res.json({
      success: true,
      message: 'Team added to tournament successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add team to tournament',
    });
  }
});

// Remove team from tournament
router.delete('/:id/teams/:teamId', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, teamId } = req.params;

    const existingEntry = await prisma.tournamentTeam.findUnique({
      where: {
        tournamentId_teamId: {
          tournamentId: id,
          teamId,
        },
      },
    });

    if (!existingEntry) {
      res.status(404).json({
        success: false,
        error: 'Team is not in this tournament',
      });
      return;
    }

    // Check if team has matches in this tournament
    const hasMatches = await prisma.match.findFirst({
      where: {
        tournamentId: id,
        OR: [
          { homeTeamId: teamId },
          { awayTeamId: teamId },
        ],
      },
    });

    if (hasMatches) {
      res.status(400).json({
        success: false,
        error: 'Cannot remove team with existing matches in this tournament',
      });
      return;
    }

    await prisma.tournamentTeam.delete({
      where: {
        tournamentId_teamId: {
          tournamentId: id,
          teamId,
        },
      },
    });

    res.json({
      success: true,
      message: 'Team removed from tournament successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to remove team from tournament',
    });
  }
});

// Clear all teams from tournament
router.put('/:id/clear-teams', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: tournamentId } = req.params;

    // Verify tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        teams: {
          include: {
            team: true,
          },
        },
        matches: true,
      },
    });

    if (!tournament) {
      res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
      return;
    }

    // Check if tournament has matches
    if (tournament.matches.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Cannot clear teams from tournament with existing matches',
      });
      return;
    }

    const teamIds = tournament.teams.map(tt => tt.teamId);
    
    if (teamIds.length === 0) {
      res.json({
        success: true,
        message: 'No teams to clear',
        data: { teamsRemoved: 0 },
      });
      return;
    }

    // Remove all tournament team player assignments
    await prisma.tournamentTeamPlayer.deleteMany({
      where: {
        tournamentId,
      },
    });

    // Remove all tournament team assignments
    await prisma.tournamentTeam.deleteMany({
      where: {
        tournamentId,
      },
    });

    // For weekly tournaments, delete the actual teams that were created for this tournament
    if (tournament.type === 'WEEKLY') {
      // Delete team stats first (if any)
      await prisma.teamStats.deleteMany({
        where: {
          teamId: {
            in: teamIds,
          },
        },
      });

      // Delete the actual teams
      const deletedTeams = await prisma.team.deleteMany({
        where: {
          id: {
            in: teamIds,
          },
        },
      });

      res.json({
        success: true,
        message: `Successfully cleared ${deletedTeams.count} teams from tournament`,
        data: {
          teamsRemoved: deletedTeams.count,
          teamIds: teamIds,
        },
      });
    } else {
      // For other tournament types, just remove the assignments
      res.json({
        success: true,
        message: `Successfully removed ${teamIds.length} team assignments from tournament`,
        data: {
          teamsRemoved: teamIds.length,
          teamIds: teamIds,
        },
      });
    }
  } catch (error) {
    console.error('Clear teams error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear teams from tournament',
    });
  }
});

// Get player attendance for a tournament
router.get('/:id/attendance', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: tournamentId } = req.params;
    const userId = req.user!.id;

    // Get user's player
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { player: true },
    });

    if (!user?.player) {
      res.json({
        success: true,
        data: {},
      });
      return;
    }

    // Get or create attendance record
    let attendance = await prisma.tournamentPlayerAttendance.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId,
          playerId: user.player.id,
        },
      },
    });

    if (!attendance) {
      attendance = await prisma.tournamentPlayerAttendance.create({
        data: {
          tournamentId,
          playerId: user.player.id,
          status: 'NULL',
        },
      });
    }

    res.json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get attendance',
    });
  }
});

// Update player attendance for a tournament
router.put('/:id/attendance', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: tournamentId } = req.params;
    const userId = req.user!.id;
    const { status, withWater, bet } = updateAttendanceSchema.parse(req.body);

    // Get user's player
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { player: true },
    });

    if (!user?.player) {
      res.status(404).json({
        success: false,
        error: 'Player not found for user',
      });
      return;
    }

    // Verify tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
      return;
    }

    // Prepare update data
    const updateData: any = { status };
    if (withWater !== undefined) {
      updateData.withWater = withWater;
    }
    if (bet !== undefined) {
      updateData.bet = bet;
    }

    // Update or create attendance
    const attendance = await prisma.tournamentPlayerAttendance.upsert({
      where: {
        tournamentId_playerId: {
          tournamentId,
          playerId: user.player.id,
        },
      },
      update: updateData,
      create: {
        tournamentId,
        playerId: user.player.id,
        status,
        withWater: withWater ?? false,
        bet: bet ?? false,
      },
    });

    res.json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update attendance',
    });
  }
});

// Update any player's attendance for a tournament (Admin/Mod only)
router.put('/:id/attendance/:playerId', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: tournamentId, playerId } = req.params;
    const { status, withWater, bet } = updateAttendanceSchema.parse(req.body);

    // Verify tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
      return;
    }

    // Verify player exists
    const player = await prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      res.status(404).json({
        success: false,
        error: 'Player not found',
      });
      return;
    }

    // Prepare update data
    const updateData: any = { status };
    if (withWater !== undefined) {
      updateData.withWater = withWater;
    }
    if (bet !== undefined) {
      updateData.bet = bet;
    }

    // Update or create attendance
    const attendance = await prisma.tournamentPlayerAttendance.upsert({
      where: {
        tournamentId_playerId: {
          tournamentId,
          playerId,
        },
      },
      update: updateData,
      create: {
        tournamentId,
        playerId,
        status,
        withWater: withWater ?? false,
        bet: bet ?? false,
      },
    });

    res.json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    console.error('Update player attendance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update player attendance',
    });
  }
});

// Get attendance statistics for a tournament
router.get('/:id/attendance-stats', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: tournamentId } = req.params;

    // Verify tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
      return;
    }

    // Get total number of players
    const totalPlayers = await prisma.player.count();

    // Get attendance statistics
    const attendanceStats = await prisma.tournamentPlayerAttendance.findMany({
      where: { tournamentId },
      select: { status: true, bet: true },
    });

    const attendingCount = attendanceStats.filter((a: any) => a.status === 'ATTEND').length;
    const notAttendingCount = attendanceStats.filter((a: any) => a.status === 'NOT_ATTEND').length;
    const nullCount = attendanceStats.filter((a: any) => a.status === 'NULL').length;
    const bettingCount = attendanceStats.filter((a: any) => a.bet === true).length;

    res.json({
      success: true,
      data: {
        totalPlayers,
        attendingCount,
        notAttendingCount,
        bettingCount,
        nullCount,
        responseRate: totalPlayers > 0 ? ((attendingCount + notAttendingCount) / totalPlayers * 100).toFixed(1) : '0',
        attendanceRate: (attendingCount + notAttendingCount) > 0 ? (attendingCount / (attendingCount + notAttendingCount) * 100).toFixed(1) : '0',
      },
    });
  } catch (error) {
    console.error('Get attendance stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get attendance statistics',
    });
  }
});

// Get detailed attendance list for a tournament
router.get('/:id/attendance-details', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: tournamentId } = req.params;

    // Verify tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
      return;
    }

    // Get all attendance records with player details
    const attendanceDetails = await prisma.tournamentPlayerAttendance.findMany({
      where: { tournamentId },
      include: {
        player: {
          select: {
            id: true,
            name: true,
            position: true,
            tier: true,
            avatar: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // ATTEND first, then NOT_ATTEND, then NULL
        { player: { name: 'asc' } }, // Then by name
      ],
    });

    res.json({
      success: true,
      data: attendanceDetails,
    });
  } catch (error) {
    console.error('Get attendance details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get attendance details',
    });
  }
});

// Update tournament team scores
router.put('/:id/scores', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: tournamentId } = req.params;
    const { scores } = updateTournamentScoresSchema.parse(req.body);

    // Verify tournament exists and is ongoing
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        teams: {
          include: {
            team: true,
          },
        },
      },
    });

    if (!tournament) {
      res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
      return;
    }

    if (tournament.status !== 'ONGOING') {
      res.status(400).json({
        success: false,
        error: 'Can only update scores for ongoing tournaments',
      });
      return;
    }

    // Get all team IDs in this tournament
    const tournamentTeamIds = tournament.teams.map(tt => tt.teamId);
    
    // Validate that all score updates are for teams in this tournament
    const scoreTeamIds = Object.keys(scores);
    const invalidTeamIds = scoreTeamIds.filter(teamId => !tournamentTeamIds.includes(teamId));
    
    if (invalidTeamIds.length > 0) {
      res.status(400).json({
        success: false,
        error: `Invalid team IDs: ${invalidTeamIds.join(', ')}. Teams not in this tournament.`,
      });
      return;
    }

    // Update team scores
    const updatePromises = Object.entries(scores).map(([teamId, score]) =>
      prisma.team.update({
        where: { id: teamId },
        data: { score },
      })
    );

    await Promise.all(updatePromises);

    // Get updated tournament data
    const updatedTournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        teams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                score: true,
              },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Team scores updated successfully',
      data: {
        tournament: updatedTournament,
        updatedScores: scores,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      });
      return;
    }

    console.error('Update scores error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update scores',
    });
  }
});

// Generate random balanced teams for a tournament
router.post('/:id/generate-teams', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: tournamentId } = req.params;

    // Verify tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
      return;
    }

    // Get attending players with their details
    const attendingPlayers = await prisma.tournamentPlayerAttendance.findMany({
      where: { 
        tournamentId,
        status: 'ATTEND'
      },
      include: {
        player: {
          select: {
            id: true,
            name: true,
            position: true,
            tier: true,
          },
        },
      },
    });

    const playerCount = attendingPlayers.length;
    console.log(`Team generation: Found ${playerCount} attending players`);

    if (playerCount < 10) {
      res.status(400).json({
        success: false,
        error: 'Need at least 10 attending players to generate teams',
      });
      return;
    }

    // Determine number of teams based on player count
    let teamCount: number;
    if (playerCount < 15) {
      teamCount = 2;
    } else if (playerCount < 20) {
      teamCount = 3;
    } else {
      teamCount = 4;
    }

    // Sort players by tier (highest to lowest)
    const sortedPlayers = attendingPlayers
      .map(attendance => attendance.player)
      .sort((a, b) => b.tier - a.tier);

    // Initialize teams
    const teams: Array<{
      name: string;
      players: typeof sortedPlayers;
      totalTier: number;
      tier9Plus: number; // Count of tier 9+ players
      lockedPlayers: Set<string>; // GK players that can't be moved
    }> = [];

    // Generate unique team names using tournament start date
    const startDate = new Date(tournament.startDate);
    const dateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    for (let i = 0; i < teamCount; i++) {
      teams.push({
        name: `Team ${i + 1} - ${dateStr}`, // Team 1 - 2025-07-21, Team 2 - 2025-07-21, etc.
        players: [],
        totalTier: 0,
        tier9Plus: 0,
        lockedPlayers: new Set(),
      });
    }

    // Separate GK and non-GK players
    const gkPlayers: typeof sortedPlayers = [];
    const nonGkPlayers: typeof sortedPlayers = [];
    
    sortedPlayers.forEach((player: any) => {
      if (player.position === 'GK') {
        gkPlayers.push(player);
      } else {
        nonGkPlayers.push(player);
      }
    });

    console.log(`Team generation: ${gkPlayers.length} GK players, ${nonGkPlayers.length} non-GK players`);

    // First, distribute GK players (one per team if possible) - LOCK only the first GK per team
    for (let i = 0; i < gkPlayers.length && i < teamCount; i++) {
      const gkPlayer = gkPlayers[i];
      const teamIndex = i % teamCount;
      
      teams[teamIndex].players.push(gkPlayer);
      teams[teamIndex].totalTier += gkPlayer.tier;
      teams[teamIndex].lockedPlayers.add(gkPlayer.id); // Lock the first (highest tier) GK per team
      if (gkPlayer.tier >= 9) {
        teams[teamIndex].tier9Plus++;
        // T9/T10 GK players are automatically locked above, so no additional locking needed
      }
    }

    // Add remaining GK players to teams with fewer GKs - DO NOT LOCK these additional GKs unless they're T9/T10
    for (let i = teamCount; i < gkPlayers.length; i++) {
      const gkPlayer = gkPlayers[i];
      
      // Find team with fewest GK players
      let bestTeamIndex = 0;
      let minGkCount = teams[0].players.filter((p: any) => p.position === 'GK').length;
      
      for (let j = 1; j < teams.length; j++) {
        const gkCount = teams[j].players.filter((p: any) => p.position === 'GK').length;
        if (gkCount < minGkCount) {
          minGkCount = gkCount;
          bestTeamIndex = j;
        }
      }
      
      teams[bestTeamIndex].players.push(gkPlayer);
      teams[bestTeamIndex].totalTier += gkPlayer.tier;
      // Lock T9/T10 GK players even if they're additional GKs
      if (gkPlayer.tier >= 9) {
        teams[bestTeamIndex].tier9Plus++;
        teams[bestTeamIndex].lockedPlayers.add(gkPlayer.id);
      }
    }

    // Calculate target players per team for balanced distribution
    const targetPlayersPerTeam = Math.floor(playerCount / teamCount);
    const teamsWithExtraPlayer = playerCount % teamCount;
    
    // Set target player count for each team
    const teamTargets = teams.map((_, index) => ({
      target: targetPlayersPerTeam + (index < teamsWithExtraPlayer ? 1 : 0),
      current: teams[index].players.length // Already has GK players
    }));

    // Now distribute non-GK players by tier (starting from highest)
    const tierGroups = new Map<number, typeof nonGkPlayers>();
    
    // Group non-GK players by tier
    nonGkPlayers.forEach((player: any) => {
      const tier = player.tier;
      if (!tierGroups.has(tier)) {
        tierGroups.set(tier, []);
      }
      tierGroups.get(tier)!.push(player);
    });

    // Distribute non-GK players tier by tier (10 to 1)
    for (let tier = 10; tier >= 1; tier--) {
      const playersInTier = tierGroups.get(tier) || [];
      
      // Shuffle players in this tier for randomness
      for (let i = playersInTier.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playersInTier[i], playersInTier[j]] = [playersInTier[j], playersInTier[i]];
      }

      // Distribute players in this tier
      for (let i = 0; i < playersInTier.length; i++) {
        const player = playersInTier[i];
        
        // Find the best team to assign this player to
        let bestTeamIndex = 0;
        
        if (tier >= 9) {
          // For high-tier players (9-10), prioritize teams with fewer high-tier players
          // but also consider team capacity
          let bestScore = Infinity;
          
          for (let j = 0; j < teams.length; j++) {
            // Skip teams that are already at capacity
            if (teams[j].players.length >= teamTargets[j].target) {
              continue;
            }
            
            // Score based on tier 9+ count and remaining capacity
            const tier9PlusScore = teams[j].tier9Plus * 10;
            const capacityScore = (teams[j].players.length / teamTargets[j].target) * 5;
            const totalScore = tier9PlusScore + capacityScore;
            
            if (totalScore < bestScore) {
              bestScore = totalScore;
              bestTeamIndex = j;
            }
          }
          
          // If all teams are at capacity, fall back to team with lowest tier 9+ count
          if (bestScore === Infinity) {
            let minTier9Plus = teams[0].tier9Plus;
            for (let j = 1; j < teams.length; j++) {
              if (teams[j].tier9Plus < minTier9Plus) {
                minTier9Plus = teams[j].tier9Plus;
                bestTeamIndex = j;
              }
            }
          }
        } else {
          // For lower-tier players, prioritize teams with capacity first, then balance
          let bestScore = Infinity;
          
          for (let j = 0; j < teams.length; j++) {
            // Calculate score based on:
            // 1. How close to capacity (heavily weighted)
            // 2. Tier balance
            // 3. Tier 9+ distribution
            
            const capacityRatio = teams[j].players.length / teamTargets[j].target;
            const isOverCapacity = teams[j].players.length >= teamTargets[j].target;
            
            // Heavily penalize teams at or over capacity
            let capacityScore = isOverCapacity ? 1000 : capacityRatio * 50;
            
            const totalTierAfter = teams[j].totalTier + tier;
            const avgTotalTier = teams.reduce((sum, team) => sum + team.totalTier, 0) / teams.length;
            const tierScore = Math.abs(totalTierAfter - avgTotalTier);
            
            const tier9PlusDiff = teams[j].tier9Plus - (teams.reduce((sum, team) => sum + team.tier9Plus, 0) / teams.length);
            const tier9PlusScore = Math.abs(tier9PlusDiff) * 3;
            
            const totalScore = capacityScore + tierScore + tier9PlusScore;
            
            if (totalScore < bestScore) {
              bestScore = totalScore;
              bestTeamIndex = j;
            }
          }
        }
        
        // Assign player to the best team
        teams[bestTeamIndex].players.push(player);
        teams[bestTeamIndex].totalTier += tier;
        if (tier >= 9) {
          teams[bestTeamIndex].tier9Plus++;
          // Lock T9/T10 players so they can't be moved during balancing
          teams[bestTeamIndex].lockedPlayers.add(player.id);
        }
      }
    }

    // Create teams in database
    const createdTeams = [];
    console.log(`Team generation: Creating ${teams.length} teams`);
    
    for (const teamData of teams) {
      console.log(`Creating team: ${teamData.name} with ${teamData.players.length} players`);
      
      const team = await prisma.team.create({
        data: {
          name: teamData.name,
          founded: new Date(),
        },
      });

      // Add team to tournament
      await prisma.tournamentTeam.create({
        data: {
          tournamentId,
          teamId: team.id,
        },
      });

      // Assign players to the team in this tournament
      if (teamData.players.length > 0) {
        console.log(`Assigning ${teamData.players.length} players to team ${team.name}`);
        await prisma.tournamentTeamPlayer.createMany({
          data: teamData.players.map((player: any) => ({
            tournamentId,
            teamId: team.id,
            playerId: player.id,
          })),
        });
      }

      createdTeams.push({
        ...team,
        players: teamData.players,
        totalTier: teamData.totalTier,
        tier9Plus: teamData.tier9Plus,
      });
    }

    console.log(`Team generation completed: Created ${createdTeams.length} teams`);

    res.json({
      success: true,
      data: {
        teams: createdTeams,
        playerCount,
        teamCount,
      },
    });
  } catch (error) {
    console.error('Generate teams error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate teams',
    });
  }
});

// End tournament - calculate money changes and finalize
router.put('/:id/end', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Fetch tournament with all related data
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        teams: {
          include: {
            team: true,
          },
        },
        tournamentTeamPlayers: {
          include: {
            player: true,
            team: true,
          },
        },
        playerAttendances: {
          include: {
            player: true,
          },
        },
        additionalCosts: true,
      },
    });

    if (!tournament) {
      res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
      return;
    }

    if (tournament.status !== 'ONGOING' && tournament.status !== 'ACTIVE') {
      res.status(400).json({
        success: false,
        error: 'Only active tournaments can be ended',
      });
      return;
    }

    // Find winner and loser teams based on scores
    const teams = tournament.teams.map(t => t.team).filter(Boolean);
    if (teams.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No teams found in tournament',
      });
      return;
    }

    const sortedTeams = teams.sort((a, b) => (b.score || 0) - (a.score || 0));
    const winnerTeam = sortedTeams[0];
    const loserTeam = sortedTeams[sortedTeams.length - 1];

    // Check if there's a clear winner/loser (no ties)
    if (winnerTeam.score === loserTeam.score) {
      res.status(400).json({
        success: false,
        error: 'Cannot end tournament with tied scores',
      });
      return;
    }

    // Get all attending players
    const attendingPlayers = tournament.playerAttendances
      .filter(att => att.status === 'ATTENDING')
      .map(att => att.player);

    // Calculate money changes
    let totalAdded = 0;
    let totalDeducted = 0;
    const moneyUpdates: Array<{ playerId: string; oldMoney: number; newMoney: number; change: number }> = [];

    // Get tournament settings
    const loserPenalty = 50000; // Default loser penalty
    const waterCostPerPlayer = 5000; // Default water cost
    const tournamentCostPerPlayer = tournament.costPerPlayer || 0;
    const bettingWinAmount = 10000; // Base betting win amount
    const bettingLossAmount = 10000; // Betting loss penalty
    const teamLoserPenalty = 5000; // Team loser penalty

    // Calculate betting win amount based on number of teams
    const teamCount = teams.length;
    const bettingWinBonus = teamCount >= 3 ? bettingWinAmount * (teamCount - 2) : bettingWinAmount;

    // Calculate water cost total
    const waterCostPlayersCount = tournament.playerAttendances
      .filter(att => att.status === 'ATTENDING' && att.withWater)
      .length;
    const totalWaterCost = waterCostPlayersCount * waterCostPerPlayer;

    // Calculate additional costs total
    const totalAdditionalCosts = tournament.additionalCosts.reduce((sum, cost) => sum + cost.amount, 0);

    // Process each attending player
    for (const player of attendingPlayers) {
      const attendance = tournament.playerAttendances.find(att => att.playerId === player.id);
      if (!attendance) continue;

      const playerTeamAssignment = tournament.tournamentTeamPlayers.find(ttp => ttp.playerId === player.id);
      const playerTeam = playerTeamAssignment?.team;
      
      let moneyChange = 0;

      // Tournament cost per player (applies to all)
      if (tournamentCostPerPlayer > 0) {
        moneyChange -= tournamentCostPerPlayer;
      }

      // Betting calculations
      if (attendance.bet) {
        if (playerTeam && playerTeam.id === winnerTeam.id) {
          // Betting winner gets bonus
          moneyChange += bettingWinBonus;
        } else {
          // Betting loser pays penalty
          moneyChange -= bettingLossAmount;
        }
      }

      // Team loser penalty (in addition to betting penalty if applicable)
      if (playerTeam && playerTeam.id === loserTeam.id) {
        moneyChange -= teamLoserPenalty;
      }

      // Water cost (winner team gets free water)
      if (attendance.withWater && playerTeam && playerTeam.id !== winnerTeam.id) {
        moneyChange -= waterCostPerPlayer;
      }

      // Additional costs distribution (split among all attending players)
      if (totalAdditionalCosts > 0) {
        const additionalCostPerPlayer = Math.floor(totalAdditionalCosts / attendingPlayers.length);
        moneyChange -= additionalCostPerPlayer;
      }

      // Update player money
      const newMoney = player.money + moneyChange;
      await prisma.player.update({
        where: { id: player.id },
        data: { money: newMoney },
      });

      moneyUpdates.push({
        playerId: player.id,
        oldMoney: player.money,
        newMoney,
        change: moneyChange,
      });

      if (moneyChange > 0) {
        totalAdded += moneyChange;
      } else if (moneyChange < 0) {
        totalDeducted += Math.abs(moneyChange);
      }
    }

    // Update tournament status to completed
    await prisma.tournament.update({
      where: { id },
      data: { 
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        tournament: {
          id: tournament.id,
          name: tournament.name,
          status: 'COMPLETED',
        },
        winner: {
          id: winnerTeam.id,
          name: winnerTeam.name,
          score: winnerTeam.score,
        },
        loser: {
          id: loserTeam.id,
          name: loserTeam.name,
          score: loserTeam.score,
        },
        playersUpdated: moneyUpdates.length,
        totalAdded,
        totalDeducted,
        moneyUpdates,
      },
    });
  } catch (error) {
    console.error('End tournament error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end tournament',
    });
  }
});

export { router as tournamentRoutes };
export default router;
