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
          additionalCosts: {
            orderBy: {
              createdAt: 'desc',
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

// Get every player's saved money changes for a completed tournament.
router.get('/:id/money-history', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const history = await prisma.playerMoneyHistory.findMany({
      where: { tournamentId: req.params.id },
      include: { player: { select: { id: true, name: true, position: true, tier: true } } },
      orderBy: { player: { name: 'asc' } },
    });
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Không thể tải biến động tiền của giải đấu' });
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
        additionalCosts: {
          orderBy: {
            createdAt: 'desc',
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
    if ((error as { code?: string }).code === 'P2002') {
      res.status(409).json({
        success: false,
        error: 'A tournament with this name already exists',
      });
      return;
    }
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

    if (existingTournament.status === 'COMPLETED' && (updateData.stadiumCost !== undefined || updateData.fundContribution !== undefined)) {
      res.status(400).json({
        success: false,
        error: 'Không thể chỉnh sửa tài chính của giải đã hoàn thành',
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
    const { status, withWater, bet, playerId, toggleWater, toggleBet } = req.body;

    // If playerId is provided and user is admin/mod, use that player instead
    let targetPlayerId = userId;
    if (playerId && req.user!.role && ['ADMIN', 'MOD'].includes(req.user!.role)) {
      targetPlayerId = playerId;
    } else if (playerId) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions to modify other players',
      });
      return;
    }

    // Get the target player
    let player;
    if (targetPlayerId === userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { player: true },
      });
      player = user?.player;
    } else {
      player = await prisma.player.findUnique({
        where: { id: targetPlayerId },
      });
    }

    if (!player) {
      res.status(404).json({
        success: false,
        error: 'Player not found',
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

    // Handle toggle water request
    if (toggleWater) {
      const currentAttendance = await prisma.tournamentPlayerAttendance.findUnique({
        where: {
          tournamentId_playerId: {
            tournamentId,
            playerId: player.id,
          },
        },
      });

      const newWaterStatus = !(currentAttendance?.withWater ?? false);
      
      const attendance = await prisma.tournamentPlayerAttendance.upsert({
        where: {
          tournamentId_playerId: {
            tournamentId,
            playerId: player.id,
          },
        },
        update: { withWater: newWaterStatus },
        create: {
          tournamentId,
          playerId: player.id,
          status: currentAttendance?.status || 'ATTEND',
          withWater: newWaterStatus,
          bet: currentAttendance?.bet ?? false,
        },
      });

      res.json({
        success: true,
        data: attendance,
      });
      return;
    }

    // Handle toggle bet request
    if (toggleBet) {
      if (tournament.status !== 'ONGOING' || tournament.startDate.getTime() <= Date.now()) {
        res.status(400).json({
          success: false,
          error: 'Chỉ được thay đổi cược khi giải đang diễn ra nhưng chưa tới thời gian đã hẹn',
        });
        return;
      }
      const currentAttendance = await prisma.tournamentPlayerAttendance.findUnique({
        where: {
          tournamentId_playerId: {
            tournamentId,
            playerId: player.id,
          },
        },
      });

      const newBetStatus = !(currentAttendance?.bet ?? false);
      
      const attendance = await prisma.tournamentPlayerAttendance.upsert({
        where: {
          tournamentId_playerId: {
            tournamentId,
            playerId: player.id,
          },
        },
        update: { bet: newBetStatus },
        create: {
          tournamentId,
          playerId: player.id,
          status: currentAttendance?.status || 'ATTEND',
          withWater: currentAttendance?.withWater ?? false,
          bet: newBetStatus,
        },
      });

      res.json({
        success: true,
        data: attendance,
      });
      return;
    }

    // Prepare update data for regular attendance update
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
          playerId: player.id,
        },
      },
      update: updateData,
      create: {
        tournamentId,
        playerId: player.id,
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

// Register multiple pending players at once (Admin/Mod only).
// Keeping this as one HTTP request avoids rate-limit failures when staff register a group.
router.put('/:id/attendance/batch', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: tournamentId } = req.params;
    const requestedPlayerIds: unknown[] = Array.isArray(req.body.playerIds) ? req.body.playerIds : [];
    const playerIds: string[] = [...new Set(
      requestedPlayerIds.filter((playerId): playerId is string => typeof playerId === 'string' && playerId.length > 0),
    )];

    if (playerIds.length === 0) {
      res.status(400).json({ success: false, error: 'Vui lòng chọn ít nhất một cầu thủ' });
      return;
    }

    const [tournament, players, existingAttendances] = await Promise.all([
      prisma.tournament.findUnique({ where: { id: tournamentId }, select: { id: true } }),
      prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true } }),
      prisma.tournamentPlayerAttendance.findMany({
        where: { tournamentId, playerId: { in: playerIds } },
        select: { playerId: true, status: true },
      }),
    ]);

    if (!tournament) {
      res.status(404).json({ success: false, error: 'Không tìm thấy giải đấu' });
      return;
    }

    if (players.length !== playerIds.length) {
      res.status(400).json({ success: false, error: 'Danh sách có cầu thủ không hợp lệ' });
      return;
    }

    // Only pending players can be registered through this modal. Do not overwrite a response.
    const attendanceByPlayerId = new Map(existingAttendances.map(attendance => [attendance.playerId, attendance.status]));
    const pendingPlayerIds = playerIds.filter(playerId => {
      const status = attendanceByPlayerId.get(playerId);
      return status === undefined || status === 'NULL';
    });

    await prisma.$transaction(
      pendingPlayerIds.map(playerId => prisma.tournamentPlayerAttendance.upsert({
        where: { tournamentId_playerId: { tournamentId, playerId } },
        update: { status: 'ATTEND' },
        create: { tournamentId, playerId, status: 'ATTEND' },
      })),
    );

    res.json({ success: true, data: { updatedCount: pendingPlayerIds.length, playerIds: pendingPlayerIds } });
  } catch (error) {
    console.error('Batch update player attendance error:', error);
    res.status(500).json({ success: false, error: 'Không thể đăng ký cầu thủ' });
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
    // Players without a record are also awaiting a response.
    const nullCount = totalPlayers - attendingCount - notAttendingCount;
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

    // Return every player, including those without an attendance record yet.
    // Missing records are represented as NULL so staff can mark them as ATTEND.
    const [players, attendanceRecords] = await Promise.all([
      prisma.player.findMany({
        select: { id: true, name: true, position: true, tier: true, avatar: true },
        orderBy: { name: 'asc' },
      }),
      prisma.tournamentPlayerAttendance.findMany({ where: { tournamentId } }),
    ]);
    const attendanceByPlayerId = new Map(attendanceRecords.map(record => [record.playerId, record]));
    const attendanceDetails = players.map((player) => {
      const attendance = attendanceByPlayerId.get(player.id);
      return attendance || {
        id: `pending-${player.id}`,
        tournamentId,
        playerId: player.id,
        status: 'NULL',
        withWater: false,
        bet: false,
        createdAt: tournament.createdAt,
        updatedAt: tournament.updatedAt,
        player,
      };
    }).map((attendance: any) => attendance.player ? attendance : {
      ...attendance,
      player: players.find(player => player.id === attendance.playerId),
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
    const requestedTeamCount = req.body?.teamCount;

    if (requestedTeamCount !== undefined && ![2, 3, 4].includes(requestedTeamCount)) {
      res.status(400).json({ success: false, error: 'Team count must be 2, 3, or 4' });
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

    // Use the team count selected in the UI, otherwise keep the automatic default.
    let teamCount: number = requestedTeamCount;
    if (!teamCount) {
      if (playerCount < 15) teamCount = 2;
      else if (playerCount < 20) teamCount = 3;
      else teamCount = 4;
    }

    // Tier 1 is strongest, so sort strongest to weakest.
    const sortedPlayers = attendingPlayers
      .map(attendance => attendance.player)
      .sort((a, b) => a.tier - b.tier);

    // Initialize teams
    const teams: Array<{
      name: string;
      players: typeof sortedPlayers;
      totalTier: number;
      tier9Plus: number; // Count of strongest players (tier 1-2)
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
      if (gkPlayer.tier <= 2) {
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
      // Lock Tier 1/2 GKs even if they're additional GKs
      if (gkPlayer.tier <= 2) {
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

    // Distribute non-GK players tier by tier (1 to 6, strongest first)
    for (let tier = 1; tier <= 6; tier++) {
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
        
        if (tier <= 2) {
          // Apply a strict hierarchy for strong players. Tier 1 is balanced
          // first; when assigning Tier 2, teams with fewer Tier 1 players
          // always win before Tier 2 count or capacity are considered.
          let bestTierPriority: number[] | null = null;
          let bestCapacityRatio = Infinity;
          
          for (let j = 0; j < teams.length; j++) {
            if (teams[j].players.length >= teamTargets[j].target) {
              continue;
            }

            const tierPriority = Array.from({ length: tier }, (_, index) =>
              teams[j].players.filter((assignedPlayer: any) => assignedPlayer.tier === index + 1).length
            );
            const capacityRatio = teams[j].players.length / teamTargets[j].target;
            const hasBetterTierPriority = !bestTierPriority || tierPriority.some((count, index) =>
              count !== bestTierPriority![index] &&
              tierPriority.slice(0, index).every((previous, previousIndex) => previous === bestTierPriority![previousIndex]) &&
              count < bestTierPriority![index]
            );
            const hasSameTierPriority = bestTierPriority !== null && tierPriority.every((count, index) => count === bestTierPriority![index]);

            if (hasBetterTierPriority || (hasSameTierPriority && capacityRatio < bestCapacityRatio)) {
              bestTierPriority = tierPriority;
              bestCapacityRatio = capacityRatio;
              bestTeamIndex = j;
            }
          }
          
          // Capacity should normally prevent this; retain a safe fallback.
          if (!bestTierPriority) {
            let minTierCount = teams[0].players.filter((assignedPlayer: any) => assignedPlayer.tier === tier).length;
            for (let j = 1; j < teams.length; j++) {
              const tierCount = teams[j].players.filter((assignedPlayer: any) => assignedPlayer.tier === tier).length;
              if (tierCount < minTierCount) {
                minTierCount = tierCount;
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
        if (tier <= 2) {
          teams[bestTeamIndex].tier9Plus++;
          // Mark strong players for the initial distribution.
          teams[bestTeamIndex].lockedPlayers.add(player.id);
        }
      }
    }

    // Final balancing pass: use average Tier, rather than total Tier. This
    // keeps teams comparable even when the number of players is uneven (for
    // example, 33 players split into teams of 9, 8, 8, and 8). Tier 1/2 and
    // primary GK assignments stay locked; remaining goalkeepers may only swap
    // with other goalkeepers, so each team keeps its GK allocation.
    const getAverageTierSpread = (totals: number[]) => {
      const averages = totals.map((total, index) => total / teams[index].players.length);
      return Math.max(...averages) - Math.min(...averages);
    };
    for (let iteration = 0; iteration < 100; iteration++) {
      const currentTotals = teams.map(team => team.totalTier);
      const currentSpread = getAverageTierSpread(currentTotals);
      let bestSwap: { firstTeam: number; secondTeam: number; firstPlayer: number; secondPlayer: number; spread: number } | null = null;

      for (let firstTeam = 0; firstTeam < teams.length; firstTeam++) {
        for (let secondTeam = firstTeam + 1; secondTeam < teams.length; secondTeam++) {
          for (let firstPlayer = 0; firstPlayer < teams[firstTeam].players.length; firstPlayer++) {
            const playerA = teams[firstTeam].players[firstPlayer];
            if (teams[firstTeam].lockedPlayers.has(playerA.id)) continue;

            for (let secondPlayer = 0; secondPlayer < teams[secondTeam].players.length; secondPlayer++) {
              const playerB = teams[secondTeam].players[secondPlayer];
              if (teams[secondTeam].lockedPlayers.has(playerB.id)) continue;
              const playerAIsGoalkeeper = playerA.position === 'GK' || playerA.position === 'Goalkeeper';
              const playerBIsGoalkeeper = playerB.position === 'GK' || playerB.position === 'Goalkeeper';
              if (playerAIsGoalkeeper !== playerBIsGoalkeeper) continue;

              const candidateTotals = [...currentTotals];
              candidateTotals[firstTeam] += playerB.tier - playerA.tier;
              candidateTotals[secondTeam] += playerA.tier - playerB.tier;
              const candidateSpread = getAverageTierSpread(candidateTotals);

              if (candidateSpread < currentSpread && (!bestSwap || candidateSpread < bestSwap.spread)) {
                bestSwap = { firstTeam, secondTeam, firstPlayer, secondPlayer, spread: candidateSpread };
              }
            }
          }
        }
      }

      if (!bestSwap) break;

      const teamA = teams[bestSwap.firstTeam];
      const teamB = teams[bestSwap.secondTeam];
      const playerA = teamA.players[bestSwap.firstPlayer];
      const playerB = teamB.players[bestSwap.secondPlayer];
      teamA.players[bestSwap.firstPlayer] = playerB;
      teamB.players[bestSwap.secondPlayer] = playerA;
      teamA.totalTier += playerB.tier - playerA.tier;
      teamB.totalTier += playerA.tier - playerB.tier;
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
    const cancelledGkDiscountPlayerIds = new Set(
      Array.isArray(req.body?.cancelledGkDiscountPlayerIds)
        ? req.body.cancelledGkDiscountPlayerIds.filter((playerId: unknown): playerId is string => typeof playerId === 'string')
        : []
    );

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
      .filter(att => att.status === 'ATTEND' || att.status === 'ATTENDING')
      .map(att => att.player);

    // Calculate money changes
    let totalAdded = 0;
    let totalDeducted = 0;
    const moneyUpdates: Array<{ playerId: string; oldMoney: number; newMoney: number; change: number }> = [];
    const systemSettings = await prisma.systemSettings.findFirst();

    // Get tournament settings
    const loserPenalty = 50000; // Default loser penalty
    const waterCostPerPlayer = 10000; // Water cost
    const bettingWinAmount = 10000; // Fixed betting win amount
    const bettingLossAmount = 10000; // Betting loss penalty
    const teamLoserPenalty = 10000; // Team loser penalty

    const bettingWinBonus = bettingWinAmount;

    // Calculate additional costs total
    const totalAdditionalCosts = tournament.additionalCosts.reduce((sum, cost) => sum + cost.amount, 0);
    const sponsorMoney = systemSettings?.sponsorMoney ?? 0;
    const stadiumCost = tournament.stadiumCost ?? systemSettings?.stadiumCost ?? 0;
    const fundContribution = tournament.fundContribution ?? 0;
    const netTournamentCost = stadiumCost - sponsorMoney + totalAdditionalCosts - fundContribution;
    const tournamentCostPerPlayer = attendingPlayers.length > 0
      ? Math.ceil((netTournamentCost / attendingPlayers.length) / 5000) * 5000 + 5000
      : 0;

    // Process each attending player
    for (const player of attendingPlayers) {
      const attendance = tournament.playerAttendances.find(att => att.playerId === player.id);
      if (!attendance) continue;

      const playerTeamAssignment = tournament.tournamentTeamPlayers.find(ttp => ttp.playerId === player.id);
      const playerTeam = playerTeamAssignment?.team;
      const moneyChangeDetails: Array<{ description: string; amount: number }> = [];

      // Goalkeepers receive a 50% tournament-cost discount unless staff
      // cancelled it from the end-tournament confirmation modal.
      if (tournamentCostPerPlayer > 0) {
        const isGoalkeeper = player.position === 'GK' || player.position === 'Goalkeeper';
        const hasGkDiscount = isGoalkeeper && !cancelledGkDiscountPlayerIds.has(player.id);
        const tournamentCost = hasGkDiscount
          ? Math.round(tournamentCostPerPlayer / 2)
          : tournamentCostPerPlayer;
        moneyChangeDetails.push({
          description: hasGkDiscount ? 'Chi phí giải đấu mỗi cầu thủ (GK giảm 50%)' : 'Chi phí giải đấu mỗi cầu thủ',
          amount: -tournamentCost,
        });
      }

      // Betting calculations
      if (attendance.bet) {
        if (playerTeam && playerTeam.id === winnerTeam.id) {
          // Betting winner gets bonus
          moneyChangeDetails.push({ description: 'Cược thắng', amount: bettingWinBonus });
        } else {
          // Betting loser pays penalty
          moneyChangeDetails.push({ description: 'Cược thua', amount: -bettingLossAmount });
        }
      }

      // Team loser penalty (in addition to betting penalty if applicable)
      if (playerTeam && playerTeam.id === loserTeam.id) {
        moneyChangeDetails.push({ description: 'Cầu thủ đội thua', amount: -teamLoserPenalty });
      }

      // Water cost (winner team gets free water)
      if (attendance.withWater && playerTeam && playerTeam.id !== winnerTeam.id) {
        moneyChangeDetails.push({ description: 'Chi phí nước', amount: -waterCostPerPlayer });
      }

      const moneyChange = moneyChangeDetails.reduce((total, item) => total + item.amount, 0);

      // Update player money
      const newMoney = player.money + moneyChange;
      await prisma.player.update({
        where: { id: player.id },
        data: { money: newMoney },
      });

      await prisma.playerMoneyHistory.create({
        data: {
          playerId: player.id,
          tournamentId: tournament.id,
          amount: moneyChange,
          balanceBefore: player.money,
          balanceAfter: newMoney,
          description: `Tổng kết giải đấu: ${tournament.name}`,
          details: moneyChangeDetails,
        },
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
        sponsorMoney,
        stadiumCost,
        costPerPlayer: tournamentCostPerPlayer,
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
