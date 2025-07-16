import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { updateUserSchema, paginationSchema } from '../schemas/validation';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all users (Admin only)
router.get('/', authenticate, authorize(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const { role, isActive } = req.query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
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
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        users,
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

// Create user (Admin only)
router.post('/', authenticate, authorize(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { username, email, password, role, playerId, isActive } = req.body;

    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: 'Username and password are required',
      });
      return;
    }

    // Auto-generate email if not provided
    const userEmail = email || `${username}@football.com`;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email: userEmail },
        ],
      },
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        error: 'User with this username or email already exists',
      });
      return;
    }

    // Validate player assignment if provided
    if (playerId) {
      const player = await prisma.player.findUnique({
        where: { id: playerId },
        include: { user: true },
      });

      if (!player) {
        res.status(400).json({
          success: false,
          error: 'Player not found',
        });
        return;
      }

      if (player.user) {
        res.status(400).json({
          success: false,
          error: 'Player is already linked to another user',
        });
        return;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username,
        email: userEmail,
        password: hashedPassword,
        role: role || 'USER',
        isActive: isActive !== undefined ? isActive : true,
        playerId: playerId || undefined,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
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
    });

    res.status(201).json({
      success: true,
      data: user,
      message: 'User created successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid user data',
    });
  }
});

// Get user by ID
router.get('/:id', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Users can only view their own profile unless they're admin/mod
    if (req.user!.role === 'USER' && req.user!.id !== id) {
      res.status(403).json({
        success: false,
        error: 'You can only view your own profile',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        player: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                logo: true,
              },
            },
            stats: true,
            matchEvents: {
              include: {
                match: {
                  select: {
                    id: true,
                    homeTeam: { select: { name: true } },
                    awayTeam: { select: { name: true } },
                    scheduledDate: true,
                    tournament: { select: { name: true } },
                  },
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
              take: 10,
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
    });
  }
});

// Update user
router.put('/:id', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = updateUserSchema.parse(req.body);

    // Users can only update their own profile unless they're admin
    if (req.user!.role !== 'ADMIN' && req.user!.id !== id) {
      res.status(403).json({
        success: false,
        error: 'You can only update your own profile',
      });
      return;
    }

    // Only admins can change roles and active status
    if (req.user!.role !== 'ADMIN') {
      delete updateData.role;
      delete updateData.isActive;
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Check for username/email conflicts
    if (updateData.username || updateData.email) {
      const conflicts = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                updateData.username ? { username: updateData.username } : {},
                updateData.email ? { email: updateData.email } : {},
              ].filter(condition => Object.keys(condition).length > 0),
            },
          ],
        },
      });

      if (conflicts) {
        res.status(400).json({
          success: false,
          error: 'Username or email already exists',
        });
        return;
      }
    }

    // Validate player assignment if provided
    if (updateData.playerId !== undefined) {
      if (updateData.playerId) {
        // Check if player exists
        const player = await prisma.player.findUnique({
          where: { id: updateData.playerId },
          include: { user: true },
        });

        if (!player) {
          res.status(400).json({
            success: false,
            error: 'Player not found',
          });
          return;
        }

        // Check if player is already linked to another user
        if (player.user && player.user.id !== id) {
          res.status(400).json({
            success: false,
            error: 'Player is already linked to another user',
          });
          return;
        }
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
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
    });

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid user data',
    });
  }
});

// Delete user (Admin only)
router.delete('/:id', authenticate, authorize(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (req.user!.id === id) {
      res.status(400).json({
        success: false,
        error: 'You cannot delete your own account',
      });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: {
        player: true,
      },
    });

    if (!existingUser) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // If user has a player, remove the connection
    if (existingUser.player) {
      await prisma.player.update({
        where: { id: existingUser.player.id },
        data: { user: { disconnect: true } },
      });
    }

    await prisma.user.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
    });
  }
});

// Activate/Deactivate user (Admin only)
router.patch('/:id/status', authenticate, authorize(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      res.status(400).json({
        success: false,
        error: 'isActive must be a boolean value',
      });
      return;
    }

    if (req.user!.id === id) {
      res.status(400).json({
        success: false,
        error: 'You cannot change your own active status',
      });
      return;
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    res.json({
      success: true,
      data: user,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update user status',
    });
  }
});

// Create bulk user+player (Admin only)
router.post('/bulk-user-player', authenticate, authorize(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Generate random names
    const firstNames = ['Alex', 'Jordan', 'Taylor', 'Cameron', 'Morgan', 'Casey', 'Riley', 'Drew', 'Sage', 'Rowan'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    
    const randomFirstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const randomLastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const playerName = `${randomFirstName} ${randomLastName}`;
    
    // Generate random username
    const randomNum = Math.floor(Math.random() * 10000);
    const username = `user${randomNum}`;
    
    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });
    
    if (existingUser) {
      res.status(400).json({
        success: false,
        error: 'Generated username already exists. Please try again.',
      });
      return;
    }
    
    // Check if player name already exists
    const existingPlayer = await prisma.player.findUnique({
      where: { name: playerName },
    });
    
    if (existingPlayer) {
      res.status(400).json({
        success: false,
        error: 'Generated player name already exists. Please try again.',
      });
      return;
    }

    // Create player first
    const player = await prisma.player.create({
      data: {
        name: playerName,
        position: 'Forward',
        yearOfBirth: 1990,
        tier: 5,
        money: 0,
      },
    });

    // Create user linked to the player
    const hashedPassword = await bcrypt.hash('123456', 12);
    const user = await prisma.user.create({
      data: {
        username,
        email: `${username}@football.com`,
        password: hashedPassword,
        role: 'USER',
        isActive: true,
        playerId: player.id,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
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
    });

    res.status(201).json({
      success: true,
      data: {
        user,
        player: {
          id: player.id,
          name: player.name,
          position: player.position,
          yearOfBirth: player.yearOfBirth,
          tier: player.tier,
          money: player.money,
        },
      },
      message: 'User and player created successfully',
    });
  } catch (error) {
    console.error('Bulk creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user and player',
    });
  }
});

export { router as userRoutes };
