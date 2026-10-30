import { describe, expect, it } from 'vitest';
import { buildBalancedTeams, type TeamGenerationPlayer } from './teamGeneration';
import { buildAiSplitGraph } from './aiTeamSplit';

const player = (id: string, tier: number, position = 'MID'): TeamGenerationPlayer => ({
  id,
  name: `Player ${id}`,
  position,
  positionSecond: null,
  tier,
  avatar: null,
});

const roster = () => [
  ...Array.from({ length: 3 }, (_, index) => player(`gk${index}`, 3, 'GK')),
  ...Array.from({ length: 21 }, (_, index) => player(`p${index}`, 1 + (index % 6))),
];

const buildGraph = (overrides: Record<string, unknown> = {}) => {
  const players = roster();
  const result = buildBalancedTeams(players, 3);
  return buildAiSplitGraph({
    taskId: 'task-1',
    createdAt: new Date('2026-10-28T00:00:00.000Z'),
    durationMs: 12,
    players,
    teamCount: 3,
    result,
    ...overrides,
  });
};

describe('buildAiSplitGraph', () => {
  it('produces tier, thinking and team nodes for a real run', () => {
    const graph = buildGraph();
    const kinds = new Set(graph.nodes.map((node) => node.kind));

    // There is no separate core card: "AI suy nghĩ" is the centre of the graph.
    expect(kinds).toEqual(new Set(['TIER', 'THINKING', 'TEAM']));
    expect(graph.nodes.filter((node) => node.kind === 'CORE')).toHaveLength(0);
    expect(graph.nodes.filter((node) => node.kind === 'TEAM')).toHaveLength(3);
  });

  it('only includes tiers that are present in the roster', () => {
    const players = [
      ...Array.from({ length: 2 }, (_, index) => player(`gk${index}`, 3, 'GK')),
      ...Array.from({ length: 16 }, (_, index) => player(`p${index}`, 1 + (index % 3))),
    ];
    const result = buildBalancedTeams(players, 2);
    const graph = buildAiSplitGraph({
      taskId: 'task-2',
      createdAt: new Date(),
      durationMs: 5,
      players,
      teamCount: 2,
      result,
    });
    const tierLabels = graph.nodes
      .filter((node) => node.kind === 'TIER')
      .map((node) => node.label);

    // Tiers are grouped into merged cards; only groups with players appear.
    expect(tierLabels).toEqual(['Tier 1-2', 'Tier 3']);
  });

  it('merges tiers 1-2 and 5-6 into single cards', () => {
    const players = [
      ...Array.from({ length: 3 }, (_, index) => player(`gk${index}`, 3, 'GK')),
      ...Array.from({ length: 21 }, (_, index) => player(`p${index}`, 1 + (index % 6))),
    ];
    const result = buildBalancedTeams(players, 3);
    const graph = buildAiSplitGraph({
      taskId: 'task-tiers',
      createdAt: new Date(),
      durationMs: 3,
      players,
      teamCount: 3,
      result,
    });
    const tierNodes = graph.nodes.filter((node) => node.kind === 'TIER');

    expect(tierNodes.map((node) => node.label)).toEqual([
      'Tier 1-2', 'Tier 3', 'Tier 4', 'Tier 5-6',
    ]);
    // Every player appears on exactly one tier card.
    const ids = tierNodes.flatMap((node) => node.players?.map((item) => item.id) ?? []);
    expect(new Set(ids).size).toBe(players.length);
  });

  it('reports the real phase timings recorded by the pipeline', () => {
    const players = roster();
    const result = buildBalancedTeams(players, 3);
    const graph = buildAiSplitGraph({
      taskId: 'task-3',
      createdAt: new Date(),
      durationMs: 30,
      players,
      teamCount: 3,
      result,
    });
    const thinking = graph.nodes.find((node) => node.kind === 'THINKING');

    expect(thinking).toBeDefined();
    expect(result.phases.length).toBeGreaterThanOrEqual(6);
    expect(thinking!.metrics.phases).toBe(result.phases.length);
    expect(thinking!.phases).toHaveLength(result.phases.length);
    expect(thinking!.phases!.map((phase) => phase.id)).toEqual(
      result.phases.map((phase) => phase.id),
    );
    for (const phase of result.phases) {
      expect(thinking!.phases).toContainEqual(
        expect.objectContaining({ id: phase.id, durationMs: phase.durationMs, status: phase.status }),
      );
    }
  });

  it('does not key thinking metrics by phase id', () => {
    // A phase named "goalkeepers" must not collide with the real
    // "goalkeepers" count metric.
    const graph = buildGraph();
    const thinking = graph.nodes.find((node) => node.kind === 'THINKING')!;

    expect(thinking.metrics.goalkeepers).toBeUndefined();
    expect(thinking.phases!.some((phase) => phase.id === 'goalkeepers')).toBe(true);
  });

  it('exposes the actual team rosters on team nodes', () => {
    const players = roster();
    const result = buildBalancedTeams(players, 3);
    const graph = buildAiSplitGraph({
      taskId: 'task-4',
      createdAt: new Date(),
      durationMs: 8,
      players,
      teamCount: 3,
      result,
    });
    const teamNodes = graph.nodes.filter((node) => node.kind === 'TEAM');
    const graphPlayerIds = teamNodes.flatMap((node) => node.players!.map((item) => item.id));

    expect(graphPlayerIds).toHaveLength(players.length);
    expect(new Set(graphPlayerIds).size).toBe(players.length);
    for (const node of teamNodes) {
      expect(node.metrics.players).toBe(node.players!.length);
    }
  });

  it('connects every node into one reachable graph from the thinking card', () => {
    const graph = buildGraph();
    const thinking = graph.nodes.find((node) => node.kind === 'THINKING')!;
    // Tiers feed *into* the thinking card, so the graph is connected in the
    // undirected sense: walk both ways.
    const adjacency = new Map<string, string[]>();
    const link = (from: string, to: string) => {
      adjacency.set(from, [...(adjacency.get(from) ?? []), to]);
    };
    for (const edge of graph.edges) {
      link(edge.source, edge.target);
      link(edge.target, edge.source);
    }
    const visited = new Set<string>([thinking.id]);
    const queue = [thinking.id];
    while (queue.length) {
      const current = queue.shift()!;
      for (const next of adjacency.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }

    expect(visited.size).toBe(graph.nodes.length);
  });

  it('never references an edge endpoint that is not a node', () => {
    const graph = buildGraph();
    const nodeIds = new Set(graph.nodes.map((node) => node.id));

    for (const edge of graph.edges) {
      expect(nodeIds.has(edge.source), edge.id).toBe(true);
      expect(nodeIds.has(edge.target), edge.id).toBe(true);
    }
  });

  it('marks the graph failed and pending when the run fails', () => {
    const graph = buildGraph({ failure: 'boom' });

    expect(graph.status).toBe('FAILED');
    expect(graph.nodes.find((node) => node.kind === 'THINKING')!.status).toBe('FAILED');
    expect(graph.nodes.filter((node) => node.kind === 'TEAM').every((node) => node.status === 'PENDING')).toBe(true);
    expect(graph.events.at(-1)).toMatchObject({ phase: 'failure', message: 'boom' });
  });

  it('summarises the real swap and spread numbers', () => {
    const graph = buildGraph();
    const teamTotals = graph.nodes
      .filter((node) => node.kind === 'TEAM')
      .map((node) => node.metrics.totalTier as number);

    expect(graph.summary.totalTierSpread).toBe(
      Math.max(...teamTotals) - Math.min(...teamTotals),
    );
    expect(graph.summary.players).toBe(24);
    expect(graph.summary.teams).toBe(3);
  });

  it('records a phase event per executed phase, plus start and the real steps', () => {
    const players = roster();
    const result = buildBalancedTeams(players, 3);
    const graph = buildAiSplitGraph({
      taskId: 'task-5',
      createdAt: new Date(),
      durationMs: 4,
      players,
      teamCount: 3,
      result,
    });

    expect(graph.events.filter((event) => event.kind === 'PHASE')).toHaveLength(result.phases.length);
    expect(graph.events[0]).toMatchObject({ phase: 'start', kind: 'START' });
    expect(graph.events).toHaveLength(
      1 + result.phases.length + result.allocations.length + result.swapSteps.length,
    );
  });

  it('exposes every real allocation with the team it landed in', () => {
    const players = roster();
    const result = buildBalancedTeams(players, 3);
    const graph = buildAiSplitGraph({
      taskId: 'task-6',
      createdAt: new Date(),
      durationMs: 4,
      players,
      teamCount: 3,
      result,
    });

    expect(graph.allocations).toHaveLength(players.length);
    expect(new Set(graph.allocations.map((step) => step.playerId)).size).toBe(players.length);
    for (const step of graph.allocations) {
      expect(graph.nodes.some((node) => node.id === step.teamNodeId)).toBe(true);
    }
    // Allocation order matches the real order the algorithm placed players.
    expect(graph.allocations.map((step) => step.playerId))
      .toEqual(result.allocations.map((step) => step.playerId));
  });

  it('exposes real swaps with both players and both teams', () => {
    const players = roster();
    const result = buildBalancedTeams(players, 3);
    const graph = buildAiSplitGraph({
      taskId: 'task-7',
      createdAt: new Date(),
      durationMs: 4,
      players,
      teamCount: 3,
      result,
    });

    expect(graph.swaps).toHaveLength(result.swapSteps.length);
    for (const step of graph.swaps) {
      expect(step.firstTeamNodeId).not.toBe(step.secondTeamNodeId);
      expect(graph.nodes.some((node) => node.id === step.firstTeamNodeId)).toBe(true);
      expect(graph.nodes.some((node) => node.id === step.secondTeamNodeId)).toBe(true);
      expect(step.firstId).not.toBe(step.secondId);
    }
  });

  it('gives every allocate/swap event the nodes it should light up', () => {
    const players = roster();
    const result = buildBalancedTeams(players, 3);
    const graph = buildAiSplitGraph({
      taskId: 'task-8',
      createdAt: new Date(),
      durationMs: 4,
      players,
      teamCount: 3,
      result,
    });
    const nodeIds = new Set(graph.nodes.map((node) => node.id));

    for (const event of graph.events) {
      for (const id of event.nodeIds ?? []) {
        expect(nodeIds.has(id), `${event.id} -> ${id}`).toBe(true);
      }
    }
  });
});
