import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import {
  getTournamentCancellationDeadline,
  hasNonNegativeAvailableBalance,
} from '../lib/tournamentRules';

const router = Router();

// Swap requests are available only after the cancellation deadline and before teams are generated.
router.get('/:id/swap-candidates', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [user, tournament] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true, player: { select: { money: true } } } }),
      prisma.tournament.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, pitchType: true, startDate: true, cancellationDeadline: true, teams: { select: { teamId: true } } } }),
    ]);
    if (!user?.playerId || !tournament) {
      res.status(404).json({ success: false, error: 'Không tìm thấy cầu thủ hoặc giải đấu' });
      return;
    }
    if (user.player && !(await hasNonNegativeAvailableBalance(user.playerId, user.player.money))) {
      res.status(400).json({ success: false, error: 'Số dư hiện tại cộng tiền nạp chờ duyệt vẫn âm, vui lòng thanh toán trước khi swap' });
      return;
    }
    if (tournament.status !== 'UPCOMING' || tournament.teams.length > 0 || Date.now() <= getTournamentCancellationDeadline(tournament).getTime()) {
      res.status(400).json({ success: false, error: 'Chỉ có thể swap sau thời gian chốt hủy và trước khi chia đội' });
      return;
    }
    const requesterAttendance = await prisma.tournamentPlayerAttendance.findUnique({ where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: user.playerId } } });
    const requesterHasSelectedField = requesterAttendance?.status === 'ATTEND' && (!tournament.pitchType || (tournament.pitchType === 'FIELD_5' ? requesterAttendance.field5 : requesterAttendance.field7));
    if (!requesterHasSelectedField) {
      res.status(400).json({ success: false, error: 'Bạn cần đăng ký tham gia trước khi yêu cầu swap' });
      return;
    }
    const [attendingPlayers, pendingRequest] = await Promise.all([
      prisma.tournamentPlayerAttendance.findMany({ where: { tournamentId: tournament.id, status: 'ATTEND' }, select: { playerId: true } }),
      prisma.tournamentSwapRequest.findFirst({
        where: { tournamentId: tournament.id, requesterPlayerId: user.playerId, status: 'PENDING' },
        include: { target: { select: { name: true } } },
      }),
    ]);
    const pendingTargets = await prisma.tournamentSwapRequest.findMany({
      where: { tournamentId: tournament.id, status: 'PENDING' },
      select: { targetPlayerId: true },
    });
    const candidates = await prisma.player.findMany({
      where: {
        id: { notIn: [...attendingPlayers.map((attendance) => attendance.playerId), ...pendingTargets.map((request) => request.targetPlayerId)] },
        isActive: true,
        user: { is: { isActive: true } },
      },
      select: { id: true, name: true, position: true, positionSecond: true, tier: true, avatar: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: { candidates, pendingTargetName: pendingRequest?.target.name || null } });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Không thể tải danh sách cầu thủ để swap' });
  }
});

router.post('/:id/swap-requests', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const requestedPlayerId = typeof req.body?.playerId === 'string' ? req.body.playerId : null;
    const [user, tournament] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true, player: { select: { money: true } } } }),
      prisma.tournament.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, pitchType: true, startDate: true, cancellationDeadline: true, teams: { select: { teamId: true } } } }),
    ]);
    const requesterPlayerId = requestedPlayerId || user?.playerId;
    const controlledPlayer = requesterPlayerId && await prisma.player.findFirst({ where: { id: requesterPlayerId, OR: [{ id: user?.playerId || '' }, { friendOwnerId: req.user!.id }] }, select: { id: true } });
    if (!user?.playerId || !tournament || !controlledPlayer) {
      res.status(400).json({ success: false, error: 'Thông tin yêu cầu swap không hợp lệ' });
      return;
    }
    if (user.player && !(await hasNonNegativeAvailableBalance(user.playerId, user.player.money))) {
      res.status(400).json({ success: false, error: 'Số dư hiện tại cộng tiền nạp chờ duyệt vẫn âm, vui lòng thanh toán trước khi swap' });
      return;
    }
    if (tournament.status !== 'UPCOMING' || tournament.teams.length > 0 || Date.now() <= getTournamentCancellationDeadline(tournament).getTime()) {
      res.status(400).json({ success: false, error: 'Chỉ có thể swap sau thời gian chốt hủy và trước khi chia đội' });
      return;
    }
    const [requesterAttendance, pendingRequest, firstWaitlistedPlayer] = await Promise.all([
      prisma.tournamentPlayerAttendance.findUnique({ where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: requesterPlayerId! } } }),
      prisma.tournamentSwapRequest.findFirst({
        where: { tournamentId: tournament.id, requesterPlayerId: requesterPlayerId!, status: 'PENDING' },
      }),
      prisma.tournamentSwapRequest.findFirst({
        where: { tournamentId: tournament.id, status: 'WAITING' },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const requesterHasSelectedField = requesterAttendance?.status === 'ATTEND' && (!tournament.pitchType || (tournament.pitchType === 'FIELD_5' ? requesterAttendance.field5 : requesterAttendance.field7));
    if (!requesterHasSelectedField) {
      res.status(400).json({ success: false, error: 'Bạn cần đăng ký tham gia trước khi yêu cầu swap' });
      return;
    }
    if (pendingRequest) {
      res.status(409).json({ success: false, error: 'Bạn đang chờ một cầu thủ khác swap với mình.' });
      return;
    }
    if (firstWaitlistedPlayer && requesterPlayerId === user.playerId) {
      await prisma.$transaction(async (tx) => {
        const waitlistEntry = await tx.tournamentSwapRequest.findFirst({ where: { tournamentId: tournament.id, status: 'WAITING' }, orderBy: { createdAt: 'asc' } });
        if (!waitlistEntry) throw new Error('Hàng chờ đã thay đổi, vui lòng thử lại');
        const replacementAttendance = await tx.tournamentPlayerAttendance.findUnique({ where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: waitlistEntry.requesterPlayerId } } });
        if (replacementAttendance?.status === 'ATTEND') throw new Error('Cầu thủ hàng chờ đã tham gia');
        await tx.tournamentPlayerAttendance.upsert({
          where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: waitlistEntry.requesterPlayerId } },
          update: { status: 'ATTEND', field5: true, field7: true, withWater: false, bet: false, registeredAt: new Date() },
          create: { tournamentId: tournament.id, playerId: waitlistEntry.requesterPlayerId, status: 'ATTEND', field5: true, field7: true, registeredAt: new Date() },
        });
        await tx.tournamentPlayerAttendance.update({ where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: user.playerId! } }, data: { status: 'NULL', field5: false, field7: false, withWater: false, bet: false } });
        await tx.tournamentSwapRequest.update({ where: { id: waitlistEntry.id }, data: { targetPlayerId: user.playerId!, status: 'ACCEPTED', resolvedAt: new Date() } });
      });
      res.json({ success: true, message: 'Đã swap ngay với cầu thủ đứng đầu hàng chờ' });
      return;
    }
    // targetPlayerId is a required legacy column. While pending, it mirrors the requester;
    // the accepting player is determined only when they choose to swap.
    const request = await prisma.tournamentSwapRequest.upsert({
      where: { tournamentId_requesterPlayerId_targetPlayerId: { tournamentId: tournament.id, requesterPlayerId: requesterPlayerId!, targetPlayerId: requesterPlayerId! } },
      update: { status: 'PENDING', createdAt: new Date(), resolvedAt: null },
      create: { tournamentId: tournament.id, requesterPlayerId: requesterPlayerId!, targetPlayerId: requesterPlayerId! },
    });
    res.status(201).json({ success: true, data: request, message: 'Đã gửi yêu cầu swap. Cầu thủ chưa đăng ký có thể swap với bạn.' });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Không thể gửi yêu cầu swap' });
  }
});

router.delete('/:id/swap-requests', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true } });
    if (!user?.playerId) {
      res.status(400).json({ success: false, error: 'Tài khoản chưa liên kết cầu thủ' });
      return;
    }
    const deleted = await prisma.tournamentSwapRequest.deleteMany({
      where: { tournamentId: req.params.id, requesterPlayerId: user.playerId, status: 'PENDING' },
    });
    if (deleted.count === 0) {
      res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu swap đang chờ' });
      return;
    }
    res.json({ success: true, message: 'Đã hủy đăng ký swap' });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Không thể hủy đăng ký swap' });
  }
});

router.post('/:id/swap-waitlist', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [user, tournament] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true, player: { select: { money: true } } } }),
      prisma.tournament.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, cancellationDeadline: true, startDate: true, teams: { select: { teamId: true } } } }),
    ]);
    if (!user?.playerId || !tournament || tournament.status !== 'UPCOMING' || tournament.teams.length > 0 || Date.now() <= getTournamentCancellationDeadline(tournament).getTime()) {
      res.status(400).json({ success: false, error: 'Chỉ có thể đăng ký hàng chờ sau thời gian chốt hủy và trước khi chia đội' });
      return;
    }
    if (user.player && !(await hasNonNegativeAvailableBalance(user.playerId, user.player.money))) {
      res.status(400).json({ success: false, error: 'Số dư hiện tại cộng tiền nạp chờ duyệt vẫn âm, vui lòng thanh toán trước khi swap' });
      return;
    }
    const attendance = await prisma.tournamentPlayerAttendance.findUnique({ where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: user.playerId } } });
    if (attendance?.status === 'ATTEND') { res.status(400).json({ success: false, error: 'Bạn đã tham gia giải đấu' }); return; }
    const [existing, lastCancelled] = await Promise.all([
      prisma.tournamentSwapRequest.findFirst({ where: { tournamentId: tournament.id, requesterPlayerId: user.playerId, status: 'WAITING' } }),
      prisma.tournamentSwapRequest.findFirst({
        where: { tournamentId: tournament.id, requesterPlayerId: user.playerId, targetPlayerId: user.playerId, status: 'WAITLIST_CANCELLED' },
        orderBy: { resolvedAt: 'desc' },
        select: { resolvedAt: true },
      }),
    ]);
    if (existing) { res.status(409).json({ success: false, error: 'Bạn đã ở trong hàng chờ' }); return; }
    const retryAt = lastCancelled?.resolvedAt ? new Date(lastCancelled.resolvedAt.getTime() + 5 * 60 * 1000) : null;
    if (retryAt && retryAt.getTime() > Date.now()) {
      res.status(429).json({ success: false, error: `Vui lòng đợi ${Math.ceil((retryAt.getTime() - Date.now()) / 60000)} phút trước khi đăng ký hàng chờ lại`, data: { retryAt } });
      return;
    }
    const position = await prisma.tournamentSwapRequest.count({ where: { tournamentId: tournament.id, status: 'WAITING' } }) + 1;
    await prisma.tournamentSwapRequest.upsert({
      where: { tournamentId_requesterPlayerId_targetPlayerId: { tournamentId: tournament.id, requesterPlayerId: user.playerId, targetPlayerId: user.playerId } },
      update: { status: 'WAITING', createdAt: new Date(), resolvedAt: null },
      create: { tournamentId: tournament.id, requesterPlayerId: user.playerId, targetPlayerId: user.playerId, status: 'WAITING' },
    });
    res.status(201).json({ success: true, data: { position }, message: `Bạn đã vào hàng chờ thứ ${position}` });
  } catch (_error) { res.status(500).json({ success: false, error: 'Không thể đăng ký hàng chờ' }); }
});

router.delete('/:id/swap-waitlist', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true } });
    if (!user?.playerId) { res.status(400).json({ success: false, error: 'Tài khoản chưa liên kết cầu thủ' }); return; }
    const cancelled = await prisma.tournamentSwapRequest.updateMany({
      where: { tournamentId: req.params.id, requesterPlayerId: user.playerId, status: 'WAITING' },
      data: { status: 'WAITLIST_CANCELLED', resolvedAt: new Date() },
    });
    if (!cancelled.count) { res.status(404).json({ success: false, error: 'Không tìm thấy đăng ký hàng chờ' }); return; }
    res.json({ success: true, data: { retryAt: new Date(Date.now() + 5 * 60 * 1000) }, message: 'Đã hủy đăng ký hàng chờ. Bạn có thể đăng ký lại sau 5 phút.' });
  } catch (_error) { res.status(500).json({ success: false, error: 'Không thể hủy đăng ký hàng chờ' }); }
});

router.get('/:id/swap-requests/mine', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [user, tournament] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true } }),
      prisma.tournament.findUnique({ where: { id: req.params.id }, select: { pitchType: true } }),
    ]);
    if (!user?.playerId) {
      res.json({ success: true, data: [] });
      return;
    }
    const ownAttendance = await prisma.tournamentPlayerAttendance.findUnique({ where: { tournamentId_playerId: { tournamentId: req.params.id, playerId: user.playerId } } });
    const [requests, myPending, waitlistEntries, lastWaitlistCancellation] = await Promise.all([
      prisma.tournamentSwapRequest.findMany({
      where: { tournamentId: req.params.id, requesterPlayerId: { not: user.playerId }, status: 'PENDING' },
      include: { requester: { select: { id: true, name: true, position: true, tier: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
      }),
      prisma.tournamentSwapRequest.findFirst({ where: { tournamentId: req.params.id, requesterPlayerId: user.playerId, status: 'PENDING' }, select: { id: true } }),
      prisma.tournamentSwapRequest.findMany({ where: { tournamentId: req.params.id, status: 'WAITING' }, orderBy: { createdAt: 'asc' }, select: { requesterPlayerId: true } }),
      prisma.tournamentSwapRequest.findFirst({
        where: { tournamentId: req.params.id, requesterPlayerId: user.playerId, targetPlayerId: user.playerId, status: 'WAITLIST_CANCELLED' },
        orderBy: { resolvedAt: 'desc' },
        select: { resolvedAt: true },
      }),
    ]);
    const waitingPosition = waitlistEntries.findIndex((entry) => entry.requesterPlayerId === user.playerId) + 1;
    const isRegisteredForSelectedField = ownAttendance?.status === 'ATTEND' && (!tournament?.pitchType || (tournament.pitchType === 'FIELD_5' ? ownAttendance.field5 : ownAttendance.field7));
    const waitlistRetryAt = lastWaitlistCancellation?.resolvedAt ? new Date(lastWaitlistCancellation.resolvedAt.getTime() + 5 * 60 * 1000) : null;
    res.json({ success: true, data: { requests: isRegisteredForSelectedField ? [] : requests, myPending: Boolean(myPending), waitingPosition, waitlistRetryAt: waitlistRetryAt && waitlistRetryAt.getTime() > Date.now() ? waitlistRetryAt : null } });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Không thể tải yêu cầu swap' });
  }
});

router.put('/:id/swap-requests/:requestId/accept', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const field5 = req.body?.field5 === true;
    const field7 = req.body?.field7 === true;
    if (!field5 && !field7) {
      res.status(400).json({ success: false, error: 'Vui lòng chọn ít nhất một sân' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, include: { player: true, friends: true } });
    if (!user?.player) {
      res.status(400).json({ success: false, error: 'Tài khoản chưa liên kết cầu thủ' });
      return;
    }
    const targetPlayerId = typeof req.body?.playerId === 'string' ? req.body.playerId : user.player.id;
    if (targetPlayerId !== user.player.id && !user.friends.some(friend => friend.id === targetPlayerId)) { res.status(403).json({ success: false, error: 'Bạn chỉ có thể swap cho bạn bè của mình' }); return; }
    const attendance = await prisma.$transaction(async (tx) => {
      const request = await tx.tournamentSwapRequest.findUnique({ where: { id: req.params.requestId } });
      const tournament = await tx.tournament.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, selfFunded: true, pitchType: true, startDate: true, cancellationDeadline: true, teams: { select: { teamId: true } } } });
      if (!request || request.tournamentId !== req.params.id || request.status !== 'PENDING' || request.requesterPlayerId === targetPlayerId) throw new Error('Yêu cầu swap không hợp lệ');
      if (!tournament || tournament.status !== 'UPCOMING' || tournament.teams.length > 0 || Date.now() <= getTournamentCancellationDeadline(tournament).getTime()) throw new Error('Yêu cầu swap đã hết hiệu lực');
      if (!(await hasNonNegativeAvailableBalance(user.player!.id, user.player!.money))) {
        throw new Error('Số dư hiện tại cộng tiền nạp chờ duyệt vẫn âm, vui lòng thanh toán trước khi swap');
      }
      const [requesterAttendance, targetAttendance] = await Promise.all([
        tx.tournamentPlayerAttendance.findUnique({ where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: request.requesterPlayerId } } }),
        tx.tournamentPlayerAttendance.findUnique({ where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: targetPlayerId } } }),
      ]);
      const selectedField = tournament.pitchType;
      const requesterHasSelectedField = requesterAttendance?.status === 'ATTEND' && (!selectedField || (selectedField === 'FIELD_5' ? requesterAttendance.field5 : requesterAttendance.field7));
      const targetHasSelectedField = targetAttendance?.status === 'ATTEND' && (!selectedField || (selectedField === 'FIELD_5' ? targetAttendance.field5 : targetAttendance.field7));
      if (!requesterHasSelectedField || targetHasSelectedField) throw new Error('Không thể thực hiện swap vì trạng thái điểm danh đã thay đổi');
      const replacementField5 = selectedField === 'FIELD_5' ? true : (targetAttendance?.field5 ?? field5);
      const replacementField7 = selectedField === 'FIELD_7' ? true : (targetAttendance?.field7 ?? field7);
      const requesterField5 = selectedField === 'FIELD_5' ? false : requesterAttendance!.field5;
      const requesterField7 = selectedField === 'FIELD_7' ? false : requesterAttendance!.field7;
      const requesterRemainsRegistered = requesterField5 || requesterField7;
      const replacementAttendance = await tx.tournamentPlayerAttendance.upsert({
        where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: targetPlayerId } },
        update: { status: 'ATTEND', field5: replacementField5, field7: replacementField7, withWater: false, bet: false, registeredAt: new Date() },
        create: { tournamentId: tournament.id, playerId: targetPlayerId, status: 'ATTEND', field5: replacementField5, field7: replacementField7, registeredAt: new Date() },
      });
      await tx.tournamentPlayerAttendance.update({ where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: request.requesterPlayerId } }, data: { status: requesterRemainsRegistered ? 'ATTEND' : 'NULL', field5: requesterField5, field7: requesterField7, withWater: false, bet: false } });
      await tx.tournamentSwapRequest.update({ where: { id: request.id }, data: { targetPlayerId, status: 'ACCEPTED', resolvedAt: new Date() } });
      await tx.tournamentSwapRequest.updateMany({ where: { tournamentId: tournament.id, requesterPlayerId: request.requesterPlayerId, status: 'PENDING', id: { not: request.id } }, data: { status: 'CANCELLED', resolvedAt: new Date() } });
      return replacementAttendance;
    });
    res.json({ success: true, data: attendance, message: 'Đã swap cầu thủ thành công' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể chấp nhận yêu cầu swap';
    res.status(400).json({ success: false, error: message });
  }
});

// Create a player-to-player challenge. Both players must share at least one
// registered pitch and belong to either the Tier 1–2 or Tier 3–6 group.
router.post('/:id/challenges', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const targetPlayerId = typeof req.body?.targetPlayerId === 'string' ? req.body.targetPlayerId : '';
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true } });
    if (!user?.playerId || !targetPlayerId || targetPlayerId === user.playerId) { res.status(400).json({ success: false, error: 'Lời mời thách đấu không hợp lệ' }); return; }
    const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, pitchType: true, teams: { select: { teamId: true } } } });
    if (!tournament || tournament.status !== 'UPCOMING' || tournament.teams.length) { res.status(400).json({ success: false, error: 'Chỉ có thể thách đấu trước khi chia đội' }); return; }
    const [requester, target, requesterAttendance, targetAttendance] = await Promise.all([
      prisma.player.findUnique({ where: { id: user.playerId }, select: { id: true, tier: true } }),
      prisma.player.findUnique({ where: { id: targetPlayerId }, select: { id: true, tier: true } }),
      prisma.tournamentPlayerAttendance.findUnique({ where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: user.playerId } } }),
      prisma.tournamentPlayerAttendance.findUnique({ where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: targetPlayerId } } }),
    ]);
    const shareAField = requesterAttendance?.status === 'ATTEND' && targetAttendance?.status === 'ATTEND' && ((requesterAttendance.field5 && targetAttendance.field5) || (requesterAttendance.field7 && targetAttendance.field7));
    const getChallengeTierGroup = (tier: number): 'TIER_1_2' | 'TIER_3_6' | null =>
      tier >= 1 && tier <= 2 ? 'TIER_1_2' : tier >= 3 && tier <= 6 ? 'TIER_3_6' : null;
    const requesterTierGroup = requester ? getChallengeTierGroup(requester.tier) : null;
    const targetTierGroup = target ? getChallengeTierGroup(target.tier) : null;
    if (!requester || !target || !requesterTierGroup || requesterTierGroup !== targetTierGroup || !shareAField) { res.status(400).json({ success: false, error: 'Hai cầu thủ phải cùng nhóm Tier (Tier 1–2 hoặc Tier 3–6) và cùng đăng ký ít nhất một sân' }); return; }
    const active = await prisma.tournamentChallenge.findFirst({ where: { tournamentId: tournament.id, status: { in: ['PENDING', 'ACCEPTED'] }, OR: [{ requesterPlayerId: user.playerId }, { targetPlayerId: user.playerId }, { requesterPlayerId: targetPlayerId }, { targetPlayerId: targetPlayerId }] } });
    if (active) { res.status(400).json({ success: false, error: 'Một trong hai cầu thủ đã có lời mời thách đấu' }); return; }
    // A cancelled request is retained for history, so revive it instead of
    // inserting the same unique requester/target pair again.
    const previousChallenge = await prisma.tournamentChallenge.findUnique({
      where: {
        tournamentId_requesterPlayerId_targetPlayerId: {
          tournamentId: tournament.id,
          requesterPlayerId: user.playerId,
          targetPlayerId,
        },
      },
    });
    if (
      previousChallenge?.status === 'DECLINED' &&
      previousChallenge.respondedAt &&
      Date.now() - previousChallenge.respondedAt.getTime() < 60 * 60 * 1000
    ) {
      const remainingMinutes = Math.ceil(
        (60 * 60 * 1000 - (Date.now() - previousChallenge.respondedAt.getTime())) / 60_000,
      );
      res.status(400).json({
        success: false,
        error: `Cầu thủ đã từ chối lời mời. Vui lòng gửi lại sau ${remainingMinutes} phút`,
      });
      return;
    }
    const challenge = previousChallenge
      ? await prisma.tournamentChallenge.update({
          where: { id: previousChallenge.id },
          data: { status: 'PENDING', createdAt: new Date(), respondedAt: null },
        })
      : await prisma.tournamentChallenge.create({
          data: { tournamentId: tournament.id, requesterPlayerId: user.playerId, targetPlayerId },
        });
    res.json({ success: true, data: challenge });
  } catch (error) {
    console.error('Create challenge error:', error);
    res.status(500).json({ success: false, error: 'Không thể gửi lời mời thách đấu' });
  }
});

router.delete('/:id/challenges', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true } });
  if (!user?.playerId) { res.status(400).json({ success: false, error: 'Tài khoản chưa liên kết cầu thủ' }); return; }
  // A recipient cancelling a pending invitation is a decline. Preserve that
  // distinction so the requester cannot immediately send the same invite again.
  const incomingChallenge = await prisma.tournamentChallenge.findFirst({
    where: { tournamentId: req.params.id, targetPlayerId: user.playerId, status: 'PENDING' },
  });
  if (incomingChallenge) {
    await prisma.tournamentChallenge.update({
      where: { id: incomingChallenge.id },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });
    res.json({ success: true });
    return;
  }
  await prisma.tournamentChallenge.updateMany({ where: { tournamentId: req.params.id, status: { in: ['PENDING', 'ACCEPTED'] }, OR: [{ requesterPlayerId: user.playerId }, { targetPlayerId: user.playerId }] }, data: { status: 'CANCELLED', respondedAt: new Date() } });
  res.json({ success: true });
});

router.put('/:id/challenges/:challengeId/accept', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true } });
  if (!user?.playerId) { res.status(400).json({ success: false, error: 'Tài khoản chưa liên kết cầu thủ' }); return; }
  const challenge = await prisma.tournamentChallenge.findFirst({ where: { id: req.params.challengeId, tournamentId: req.params.id, targetPlayerId: user.playerId, status: 'PENDING' } });
  if (!challenge) { res.status(400).json({ success: false, error: 'Lời mời thách đấu không còn hiệu lực' }); return; }
  const updated = await prisma.tournamentChallenge.update({ where: { id: challenge.id }, data: { status: 'ACCEPTED', respondedAt: new Date() } });
  res.json({ success: true, data: updated });
});

// Invite a compatible player to be on the same team. Friend invites and
// challenges are mutually exclusive because their team-placement rules clash.
router.post('/:id/friend-invites', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const targetPlayerId = typeof req.body?.targetPlayerId === 'string' ? req.body.targetPlayerId : '';
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true } });
    if (!user?.playerId || !targetPlayerId || targetPlayerId === user.playerId) { res.status(400).json({ success: false, error: 'Lời mời rủ bạn không hợp lệ' }); return; }
    const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, teams: { select: { teamId: true } } } });
    if (!tournament || tournament.status !== 'UPCOMING' || tournament.teams.length) { res.status(400).json({ success: false, error: 'Chỉ có thể rủ bạn trước khi chia đội' }); return; }
    const [requester, target, requesterAttendance, targetAttendance, activeChallenge, activeInvite] = await Promise.all([
      prisma.player.findUnique({ where: { id: user.playerId }, select: { id: true, tier: true } }),
      prisma.player.findUnique({ where: { id: targetPlayerId }, select: { id: true, tier: true, friendOwnerId: true } }),
      prisma.tournamentPlayerAttendance.findUnique({ where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: user.playerId } } }),
      prisma.tournamentPlayerAttendance.findUnique({ where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: targetPlayerId } } }),
      prisma.tournamentChallenge.findFirst({ where: { tournamentId: tournament.id, status: { in: ['PENDING', 'ACCEPTED'] }, OR: [{ requesterPlayerId: user.playerId }, { targetPlayerId: user.playerId }, { requesterPlayerId: targetPlayerId }, { targetPlayerId: targetPlayerId }] } }),
      prisma.tournamentFriendInvite.findFirst({ where: { tournamentId: tournament.id, status: { in: ['PENDING', 'ACCEPTED'] }, OR: [{ requesterPlayerId: user.playerId }, { targetPlayerId: user.playerId }, { requesterPlayerId: targetPlayerId }, { targetPlayerId: targetPlayerId }] } }),
    ]);
    const sharedField = requesterAttendance?.status === 'ATTEND' && targetAttendance?.status === 'ATTEND' && ((requesterAttendance.field5 && targetAttendance.field5) || (requesterAttendance.field7 && targetAttendance.field7));
    if (!requester || !target || !sharedField || requester.tier < 1 || requester.tier > 6 || target.tier < 1 || target.tier > 6 || (requester.tier <= 2 && target.tier <= 2)) { res.status(400).json({ success: false, error: 'Chỉ rủ được cầu thủ đăng ký chung sân; Tier 1–2 không rủ nhau' }); return; }
    if (activeChallenge || activeInvite) { res.status(400).json({ success: false, error: 'Một trong hai cầu thủ đang có Thách đấu hoặc Rủ bạn' }); return; }
    const isOwnFriend = target.friendOwnerId === req.user!.id;
    const invite = await prisma.tournamentFriendInvite.create({ data: { tournamentId: tournament.id, requesterPlayerId: user.playerId, targetPlayerId, status: isOwnFriend ? 'ACCEPTED' : 'PENDING', respondedAt: isOwnFriend ? new Date() : null } });
    res.json({ success: true, data: invite });
  } catch (error) { console.error('Create friend invite error:', error); res.status(500).json({ success: false, error: 'Không thể gửi lời mời rủ bạn' }); }
});
router.put('/:id/friend-invites/:inviteId/accept', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true } });
  const invite = user?.playerId ? await prisma.tournamentFriendInvite.findFirst({ where: { id: req.params.inviteId, tournamentId: req.params.id, targetPlayerId: user.playerId, status: 'PENDING' } }) : null;
  if (!invite) { res.status(400).json({ success: false, error: 'Lời mời rủ bạn không còn hiệu lực' }); return; }
  res.json({ success: true, data: await prisma.tournamentFriendInvite.update({ where: { id: invite.id }, data: { status: 'ACCEPTED', respondedAt: new Date() } }) });
});
router.delete('/:id/friend-invites', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true } });
  if (!user?.playerId) { res.status(400).json({ success: false, error: 'Tài khoản chưa liên kết cầu thủ' }); return; }
  await prisma.tournamentFriendInvite.updateMany({ where: { tournamentId: req.params.id, status: { in: ['PENDING', 'ACCEPTED'] }, OR: [{ requesterPlayerId: user.playerId }, { targetPlayerId: user.playerId }] }, data: { status: 'CANCELLED', respondedAt: new Date() } });
  res.json({ success: true });
});

// Deadmatch is a FIFO queue for a specific pair of tournament teams.
router.get('/:id/deadmatches/history', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      select: {
        teams: { include: { team: { select: { id: true, name: true, score: true } } } },
      },
    });
    if (!tournament) {
      res.status(404).json({ success: false, error: 'Không tìm thấy giải đấu' });
      return;
    }

    const entries = await prisma.tournamentDeadmatchEntry.findMany({
      where: { tournamentId: req.params.id, status: 'MATCHED' },
      include: { player: { select: { id: true, name: true, avatar: true } } },
      orderBy: { matchedAt: 'asc' },
    });
    const teamsById = new Map(
      tournament.teams.map((assignment) => [assignment.team.id, assignment.team]),
    );
    const entriesByMatchKey = new Map<string, typeof entries>();
    for (const entry of entries) {
      if (!entry.matchKey) continue;
      entriesByMatchKey.set(entry.matchKey, [
        ...(entriesByMatchKey.get(entry.matchKey) || []),
        entry,
      ]);
    }
    const pairs = [...entriesByMatchKey.entries()]
      .filter(([, pairEntries]) => pairEntries.length === 2)
      .map(([matchKey, pairEntries]) => {
        const [first, second] = pairEntries;
        const firstTeam = teamsById.get(first.teamId);
        const secondTeam = teamsById.get(second.teamId);
        const firstScore = firstTeam?.score ?? 0;
        const secondScore = secondTeam?.score ?? 0;
        const result = firstScore === secondScore
          ? 'Hòa'
          : firstScore > secondScore
            ? `${first.player.name} thắng`
            : `${second.player.name} thắng`;
        return {
          id: matchKey,
          first: { player: first.player, teamName: firstTeam?.name || 'Đội chưa xác định', score: firstScore },
          second: { player: second.player, teamName: secondTeam?.name || 'Đội chưa xác định', score: secondScore },
          result,
          matchedAt: first.matchedAt,
        };
      });
    res.json({ success: true, data: { pairs } });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Không thể tải lịch sử Deadmatch' });
  }
});

router.get('/:id/deadmatches', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const opponentTeamId = typeof req.query.opponentTeamId === 'string' ? req.query.opponentTeamId : '';
  if (!opponentTeamId) { res.status(400).json({ success: false, error: 'Thiếu đội đối thủ' }); return; }
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true } });
  if (!user?.playerId) { res.status(400).json({ success: false, error: 'Tài khoản chưa liên kết cầu thủ' }); return; }
  const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id }, select: { startDate: true } });
  if (!tournament) { res.status(404).json({ success: false, error: 'Không tìm thấy giải đấu' }); return; }

  // A queue only has meaning before kick-off. Matched pairs stay valid for the
  // result calculation, while every unmatched waiting entry is cleared as soon
  // as Deadmatch data is loaded after the tournament starts.
  if (Date.now() >= tournament.startDate.getTime()) {
    await prisma.tournamentDeadmatchEntry.updateMany({
      where: { tournamentId: req.params.id, status: 'WAITING' },
      data: { status: 'CANCELLED', matchKey: null, matchedAt: null },
    });
  }
  const assignment = await prisma.tournamentTeamPlayer.findFirst({ where: { tournamentId: req.params.id, playerId: user.playerId }, select: { teamId: true } });
  if (!assignment) { res.status(400).json({ success: false, error: 'Bạn không thuộc đội thi đấu của giải này' }); return; }
  const entries = await prisma.tournamentDeadmatchEntry.findMany({
    where: {
      tournamentId: req.params.id,
      status: { in: ['WAITING', 'MATCHED'] },
      OR: [
        { teamId: assignment.teamId, opponentTeamId },
        { teamId: opponentTeamId, opponentTeamId: assignment.teamId },
      ],
    },
    include: { player: { select: { id: true, name: true, avatar: true, tier: true, position: true } } },
    orderBy: { queueNumber: 'asc' },
  });
  res.json({ success: true, data: { myTeamId: assignment.teamId, opponentTeamId, entries } });
});

router.post('/:id/deadmatches/:opponentTeamId/join', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tournamentId = req.params.id;
    const opponentTeamId = req.params.opponentTeamId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true } });
    if (!user?.playerId) { res.status(400).json({ success: false, error: 'Tài khoản chưa liên kết cầu thủ' }); return; }
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { id: true, startDate: true, status: true } });
    if (!tournament || tournament.status === 'COMPLETED' || Date.now() >= tournament.startDate.getTime()) { res.status(400).json({ success: false, error: 'Chỉ được tham gia Deadmatch trước giờ diễn ra giải đấu' }); return; }
    const assignment = await prisma.tournamentTeamPlayer.findFirst({ where: { tournamentId, playerId: user.playerId }, select: { teamId: true } });
    const opponentExists = await prisma.tournamentTeam.findUnique({ where: { tournamentId_teamId: { tournamentId, teamId: opponentTeamId } }, select: { teamId: true } });
    if (!assignment || !opponentExists || assignment.teamId === opponentTeamId) { res.status(400).json({ success: false, error: 'Đội Deadmatch không hợp lệ' }); return; }
    const playerId = user.playerId!;
    const existing = await prisma.tournamentDeadmatchEntry.findUnique({ where: { tournamentId_playerId_opponentTeamId: { tournamentId, playerId, opponentTeamId } } });
    if (existing?.status === 'MATCHED') { res.json({ success: true, data: existing, message: 'Bạn đã được ghép cặp Deadmatch' }); return; }
    const result = await prisma.$transaction(async (tx) => {
      const last = await tx.tournamentDeadmatchEntry.aggregate({ where: { tournamentId, teamId: assignment.teamId, opponentTeamId }, _max: { queueNumber: true } });
      const entry = existing
        ? await tx.tournamentDeadmatchEntry.update({ where: { id: existing.id }, data: { status: 'WAITING', matchKey: null, matchedAt: null, queueNumber: (last._max.queueNumber ?? 0) + 1 } })
        : await tx.tournamentDeadmatchEntry.create({ data: { tournamentId, playerId, teamId: assignment.teamId, opponentTeamId, queueNumber: (last._max.queueNumber ?? 0) + 1 } });
      const counterpart = await tx.tournamentDeadmatchEntry.findFirst({ where: { tournamentId, teamId: opponentTeamId, opponentTeamId: assignment.teamId, status: 'WAITING' }, orderBy: { queueNumber: 'asc' } });
      if (!counterpart) return { entry, matched: false };
      const matchKey = `deadmatch-${Date.now()}-${entry.id}-${counterpart.id}`;
      const [matchedEntry] = await Promise.all([
        tx.tournamentDeadmatchEntry.update({ where: { id: entry.id }, data: { status: 'MATCHED', matchKey, matchedAt: new Date() } }),
        tx.tournamentDeadmatchEntry.update({ where: { id: counterpart.id }, data: { status: 'MATCHED', matchKey, matchedAt: new Date() } }),
      ]);
      return { entry: matchedEntry, matched: true };
    });
    res.json({ success: true, data: { entry: result.entry, matched: result.matched } });
  } catch (error) {
    console.error('Join deadmatch error:', error);
    res.status(500).json({ success: false, error: 'Không thể tham gia Deadmatch' });
  }
});

router.delete('/:id/deadmatches/:opponentTeamId', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tournamentId = req.params.id;
    const opponentTeamId = req.params.opponentTeamId;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { playerId: true } });
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { startDate: true } });
    if (!user?.playerId || !tournament || Date.now() >= tournament.startDate.getTime()) { res.status(400).json({ success: false, error: 'Không thể hủy Deadmatch sau giờ diễn ra giải đấu' }); return; }
    const entry = await prisma.tournamentDeadmatchEntry.findUnique({ where: { tournamentId_playerId_opponentTeamId: { tournamentId, playerId: user.playerId, opponentTeamId } } });
    if (!entry || !['WAITING', 'MATCHED'].includes(entry.status)) { res.status(400).json({ success: false, error: 'Bạn chưa tham gia Deadmatch này' }); return; }
    await prisma.$transaction(async (tx) => {
      await tx.tournamentDeadmatchEntry.update({ where: { id: entry.id }, data: { status: 'CANCELLED', matchKey: null } });
      if (entry.status === 'MATCHED' && entry.matchKey) {
        await tx.tournamentDeadmatchEntry.updateMany({ where: { tournamentId, matchKey: entry.matchKey, id: { not: entry.id } }, data: { status: 'WAITING', matchKey: null, matchedAt: null } });
      }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Cancel deadmatch error:', error);
    res.status(500).json({ success: false, error: 'Không thể hủy Deadmatch' });
  }
});

export { router as tournamentSocialRoutes };
