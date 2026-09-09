import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

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
            is: { status: 'COMPLETED' },
          },
        },
        _sum: { amount: true },
      }),
      prisma.tournament.findMany({
        where: { status: 'COMPLETED' },
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
