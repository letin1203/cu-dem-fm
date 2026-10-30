import type {
  TeamAllocationStep,
  TeamGenerationPhase,
  TeamGenerationPlayer,
  TeamGenerationResult,
  TeamSwapStep,
} from './teamGeneration';

/**
 * Execution-graph model returned to the "AI chia team" spider-web UI.
 *
 * Every node and edge is derived from a real team-split run: the phases come
 * from `TeamGenerationPhase` recordings, the tier nodes from the actual player
 * roster, and the team nodes from the teams the algorithm produced. Nothing
 * here is sample data — if the pipeline did not do it, it is not in the graph.
 */

export type AiNodeStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type AiNodeKind = 'CORE' | 'TIER' | 'THINKING' | 'TEAM';

export interface AiGraphNode {
  id: string;
  kind: AiNodeKind;
  label: string;
  sublabel: string;
  status: AiNodeStatus;
  /** Position hint (column, row) consumed by the graph layout. */
  depth: number;
  lane: number;
  metrics: Record<string, string | number>;
  /** Only used by the THINKING node: the real pipeline phases. */
  phases?: Array<{
    id: string;
    label: string;
    detail: string;
    status: AiNodeStatus;
    durationMs: number;
  }>;
  /** Only used by TEAM nodes: the players on that team. */
  players?: Array<{
    id: string;
    name: string;
    tier: number;
    position: string;
    avatar: string | null;
  }>;
}

export interface AiGraphEdge {
  id: string;
  source: string;
  target: string;
  kind: 'SPINE' | 'TIER_FLOW' | 'THINKING' | 'TEAM_FLOW';
  label: string;
  status: AiNodeStatus;
}

/**
 * What a timeline entry represents. Phases are the coarse pipeline stages;
 * ALLOCATE and SWAP are the individual player movements the pipeline really
 * made inside those stages.
 */
export type AiEventKind = 'START' | 'PHASE' | 'ALLOCATE' | 'SWAP' | 'FAILURE';

export interface AiTaskEvent {
  id: string;
  at: string;
  phase: string;
  message: string;
  status: AiNodeStatus;
  durationMs: number;
  kind: AiEventKind;
  /** Node ids this entry activates while it plays. */
  nodeIds?: string[];
}

export interface AiAllocationStep {
  id: string;
  playerId: string;
  playerName: string;
  tier: number;
  teamNodeId: string;
  teamLabel: string;
  stage: string;
}

export interface AiSwapStep {
  id: string;
  firstId: string;
  firstName: string;
  secondId: string;
  secondName: string;
  firstTeamNodeId: string;
  secondTeamNodeId: string;
  stage: string;
}

export interface AiSplitGraph {
  taskId: string;
  createdAt: string;
  instruction?: string;
  status: AiNodeStatus;
  /** Wall-clock duration of the whole backend run. */
  durationMs: number;
  summary: {
    players: number;
    teams: number;
    swaps: number;
    repeatTeammateSwaps: number;
    totalTierSpread: number;
    tierOneSpread: number;
  };
  nodes: AiGraphNode[];
  edges: AiGraphEdge[];
  events: AiTaskEvent[];
  /** Real player placements into teams, in execution order. */
  allocations: AiAllocationStep[];
  /** Real swaps between teams, in execution order. */
  swaps: AiSwapStep[];
}

const PHASE_NODE_ID = 'ai-thinking';

const formatSpread = (value: number): string =>
  Number.isInteger(value) ? `${value}` : value.toFixed(2);

/**
 * Turn one real team-split result into the graph model.
 *
 * `taskId` and `createdAt` are supplied by the route so the frontend can poll
 * or reference the same execution; `durationMs` is measured around the call.
 */
export const buildAiSplitGraph = (input: {
  taskId: string;
  createdAt: Date;
  durationMs: number;
  players: TeamGenerationPlayer[];
  teamCount: number;
  result: TeamGenerationResult;
  /** Optional dialog guard so compute failures are reported, not hidden. */
  failure?: string;
  /** Operator instruction echoed from the task input field. */
  instruction?: string;
}): AiSplitGraph => {
  const { players, result, teamCount, durationMs } = input;
  const phases: TeamGenerationPhase[] = result.phases ?? [];

  const totalTierByTeam = result.teams.map((team) => team.totalTier);
  const lowTierByTeam = result.teams.map(
    (team) => team.players.filter((player) => player.tier <= 2).length,
  );
  const tierOneByTeam = result.teams.map(
    (team) => team.players.filter((player) => player.tier === 1).length,
  );
  const totalTierSpread = totalTierByTeam.length
    ? Math.max(...totalTierByTeam) - Math.min(...totalTierByTeam)
    : 0;
  const tierOneSpread = tierOneByTeam.length
    ? Math.max(...tierOneByTeam) - Math.min(...tierOneByTeam)
    : 0;

  const nodes: AiGraphNode[] = [];
  const edges: AiGraphEdge[] = [];

  const failed = Boolean(input.failure);

  // Tier nodes: only tiers that actually appear in the roster.
  const tierCounts = players.reduce<Map<number, number>>((counts, player) => {
    counts.set(player.tier, (counts.get(player.tier) ?? 0) + 1);
    return counts;
  }, new Map());
  const tiers = [...tierCounts.keys()].sort((first, second) => first - second);

  /*
   * Tiers are grouped into merged cards so the top row stays compact:
   *   "Tier 1-2", "Tier 3", "Tier 4", "Tier 5-6"
   * A group only appears when at least one of its tiers has players, and it
   * carries the union of their rosters.
   */
  const TIER_GROUPS: Array<{ label: string; tiers: number[] }> = [
    { label: 'Tier 1-2', tiers: [1, 2] },
    { label: 'Tier 3', tiers: [3] },
    { label: 'Tier 4', tiers: [4] },
    { label: 'Tier 5-6', tiers: [5, 6] },
  ];

  const tierNodeIds = new Map<number, string>();
  const groups = TIER_GROUPS
    .map((group) => ({
      ...group,
      present: group.tiers.filter((tier) => tierCounts.has(tier)),
    }))
    .filter((group) => group.present.length > 0);

  groups.forEach((group, index) => {
    const groupPlayers = players.filter((player) => group.present.includes(player.tier));
    const playerCount = groupPlayers.length;
    const id = `tier-group-${index}`;
    for (const tier of group.present) tierNodeIds.set(tier, id);
    nodes.push({
      id,
      kind: 'TIER',
      label: group.label,
      sublabel: `${playerCount} cầu thủ`,
      status: 'COMPLETED',
      depth: 1,
      lane: index,
      metrics: {
        players: playerCount,
        perTeam: Number((playerCount / teamCount).toFixed(2)),
        goalkeepers: groupPlayers.filter(
          (player) => player.position === 'GK' || player.position === 'Goalkeeper',
        ).length,
      },
      // Tier cards show their own roster as chips, so the players of the group
      // are sent with the node instead of only a count.
      players: groupPlayers.map((player) => ({
        id: player.id,
        name: player.name,
        tier: player.tier,
        position: player.position,
        avatar: player.avatar,
      })),
    });
    // Tiers feed the thinking card; there is no core node any more.
    edges.push({
      id: `edge-${id}-thinking`,
      source: id,
      target: PHASE_NODE_ID,
      kind: 'TIER_FLOW',
      label: `${playerCount} cầu thủ`,
      status: 'COMPLETED',
    });
  });

  // "AI suy nghĩ" carries the real phase timings, exposed as a structured
  // list rather than keying metrics by phase id (a phase called
  // "goalkeepers" would otherwise collide with the "goalkeepers" metric).
  const slowestPhase = phases.reduce<{ label: string; durationMs: number } | null>(
    (slowest, phase) =>
      !slowest || phase.durationMs > slowest.durationMs
        ? { label: phase.label, durationMs: phase.durationMs }
        : slowest,
    null,
  );
  const thinkingMetrics: Record<string, string | number> = {
    phases: phases.length,
    failedPhases: phases.filter((phase) => phase.status === 'FAILED').length,
    slowest: slowestPhase ? `${slowestPhase.label} (${slowestPhase.durationMs}ms)` : '—',
  };
  nodes.push({
    id: PHASE_NODE_ID,
    kind: 'THINKING',
    label: 'AI suy nghĩ',
    sublabel: `${phases.length} giai đoạn · ${durationMs}ms`,
    status: failed
      ? 'FAILED'
      : phases.some((phase) => phase.status === 'FAILED')
        ? 'FAILED'
        : 'COMPLETED',
    depth: 2,
    lane: Math.floor(teamCount / 2),
    metrics: thinkingMetrics,
    phases: phases.map((phase) => ({
      id: phase.id,
      label: phase.label,
      detail: phase.detail,
      status: phase.status,
      durationMs: phase.durationMs,
    })),
  });
  // Team nodes: the actual players each team received.
  result.teams.forEach((team, index) => {
    const id = `team-${index + 1}`;
    nodes.push({
      id,
      kind: 'TEAM',
      label: `Đội ${index + 1}`,
      // Totals live in the card header, so the sublabel is just the count.
      sublabel: `${team.players.length} cầu thủ`,
      status: failed ? 'PENDING' : 'COMPLETED',
      depth: 3,
      lane: index,
      metrics: {
        players: team.players.length,
        totalTier: team.totalTier,
        averageTier: team.players.length
          ? Number((team.totalTier / team.players.length).toFixed(2))
          : 0,
        goalkeepers: team.players.filter(
          (player) => player.position === 'GK' || player.position === 'Goalkeeper',
        ).length,
        lowTier: lowTierByTeam[index] ?? 0,
      },
      players: team.players.map((player) => ({
        id: player.id,
        name: player.name,
        tier: player.tier,
        position: player.position,
        avatar: player.avatar,
      })),
    });
    edges.push({
      id: `edge-thinking-${id}`,
      source: PHASE_NODE_ID,
      target: id,
      kind: 'TEAM_FLOW',
      label: `T${formatSpread(team.totalTier)}`,
      status: failed ? 'PENDING' : 'COMPLETED',
    });
  });

  // Real player placements, mapped onto the team nodes they landed in.
  const allocations: AiAllocationStep[] = (result.allocations ?? []).map((step, index) => ({
    id: `alloc-${index}`,
    playerId: step.playerId,
    playerName: step.playerName,
    tier: step.tier,
    teamNodeId: `team-${step.teamIndex + 1}`,
    teamLabel: `Đội ${step.teamIndex + 1}`,
    stage: step.stage,
  }));

  // Real executed swaps, with both players and both teams involved.
  const swaps: AiSwapStep[] = (result.swapSteps ?? []).map((step, index) => ({
    id: `swap-${index}`,
    firstId: step.firstId,
    firstName: step.firstName,
    secondId: step.secondId,
    secondName: step.secondName,
    firstTeamNodeId: `team-${step.firstTeamIndex + 1}`,
    secondTeamNodeId: `team-${step.secondTeamIndex + 1}`,
    stage: step.stage,
  }));

  const events: AiTaskEvent[] = [
    {
      id: `${input.taskId}-start`,
      at: input.createdAt.toISOString(),
      phase: 'start',
      message: input.instruction
        ? `Yêu cầu: ${input.instruction} · ${players.length} cầu thủ, ${teamCount} đội`
        : `Nhận ${players.length} cầu thủ, chia ${teamCount} đội`,
      status: 'COMPLETED',
      durationMs: 0,
      kind: 'START',
      nodeIds: [PHASE_NODE_ID],
    },
    ...phases.map((phase, index) => ({
      id: `${input.taskId}-phase-${index}`,
      at: new Date(input.createdAt.getTime()).toISOString(),
      phase: phase.id,
      message: `${phase.label}: ${phase.detail}`,
      status: phase.status,
      durationMs: phase.durationMs,
      kind: 'PHASE' as const,
    })),
    ...allocations.map((step) => ({
      id: `${input.taskId}-${step.id}`,
      at: new Date(input.createdAt.getTime()).toISOString(),
      phase: 'allocate',
      message: `${step.playerName} (T${step.tier}) → ${step.teamLabel}`,
      status: 'COMPLETED' as const,
      durationMs: 0,
      kind: 'ALLOCATE' as const,
      nodeIds: [step.teamNodeId],
    })),
    ...swaps.map((step) => ({
      id: `${input.taskId}-${step.id}`,
      at: new Date(input.createdAt.getTime()).toISOString(),
      phase: 'swap',
      message: `Đổi ${step.firstName} ↔ ${step.secondName}`,
      status: 'COMPLETED' as const,
      durationMs: 0,
      kind: 'SWAP' as const,
      nodeIds: [step.firstTeamNodeId, step.secondTeamNodeId],
    })),
  ];

  if (input.failure) {
    events.push({
      id: `${input.taskId}-failure`,
      at: new Date(input.createdAt.getTime() + durationMs).toISOString(),
      phase: 'failure',
      message: input.failure,
      status: 'FAILED',
      durationMs,
      kind: 'FAILURE',
    });
  }

  return {
    taskId: input.taskId,
    createdAt: input.createdAt.toISOString(),
    instruction: input.instruction,
    status: failed ? 'FAILED' : 'COMPLETED',
    durationMs,
    summary: {
      players: players.length,
      teams: result.teams.length,
      swaps: result.swaps.length,
      repeatTeammateSwaps: result.repeatTeammateSwaps.length,
      totalTierSpread,
      tierOneSpread,
    },
    nodes,
    edges,
    events,
    allocations,
    swaps,
  };
};
