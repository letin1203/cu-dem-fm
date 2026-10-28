import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { updateTournamentScoresSchema } from '../schemas/validation';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';
import {
  calculateCostPerPlayer,
  calculateNetTournamentCost,
  calculateSettlementLines,
  computeLeagueStandings,
  sumSettlementLines,
  type SettlementContext,
} from '../services/settlement';

const router = Router();
// Update tournament team scores
router.put('/:id/scores', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: tournamentId } = req.params;
    const { scores } = updateTournamentScoresSchema.parse(req.body);

    // Verify tournament exists and is ongoing
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        teams: {
          include: {
            team: true,
          },
        },
      },
    });

    if (!tournament) {
      res.status(404).json({
        success: false,
        error: 'Tournament not found',
      });
      return;
    }

    if (tournament.status !== 'ONGOING') {
      res.status(400).json({
        success: false,
        error: 'Can only update scores for ongoing tournaments',
      });
      return;
    }

    // Get all team IDs in this tournament
    const tournamentTeamIds = tournament.teams.map(tt => tt.teamId);
    
    // Validate that all score updates are for teams in this tournament
    const scoreTeamIds = Object.keys(scores);
    const invalidTeamIds = scoreTeamIds.filter(teamId => !tournamentTeamIds.includes(teamId));
    
    if (invalidTeamIds.length > 0) {
      res.status(400).json({
        success: false,
        error: `Invalid team IDs: ${invalidTeamIds.join(', ')}. Teams not in this tournament.`,
      });
      return;
    }

    // Update team scores
    const updatePromises = Object.entries(scores).map(([teamId, score]) =>
      prisma.team.update({
        where: { id: teamId },
        data: { score },
      })
    );

    await Promise.all(updatePromises);

    // Get updated tournament data
    const updatedTournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        teams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                score: true,
              },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Team scores updated successfully',
      data: {
        tournament: updatedTournament,
        updatedScores: scores,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      });
      return;
    }

    console.error('Update scores error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update scores',
    });
  }
});

// End tournament - calculate money changes and finalize

router.put('/:id/end', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const cancelledGkDiscountPlayerIds = new Set<string>(
      Array.isArray(req.body?.cancelledGkDiscountPlayerIds)
        ? req.body.cancelledGkDiscountPlayerIds.filter((playerId: unknown): playerId is string => typeof playerId === 'string')
        : []
    );

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        teams: { include: { team: true } },
        tournamentTeamPlayers: { include: { player: true, team: true } },
        playerAttendances: { include: { player: { include: { friendOwner: { include: { player: true } } } } } },
        additionalCosts: true,
        matches: {
          select: { status: true, homeScore: true, awayScore: true, homeTeamId: true, awayTeamId: true },
        },
      },
    });

    if (!tournament) {
      res.status(404).json({ success: false, error: 'Tournament not found' });
      return;
    }

    if (tournament.status !== 'ONGOING' && tournament.status !== 'ACTIVE') {
      res.status(400).json({ success: false, error: 'Only active tournaments can be ended' });
      return;
    }

    const teams = tournament.teams.map((entry) => entry.team).filter(Boolean);
    if (teams.length === 0) {
      res.status(400).json({ success: false, error: 'No teams found in tournament' });
      return;
    }

    let sortedTeams = [...teams].sort((a, b) => (b.score || 0) - (a.score || 0));
    if (tournament.format === 'LEAGUE') {
      if (!tournament.matches.length || tournament.matches.some((match) => match.status !== 'COMPLETED')) {
        res.status(400).json({ success: false, error: 'League can only end after every match is completed' });
        return;
      }
      const standings = computeLeagueStandings(
        teams.map((team) => team.id),
        tournament.matches.map((match) => ({
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
        })),
      );
      const teamById = new Map(teams.map((team) => [team.id, team]));
      sortedTeams = standings
        .map((standing) => teamById.get(standing.teamId))
        .filter((team): team is (typeof teams)[number] => Boolean(team));
    }
    const winnerTeam = sortedTeams[0];
    const loserTeam = sortedTeams[sortedTeams.length - 1];

    if (tournament.format !== 'LEAGUE' && winnerTeam.score === loserTeam.score) {
      res.status(400).json({ success: false, error: 'Cannot end tournament with tied scores' });
      return;
    }

    // Only players actually assigned to a tournament team are settled.
    const assignedPlayerIds = new Set(tournament.tournamentTeamPlayers.map((assignment) => assignment.playerId));
    const attendingPlayers = tournament.playerAttendances
      .filter((att) => assignedPlayerIds.has(att.playerId) && (att.status === 'ATTEND' || att.status === 'ATTENDING'))
      .map((att) => att.player);

    const [systemSettings, acceptedChallenges, acceptedFriendInvites, matchedDeadmatches] = await Promise.all([
      prisma.systemSettings.findFirst(),
      prisma.tournamentChallenge.findMany({ where: { tournamentId: id, status: 'ACCEPTED' } }),
      prisma.tournamentFriendInvite.findMany({ where: { tournamentId: id, status: 'ACCEPTED' }, include: { requester: { include: { user: { select: { id: true } } } }, target: { select: { friendOwnerId: true } } } }),
      prisma.tournamentDeadmatchEntry.findMany({ where: { tournamentId: id, status: 'MATCHED' } }),
    ]);
    const challengeOpponentByPlayerId = new Map<string, string>();
    for (const challenge of acceptedChallenges) {
      challengeOpponentByPlayerId.set(challenge.requesterPlayerId, challenge.targetPlayerId);
      challengeOpponentByPlayerId.set(challenge.targetPlayerId, challenge.requesterPlayerId);
    }
    const invitedFriendPenaltyByPlayerId = new Map<string, number>();
    acceptedFriendInvites.forEach((invite) => {
      const requesterOwnsTarget = invite.target.friendOwnerId && invite.target.friendOwnerId === invite.requester.user?.id;
      invitedFriendPenaltyByPlayerId.set(invite.requesterPlayerId, (invitedFriendPenaltyByPlayerId.get(invite.requesterPlayerId) || 0) + (requesterOwnsTarget ? 20000 : 10000));
      if (!requesterOwnsTarget) invitedFriendPenaltyByPlayerId.set(invite.targetPlayerId, (invitedFriendPenaltyByPlayerId.get(invite.targetPlayerId) || 0) + 10000);
    });
    const deadmatchesByPlayerId = new Map<string, Array<{ opponentTeamId: string }>>();
    for (const entry of matchedDeadmatches) {
      const entries = deadmatchesByPlayerId.get(entry.playerId) || [];
      entries.push({ opponentTeamId: entry.opponentTeamId });
      deadmatchesByPlayerId.set(entry.playerId, entries);
    }

    const noShowPenalty = Math.max(0, systemSettings?.noShowPenalty ?? 0);
    const totalAdditionalCosts = tournament.selfFunded ? 0 : tournament.additionalCosts.reduce((sum, cost) => sum + cost.amount, 0);
    const sponsorMoney = tournament.selfFunded ? 0 : (tournament.sponsorMoney ?? systemSettings?.sponsorMoney ?? 0);
    const stadiumCost = tournament.stadiumCost ?? systemSettings?.stadiumCost ?? 0;
    const fundContribution = tournament.fundContribution ?? 0;
    const netTournamentCost = calculateNetTournamentCost({
      stadiumCost,
      sponsorMoney,
      additionalCosts: totalAdditionalCosts,
      fundContribution,
    });
    // A self-funded tournament never charges players, so the share stays 0.
    const tournamentCostPerPlayer = calculateCostPerPlayer(
      netTournamentCost,
      attendingPlayers.length,
      tournament.selfFunded,
    );

    const teamByPlayerId = new Map<string, { id: string; score: number | null }>();
    for (const assignment of tournament.tournamentTeamPlayers) {
      teamByPlayerId.set(assignment.playerId, { id: assignment.team.id, score: assignment.team.score });
    }
    const teamById = new Map<string, { id: string; score: number | null }>();
    for (const entry of tournament.teams) {
      teamById.set(entry.teamId, { id: entry.team.id, score: entry.team.score });
    }
    const settlementContext: SettlementContext = {
      tournamentCostPerPlayer,
      noShowPenalty,
      cancelledGkDiscountPlayerIds,
      invitedFriendPenaltyByPlayerId,
      challengeOpponentByPlayerId,
      teamByPlayerId,
      teamById,
      deadmatchesByPlayerId,
      winnerTeamId: winnerTeam.id,
      loserTeamId: loserTeam.id,
      selfFunded: tournament.selfFunded,
    };

    let totalAdded = 0;
    let totalDeducted = 0;
    const moneyUpdates: Array<{ playerId: string; oldMoney: number; newMoney: number; change: number }> = [];

    // A self-funded tournament does not create player-money changes at all.
    // Every balance change, its audit row and the status flip are committed
    // together so a mid-way failure can never leave balances half-applied.
    await prisma.$transaction(async (tx) => {
      const current = await tx.tournament.findUnique({ where: { id }, select: { status: true } });
      if (!current || (current.status !== 'ONGOING' && current.status !== 'ACTIVE')) {
        throw new Error('Tournament is no longer active');
      }

      for (const player of tournament.selfFunded ? [] : attendingPlayers) {
        const attendance = tournament.playerAttendances.find((att) => att.playerId === player.id);
        if (!attendance) continue;

        const moneyChangeDetails = calculateSettlementLines(
          {
            id: player.id,
            name: player.name,
            position: player.position,
            friendOwnerId: player.friendOwnerId,
            friendOwnerPlayerId: player.friendOwner?.player?.id ?? null,
          },
          { bet: attendance.bet, withWater: attendance.withWater, notOnField: attendance.notOnField },
          settlementContext,
        );
        const moneyChange = sumSettlementLines(moneyChangeDetails);

        const payerId = player.friendOwner?.player?.id || player.id;
        const payer = await tx.player.findUniqueOrThrow({ where: { id: payerId }, select: { id: true, money: true } });
        const newMoney = payer.money + moneyChange;
        await tx.player.update({ where: { id: payer.id }, data: { money: newMoney } });

        await tx.playerMoneyHistory.create({
          data: {
            playerId: payer.id,
            tournamentId: tournament.id,
            amount: moneyChange,
            balanceBefore: payer.money,
            balanceAfter: newMoney,
            description: player.friendOwnerId
              ? `Tổng kết giải đấu: ${tournament.name} (chi phí cho ${player.name})`
              : `Tổng kết giải đấu: ${tournament.name}`,
            details: moneyChangeDetails.map((line) => ({ description: line.description, amount: line.amount })),
          },
        });

        moneyUpdates.push({ playerId: payer.id, oldMoney: payer.money, newMoney, change: moneyChange });

        if (moneyChange > 0) totalAdded += moneyChange;
        else if (moneyChange < 0) totalDeducted += Math.abs(moneyChange);
      }

      await tx.tournament.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          sponsorMoney,
          stadiumCost,
          costPerPlayer: tournamentCostPerPlayer,
        },
      });
    });

    res.json({
      success: true,
      data: {
        tournament: { id: tournament.id, name: tournament.name, status: 'COMPLETED' },
        winner: { id: winnerTeam.id, name: winnerTeam.name, score: winnerTeam.score },
        loser: { id: loserTeam.id, name: loserTeam.name, score: loserTeam.score },
        playersUpdated: moneyUpdates.length,
        totalAdded,
        totalDeducted,
        moneyUpdates,
      },
    });
  } catch (error) {
    console.error('End tournament error:', error);
    const message = error instanceof Error ? error.message : 'Failed to end tournament';
    res.status(message === 'Tournament is no longer active' ? 409 : 500).json({
      success: false,
      error: message === 'Tournament is no longer active'
        ? 'Giải đấu không còn ở trạng thái đang diễn ra'
        : 'Failed to end tournament',
    });
  }
});

export { router as tournamentSettlementRoutes };
