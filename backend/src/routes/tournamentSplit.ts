import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { buildBalancedTeams } from '../services/teamGeneration';
import { buildAiSplitGraph } from '../services/aiTeamSplit';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

interface SplitInput {
  players: Array<{
    id: string;
    name: string;
    position: string;
    positionSecond: string | null;
    tier: number;
    avatar: string | null;
  }>;
  battlePairs: Array<{ firstId: string; secondId: string }>;
  friendInvitePairs: Array<{ firstId: string; secondId: string }>;
  previousTeamByPlayer?: Map<string, string>;
}

type SplitResolution =
  | { ok: true; input: SplitInput }
  | { ok: false; status: number; error: string };

/**
 * Resolve the roster and pairing rules shared by the preview endpoint and the
 * AI split graph endpoint, so both always run the exact same pipeline.
 */
const resolveSplitInput = async (body: any): Promise<SplitResolution> => {
  const { playerIds, teamCount, battlePairs = [], friendInvitePairs = [], tournamentId } = body || {};
  if (!Array.isArray(playerIds) || playerIds.length < 10 || ![2, 3, 4].includes(teamCount)) {
    return { ok: false, status: 400, error: 'Danh sách cầu thủ hoặc số đội không hợp lệ' };
  }
  const uniqueIds = [...new Set(playerIds as string[])];
  // Friend-owned players take part in tournaments exactly like regular
  // players, so they must not be filtered out here. Only inactive players
  // are rejected.
  const players = await prisma.player.findMany({
    where: { id: { in: uniqueIds }, isActive: true },
    select: { id: true, name: true, position: true, positionSecond: true, tier: true, avatar: true },
  });
  if (players.length !== uniqueIds.length) {
    return { ok: false, status: 400, error: 'Có cầu thủ không còn hoạt động hoặc không hợp lệ' };
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

  return {
    ok: true,
    input: {
      players,
      battlePairs: tournamentBattlePairs,
      friendInvitePairs: tournamentFriendInvitePairs,
      previousTeamByPlayer,
    },
  };
};

// Preview exactly the same team-splitting algorithm without creating teams or
// changing any tournament data. Used by the Test chia team page.
router.post('/preview-teams', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const resolution = await resolveSplitInput(req.body);
    if (!resolution.ok) {
      res.status(resolution.status).json({ success: false, error: resolution.error });
      return;
    }
    const { players, battlePairs, friendInvitePairs, previousTeamByPlayer } = resolution.input;
    const generation = buildBalancedTeams(players, req.body.teamCount, {
      battlePairs,
      friendInvitePairs,
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
      phases: generation.phases,
    } });
  } catch (error) {
    console.error('Preview teams error:', error);
    res.status(500).json({ success: false, error: 'Không thể xem trước kết quả chia đội' });
  }
});

/**
 * Run the real team-split pipeline and return the execution graph the
 * "AI chia team" modal renders. The graph is derived from the run itself, so
 * the node statuses, per-phase timings and team contents are never canned.
 */
router.post('/ai-split', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const createdAt = new Date();
  const startedAt = Date.now();
  try {
    const resolution = await resolveSplitInput(req.body);
    if (!resolution.ok) {
      res.status(resolution.status).json({ success: false, error: resolution.error });
      return;
    }
    const { players, battlePairs, friendInvitePairs, previousTeamByPlayer } = resolution.input;
    const teamCount = req.body.teamCount as number;
    const generation = buildBalancedTeams(players, teamCount, {
      battlePairs,
      friendInvitePairs,
      previousTeamByPlayer,
    });
    const graph = buildAiSplitGraph({
      taskId: req.body.taskId || `ai-split-${createdAt.getTime()}`,
      createdAt,
      durationMs: Date.now() - startedAt,
      players,
      teamCount,
      result: generation,
      instruction: typeof req.body?.instruction === 'string'
        ? req.body.instruction.slice(0, 240)
        : undefined,
    });
    res.json({ success: true, data: graph });
  } catch (error) {
    console.error('AI split error:', error);
    const createdAtIso = createdAt;
    res.status(500).json({
      success: false,
      error: 'Không thể chạy AI chia team',
      data: {
        taskId: req.body?.taskId || `ai-split-${createdAtIso.getTime()}`,
        createdAt: createdAtIso.toISOString(),
        status: 'FAILED',
        durationMs: Date.now() - startedAt,
        events: [{
          id: `${createdAtIso.getTime()}-failure`,
          at: new Date().toISOString(),
          phase: 'failure',
          message: error instanceof Error ? error.message : 'Unknown error',
          status: 'FAILED',
          durationMs: Date.now() - startedAt,
        }],
      },
    });
  }
});

interface GeneratedTeamInput {
  players: Array<Record<string, any>>;
  totalTier: number;
}

/**
 * Persist a team split for a tournament.
 *
 * Shared by the random and AI endpoints so both store teams identically; the AI
 * path used to be a separate route with its own copy of this logic.
 */
const persistTeams = async (
  tournamentId: string,
  tournament: { startDate: Date; format: string },
  generated: GeneratedTeamInput[],
  withLeagueFixtures: boolean,
) => {
  // Team names are globally unique. A tournament can be recreated on the same
  // day, so include a short, stable tournament identifier to avoid a collision
  // with teams from an earlier tournament.
  const dateStr = new Date(tournament.startDate).toISOString().split('T')[0];
  const teamNameSuffix = tournamentId.slice(-6);

  const createdTeams: any[] = [];
  for (const [index, teamData] of generated.entries()) {
    const team = await prisma.team.create({
      data: {
        name: `Team ${index + 1} - ${dateStr} (${teamNameSuffix})`,
        founded: new Date(),
        stats: { create: {} },
      },
    });

    await prisma.tournamentTeam.create({ data: { tournamentId, teamId: team.id } });

    if (teamData.players.length > 0) {
      await prisma.tournamentTeamPlayer.createMany({
        data: teamData.players.map((player) => ({
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
      tier9Plus: teamData.players.filter((player) => player.tier <= 2).length,
    });
  }

  /*
   * League format uses a rotating double round-robin. Within one round a team
   * appears at most once, so crossing two rounds means no team plays more than
   * two consecutive matches. The second leg reverses home/away.
   */
  if (withLeagueFixtures && tournament.format === 'LEAGUE') {
    const kickoff = new Date(tournament.startDate);
    const rotation: Array<string | null> = createdTeams.map((team) => team.id);
    if (rotation.length % 2 === 1) rotation.push(null);
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

  return createdTeams;
};

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

    /*
     * Every split (official, modal preview and the Test chia team page) goes
     * through buildBalancedTeams so the rules live in exactly one place.
     */
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

    const createdTeams = await persistTeams(
      tournamentId,
      tournament,
      generation.teams,
      true,
    );

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
        repeatTeammateSwaps: generation.repeatTeammateSwaps,
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

/**
 * Persist the result of an AI split the user just reviewed.
 *
 * The AI modal replays a graph produced by `/ai-split`; this endpoint stores
 * that exact split, so what was shown on screen is what gets written. The
 * players are re-derived server-side from the tournament's attendance (never
 * trusted from the client) and the same pipeline runs again to guarantee the
 * stored teams are valid.
 */
router.post(
  '/:id/apply-ai-teams',
  authenticate,
  authorize(['ADMIN', 'MOD']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
      });
      if (!tournament) {
        res.status(404).json({ success: false, error: 'Tournament not found' });
        return;
      }

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

      let teamCount: number = requestedTeamCount;
      if (!teamCount) {
        if (playerCount < 15) teamCount = 2;
        else if (playerCount < 20) teamCount = 3;
        else teamCount = 4;
      }

      const sortedPlayers = attendingPlayers
        .map((attendance) => attendance.player)
        .sort((a, b) => a.tier - b.tier);

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

      const createdTeams = await persistTeams(tournamentId, tournament, generation.teams, true);

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
          repeatTeammateSwaps: generation.repeatTeammateSwaps,
        },
      });
    } catch (error) {
      console.error('Apply AI teams error:', error);
      res.status(500).json({ success: false, error: 'Failed to apply AI teams' });
    }
  },
);

export { router as tournamentSplitRoutes };
