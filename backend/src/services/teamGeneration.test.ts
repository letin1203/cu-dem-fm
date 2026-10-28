import { describe, expect, it } from 'vitest';
import {
  buildBalancedTeams,
  generateBalancedTeams,
  type TeamGenerationPlayer,
} from './teamGeneration';

const player = (
  id: string,
  tier: number,
  position = 'MID',
  positionSecond: string | null = null,
): TeamGenerationPlayer => ({
  id,
  name: `Player ${id}`,
  position,
  positionSecond,
  tier,
  avatar: null,
});

const totalTier = (players: TeamGenerationPlayer[]) =>
  players.reduce((sum, item) => sum + item.tier, 0);

const lowTierCount = (players: TeamGenerationPlayer[]) =>
  players.filter((item) => item.tier <= 2).length;

describe('generateBalancedTeams', () => {
  it('assigns every player exactly once', () => {
    const players = [
      ...Array.from({ length: 3 }, (_, index) => player(`gk${index}`, 3, 'GK')),
      ...Array.from({ length: 21 }, (_, index) => player(`p${index}`, 1 + (index % 6))),
    ];
    const teams = generateBalancedTeams(players, 3);

    const ids = teams.flatMap((team) => team.players.map((item) => item.id));
    expect(ids).toHaveLength(players.length);
    expect(new Set(ids).size).toBe(players.length);
  });

  it('gives every team exactly one goalkeeper when enough are available', () => {
    const players = [
      ...Array.from({ length: 4 }, (_, index) => player(`gk${index}`, 3, 'GK')),
      ...Array.from({ length: 20 }, (_, index) => player(`p${index}`, 1 + (index % 6))),
    ];
    const teams = generateBalancedTeams(players, 4);

    for (const team of teams) {
      expect(team.players.filter((item) => item.position === 'GK')).toHaveLength(1);
    }
    expect(teams.flatMap((team) => team.players)).toHaveLength(24);
  });

  it('keeps the Tier 1 + Tier 2 spread within one player', () => {
    const players = [
      ...Array.from({ length: 2 }, (_, index) => player(`t1-${index}`, 1)),
      ...Array.from({ length: 5 }, (_, index) => player(`t2-${index}`, 2)),
      ...Array.from({ length: 15 }, (_, index) => player(`t${index}`, 3 + (index % 4))),
    ];
    const teams = generateBalancedTeams(players, 3);
    const counts = teams.map((team) => lowTierCount(team.players));

    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(counts.reduce((sum, value) => sum + value, 0)).toBe(7);
  });

  it('spreads Tier 1 players as evenly as possible', () => {
    const players = [
      ...Array.from({ length: 2 }, (_, index) => player(`t1-${index}`, 1)),
      ...Array.from({ length: 4 }, (_, index) => player(`t2-${index}`, 2)),
      ...Array.from({ length: 12 }, (_, index) => player(`t${index}`, 3 + (index % 4))),
    ];
    const teams = generateBalancedTeams(players, 3);
    const tierOneCounts = teams.map(
      (team) => team.players.filter((item) => item.tier === 1).length,
    );

    expect(Math.max(...tierOneCounts) - Math.min(...tierOneCounts)).toBeLessThanOrEqual(1);
  });

  it('keeps team sizes within one player of each other', () => {
    const players = Array.from({ length: 32 }, (_, index) => player(`p${index}`, 1 + (index % 6)));
    const teams = generateBalancedTeams(players, 3);
    const sizes = teams.map((team) => team.players.length);

    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(32);
  });

  it('separates accepted battle pairs onto different teams', () => {
    const players = [
      ...Array.from({ length: 2 }, (_, index) => player(`gk${index}`, 3, 'GK')),
      ...Array.from({ length: 22 }, (_, index) => player(`p${index}`, 1 + (index % 6))),
    ];
    const teams = generateBalancedTeams(players, 2, [{ firstId: 'p0', secondId: 'p1' }]);
    const firstTeam = teams.findIndex((team) => team.players.some((item) => item.id === 'p0'));
    const secondTeam = teams.findIndex((team) => team.players.some((item) => item.id === 'p1'));

    expect(firstTeam).toBeGreaterThanOrEqual(0);
    expect(secondTeam).toBeGreaterThanOrEqual(0);
    expect(firstTeam).not.toBe(secondTeam);
  });

  it('keeps every team within the tier-balance invariants on repeated runs', () => {
    const players = Array.from({ length: 18 }, (_, index) => player(`p${index}`, 1 + (index % 6)));
    for (let run = 0; run < 5; run += 1) {
      const teams = generateBalancedTeams(players, 3);
      const ids = teams.flatMap((team) => team.players.map((item) => item.id));
      expect(new Set(ids).size).toBe(players.length);
      const totals = teams.map((team) => totalTier(team.players));
      expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(2);
    }
  });
});

describe('buildBalancedTeams', () => {
  const roster = () => [
    ...Array.from({ length: 3 }, (_, index) => player(`gk${index}`, 3, 'GK')),
    ...Array.from({ length: 21 }, (_, index) => player(`p${index}`, 1 + (index % 6))),
  ];

  it('returns three teams covering the whole input', () => {
    const players = roster();
    const result = buildBalancedTeams(players, 3);

    expect(result.teams).toHaveLength(3);
    const ids = result.teams.flatMap((team) => team.players.map((item) => item.id));
    expect(new Set(ids).size).toBe(players.length);
  });

  it('puts an accepted friend invite on the same team', () => {
    const players = [
      ...Array.from({ length: 3 }, (_, index) => player(`gk${index}`, 3, 'GK')),
      ...Array.from({ length: 21 }, (_, index) => player(`p${index}`, 3)),
    ];
    const result = buildBalancedTeams(players, 3, {
      friendInvitePairs: [{ firstId: 'p0', secondId: 'p1' }],
    });
    const teamIndex = result.teams.findIndex((team) =>
      team.players.some((item) => item.id === 'p0'),
    );
    const mateIndex = result.teams.findIndex((team) =>
      team.players.some((item) => item.id === 'p1'),
    );

    expect(teamIndex).toBeGreaterThanOrEqual(0);
    expect(mateIndex).toBe(teamIndex);
  });

  it('keeps accepted battle pairs apart', () => {
    const players = roster();
    const result = buildBalancedTeams(players, 3, {
      battlePairs: [{ firstId: 'p0', secondId: 'p2' }],
    });
    const firstTeam = result.teams.findIndex((team) =>
      team.players.some((item) => item.id === 'p0'),
    );
    const secondTeam = result.teams.findIndex((team) =>
      team.players.some((item) => item.id === 'p2'),
    );

    expect(firstTeam).not.toBe(secondTeam);
  });

  it('tries to avoid repeating two teammates from the previous week', () => {
    const players = roster();
    const previousTeamByPlayer = new Map<string, string>();
    players.forEach((item) => previousTeamByPlayer.set(item.id, 'previous-team'));

    const result = buildBalancedTeams(players, 3, { previousTeamByPlayer });
    const worstRepeat = Math.max(
      ...result.teams.map((team) =>
        team.players.filter(
          (item) =>
            team.players.filter(
              (mate) => mate.id !== item.id && previousTeamByPlayer.get(mate.id) === 'previous-team',
            ).length >= 2,
        ).length,
      ),
    );

    expect(worstRepeat).toBeLessThan(players.length);
  });

  it('sorts each team with goalkeepers first, then by tier', () => {
    const result = buildBalancedTeams(roster(), 3);

    for (const team of result.teams) {
      const outfieldTiers = team.players
        .filter((item) => item.position !== 'GK')
        .map((item) => item.tier);
      expect(outfieldTiers).toEqual([...outfieldTiers].sort((a, b) => a - b));

      const firstOutfieldIndex = team.players.findIndex((item) => item.position !== 'GK');
      if (firstOutfieldIndex >= 0) {
        expect(team.players.slice(0, firstOutfieldIndex).every((item) => item.position === 'GK')).toBe(true);
      }
    }
  });

  it('never mutates the caller input array', () => {
    const players = roster();
    const snapshot = players.map((item) => item.id);
    buildBalancedTeams(players, 3);

    expect(players.map((item) => item.id)).toEqual(snapshot);
  });

  it('balances total tier across equal-size teams', () => {
    const result = buildBalancedTeams(roster(), 3);
    const totals = result.teams.map((team) => totalTier(team.players));

    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(2);
  });
});
