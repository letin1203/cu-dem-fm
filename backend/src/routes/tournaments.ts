import { Router, Response } from 'express';
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
    // Only count betting from players who are attending
    const bettingCount = attendanceStats.filter((a: any) => a.status === 'ATTEND' && a.bet === true).length;

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
      tierGroups.get(tier)!.push
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
    
    for (const teamData of teams) {
      const team = await prisma.team.create({
        data: {
          name: teamData.name,
          founded: new Date(),
        },
      });

      // Assign players to the team
      await prisma.player.updateMany({
        where: {
          id: {
            in: teamData.players.map((p: any) => p.id),
          },
        },
        data: {
          teamId: team.id,
        },
      });

      // Add team to tournament
      await prisma.tournamentTeam.create({
        data: {
          tournamentId,
          teamId: team.id,
        },
      });

      createdTeams.push({
        ...team,
        players: teamData.players,
        totalTier: teamData.totalTier,
        tier9Plus: teamData.tier9Plus,
      });
    }

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

// Balance existing teams
router.post('/:id/balance-teams', authenticate, authorize(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Get tournament teams with players
    const tournamentTeams = await prisma.tournamentTeam.findMany({
      where: { tournamentId },
      include: {
        team: {
          include: {
            players: {
              select: {
                id: true,
                name: true,
                position: true,
                tier: true,
              },
            },
          },
        },
      },
    });

    if (!tournamentTeams || tournamentTeams.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No teams exist for this tournament',
      });
      return;
    }

    // Get all players from all teams
    const allPlayers: any[] = [];
    const teamData: Array<{
      id: string;
      name: string;
      players: any[];
      totalTier: number;
      tier9Plus: number;
      lockedPlayers: Set<string>;
    }> = [];

    tournamentTeams.forEach((tournamentTeam: any) => {
      const team = tournamentTeam.team;
      const players = team.players || [];
      allPlayers.push(...players);

      // Create set of locked players (highest tier GK + all T9/T10 players)
      const lockedPlayerIds = new Set<string>();
      
      // 1. Lock the highest tier GK in this team (only 1 GK per team)
      const gkPlayers = players.filter((p: any) => p.position === 'GK');
      if (gkPlayers.length > 0) {
        // Sort GK players by tier (highest first) and lock only the highest tier one
        const sortedGks = gkPlayers.sort((a: any, b: any) => b.tier - a.tier);
        lockedPlayerIds.add(sortedGks[0].id); // Lock only the highest tier GK
      }
      
      // 2. Lock all T9 and T10 players (regardless of position)
      const highTierPlayers = players.filter((p: any) => p.tier >= 9);
      highTierPlayers.forEach((p: any) => {
        lockedPlayerIds.add(p.id);
      });

      teamData.push({
        id: team.id,
        name: team.name,
        players: [...players],
        totalTier: players.reduce((sum: number, p: any) => sum + p.tier, 0),
        tier9Plus: players.filter((p: any) => p.tier >= 9).length,
        lockedPlayers: lockedPlayerIds,
      });
    });

    // Get all locked player IDs (highest tier GK + all T9/T10 players from each team)
    const allLockedPlayerIds = new Set<string>();
    teamData.forEach(team => {
      team.lockedPlayers.forEach(id => allLockedPlayerIds.add(id));
    });

    // Players that can be balanced: tier <= 8 AND not locked
    const balanceablePlayers = allPlayers.filter((p: any) => 
      p.tier <= 8 && !allLockedPlayerIds.has(p.id)
    );
    
    if (balanceablePlayers.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No players available for balancing (only GK and tier 9+ players)',
      });
      return;
    }

    // Balance algorithm: swap players to minimize team differences
    const maxIterations = 100;
    let improved = true;
    let iterations = 0;

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      // Try swapping players between teams
      for (let i = 0; i < teamData.length; i++) {
        for (let j = i + 1; j < teamData.length; j++) {
          const team1 = teamData[i];
          const team2 = teamData[j];

          // Get swappable players from each team (tier <= 8 AND not locked)
          const team1SwappablePlayers = team1.players.filter((p: any) => 
            p.tier <= 8 && !team1.lockedPlayers.has(p.id)
          );
          const team2SwappablePlayers = team2.players.filter((p: any) => 
            p.tier <= 8 && !team2.lockedPlayers.has(p.id)
          );

          // Try swapping each player from team1 with each player from team2
          for (const p1 of team1SwappablePlayers) {
            for (const p2 of team2SwappablePlayers) {
              // Calculate current imbalance
              const currentPlayerDiff = Math.abs(team1.players.length - team2.players.length);
              const currentTierDiff = Math.abs(team1.totalTier - team2.totalTier);
              const currentTier9PlusDiff = Math.abs(team1.tier9Plus - team2.tier9Plus);
              const currentScore = currentPlayerDiff * 10 + currentTierDiff + currentTier9PlusDiff * 5;

              // Calculate new values after swap
              const newTeam1TotalTier = team1.totalTier - p1.tier + p2.tier;
              const newTeam2TotalTier = team2.totalTier - p2.tier + p1.tier;
              const newTierDiff = Math.abs(newTeam1TotalTier - newTeam2TotalTier);
              
              // Player count stays the same after swap
              const newScore = currentPlayerDiff * 10 + newTierDiff + currentTier9PlusDiff * 5;

              // Special case: if one team has fewer players, prioritize balancing player count
              // by ensuring the team with fewer players has lower total tier
              let shouldSwap = false;
              
              if (team1.players.length !== team2.players.length) {
                const smallerTeam = team1.players.length < team2.players.length ? team1 : team2;
                const largerTeam = team1.players.length < team2.players.length ? team2 : team1;
                
                // Target: larger team should have total tier 3-5 higher than smaller team
                const targetDiff = 4; // Target difference
                const currentDiff = largerTeam.totalTier - smallerTeam.totalTier;
                
                // If larger team has too much tier advantage, move higher tier player to smaller team
                if (currentDiff > targetDiff + 2) {
                  if ((largerTeam === team1 && p1.tier > p2.tier) || 
                      (largerTeam === team2 && p2.tier > p1.tier)) {
                    shouldSwap = true;
                  }
                }
                // If smaller team has higher or close total tier, move lower tier player from smaller team
                else if (currentDiff < targetDiff - 1) {
                  if ((smallerTeam === team1 && p1.tier < p2.tier) || 
                      (smallerTeam === team2 && p2.tier < p1.tier)) {
                    shouldSwap = true;
                  }
                }
              } else {
                // Equal player count - just balance tiers
                shouldSwap = newScore < currentScore;
              }

              if (shouldSwap) {
                // Perform the swap
                const p1Index = team1.players.findIndex((p: any) => p.id === p1.id);
                const p2Index = team2.players.findIndex((p: any) => p.id === p2.id);

                team1.players[p1Index] = p2;
                team2.players[p2Index] = p1;

                team1.totalTier = newTeam1TotalTier;
                team2.totalTier = newTeam2TotalTier;

                improved = true;
                break;
              }
            }
            if (improved) break;
          }
          if (improved) break;
        }
        if (improved) break;
      }
    }

    // Update database with new team assignments
    for (const team of teamData) {
      // Clear all current player assignments for this team
      await prisma.player.updateMany({
        where: { teamId: team.id },
        data: { teamId: null },
      });

      // Assign players to team
      await prisma.player.updateMany({
        where: {
          id: {
            in: team.players.map((p: any) => p.id),
          },
        },
        data: {
          teamId: team.id,
        },
      });
    }

    // Return updated teams
    const updatedTeams = teamData.map(team => ({
      id: team.id,
      name: team.name,
      players: team.players,
      totalTier: team.totalTier,
      tier9Plus: team.tier9Plus,
      playerCount: team.players.length,
    }));

    res.json({
      success: true,
      data: {
        teams: updatedTeams,
        iterations,
        message: `Teams balanced after ${iterations} iterations`,
      },
    });
  } catch (error) {
    console.error('Balance teams error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to balance teams',
    });
  }
});

// End tournament with money calculations
router.put('/:id/end', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: tournamentId } = req.params;

    // Check if user has permission (admin only)
    if (req.user?.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
      return;
    }

    // Get tournament with teams, attendances, and player details
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        teams: {
          include: {
            team: {
              include: {
                players: {
                  select: {
                    id: true
                  }
                }
              }
            }
          }
        },
        playerAttendances: {
          include: {
            player: true
          }
        },
        additionalCosts: true
      },
    });

    if (!tournament) {
      res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
      return;
    }

    if (tournament.status === 'COMPLETED') {
      res.status(400).json({
        success: false,
        error: 'Tournament is already completed',
      });
      return;
    }

    // If tournament has no teams, just mark as completed
    if (tournament.teams.length === 0) {
      const updatedTournament = await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'COMPLETED' },
      });

      res.json({
        success: true,
        data: {
          message: 'Tournament ended successfully! No teams to process.',
          playersUpdated: 0,
          totalDeducted: 0,
          totalAdded: 0,
          tournament: updatedTournament
        }
      });
      return;
    }

    // Auto-select winner (highest score) and loser (lowest score)
    const teamsWithScores = tournament.teams.map(t => t.team).sort((a, b) => b.score - a.score);
    const winnerTeam = teamsWithScores[0];
    const loserTeam = teamsWithScores[teamsWithScores.length - 1];
    const numberOfTeams = teamsWithScores.length;

    // Get system settings for water cost calculation
    const systemSettings = await prisma.systemSettings.findFirst();
    if (!systemSettings) {
      res.status(500).json({
        success: false,
        error: 'System settings not found',
      });
      return;
    }

    // Calculate cost per player
    const totalAttending = tournament.playerAttendances.length;
    let costPerPlayer = 0;
    if (totalAttending > 0) {
      // Get additional costs for this tournament
      const additionalCosts = await prisma.additionalCost.aggregate({
        where: { tournamentId: tournamentId },
        _sum: { amount: true }
      });
      const additionalCostSum = additionalCosts._sum.amount || 0;
      
      // Calculate net cost: stadium cost - sponsor money + additional costs
      const netCost = systemSettings.stadiumCost - systemSettings.sponsorMoney + additionalCostSum;
      const baseCostPerPlayer = netCost / totalAttending;
      
      // Round up to nearest 5000 and add 5000
      const roundedUp = Math.ceil(baseCostPerPlayer / 5000) * 5000;
      costPerPlayer = roundedUp + 5000;
    }

    let totalDeducted = 0;
    let totalAdded = 0;
    let playersUpdated = 0;

    // Process all players with attendance records
    const playerUpdates = tournament.playerAttendances.map(async (attendance) => {
      const player = attendance.player;
      let moneyChange = 0;
      let reason = '';

      // Find which team this player belongs to
      const playerTeam = tournament.teams.find(teamEntry => 
        teamEntry.team.players.some(p => p.id === player.id)
      );

      const isWinnerTeam = playerTeam?.team.id === winnerTeam.id;
      const isLoserTeam = playerTeam?.team.id === loserTeam.id;

      // Betting calculations
      if (attendance.bet) {
        if (isWinnerTeam) {
          // Betting winner calculation based on number of teams
          let bettingWinAmount;
          if (numberOfTeams >= 3) {
            // 3+ teams: +10000 * (teams - 2)
            bettingWinAmount = 10000 * (numberOfTeams - 2);
          } else {
            // 2 teams: +10000
            bettingWinAmount = 10000;
          }
          moneyChange += bettingWinAmount;
          totalAdded += bettingWinAmount;
          reason += `Betting win: +${bettingWinAmount.toLocaleString()}; `;
        } else {
          // Betting loser: -10000
          moneyChange -= 10000;
          totalDeducted += 10000;
          reason += 'Betting loss: -10,000; ';
        }
      }

      // Loser team penalty
      if (isLoserTeam) {
        // Players in loser team subtract additional 5000
        moneyChange -= 5000;
        totalDeducted += 5000;
        reason += 'Loser team penalty: -5,000; ';
      }

      // Water cost calculations
      if (attendance.withWater) {
        if (isWinnerTeam) {
          // Winner team gets free water
          reason += 'Free water (winner team); ';
        } else {
          // Non-winner team pays for water
          moneyChange -= 10000;
          totalDeducted += 10000;
          reason += 'Water cost: -10,000; ';
        }
      }

      // Tournament cost per player (applies to all attending players)
      if (costPerPlayer > 0) {
        moneyChange -= costPerPlayer;
        totalDeducted += costPerPlayer;
        reason += `Tournament cost: -${costPerPlayer.toLocaleString()}; `;
      }

      // Update player money (always update since all attending players pay tournament cost)
      if (moneyChange !== 0 || costPerPlayer > 0) {
        playersUpdated++;
        const newMoney = player.money + moneyChange;
        
        return prisma.player.update({
          where: { id: player.id },
          data: { money: newMoney }
        });
      }

      return null;
    });

    // Execute all player updates (filter out null values)
    const validUpdates = (await Promise.all(playerUpdates)).filter(Boolean);

    // Update tournament status to COMPLETED with winner and loser
    const updatedTournament = await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        status: 'COMPLETED',
        winnerId: winnerTeam.id,
        loserId: loserTeam.id,
      },
      include: {
        winner: { select: { id: true, name: true, score: true } },
        loser: { select: { id: true, name: true, score: true } }
      }
    });

    // Return response with detailed money calculation
    res.json({
      success: true,
      data: {
        message: `Tournament ended successfully! Winner: ${winnerTeam.name} (${winnerTeam.score} points), Loser: ${loserTeam.name} (${loserTeam.score} points)`,
        playersUpdated,
        totalDeducted,
        totalAdded,
        netChange: totalAdded - totalDeducted,
        costPerPlayer,
        tournament: updatedTournament,
        winner: winnerTeam,
        loser: loserTeam
      }
    });
  } catch (error) {
    console.error('End tournament error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end tournament',
    });
  }
});

// Get tournament team scores
router.get('/:id/scores', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        teams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                score: true,
                logo: true,
              },
            },
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

    const teamScores = tournament.teams.map(tournamentTeam => ({
      teamId: tournamentTeam.team.id,
      name: tournamentTeam.team.name,
      logo: tournamentTeam.team.logo,
      score: tournamentTeam.team.score,
    }));

    res.json({
      success: true,
      data: {
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        status: tournament.status,
        teamScores,
      },
    });
  } catch (error) {
    console.error('Get tournament scores error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tournament scores',
    });
  }
});

// Update tournament team scores (bulk update)
router.put('/:id/scores', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { scores } = updateTournamentScoresSchema.parse(req.body);

    // Verify tournament exists and is ongoing
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        teams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
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

    // Verify all team IDs belong to this tournament
    const tournamentTeamIds = tournament.teams.map(t => t.team.id);
    const scoreTeamIds = Object.keys(scores);
    
    for (const teamId of scoreTeamIds) {
      if (!tournamentTeamIds.includes(teamId)) {
        res.status(400).json({
          success: false,
          error: `Team ${teamId} is not part of this tournament`,
        });
        return;
      }
    }

    // Update team scores
    const updatePromises = Object.entries(scores).map(([teamId, score]) =>
      prisma.team.update({
        where: { id: teamId },
        data: { score },
      })
    );

    await Promise.all(updatePromises);

    // Fetch updated tournament with scores
    const updatedTournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        teams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                score: true,
                logo: true,
              },
            },
          },
        },
      },
    });

    const teamScores = updatedTournament!.teams.map(tournamentTeam => ({
      teamId: tournamentTeam.team.id,
      name: tournamentTeam.team.name,
      logo: tournamentTeam.team.logo,
      score: tournamentTeam.team.score,
    }));

    res.json({
      success: true,
      data: {
        message: 'Team scores updated successfully',
        tournamentId: updatedTournament!.id,
        teamScores,
      },
    });
  } catch (error) {
    console.error('Update tournament scores error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update tournament scores',
    });
  }
});

export { router as tournamentRoutes };
