import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { createTeamSchema, updateTeamSchema, paginationSchema } from '../schemas/validation';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all teams with pagination
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const skip = (page - 1) * limit;

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        skip,
        take: limit,
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
          _count: {
            select: {
              players: true,
              tournaments: true,
              homeMatches: true,
              awayMatches: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.team.count(),
    ]);

    res.json({
      success: true,
      data: {
        teams,
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

// Get team by ID
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        players: {
          include: {
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
        },
        stats: true,
        tournaments: {
          include: {
            tournament: {
              select: {
                id: true,
                name: true,
                type: true,
                status: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
        homeMatches: {
          include: {
            awayTeam: { select: { name: true } },
            tournament: { select: { name: true } },
          },
          orderBy: {
            scheduledDate: 'desc',
          },
          take: 5,
        },
        awayMatches: {
          include: {
            homeTeam: { select: { name: true } },
            tournament: { select: { name: true } },
          },
          orderBy: {
            scheduledDate: 'desc',
          },
          take: 5,
        },
      },
    });

    if (!team) {
      res.status(404).json({
        success: false,
        error: 'Team not found',
      });
      return;
    }

    res.json({
      success: true,
      data: team,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team',
    });
  }
});

// Create new team
router.post('/', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const teamData = createTeamSchema.parse(req.body);

    // Check if team name already exists
    const existingTeam = await prisma.team.findUnique({
      where: { name: teamData.name },
    });

    if (existingTeam) {
      res.status(400).json({
        success: false,
        error: 'Team with this name already exists',
      });
      return;
    }

    const team = await prisma.team.create({
      data: {
        ...teamData,
        stats: {
          create: {}, // Create empty stats
        },
      },
      include: {
        players: true,
        stats: true,
      },
    });

    res.status(201).json({
      success: true,
      data: team,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid team data',
    });
  }
});

// Update team
router.put('/:id', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = updateTeamSchema.parse(req.body);

    const existingTeam = await prisma.team.findUnique({
      where: { id },
    });

    if (!existingTeam) {
      res.status(404).json({
        success: false,
        error: 'Team not found',
      });
      return;
    }

    // Check if new name conflicts with existing team
    if (updateData.name && updateData.name !== existingTeam.name) {
      const nameConflict = await prisma.team.findUnique({
        where: { name: updateData.name },
      });

      if (nameConflict) {
        res.status(400).json({
          success: false,
          error: 'Team with this name already exists',
        });
        return;
      }
    }

    const team = await prisma.team.update({
      where: { id },
      data: updateData,
      include: {
        players: true,
        stats: true,
      },
    });

    res.json({
      success: true,
      data: team,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid team data',
    });
  }
});

// Delete team
router.delete('/:id', authenticate, authorize(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingTeam = await prisma.team.findUnique({
      where: { id },
      include: {
        players: true,
        tournaments: true,
        homeMatches: true,
        awayMatches: true,
      },
    });

    if (!existingTeam) {
      res.status(404).json({
        success: false,
        error: 'Team not found',
      });
      return;
    }

    // Check if team has active tournaments or matches
    const hasActiveData = existingTeam.tournaments.length > 0 || 
                         existingTeam.homeMatches.length > 0 || 
                         existingTeam.awayMatches.length > 0;

    if (hasActiveData) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete team with active tournaments or matches',
      });
      return;
    }

    // Remove players from team before deletion
    await prisma.player.updateMany({
      where: { teamId: id },
      data: { teamId: null },
    });

    await prisma.team.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Team deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete team',
    });
  }
});

// Add player to team
router.post('/:id/players/:playerId', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, playerId } = req.params;

    const [team, player] = await Promise.all([
      prisma.team.findUnique({ where: { id } }),
      prisma.player.findUnique({ where: { id: playerId } }),
    ]);

    if (!team) {
      res.status(404).json({
        success: false,
        error: 'Team not found',
      });
      return;
    }

    if (!player) {
      res.status(404).json({
        success: false,
        error: 'Player not found',
      });
      return;
    }

    const updatedPlayer = await prisma.player.update({
      where: { id: playerId },
      data: { teamId: id },
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

    res.json({
      success: true,
      data: updatedPlayer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add player to team',
    });
  }
});

// Remove player from team
router.delete('/:id/players/:playerId', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, playerId } = req.params;

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

    if (player.teamId !== id) {
      res.status(400).json({
        success: false,
        error: 'Player is not on this team',
      });
      return;
    }

    const updatedPlayer = await prisma.player.update({
      where: { id: playerId },
      data: { teamId: null },
    });

    res.json({
      success: true,
      data: updatedPlayer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to remove player from team',
    });
  }
});

export { router as teamRoutes };
