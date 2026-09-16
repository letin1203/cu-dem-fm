import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { createPlayerSchema, updatePlayerSchema, playerQuerySchema } from '../schemas/validation';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';
import { AVATAR_PATHS, getRandomAvatar } from '../lib/avatars';

const router = Router();

// Friends are players created and financially sponsored by a user (maximum two).
router.get('/friends/mine', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const friends = await prisma.player.findMany({
    where: { friendOwnerId: req.user!.id },
    include: { stats: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: friends });
});

router.post('/friends', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const count = await prisma.player.count({ where: { friendOwnerId: req.user!.id } });
    if (count >= 2) {
      res.status(400).json({ success: false, error: 'Mỗi user chỉ được tạo tối đa 2 bạn' });
      return;
    }
    const playerData = createPlayerSchema.omit({ money: true }).parse(req.body);
    const player = await prisma.player.create({
      data: { ...playerData, money: 0, avatar: playerData.avatar || getRandomAvatar(), friendOwnerId: req.user!.id, stats: { create: {} } },
      include: { stats: true },
    });
    res.status(201).json({ success: true, data: player });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Không thể tạo bạn mới' });
  }
});

// A user may edit only the friends they created. Friends do not own a balance,
// so this route deliberately excludes money and ownership fields.
router.put('/friends/:id', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const friend = await prisma.player.findFirst({ where: { id, friendOwnerId: req.user!.id } });
    if (!friend) {
      res.status(404).json({ success: false, error: 'Không tìm thấy cầu thủ bạn bè' });
      return;
    }
    const updateData = updatePlayerSchema
      .pick({ name: true, position: true, positionSecond: true, yearOfBirth: true, tier: true, avatar: true, teamId: true })
      .parse(req.body);
    const updatedFriend = await prisma.player.update({ where: { id }, data: updateData, include: { stats: true } });
    res.json({ success: true, data: updatedFriend });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Không thể cập nhật cầu thủ bạn bè' });
  }
});

router.get('/friends', authenticate, authorize(['ADMIN', 'MOD']), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    where: { friends: { some: {} } },
    select: { id: true, username: true, email: true, player: { select: { id: true, name: true, money: true } }, friends: { include: { stats: true }, orderBy: { name: 'asc' } } },
    orderBy: { username: 'asc' },
  });
  res.json({ success: true, data: users });
});

// Get all players with pagination and filters
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, teamId, position, tier } = playerQuerySchema.parse(req.query);
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };
    if (teamId) where.teamId = teamId;
    if (position) where.position = { contains: position, mode: 'insensitive' };
    if (tier) where.tier = tier;

    const [players, total] = await Promise.all([
      prisma.player.findMany({
        where,
        skip,
        take: limit,
        include: {
          team: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
          stats: true,
          user: {
            select: {
              id: true,
              username: true,
              role: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.player.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        players,
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

// Inactive players are hidden from the normal list and can be restored by staff.
router.get('/inactive', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '10'), 10) || 10));
    const skip = (page - 1) * limit;
    const where = { isActive: false };
    const [players, total] = await Promise.all([
      prisma.player.findMany({ where, skip, take: limit, include: { stats: true, user: { select: { id: true, username: true, role: true } } }, orderBy: { name: 'asc' } }),
      prisma.player.count({ where }),
    ]);
    res.json({ success: true, data: { players, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Không thể tải cầu thủ inactive' });
  }
});

router.put('/inactive/:id/activate', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const player = await prisma.player.update({ where: { id: req.params.id }, data: { isActive: true }, include: { stats: true } });
    res.json({ success: true, data: player });
  } catch (error) {
    res.status(404).json({ success: false, error: 'Không tìm thấy cầu thủ inactive' });
  }
});

// Get paginated money-change history for a player
router.get('/:id/money-history', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '10'), 10) || 10));
    const skip = (page - 1) * limit;

    const [history, total] = await Promise.all([
      prisma.playerMoneyHistory.findMany({
        where: { playerId: id },
        include: { tournament: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.playerMoneyHistory.count({ where: { playerId: id } }),
    ]);

    const historyWithApprover = history.map((entry) => {
      const details = entry.details;
      const approvedByUsername = details && !Array.isArray(details) && typeof details === 'object'
        && typeof (details as Record<string, unknown>).approvedByUsername === 'string'
        ? (details as Record<string, string>).approvedByUsername
        : null;
      return { ...entry, approvedByUsername };
    });

    res.json({
      success: true,
      data: {
        history: historyWithApprover,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch money history' });
  }
});

// Staff can record a manual deduction. It is stored as money history for auditing.
router.post('/:id/deduct-money', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const amount = Number(req.body?.amount);
    const reason = String(req.body?.reason || '').trim();
    if (!Number.isInteger(amount) || amount <= 0) {
      res.status(400).json({ success: false, error: 'Số tiền trừ không hợp lệ' });
      return;
    }
    if (!reason) {
      res.status(400).json({ success: false, error: 'Vui lòng nhập lý do trừ tiền' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: req.params.id } });
      if (!player) throw new Error('Không tìm thấy cầu thủ');

      const balanceAfter = player.money - amount;
      const updatedPlayer = await tx.player.update({ where: { id: player.id }, data: { money: balanceAfter } });
      const history = await tx.playerMoneyHistory.create({
        data: {
          playerId: player.id,
          amount: -amount,
          balanceBefore: player.money,
          balanceAfter,
          description: reason,
        },
      });
      return { player: updatedPlayer, history };
    });

    res.json({ success: true, data: result, message: 'Đã trừ tiền cầu thủ' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể trừ tiền cầu thủ';
    res.status(message === 'Không tìm thấy cầu thủ' ? 404 : 500).json({ success: false, error: message });
  }
});

// Get the tournaments a player attended, newest first.
router.get('/:id/tournament-history', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const attendances = await prisma.tournamentPlayerAttendance.findMany({
      where: {
        playerId: id,
        status: { in: ['ATTEND', 'ATTENDING'] },
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            startDate: true,
            endDate: true,
            completedAt: true,
            winner: { select: { id: true, name: true } },
            teams: { select: { team: { select: { id: true, name: true, score: true } } } },
            tournamentTeamPlayers: {
              where: { playerId: id },
              select: { team: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: { tournament: { startDate: 'desc' } },
    });

    res.json({ success: true, data: attendances });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Không thể tải lịch sử giải đấu của cầu thủ' });
  }
});

// Get player by ID
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const player = await prisma.player.findUnique({
      where: { id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
        stats: true,
        user: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
        matchEvents: {
          include: {
            match: {
              select: {
                id: true,
                homeTeam: { select: { name: true } },
                awayTeam: { select: { name: true } },
                scheduledDate: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
        moneyHistory: {
          include: {
            tournament: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!player) {
      res.status(404).json({
        success: false,
        error: 'Player not found',
      });
      return;
    }

    res.json({
      success: true,
      data: player,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch player',
    });
  }
});

// Create new player
router.post('/', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const playerData = createPlayerSchema.parse(req.body);

    const player = await prisma.player.create({
      data: {
        ...playerData,
        avatar: playerData.avatar || getRandomAvatar(),
        stats: {
          create: {}, // Create empty stats
        },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
        stats: true,
      },
    });

    res.status(201).json({
      success: true,
      data: player,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid player data',
    });
  }
});

// Let a user update only the avatar of their own linked player.
router.put('/:id/avatar', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { avatar } = req.body as { avatar?: unknown };
    if (typeof avatar !== 'string' || !AVATAR_PATHS.includes(avatar as typeof AVATAR_PATHS[number])) {
      res.status(400).json({ success: false, error: 'Avatar không hợp lệ' });
      return;
    }

    const player = await prisma.player.findUnique({
      where: { id },
      select: { user: { select: { id: true } } },
    });
    if (!player) {
      res.status(404).json({ success: false, error: 'Không tìm thấy cầu thủ' });
      return;
    }
    if (player.user?.id !== req.user!.id && !['ADMIN', 'MOD'].includes(req.user!.role)) {
      res.status(403).json({ success: false, error: 'Bạn không có quyền đổi avatar cầu thủ này' });
      return;
    }

    const updatedPlayer = await prisma.player.update({ where: { id }, data: { avatar } });
    res.json({ success: true, data: updatedPlayer });
  } catch (error) {
    console.error('Update player avatar error:', error);
    res.status(500).json({ success: false, error: 'Không thể cập nhật avatar' });
  }
});

// A user may correct the birth year of their own linked player.
router.put('/:id/year-of-birth', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const yearOfBirth = Number(req.body?.yearOfBirth);
    if (!Number.isInteger(yearOfBirth) || yearOfBirth < 1975 || yearOfBirth > 2010) {
      res.status(400).json({ success: false, error: 'Năm sinh phải từ 1975 đến 2010' });
      return;
    }
    const player = await prisma.player.findUnique({ where: { id }, select: { user: { select: { id: true } } } });
    if (!player) {
      res.status(404).json({ success: false, error: 'Không tìm thấy cầu thủ' });
      return;
    }
    if (player.user?.id !== req.user!.id) {
      res.status(403).json({ success: false, error: 'Bạn chỉ có thể chỉnh sửa năm sinh của chính mình' });
      return;
    }
    const updatedPlayer = await prisma.player.update({ where: { id }, data: { yearOfBirth } });
    res.json({ success: true, data: updatedPlayer });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Không thể cập nhật năm sinh' });
  }
});

// Update player
router.put('/:id', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = updatePlayerSchema.parse(req.body);

    const existingPlayer = await prisma.player.findUnique({
      where: { id },
    });

    if (!existingPlayer) {
      res.status(404).json({
        success: false,
        error: 'Player not found',
      });
      return;
    }

    const player = await prisma.$transaction(async (tx) => {
      const updatedPlayer = await tx.player.update({
        where: { id },
        data: updateData,
        include: {
          team: {
            select: {
              id: true,
              name: true,
              logo: true,
            },
          },
          stats: true,
        },
      });

      if (updateData.money !== undefined && updateData.money !== existingPlayer.money) {
        await tx.playerMoneyHistory.create({
          data: {
            playerId: id,
            amount: updateData.money - existingPlayer.money,
            balanceBefore: existingPlayer.money,
            balanceAfter: updateData.money,
            description: 'Điều chỉnh số dư thủ công',
          },
        });
      }

      return updatedPlayer;
    });

    res.json({
      success: true,
      data: player,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid player data',
    });
  }
});

// Delete player
router.delete('/:id', authenticate, authorize(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingPlayer = await prisma.player.findUnique({
      where: { id },
    });

    if (!existingPlayer) {
      res.status(404).json({
        success: false,
        error: 'Player not found',
      });
      return;
    }

    await prisma.player.update({ where: { id }, data: { isActive: false } });

    res.json({
      success: true,
      message: 'Player marked as inactive successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete player',
    });
  }
});

// Update player stats
router.put('/:id/stats', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      gamesPlayed,
      goals,
      assists,
      yellowCards,
      redCards,
      minutesPlayed,
    } = req.body;

    const existingPlayer = await prisma.player.findUnique({
      where: { id },
      include: { stats: true },
    });

    if (!existingPlayer) {
      res.status(404).json({
        success: false,
        error: 'Player not found',
      });
      return;
    }

    const stats = await prisma.playerStats.upsert({
      where: { playerId: id },
      update: {
        gamesPlayed: gamesPlayed ?? undefined,
        goals: goals ?? undefined,
        assists: assists ?? undefined,
        yellowCards: yellowCards ?? undefined,
        redCards: redCards ?? undefined,
        minutesPlayed: minutesPlayed ?? undefined,
      },
      create: {
        playerId: id,
        gamesPlayed: gamesPlayed || 0,
        goals: goals || 0,
        assists: assists || 0,
        yellowCards: yellowCards || 0,
        redCards: redCards || 0,
        minutesPlayed: minutesPlayed || 0,
      },
    });

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to update player stats',
    });
  }
});

export { router as playerRoutes };
