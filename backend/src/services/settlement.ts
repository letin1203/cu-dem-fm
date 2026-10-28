/**
 * Pure settlement math for ending a weekly tournament.
 *
 * The HTTP route resolves all database state into plain maps and then calls
 * these functions, so every money rule can be unit tested without a database.
 */

export interface SettlementLine {
  description: string;
  amount: number;
}

export interface SettlementPlayer {
  id: string;
  name: string;
  position: string;
  friendOwnerId?: string | null;
  /** Player id of the linked user's own player, when this is a friend's player. */
  friendOwnerPlayerId?: string | null;
}

export interface SettlementAttendance {
  bet: boolean;
  withWater: boolean;
  notOnField: boolean;
}

export interface SettlementTeam {
  id: string;
  score: number | null;
}

export interface SettlementContext {
  tournamentCostPerPlayer: number;
  noShowPenalty: number;
  cancelledGkDiscountPlayerIds: ReadonlySet<string>;
  /** Friend-invite penalty charged to the requester (and possibly the target). */
  invitedFriendPenaltyByPlayerId: ReadonlyMap<string, number>;
  challengeOpponentByPlayerId: ReadonlyMap<string, string>;
  teamByPlayerId: ReadonlyMap<string, SettlementTeam>;
  teamById: ReadonlyMap<string, SettlementTeam>;
  deadmatchesByPlayerId: ReadonlyMap<string, ReadonlyArray<{ opponentTeamId: string }>>;
  winnerTeamId: string;
  loserTeamId: string;
  selfFunded: boolean;
}

export const WATER_COST_PER_PLAYER = 10_000;
export const BETTING_WIN_AMOUNT = 20_000;
export const BETTING_LOSS_AMOUNT = 10_000;
export const TEAM_LOSER_PENALTY = 10_000;
export const BATTLE_STAKE = 10_000;
export const DEADMATCH_STAKE = 10_000;

export const isGoalkeeperPosition = (position: string): boolean =>
  position === 'GK' || position === 'Goalkeeper';

/**
 * Goalkeepers receive a 50% tournament-cost discount unless staff cancelled it
 * from the end-tournament confirmation modal.
 */
export const applyGoalkeeperDiscount = (
  costPerPlayer: number,
  isGoalkeeper: boolean,
  discountCancelled: boolean,
): number => (isGoalkeeper && !discountCancelled ? Math.round(costPerPlayer / 2) : costPerPlayer);

/**
 * Net tournament cost shared by every attending player: stadium minus sponsor,
 * plus additional costs, minus the club-fund contribution. Callers zero out
 * sponsor money and additional costs for self-funded tournaments.
 */
export const calculateNetTournamentCost = (input: {
  stadiumCost: number;
  sponsorMoney: number;
  additionalCosts: number;
  fundContribution: number;
}): number => input.stadiumCost - input.sponsorMoney + input.additionalCosts - input.fundContribution;

/**
 * Per-player share of the net cost, rounded up to the nearest 5,000 VND. A
 * self-funded tournament never charges players, so the share is 0.
 */
export const calculateCostPerPlayer = (
  netCost: number,
  attendingCount: number,
  selfFunded = false,
): number => {
  if (selfFunded || attendingCount <= 0) return 0;
  return Math.ceil((netCost / attendingCount) / 5000) * 5000;
};

/**
 * Every money line applied to one player's balance. Pure: the route persists
 * the returned lines and the sum.
 */
export const calculateSettlementLines = (
  player: SettlementPlayer,
  attendance: SettlementAttendance,
  context: SettlementContext,
): SettlementLine[] => {
  const lines: SettlementLine[] = [];
  const playerTeam = context.teamByPlayerId.get(player.id);

  if (context.tournamentCostPerPlayer > 0) {
    const hasGkDiscount = isGoalkeeperPosition(player.position)
      && !context.cancelledGkDiscountPlayerIds.has(player.id);
    const tournamentCost = applyGoalkeeperDiscount(
      context.tournamentCostPerPlayer,
      isGoalkeeperPosition(player.position),
      context.cancelledGkDiscountPlayerIds.has(player.id),
    );
    lines.push({
      description: hasGkDiscount ? 'Chi phí giải đấu mỗi cầu thủ (GK giảm 50%)' : 'Chi phí giải đấu mỗi cầu thủ',
      amount: -tournamentCost,
    });
  }

  if (attendance.notOnField && context.noShowPenalty > 0) {
    lines.push({ description: 'Phạt không lên sân', amount: -context.noShowPenalty });
  }

  const friendInvitePenalty = context.invitedFriendPenaltyByPlayerId.get(player.id) || 0;
  if (friendInvitePenalty > 0) {
    lines.push({
      description: friendInvitePenalty === 20_000 ? 'Rủ bạn cùng đội (bao gồm phần bạn)' : 'Rủ bạn cùng đội',
      amount: -friendInvitePenalty,
    });
  }

  const opponentId = context.challengeOpponentByPlayerId.get(player.id);
  if (opponentId) {
    const opponentTeam = context.teamByPlayerId.get(opponentId);
    if (playerTeam && opponentTeam && playerTeam.score !== opponentTeam.score) {
      lines.push({
        description: playerTeam.score! > opponentTeam.score! ? 'Battle thắng' : 'Battle thua',
        amount: playerTeam.score! > opponentTeam.score! ? BATTLE_STAKE : -BATTLE_STAKE,
      });
    }
  }

  for (const deadmatch of context.deadmatchesByPlayerId.get(player.id) || []) {
    const opponentTeam = context.teamById.get(deadmatch.opponentTeamId);
    if (playerTeam && opponentTeam && playerTeam.score !== opponentTeam.score) {
      lines.push({
        description: playerTeam.score! > opponentTeam.score! ? 'Thắng Deadmatch' : 'Thua Deadmatch',
        amount: playerTeam.score! > opponentTeam.score! ? DEADMATCH_STAKE : -DEADMATCH_STAKE,
      });
    }
  }

  if (!context.selfFunded && attendance.bet) {
    lines.push(playerTeam && playerTeam.id === context.winnerTeamId
      ? { description: 'Ngôi sao hy vọng thắng', amount: BETTING_WIN_AMOUNT }
      : { description: 'Ngôi sao hy vọng thua', amount: -BETTING_LOSS_AMOUNT });
  }

  if (playerTeam && playerTeam.id === context.loserTeamId) {
    lines.push({ description: 'Cầu thủ đội thua', amount: -TEAM_LOSER_PENALTY });
  }

  if (!context.selfFunded && attendance.withWater && playerTeam && playerTeam.id !== context.winnerTeamId) {
    lines.push({ description: 'Chi phí nước', amount: -WATER_COST_PER_PLAYER });
  }

  return lines;
};

export const sumSettlementLines = (lines: SettlementLine[]): number =>
  lines.reduce((total, line) => total + line.amount, 0);

/**
 * A friend's tournament costs belong to the linked user's own player balance.
 */
export const resolvePayerPlayerId = (player: SettlementPlayer): string =>
  player.friendOwnerPlayerId || player.id;

export interface LeagueMatchResult {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface LeagueStanding {
  teamId: string;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

/**
 * League table used to decide the winner when a LEAGUE tournament ends:
 * points, then goal difference, then goals scored.
 */
export const computeLeagueStandings = (
  teamIds: string[],
  matches: LeagueMatchResult[],
): LeagueStanding[] => {
  const standings = new Map<string, LeagueStanding>();
  const ensure = (teamId: string): LeagueStanding => {
    const existing = standings.get(teamId);
    if (existing) return existing;
    const created: LeagueStanding = { teamId, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 };
    standings.set(teamId, created);
    return created;
  };

  teamIds.forEach(ensure);

  for (const match of matches) {
    if (match.homeScore === null || match.awayScore === null) continue;
    // Only matches between tournament teams count towards the table.
    const home = standings.get(match.homeTeamId);
    const away = standings.get(match.awayTeamId);
    if (!home || !away) continue;
    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;
    if (match.homeScore > match.awayScore) home.points += 3;
    else if (match.awayScore > match.homeScore) away.points += 3;
    else { home.points += 1; away.points += 1; }
  }

  for (const standing of standings.values()) {
    standing.goalDifference = standing.goalsFor - standing.goalsAgainst;
  }

  return [...standings.values()].sort(
    (first, second) =>
      second.points - first.points
      || second.goalDifference - first.goalDifference
      || second.goalsFor - first.goalsFor,
  );
};
