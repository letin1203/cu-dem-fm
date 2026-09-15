import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const amount = Number(req.body?.amount);
    const reason = String(req.body?.reason || '').trim();
    if (!Number.isInteger(amount) || amount <= 0) {
      res.status(400).json({ success: false, error: 'Số tiền góp quỹ không hợp lệ' });
      return;
    }
    if (!reason) {
      res.status(400).json({ success: false, error: 'Vui lòng nhập lý do góp quỹ' });
      return;
    }

    const staffContribution = ['ADMIN', 'MOD'].includes(req.user!.role);
    const contribution = await prisma.fundContribution.create({
      data: {
        userId: req.user!.id,
        amount,
        reason,
        status: staffContribution ? 'APPROVED' : 'PENDING',
        approvedAt: staffContribution ? new Date() : null,
        approvedById: staffContribution ? req.user!.id : null,
      },
      include: { user: { select: { username: true, player: { select: { name: true } } } } },
    });
    res.status(201).json({
      success: true,
      data: contribution,
      message: staffContribution ? 'Đã cộng tiền góp vào quỹ' : 'Yêu cầu góp quỹ đang chờ duyệt',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Không thể tạo yêu cầu góp quỹ' });
  }
});

router.get('/pending', authenticate, authorize(['ADMIN', 'MOD']), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const contributions = await prisma.fundContribution.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { username: true, player: { select: { name: true } } } } },
      orderBy: { requestedAt: 'asc' },
    });
    res.json({ success: true, data: contributions });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Không thể tải yêu cầu góp quỹ' });
  }
});

router.put('/:id/approve', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const contribution = await prisma.$transaction(async (tx) => {
      const pending = await tx.fundContribution.findUnique({ where: { id: req.params.id } });
      if (!pending) throw new Error('Yêu cầu góp quỹ không tồn tại');
      if (pending.status !== 'PENDING') throw new Error('Yêu cầu góp quỹ này đã được xử lý');
      return tx.fundContribution.update({
        where: { id: pending.id },
        data: { status: 'APPROVED', approvedAt: new Date(), approvedById: req.user!.id },
      });
    });
    res.json({ success: true, data: contribution, message: 'Đã duyệt góp quỹ' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể duyệt góp quỹ';
    res.status(message.includes('không tồn tại') ? 404 : 400).json({ success: false, error: message });
  }
});

export { router as fundContributionRoutes };
