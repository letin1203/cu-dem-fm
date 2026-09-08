import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { createPlayerSchema, updatePlayerSchema, playerQuerySchema } from '../schemas/validation';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all players with pagination and filters
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, teamId, position, tier } = playerQuerySchema.parse(req.query);
    const skip = (page - 1) * limit;

    const where: any = {};
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

    res.json({
      success: true,
      data: {
        history,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch money history' });
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

    await prisma.player.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Player deleted successfully',
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
