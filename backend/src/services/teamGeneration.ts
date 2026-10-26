export interface TeamGenerationPlayer {
  id: string;
  name: string;
  position: string;
  positionSecond: string | null;
  tier: number;
  avatar: string | null;
}

export interface GeneratedTeam {
  players: TeamGenerationPlayer[];
  totalTier: number;
  lockedPlayers: Set<string>;
}

export interface TeamBattlePair {
  firstId: string;
  secondId: string;
}

export interface TeamGenerationTrace {
  swaps: Array<{ firstId: string; secondId: string }>;
}

const isGoalkeeper = (player: TeamGenerationPlayer) =>
  player.position === 'GK' || player.position === 'Goalkeeper';
const shuffled = <T>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

/**
 * Single source of truth for random team splitting. Tier 1/2 and the first
 * goalkeeper of each team are protected; only Tier 3-6 can be swapped while
 * minimizing the spread of average tier between teams.
 */
export function generateBalancedTeams(
  inputPlayers: TeamGenerationPlayer[],
  teamCount: number,
  battlePairs: TeamBattlePair[] = [],
  trace?: TeamGenerationTrace,
): GeneratedTeam[] {
  const players = [...inputPlayers].sort((a, b) => a.tier - b.tier);
  const teams: GeneratedTeam[] = Array.from({ length: teamCount }, () => ({
    players: [], totalTier: 0, lockedPlayers: new Set<string>(),
  }));
  const teamOrder = shuffled(teams.map((_, index) => index));
  const targets = teams.map(() => Math.floor(players.length / teamCount));
  teamOrder.slice(0, players.length % teamCount).forEach((teamIndex) => { targets[teamIndex] += 1; });
  const add = (teamIndex: number, player: TeamGenerationPlayer, lock = false) => {
    teams[teamIndex].players.push(player);
    teams[teamIndex].totalTier += player.tier;
    if (lock || player.tier <= 2) teams[teamIndex].lockedPlayers.add(player.id);
  };
  const primaryGks = players.filter(isGoalkeeper);
  const remaining = players.filter((player) => !isGoalkeeper(player));

  primaryGks.forEach((player, index) => {
    if (index < teamCount) {
      add(teamOrder[index], player, true);
      return;
    }
    const minGk = Math.min(...teams.map((team) => team.players.filter(isGoalkeeper).length));
    const teamIndex = teams.findIndex((team) => team.players.filter(isGoalkeeper).length === minGk);
    add(teamIndex, player);
  });

  for (const teamIndex of teams.map((team, index) => ({ team, index })).filter(({ team }) => !team.players.some(isGoalkeeper)).map(({ index }) => index)) {
    const secondaryIndex = remaining.findIndex((player) => player.positionSecond === 'GK');
    if (secondaryIndex < 0) break;
    const [player] = remaining.splice(secondaryIndex, 1);
    add(teamIndex, player, true);
  }

  const countTier = (team: GeneratedTeam, tier: number) =>
    team.players.filter((player) => player.tier === tier).length;
  for (let tier = 1; tier <= 6; tier++) {
    for (const player of shuffled(remaining.filter((candidate) => candidate.tier === tier))) {
      const eligible = teams
        .map((team, index) => ({ team, index }))
        .filter(({ team, index }) => team.players.length < targets[index]);
      const pool = eligible.length ? eligible : teams.map((team, index) => ({ team, index }));
      let candidates = pool;
      if (tier <= 2) {
        // Tier 1-2 are protected from later balancing. For Tier 2, a team
        // with fewer Tier 1 players must always be considered first; this is
        // the primary strength-distribution rule, not merely a tie-break.
        const lowTierCount = ({ team }: { team: GeneratedTeam }) =>
          team.players.filter((player) => player.tier <= 2).length;
        
        const minLowTierCount = Math.min(...pool.map(lowTierCount));
        candidates = pool.filter((candidate) => lowTierCount(candidate) === minLowTierCount);
        
        const minCount = Math.min(...candidates.map(({ team }) => countTier(team, tier)));
        candidates = candidates.filter(({ team }) => countTier(team, tier) === minCount);
      }
      candidates.sort((a, b) => {
        // Tier 3 is the first flexible balancing tier. Teams that already
        // received more Tier 1–2 players should receive fewer Tier 3 players.
        if (tier === 2) {
          const tierOneDifference = countTier(a.team, 1) - countTier(b.team, 1);
          if (tierOneDifference) return tierOneDifference;
        }
        if (tier === 3) {
          const lowTierDifference = a.team.players.filter((player) => player.tier <= 2).length
            - b.team.players.filter((player) => player.tier <= 2).length;
          if (lowTierDifference) return lowTierDifference;
        }
        const capacityDifference = a.team.players.length / targets[a.index] - b.team.players.length / targets[b.index];
        if (capacityDifference) return capacityDifference;
        const tierDifference = a.team.totalTier - b.team.totalTier;
        return tierDifference || Math.random() - 0.5;
      });
      add(candidates[0].index, player);
    }
  }

  // Keep Tier 1/2 distribution fixed. Only Tier 3-6 may be used to balance
  // averages when team sizes differ.
  teams.flatMap((team) => team.players).filter((player) => player.tier <= 2)
    .forEach((player) => teams.find((team) => team.players.some((candidate) => candidate.id === player.id))?.lockedPlayers.add(player.id));

  const averageSpread = (totals: number[]) => {
    const averages = totals.map((total, index) => total / teams[index].players.length);
    return Math.max(...averages) - Math.min(...averages);
  };
  const averageVariance = (totals: number[]) => {
    const averages = totals.map((total, index) => total / teams[index].players.length);
    const mean = averages.reduce((sum, value) => sum + value, 0) / averages.length;
    return averages.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  };
  const improvesBalance = (
    nextSpread: number,
    nextVariance: number,
    currentSpread: number,
    currentVariance: number,
  ) =>
    nextSpread < currentSpread - 0.000001 ||
    (Math.abs(nextSpread - currentSpread) < 0.000001 &&
      nextVariance < currentVariance - 0.000001);
  const balanceValues = (totals: number[]) => {
    const equalTeamSizes = teams.every((team) => team.players.length === teams[0].players.length);
    return equalTeamSizes
      ? totals
      : totals.map((total, index) => total / teams[index].players.length);
  };
  for (let iteration = 0; iteration < 100; iteration++) {
    const totals = teams.map((team) => team.totalTier);
    const spread = averageSpread(totals);
    const variance = averageVariance(totals);
    const values = balanceValues(totals);
    const lowestValue = Math.min(...values);
    const highestValue = Math.max(...values);
    let best: { a: number; b: number; ai: number; bi: number; spread: number; variance: number } | null = null;
    for (let a = 0; a < teams.length; a++) for (let b = a + 1; b < teams.length; b++) {
      const comparesExtremes =
        (Math.abs(values[a] - lowestValue) < 0.000001 && Math.abs(values[b] - highestValue) < 0.000001) ||
        (Math.abs(values[b] - lowestValue) < 0.000001 && Math.abs(values[a] - highestValue) < 0.000001);
      if (!comparesExtremes) continue;
      for (let ai = 0; ai < teams[a].players.length; ai++) for (let bi = 0; bi < teams[b].players.length; bi++) {
        const first = teams[a].players[ai]; const second = teams[b].players[bi];
        if (teams[a].lockedPlayers.has(first.id) || teams[b].lockedPlayers.has(second.id) || isGoalkeeper(first) !== isGoalkeeper(second)) continue;
        const next = [...totals];
        next[a] += second.tier - first.tier; next[b] += first.tier - second.tier;
        const nextSpread = averageSpread(next);
        const nextVariance = averageVariance(next);
        if (improvesBalance(nextSpread, nextVariance, spread, variance) &&
          (!best || nextSpread < best.spread - 0.000001 ||
            (Math.abs(nextSpread - best.spread) < 0.000001 && nextVariance < best.variance))) {
          best = { a, b, ai, bi, spread: nextSpread, variance: nextVariance };
        }
      }
    }
    if (!best) break;
    const first = teams[best.a].players[best.ai];
    const second = teams[best.b].players[best.bi];
    teams[best.a].players[best.ai] = second;
    teams[best.b].players[best.bi] = first;
    teams[best.a].totalTier += second.tier - first.tier;
    teams[best.b].totalTier += first.tier - second.tier;
    trace?.swaps.push({ firstId: first.id, secondId: second.id });
  }

  // A Battle pair must be on opposing teams. Do this after normal balancing
  // so it cannot disturb GK/Tier distribution unless an equivalent swap is
  // available. Strong Tier 1/2 players may only be exchanged with their own
  // tier, preserving their even distribution.
  const battlePartnerById = new Map<string, string>();
  battlePairs.forEach((pair) => {
    battlePartnerById.set(pair.firstId, pair.secondId);
    battlePartnerById.set(pair.secondId, pair.firstId);
  });

  // Resolving one pair can affect a later pair. Re-check the complete list
  // until every feasible pair is separated, while never creating a new pair
  // on the same team as a side effect.
  for (let pass = 0; pass < battlePairs.length; pass++) for (const pair of battlePairs) {
    const firstTeamIndex = teams.findIndex((team) => team.players.some((player) => player.id === pair.firstId));
    const secondTeamIndex = teams.findIndex((team) => team.players.some((player) => player.id === pair.secondId));
    if (firstTeamIndex < 0 || secondTeamIndex < 0 || firstTeamIndex !== secondTeamIndex) continue;

    const sourceIndex = firstTeamIndex;
    const pairPlayers = [pair.firstId, pair.secondId]
      .map((id) => teams[sourceIndex].players.find((player) => player.id === id))
      .filter((player): player is TeamGenerationPlayer => Boolean(player));
    let bestMove: { playerIndex: number; destinationIndex: number; replacementIndex: number; spread: number } | null = null;
    const totals = teams.map((team) => team.totalTier);

    for (const player of pairPlayers) {
      const playerIndex = teams[sourceIndex].players.findIndex((candidate) => candidate.id === player.id);
      for (let destinationIndex = 0; destinationIndex < teams.length; destinationIndex++) {
        if (destinationIndex === sourceIndex) continue;
        for (let replacementIndex = 0; replacementIndex < teams[destinationIndex].players.length; replacementIndex++) {
          const replacement = teams[destinationIndex].players[replacementIndex];
          if (isGoalkeeper(player) !== isGoalkeeper(replacement)) continue;
          if ((player.tier <= 2 || replacement.tier <= 2) && player.tier !== replacement.tier) continue;
          const playerPartnerId = battlePartnerById.get(player.id);
          const replacementPartnerId = battlePartnerById.get(replacement.id);
          if (playerPartnerId && teams[destinationIndex].players.some((candidate) => candidate.id === playerPartnerId)) continue;
          if (replacementPartnerId && teams[sourceIndex].players.some((candidate) => candidate.id === replacementPartnerId && candidate.id !== player.id)) continue;
          const next = [...totals];
          next[sourceIndex] += replacement.tier - player.tier;
          next[destinationIndex] += player.tier - replacement.tier;
          const spread = averageSpread(next);
          if (!bestMove || spread < bestMove.spread) bestMove = { playerIndex, destinationIndex, replacementIndex, spread };
        }
      }
    }
    if (!bestMove) continue;
    const moved = teams[sourceIndex].players[bestMove.playerIndex];
    const replacement = teams[bestMove.destinationIndex].players[bestMove.replacementIndex];
    teams[sourceIndex].players[bestMove.playerIndex] = replacement;
    teams[bestMove.destinationIndex].players[bestMove.replacementIndex] = moved;
    teams[sourceIndex].totalTier += replacement.tier - moved.tier;
    teams[bestMove.destinationIndex].totalTier += moved.tier - replacement.tier;
    trace?.swaps.push({ firstId: moved.id, secondId: replacement.id });
  }

  // A Battle separation can slightly disturb the tier balance. Make one final
  // balancing pass, but reject every swap that would put a Battle pair back
  // together.
  for (let iteration = 0; iteration < 100; iteration++) {
    const totals = teams.map((team) => team.totalTier);
    const spread = averageSpread(totals);
    const variance = averageVariance(totals);
    const values = balanceValues(totals);
    const lowestValue = Math.min(...values);
    const highestValue = Math.max(...values);
    let best: { a: number; b: number; ai: number; bi: number; spread: number; variance: number } | null = null;
    for (let a = 0; a < teams.length; a++) for (let b = a + 1; b < teams.length; b++) {
      const comparesExtremes =
        (Math.abs(values[a] - lowestValue) < 0.000001 && Math.abs(values[b] - highestValue) < 0.000001) ||
        (Math.abs(values[b] - lowestValue) < 0.000001 && Math.abs(values[a] - highestValue) < 0.000001);
      if (!comparesExtremes) continue;
      for (let ai = 0; ai < teams[a].players.length; ai++) for (let bi = 0; bi < teams[b].players.length; bi++) {
        const first = teams[a].players[ai]; const second = teams[b].players[bi];
        if (teams[a].lockedPlayers.has(first.id) || teams[b].lockedPlayers.has(second.id) || isGoalkeeper(first) !== isGoalkeeper(second)) continue;
        const firstPartnerId = battlePartnerById.get(first.id);
        const secondPartnerId = battlePartnerById.get(second.id);
        if (firstPartnerId && teams[b].players.some((candidate) => candidate.id === firstPartnerId)) continue;
        if (secondPartnerId && teams[a].players.some((candidate) => candidate.id === secondPartnerId)) continue;
        const next = [...totals];
        next[a] += second.tier - first.tier; next[b] += first.tier - second.tier;
        const nextSpread = averageSpread(next);
        const nextVariance = averageVariance(next);
        if (improvesBalance(nextSpread, nextVariance, spread, variance) &&
          (!best || nextSpread < best.spread - 0.000001 ||
            (Math.abs(nextSpread - best.spread) < 0.000001 && nextVariance < best.variance))) {
          best = { a, b, ai, bi, spread: nextSpread, variance: nextVariance };
        }
      }
    }
    if (!best) break;
    const first = teams[best.a].players[best.ai];
    const second = teams[best.b].players[best.bi];
    teams[best.a].players[best.ai] = second;
    teams[best.b].players[best.bi] = first;
    teams[best.a].totalTier += second.tier - first.tier;
    teams[best.b].totalTier += first.tier - second.tier;
    trace?.swaps.push({ firstId: first.id, secondId: second.id });
  }
  teams.forEach((team) => {
    team.players.sort((first, second) => {
      const goalkeeperDifference = Number(isGoalkeeper(second)) - Number(isGoalkeeper(first));
      if (goalkeeperDifference) return goalkeeperDifference;
      const tierDifference = first.tier - second.tier;
      return tierDifference || first.name.localeCompare(second.name, 'vi');
    });
  });
  return teams;
}

export interface TeamGenerationOptions {
  /** Accepted challenges: the two players must end up on opposing teams. */
  battlePairs?: TeamBattlePair[];
  /** Accepted friend invites: the two players must end up on the same team. */
  friendInvitePairs?: TeamBattlePair[];
  /** Team id each player had in the previous weekly tournament. */
  previousTeamByPlayer?: Map<string, string>;
}

export interface TeamGenerationResult {
  teams: GeneratedTeam[];
  /** Balancing swaps, in the order they were applied. */
  swaps: Array<{ firstId: string; secondId: string }>;
  /** Swaps made only to avoid repeating teammates from the previous week. */
  repeatTeammateSwaps: Array<{ firstId: string; secondId: string }>;
}

const findTeamIndex = (teams: GeneratedTeam[], playerId: string): number =>
  teams.findIndex((team) => team.players.some((player) => player.id === playerId));

const sortTeamPlayers = (team: GeneratedTeam): void => {
  team.players.sort((first, second) => {
    const goalkeeperDifference = Number(isGoalkeeper(second)) - Number(isGoalkeeper(first));
    if (goalkeeperDifference) return goalkeeperDifference;
    return first.tier - second.tier || first.name.localeCompare(second.name, 'vi');
  });
};

/**
 * Single entry point for every team split in the app: the official
 * "Chia đội", the "Test chia đội" preview inside the modal, and the
 * "Test chia team" page all call this. Change the rules here once.
 *
 * Order of operations:
 *  1. Balanced split (GK + Tier distribution, Battle pairs separated).
 *  2. Avoid repeating too many teammates from the previous week.
 *  3. Accepted challenges must be on opposing teams.
 *  4. Accepted friend invites must share a team.
 */
export function buildBalancedTeams(
  inputPlayers: TeamGenerationPlayer[],
  teamCount: number,
  options: TeamGenerationOptions = {},
): TeamGenerationResult {
  const battlePairs = options.battlePairs ?? [];
  const friendInvitePairs = options.friendInvitePairs ?? [];
  const previousTeamByPlayer = options.previousTeamByPlayer;

  const trace: TeamGenerationTrace = { swaps: [] };
  const teams = generateBalancedTeams(inputPlayers, teamCount, battlePairs, trace);
  const repeatTeammateSwaps: Array<{ firstId: string; secondId: string }> = [];

  // 2. Avoid keeping a player with two or more of the same teammates for a
  // second consecutive weekly tournament. Swaps are same-tier and preserve GK
  // distribution, so the tier balance established above cannot change.
  if (previousTeamByPlayer && previousTeamByPlayer.size) {
    const battlePartnerByPlayer = new Map<string, string>();
    battlePairs.forEach((pair) => {
      battlePartnerByPlayer.set(pair.firstId, pair.secondId);
      battlePartnerByPlayer.set(pair.secondId, pair.firstId);
    });
    const repeatedTeammates = (player: TeamGenerationPlayer, team: GeneratedTeam): number => {
      const previousTeam = previousTeamByPlayer.get(player.id);
      if (!previousTeam) return 0;
      return team.players.filter(
        (mate) => mate.id !== player.id && previousTeamByPlayer.get(mate.id) === previousTeam,
      ).length;
    };
    const wouldBreakBattle = (player: TeamGenerationPlayer, destination: GeneratedTeam): boolean => {
      const partnerId = battlePartnerByPlayer.get(player.id);
      return Boolean(partnerId && destination.players.some((mate) => mate.id === partnerId));
    };

    for (let pass = 0; pass < teams.length * inputPlayers.length; pass += 1) {
      let swapped = false;
      for (let sourceIndex = 0; sourceIndex < teams.length && !swapped; sourceIndex += 1) {
        const source = teams[sourceIndex];
        for (let playerIndex = 0; playerIndex < source.players.length && !swapped; playerIndex += 1) {
          const player = source.players[playerIndex];
          if (repeatedTeammates(player, source) < 2) continue;
          for (let destinationIndex = 0; destinationIndex < teams.length && !swapped; destinationIndex += 1) {
            if (destinationIndex === sourceIndex) continue;
            const destination = teams[destinationIndex];
            for (let replacementIndex = 0; replacementIndex < destination.players.length; replacementIndex += 1) {
              const replacement = destination.players[replacementIndex];
              if (isGoalkeeper(player) !== isGoalkeeper(replacement) || player.tier !== replacement.tier) continue;
              if (wouldBreakBattle(player, destination) || wouldBreakBattle(replacement, source)) continue;
              const sourceAfter: GeneratedTeam = {
                ...source,
                players: source.players.map((item, index) => (index === playerIndex ? replacement : item)),
              };
              const destinationAfter: GeneratedTeam = {
                ...destination,
                players: destination.players.map((item, index) => (index === replacementIndex ? player : item)),
              };
              if (repeatedTeammates(player, destinationAfter) > 1) continue;
              if (repeatedTeammates(replacement, sourceAfter) > 1) continue;
              source.players[playerIndex] = replacement;
              destination.players[replacementIndex] = player;
              repeatTeammateSwaps.push({ firstId: player.id, secondId: replacement.id });
              swapped = true;
              break;
            }
          }
        }
      }
      if (!swapped) break;
    }
  }

  // 3. Accepted challenges must always be on opposing teams. The generator
  // already tries this; this pass is a safety net for pairs it could not
  // separate. Same-tier, same-GK-type swaps keep the balance intact.
  for (const pair of battlePairs) {
    const firstTeamIndex = findTeamIndex(teams, pair.firstId);
    const secondTeamIndex = findTeamIndex(teams, pair.secondId);
    if (firstTeamIndex < 0 || secondTeamIndex < 0 || firstTeamIndex !== secondTeamIndex) continue;
    const sourceTeam = teams[secondTeamIndex];
    const targetIndex = sourceTeam.players.findIndex((player) => player.id === pair.secondId);
    const target = sourceTeam.players[targetIndex];
    const isCompatible = (player: TeamGenerationPlayer) =>
      isGoalkeeper(player) === isGoalkeeper(target) &&
      player.tier === target.tier &&
      player.id !== pair.firstId &&
      player.id !== pair.secondId;
    const destinationIndex = teams.findIndex(
      (team, index) => index !== secondTeamIndex && team.players.some(isCompatible),
    );
    if (destinationIndex < 0) continue;
    const destination = teams[destinationIndex];
    const replacementIndex = destination.players.findIndex(isCompatible);
    const replacement = destination.players[replacementIndex];
    sourceTeam.players[targetIndex] = replacement;
    destination.players[replacementIndex] = target;
    sourceTeam.totalTier += replacement.tier - target.tier;
    destination.totalTier += target.tier - replacement.tier;
  }

  // 4. Accepted friend invites must share a team. Move the target beside the
  // requester by exchanging a same-tier, same-GK-type player.
  for (const pair of friendInvitePairs) {
    const requesterTeamIndex = findTeamIndex(teams, pair.firstId);
    const targetTeamIndex = findTeamIndex(teams, pair.secondId);
    if (requesterTeamIndex < 0 || targetTeamIndex < 0 || requesterTeamIndex === targetTeamIndex) continue;
    const requesterTeam = teams[requesterTeamIndex];
    const targetTeam = teams[targetTeamIndex];
    const targetIndex = targetTeam.players.findIndex((player) => player.id === pair.secondId);
    const target = targetTeam.players[targetIndex];
    const replacementIndex = requesterTeam.players.findIndex(
      (player) =>
        player.id !== pair.firstId &&
        player.tier === target.tier &&
        isGoalkeeper(player) === isGoalkeeper(target),
    );
    if (replacementIndex < 0) continue;
    const replacement = requesterTeam.players[replacementIndex];
    requesterTeam.players[replacementIndex] = target;
    targetTeam.players[targetIndex] = replacement;
  }

  teams.forEach(sortTeamPlayers);
  return { teams, swaps: trace.swaps, repeatTeammateSwaps };
}
