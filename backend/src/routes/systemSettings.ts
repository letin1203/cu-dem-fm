import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Fund history calculated from completed tournaments.
router.get('/fund-history', authenticate, async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const settings = await prisma.systemSettings.findFirst();
    const defaultStadiumCost = settings?.stadiumCost ?? 10000;
    const defaultSponsorMoney = settings?.sponsorMoney ?? 50000;
    const tournaments = await prisma.tournament.findMany({
      // Self-funded tournaments are fully separate from the club fund.
      where: { status: 'COMPLETED', selfFunded: false },
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        name: true,
        startDate: true,
        stadiumCost: true,
        sponsorMoney: true,
        fundContribution: true,
        additionalCosts: { select: { description: true, amount: true } },
        moneyHistory: { select: { amount: true } },
      },
    });

    let balanceAfter = 0;
    const history = tournaments.map((tournament) => {
      const playerMoneyChanges = tournament.moneyHistory.reduce((total, item) => total + item.amount, 0);
      const playerFundImpact = -playerMoneyChanges;
      const stadiumCost = tournament.stadiumCost ?? defaultStadiumCost;
      const sponsorMoney = tournament.sponsorMoney ?? defaultSponsorMoney;
      const additionalCosts = tournament.additionalCosts.filter((cost) => cost.amount > 0);
      const totalAdditionalCosts = additionalCosts.reduce((total, cost) => total + cost.amount, 0);
      const fundChange = playerFundImpact + sponsorMoney - stadiumCost - totalAdditionalCosts;
      balanceAfter += fundChange;

      return {
        id: tournament.id,
        name: tournament.name,
        startDate: tournament.startDate,
        playerFundImpact,
        stadiumCost,
        sponsorMoney,
        additionalCosts,
        fundContribution: tournament.fundContribution,
        fundChange,
        balanceAfter,
      };
    });

    const playerDebt = await prisma.player.aggregate({
      where: { money: { lt: 0 } },
      _sum: { money: true },
    });
    const totalPlayerDebt = Math.abs(playerDebt._sum.money ?? 0);

    res.json({ success: true, data: { currentFund: balanceAfter, estimatedFund: balanceAfter, totalPlayerDebt, history: history.reverse() } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Không thể tải lịch sử quỹ' });
  }
});

// Get system settings
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    let settings = await prisma.systemSettings.findFirst();
    
    // If no settings exist, create default ones
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          stadiumCost: 10000,
          sponsorMoney: 50000,
          clubFund: 0,
        },
      });
    }

    const [playerMoneyChanges, completedTournaments] = await Promise.all([
      prisma.playerMoneyHistory.aggregate({
        where: {
          tournament: {
            is: { status: 'COMPLETED', selfFunded: false },
          },
        },
        _sum: { amount: true },
      }),
      prisma.tournament.findMany({
        where: { status: 'COMPLETED', selfFunded: false },
        select: {
          stadiumCost: true,
          sponsorMoney: true,
          additionalCosts: { select: { amount: true } },
        },
      }),
    ]);

    const totalTournamentCosts = completedTournaments.reduce((total, tournament) => {
      const stadiumCost = tournament.stadiumCost ?? settings.stadiumCost;
      const additionalCosts = tournament.additionalCosts.reduce((costTotal, cost) => costTotal + cost.amount, 0);
      const sponsorMoney = tournament.sponsorMoney ?? settings.sponsorMoney;
      return total + stadiumCost + additionalCosts - sponsorMoney;
    }, 0);
    // Tiền bị trừ từ cầu thủ là tiền thu vào quỹ; tiền cộng cho cầu thủ là tiền chi từ quỹ.
    const calculatedClubFund = -(playerMoneyChanges._sum.amount ?? 0) - totalTournamentCosts;

    res.json({
      success: true,
      data: {
        ...settings,
        clubFund: calculatedClubFund,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system settings',
    });
  }
});

// Update system settings (Admin only)
router.put('/', authenticate, authorize(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { stadiumCost, sponsorMoney, clubFund } = req.body;

    // Get existing settings or create if none exist
    let settings = await prisma.systemSettings.findFirst();
    
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          stadiumCost: stadiumCost || 10000,
          sponsorMoney: sponsorMoney || 50000,
          clubFund: clubFund || 0,
        },
      });
    } else {
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: {
          ...(stadiumCost !== undefined && { stadiumCost }),
          ...(sponsorMoney !== undefined && { sponsorMoney }),
          ...(clubFund !== undefined && { clubFund }),
        },
      });
    }

    res.json({
      success: true,
      data: settings,
      message: 'System settings updated successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid settings data',
    });
  }
});

export { router as systemSettingsRoutes };
