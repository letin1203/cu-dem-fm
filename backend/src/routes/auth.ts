import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '../lib/prisma';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '../schemas/validation';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const hashResetToken = (token: string) => createHash('sha256').update(token).digest('hex');

// Login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        player: {
          include: {
            stats: true,
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

    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
      return;
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          player: user.player,
        },
        token,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request data',
    });
  }
});

// Register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password, role } = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email },
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

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: role || 'USER',
      },
    });

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request data',
    });
  }
});

// Request a manual password reset approval. No email is sent.
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.isActive) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetStatus: 'CHANGE_PASSWORD',
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
        },
      });
    }
    res.json({ success: true, message: 'Yêu cầu đổi mật khẩu đã được gửi. Vui lòng chờ quản trị viên cấp liên kết đặt lại mật khẩu.' });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Không thể xử lý yêu cầu đặt lại mật khẩu' });
  }
});

router.get('/password-reset-requests', authenticate, authorize(['ADMIN']), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    where: { passwordResetStatus: 'CHANGE_PASSWORD' },
    select: { id: true, username: true, email: true, player: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ success: true, data: users });
});

router.post('/password-reset-requests/:id/link', authenticate, authorize(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findFirst({ where: { id: req.params.id, passwordResetStatus: 'CHANGE_PASSWORD' } });
  if (!user) { res.status(404).json({ success: false, error: 'Yêu cầu đổi mật khẩu không tồn tại.' }); return; }
  const token = randomBytes(32).toString('hex');
  await prisma.user.update({ where: { id: user.id }, data: { passwordResetTokenHash: hashResetToken(token), passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS) } });
  const frontendUrl = (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
  const link = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}&username=${encodeURIComponent(user.username)}`;
  res.json({ success: true, data: { link } });
});

// Reset a password using the one-time, time-limited token from the email.
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: {
        passwordResetTokenHash: hashResetToken(token),
        passwordResetExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      res.status(400).json({ success: false, error: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(password, 12),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        passwordResetStatus: 'NONE',
      },
    });
    res.json({ success: true, message: 'Đặt lại mật khẩu thành công.' });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Không thể đặt lại mật khẩu' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        player: {
          select: {
            id: true,
            name: true,
            position: true,
            yearOfBirth: true,
            tier: true,
            money: true,
            avatar: true,
            teamId: true,
            stats: {
              select: {
                gamesPlayed: true,
                goals: true,
                assists: true,
                yellowCards: true,
                redCards: true,
                minutesPlayed: true,
              },
            },
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
      error: 'Failed to fetch user data',
    });
  }
});

// Logout (token blacklisting would be implemented with Redis)
router.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // In a real implementation, you would add the token to a blacklist in Redis
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

export { router as authRoutes };
