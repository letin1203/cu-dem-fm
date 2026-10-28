import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { createTournamentSchema, updateTournamentSchema, paginationSchema } from '../schemas/validation';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';
import { getDefaultCancellationDeadline } from '../lib/tournamentRules';
import { tournamentSocialRoutes } from './tournamentSocial';
import { tournamentAttendanceRoutes } from './tournamentAttendance';
import { tournamentSplitRoutes } from './tournamentSplit';
import { tournamentSettlementRoutes } from './tournamentSettlement';

const router = Router();

router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const { status, type } = req.query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (req.user?.role !== 'ADMIN') where.isTest = false;

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
                  positionSecond: true,
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
                  stats: true,
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
              durationMinutes: true,
              homeTeam: { select: { id: true, name: true } },
              awayTeam: { select: { id: true, name: true } },
              events: {
                select: {
                  id: true,
                  type: true,
                  team: true,
                  minute: true,
                  playerId: true,
                  player: { select: { id: true, name: true } },
                },
                orderBy: { minute: 'asc' },
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
          loser: {
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
router.get('/:id/money-history', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const history = await prisma.playerMoneyHistory.findMany({
      where: { tournamentId: req.params.id },
      // money is the player's current balance, used by the UI to decide
      // whether the debt-settlement button still applies.
      include: { player: { select: { id: true, name: true, position: true, tier: true, money: true } } },
      orderBy: { player: { name: 'asc' } },
    });
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Không thể tải biến động tiền của giải đấu' });
  }
});

// Get dates that contain completed weekly tournaments for a calendar month.
router.get('/completed-dates', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      res.status(400).json({ success: false, error: 'Năm hoặc tháng không hợp lệ' });
      return;
    }

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const nextMonthStart = new Date(Date.UTC(year, month, 1));
    const tournaments = await prisma.tournament.findMany({
      where: {
        type: 'WEEKLY',
        status: { in: ['COMPLETED', 'DELETED'] },
        startDate: { gte: monthStart, lt: nextMonthStart },
      },
      select: { startDate: true },
      orderBy: { startDate: 'desc' },
    });

    res.json({
      success: true,
      data: [...new Set(tournaments.map(tournament => tournament.startDate.toISOString().slice(0, 10)))],
    });
  } catch (error) {
    console.error('Get completed tournament dates error:', error);
    res.status(500).json({ success: false, error: 'Không thể tải ngày có giải đấu' });
  }
});

// Get tournament by ID
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
                    positionSecond: true,
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
                positionSecond: true,
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
        cancellationDeadline: tournamentData.cancellationDeadline ?? getDefaultCancellationDeadline(tournamentData.startDate),
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

    if (updateData.selfFunded !== undefined && req.user!.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Chỉ admin mới có thể thay đổi chế độ Tự túc',
      });
      return;
    }

    if (updateData.isTest !== undefined && req.user!.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Chỉ admin mới có thể thay đổi trạng thái Test giải' });
      return;
    }

    if (updateData.format !== undefined && req.user!.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Chỉ admin mới có thể thay đổi thể thức giải đấu' });
      return;
    }

    if (updateData.format !== undefined && existingTournament.status !== 'UPCOMING') {
      res.status(400).json({ success: false, error: 'Chỉ có thể đổi thể thức trước khi giải đấu bắt đầu' });
      return;
    }

    if (updateData.format !== undefined && await prisma.tournamentTeam.count({ where: { tournamentId: id } }) > 0) {
      res.status(400).json({ success: false, error: 'Chỉ có thể đổi thể thức trước khi chia team' });
      return;
    }

    if (updateData.selfFunded !== undefined && existingTournament.isProtected) {
      res.status(403).json({
        success: false,
        error: 'Giải đấu đã Protect, không thể thay đổi chế độ quỹ',
      });
      return;
    }

    if (updateData.isTest !== undefined && existingTournament.isProtected) {
      res.status(403).json({ success: false, error: 'Giải đấu đã Protect, không thể thay đổi trạng thái Test giải' });
      return;
    }

    if (
      updateData.startDate
      && existingTournament.cancellationDeadline
      && existingTournament.cancellationDeadline.getTime() >= updateData.startDate.getTime()
    ) {
      res.status(400).json({
        success: false,
        error: 'Giờ thi đấu mới phải sau thời gian chốt hủy',
      });
      return;
    }

    if (updateData.cancellationDeadline !== undefined && updateData.cancellationDeadline !== null) {
      const tournamentStartDate = updateData.startDate ?? existingTournament.startDate;
      if (updateData.cancellationDeadline.getTime() <= Date.now() || updateData.cancellationDeadline.getTime() >= tournamentStartDate.getTime()) {
        res.status(400).json({
          success: false,
          error: 'Thời gian chốt hủy phải sau thời điểm hiện tại và trước giờ diễn ra giải đấu',
        });
        return;
      }
    }

    if (existingTournament.status === 'COMPLETED' && (updateData.stadiumCost !== undefined || updateData.sponsorMoney !== undefined || updateData.fundContribution !== undefined || updateData.selfFunded !== undefined || updateData.maxAttendance !== undefined)) {
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

    const tournament = await prisma.$transaction(async (tx) => {
      if (updateData.selfFunded === true) {
        await tx.additionalCost.deleteMany({ where: { tournamentId: id } });
        await tx.tournamentPlayerAttendance.updateMany({
          where: { tournamentId: id },
          data: { withWater: false, bet: false },
        });
      }

      return tx.tournament.update({
        where: { id },
        data: { ...updateData, ...(updateData.selfFunded === true ? { sponsorMoney: 0, fundContribution: 0 } : {}) },
        include: {
          teams: {
            include: {
              team: { select: { id: true, name: true, logo: true } },
            },
          },
          winner: { select: { id: true, name: true, logo: true } },
        },
      });
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

// Only admins can protect a tournament from deletion.
router.put('/:id/protection', authenticate, authorize(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tournament = await prisma.tournament.update({
      where: { id: req.params.id },
      data: { isProtected: req.body?.isProtected === true },
      select: { id: true, isProtected: true },
    });
    res.json({ success: true, data: tournament, message: tournament.isProtected ? 'Đã Protect giải đấu' : 'Đã bỏ Protect giải đấu' });
  } catch {
    res.status(404).json({ success: false, error: 'Không tìm thấy giải đấu' });
  }
});

// Soft-delete a tournament. Keeping its record means the old-tournament view
// remains auditable and no completion/financial settlement can run afterwards.
// Permanently delete a tournament and every record owned by it. This is kept
// separate from the regular delete route below, which is a recoverable soft
// delete. Completed tournaments have already changed player balances, so those
// changes must be reversed before their settlement history is removed.
router.delete('/:id/permanent', authenticate, authorize(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        teams: { select: { teamId: true } },
        moneyHistory: { select: { id: true, playerId: true, amount: true } },
      },
    });

    if (!tournament) {
      res.status(404).json({ success: false, error: 'Tournament not found' });
      return;
    }

    const balanceChanges = new Map<string, number>();
    for (const history of tournament.moneyHistory) {
      balanceChanges.set(
        history.playerId,
        (balanceChanges.get(history.playerId) || 0) - history.amount,
      );
    }
    const teamIds = tournament.teams.map((entry) => entry.teamId);

    await prisma.$transaction(async (tx) => {
      // Revert completed-settlement balance effects before deleting the audit
      // rows. Each history amount is applied in reverse to its payer.
      for (const [playerId, amount] of balanceChanges) {
        if (amount !== 0) {
          await tx.player.update({
            where: { id: playerId },
            data: { money: { increment: amount } },
          });
        }
      }

      const matches = await tx.match.findMany({
        where: { tournamentId: id },
        select: { id: true },
      });
      const matchIds = matches.map((match) => match.id);

      if (matchIds.length) {
        await tx.matchEvent.deleteMany({ where: { matchId: { in: matchIds } } });
        await tx.match.deleteMany({ where: { id: { in: matchIds } } });
      }

      await tx.playerMoneyHistory.deleteMany({ where: { tournamentId: id } });
      await tx.tournamentDeadmatchEntry.deleteMany({ where: { tournamentId: id } });
      await tx.tournamentFriendInvite.deleteMany({ where: { tournamentId: id } });
      await tx.tournamentChallenge.deleteMany({ where: { tournamentId: id } });
      await tx.tournamentSwapRequest.deleteMany({ where: { tournamentId: id } });
      await tx.tournamentTeamPlayer.deleteMany({ where: { tournamentId: id } });
      await tx.tournamentTeam.deleteMany({ where: { tournamentId: id } });
      await tx.tournamentPlayerAttendance.deleteMany({ where: { tournamentId: id } });
      await tx.additionalCost.deleteMany({ where: { tournamentId: id } });
      await tx.tournament.delete({ where: { id } });

      // Generated teams are tournament-only. Do not remove a Team that has
      // subsequently been used by players or another tournament.
      if (teamIds.length) {
        await tx.team.deleteMany({
          where: {
            id: { in: teamIds },
            players: { none: {} },
            tournaments: { none: {} },
            tournamentTeamPlayers: { none: {} },
            homeMatches: { none: {} },
            awayMatches: { none: {} },
            wonTournaments: { none: {} },
            lostTournaments: { none: {} },
          },
        });
      }
    });

    res.json({
      success: true,
      message: `Đã xóa vĩnh viễn giải đấu ${tournament.name} và toàn bộ dữ liệu liên quan.`,
    });
  } catch (error) {
    console.error('Permanently delete tournament error:', error);
    res.status(500).json({ success: false, error: 'Không thể xóa vĩnh viễn giải đấu' });
  }
});

router.delete('/:id', authenticate, authorize(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason) {
      res.status(400).json({ success: false, error: 'Vui lòng nhập lý do xóa giải đấu' });
      return;
    }

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

    if (existingTournament.isProtected) {
      res.status(403).json({ success: false, error: 'Giải đấu đang được Protect và không thể xóa' });
      return;
    }

    if (existingTournament.status === 'DELETED') {
      res.status(400).json({ success: false, error: 'Giải đấu này đã được xóa' });
      return;
    }

    // A completed tournament may already have settled money history. Do not
    // allow it to be marked deleted unless that settlement is explicitly
    // reversed in a dedicated flow.
    if (existingTournament.status === 'COMPLETED') {
      res.status(400).json({ success: false, error: 'Không thể xóa giải đấu đã hoàn thành và đã tính tiền' });
      return;
    }

    const deletedTournament = await prisma.tournament.update({
      where: { id },
      data: { status: 'DELETED', deletedReason: reason },
    });

    res.json({
      success: true,
      data: deletedTournament,
      message: 'Đã chuyển giải đấu sang trạng thái đã xóa. Giải đấu sẽ không được tính tiền.',
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

// Social, attendance, team-split and settlement endpoints live in their own
// modules; they share the /api/tournaments base path.
router.use('/', tournamentSocialRoutes);
router.use('/', tournamentAttendanceRoutes);
router.use('/', tournamentSplitRoutes);
router.use('/', tournamentSettlementRoutes);

export { router as tournamentRoutes };
export default router;
