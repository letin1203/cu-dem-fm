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

/**
 * One recorded stage of a real team-split run.
 *
 * Phases are appended as the algorithm executes, so the admin UI can render
 * exactly what happened (order, duration, counts) instead of a canned script.
 */
export interface TeamGenerationPhase {
  id: string;
  label: string;
  detail: string;
  status: 'COMPLETED' | 'FAILED';
  /** Measured wall-clock duration of this stage. */
  durationMs: number;
  metrics: Record<string, string | number>;
}

/** One player moving into a team during the initial allocation. */
export interface TeamAllocationStep {
  playerId: string;
  playerName: string;
  tier: number;
  teamIndex: number;
  /** Which pass produced the placement ("GK", "T1-2", "T3-6"). */
  stage: string;
}

/** One executed swap between two teams. */
export interface TeamSwapStep {
  firstId: string;
  firstName: string;
  firstTeamIndex: number;
  secondId: string;
  secondName: string;
  secondTeamIndex: number;
  /** Which pass produced the swap. */
  stage: string;
}

export interface TeamGenerationTrace {
  swaps: Array<{ firstId: string; secondId: string }>;
  phases?: TeamGenerationPhase[];
  /** Every real allocation, in the order it happened. */
  allocations?: TeamAllocationStep[];
  /** Every real swap, with both players and both original teams. */
  swapSteps?: TeamSwapStep[];
}

const createPhaseRecorder = (trace?: TeamGenerationTrace) => {
  let phases = trace?.phases;
  if (trace && !phases) {
    phases = [];
    trace.phases = phases;
  }
  const target = phases;

  return <T>(
    id: string,
    label: string,
    detail: string,
    run: () => T,
    metrics: (result: T) => Record<string, string | number> = () => ({}),
  ): T => {
    if (!target) return run();
    const startedAt = Date.now();
    try {
      const result = run();
      target.push({
        id,
        label,
        detail,
        status: 'COMPLETED',
        durationMs: Date.now() - startedAt,
        metrics: metrics(result),
      });
      return result;
    } catch (error) {
      target.push({
        id,
        label,
        detail,
        status: 'FAILED',
        durationMs: Date.now() - startedAt,
        metrics: {},
      });
      throw error;
    }
  };
};

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
  const phase = createPhaseRecorder(trace);
  if (trace) {
    trace.allocations = [];
    trace.swapSteps = [];
  }
  const classify = phase(
    'classify',
    'Phân loại theo Tier',
    'Chia cầu thủ theo Tier và nhận diện thủ môn.',
    () => {
      const players = [...inputPlayers].sort((a, b) => a.tier - b.tier);
      const tierHistogram = players.reduce<Record<number, number>>((histogram, player) => {
        histogram[player.tier] = (histogram[player.tier] || 0) + 1;
        return histogram;
      }, {});
      return { players, tierHistogram };
    },
    ({ players, tierHistogram }) => ({
      players: players.length,
      goalkeepers: players.filter(isGoalkeeper).length,
      tiers: Object.entries(tierHistogram).map(([tier, count]) => `T${tier}:${count}`).join(' '),
    }),
  );
  const players = classify.players;
  const teams: GeneratedTeam[] = Array.from({ length: teamCount }, () => ({
    players: [], totalTier: 0, lockedPlayers: new Set<string>(),
  }));
  const teamOrder = shuffled(teams.map((_, index) => index));
  const targets = teams.map(() => Math.floor(players.length / teamCount));
  teamOrder.slice(0, players.length % teamCount).forEach((teamIndex) => { targets[teamIndex] += 1; });
  // Every placement goes through here, so recording it in one spot captures
  // the real allocation order without touching the algorithm.
  let allocationStage = 'GK';
  const add = (teamIndex: number, player: TeamGenerationPlayer, lock = false) => {
    teams[teamIndex].players.push(player);
    teams[teamIndex].totalTier += player.tier;
    if (lock || player.tier <= 2) teams[teamIndex].lockedPlayers.add(player.id);
    trace?.allocations?.push({
      playerId: player.id,
      playerName: player.name,
      tier: player.tier,
      teamIndex,
      stage: allocationStage,
    });
  };
  const primaryGks = players.filter(isGoalkeeper);
  const remaining = players.filter((player) => !isGoalkeeper(player));

  phase(
    'goalkeepers',
    'Phân chia thủ môn',
    'Ưu tiên mỗi đội một thủ môn trước khi chia các vị trí khác.',
    () => {
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
    },
    () => ({
      goalkeepersAssigned: teams.reduce(
        (total, team) => total + team.players.filter(isGoalkeeper).length,
        0,
      ),
      teamsWithoutGoalkeeper: teams.filter(
        (team) => !team.players.some(isGoalkeeper),
      ).length,
    }),
  );

  const countTier = (team: GeneratedTeam, tier: number) =>
    team.players.filter((player) => player.tier === tier).length;
  const countLowTier = (team: GeneratedTeam) =>
    team.players.filter((player) => player.tier <= 2).length;

  // Tiers 1-2 are protected: their even spread is decided here and must not be
  // overridden by team capacity.
  allocationStage = 'T1-2';
  phase(
    'tier-1-2',
    'Rải đều Tier 1–2',
    'Rải đều các cầu thủ Tier 1 và Tier 2, ưu tiên đội chưa có Tier 1.',
    () => {
      for (let tier = 1; tier <= 2; tier++) {
        for (const player of shuffled(remaining.filter((candidate) => candidate.tier === tier))) {
          const lowCounts = teams.map(countLowTier);
          const spreadAfterAdding = (index: number) => {
            const next = [...lowCounts];
            next[index] += 1;
            return Math.max(...next) - Math.min(...next);
          };
          const candidates = teams.map((team, index) => ({ team, index }));
          candidates.sort((a, b) => {
            const spreadDifference = spreadAfterAdding(a.index) - spreadAfterAdding(b.index);
            if (spreadDifference) return spreadDifference;
            const tierOneDifference = countTier(a.team, 1) - countTier(b.team, 1);
            if (tierOneDifference) return tierOneDifference;
            const tierDifference = countTier(a.team, tier) - countTier(b.team, tier);
            if (tierDifference) return tierDifference;
            const sizeDifference = a.team.players.length - b.team.players.length;
            if (sizeDifference) return sizeDifference;
            return a.team.totalTier - b.team.totalTier || Math.random() - 0.5;
          });
          add(candidates[0].index, player);
        }
      }
    },
    () => ({
      lowTierSpread: Math.max(...teams.map(countLowTier)) - Math.min(...teams.map(countLowTier)),
      tierOneSpread: Math.max(...teams.map((team) => countTier(team, 1))) - Math.min(...teams.map((team) => countTier(team, 1))),
    }),
  );

  allocationStage = 'T3-6';
  phase(
    'tier-3-6',
    'Cân bằng Tier 3–6',
    'Bổ sung nhóm Tier trung bình, ưu tiên đội còn thiếu người.',
    () => {
      for (let tier = 3; tier <= 6; tier++) {
        for (const player of shuffled(remaining.filter((candidate) => candidate.tier === tier))) {
          const eligible = teams
            .map((team, index) => ({ team, index }))
            .filter(({ team, index }) => team.players.length < targets[index]);
          const pool = eligible.length ? eligible : teams.map((team, index) => ({ team, index }));
          let candidates = pool;
          if (tier === 3) {
            // Tier 3 is the first flexible balancing tier. Teams that already
            // received more Tier 1-2 players should receive fewer Tier 3 players.
            const minLowTierCount = Math.min(...pool.map(({ team }) => countLowTier(team)));
            candidates = pool.filter(({ team }) => countLowTier(team) === minLowTierCount);
          }
          candidates.sort((a, b) => {
            const capacityDifference = a.team.players.length / targets[a.index] - b.team.players.length / targets[b.index];
            if (capacityDifference) return capacityDifference;
            const tierDifference = a.team.totalTier - b.team.totalTier;
            return tierDifference || Math.random() - 0.5;
          });
          add(candidates[0].index, player);
        }
      }
    },
    () => ({
      teams: teams.length,
      teamSizes: teams.map((team) => team.players.length).join('/'),
      totalTierSpread: Math.max(...teams.map((team) => team.totalTier)) - Math.min(...teams.map((team) => team.totalTier)),
    }),
  );

  // Tier 1/2 stay locked during balancing so their even distribution is never
  // undone. The balance pass below may still exchange a Tier 1/2 player with
  // another Tier 1/2 player of the same tier, which keeps the T1+T2 spread
  // intact while letting the averages converge.
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

  type TeamSnapshot = Array<{ players: TeamGenerationPlayer[]; totalTier: number }>;
  const snapshotTeams = (): TeamSnapshot =>
    teams.map((team) => ({ players: [...team.players], totalTier: team.totalTier }));
  const restoreTeams = (snapshot: TeamSnapshot): void => {
    teams.forEach((team, index) => {
      team.players = [...snapshot[index].players];
      team.totalTier = snapshot[index].totalTier;
    });
  };

  /**
   * Local search over every team pair. Pure best-improvement gets stuck in
   * local minima (it will not move a Tier 3 out of the middle team even when
   * that unlocks a better Tier 4 swap), so the search is restarted from the
   * best state with a random kick whenever it stalls. The best state seen is
   * restored at the end and the swap log is truncated to match, so the
   * animation still reproduces the final teams exactly.
   */
  const balancePass = (
    canSwap: (first: TeamGenerationPlayer, second: TeamGenerationPlayer) => boolean,
    stage = 'balance',
  ): Array<{ firstId: string; secondId: string }> => {
    const swapLog: Array<{ firstId: string; secondId: string }> = [];
    // Parallel to swapLog so the truncation below keeps both in sync: only the
    // swaps belonging to the best state are reported as real steps.
    const swapStepLog: TeamSwapStep[] = [];
    const initialTotals = teams.map((team) => team.totalTier);
    let bestSnapshot = snapshotTeams();
    let bestSpread = averageSpread(initialTotals);
    let bestVariance = averageVariance(initialTotals);
    let bestLength = 0;
    let bestStepLength = 0;

    const lowTierCounts = (): number[] =>
      teams.map((team) => team.players.filter((player) => player.tier <= 2).length);
    const tierOneCounts = (): number[] =>
      teams.map((team) => team.players.filter((player) => player.tier === 1).length);
    const swappable = (a: number, b: number, ai: number, bi: number): boolean => {
      const first = teams[a].players[ai];
      const second = teams[b].players[bi];
      if (!first || !second) return false;
      if (isGoalkeeper(first) !== isGoalkeeper(second)) return false;
      const firstLocked = teams[a].lockedPlayers.has(first.id);
      const secondLocked = teams[b].lockedPlayers.has(second.id);
      // Tier 1/2 are locked: they never move during balancing. Their even
      // distribution is decided once, up front, and must not be disturbed.
      if (firstLocked || secondLocked) return false;
      // Never let a swap push the T1+T2 spread beyond one player.
      const lows = lowTierCounts();
      lows[a] += (second.tier <= 2 ? 1 : 0) - (first.tier <= 2 ? 1 : 0);
      lows[b] += (first.tier <= 2 ? 1 : 0) - (second.tier <= 2 ? 1 : 0);
      if (Math.max(...lows) - Math.min(...lows) > 1) return false;
      // Tier 1 must stay evenly spread as well.
      const tierOnes = tierOneCounts();
      tierOnes[a] += (second.tier === 1 ? 1 : 0) - (first.tier === 1 ? 1 : 0);
      tierOnes[b] += (first.tier === 1 ? 1 : 0) - (second.tier === 1 ? 1 : 0);
      if (Math.max(...tierOnes) - Math.min(...tierOnes) > 1) return false;
      return canSwap(first, second);
    };
    const applySwap = (a: number, b: number, ai: number, bi: number): void => {
      const first = teams[a].players[ai];
      const second = teams[b].players[bi];
      teams[a].players[ai] = second;
      teams[b].players[bi] = first;
      teams[a].totalTier += second.tier - first.tier;
      teams[b].totalTier += first.tier - second.tier;
      swapLog.push({ firstId: first.id, secondId: second.id });
      swapStepLog.push({
        firstId: first.id,
        firstName: first.name,
        firstTeamIndex: a,
        secondId: second.id,
        secondName: second.name,
        secondTeamIndex: b,
        stage,
      });
    };
    const recordBest = (): void => {
      const totals = teams.map((team) => team.totalTier);
      const spread = averageSpread(totals);
      const variance = averageVariance(totals);
      if (spread < bestSpread - 0.000001 ||
        (Math.abs(spread - bestSpread) < 0.000001 && variance < bestVariance - 0.000001)) {
        bestSpread = spread;
        bestVariance = variance;
        bestSnapshot = snapshotTeams();
        bestLength = swapLog.length;
        bestStepLength = swapStepLog.length;
      }
    };

    // Descend until no swap improves the balance.
    const descend = (): void => {
      for (let iteration = 0; iteration < 200; iteration++) {
        const totals = teams.map((team) => team.totalTier);
        const spread = averageSpread(totals);
        const variance = averageVariance(totals);
        let best: { a: number; b: number; ai: number; bi: number; spread: number; variance: number } | null = null;
        for (let a = 0; a < teams.length; a++) for (let b = a + 1; b < teams.length; b++) {
          for (let ai = 0; ai < teams[a].players.length; ai++) for (let bi = 0; bi < teams[b].players.length; bi++) {
            if (!swappable(a, b, ai, bi)) continue;
            const first = teams[a].players[ai];
            const second = teams[b].players[bi];
            const next = [...totals];
            next[a] += second.tier - first.tier; next[b] += first.tier - second.tier;
            const nextSpread = averageSpread(next);
            const nextVariance = averageVariance(next);
            if (!improvesBalance(nextSpread, nextVariance, spread, variance)) continue;
            if (!best || nextSpread < best.spread - 0.000001 ||
              (Math.abs(nextSpread - best.spread) < 0.000001 && nextVariance < best.variance)) {
              best = { a, b, ai, bi, spread: nextSpread, variance: nextVariance };
            }
          }
        }
        if (!best) break;
        applySwap(best.a, best.b, best.ai, best.bi);
        recordBest();
      }
    };

    descend();
    // Escape local minima. A single random kick from the best state is not
    // enough: the descent immediately undoes it. Instead, restart from a
    // randomised copy of the best state and descend again, keeping the best
    // result. Only Tier 3-6 move, so the locked Tier 1/2 layout is preserved.
    for (let restart = 0; restart < 60; restart++) {
      restoreTeams(bestSnapshot);
      swapLog.length = bestLength;
      swapStepLog.length = bestStepLength;
      const candidates: Array<{ a: number; b: number; ai: number; bi: number }> = [];
      for (let a = 0; a < teams.length; a++) for (let b = a + 1; b < teams.length; b++) {
        for (let ai = 0; ai < teams[a].players.length; ai++) for (let bi = 0; bi < teams[b].players.length; bi++) {
          if (swappable(a, b, ai, bi)) candidates.push({ a, b, ai, bi });
        }
      }
      if (!candidates.length) break;
      // Apply a short random walk (2-4 swaps) so the descent starts from a
      // genuinely different basin instead of the same local minimum.
      const kicks = 2 + Math.floor(Math.random() * 3);
      for (let kick = 0; kick < kicks; kick++) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        if (!swappable(pick.a, pick.b, pick.ai, pick.bi)) continue;
        applySwap(pick.a, pick.b, pick.ai, pick.bi);
      }
      descend();
    }

    restoreTeams(bestSnapshot);
    swapLog.length = bestLength;
    swapStepLog.length = bestStepLength;
    trace?.swapSteps?.push(...swapStepLog);
    return swapLog;
  };

  // Balance Tier 3-6 across every team pair.
  phase(
    'balance',
    'Tối ưu cân bằng',
    'Hoán đổi cùng Tier để thu hẹp chênh lệch tổng Tier giữa các đội.',
    () => {
      trace?.swaps.push(...balancePass(() => true, 'balance'));
    },
    () => ({
      swaps: trace?.swaps.length ?? 0,
      totalTierSpread: Math.max(...teams.map((team) => team.totalTier)) - Math.min(...teams.map((team) => team.totalTier)),
    }),
  );

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
  phase(
    'battle',
    'Tách cặp Battle',
    'Đẩy các cặp Battle đã chấp nhận sang hai đội khác nhau.',
    () => {
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
        trace?.swapSteps?.push({
          firstId: moved.id,
          firstName: moved.name,
          firstTeamIndex: sourceIndex,
          secondId: replacement.id,
          secondName: replacement.name,
          secondTeamIndex: bestMove.destinationIndex,
          stage: 'battle',
        });
      }
    },
    () => ({
      pairs: battlePairs.length,
      separated: battlePairs.filter((pair) => {
        const first = teams.findIndex((team) => team.players.some((player) => player.id === pair.firstId));
        const second = teams.findIndex((team) => team.players.some((player) => player.id === pair.secondId));
        return first >= 0 && second >= 0 && first !== second;
      }).length,
    }),
  );

  // A Battle separation can slightly disturb the tier balance. Make one final
  // balancing pass, but reject every swap that would put a Battle pair back
  // together.
  phase(
    'rebalance',
    'Cân bằng lần cuối',
    'Cân bằng lại sau khi tách Battle mà không ghép lại cặp đấu.',
    () => {
      trace?.swaps.push(...balancePass((first, second) => {
        const firstPartnerId = battlePartnerById.get(first.id);
        const secondPartnerId = battlePartnerById.get(second.id);
        if (firstPartnerId && teams.some((team) => team.players.some((candidate) => candidate.id === firstPartnerId) && team.players.some((candidate) => candidate.id === second.id))) return false;
        if (secondPartnerId && teams.some((team) => team.players.some((candidate) => candidate.id === secondPartnerId) && team.players.some((candidate) => candidate.id === first.id))) return false;
        return true;
      }, 'rebalance'));
    },
    () => ({
      totalTierSpread: Math.max(...teams.map((team) => team.totalTier)) - Math.min(...teams.map((team) => team.totalTier)),
    }),
  );

  phase(
    'sort-teams',
    'Sắp xếp đội hình',
    'Sắp xếp trong mỗi đội: thủ môn trước, sau đó theo Tier.',
    () => {
      teams.forEach((team) => {
        team.players.sort((first, second) => {
          const goalkeeperDifference = Number(isGoalkeeper(second)) - Number(isGoalkeeper(first));
          if (goalkeeperDifference) return goalkeeperDifference;
          const tierDifference = first.tier - second.tier;
          return tierDifference || first.name.localeCompare(second.name, 'vi');
        });
      });
    },
    () => ({
      totalPlayers: teams.reduce((total, team) => total + team.players.length, 0),
      teams: teams.length,
    }),
  );

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
  /** Real execution stages, in the order the algorithm ran them. */
  phases: TeamGenerationPhase[];
  /** Balancing swaps, in the order they were applied. */
  swaps: Array<{ firstId: string; secondId: string }>;
  /** Swaps made only to avoid repeating teammates from the previous week. */
  repeatTeammateSwaps: Array<{ firstId: string; secondId: string }>;
  /** Every real player placement into a team, in execution order. */
  allocations: TeamAllocationStep[];
  /** Every real swap, with both players and both original teams. */
  swapSteps: TeamSwapStep[];
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

  const trace: TeamGenerationTrace = { swaps: [], phases: [], swapSteps: [] };
  const phase = createPhaseRecorder(trace);
  const teams = generateBalancedTeams(inputPlayers, teamCount, battlePairs, trace);
  // generateBalancedTeams records allocations while it runs; keep them for the
  // execution graph instead of reconstructing them from the final teams.
  const repeatTeammateSwaps: Array<{ firstId: string; secondId: string }> = [];

  // 2. Avoid keeping a player with two or more of the same teammates for a
  // second consecutive weekly tournament. Swaps are same-tier and preserve GK
  // distribution, so the tier balance established above cannot change.
  phase(
    'repeat-teammates',
    'Tránh lặp đồng đội',
    'Hạn chế giữ nguyên nhóm bạn chơi chung từ tuần trước.',
    () => {
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
              // Recorded so the spider can animate this phase too, not just
              // the balance passes.
              trace?.swapSteps?.push({
                firstId: player.id,
                firstName: player.name,
                firstTeamIndex: sourceIndex,
                secondId: replacement.id,
                secondName: replacement.name,
                secondTeamIndex: destinationIndex,
                stage: 'repeat-teammates',
              });
              swapped = true;
              break;
            }
          }
        }
      }
      if (!swapped) break;
    }
    }
    },
    () => ({ swaps: repeatTeammateSwaps.length }),
  );

  // 3. Accepted challenges must always be on opposing teams. The generator
  // already tries this; this pass is a safety net for pairs it could not
  // separate. Same-tier, same-GK-type swaps keep the balance intact.
  phase(
    'enforce-battles',
    'Kiểm tra cặp Battle',
    'Đảm bảo mọi cặp Battle nằm ở hai đội khác nhau.',
    () => {
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
    },
    () => ({
      pairs: battlePairs.length,
      separated: battlePairs.filter((pair) => {
        const first = findTeamIndex(teams, pair.firstId);
        const second = findTeamIndex(teams, pair.secondId);
        return first >= 0 && second >= 0 && first !== second;
      }).length,
    }),
  );

  // 4. Accepted friend invites must share a team. Move the target beside the
  // requester by exchanging a same-tier, same-GK-type player.
  phase(
    'friend-invites',
    'Ghép cặp bạn bè',
    'Đưa các cặp bạn đã chấp nhận về cùng một đội.',
    () => {
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
    // Recorded so the spider can animate this phase.
    trace?.swapSteps?.push({
      firstId: target.id,
      firstName: target.name,
      firstTeamIndex: targetTeamIndex,
      secondId: replacement.id,
      secondName: replacement.name,
      secondTeamIndex: requesterTeamIndex,
      stage: 'friend-invites',
    });
    }
    },
    () => ({
      pairs: friendInvitePairs.length,
      together: friendInvitePairs.filter((pair) => {
        const first = findTeamIndex(teams, pair.firstId);
        const second = findTeamIndex(teams, pair.secondId);
        return first >= 0 && first === second;
      }).length,
    }),
  );

  teams.forEach(sortTeamPlayers);
  return {
    teams,
    swaps: trace.swaps,
    repeatTeammateSwaps,
    phases: trace.phases ?? [],
    allocations: trace.allocations ?? [],
    swapSteps: trace.swapSteps ?? [],
  };
}
