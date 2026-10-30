import type { AiGraphNode, AiNodeStatus } from '../types/aiGraph';

export const statusColor: Record<AiNodeStatus, string> = {
  RUNNING: '#ff2fb3',
  COMPLETED: '#37e0a0',
  FAILED: '#ff4d6d',
  PENDING: '#5a5570',
};

export const statusLabel: Record<AiNodeStatus, string> = {
  RUNNING: 'Đang chạy',
  COMPLETED: 'Hoàn thành',
  FAILED: 'Thất bại',
  PENDING: 'Đang chờ',
};

export interface SpiderLayoutOptions {
  /** Horizontal distance from the centre to the tier column. */
  tierOffset?: number;
  /** Horizontal distance from the centre to the team column. */
  teamOffset?: number;
  /** Vertical spacing between siblings in the tier column. */
  laneGap?: number;
  /** Vertical spacing between team cards; larger so they fill the height. */
  teamGap?: number;
  /**
   * Real rendered card heights, keyed by node id.
   *
   * When a card's height is known it is used verbatim; the estimate is only a
   * first-pass fallback. A measured height is exact, which is the only way to
   * guarantee the column never overlaps.
   */
  measuredHeights?: Map<string, number>;
}

export interface SpiderPosition {
  x: number;
  y: number;
}

/**
 * Card widths.
 *
 * Tier cards are wider than team cards: they hold the whole roster before
 * distribution, so they need more horizontal room for their badges.
 */
export const TEAM_CARD_WIDTH = 400;
export const TIER_CARD_WIDTH = Math.round(TEAM_CARD_WIDTH * 1.2);
/** The thinking card is narrower than the others. */
export const THINKING_CARD_WIDTH = 340;
/** Horizontal breathing room between the columns. */
const COLUMN_GAP = 90;
/** Kept for callers that only need the base width. */
export const CARD_WIDTH = TEAM_CARD_WIDTH;

/**
 * Chips that fit on one row of a card.
 *
 * Measured from the rendered DOM, not assumed: a 480px tier card fits 2.86
 * badges per row and a 400px team card about 2.4. Badge widths vary a lot
 * (name length), so these are averages with a small margin subtracted to stay
 * on the safe side of the height estimate.
 */
const AVG_CHIP_WIDTH = 150;
const CHIP_GAP = 5;
const CARD_PADDING = 24;
/**
 * Badge widths vary with name length, so the fit is rounded rather than
 * floored: at 480px the measured ratio is 2.97 badges per row, which is really
 * three. Flooring reported two and doubled the estimated row count.
 */
const chipsPerRow = (width: number): number =>
  Math.max(1, Math.round((width - CARD_PADDING + CHIP_GAP) / (AVG_CHIP_WIDTH + CHIP_GAP)));

/**
 * Extra vertical padding applied to the estimate.
 *
 * The fit is an average across cards whose badge text has different lengths, so
 * a small safety margin is added: underestimating height is what causes cards to
 * overlap, while overestimating only leaves a little more space.
 */
const HEIGHT_SAFETY = 46;

/**
 * Rendered height of a card. Tier and team cards wrap chips, so a taller group
 * needs more vertical room; a fixed lane gap would let neighbours overlap.
 * These are intentionally generous estimates of the real rendered heights.
 */
export const estimateNodeHeight = (node: AiGraphNode): number => {
  /*
   * Fitted by least squares to six measured tier cards (2..20 chips):
   *   header + padding = 94px, 19px per badge row.
   * The header (icon, label, sublabel, divider) is taller than it looks, which
   * is what earlier estimates missed.
   */
  const ROW_HEIGHT = 19;
  const BASE_HEIGHT = 94;
  if (node.kind === 'CORE') return 108;
  if (node.kind === 'THINKING') return 159;

  /*
   * A team card starts empty and fills up during the replay, so reserve the
   * space for the full roster up front to keep the layout stable. It also
   * matches the thinking card's minimum height (132), which the CSS enforces.
   */
  const playerCount = node.players?.length ?? 0;
  const perRow = chipsPerRow(node.kind === 'TIER' ? TIER_CARD_WIDTH : TEAM_CARD_WIDTH);
  const rows = Math.max(1, Math.ceil(playerCount / perRow));
  const height = BASE_HEIGHT + rows * ROW_HEIGHT + HEIGHT_SAFETY;
  // Only team cards are padded to the thinking card's height; tier cards size
  // to their content, so forcing a minimum inflated short ones.
  return node.kind === 'TEAM' ? Math.max(159, height) : height;
};

/**
 * Row-based layout, top to bottom:
 *
 *   1. Tier cards laid out HORIZONTALLY along the top
 *   2. "AI suy nghĩ" centred underneath them
 *   3. Team cards laid out HORIZONTALLY along the bottom
 *
 * This reads as a pipeline (roster -> thinking -> result) and, unlike the old
 * three-column layout, cannot overlap: each band owns its own vertical strip and
 * the columns grow sideways where there is room.
 *
 * Positions are TOP-LEFT corners, which is what Vue Flow expects.
 */
export const layoutSpiderGraph = (
  nodes: AiGraphNode[],
  options: SpiderLayoutOptions = {},
): Map<string, SpiderPosition> => {
  const rowGap = options.laneGap ?? 90;
  const cardGap = options.teamGap ?? 28;
  const measured = options.measuredHeights;

  const positions = new Map<string, SpiderPosition>();

  const heightOf = (node: AiGraphNode): number =>
    measured?.get(node.id) ?? estimateNodeHeight(node);

  const widthOf = (node: AiGraphNode): number => {
    if (node.kind === 'TIER') return TIER_CARD_WIDTH;
    if (node.kind === 'TEAM') return TEAM_CARD_WIDTH;
    return THINKING_CARD_WIDTH;
  };

  const byLane = (kind: AiGraphNode['kind']) =>
    nodes
      .filter((node) => node.kind === kind)
      .sort((first, second) => first.lane - second.lane);

  /**
   * Lay a band of cards out side by side, centred on x = 0.
   * Returns the band's total height so the caller can advance the cursor.
   */
  const row = (group: AiGraphNode[], y: number, gap = cardGap): number => {
    if (!group.length) return 0;
    const widths = group.map(widthOf);
    const total =
      widths.reduce((sum, width) => sum + width, 0) + gap * (group.length - 1);

    let cursor = -total / 2;
    group.forEach((node, index) => {
      positions.set(node.id, { x: cursor, y });
      cursor += widths[index] + gap;
    });

    return Math.max(...group.map(heightOf));
  };

  const tiers = byLane('TIER');
  const teams = byLane('TEAM');
  const thinking = nodes.find((node) => node.kind === 'THINKING');

  /*
   * Bands are stacked from the top. The whole stack is centred vertically on
   * y = 0 so the thinking card stays roughly in the middle of the canvas.
   */
  const tierHeight = tiers.length ? Math.max(...tiers.map(heightOf)) : 0;
  const thinkingHeight = thinking ? heightOf(thinking) : 0;
  const teamHeight = teams.length ? Math.max(...teams.map(heightOf)) : 0;

  const bands = [tierHeight, thinkingHeight, teamHeight].filter((height) => height > 0);
  const totalHeight =
    bands.reduce((sum, height) => sum + height, 0) + rowGap * Math.max(0, bands.length - 1);

  let y = -totalHeight / 2;

  if (tiers.length) {
    row(tiers, y);
    y += tierHeight + rowGap;
  }

  if (thinking) {
    // The thinking card is centred horizontally under the tier band.
    positions.set(thinking.id, {
      x: -THINKING_CARD_WIDTH / 2,
      y,
    });
    y += thinkingHeight + rowGap;
  }

  if (teams.length) {
    row(teams, y);
  }

  // Anything without a known kind still gets a deterministic slot.
  nodes.forEach((node, index) => {
    if (positions.has(node.id)) return;
    positions.set(node.id, { x: 0, y: (index + 1) * 60 });
  });

  return positions;
};
