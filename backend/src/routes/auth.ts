import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '../lib/prisma';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '../schemas/validation';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const hashResetToken = (token: string) => createHash('sha256').update(token).digest('hex');

async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error('Chưa cấu hình dịch vụ gửi email');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Đặt lại mật khẩu Cú Đêm',
      html: `<p>Bạn vừa yêu cầu đặt lại mật khẩu Cú Đêm.</p><p><a href="${resetUrl}">Đặt lại mật khẩu</a></p><p>Liên kết này có hiệu lực trong 60 phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>`,
    }),
  });

  if (!response.ok) {
    throw new Error('Không thể gửi email đặt lại mật khẩu');
  }
}

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

// Request password reset. The response intentionally does not reveal whether an email exists.
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.isActive) {
      const token = randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: hashResetToken(token),
          passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
        },
      });

      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
      await sendPasswordResetEmail(email, `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`);
    }

    res.json({ success: true, message: 'Nếu email tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể xử lý yêu cầu đặt lại mật khẩu';
    const status = message === 'Chưa cấu hình dịch vụ gửi email' ? 503 : 400;
    res.status(status).json({ success: false, error: message });
  }
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
