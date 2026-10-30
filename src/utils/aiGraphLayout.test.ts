import { describe, expect, it } from 'vitest';
import {
  CARD_WIDTH,
  TEAM_CARD_WIDTH,
  THINKING_CARD_WIDTH,
  TIER_CARD_WIDTH,
  estimateNodeHeight,
  layoutSpiderGraph,
  statusLabel,
} from './aiGraphLayout';
import type { AiGraphNode } from '../types/aiGraph';

const node = (overrides: Partial<AiGraphNode> & Pick<AiGraphNode, 'id' | 'kind'>): AiGraphNode => ({
  label: overrides.id,
  sublabel: '',
  status: 'COMPLETED',
  depth: 0,
  lane: 0,
  metrics: {},
  ...overrides,
});

const players = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `p${index}`,
    name: `Player ${index}`,
    tier: 1 + (index % 6),
    position: index === 0 ? 'GK' : 'MID',
    avatar: null,
  }));

const graphNodes = (
  tierCount: number,
  teamCount: number,
  playersPerTier = 4,
  playersPerTeam = 8,
): AiGraphNode[] => [
  // No core card any more: "AI suy nghĩ" is the centre of the graph.
  node({ id: 'thinking', kind: 'THINKING', depth: 2 }),
  ...Array.from({ length: tierCount }, (_, index) =>
    node({
      id: `tier-${index + 1}`,
      kind: 'TIER',
      depth: 1,
      lane: index,
      players: players(playersPerTier),
    }),
  ),
  ...Array.from({ length: teamCount }, (_, index) =>
    node({
      id: `team-${index + 1}`,
      kind: 'TEAM',
      depth: 3,
      lane: index,
      players: players(playersPerTeam),
    }),
  ),
];

const NODE_WIDTH = CARD_WIDTH;

/**
 * Detect overlap using the same height estimate the layout packs with.
 *
 * Positions are TOP-LEFT corners (that is what Vue Flow uses), so a card
 * occupies [y, y + height) rather than being centred on y.
 */
const overlappingPairs = (
  nodes: AiGraphNode[],
  positions: ReturnType<typeof layoutSpiderGraph>,
): string[] => {
  const heights = new Map(nodes.map((node) => [node.id, estimateNodeHeight(node)]));
  const entries = [...positions.entries()];
  const overlaps: string[] = [];
  for (let first = 0; first < entries.length; first += 1) {
    for (let second = first + 1; second < entries.length; second += 1) {
      const [firstId, a] = entries[first];
      const [secondId, b] = entries[second];
      const firstHeight = heights.get(firstId) ?? 132;
      const secondHeight = heights.get(secondId) ?? 132;
      const verticalOverlap =
        a.y < b.y + secondHeight && b.y < a.y + firstHeight;
      if (Math.abs(a.x - b.x) < NODE_WIDTH && verticalOverlap) {
        overlaps.push(`${firstId}/${secondId}`);
      }
    }
  }
  return overlaps;
};

describe('layoutSpiderGraph', () => {
  it('stacks the bands vertically: tiers, then thinking, then teams', () => {
    const positions = layoutSpiderGraph(graphNodes(3, 3));

    const tierY = positions.get('tier-1')!.y;
    const thinkingY = positions.get('thinking')!.y;
    const teamY = positions.get('team-1')!.y;

    expect(tierY).toBeLessThan(thinkingY);
    expect(thinkingY).toBeLessThan(teamY);
  });

  it('lays tier cards out horizontally, left to right', () => {
    const positions = layoutSpiderGraph(graphNodes(6, 3));

    const xs = [1, 2, 3, 4, 5, 6].map((index) => positions.get(`tier-${index}`)!.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    // All on the same row.
    const ys = [1, 2, 3, 4, 5, 6].map((index) => positions.get(`tier-${index}`)!.y);
    expect(new Set(ys).size).toBe(1);
  });

  it('lays team cards out horizontally, left to right', () => {
    const positions = layoutSpiderGraph(graphNodes(3, 4));

    const xs = [1, 2, 3, 4].map((index) => positions.get(`team-${index}`)!.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    const ys = [1, 2, 3, 4].map((index) => positions.get(`team-${index}`)!.y);
    expect(new Set(ys).size).toBe(1);
  });

  it('centres the thinking card horizontally', () => {
    const positions = layoutSpiderGraph(graphNodes(3, 3));
    const thinking = positions.get('thinking')!;

    // The card is positioned by its top-left, so its centre is x + width/2.
    expect(thinking.x + THINKING_CARD_WIDTH / 2).toBeCloseTo(0, 5);
  });

  it('gives taller cards more room so 20-player tiers never overlap', () => {
    const nodes = graphNodes(6, 3, 4, 8).map((entry) =>
      entry.kind === 'TIER' && entry.id === 'tier-3'
        ? { ...entry, players: players(20) }
        : entry,
    );
    const positions = layoutSpiderGraph(nodes);

    expect(overlappingPairs(nodes, positions)).toEqual([]);
  });

  it('uses measured card heights to space the bands', () => {
    const nodes = graphNodes(3, 2, 4, 8);
    const measured = new Map(nodes.map((entry) => [entry.id, 200]));
    const positions = layoutSpiderGraph(nodes, { measuredHeights: measured, laneGap: 90 });

    // Bands are separated by the measured height plus the row gap.
    const tierY = positions.get('tier-1')!.y;
    const thinkingY = positions.get('thinking')!.y;
    expect(thinkingY - tierY).toBeGreaterThanOrEqual(200);
  });

  it('grows chip cards with the group size', () => {
    const small = node({ id: 'a', kind: 'TIER', players: players(3) });
    const large = node({ id: 'b', kind: 'TIER', players: players(20) });
    expect(estimateNodeHeight(large)).toBeGreaterThan(estimateNodeHeight(small));
  });

  it('reserves full height for a team card that is still empty', () => {
    // A team card fills up during the replay; the layout reserves room for the
    // whole roster from the start so nothing shifts as chips appear.
    const big = node({ id: 'a', kind: 'TEAM', players: players(20) });
    const small = node({ id: 'b', kind: 'TEAM', players: players(5) });
    expect(estimateNodeHeight(big)).toBeGreaterThan(estimateNodeHeight(small));
  });

  it('never overlaps two nodes for realistic graph sizes', () => {
    const sizes: Array<[number, number]> = [
      [1, 2], [1, 4], [2, 2], [2, 3], [3, 3], [4, 4], [6, 2], [6, 3], [6, 4],
    ];
    for (const [tiers, teams] of sizes) {
      const nodes = graphNodes(tiers, teams);
      const overlaps = overlappingPairs(nodes, layoutSpiderGraph(nodes));
      expect(overlaps, `${tiers} tiers / ${teams} teams`).toEqual([]);
    }
  });

  it('is deterministic for the same graph shape', () => {
    const first = layoutSpiderGraph(graphNodes(6, 3));
    const second = layoutSpiderGraph(graphNodes(6, 3));

    expect([...first.entries()]).toEqual([...second.entries()]);
  });

  it('gives every node a finite position, including unknown kinds', () => {
    const nodes = [...graphNodes(6, 3), node({ id: 'orphan', kind: 'TIER', depth: 9, lane: 9 })];
    const positions = layoutSpiderGraph(nodes);

    expect(positions.size).toBe(nodes.length);
    for (const point of positions.values()) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });

  it('labels every status', () => {
    expect(Object.keys(statusLabel).sort()).toEqual(
      ['COMPLETED', 'FAILED', 'PENDING', 'RUNNING'],
    );
  });
});
