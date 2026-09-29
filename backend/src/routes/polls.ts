import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const pollSchema = z.object({
  question: z.string().trim().min(1).max(500),
  allowMultiple: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(200)).min(2),
});

const serializePoll = (poll: any, userId: string) => ({
  ...poll,
  options: poll.options.map((option: any) => ({
    id: option.id,
    label: option.label,
    sortOrder: option.sortOrder,
    voteCount: option._count?.votes || 0,
    selected: option.votes?.some((vote: any) => vote.userId === userId) || false,
  })),
});
const pollInclude = (userId: string) => ({
  createdBy: { select: { username: true } },
  options: {
    orderBy: { sortOrder: 'asc' as const },
    include: { _count: { select: { votes: true } }, votes: { where: { userId }, select: { userId: true } } },
  },
});

router.get('/pinned', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const poll = await prisma.poll.findFirst({ where: { isPinned: true }, orderBy: { updatedAt: 'desc' }, include: pollInclude(req.user!.id) });
    res.json({ success: true, data: poll ? serializePoll(poll, req.user!.id) : null });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Không thể tải bình chọn đã ghim' });
  }
});

router.get('/', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const polls = await prisma.poll.findMany({ orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }], include: pollInclude(req.user!.id) });
    res.json({ success: true, data: polls.map((poll) => serializePoll(poll, req.user!.id)) });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Không thể tải danh sách bình chọn' });
  }
});

router.get('/:id', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const poll = await prisma.poll.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { username: true } },
        options: {
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: { select: { votes: true } },
            votes: {
              orderBy: { createdAt: 'asc' },
              include: { user: { select: { username: true, player: { select: { name: true, avatar: true } } } } },
            },
          },
        },
      },
    });
    if (!poll) { res.status(404).json({ success: false, error: 'Không tìm thấy bình chọn' }); return; }
    res.json({ success: true, data: {
      ...poll,
      options: poll.options.map((option) => ({
        id: option.id, label: option.label, sortOrder: option.sortOrder, voteCount: option._count.votes,
        votes: option.votes.map((vote) => ({ id: vote.id, createdAt: vote.createdAt, username: vote.user.username, player: vote.user.player })),
      })),
    } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Không thể tải chi tiết bình chọn' });
  }
});

router.post('/', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const input = pollSchema.parse(req.body);
    if (input.isPinned) await prisma.poll.updateMany({ where: { isPinned: true }, data: { isPinned: false } });
    const poll = await prisma.poll.create({
      data: {
        question: input.question,
        allowMultiple: input.allowMultiple,
        isPinned: input.isPinned,
        createdById: req.user!.id,
        options: { create: input.options.map((label, sortOrder) => ({ label, sortOrder })) },
      },
      include: pollInclude(req.user!.id),
    });
    res.status(201).json({ success: true, data: serializePoll(poll, req.user!.id) });
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ success: false, error: error.issues[0]?.message || 'Dữ liệu không hợp lệ' }); return; }
    res.status(500).json({ success: false, error: 'Không thể tạo bình chọn' });
  }
});

router.post('/:id/vote', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const optionIds = z.array(z.string()).min(1).parse(req.body?.optionIds);
    const poll = await prisma.poll.findUnique({ where: { id: req.params.id }, include: { options: { select: { id: true } } } });
    if (!poll) { res.status(404).json({ success: false, error: 'Không tìm thấy bình chọn' }); return; }
    const uniqueOptionIds = [...new Set(optionIds)];
    const allowedIds = new Set(poll.options.map((option) => option.id));
    if (uniqueOptionIds.some((id) => !allowedIds.has(id)) || (!poll.allowMultiple && uniqueOptionIds.length !== 1)) {
      res.status(400).json({ success: false, error: 'Lựa chọn bình chọn không hợp lệ' }); return;
    }
    await prisma.$transaction([
      prisma.pollVote.deleteMany({ where: { pollId: poll.id, userId: req.user!.id } }),
      prisma.pollVote.createMany({ data: uniqueOptionIds.map((optionId) => ({ pollId: poll.id, optionId, userId: req.user!.id })) }),
    ]);
    const updated = await prisma.poll.findUniqueOrThrow({ where: { id: poll.id }, include: pollInclude(req.user!.id) });
    res.json({ success: true, data: serializePoll(updated, req.user!.id) });
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ success: false, error: 'Vui lòng chọn ít nhất một lựa chọn' }); return; }
    res.status(500).json({ success: false, error: 'Không thể gửi bình chọn' });
  }
});

export { router as pollRoutes };
