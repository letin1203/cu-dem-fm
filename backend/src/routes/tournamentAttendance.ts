import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';
import { updateAttendanceSchema } from '../schemas/validation';
import {
  getTournamentCancellationDeadline,
  hasAttendanceCapacity,
  hasNonNegativeAvailableBalance,
} from '../lib/tournamentRules';

const router = Router();

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

// Register one or more of the current user's friends in a single request.
router.put('/:id/friend-attendance', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tournamentId = req.params.id;
    const rawPlayerIds: unknown[] = Array.isArray(req.body?.playerIds) ? req.body.playerIds : [];
    const playerIds: string[] = [...new Set(rawPlayerIds.filter((playerId): playerId is string => typeof playerId === 'string'))];
    const field5 = req.body?.field5 !== false;
    const field7 = req.body?.field7 !== false;
    if (playerIds.length === 0 || playerIds.length > 2 || (!field5 && !field7)) {
      res.status(400).json({ success: false, error: 'Vui lòng chọn bạn và ít nhất một sân' });
      return;
    }

    const [tournament, owner, friends] = await Promise.all([
      prisma.tournament.findUnique({ where: { id: tournamentId }, select: { id: true, status: true, selfFunded: true, maxAttendance: true, pitchType: true } }),
      prisma.user.findUnique({ where: { id: req.user!.id }, include: { player: true } }),
      prisma.player.findMany({ where: { id: { in: playerIds }, friendOwnerId: req.user!.id }, select: { id: true } }),
    ]);
    if (!tournament || !['UPCOMING', 'ONGOING'].includes(tournament.status)) {
      res.status(400).json({ success: false, error: 'Giải đấu không mở đăng ký' });
      return;
    }
    if (friends.length !== playerIds.length) {
      res.status(403).json({ success: false, error: 'Bạn chỉ có thể đăng ký cho bạn bè của mình' });
      return;
    }
    if (
      !tournament.selfFunded &&
      owner?.player &&
      !(await hasNonNegativeAvailableBalance(owner.player.id, owner.player.money))
    ) {
      res.status(400).json({ success: false, error: 'Số dư hiện tại cộng tiền nạp chờ duyệt vẫn âm, vui lòng thanh toán trước' });
      return;
    }
    const registrationField5 = tournament.pitchType === 'FIELD_5' ? true : tournament.pitchType === 'FIELD_7' ? false : field5;
    const registrationField7 = tournament.pitchType === 'FIELD_7' ? true : tournament.pitchType === 'FIELD_5' ? false : field7;
    const alreadyAttending = await prisma.tournamentPlayerAttendance.count({ where: { tournamentId, playerId: { in: playerIds }, status: { in: ['ATTEND', 'ATTENDING'] } } });
    if (!await hasAttendanceCapacity(tournamentId, tournament.maxAttendance, registrationField5, registrationField7, playerIds.length - alreadyAttending)) {
      res.status(400).json({ success: false, error: `Giải đấu đã đạt giới hạn ${tournament.maxAttendance} cầu thủ điểm danh` });
      return;
    }
    await prisma.$transaction(playerIds.map(playerId => prisma.tournamentPlayerAttendance.upsert({
      where: { tournamentId_playerId: { tournamentId, playerId } },
      update: { status: 'ATTEND', field5: registrationField5, field7: registrationField7, registeredAt: new Date(), withWater: false, bet: false },
      create: { tournamentId, playerId, status: 'ATTEND', field5: registrationField5, field7: registrationField7, registeredAt: new Date() },
    })));
    res.json({ success: true, data: { playerIds } });
  } catch (error) {
    console.error('Friend attendance error:', error);
    res.status(500).json({ success: false, error: 'Không thể đăng ký cho bạn' });
  }
});

// A user may cancel attendance for a player registered as their friend.
router.put('/:id/friend-attendance/:playerId/cancel', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [tournament, friend] = await Promise.all([
      prisma.tournament.findUnique({ where: { id: req.params.id }, select: { status: true, teams: { select: { teamId: true } } } }),
      prisma.player.findUnique({ where: { id: req.params.playerId }, select: { id: true, friendOwnerId: true } }),
    ]);
    if (!tournament || tournament.status !== 'UPCOMING' || tournament.teams.length || friend?.friendOwnerId !== req.user!.id) {
      res.status(400).json({ success: false, error: 'Không thể hủy tham gia cho cầu thủ này' });
      return;
    }
    const attendance = await prisma.tournamentPlayerAttendance.update({
      where: { tournamentId_playerId: { tournamentId: req.params.id, playerId: friend.id } },
      data: { status: 'NULL', field5: false, field7: false, withWater: false, bet: false },
    });
    await prisma.tournamentChallenge.updateMany({ where: { tournamentId: req.params.id, status: { in: ['PENDING', 'ACCEPTED'] }, OR: [{ requesterPlayerId: friend.id }, { targetPlayerId: friend.id }] }, data: { status: 'CANCELLED', respondedAt: new Date() } });
    res.json({ success: true, data: attendance });
  } catch (_error) { res.status(500).json({ success: false, error: 'Không thể hủy tham gia cho bạn' }); }
});

router.put('/:id/attendance', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: tournamentId } = req.params;
    const userId = req.user!.id;
    const { status, withWater, bet, field5, field7, playerId, toggleWater, toggleBet } = req.body;
    const isStaffRegisteringForPlayer = Boolean(playerId && ['ADMIN', 'MOD'].includes(req.user!.role || ''));

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

    if (tournament.selfFunded && (toggleWater || toggleBet || withWater !== undefined || bet !== undefined)) {
      res.status(400).json({ success: false, error: 'Giải tự túc không hỗ trợ Uống nước hoặc Ngôi sao hy vọng' });
      return;
    }

    if (tournament.isTest && (toggleWater || toggleBet || withWater !== undefined || bet !== undefined)) {
      res.status(400).json({ success: false, error: 'Giải TEST không hỗ trợ Uống nước hoặc Ngôi sao hy vọng' });
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
          registeredAt: currentAttendance?.status === 'ATTEND' ? currentAttendance.registeredAt : new Date(),
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
      if (!['UPCOMING', 'ONGOING'].includes(tournament.status) || tournament.startDate.getTime() <= Date.now()) {
        res.status(400).json({
          success: false,
          error: 'Chỉ được thay đổi Ngôi sao hy vọng trước thời gian diễn ra giải đấu',
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
          registeredAt: currentAttendance?.status === 'ATTEND' ? currentAttendance.registeredAt : new Date(),
        },
      });

      res.json({
        success: true,
        data: attendance,
      });
      return;
    }

    if (status === 'ATTEND' && !tournament.selfFunded && req.user!.role === 'USER' && targetPlayerId === userId && player.money < 0) {
      if (!(await hasNonNegativeAvailableBalance(player.id, player.money))) {
        res.status(400).json({
          success: false,
          error: 'Số dư hiện tại cộng tiền nạp chờ duyệt vẫn âm, vui lòng thanh toán trước khi đăng ký tham gia',
        });
        return;
      }
    }

    if (status === 'ATTEND' && field5 === false && field7 === false) {
      res.status(400).json({ success: false, error: 'Vui lòng chọn ít nhất một sân' });
      return;
    }

    const existingAttendance = await prisma.tournamentPlayerAttendance.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId: player.id } },
      select: { status: true, field5: true, field7: true },
    });

    if (
      req.user!.role === 'USER'
      && existingAttendance?.status === 'ATTEND'
      && (status !== 'ATTEND'
        || (field5 === false && existingAttendance.field5)
        || (field7 === false && existingAttendance.field7))
      && Date.now() > getTournamentCancellationDeadline(tournament).getTime()
    ) {
      res.status(400).json({
        success: false,
        error: 'Đã quá thời gian chốt hủy, bạn không thể hủy tham gia',
      });
      return;
    }

    const addsField5 = status === 'ATTEND' && existingAttendance?.status === 'ATTEND' && field5 === true && !existingAttendance.field5;
    const addsField7 = status === 'ATTEND' && existingAttendance?.status === 'ATTEND' && field7 === true && !existingAttendance.field7;
    if ((addsField5 || addsField7) && !await hasAttendanceCapacity(tournamentId, tournament.maxAttendance, addsField5, addsField7)) {
      res.status(400).json({ success: false, error: `Giải đấu đã đạt giới hạn ${tournament.maxAttendance} cầu thủ điểm danh` });
      return;
    }

    if (status === 'ATTEND' && existingAttendance?.status !== 'ATTEND' && !await hasAttendanceCapacity(tournamentId, tournament.maxAttendance, field5 ?? true, field7 ?? true)) {
      res.status(400).json({ success: false, error: `Giải đấu đã đạt giới hạn ${tournament.maxAttendance} cầu thủ điểm danh` });
      return;
    }

    // Prepare update data for regular attendance update
    const updateData: any = { status };
    if (status === 'ATTEND' && existingAttendance?.status !== 'ATTEND') {
      updateData.registeredAt = new Date();
      if (isStaffRegisteringForPlayer) updateData.addedById = req.user!.id;
    }
    if (withWater !== undefined) {
      updateData.withWater = withWater;
    }
    if (bet !== undefined) {
      updateData.bet = bet;
    }
    if (field5 !== undefined) updateData.field5 = field5;
    if (field7 !== undefined) updateData.field7 = field7;

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
        field5: field5 ?? true,
        field7: field7 ?? true,
        registeredAt: status === 'ATTEND' ? new Date() : null,
        addedById: status === 'ATTEND' && isStaffRegisteringForPlayer ? req.user!.id : null,
      },
    });

    // A player who leaves the tournament can no longer keep an open challenge.
    if (status !== 'ATTEND') {
      await prisma.tournamentChallenge.updateMany({
        where: {
          tournamentId,
          status: { in: ['PENDING', 'ACCEPTED'] },
          OR: [{ requesterPlayerId: player.id }, { targetPlayerId: player.id }],
        },
        data: { status: 'CANCELLED', respondedAt: new Date() },
      });
    }

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
      prisma.tournament.findUnique({ where: { id: tournamentId }, select: { id: true, maxAttendance: true } }),
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
    if (!await hasAttendanceCapacity(tournamentId, tournament.maxAttendance, true, true, pendingPlayerIds.length)) {
      res.status(400).json({ success: false, error: `Giải đấu đã đạt giới hạn ${tournament.maxAttendance} cầu thủ điểm danh` });
      return;
    }

    await prisma.$transaction(
      pendingPlayerIds.map(playerId => prisma.tournamentPlayerAttendance.upsert({
        where: { tournamentId_playerId: { tournamentId, playerId } },
        // Staff registration follows the same default as a player's own
        // registration: participate in both Sân 5 and Sân 7.
        update: { status: 'ATTEND', field5: true, field7: true, registeredAt: new Date(), addedById: req.user!.id },
        create: { tournamentId, playerId, status: 'ATTEND', field5: true, field7: true, registeredAt: new Date(), addedById: req.user!.id },
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
    const { status, withWater, bet, field5, field7, notOnField } = updateAttendanceSchema.parse(req.body);

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

    if (tournament.selfFunded && (withWater !== undefined || bet !== undefined)) {
      res.status(400).json({ success: false, error: 'Giải tự túc không hỗ trợ Uống nước hoặc Ngôi sao hy vọng' });
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

    const existingAttendance = await prisma.tournamentPlayerAttendance.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId } },
      select: { status: true },
    });

    if (status === 'ATTEND' && existingAttendance?.status !== 'ATTEND' && !await hasAttendanceCapacity(tournamentId, tournament.maxAttendance, field5 ?? true, field7 ?? true)) {
      res.status(400).json({ success: false, error: `Giải đấu đã đạt giới hạn ${tournament.maxAttendance} cầu thủ điểm danh` });
      return;
    }

    // Prepare update data
    const updateData: any = { status };
    if (status === 'ATTEND' && existingAttendance?.status !== 'ATTEND') {
      updateData.registeredAt = new Date();
      updateData.addedById = req.user!.id;
    }
    if (withWater !== undefined) {
      updateData.withWater = withWater;
    }
    if (bet !== undefined) {
      updateData.bet = bet;
    }
    if (field5 !== undefined) updateData.field5 = field5;
    if (field7 !== undefined) updateData.field7 = field7;
    if (notOnField !== undefined) updateData.notOnField = notOnField;

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
        field5: field5 ?? true,
        field7: field7 ?? true,
        notOnField: notOnField ?? false,
        registeredAt: status === 'ATTEND' ? new Date() : null,
        addedById: status === 'ATTEND' ? req.user!.id : null,
      },
    });

    // Staff cancelling a player's attendance must also cancel that player's open challenges.
    if (status !== 'ATTEND') {
      await prisma.tournamentChallenge.updateMany({
        where: {
          tournamentId,
          status: { in: ['PENDING', 'ACCEPTED'] },
          OR: [{ requesterPlayerId: playerId }, { targetPlayerId: playerId }],
        },
        data: { status: 'CANCELLED', respondedAt: new Date() },
      });
    }

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
router.get('/:id/attendance-stats', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Count only active players so this matches the roster returned by
    // /attendance-details; inactive players must not inflate nullCount.
    const totalPlayers = await prisma.player.count({ where: { isActive: true } });

    // Get attendance statistics
    const attendanceStats = await prisma.tournamentPlayerAttendance.findMany({
      where: { tournamentId },
      select: { status: true, bet: true, field5: true, field7: true, notOnField: true },
    });

    const attendingCount = attendanceStats.filter((a: any) => a.status === 'ATTEND').length;
    const field5Count = attendanceStats.filter((a: any) => a.status === 'ATTEND' && a.field5).length;
    const field7Count = attendanceStats.filter((a: any) => a.status === 'ATTEND' && a.field7).length;
    const notAttendingCount = attendanceStats.filter((a: any) => a.status === 'NOT_ATTEND').length;
    // Players without a record are also awaiting a response.
    const nullCount = totalPlayers - attendingCount - notAttendingCount;
    const bettingCount = attendanceStats.filter((a: any) => a.bet === true).length;

    res.json({
      success: true,
      data: {
        totalPlayers,
        attendingCount,
        field5Count,
        field7Count,
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
router.get('/:id/attendance-details', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    const [players, attendanceRecords, swapRequests, challenges, friendInvites] = await Promise.all([
      prisma.player.findMany({
        where: { isActive: true },
        select: {
          id: true, name: true, position: true, positionSecond: true, tier: true, avatar: true, friendOwnerId: true,
          friendOwner: { select: { player: { select: { name: true } } } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.tournamentPlayerAttendance.findMany({
        where: { tournamentId },
        include: { addedBy: { select: { username: true } } },
      }),
      prisma.tournamentSwapRequest.findMany({
        where: { tournamentId, status: { in: ['PENDING', 'WAITING', 'ACCEPTED'] } },
        select: {
          id: true,
          requesterPlayerId: true,
          targetPlayerId: true,
          status: true,
          requester: { select: { name: true } },
          target: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.tournamentChallenge.findMany({
        where: { tournamentId, status: { in: ['PENDING', 'ACCEPTED'] } },
        select: { id: true, requesterPlayerId: true, targetPlayerId: true, status: true },
      }),
      prisma.tournamentFriendInvite.findMany({
        where: { tournamentId, status: { in: ['PENDING', 'ACCEPTED'] } },
        select: { id: true, requesterPlayerId: true, targetPlayerId: true, status: true },
      }),
    ]);
    const attendanceByPlayerId = new Map(attendanceRecords.map(record => [record.playerId, record]));
    const pendingSwapPlayerIds = new Set(swapRequests.filter(request => request.status === 'PENDING').map(request => request.requesterPlayerId));
    const pendingSwapRequestIds = new Map(swapRequests.filter(request => request.status === 'PENDING').map(request => [request.requesterPlayerId, request.id]));
    const waitlistPositions = new Map(
      swapRequests
        .filter(request => request.status === 'WAITING')
        .map((request, index) => [request.requesterPlayerId, index + 1]),
    );
    const swappedWithByPlayerId = new Map<string, string>();
    const challengeByPlayerId = new Map<string, { id: string; status: string; opponentPlayerId: string; direction: 'SENT' | 'RECEIVED' }>();
    for (const challenge of challenges) {
      challengeByPlayerId.set(challenge.requesterPlayerId, { id: challenge.id, status: challenge.status, opponentPlayerId: challenge.targetPlayerId, direction: 'SENT' });
      challengeByPlayerId.set(challenge.targetPlayerId, { id: challenge.id, status: challenge.status, opponentPlayerId: challenge.requesterPlayerId, direction: 'RECEIVED' });
    }
    const friendInviteByPlayerId = new Map<string, { id: string; status: string; opponentPlayerId: string; direction: 'SENT' | 'RECEIVED' }>();
    for (const invite of friendInvites) {
      friendInviteByPlayerId.set(invite.requesterPlayerId, { id: invite.id, status: invite.status, opponentPlayerId: invite.targetPlayerId, direction: 'SENT' });
      friendInviteByPlayerId.set(invite.targetPlayerId, { id: invite.id, status: invite.status, opponentPlayerId: invite.requesterPlayerId, direction: 'RECEIVED' });
    }
    for (const request of swapRequests.filter(request => request.status === 'ACCEPTED')) {
      const requesterAttendance = attendanceByPlayerId.get(request.requesterPlayerId);
      const targetAttendance = attendanceByPlayerId.get(request.targetPlayerId);
      const requesterStillInSelectedField = requesterAttendance?.status === 'ATTEND'
        && (!tournament.pitchType || (tournament.pitchType === 'FIELD_5' ? requesterAttendance.field5 : requesterAttendance.field7));
      const targetInSelectedField = targetAttendance?.status === 'ATTEND'
        && (!tournament.pitchType || (tournament.pitchType === 'FIELD_5' ? targetAttendance.field5 : targetAttendance.field7));
      if (requesterStillInSelectedField) {
        swappedWithByPlayerId.set(request.requesterPlayerId, request.target.name);
      } else if (targetInSelectedField) {
        swappedWithByPlayerId.set(request.targetPlayerId, request.requester.name);
      }
    }
    const attendanceDetails = players.map((player) => {
      const attendance = attendanceByPlayerId.get(player.id);
      return {
        ...(attendance || {
        id: `pending-${player.id}`,
        tournamentId,
        playerId: player.id,
        status: 'NULL',
        withWater: false,
        bet: false,
        createdAt: tournament.createdAt,
        updatedAt: tournament.updatedAt,
        player,
        }),
        swapPending: pendingSwapPlayerIds.has(player.id),
        swapRequestId: pendingSwapRequestIds.get(player.id) || null,
        swapWaitlistPosition: waitlistPositions.get(player.id) || null,
        swappedWithName: swappedWithByPlayerId.get(player.id) || null,
        challenge: challengeByPlayerId.get(player.id) || null,
        friendInvite: friendInviteByPlayerId.get(player.id) || null,
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

export { router as tournamentAttendanceRoutes };
