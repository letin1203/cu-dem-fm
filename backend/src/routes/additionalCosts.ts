import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get additional costs for a tournament
router.get('/tournament/:tournamentId', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { tournamentId } = req.params;

    const additionalCosts = await prisma.additionalCost.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: additionalCosts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch additional costs',
    });
  }
});

// Create additional cost (Admin only)
router.post('/', authenticate, authorize(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { tournamentId, description, amount } = req.body;

    if (!tournamentId || !description || amount === undefined) {
      res.status(400).json({
        success: false,
        error: 'Tournament ID, description, and amount are required',
      });
      return;
    }

    // Validate that tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
      return;
    }

    const additionalCost = await prisma.additionalCost.create({
      data: {
        tournamentId,
        description,
        amount: parseInt(amount),
      },
    });

    res.status(201).json({
      success: true,
      data: additionalCost,
      message: 'Additional cost created successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid additional cost data',
    });
  }
});

// Update additional cost (Admin only)
router.put('/:id', authenticate, authorize(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { description, amount } = req.body;

    const additionalCost = await prisma.additionalCost.update({
      where: { id },
      data: {
        ...(description && { description }),
        ...(amount !== undefined && { amount: parseInt(amount) }),
      },
    });

    res.json({
      success: true,
      data: additionalCost,
      message: 'Additional cost updated successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update additional cost',
    });
  }
});

// Delete additional cost (Admin only)
router.delete('/:id', authenticate, authorize(['ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.additionalCost.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Additional cost deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete additional cost',
    });
  }
});

export { router as additionalCostsRoutes };
