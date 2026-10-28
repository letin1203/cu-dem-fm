import { describe, expect, it } from 'vitest';
import {
  applyGoalkeeperDiscount,
  calculateCostPerPlayer,
  calculateNetTournamentCost,
  calculateSettlementLines,
  computeLeagueStandings,
  sumSettlementLines,
  type SettlementContext,
  type SettlementPlayer,
} from './settlement';

const team = (id: string, score: number | null) => ({ id, score });
const player = (overrides: Partial<SettlementPlayer> = {}): SettlementPlayer => ({
  id: 'p1',
  name: 'Player One',
  position: 'MID',
  friendOwnerId: null,
  friendOwnerPlayerId: null,
  ...overrides,
});

const context = (overrides: Partial<SettlementContext> = {}): SettlementContext => ({
  tournamentCostPerPlayer: 50_000,
  noShowPenalty: 0,
  cancelledGkDiscountPlayerIds: new Set<string>(),
  invitedFriendPenaltyByPlayerId: new Map<string, number>(),
  challengeOpponentByPlayerId: new Map<string, string>(),
  teamByPlayerId: new Map([['p1', team('team-a', 3)]]),
  teamById: new Map([['team-a', team('team-a', 3)], ['team-b', team('team-b', 1)]]),
  deadmatchesByPlayerId: new Map(),
  winnerTeamId: 'team-a',
  loserTeamId: 'team-b',
  selfFunded: false,
  ...overrides,
});

const attendance = (overrides: Partial<{ bet: boolean; withWater: boolean; notOnField: boolean }> = {}) => ({
  bet: false,
  withWater: false,
  notOnField: false,
  ...overrides,
});

describe('calculateNetTournamentCost', () => {
  it('is stadium cost minus sponsor plus costs minus fund', () => {
    expect(calculateNetTournamentCost({
      stadiumCost: 2_200_000,
      sponsorMoney: 400_000,
      additionalCosts: 100_000,
      fundContribution: 200_000,
    })).toBe(1_700_000);
  });

  it('can be negative when the sponsor covers everything', () => {
    expect(calculateNetTournamentCost({
      stadiumCost: 1_000_000,
      sponsorMoney: 1_500_000,
      additionalCosts: 0,
      fundContribution: 0,
    })).toBe(-500_000);
  });
});

describe('calculateCostPerPlayer', () => {
  it('rounds the per-player share up to the nearest 5,000', () => {
    expect(calculateCostPerPlayer(1_700_000, 21)).toBe(85_000);
    expect(calculateCostPerPlayer(1_700_000, 20)).toBe(85_000);
    expect(calculateCostPerPlayer(1_000_000, 3)).toBe(335_000);
  });

  it('returns 0 without attending players', () => {
    expect(calculateCostPerPlayer(1_000_000, 0)).toBe(0);
  });

  it('returns 0 for a self-funded tournament', () => {
    expect(calculateCostPerPlayer(1_000_000, 20, true)).toBe(0);
  });
});

describe('applyGoalkeeperDiscount', () => {
  it('halves the cost for goalkeepers', () => {
    expect(applyGoalkeeperDiscount(85_000, true, false)).toBe(42_500);
  });

  it('charges full price when the discount is cancelled', () => {
    expect(applyGoalkeeperDiscount(85_000, true, true)).toBe(85_000);
  });

  it('never discounts outfield players', () => {
    expect(applyGoalkeeperDiscount(85_000, false, false)).toBe(85_000);
  });
});

describe('calculateSettlementLines', () => {
  it('charges the tournament cost and pays the winning bet', () => {
    const lines = calculateSettlementLines(player(), attendance({ bet: true }), context());
    expect(lines).toEqual([
      { description: 'Chi phí giải đấu mỗi cầu thủ', amount: -50_000 },
      { description: 'Ngôi sao hy vọng thắng', amount: 20_000 },
    ]);
    expect(sumSettlementLines(lines)).toBe(-30_000);
  });

  it('applies the goalkeeper discount', () => {
    const lines = calculateSettlementLines(player({ position: 'GK' }), attendance(), context());
    expect(lines[0]).toEqual({ description: 'Chi phí giải đấu mỗi cầu thủ (GK giảm 50%)', amount: -25_000 });
  });

  it('honours a cancelled goalkeeper discount', () => {
    const lines = calculateSettlementLines(
      player({ position: 'Goalkeeper' }),
      attendance(),
      context({ cancelledGkDiscountPlayerIds: new Set(['p1']) }),
    );
    expect(lines[0]).toEqual({ description: 'Chi phí giải đấu mỗi cầu thủ', amount: -50_000 });
  });

  it('charges the no-show penalty only when the player did not take the pitch', () => {
    const withPenalty = calculateSettlementLines(
      player(),
      attendance({ notOnField: true }),
      context({ noShowPenalty: 30_000 }),
    );
    expect(withPenalty).toContainEqual({ description: 'Phạt không lên sân', amount: -30_000 });

    const withoutPenalty = calculateSettlementLines(player(), attendance(), context({ noShowPenalty: 30_000 }));
    expect(withoutPenalty.some((line) => line.description === 'Phạt không lên sân')).toBe(false);
  });

  it('pays the battle winner and charges the battle loser', () => {
    const winner = calculateSettlementLines(
      player(),
      attendance(),
      context({ challengeOpponentByPlayerId: new Map([['p1', 'p2']]), teamByPlayerId: new Map([['p1', team('team-a', 3)], ['p2', team('team-b', 1)]]) }),
    );
    expect(winner).toContainEqual({ description: 'Battle thắng', amount: 10_000 });

    const loser = calculateSettlementLines(
      player({ id: 'p2' }),
      attendance(),
      context({ challengeOpponentByPlayerId: new Map([['p2', 'p1']]), teamByPlayerId: new Map([['p1', team('team-a', 3)], ['p2', team('team-b', 1)]]) }),
    );
    expect(loser).toContainEqual({ description: 'Battle thua', amount: -10_000 });
  });

  it('skips battle money on a tied score', () => {
    const lines = calculateSettlementLines(
      player(),
      attendance(),
      context({
        challengeOpponentByPlayerId: new Map([['p1', 'p2']]),
        teamByPlayerId: new Map([['p1', team('team-a', 2)], ['p2', team('team-b', 2)]]),
      }),
    );
    expect(lines.some((line) => line.description.startsWith('Battle'))).toBe(false);
  });

  it('settles every matched deadmatch', () => {
    const lines = calculateSettlementLines(
      player(),
      attendance(),
      context({
        deadmatchesByPlayerId: new Map([['p1', [{ opponentTeamId: 'team-b' }, { opponentTeamId: 'team-c' }]]]),
        teamById: new Map([
          ['team-a', team('team-a', 3)],
          ['team-b', team('team-b', 1)],
          ['team-c', team('team-c', 0)],
        ]),
      }),
    );
    expect(lines.filter((line) => line.description === 'Thắng Deadmatch')).toHaveLength(2);
    expect(lines).toContainEqual({ description: 'Thắng Deadmatch', amount: 10_000 });
  });

  it('charges a lost deadmatch', () => {
    const lines = calculateSettlementLines(
      player(),
      attendance(),
      context({
        deadmatchesByPlayerId: new Map([['p1', [{ opponentTeamId: 'team-a' }]]]),
        teamByPlayerId: new Map([['p1', team('team-b', 1)]]),
      }),
    );
    expect(lines).toContainEqual({ description: 'Thua Deadmatch', amount: -10_000 });
  });

  it('charges the losing team penalty even for a winning bet', () => {
    const lines = calculateSettlementLines(
      player(),
      attendance({ bet: true }),
      context({ winnerTeamId: 'team-b', loserTeamId: 'team-a' }),
    );
    expect(lines).toContainEqual({ description: 'Ngôi sao hy vọng thua', amount: -10_000 });
    expect(lines).toContainEqual({ description: 'Cầu thủ đội thua', amount: -10_000 });
  });

  it('gives the winning team free water and charges everyone else', () => {
    const winner = calculateSettlementLines(player(), attendance({ withWater: true }), context());
    expect(winner.some((line) => line.description === 'Chi phí nước')).toBe(false);

    const loser = calculateSettlementLines(
      player(),
      attendance({ withWater: true }),
      context({ winnerTeamId: 'team-b', loserTeamId: 'team-a' }),
    );
    expect(loser).toContainEqual({ description: 'Chi phí nước', amount: -10_000 });
  });

  it('never charges water or bets on a self-funded tournament', () => {
    const lines = calculateSettlementLines(
      player(),
      attendance({ withWater: true, bet: true }),
      context({ selfFunded: true }),
    );
    expect(lines.some((line) => line.description.includes('nước') || line.description.includes('hy vọng'))).toBe(false);
  });

  it('charges the friend-invite penalty', () => {
    const ownFriend = calculateSettlementLines(
      player(),
      attendance(),
      context({ invitedFriendPenaltyByPlayerId: new Map([['p1', 20_000]]) }),
    );
    expect(ownFriend).toContainEqual({ description: 'Rủ bạn cùng đội (bao gồm phần bạn)', amount: -20_000 });

    const otherFriend = calculateSettlementLines(
      player(),
      attendance(),
      context({ invitedFriendPenaltyByPlayerId: new Map([['p1', 10_000]]) }),
    );
    expect(otherFriend).toContainEqual({ description: 'Rủ bạn cùng đội', amount: -10_000 });
  });
});

describe('computeLeagueStandings', () => {
  it('ranks by points, then goal difference, then goals scored', () => {
    const standings = computeLeagueStandings(['a', 'b', 'c'], [
      { homeTeamId: 'a', awayTeamId: 'b', homeScore: 2, awayScore: 0 },
      { homeTeamId: 'b', awayTeamId: 'c', homeScore: 3, awayScore: 0 },
      { homeTeamId: 'c', awayTeamId: 'a', homeScore: 0, awayScore: 1 },
    ]);

    expect(standings.map((entry) => entry.teamId)).toEqual(['a', 'b', 'c']);
    expect(standings[0]).toMatchObject({ points: 6, goalsFor: 3, goalsAgainst: 0, goalDifference: 3 });
  });

  it('includes teams with no completed matches', () => {
    const standings = computeLeagueStandings(['a', 'b'], []);
    expect(standings.map((entry) => entry.teamId)).toEqual(['a', 'b']);
    expect(standings.every((entry) => entry.points === 0)).toBe(true);
  });

  it('ignores matches without a score', () => {
    const standings = computeLeagueStandings(['a', 'b'], [
      { homeTeamId: 'a', awayTeamId: 'b', homeScore: null, awayScore: null },
    ]);
    expect(standings.every((entry) => entry.points === 0)).toBe(true);
  });

  it('awards one point each on a draw', () => {
    const standings = computeLeagueStandings(['a', 'b'], [
      { homeTeamId: 'a', awayTeamId: 'b', homeScore: 1, awayScore: 1 },
    ]);
    expect(standings.map((entry) => entry.points)).toEqual([1, 1]);
  });
});
