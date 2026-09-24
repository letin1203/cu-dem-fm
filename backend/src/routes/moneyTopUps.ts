import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
// A logged-in player submits their own top-up request.
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      res.status(400).json({ success: false, error: 'Số tiền nạp không hợp lệ' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true } });
    if (!user?.playerId) {
      res.status(400).json({ success: false, error: 'Tài khoản chưa được liên kết với cầu thủ' });
      return;
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentPendingTopUp = await prisma.playerMoneyTopUp.findFirst({
      where: {
        playerId: user.playerId,
        status: 'PENDING',
        requestedAt: { gte: fiveMinutesAgo },
      },
      orderBy: { requestedAt: 'desc' },
      select: { requestedAt: true },
    });
    if (recentPendingTopUp) {
      const remainingSeconds = Math.max(
        1,
        Math.ceil((recentPendingTopUp.requestedAt.getTime() + 5 * 60 * 1000 - Date.now()) / 1000),
      );
      res.status(429).json({
        success: false,
        error: `Bạn vừa gửi yêu cầu nạp tiền. Vui lòng chờ ${remainingSeconds} giây trước khi nạp tiếp`,
      });
      return;
    }

    const topUp = await prisma.playerMoneyTopUp.create({
      data: { playerId: user.playerId, amount },
      include: { player: { select: { id: true, name: true } } },
    });
    res.status(201).json({ success: true, data: topUp, message: 'Yêu cầu nạp tiền đang chờ duyệt' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Không thể tạo yêu cầu nạp tiền' });
  }
});

// The signed-in player can see their own requests that are still pending.
router.get('/mine', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true } });
    if (!user?.playerId) {
      res.json({ success: true, data: { totalPending: 0, requests: [] } });
      return;
    }
    const requests = await prisma.playerMoneyTopUp.findMany({
      where: { playerId: user.playerId, status: 'PENDING' },
      select: { id: true, amount: true, requestedAt: true },
      orderBy: { requestedAt: 'desc' },
    });
    res.json({ success: true, data: { totalPending: requests.reduce((total, request) => total + request.amount, 0), requests } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Không thể tải yêu cầu nạp tiền' });
  }
});

// Lightweight polling endpoint used by an online player to be notified when
// a staff member approves or rejects a top-up. Only events after `since` are returned.
router.get('/mine/approved-notifications', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true } });
    const since = new Date(String(req.query.since || ''));
    if (!user?.playerId || Number.isNaN(since.getTime())) {
      res.json({ success: true, data: [] });
      return;
    }
    const notifications = await prisma.playerMoneyTopUp.findMany({
      where: {
        playerId: user.playerId,
        OR: [
          { status: 'APPROVED', approvedAt: { gt: since } },
          { status: 'REJECTED', rejectedAt: { gt: since } },
        ],
      },
      select: { id: true, amount: true, status: true, requestedAt: true, approvedAt: true, rejectedAt: true },
      orderBy: { requestedAt: 'asc' },
      take: 10,
    });
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Không thể kiểm tra yêu cầu nạp tiền đã duyệt' });
  }
});

// A player can cancel only their own request while it is still pending.
router.delete('/mine/:id', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true } });
    if (!user?.playerId) {
      res.status(400).json({ success: false, error: 'Tài khoản chưa liên kết cầu thủ' });
      return;
    }
    const deleted = await prisma.playerMoneyTopUp.deleteMany({
      where: { id: req.params.id, playerId: user.playerId, status: 'PENDING' },
    });
    if (!deleted.count) {
      res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu nạp tiền đang chờ duyệt' });
      return;
    }
    res.json({ success: true, message: 'Đã hủy yêu cầu nạp tiền' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Không thể hủy yêu cầu nạp tiền' });
  }
});

// Staff can add money on a player's behalf. These requests are approved immediately.
router.post('/admin', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const playerId = String(req.body?.playerId || '');
    const amount = Number(req.body?.amount);
    const reason = String(req.body?.reason || '').trim();
    // Staff may enter a custom amount in addition to the quick-select options.
    if (!playerId || !Number.isInteger(amount) || amount <= 0) {
      res.status(400).json({ success: false, error: 'Thông tin nạp tiền không hợp lệ' });
      return;
    }

    const topUp = await prisma.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: playerId } });
      if (!player) throw new Error('Cầu thủ không tồn tại');
      const balanceAfter = player.money + amount;
      await tx.player.update({ where: { id: playerId }, data: { money: balanceAfter } });
      await tx.playerMoneyHistory.create({
        data: {
          playerId,
          amount,
          balanceBefore: player.money,
          balanceAfter,
          description: reason || `Nạp tiền dùm ${player.name}`,
          details: { approvedByUsername: req.user!.username },
        },
      });
      return tx.playerMoneyTopUp.create({
        data: { playerId, amount, status: 'APPROVED', approvedAt: new Date(), approvedById: req.user!.id },
        include: { player: { select: { id: true, name: true, money: true } } },
      });
    });
    res.status(201).json({ success: true, data: topUp, message: 'Đã nạp tiền và duyệt tự động' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể nạp tiền';
    res.status(message === 'Cầu thủ không tồn tại' ? 404 : 500).json({ success: false, error: message });
  }
});

// Admins and moderators review all pending requests.
router.get('/pending', authenticate, authorize(['ADMIN', 'MOD']), async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const topUps = await prisma.playerMoneyTopUp.findMany({
      where: { status: 'PENDING' },
      include: { player: { select: { id: true, name: true, money: true, position: true } } },
      orderBy: { requestedAt: 'asc' },
    });
    res.json({ success: true, data: topUps });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Không thể tải danh sách yêu cầu nạp tiền' });
  }
});

// Approval and the player balance update are one atomic transaction.
router.put('/:id/approve', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const topUp = await prisma.$transaction(async (tx) => {
      const pending = await tx.playerMoneyTopUp.findUnique({ where: { id: req.params.id }, include: { player: true } });
      if (!pending) throw new Error('Yêu cầu nạp tiền không tồn tại');
      if (pending.status !== 'PENDING') throw new Error('Yêu cầu này đã được xử lý');

      const balanceBefore = pending.player.money;
      const balanceAfter = balanceBefore + pending.amount;
      await tx.player.update({ where: { id: pending.playerId }, data: { money: balanceAfter } });
      await tx.playerMoneyHistory.create({
        data: {
          playerId: pending.playerId,
          amount: pending.amount,
          balanceBefore,
          balanceAfter,
          description: 'Nạp tiền đã được duyệt',
          details: { approvedByUsername: req.user!.username },
        },
      });
      return tx.playerMoneyTopUp.update({
        where: { id: pending.id },
        data: { status: 'APPROVED', approvedAt: new Date(), approvedById: req.user!.id },
        include: { player: { select: { id: true, name: true, money: true } } },
      });
    });
    res.json({ success: true, data: topUp, message: 'Đã duyệt và cộng tiền cho cầu thủ' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể duyệt yêu cầu nạp tiền';
    res.status(message.includes('không tồn tại') ? 404 : 400).json({ success: false, error: message });
  }
});

// Staff can cancel a pending request made by mistake. No player balance is changed.
router.delete('/:id', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const pending = await prisma.playerMoneyTopUp.findUnique({ where: { id: req.params.id } });
    if (!pending) {
      res.status(404).json({ success: false, error: 'Yêu cầu nạp tiền không tồn tại' });
      return;
    }
    if (pending.status !== 'PENDING') {
      res.status(400).json({ success: false, error: 'Chỉ có thể xóa yêu cầu đang chờ duyệt' });
      return;
    }

    await prisma.playerMoneyTopUp.update({
      where: { id: pending.id },
      data: { status: 'REJECTED', rejectedAt: new Date() },
    });
    res.json({ success: true, message: 'Đã từ chối yêu cầu nạp tiền' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Không thể xóa yêu cầu nạp tiền' });
  }
});

export { router as moneyTopUpRoutes };
