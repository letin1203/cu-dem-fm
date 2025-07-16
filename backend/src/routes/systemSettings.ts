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

    res.json({
      success: true,
      data: settings,
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
