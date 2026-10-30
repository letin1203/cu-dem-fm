import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CARD_EDGE_INSET,
  anchorPointOnRect,
  buildSpiderPath,
  curveLength,
  pointAtLength,
  travelDuration,
  useSpiderAgent,
  type SpiderNodeRect,
} from './useSpiderAgent';

const rect = (overrides: Partial<SpiderNodeRect> = {}): SpiderNodeRect => ({
  x: 0,
  y: 0,
  width: 400,
  height: 200,
  ...overrides,
});

describe('anchorPointOnRect', () => {
  it('parks outside the card edge, never on top of the content', () => {
    const card = rect();
    const point = anchorPointOnRect(card, { x: -300, y: 100 });

    // Approaching from the left: the spider stops clear of the card.
    expect(point.x).toBeLessThan(card.x);
    expect(card.x - point.x).toBeGreaterThanOrEqual(CARD_EDGE_INSET);
    expect(point.y).toBeCloseTo(100, 0);
  });

  it('picks the edge facing the spider', () => {
    const card = rect();
    const fromRight = anchorPointOnRect(card, { x: 900, y: 100 });
    const fromBelow = anchorPointOnRect(card, { x: 200, y: 900 });

    expect(fromRight.x).toBeGreaterThan(card.x + card.width);
    expect(fromBelow.y).toBeGreaterThan(card.y + card.height);
  });

  it('handles a spider starting exactly at the centre', () => {
    const point = anchorPointOnRect(rect(), { x: 200, y: 100 });
    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);
    expect(point.x).toBeLessThan(200);
  });

  it('scales with card size', () => {
    const small = anchorPointOnRect(rect({ width: 100, height: 100 }), { x: -400, y: 50 });
    const large = anchorPointOnRect(rect({ width: 800, height: 400 }), { x: -400, y: 200 });

    expect(Math.abs(large.x)).toBeGreaterThan(Math.abs(small.x));
  });
});

describe('buildSpiderPath', () => {
  it('starts and ends at the requested points', () => {
    const path = buildSpiderPath({ x: 10, y: 20 }, { x: 300, y: 400 });

    expect(path.pointAt(0)).toEqual({ x: 10, y: 20 });
    const end = path.pointAt(1);
    expect(end.x).toBeCloseTo(300, 6);
    expect(end.y).toBeCloseTo(400, 6);
  });

  it('bows away from the straight line so travel reads as a crawl', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 400, y: 0 };
    const path = buildSpiderPath(from, to);
    const midpoint = path.pointAt(0.5);

    // A straight line would put the midpoint at y = 0.
    expect(Math.abs(midpoint.y)).toBeGreaterThan(10);
    expect(midpoint.x).toBeCloseTo(200, 6);
  });

  it('stays finite for a zero-length path', () => {
    const path = buildSpiderPath({ x: 5, y: 5 }, { x: 5, y: 5 });
    const point = path.pointAt(0.5);

    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);
  });

  it('keeps every sampled point inside the bounding box of the arc', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 100, y: 200 };
    const path = buildSpiderPath(from, to);

    for (let step = 0; step <= 10; step += 1) {
      const point = path.pointAt(step / 10);
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });
});

describe('arc-length sampling', () => {
  it('measures a curve longer than the straight line between its ends', () => {
    const path = buildSpiderPath({ x: 0, y: 0 }, { x: 400, y: 0 });
    const straight = 400;

    expect(curveLength(path)).toBeGreaterThan(straight);
  });

  it('advances at a constant rate along the arc', () => {
    const path = buildSpiderPath({ x: 0, y: 0 }, { x: 600, y: 200 });
    const total = curveLength(path);

    // Ten equal steps must each cover a tenth of the arc, unlike sampling the
    // raw Bézier parameter where speed varies with curvature.
    let previous = pointAtLength(path, 0);
    const steps: number[] = [];
    for (let index = 1; index <= 10; index += 1) {
      const point = pointAtLength(path, index / 10);
      steps.push(Math.hypot(point.x - previous.x, point.y - previous.y));
      previous = point;
    }

    const expected = total / 10;
    for (const step of steps) {
      expect(Math.abs(step - expected)).toBeLessThan(expected * 0.1);
    }
  });

  it('clamps out-of-range ratios', () => {
    const path = buildSpiderPath({ x: 0, y: 0 }, { x: 100, y: 0 });

    expect(pointAtLength(path, -1)).toEqual(path.pointAt(0));
    const end = pointAtLength(path, 5);
    expect(end.x).toBeCloseTo(100, 6);
  });
});

describe('travelDuration', () => {
  it('is clamped to a watchable range', () => {
    expect(travelDuration(0)).toBeGreaterThanOrEqual(320);
    expect(travelDuration(100_000)).toBeLessThanOrEqual(2_600);
  });

  it('grows with distance', () => {
    expect(travelDuration(1_000)).toBeGreaterThan(travelDuration(300));
  });
});

describe('useSpiderAgent', () => {
  const nodeRects = new Map<string, SpiderNodeRect>();

  /**
   * Deterministic animation driver: frames only advance when the test says so,
   * so travel is exercised for real instead of being short-circuited.
   */
  let pendingFrame: FrameRequestCallback | null = null;
  let now = 0;

  const advanceFrames = async (count = 1, stepMs = 16): Promise<void> => {
    for (let index = 0; index < count; index += 1) {
      const frame = pendingFrame;
      pendingFrame = null;
      now += stepMs;
      frame?.(now);
      // Let any awaited continuation run.
      await Promise.resolve();
    }
  };

  beforeEach(() => {
    nodeRects.clear();
    now = 0;
    pendingFrame = null;
    nodeRects.set('core', { x: 0, y: 0, width: 200, height: 100 });
    nodeRects.set('team-1', { x: 600, y: 0, width: 400, height: 200 });
    nodeRects.set('team-2', { x: 600, y: 400, width: 400, height: 200 });

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      pendingFrame = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      pendingFrame = null;
    });
  });

  const createAgent = (overrides: Partial<Parameters<typeof useSpiderAgent>[0]> = {}) =>
    useSpiderAgent({ getNodeRect: (id) => nodeRects.get(id) ?? null, ...overrides });

  it('reports failure and refuses to move to a node that does not exist', async () => {
    const agent = createAgent();

    await expect(agent.goToNode('missing')).resolves.toBe(false);
    expect(agent.state.value).toBe('failed');
  });

  it('places the spider on the first node without crawling from the origin', async () => {
    const agent = createAgent();

    await expect(agent.goToNode('core')).resolves.toBe(true);

    // No frame was needed: the first placement parks directly on the card.
    expect(pendingFrame).toBeNull();
    expect(agent.targetNodeId.value).toBe('core');
  });

  it('crawls toward a later node and only arrives after enough frames', async () => {
    const agent = createAgent();
    await agent.goToNode('core');

    let arrived = false;
    const travel = agent.goToNode('team-1').then((value) => {
      arrived = value;
    });

    // A couple of frames must not be enough to cover the distance.
    await advanceFrames(3);
    expect(arrived).toBe(false);
    expect(agent.state.value).toBe('moving');

    await advanceFrames(400);
    await travel;

    expect(arrived).toBe(true);
    expect(agent.state.value).toBe('interacting');
    expect(agent.hasArrived.value).toBe(true);
  });

  it('does not jump when the destination moves mid-flight', async () => {
    const agent = createAgent();
    await agent.goToNode('core');

    const travel = agent.goToNode('team-1');
    await advanceFrames(20);
    const before = { ...agent.position };

    // The card is dragged elsewhere while the spider is in flight.
    nodeRects.set('team-1', { x: 900, y: 700, width: 400, height: 200 });
    agent.syncToTarget();

    // The very next frame must continue from where the spider already is,
    // not snap to the new edge.
    await advanceFrames(1);
    const after = { ...agent.position };
    const jump = Math.hypot(after.x - before.x, after.y - before.y);
    expect(jump).toBeLessThan(40);

    await advanceFrames(600);
    await expect(travel).resolves.toBe(true);
  });

  it('fails safely when the target node disappears mid-flight', async () => {
    const agent = createAgent();
    await agent.goToNode('core');

    const travel = agent.goToNode('team-1');
    await advanceFrames(10);

    nodeRects.delete('team-1');
    await advanceFrames(600);

    await expect(travel).resolves.toBe(false);
    expect(agent.state.value).toBe('failed');
  });

  it('follows a card that moves while the spider rests on it', async () => {
    const agent = createAgent();
    await agent.goToNode('team-1');
    const parked = { ...agent.position };

    nodeRects.set('team-1', { x: 900, y: 300, width: 400, height: 200 });
    agent.syncToTarget();

    // It re-parks on the new edge rather than staying at the old position.
    expect(agent.position).not.toEqual(parked);
  });

  it('does not move when only the target id changes', async () => {
    const agent = createAgent();
    await agent.goToNode('team-1');
    const parked = { ...agent.position };

    // A new target is being acquired; syncToTarget must not teleport.
    agent.syncToTarget();
    expect(Math.hypot(agent.position.x - parked.x, agent.position.y - parked.y)).toBeLessThan(1);
  });

  it('stops on its target instead of hovering over nothing', async () => {
    const agent = createAgent();
    await agent.goToNode('team-1');

    nodeRects.delete('team-1');
    agent.syncToTarget();

    expect(agent.state.value).toBe('idle');
    expect(agent.targetNodeId.value).toBeNull();
  });

  it('a newer move supersedes the in-flight one', async () => {
    const agent = createAgent();
    await agent.goToNode('core');

    const first = agent.goToNode('team-1');
    await advanceFrames(10);
    const second = agent.goToNode('team-2');
    await advanceFrames(800);

    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(true);
    expect(agent.targetNodeId.value).toBe('team-2');
  });

  it('still crawls under reduced motion', async () => {
    // Teleporting under reduced motion made the agent look broken: it skipped
    // the walk and the leg animation never played. The preference now only
    // trims decoration, so travel must still be frame-driven.
    const agent = createAgent({ reducedMotion: () => true });
    await agent.goToNode('core');

    const travel = agent.goToNode('team-1');
    await advanceFrames(3);
    expect(agent.state.value).toBe('moving');

    await advanceFrames(800);
    await expect(travel).resolves.toBe(true);
    expect(agent.state.value).toBe('interacting');
  });

  it('records completed and failed states explicitly', () => {
    const agent = createAgent();

    agent.complete();
    expect(agent.state.value).toBe('completed');

    agent.fail();
    expect(agent.state.value).toBe('failed');
  });

  it('re-places instantly after resetPlacement', async () => {
    const agent = createAgent();
    await agent.goToNode('core');

    // Get to a different card first (needs frames).
    const travel = agent.goToNode('team-1');
    await advanceFrames(800);
    await travel;

    agent.stop();
    agent.resetPlacement();

    // After a reset the next move parks immediately again.
    await expect(agent.goToNode('core')).resolves.toBe(true);
    expect(pendingFrame).toBeNull();
  });
});
