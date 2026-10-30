import { onBeforeUnmount, ref, shallowRef } from 'vue';

/**
 * Interactive spider agent that crawls between the real cards on the Vue Flow
 * canvas.
 *
 * Coordinates are always *flow* coordinates, never screen pixels: the calling
 * component applies the live viewport transform to the overlay, so panning and
 * zooming stay in sync for free and the spider never drifts off its card.
 */

export type SpiderAgentState =
  | 'idle'
  | 'moving'
  | 'approaching'
  | 'interacting'
  | 'working'
  | 'completed'
  | 'failed'
  | 'paused';

export interface SpiderPoint {
  x: number;
  y: number;
}

export interface SpiderNodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * How far outside the card edge the spider parks, in flow units.
 *
 * The body is 34x40 units and the legs reach ~82 units, so the spider is
 * anchored `CARD_EDGE_INSET` plus one leg span away: that keeps the whole
 * sprite clear of the card's text and chips instead of crawling over them.
 */
/**
 * How far the antennae reach from the body centre, in flow units.
 *
 * The sprite draws them to SVG y = -45 with the origin at the body centre, so
 * this is the distance at which a feeler can touch something.
 */
export const ANTENNA_REACH = 45;

/**
 * Parking distance from the card edge.
 *
 * Deliberately slightly *less* than ANTENNA_REACH so the feelers physically
 * touch the card: pickup and drop are gated on contact, and parking further out
 * would leave a visible gap.
 */
export const CARD_EDGE_INSET = ANTENNA_REACH - 6;
/** Half the sprite footprint, used to keep the legs off the card. */
export const SPIDER_HALF_SPAN = 82;

/**
 * Crawling speed in flow units per second.
 *
 * During a distribution run the spider makes one tier→team trip per player, so
 * this is also what sets the whole replay length. 575 is deliberate: faster
 * reads as sliding rather than walking.
 */
export const CRAWL_SPEED = 575;
export const MIN_TRAVEL_MS = 320;
export const MAX_TRAVEL_MS = 2_600;

/**
 * Point on the card edge closest to `from`.
 *
 * The spider parks on the border rather than the centre so it never covers the
 * card's text or chips.
 */
export const anchorPointOnRect = (
  rect: SpiderNodeRect,
  from: SpiderPoint,
  inset = CARD_EDGE_INSET,
): SpiderPoint => {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const dx = from.x - centerX;
  const dy = from.y - centerY;

  // Degenerate case: start exactly at the centre, approach from the left.
  if (dx === 0 && dy === 0) {
    return { x: rect.x - inset, y: centerY };
  }

  // Scale the direction vector until it hits the card box, then step out.
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  const scaleX = dx === 0 ? Infinity : halfWidth / Math.abs(dx);
  const scaleY = dy === 0 ? Infinity : halfHeight / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);

  return {
    x: centerX + dx * scale * (1 + inset / Math.min(halfWidth, halfHeight)),
    y: centerY + dy * scale * (1 + inset / Math.min(halfWidth, halfHeight)),
  };
};

export interface SpiderPath {
  from: SpiderPoint;
  to: SpiderPoint;
  control: SpiderPoint;
  /** Point on the quadratic curve at `t` in [0, 1]. */
  pointAt: (t: number) => SpiderPoint;
}

/**
 * Quadratic Bézier that bows sideways, so the spider travels along a web-like
 * arc instead of a straight line. The bow direction alternates with the
 * direction of travel so repeated trips do not overlap.
 */
export const buildSpiderPath = (from: SpiderPoint, to: SpiderPoint): SpiderPath => {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const bow = Math.min(120, distance * 0.22);
  // Perpendicular offset; sign flips with travel direction.
  const sign = dx + dy >= 0 ? 1 : -1;
  const control = {
    x: midX - (dy / (distance || 1)) * bow * sign,
    y: midY + (dx / (distance || 1)) * bow * sign,
  };

  const pointAt = (t: number): SpiderPoint => {
    const inv = 1 - t;
    return {
      x: inv * inv * from.x + 2 * inv * t * control.x + t * t * to.x,
      y: inv * inv * from.y + 2 * inv * t * control.y + t * t * to.y,
    };
  };

  return { from, to, control, pointAt };
};

/** Travel time scaled by distance and clamped to a watchable range. */
export const travelDuration = (distance: number, speed = CRAWL_SPEED): number =>
  Math.round(Math.min(MAX_TRAVEL_MS, Math.max(MIN_TRAVEL_MS, (distance / speed) * 1000)));

/** Segments used when measuring and sampling a curve by arc length. */
const CURVE_SAMPLES = 48;

/** Approximate arc length of a quadratic Bézier by polyline sampling. */
export const curveLength = (path: SpiderPath, samples = CURVE_SAMPLES): number => {
  let length = 0;
  let previous = path.pointAt(0);
  for (let index = 1; index <= samples; index += 1) {
    const point = path.pointAt(index / samples);
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return length;
};

/**
 * Point at a fraction of the curve's *arc length*.
 *
 * Sampling by the Bézier parameter `t` makes the spider speed up where the
 * curve is steep; sampling by arc length keeps its speed constant.
 */
export const pointAtLength = (path: SpiderPath, ratio: number): SpiderPoint => {
  const clamped = Math.min(1, Math.max(0, ratio));
  if (clamped === 0) return path.pointAt(0);
  if (clamped === 1) return path.pointAt(1);

  const target = curveLength(path) * clamped;
  let travelled = 0;
  let previous = path.pointAt(0);
  for (let index = 1; index <= CURVE_SAMPLES; index += 1) {
    const point = path.pointAt(index / CURVE_SAMPLES);
    const segment = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (travelled + segment >= target) {
      const within = segment === 0 ? 0 : (target - travelled) / segment;
      return {
        x: previous.x + (point.x - previous.x) * within,
        y: previous.y + (point.y - previous.y) * within,
      };
    }
    travelled += segment;
    previous = point;
  }
  return path.pointAt(1);
};

const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

export interface UseSpiderAgentOptions {
  /** Geometry of a real Vue Flow node, in flow coordinates. */
  getNodeRect: (nodeId: string) => SpiderNodeRect | null;
  /**
   * Exact flow-space centre of a specific player badge.
   *
   * Used so the spider heads straight for the badge it is about to collect,
   * instead of the card's nearest edge.
   */
  getPlayerBadgePoint?: (playerId: string) => SpiderPoint | null;
  /** Honour the user's reduced-motion preference (teleport instead of crawl). */
  reducedMotion?: () => boolean;
  speed?: number;
}

export function useSpiderAgent(options: UseSpiderAgentOptions) {
  const state = ref<SpiderAgentState>('idle');
  const targetNodeId = ref<string | null>(null);
  const hasArrived = ref(false);
  /** False until the spider has been positioned at least once. */
  const isPlaced = ref(false);

  /**
   * ---------------------------------------------------------------
   * Planted feet
   * ---------------------------------------------------------------
   * Each leg owns one world-space anchor. While the spider walks, the foot
   * stays planted and the leg stretches; when it falls too far behind it lifts
   * and re-plants ahead of the body. This is what makes the legs read as
   * gripping a web rather than swinging in mid-air.
   */
  interface FootSeed {
    /** Rest offset from the body, in the body's unrotated frame. */
    baseX: number;
    baseY: number;
    /** Which side of the body this leg belongs to. */
    side: 'right' | 'left';
    /** This leg's natural extension; also its step threshold. */
    reach: number;
    /** Step-order slot, so the legs step in sequence rather than together. */
    order: number;
    /** Current world anchor. */
    x: number;
    y: number;
    /** True while the foot is airborne and moving to its next anchor. */
    lifting: boolean;
    /** Fixed world target captured when the foot lifted, or null when planted. */
    targetX: number | null;
    targetY: number | null;
    /** Recomputed each frame: this leg is stretched past its own reach. */
    due: boolean;
    /** How far past its own reach this leg is (lag / reach). */
    stretch: number;
    /** Increments each time the foot plants; drives the landing ripple. */
    landedAt: number;
  }

  const footSeeds: FootSeed[] = [];
  /** Current foot anchors, recomputed on every frame. */
  const feet = ref<Array<{
    x: number;
    y: number;
    lift: number;
    side: 'right' | 'left';
    /** Increments on each plant so the ripple can retrigger. */
    landedAt: number;
  }>>([]);

  /**
   * Rest geometry of the eight feet, in the body frame (drawn facing up).
   *
   * Side is explicit so the mapping cannot drift: entries 0-3 are the RIGHT
   * side, entries 4-7 the LEFT. Within each side leg 1 grips above the head,
   * leg 4 below the body, and legs 2-3 fan out between them.
   *
   * \`reach\` is that leg's natural extension. Varying it per leg is what gives
   * the eight legs visibly different lengths instead of a symmetrical star.
   */
  const FOOT_LAYOUT: Array<{
    side: 'right' | 'left';
    baseX: number;
    baseY: number;
    /** Distance this foot may lag before it steps. */
    reach: number;
    /** Step-order slot: legs step in this order, never all together. */
    order: number;
  }> = [
    // Step order alternates sides (right, left, right, left...) so the gait
    // reads as a walk. Every slot is unique: duplicate orders meant a leg
    // could wait forever behind a tie and never step.
    // ---- Right side, front to back ----
    { side: 'right', baseX: 38, baseY: -78, reach: 44, order: 0 }, // leg 1: above the head
    { side: 'right', baseX: 76, baseY: -30, reach: 62, order: 2 }, // leg 2
    { side: 'right', baseX: 74, baseY: 20, reach: 74, order: 4 },  // leg 3
    { side: 'right', baseX: 46, baseY: 64, reach: 52, order: 6 },  // leg 4: below the body
    // ---- Left side, front to back (mirrored) ----
    { side: 'left', baseX: -38, baseY: -78, reach: 44, order: 1 }, // leg 1
    { side: 'left', baseX: -76, baseY: -30, reach: 62, order: 3 }, // leg 2
    { side: 'left', baseX: -74, baseY: 20, reach: 74, order: 5 },  // leg 3
    { side: 'left', baseX: -46, baseY: 64, reach: 52, order: 7 },  // leg 4
  ];

  /**
   * A foot lifts once it lags past its own \`reach\`. Because each leg has a
   * different reach and a different step-order slot, they step at different
   * times instead of in lockstep.
   */
  /** How far ahead of the body a lifted foot is placed. */
  const STEP_LEAD = 30;
  /** Fraction of the remaining gap a swinging foot covers per frame. */
  const STEP_SPEED = 0.34;
  /** How many legs may be airborne at once (a walking spider keeps most down). */
  const MAX_AIRBORNE = 2;

  /**
   * Minimum distance a grip may sit from the body centre.
   *
   * The body silhouette is roughly a 48-unit-wide abdomen, i.e. a body radius of
   * ~24. A grip must therefore sit at least one more body-radius clear of that
   * edge, which is what "at least one body away from the body" means: 24 + 48.
   */
  const BODY_RADIUS = 24;
  const MIN_SNAP_DISTANCE = BODY_RADIUS * 3;

  const ensureFootSeeds = (): void => {
    if (footSeeds.length) return;
    FOOT_LAYOUT.forEach((layout) => {
      footSeeds.push({
        baseX: layout.baseX,
        baseY: layout.baseY,
        side: layout.side,
        reach: layout.reach,
        order: layout.order,
        x: position.x + layout.baseX,
        y: position.y + layout.baseY,
        lifting: false,
        targetX: null,
        targetY: null,
        due: false,
        stretch: 0,
        landedAt: 0,
      });
    });
  };


  /**
   * Position is deliberately *not* reactive per frame. The DOM node is moved
   * directly, which keeps Vue out of the 60fps loop.
   */
  const position: SpiderPoint = { x: 0, y: 0 };
  const angle = ref(0);
  const element = shallowRef<HTMLElement | null>(null);

  let frame: number | null = null;
  let runToken = 0;
  let resolveTravel: ((arrived: boolean) => void) | null = null;
  /** Set while a travel is in flight so a moving card can be followed. */
  let retargetDestination: ((next: SpiderPoint) => void) | null = null;
  /** True from the moment a travel is requested until it settles. */
  let travelling = false;
  /** False until the spider has been placed once on the canvas. */
  let placed = false;

  const reducedMotion = (): boolean => options.reducedMotion?.() ?? false;

  /**
   * The sprite is anchored (not rotated).
   *
   * Legs are drawn in world space so each foot can snap to its own fixed point
   * and stretch independently, like the reference. Rotating the whole group
   * would drag the planted feet with it, which is exactly what a real spider
   * does not do. Body orientation is published separately for the abdomen.
   */
  const applyTransform = (): void => {
    const node = element.value;
    if (!node) return;
    node.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
    node.style.transformOrigin = 'center center';
    // The body itself still turns to face travel; the legs do not.
    node.style.setProperty('--spider-body-rotation', `${angle.value}deg`);
    /*
     * Compute the negation numerically. Interpolating `-${angle}deg` breaks for
     * negative angles: it produces "--75.13deg", which CSS rejects, so the
     * carried badge never counter-rotated and its text stayed sideways.
     */
    node.style.setProperty('--spider-counter-rotation', `${-angle.value}deg`);
  };

  const render = (): void => applyTransform();

  /**
   * How many legs are currently airborne.
   *
   * Each leg decides to step on its own (its own reach and step order), so the
   * legs move independently. This counter only prevents the whole spider from
   * lifting off at once, which would look like levitation rather than walking.
   */
  const airborneCount = (seeds: FootSeed[]): number =>
    seeds.reduce((total, seed) => total + (seed.lifting ? 1 : 0), 0);

  /**
   * Pick the leg that should step next.
   *
   * Choosing purely by step order starved the back legs: the front leg was
   * almost always due, so the higher orders never got a turn. Selection is by
   * how far past its own reach a leg is (`stretch`), with the step order only
   * breaking ties. Every leg eventually becomes the most over-stretched, so
   * all eight step, each on its own schedule.
   */
  const pickNextStepper = (seeds: FootSeed[]): FootSeed | null => {
    const due = seeds.filter((seed) => !seed.lifting && seed.due);
    if (!due.length) return null;
    return due.reduce((best, seed) => {
      if (seed.stretch > best.stretch + 0.0001) return seed;
      if (Math.abs(seed.stretch - best.stretch) < 0.0001 && seed.order < best.order) return seed;
      return best;
    });
  };

  const updateFeet = (moving: boolean): void => {
    ensureFootSeeds();

    const rad = (angle.value * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Pass 1: refresh each leg's own rest point and decide whether it is due.
    // Each leg has its own `reach`, so a short front leg steps sooner than a
    // long middle leg: the legs move independently rather than in lockstep.
    footSeeds.forEach((foot) => {
      // Rest point in world space for the body's current pose.
      const restX = position.x + foot.baseX * cos - foot.baseY * sin;
      const restY = position.y + foot.baseX * sin + foot.baseY * cos;
      const lag = Math.hypot(restX - foot.x, restY - foot.y);
      // Distance of the planted grip from the body in world space.
      const fromBody = Math.hypot(foot.x - position.x, foot.y - position.y);

      /*
       * A foot steps when it lags too far behind OR when the body has moved so
       * close that the grip would sit under the abdomen. Without the second
       * condition a leg the body walks towards never re-plants, and its foot
       * ends up collapsing into the body centre.
       */
      const tooFar = lag > foot.reach;
      const tooClose = fromBody < MIN_SNAP_DISTANCE;
      foot.due = moving && !foot.lifting && (tooFar || tooClose);
      // Stretch is normalised so "too close" ranks as urgent as a long lag.
      foot.stretch = tooClose
        ? 2 + (MIN_SNAP_DISTANCE - fromBody) / MIN_SNAP_DISTANCE
        : lag / foot.reach;
    });

    // Pass 2: start at most one new step per frame, honouring the step order.
    // Without the cap all eight legs would leave the ground on the same frame.
    if (moving && airborneCount(footSeeds) < MAX_AIRBORNE) {
      const candidate = pickNextStepper(footSeeds);
      if (candidate) {
        const restX = position.x + candidate.baseX * cos - candidate.baseY * sin;
        const restY = position.y + candidate.baseX * sin + candidate.baseY * cos;
        candidate.lifting = true;
        // Capture the target ONCE. Recomputing it every frame makes the foot
        // chase a moving point and it never lands.
        const targetX = restX + Math.cos(rad) * STEP_LEAD;
        const targetY = restY + Math.sin(rad) * STEP_LEAD;

        /*
         * Push the grip out to the minimum distance if it would land too close
         * to the body. Without this, a sharp direction change can fold a leg
         * onto the abdomen.
         */
        const offsetX = targetX - position.x;
        const offsetY = targetY - position.y;
        const offsetLength = Math.hypot(offsetX, offsetY);
        if (offsetLength > 0.001 && offsetLength < MIN_SNAP_DISTANCE) {
          const scale = MIN_SNAP_DISTANCE / offsetLength;
          candidate.targetX = position.x + offsetX * scale;
          candidate.targetY = position.y + offsetY * scale;
        } else if (offsetLength <= 0.001) {
          // Degenerate: place it straight out along the leg's rest direction.
          const fallback = Math.hypot(candidate.baseX, candidate.baseY) || 1;
          candidate.targetX = position.x + (candidate.baseX / fallback) * MIN_SNAP_DISTANCE;
          candidate.targetY = position.y + (candidate.baseY / fallback) * MIN_SNAP_DISTANCE;
        } else {
          candidate.targetX = targetX;
          candidate.targetY = targetY;
        }
      }
    }

    // Pass 3: settle standing feet and advance swinging ones.
    footSeeds.forEach((foot) => {
      if (!foot.lifting) {
        if (!moving) {
          // Standing still: settle onto the rest point smoothly.
          const restX = position.x + foot.baseX * cos - foot.baseY * sin;
          const restY = position.y + foot.baseX * sin + foot.baseY * cos;
          foot.x += (restX - foot.x) * 0.22;
          foot.y += (restY - foot.y) * 0.22;
        }
        return;
      }

      if (foot.targetX === null || foot.targetY === null) return;
      const toX = foot.targetX - foot.x;
      const toY = foot.targetY - foot.y;
      if (Math.hypot(toX, toY) < 2.5) {
        // Plant exactly on the captured target.
        foot.x = foot.targetX;
        foot.y = foot.targetY;
        foot.lifting = false;
        foot.targetX = null;
        foot.targetY = null;
        // Bump the landing counter so the SVG can retrigger its ripple.
        foot.landedAt += 1;
      } else {
        // Eased so the swing reads as a step rather than a snap.
        foot.x += toX * STEP_SPEED;
        foot.y += toY * STEP_SPEED;
      }
    });

    /*
     * Publish as body-relative coordinates for the SVG.
     *
     * A grip is clamped to MIN_SNAP_DISTANCE from the body here, at render
     * time. Clamping only the step target was not enough: the body can move
     * towards a foot that is already planted (and a swinging foot can pass over
     * the abdomen), either of which drew a leg collapsing into the body.
     */
    feet.value = footSeeds.map((foot) => {
      let dx = foot.x - position.x;
      let dy = foot.y - position.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0.001 && distance < MIN_SNAP_DISTANCE) {
        const scale = MIN_SNAP_DISTANCE / distance;
        dx *= scale;
        dy *= scale;
      }
      return {
        x: dx,
        y: dy,
        lift: foot.lifting ? 1 : 0,
        side: foot.side,
        landedAt: foot.landedAt,
      };
    });
  };

  const setPosition = (point: SpiderPoint): void => {
    const dx = point.x - position.x;
    const dy = point.y - position.y;
    // A large jump (first placement, or a teleport) must not drag feet across
    // the canvas; the anchors are re-seeded relative to the new position.
    if (Math.hypot(dx, dy) > 220) footSeeds.length = 0;
    position.x = point.x;
    position.y = point.y;
    if (!isPlaced.value) isPlaced.value = true;
    applyTransform();
    updateFeet(travelling);
  };

  /** Attach the DOM element the agent drives. */
  const bindElement = (node: HTMLElement | null): void => {
    element.value = node;
    render();
  };

  const cancelAnimation = (): void => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    travelling = false;
    // Any in-flight travel resolves as cancelled so callers never hang.
    if (resolveTravel) {
      const resolve = resolveTravel;
      resolveTravel = null;
      resolve(false);
    }
  };

  const setState = (next: SpiderAgentState): void => {
    state.value = next;
  };

  const stop = (): void => {
    wandering = false;
    if (wanderTimer) clearTimeout(wanderTimer);
    wanderTimer = null;
    runToken += 1;
    cancelAnimation();
    setState('idle');
    targetNodeId.value = null;
    hasArrived.value = false;
  };

  /** Forget the current placement so the next run re-parks instead of crawling. */
  const resetPlacement = (): void => {
    placed = false;
    isPlaced.value = false;
  };

  /**
   * ---------------------------------------------------------------
   * Idle wandering
   * ---------------------------------------------------------------
   * With no task the spider patrols around a home point (the "AI suy nghĩ" card)
   * instead of freezing. It reuses travelTo(), so any real task cancels the
   * patrol instantly by bumping the run token.
   */
  let wandering = false;
  let wanderTimer: ReturnType<typeof setTimeout> | null = null;

  /** Random point on a ring around `home`, with a varied radius. */
  const wanderTarget = (home: SpiderPoint, radius: number): SpiderPoint => {
    const angle = Math.random() * Math.PI * 2;
    const distance = radius * (0.68 + Math.random() * 0.32);
    return {
      x: home.x + Math.cos(angle) * distance,
      // Squashed vertically so the patrol follows the card's shape.
      y: home.y + Math.sin(angle) * distance * 0.7,
    };
  };

  const stopWander = (): void => {
    wandering = false;
    if (wanderTimer) clearTimeout(wanderTimer);
    wanderTimer = null;
  };

  /**
   * Patrol around `home` until a task cancels it.
   *
   * @param home Home point in flow coordinates.
   * @param radius How far from home the spider may roam.
   */
  const startWander = (home: SpiderPoint, radius = 150): void => {
    stopWander();
    wandering = true;

    const loop = async (): Promise<void> => {
      if (!wandering) return;
      setState('moving');
      // Short hops at reduced speed read as scuttling, not marching.
      const arrived = await travelTo(wanderTarget(home, radius), CRAWL_SPEED * 0.55);
      if (!arrived || !wandering) return;
      setState('idle');
      // Spiders move in bursts, so pause between hops.
      wanderTimer = setTimeout(() => {
        void loop();
      }, 380 + Math.random() * 520);
    };

    void loop();
  };

  /**
   * Crawl to a point along a Bézier arc.
   *
   * Motion is driven by *arc length travelled*, not by elapsed time against a
   * fixed curve: retargeting mid-flight only swaps the remaining curve, so the
   * spider keeps its current position and never jumps. Speed is constant, which
   * is what makes the crawl read as walking rather than a slide.
   *
   * Resolves `true` on arrival, `false` when superseded or cancelled.
   */
  const travelTo = (initialDestination: SpiderPoint, speedOverride?: number): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
      cancelAnimation();
      const token = runToken + 1;
      runToken = token;
      resolveTravel = resolve;
      travelling = true;

      let destination = initialDestination;
      const start = { x: position.x, y: position.y };
      const distance = Math.hypot(destination.x - start.x, destination.y - start.y);

      // A zero-length hop needs no animation.
      //
      // Reduced motion deliberately does NOT teleport: the crawl is the whole
      // point of the agent (it shows which card is being worked on), so the
      // preference only trims ambient decoration in SpiderAgent.vue. Teleporting
      // here also silently disabled the leg animation for those users.
      if (distance < 1) {
        setPosition(destination);
        resolveTravel = null;
        travelling = false;
        resolve(true);
        return;
      }

      const speed = speedOverride ?? options.speed ?? CRAWL_SPEED;
      let path = buildSpiderPath(start, destination);
      let pathLength = Math.max(1, curveLength(path));
      let travelledAlongPath = 0;
      let lastFrameAt = performance.now();

      const step = (now: number): void => {
        if (token !== runToken) return;

        // Clamp the frame delta so a stalled tab (or a blocked main thread)
        // cannot teleport the spider when the frames resume. 32ms is two
        // dropped frames; beyond that the spider simply walks slower.
        const elapsed = Math.min(32, Math.max(0, now - lastFrameAt));
        lastFrameAt = now;
        travelledAlongPath += (speed * elapsed) / 1000;

        // Re-sample the current curve by arc length so speed stays constant
        // even where the Bézier is steeper.
        const ratio = Math.min(1, travelledAlongPath / pathLength);
        const point = pointAtLength(path, ratio);
        const behind = pointAtLength(path, Math.max(0, ratio - 0.02));

        const dx = point.x - behind.x;
        const dy = point.y - behind.y;
        if (Math.abs(dx) + Math.abs(dy) > 0.01) {
          // +90deg because the SVG spider is drawn facing up.
          angle.value = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        }

        setPosition(point);

        if (ratio >= 1) {
          setPosition(destination);
          frame = null;
          resolveTravel = null;
          travelling = false;
          retargetDestination = null;
          resolve(true);
          return;
        }

        frame = requestAnimationFrame(step);
      };

      /**
       * A card moved mid-flight. Rebuild the *remaining* arc from the spider's
       * current position to the new edge point and keep the crawl going, so
       * there is no positional discontinuity.
       */
      const retarget = (next: SpiderPoint): void => {
        const current = { x: position.x, y: position.y };
        if (Math.hypot(next.x - current.x, next.y - current.y) < 1) return;
        path = buildSpiderPath(current, next);
        pathLength = Math.max(1, curveLength(path));
        travelledAlongPath = 0;
        destination = next;
      };
      retargetDestination = retarget;

      frame = requestAnimationFrame(step);
    });

  /**
   * True when the antennae are touching the given node.
   *
   * Pickup and drop are gated on this rather than merely on "the spider
   * arrived", so a badge only changes hands when a feeler is physically on the
   * card. The feelers point along the body's facing direction.
   */
  const hasAntennaContact = (nodeId: string, tolerance = 4): boolean => {
    const rect = options.getNodeRect(nodeId);
    if (!rect) return false;

    const rad = (angle.value * Math.PI) / 180;
    // Antenna tips sit ~45 units ahead of the body centre, either side of the
    // facing direction.
    const forwardX = Math.sin(rad);
    const forwardY = -Math.cos(rad);
    const sideX = Math.cos(rad);
    const sideY = Math.sin(rad);

    const tipOffsets = [-9, 9].map((offset) => ({
      x: position.x + forwardX * ANTENNA_REACH + sideX * offset,
      y: position.y + forwardY * ANTENNA_REACH + sideY * offset,
    }));

    return tipOffsets.some(
      (tip) =>
        tip.x >= rect.x - tolerance
        && tip.x <= rect.x + rect.width + tolerance
        && tip.y >= rect.y - tolerance
        && tip.y <= rect.y + rect.height + tolerance,
    );
  };

  /**
   * Crawl so the antennae land exactly on a point (a badge, rather than a card
   * edge). The feelers reach ANTENNA_REACH ahead of the body, so the body parks
   * that far short of the target along the approach direction.
   */
  const goToPoint = async (
    target: SpiderPoint,
    stateDuringMove: SpiderAgentState = 'moving',
  ): Promise<boolean> => {
    wandering = false;
    if (wanderTimer) clearTimeout(wanderTimer);
    wanderTimer = null;

    if (!placed) {
      placed = true;
      setPosition(target);
      hasArrived.value = true;
      setState('interacting');
      return true;
    }

    // Stop with the antennae on the badge.
    const approachX = position.x - target.x;
    const approachY = position.y - target.y;
    const approachLength = Math.hypot(approachX, approachY) || 1;
    const parked = {
      x: target.x + (approachX / approachLength) * ANTENNA_REACH,
      y: target.y + (approachY / approachLength) * ANTENNA_REACH,
    };

    setState(stateDuringMove);
    const arrived = await travelTo(parked);
    if (!arrived) return false;

    hasArrived.value = true;
    setState('interacting');
    return true;
  };

  const currentDestination = (): SpiderPoint | null => {
    const nodeId = targetNodeId.value;
    if (!nodeId) return null;
    const rect = options.getNodeRect(nodeId);
    if (!rect) return null;
    return anchorPointOnRect(rect, position);
  };

  /**
   * Walk to a real node.
   *
   * When `via` is supplied the spider travels through that node first, which
   * lets a tier→team trip follow the connector: every connector in the graph is
   * routed through the "AI suy nghĩ" card, so passing through it makes the
   * spider's path match the drawn edge instead of cutting across the canvas.
   *
   * Returns `false` when the node no longer exists (for example, a re-run
   * replaced the graph), so callers can bail out safely.
   */
  const goToNode = async (
    nodeId: string,
    stateDuringMove: SpiderAgentState = 'moving',
    via?: string,
  ): Promise<boolean> => {
    // A real task always wins over idle patrol.
    wandering = false;
    if (wanderTimer) clearTimeout(wanderTimer);
    wanderTimer = null;

    const rect = options.getNodeRect(nodeId);
    if (!rect) {
      targetNodeId.value = null;
      setState('failed');
      return false;
    }

    targetNodeId.value = nodeId;
    hasArrived.value = false;
    setState(stateDuringMove);

    const destination = anchorPointOnRect(rect, position);

    // First placement: park instantly instead of crawling from the canvas
    // origin, which would read as a long unexplained slide.
    if (!placed) {
      placed = true;
      setPosition(destination);
      hasArrived.value = true;
      setState('interacting');
      return true;
    }

    // Route through the connector's waypoint first, if it is a different card.
    if (via && via !== nodeId) {
      const viaRect = options.getNodeRect(via);
      if (viaRect) {
        const viaPoint = anchorPointOnRect(viaRect, position);
        const reachedVia = await travelTo(viaPoint);
        if (!reachedVia) return false;
        // Re-read the destination: it may have moved while we walked.
        const movedRect = options.getNodeRect(nodeId);
        if (!movedRect) {
          targetNodeId.value = null;
          setState('failed');
          return false;
        }
        const reDestination = anchorPointOnRect(movedRect, position);
        const finished = await travelTo(reDestination);
        if (!finished) return false;

        if (!options.getNodeRect(nodeId)) {
          targetNodeId.value = null;
          setState('failed');
          return false;
        }
        hasArrived.value = true;
        setState('interacting');
        return true;
      }
    }

    const arrived = await travelTo(destination);
    if (!arrived) return false;

    // The card may have been removed while the spider was crawling.
    if (!options.getNodeRect(nodeId)) {
      targetNodeId.value = null;
      setState('failed');
      return false;
    }

    hasArrived.value = true;
    setState('interacting');
    return true;
  };

  /**
   * Follow the target card when it moves.
   *
   * Only two situations should move the spider here:
   *  - a crawl is in flight, so the remaining arc is re-aimed (no snapping);
   *  - the spider is already parked on the card, so it re-parks on the new edge.
   *
   * Any other time it is mid-transition (the target id was just switched) and
   * moving it would teleport the spider across the canvas.
   */
  const syncToTarget = (): void => {
    const nodeId = targetNodeId.value;
    if (!nodeId) return;

    const rect = options.getNodeRect(nodeId);
    if (!rect) {
      // Target vanished: stop safely instead of hovering over nothing.
      stop();
      return;
    }

    const destination = anchorPointOnRect(rect, position);
    if (travelling) {
      retargetDestination?.(destination);
      return;
    }
    if (hasArrived.value) {
      setPosition(destination);
    }
  };

  const complete = (): void => {
    cancelAnimation();
    setState('completed');
  };

  const fail = (): void => {
    cancelAnimation();
    setState('failed');
  };

  const pause = (): void => {
    if (state.value !== 'moving' && state.value !== 'approaching') return;
    cancelAnimation();
    setState('paused');
  };

  const resume = async (): Promise<void> => {
    if (state.value !== 'paused') return;
    const nodeId = targetNodeId.value;
    if (!nodeId) {
      setState('idle');
      return;
    }
    const rect = options.getNodeRect(nodeId);
    if (!rect) {
      setState('failed');
      return;
    }
    setState('moving');
    const destination = anchorPointOnRect(rect, position);
    const arrived = await travelTo(destination);
    if (arrived) setState('interacting');
  };

  onBeforeUnmount(() => {
    runToken += 1;
    cancelAnimation();
  });

  return {
    state,
    targetNodeId,
    hasArrived,
    isPlaced,
    angle,
    position,
    bindElement,
    feet,
    hasAntennaContact,
    setState,
    goToNode,
    goToPoint,
    travelTo,
    syncToTarget,
    complete,
    fail,
    pause,
    resume,
    stop,
    resetPlacement,
    startWander,
    stopWander,
    currentDestination,
  };
}
