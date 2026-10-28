import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { buildBalancedTeams } from '../services/teamGeneration';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Preview exactly the same team-splitting algorithm without creating teams or
// changing any tournament data. Used by the Test chia team page.
router.post('/preview-teams', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { playerIds, teamCount, battlePairs = [], friendInvitePairs = [], tournamentId } = req.body || {};
    if (!Array.isArray(playerIds) || playerIds.length < 10 || ![2, 3, 4].includes(teamCount)) {
      res.status(400).json({ success: false, error: 'Danh sách cầu thủ hoặc số đội không hợp lệ' });
      return;
    }
    const uniqueIds = [...new Set(playerIds)];
    // Friend-owned players take part in tournaments exactly like regular
    // players, so they must not be filtered out here. Only inactive players
    // are rejected.
    const players = await prisma.player.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
      select: { id: true, name: true, position: true, positionSecond: true, tier: true, avatar: true },
    });
    if (players.length !== uniqueIds.length) {
      res.status(400).json({ success: false, error: 'Có cầu thủ không còn hoạt động hoặc không hợp lệ' });
      return;
    }
    const validPlayerIds = new Set(uniqueIds);
    const toPairs = (value: unknown) =>
      Array.isArray(value)
        ? value.filter((pair: unknown): pair is { firstId: string; secondId: string } => {
            if (!pair || typeof pair !== 'object') return false;
            const candidate = pair as { firstId?: unknown; secondId?: unknown };
            return typeof candidate.firstId === 'string' && typeof candidate.secondId === 'string' &&
              candidate.firstId !== candidate.secondId &&
              validPlayerIds.has(candidate.firstId) && validPlayerIds.has(candidate.secondId);
          })
        : [];

    // The preview must match the official split exactly, so it runs the same
    // pipeline. When a tournament is supplied, its accepted challenges, friend
    // invites and previous-week teams are applied too.
    let previousTeamByPlayer: Map<string, string> | undefined;
    let tournamentBattlePairs = toPairs(battlePairs);
    let tournamentFriendInvitePairs = toPairs(friendInvitePairs);
    if (typeof tournamentId === 'string' && tournamentId) {
      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { startDate: true },
      });
      if (tournament) {
        const [previousTournament, acceptedChallenges, acceptedFriendInvites] = await Promise.all([
          prisma.tournament.findFirst({
            where: { type: 'WEEKLY', startDate: { lt: tournament.startDate }, teams: { some: {} } },
            orderBy: { startDate: 'desc' },
            include: { tournamentTeamPlayers: { select: { teamId: true, playerId: true } } },
          }),
          prisma.tournamentChallenge.findMany({
            where: { tournamentId, status: 'ACCEPTED' },
            select: { requesterPlayerId: true, targetPlayerId: true },
          }),
          prisma.tournamentFriendInvite.findMany({
            where: { tournamentId, status: 'ACCEPTED' },
            select: { requesterPlayerId: true, targetPlayerId: true },
          }),
        ]);
        previousTeamByPlayer = new Map(
          previousTournament?.tournamentTeamPlayers.map((item) => [item.playerId, item.teamId]) ?? [],
        );
        tournamentBattlePairs = acceptedChallenges
          .map((pair) => ({ firstId: pair.requesterPlayerId, secondId: pair.targetPlayerId }))
          .filter((pair) => validPlayerIds.has(pair.firstId) && validPlayerIds.has(pair.secondId));
        tournamentFriendInvitePairs = acceptedFriendInvites
          .map((pair) => ({ firstId: pair.requesterPlayerId, secondId: pair.targetPlayerId }))
          .filter((pair) => validPlayerIds.has(pair.firstId) && validPlayerIds.has(pair.secondId));
      }
    }

    const generation = buildBalancedTeams(players, teamCount, {
      battlePairs: tournamentBattlePairs,
      friendInvitePairs: tournamentFriendInvitePairs,
      previousTeamByPlayer,
    });
    res.json({ success: true, data: {
      teams: generation.teams.map((team, index) => ({
        name: `Team ${index + 1}`,
        players: team.players,
        totalTier: team.totalTier,
      })),
      swaps: generation.swaps,
      repeatTeammateSwaps: generation.repeatTeammateSwaps,
    } });
  } catch (error) {
    console.error('Preview teams error:', error);
    res.status(500).json({ success: false, error: 'Không thể xem trước kết quả chia đội' });
  }
});

// Generate random balanced teams for a tournament
router.post('/:id/generate-teams', authenticate, authorize(['ADMIN', 'MOD']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id: tournamentId } = req.params;
    const requestedTeamCount = req.body?.teamCount;
    const selectedField = req.body?.field;

    if (requestedTeamCount !== undefined && ![2, 3, 4].includes(requestedTeamCount)) {
      res.status(400).json({ success: false, error: 'Team count must be 2, 3, or 4' });
      return;
    }

    if (!['FIELD_5', 'FIELD_7'].includes(selectedField)) {
      res.status(400).json({ success: false, error: 'Vui lòng chọn sân 5 hoặc sân 7' });
      return;
    }

    // Verify tournament exists
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

    // Get attending players with their details
    const attendingPlayers = await prisma.tournamentPlayerAttendance.findMany({
      where: { 
        tournamentId,
        status: 'ATTEND',
        ...(selectedField === 'FIELD_5' ? { field5: true } : { field7: true }),
      },
      include: {
        player: {
          select: {
            id: true,
            name: true,
            position: true,
            positionSecond: true,
            tier: true,
            avatar: true,
          },
        },
      },
    });

    const playerCount = attendingPlayers.length;

    const minimumPlayers = selectedField === 'FIELD_5' ? 12 : 16;
    if (playerCount < minimumPlayers) {
      res.status(400).json({
        success: false,
        error: `Cần ít nhất ${minimumPlayers} cầu thủ đăng ký Sân ${selectedField === 'FIELD_5' ? '5' : '7'} để chia đội`,
      });
      return;
    }

    // Use the team count selected in the UI, otherwise keep the automatic default.
    let teamCount: number = requestedTeamCount;
    if (!teamCount) {
      if (playerCount < 15) teamCount = 2;
      else if (playerCount < 20) teamCount = 3;
      else teamCount = 4;
    }

    // Tier 1 is strongest, so sort strongest to weakest.
    const sortedPlayers = attendingPlayers
      .map(attendance => attendance.player)
      .sort((a, b) => a.tier - b.tier);

    // Team names are globally unique. A tournament can be recreated on the
    // same day, so include a short, stable tournament identifier to avoid a
    // collision with teams from an earlier tournament.
    const dateStr = new Date(tournament.startDate).toISOString().split('T')[0];
    const teamNameSuffix = tournamentId.slice(-6);

    // Every split (official, modal preview and the Test chia team page) goes
    // through buildBalancedTeams so the rules live in exactly one place.
    const previousTournament = await prisma.tournament.findFirst({
      where: { type: 'WEEKLY', startDate: { lt: tournament.startDate }, teams: { some: {} } },
      orderBy: { startDate: 'desc' },
      include: { tournamentTeamPlayers: { select: { teamId: true, playerId: true } } },
    });
    const previousTeamByPlayer = new Map<string, string>(
      previousTournament?.tournamentTeamPlayers.map((item) => [item.playerId, item.teamId]) ?? [],
    );

    const [acceptedChallenges, acceptedFriendInvites] = await Promise.all([
      prisma.tournamentChallenge.findMany({
        where: { tournamentId, status: 'ACCEPTED' },
        select: { requesterPlayerId: true, targetPlayerId: true },
      }),
      prisma.tournamentFriendInvite.findMany({
        where: { tournamentId, status: 'ACCEPTED' },
        select: { requesterPlayerId: true, targetPlayerId: true },
      }),
    ]);

    const generation = buildBalancedTeams(sortedPlayers, teamCount, {
      battlePairs: acceptedChallenges.map((pair) => ({
        firstId: pair.requesterPlayerId,
        secondId: pair.targetPlayerId,
      })),
      friendInvitePairs: acceptedFriendInvites.map((pair) => ({
        firstId: pair.requesterPlayerId,
        secondId: pair.targetPlayerId,
      })),
      previousTeamByPlayer,
    });
    const repeatTeammateSwaps = generation.repeatTeammateSwaps;

    const teams = generation.teams.map((generated, index) => ({
      name: `Team ${index + 1} - ${dateStr} (${teamNameSuffix})`,
      players: generated.players,
      totalTier: generated.totalTier,
      tier9Plus: generated.players.filter((player) => player.tier <= 2).length,
      lockedPlayers: generated.lockedPlayers,
    }));

    // Create teams in database
    const createdTeams = [];
    
    for (const teamData of teams) {
      
      const team = await prisma.team.create({
        data: {
          name: teamData.name,
          founded: new Date(),
          stats: { create: {} },
        },
      });

      // Add team to tournament
      await prisma.tournamentTeam.create({
        data: {
          tournamentId,
          teamId: team.id,
        },
      });

      // Assign players to the team in this tournament
      if (teamData.players.length > 0) {
        await prisma.tournamentTeamPlayer.createMany({
          data: teamData.players.map((player: any) => ({
            tournamentId,
            teamId: team.id,
            playerId: player.id,
          })),
        });
      }

      createdTeams.push({
        ...team,
        players: teamData.players,
        totalTier: teamData.totalTier,
        tier9Plus: teamData.tier9Plus,
      });
    }

    // League format uses a rotating double round-robin. Within one round a
    // team appears at most once, so crossing two rounds means no team plays
    // more than two consecutive matches. The second leg reverses home/away.
    if (tournament.format === 'LEAGUE') {
      const kickoff = new Date(tournament.startDate);
      const rotation: Array<string | null> = createdTeams.map((team) => team.id);
      if (rotation.length % 2 === 1) rotation.push(null); // bye slot
      const rounds: Array<Array<{ homeTeamId: string; awayTeamId: string }>> = [];
      const teamSlots = rotation.length;

      for (let roundIndex = 0; roundIndex < teamSlots - 1; roundIndex += 1) {
        const round: Array<{ homeTeamId: string; awayTeamId: string }> = [];
        for (let index = 0; index < teamSlots / 2; index += 1) {
          const left = rotation[index];
          const right = rotation[teamSlots - 1 - index];
          if (!left || !right) continue;
          const [homeTeamId, awayTeamId] = roundIndex % 2 === 0 ? [left, right] : [right, left];
          round.push({ homeTeamId, awayTeamId });
        }
        rounds.push(round);
        rotation.splice(1, 0, rotation.pop()!);
      }

      const fixtures = [...rounds.flat(), ...rounds.flat().map(({ homeTeamId, awayTeamId }) => ({
        homeTeamId: awayTeamId,
        awayTeamId: homeTeamId,
      }))].map((fixture, index) => ({
        tournamentId,
        ...fixture,
        durationMinutes: 10,
        scheduledDate: new Date(kickoff.getTime() + index * 10 * 60_000),
      }));
      if (fixtures.length) await prisma.match.createMany({ data: fixtures });
    }

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { pitchType: selectedField },
    });

    res.json({
      success: true,
      data: {
        teams: createdTeams,
        playerCount,
        teamCount,
        repeatTeammateSwaps,
      },
    });
  } catch (error) {
    console.error('Generate teams error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate teams',
    });
  }
});

export { router as tournamentSplitRoutes };
