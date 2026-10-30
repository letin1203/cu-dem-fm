<template>
  <div class="fixed inset-0 z-[120] flex items-stretch justify-center bg-black/90">
    <div class="spider-shell flex h-full w-full flex-col overflow-hidden">
      <!-- Header -->
      <header class="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
        <div class="flex items-center gap-3">
          <span class="spider-logo">🕷</span>
          <div>
            <h2 class="text-base font-bold text-white">AI chia team</h2>
            <p class="text-xs text-fuchsia-200/70">
              {{
                graph
                  ? isComplete
                    ? `Hoàn tất · ${graph.summary.teams} đội · ${graph.events.length} bước`
                    : `Đang mô phỏng ${graph.events.length} bước · ${Math.round(progress * 100)}%`
                  : 'Đồ thị thực thi từ backend'
              }}
            </p>
          </div>
        </div>

        <div class="ml-auto flex flex-wrap items-center gap-2">
          <span
            v-for="item in statusLegend"
            :key="item.status"
            class="spider-legend"
            :style="{ '--legend-color': item.color }"
          >
            <i /> {{ item.label }} ({{ statusCounts[item.status] }})
          </span>
          <button
            v-if="graph"
            type="button"
            class="spider-btn spider-btn--ghost"
            :disabled="isPlaying"
            @click="replay"
          >
            ↺ Phát lại
          </button>
          <button
            v-if="canApply"
            type="button"
            class="spider-btn"
            :disabled="applying || isPlaying"
            @click="applyAiTeams"
          >
            {{ applying ? 'Đang áp dụng…' : 'Áp dụng' }}
          </button>
          <button type="button" class="spider-btn spider-btn--ghost" @click="$emit('close')">
            Đóng
          </button>
        </div>
        <div class="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            class="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-400 transition-[width] duration-200"
            :style="{ width: `${Math.round(progress * 100)}%` }"
          />
        </div>
      </header>

      <!-- Body: graph + side panels -->
      <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
        <!-- Graph canvas -->
        <section ref="canvasRef" class="relative min-h-[52vh] flex-1 lg:min-h-0">
          <div v-if="loading" class="absolute inset-0 z-20 grid place-items-center bg-black/70">
            <div class="flex flex-col items-center gap-3 text-fuchsia-200">
              <span class="spider-spinner" />
              <p class="text-sm">Backend đang chạy pipeline chia team...</p>
            </div>
          </div>

          <div v-if="error" class="absolute inset-x-4 top-4 z-20 rounded-xl border border-red-500/50 bg-red-950/85 px-4 py-3 text-sm text-red-200">
            {{ error }}
          </div>

          <VueFlow
            id="ai-split-graph"
            :nodes="flowNodes"
            :edges="flowEdges"
            :min-zoom="0.25"
            :max-zoom="2"
            :default-viewport="{ zoom: 0.72 }"
            fit-view-on-init
            :nodes-draggable="false"
            :nodes-connectable="false"
            :elements-selectable="true"
            class="spider-canvas"
          >
            <template #node-spider="{ data, selected }">
              <SpiderNode
                :data="data"
                :selected="selected"
                :revealed-player-ids="revealedPlayerIds"
                :roster-player-ids="teamRosterByNodeId.get(data.id)"
                :players-by-id="playersById"
                :processing-player-id="processingPlayerId"
                :delivered-player-id="deliveredPlayerId"
                :agent-focused="agentTargetNodeId === data.id"
                :completed-phase-ids="completedPhaseIds"
                :active-phase-id="activePhaseId"
                :carried-player-id="carriedPlayerId"
                :releasing-player-ids="releasingPlayerIds"
              />
            </template>
            <template #edge-spider="{ ...edgeProps }">
              <SpiderEdge v-bind="edgeProps" />
            </template>
            <Background variant="dots" :gap="34" :size="1.2" color="#3a2350" />
          </VueFlow>

          <!--
            Spider agent overlay. It lives inside the canvas box and is
            transformed with the live Vue Flow viewport, so the spider stays
            glued to its card during pan/zoom without any pixel maths.
          -->
          <div
            v-if="graph && flowNodes.length"
            class="spider-agent-layer"
            :style="agentLayerStyle"
          >
            <SpiderAgent
              v-show="agentPlaced"
              :state="agentState"
              :bind="bindAgentElement"
              :reduced-motion="prefersReducedMotion"
              :carried-player-id="carriedPlayerId"
              :carried-visible="!dropInFlight"
              :carried-label="carriedPlayer?.name ?? null"
              :carried-is-goalkeeper="isGoalkeeperPosition(carriedPlayer?.position)"
              :carried-tier="carriedPlayer?.tier ?? null"
              :carried-avatar="carriedPlayer?.avatar ?? null"
              :feet="agentFeet"
            />
          </div>

          <!--
            Transfer animation: a badge flying between a card and the spider's
            feelers. Positioned in screen space because it animates between two
            measured DOM rectangles rather than through the graph.
          -->
          <span
            v-if="transferBadge"
            class="spider-transfer"
            :class="{ 'is-gk': transferBadge.isGoalkeeper }"
            :style="transferBadge.style"
          >
            <img
              v-if="transferBadge.avatar"
              :src="transferBadge.avatar"
              class="spider-transfer__avatar"
              alt=""
            />
            <span v-else class="spider-transfer__avatar spider-transfer__avatar--initial">
              {{ transferBadge.label.charAt(0) }}
            </span>
            {{ transferBadge.label }}<em v-if="transferBadge.tierLabel" class="spider-transfer__tier">{{ transferBadge.tierLabel }}</em>
          </span>

          <!--
            Viewport controls are hidden: the graph is auto-fitted on every run
            and the modal is full-screen, so these only added clutter.
          -->
        </section>

        <!-- Side panels -->
        <aside class="flex w-full shrink-0 flex-col gap-3 overflow-hidden border-t border-white/10 p-3 lg:w-[360px] lg:border-l lg:border-t-0">
          <!-- Summary -->
          <div v-if="graph" class="spider-panel">
            <h3 class="spider-panel__title">Tổng quan thực thi</h3>
            <dl class="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div v-for="item in summaryItems" :key="item.label" class="spider-stat">
                <dt>{{ item.label }}</dt>
                <dd>{{ item.value }}</dd>
              </div>
            </dl>
          </div>

          <!-- Live step timeline: phases, allocations and swaps -->
          <div class="spider-panel spider-panel--activity">
            <h3 class="spider-panel__title">
              Hoạt động tác vụ
              <span class="spider-panel__count">
                {{ revealedEvents.length }}/{{ timeline.length }}
              </span>
            </h3>
            <div v-if="currentEntry" class="spider-current">
              <span class="spider-current__kind" :class="`is-${currentEntry.kind.toLowerCase()}`">
                {{ kindLabel(currentEntry.kind) }}
              </span>
              <span class="spider-current__text">{{ currentEntry.label }}</span>
            </div>
            <ol v-if="revealedEvents.length" class="spider-activity-list mt-2 flex flex-col gap-1 overflow-y-auto pr-1">
              <li
                v-for="entry in recentEntries"
                :key="entry.id"
                class="spider-event"
                :class="[`is-${entry.kind.toLowerCase()}`, { 'is-last': entry.id === currentEntry?.id }]"
              >
                <span class="spider-event__kind">{{ kindLabel(entry.kind) }}</span>
                <span class="spider-event__body">
                  <strong>{{ entry.label }}</strong>
                  {{ entry.detail }}
                </span>
              </li>
            </ol>
            <p v-else class="mt-2 text-xs text-white/40">Chưa có hoạt động.</p>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import SpiderNode from './SpiderNode.vue';
import SpiderEdge from './SpiderEdge.vue';
import SpiderAgent from './SpiderAgent.vue';
import { CARD_EDGE_INSET, useSpiderAgent } from '../../composables/useSpiderAgent';
import { apiClient } from '../../api/client';
import { useToast } from 'vue-toastification';
import { layoutSpiderGraph, statusColor, statusLabel } from '../../utils/aiGraphLayout';
import { useAiGraphPlayback } from '../../composables/useAiGraphPlayback';
import type {
  AiGraphNode,
  AiNodeStatus,
  AiSplitGraph,
} from '../../types/aiGraph';

const props = defineProps<{
  playerIds: string[];
  battlePairs: Array<{ firstId: string; secondId: string }>;
  initialTeamCount?: number;
  /**
   * Tournament to write the result into.
   *
   * When set, the modal offers an "Áp dụng" action that persists the split.
   * The Test chia team page omits it and stays read-only.
   */
  applyTournamentId?: string | null;
  /** Pitch the split belongs to; required for persistence. */
  applyField?: 'FIELD_5' | 'FIELD_7' | null;
}>();

const emit = defineEmits<{ close: []; applied: [] }>();

const toast = useToast();
const canvasRef = ref<HTMLElement | null>(null);
const loading = ref(false);
const error = ref('');
const graph = ref<AiSplitGraph | null>(null);
const teamCount = ref(props.initialTeamCount ?? 3);
const {
  timeline,
  nodeStatus,
  revealedPlayerIds: playbackRevealedPlayerIds,
  committedStepCount,
  teamRosterByNodeId,
  playersById,
  revealedEvents,
  currentEntry,
  completedPhaseIds,
  activePhaseId,
  isPlaying,
  isComplete,
  progress,
  completeStep,
  replay,
} = useAiGraphPlayback(() => graph.value);

// The store must be shared with <VueFlow> explicitly: calling useVueFlow()
// in this component's setup runs before the child mounts, so without an id it
// would create a second, empty store and the viewport buttons would do
// nothing.
const {
  zoomIn,
  zoomOut,
  fitView,
  setViewport,
  onNodesInitialized,
  viewport,
  dimensions,
  findNode,
} = useVueFlow({ id: 'ai-split-graph' });
const controls = { zoomIn, zoomOut, fitView };

/**
 * Fit the viewport only once Vue Flow has measured every node. Fitting on
 * `nextTick` runs before node dimensions are known, which leaves the
 * outermost nodes clipped off the canvas.
 *
 * The listener stays registered for the lifetime of the modal (Vue Flow
 * disposes it with the effect scope) so that every new run re-fits, including
 * a re-run that reuses the same node ids.
 */
/**
 * Fit the whole graph in view.
 *
 * A plain `fitView` is correct for the row layout: the bands are stacked
 * vertically and each row spans the full width, so fitting the bounding box is
 * exactly what should be visible. Placing a single card at the centre (as the
 * old three-column layout needed) would push the wide tier row off screen.
 */
const fitGraph = async (): Promise<void> => {
  await fitView({ padding: 0.12, duration: 240 });
};

onNodesInitialized(() => {
  void fitGraph();
});

const canRun = computed(() => props.playerIds.length >= 10);

/**
 * The canvas renders the backend graph verbatim: nodes and edges are mapped
 * 1:1 from the response, and positions come from the backend's depth/lane
 * ordering. No node is invented on the client.
 */
/**
 * Real rendered heights of the cards, keyed by node id.
 *
 * The layout has to know how tall each card is before placing it, but the cards
 * size themselves from their badge content — an estimate is only ever
 * approximate and caused overlapping tier cards. After each render the measured
 * heights are fed back in, so the second pass is exact.
 */
const measuredHeights = ref<Map<string, number>>(new Map());

/**
 * Measure the rendered cards and feed the heights back into the layout.
 *
 * Runs once per render; the layout then re-stacks with exact heights. The guard
 * stops it looping when nothing actually changed.
 */
const captureCardHeights = async (): Promise<void> => {
  await nextTick();
  const canvas = canvasRef.value;
  if (!canvas) {
    return;
  }

  const zoom = viewport.value.zoom || 1;
  const next = new Map<string, number>();
  for (const el of canvas.querySelectorAll<HTMLElement>('.vue-flow__node')) {
    const id = el.getAttribute('data-id');
    const card = el.querySelector<HTMLElement>('.spider-node');
    if (!id || !card) continue;
    // Convert screen height back to flow units.
    next.set(id, card.getBoundingClientRect().height / zoom);
  }

  // Only update when something changed by more than a pixel.
  let changed = next.size !== measuredHeights.value.size;
  if (!changed) {
    for (const [id, height] of next) {
      if (Math.abs((measuredHeights.value.get(id) ?? 0) - height) > 1) { changed = true; break; }
    }
  }
  if (changed) measuredHeights.value = next;
};

const flowNodes = computed(() => {
  if (!graph.value) return [];
  // Positions come from the spider layout, which is derived from the graph's
  // own structure; the status shown is the replay position, not a canned one.
  const positions = layoutSpiderGraph(graph.value.nodes, {
    measuredHeights: measuredHeights.value,
  });

  return graph.value.nodes.map((node) => ({
    id: node.id,
    type: 'spider',
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    data: { ...node, status: nodeStatus(node) },
    // Deliberately no fixed `width`: the card components size themselves (the
    // thinking card is 340px, the others 400px), and forcing one width made
    // Vue Flow report wrong dimensions, which skewed both the layout and the
    // spider's anchoring maths.
    draggable: false,
    selectable: true,
  }));
});

/**
 * The two connectors to light for the current distribution step.
 *
 * `from` is the tier card the badge is being taken from, `to` the thinking card
 * that routes it; the thinking -> team leg is matched through `teamNodeId`.
 */
const activeConnectorPair = computed<{
  from: string;
  to: string;
  teamNodeId?: string;
} | null>(() => {
  const entry = currentEntry.value;
  if (!entry || entry.kind !== 'ALLOCATE' || !entry.pickupNodeId) return null;
  const thinkingId = graph.value?.nodes.find((node) => node.kind === 'THINKING')?.id;
  if (!thinkingId) return null;
  return {
    from: entry.pickupNodeId,
    to: thinkingId,
    teamNodeId: entry.nodeIds[0],
  };
});

const flowEdges = computed(() => {
  if (!graph.value) return [];

  /*
   * Only the two connectors that belong to the player being distributed are
   * lit: tier -> thinking and thinking -> team.
   *
   * The graph draws every tier into the thinking card and the thinking card into
   * every team, so lighting edges by node status highlighted all of them at
   * once and told the viewer nothing about which player was moving.
   */
  const highlighted = activeConnectorPair.value;
  const isHighlighted = (edge: { source: string; target: string }): boolean => {
    if (!highlighted) return false;
    // Leg 1: tier <-> thinking.
    const inbound =
      (edge.source === highlighted.from && edge.target === highlighted.to)
      || (edge.source === highlighted.to && edge.target === highlighted.from);
    if (inbound) return true;
    // Leg 2: thinking <-> destination team.
    if (!highlighted.teamNodeId) return false;
    return (
      (edge.source === highlighted.teamNodeId && edge.target === highlighted.to)
      || (edge.source === highlighted.to && edge.target === highlighted.teamNodeId)
    );
  };

  return graph.value.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'spider',
    animated: false,
    data: {
      status: isHighlighted(edge) ? 'RUNNING' : 'PENDING',
      label: edge.label,
      settled: isComplete.value,
    },
  }));
});

/**
 * ---------------------------------------------------------------
 * Spider agent integration
 * ---------------------------------------------------------------
 * The agent walks between the REAL Vue Flow nodes: geometry is read from the
 * store (`findNode().dimensions`), and the overlay is transformed with the live
 * viewport, so pan/zoom never desync it.
 */

const prefersReducedMotion = ref(false);
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  prefersReducedMotion.value = query.matches;
  const onChange = (event: MediaQueryListEvent) => {
    prefersReducedMotion.value = event.matches;
  };
  query.addEventListener('change', onChange);
  onBeforeUnmount(() => query.removeEventListener('change', onChange));
}

/**
 * Real geometry of a node in flow coordinates, or null when the node is gone.
 * Vue Flow stores measured dimensions on the graph node, so this never relies
 * on hard-coded sizes.
 */
const getNodeRect = (nodeId: string) => {
  const node = findNode(nodeId);
  if (!node) return null;
  const width = Number(node.dimensions?.width) || 0;
  const height = Number(node.dimensions?.height) || 0;
  if (!width || !height) return null;
  return {
    x: node.computedPosition?.x ?? node.position.x,
    y: node.computedPosition?.y ?? node.position.y,
    width,
    height,
  };
};

/** How close the body must be to a card to count as "at" it. */
const CARD_REACH = CARD_EDGE_INSET + 40;

/**
 * Flow-space centre of a specific player's badge chip.
 *
 * Measured from the live DOM and converted back through Vue Flow's viewport, so
 * it always matches where the badge is actually drawn (zoom and pan included).
 */
const getPlayerBadgePoint = (playerId: string, withinNodeId?: string) => {
  const canvas = canvasRef.value;
  if (!canvas) return null;

  /*
   * Scope the search to the card we are walking to when one is given.
   *
   * Searching the whole canvas could match a stale chip on a different card
   * (the same player can briefly render elsewhere during a swap), which made
   * the spider collect a badge while standing at the wrong card.
   */
  // Vue Flow tags each node wrapper with `data-id="<flowId>-<nodeId>"`.
  const scope = withinNodeId
    ? canvas.querySelector<HTMLElement>(`[data-id="${CSS.escape(withinNodeId)}"]`) ?? canvas
    : canvas;
  const chip = scope.querySelector<HTMLElement>(`[data-player-id="${CSS.escape(playerId)}"]`);
  if (!chip) return null;
  const chipRect = chip.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const zoom = viewport.value.zoom || 1;
  // Screen -> flow: undo the viewport transform.
  return {
    x: (chipRect.left + chipRect.width / 2 - canvasRect.left - viewport.value.x) / zoom,
    y: (chipRect.top + chipRect.height / 2 - canvasRect.top - viewport.value.y) / zoom,
  };
};

const agent = useSpiderAgent({
  getNodeRect,
  getPlayerBadgePoint,
  reducedMotion: () => prefersReducedMotion.value,
});

/**
 * A badge mid-transfer between a card and the spider.
 *
 * The animation runs in screen space from the source rectangle to the
 * destination rectangle, so it is visibly the *same* badge moving rather than
 * two badges swapping visibility.
 */
const transferBadge = ref<{
  label: string;
  tierLabel: string;
  isGoalkeeper: boolean;
  avatar: string | null;
  style: Record<string, string>;
} | null>(null);

/** Screen-space rectangle of a player's badge chip, if rendered. */
const getChipRect = (playerId: string): DOMRect | null => {
  const canvas = canvasRef.value;
  if (!canvas) return null;
  const chip = canvas.querySelector<HTMLElement>(`[data-player-id="${CSS.escape(playerId)}"]`);
  return chip ? chip.getBoundingClientRect() : null;
};

/**
 * Animate a badge between two screen rectangles.
 *
 * Uses the Web Animations API so the flight is independent of the replay
 * timers, and resolves when it lands.
 */
/**
 * Screen rect of the chip area on a node's card.
 *
 * Used as a flight destination because the player's own chip does not exist
 * until the roster commits.
 */
const getCardChipRect = (nodeId: string): DOMRect | null => {
  const canvas = canvasRef.value;
  if (!canvas) return null;
  const target = canvas.querySelector<HTMLElement>(
    `[data-id="${CSS.escape(nodeId)}"] [class*="spider-node__chips"]`,
  ) ?? canvas.querySelector<HTMLElement>(`[data-id="${CSS.escape(nodeId)}"]`);
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  // Aim at the top-left chip slot, where a newly added badge appears.
  return new DOMRect(rect.left + 14, rect.top + 10, 8, 8);
};

/** Screen rect of the badge currently held in the antennae. */
const getCarriedRect = (): DOMRect | null =>
  canvasRef.value?.querySelector<HTMLElement>('.spider-agent__carry')
    ?.getBoundingClientRect() ?? null;

const flyBadge = async (
  playerId: string,
  from: DOMRect | null,
  to: DOMRect | null,
  // Long enough to read as a hand-off. 180ms was over in ~4 frames, so the
  // flight looked like a flicker rather than a badge being carried.
  durationMs = 420,
): Promise<void> => {
  const player = playersById.value.get(playerId);
  // Note: NOT gated on prefers-reduced-motion. The flight *is* the hand-off the
  // user asked to see; suppressing it made the badge appear to teleport (and
  // with reduced motion enabled, no animation was visible at all).
  if (!player || !from || !to) return;

  const isGoalkeeper = player.position === 'GK' || player.position === 'Goalkeeper';
  /*
   * `from`/`to` are getBoundingClientRect values (viewport space), but the
   * transfer element is absolutely positioned inside the canvas section. Mixing
   * the two put the badge one canvas-offset away from the chip it should emerge
   * from, so convert into the canvas's own coordinate space first.
   */
  const origin = canvasRef.value?.getBoundingClientRect();
  const originLeft = origin?.left ?? 0;
  const originTop = origin?.top ?? 0;

  transferBadge.value = {
    label: player.name,
    tierLabel: isGoalkeeper ? 'GK' : `T${player.tier}`,
    isGoalkeeper,
    avatar: player.avatar ?? null,
    style: {
      left: `${from.left + from.width / 2 - originLeft}px`,
      top: `${from.top + from.height / 2 - originTop}px`,
    },
  };

  await nextTick();
  const node = document.querySelector<HTMLElement>('.spider-transfer');
  if (!node) {
    transferBadge.value = null;
    return;
  }

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const animation = node.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.85)', opacity: 0.55 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.15)`, opacity: 1 },
    ],
    { duration: durationMs, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
  );
  await animation.finished.catch(() => undefined);
  transferBadge.value = null;
};
/** Player badge the spider is carrying between a tier card and a team card. */
const carriedPlayerId = ref<string | null>(null);
/**
 * Player the current step is about to collect.
 *
 * Set as soon as the step starts (before the spider arrives) so the tier card
 * can enlarge and highlight that badge, making it obvious which player is being
 * processed.
 */
const processingPlayerId = ref<string | null>(null);
/** Player delivered on the previous step, which plays the shrink-back. */
const deliveredPlayerId = ref<string | null>(null);
/**
 * Players whose badge is in the air between the feelers and a team card.
 *
 * Both the tier card and the team card hide these, so the badge exists in
 * exactly one place during the hand-off. Keying this off the roster commit was
 * unreliable: for a frame the badge was neither carried nor listed, and the tier
 * card re-rendered it.
 */
const releasingPlayerIds = ref<Set<string>>(new Set());
/**
 * True while a drop flight is in progress.
 *
 * The flight now happens BEFORE the carry clears (so the spider stays parked),
 * which meant the badge rendered twice: in the flying element and still in the
 * antennae. This flag hides the antennae copy for the duration.
 */
const dropInFlight = ref(false);

/**
 * Clears the landing highlight shortly after it starts.
 *
 * `is-landing` drives a one-shot CSS animation; leaving the class attached
 * would keep it pinned at the animation's final frame instead of letting the
 * badge settle naturally, and the class would leak onto later renders.
 */
let landingTimer: ReturnType<typeof setTimeout> | null = null;
const playLanding = (playerId: string): void => {
  if (landingTimer) clearTimeout(landingTimer);
  deliveredPlayerId.value = playerId;
  landingTimer = setTimeout(() => {
    if (deliveredPlayerId.value === playerId) deliveredPlayerId.value = null;
    landingTimer = null;
  }, 560);
};
/**
 * Players already allocated by the replay timeline.
 *
 * This is the authoritative set: it always matches the run's progress, so the
 * final rosters are correct even if the spider cannot keep up. The spider's
 * carry only *suppresses* the badge on both cards while it is in the air.
 */
const revealedPlayerIds = computed(() => playbackRevealedPlayerIds.value);
/** Player record for the carried badge, so the sprite can render it. */
const isGoalkeeperPosition = (position?: string): boolean =>
  position === 'GK' || position === 'Goalkeeper';

const carriedPlayer = computed(() => {
  const playerId = carriedPlayerId.value;
  if (!playerId || !graph.value) return null;
  for (const node of graph.value.nodes) {
    const found = node.players?.find((player) => player.id === playerId);
    if (found) return found;
  }
  return null;
});
const {
  state: agentState,
  targetNodeId: agentTargetNodeId,
  isPlaced: agentPlaced,
  feet: agentFeet,
  hasAntennaContact,
  bindElement: bindAgentElement,
} = agent;

/** Keep the agent anchored on its card when the card moves. */
watch(
  () => {
    const id = agent.targetNodeId.value;
    if (!id) return null;
    const rect = getNodeRect(id);
    return rect ? `${rect.x}:${rect.y}:${rect.width}:${rect.height}` : 'gone';
  },
  () => agent.syncToTarget(),
);

/**
 * The overlay is placed at the canvas origin and receives the exact viewport
 * transform Vue Flow is using, so flow coordinates inside it line up with the
 * cards regardless of zoom or pan.
 */
const agentLayerStyle = computed(() => ({
  transform: `translate(${viewport.value.x}px, ${viewport.value.y}px) scale(${viewport.value.zoom})`,
  transformOrigin: '0 0',
}));

/**
 * Walk the spider along the replay timeline as it actually unfolds.
 *
 * The timeline is the same one driving the cards, so the spider always heads
 * to the node the current step really belongs to. It is not a separate script.
 */
/**
 * Walk the spider through the current step.
 *
 * Allocation steps are a two-leg trip: crawl to the tier card the player
 * belongs to, pick the badge up, then carry it to the destination team card.
 * Every other step is a single hop to the node it lights up.
 */
watch(
  () => currentEntry.value,
  async (entry) => {
    if (!nodesMeasured.value) return;
    // A replay step means work again.
    if (entry) agent.stopWander();

    /**
     * Release the timeline gate.
     *
     * Allocation and swap steps are both driven by the spider, so the replay
     * waits for it. Every early return below must release it, otherwise a
     * superseded step leaves the replay waiting forever.
     */
    const releaseGate = (): void => {
      if (entry?.kind === 'ALLOCATE' || entry?.kind === 'SWAP') completeStep(entry.id);
    };

    // Highlight the player this step will collect, before the spider arrives.
    processingPlayerId.value = entry?.carriedPlayerId ?? null;
    if (!entry || !entry.nodeIds.length) {
      carriedPlayerId.value = null;
      if (agentState.value === 'interacting') agent.complete();
      return;
    }

    /*
     * Swap step: both players change teams. The spider fetches one badge from
     * the first team, drops it on the second, then brings the other badge back,
     * so the exchange is visible instead of the rosters silently reshuffling.
     */
    if (entry.kind === 'SWAP' && entry.swap) {
      const { firstId, secondId, firstTeamNodeId, secondTeamNodeId } = entry.swap;

      /*
       * A swap moves BOTH players. Each leg is played like a distribution: walk
       * to the source card, fly the badge into the feelers, carry it across, then
       * fly it down onto the destination card. Without the flights the badges
       * simply teleported between teams.
       */
      const swapLeg = async (playerId: string, fromNodeId: string, toNodeId: string): Promise<boolean> => {
        // 1. Walk to the card the badge is leaving.
        const reached = await agent.goToNode(fromNodeId, 'moving');
        if (!reached || currentEntry.value?.id !== entry.id) return false;

        // 2. Fly the badge from its chip into the feelers.
        const sourceRect = getChipRect(playerId);
        const feelers = canvasRef.value
          ?.querySelector<HTMLElement>('.spider-agent')
          ?.getBoundingClientRect() ?? null;
        await flyBadge(playerId, sourceRect, feelers);
        if (currentEntry.value?.id !== entry.id) return false;

        // 3. Carry it across.
        carriedPlayerId.value = playerId;
        agent.setState('interacting');
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (currentEntry.value?.id !== entry.id) {
          carriedPlayerId.value = null;
          return false;
        }

        const arrived = await agent.goToNode(toNodeId, 'moving');
        if (!arrived || currentEntry.value?.id !== entry.id) {
          carriedPlayerId.value = null;
          return false;
        }

        // 4. Fly it down onto the destination card.
        const launch = getCarriedRect();
        const destination = getCardChipRect(toNodeId);
        dropInFlight.value = true;
        await nextTick();
        await flyBadge(playerId, launch, destination);
        dropInFlight.value = false;

        carriedPlayerId.value = null;
        agent.setState('interacting');
        return currentEntry.value?.id === entry.id;
      };

      const firstLeg = await swapLeg(firstId, firstTeamNodeId, secondTeamNodeId);
      if (!firstLeg) {
        releaseGate();
        return;
      }

      const secondLeg = await swapLeg(secondId, secondTeamNodeId, firstTeamNodeId);
      releaseGate();
      return;
    }

    // ---------------------------------------------------------------
    // Pick up the player's badge from its tier card.
    // ---------------------------------------------------------------
    if (entry.kind === 'ALLOCATE' && entry.pickupNodeId && entry.carriedPlayerId) {
      /*
       * Aim the antennae at the badge, not at the card.
       *
       * Falls back to the card edge when the badge has not been measured yet
       * (for example on the very first frame of a run).
       */
      const badgePoint = getPlayerBadgePoint(entry.carriedPlayerId, entry.pickupNodeId);
      const picked = badgePoint
        ? await agent.goToPoint(badgePoint, 'moving')
        : await agent.goToNode(entry.pickupNodeId, 'moving');
      if (!picked || currentEntry.value?.id !== entry.id) {
        releaseGate();
        return;
      }

      /*
       * Confirm the spider really is at the pickup card before taking the
       * badge. `goToNode` can resolve immediately when the spider is already
       * parked somewhere else, which started a carry from a team card.
       */
      const pickupRect = getNodeRect(entry.pickupNodeId);
      const agentPos = agent.position;
      const atPickup = !pickupRect
        || (
          agentPos.x >= pickupRect.x - CARD_REACH
          && agentPos.x <= pickupRect.x + pickupRect.width + CARD_REACH
          && agentPos.y >= pickupRect.y - CARD_REACH
          && agentPos.y <= pickupRect.y + pickupRect.height + CARD_REACH
        );
      if (!atPickup) {
        // Walk there properly before collecting.
        const retried = await agent.goToNode(entry.pickupNodeId, 'moving');
        if (!retried || currentEntry.value?.id !== entry.id) {
          releaseGate();
          return;
        }
      }

      /*
       * The badge only leaves the card once a feeler touches it. `goToNode`
       * parks with the antennae against the edge, so this is a short wait; it
       * exists so the hand-off is tied to contact rather than to arrival.
       */
      for (let attempt = 0; attempt < 24; attempt += 1) {
        if (hasAntennaContact(entry.pickupNodeId)) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }

      /*
       * Badge flies from its tier chip to the feelers before the spider starts
       * carrying it, so the hand-off is visible.
       */
      const sourceRect = getChipRect(entry.carriedPlayerId);
      const agentRect = canvasRef.value
        ?.querySelector<HTMLElement>('.spider-agent')
        ?.getBoundingClientRect() ?? null;
      await flyBadge(entry.carriedPlayerId, sourceRect, agentRect);

      // Picked up: the highlight moves from the card to the spider.
      carriedPlayerId.value = entry.carriedPlayerId;
      processingPlayerId.value = null;
      agent.setState('interacting');
      // A short beat at the tier card before carrying it away.
      await new Promise((resolve) => setTimeout(resolve, 120));
      if (currentEntry.value?.id !== entry.id) {
        carriedPlayerId.value = null;
        releaseGate();
        return;
      }
    }

    // ---------------------------------------------------------------
    // Carry to the destination card (or a single hop for other steps).
    // ---------------------------------------------------------------
    const nodeId = entry.nodeIds[0];
    /*
     * Tier→team trips follow the connector. Every connector is routed through
     * the thinking card, so passing through it makes the spider's route match
     * the drawn edge instead of cutting across the canvas.
     */
    const thinkingNodeId = graph.value?.nodes.find((node) => node.kind === 'THINKING')?.id;
    const via = entry.kind === 'ALLOCATE' && thinkingNodeId ? thinkingNodeId : undefined;

    // A newer entry may have replaced this one while the spider was crawling;
    // goToNode() already resolves false in that case, so just bail out.
    const arrived = await agent.goToNode(nodeId, 'moving', via);
    if (!arrived) {
      carriedPlayerId.value = null;
      releaseGate();
      return;
    }
    if (currentEntry.value?.id !== entry.id) {
      carriedPlayerId.value = null;
      releaseGate();
      return;
    }

    agent.setState(entry.kind === 'PHASE' ? 'working' : 'interacting');

    /*
     * The badge is only released once a feeler touches the destination card,
     * mirroring the pickup rule.
     *
     * `carriedPlayerId` is deliberately NOT cleared here: the drop flight below
     * needs the spider to still be holding it, and clearing it would let the
     * tier card re-render the player during the gap.
     */
    if (entry.kind === 'ALLOCATE') {
      for (let attempt = 0; attempt < 24; attempt += 1) {
        if (hasAntennaContact(nodeId)) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }

    /*
     * Swap and phase steps do not have a drop flight, so their carry (if any)
     * ends here.
     */
    if (entry.kind !== 'ALLOCATE') {
      carriedPlayerId.value = null;
    }

    // Reached the team card: the badge flies from the feelers onto the card.
    if (entry.kind === 'ALLOCATE' && entry.carriedPlayerId) {
      const carriedId = entry.carriedPlayerId;
      const teamNodeId = entry.nodeIds[0];

      /*
       * Fly the badge down BEFORE releasing the gate.
       *
       * The gate controls the timeline, and releasing it starts the next step —
       * which made the spider walk away and only then did the badge fly in.
       * Holding the gate keeps the spider parked at the team card for the whole
       * hand-off.
       *
       * The destination is measured from the team CARD, because the player's chip
       * is not rendered until the roster commits (which happens after the gate is
       * released). Landing on the card is correct: that is where the chip appears.
       */
      releasingPlayerIds.value = new Set([...releasingPlayerIds.value, carriedId]);

      /*
       * Launch from the badge's ACTUAL position.
       *
       * The carried badge lives inside the rotated SVG head group, so it hangs
       * wherever the antennae are pointing — not at the sprite's bounding-box
       * top. Measuring the box put the flight start in the wrong place whenever
       * the body was turned, which is why the flight looked inaccurate.
       */
      const carriedEl = canvasRef.value?.querySelector<HTMLElement>('.spider-agent__carry');
      const launchRect = carriedEl?.getBoundingClientRect() ?? null;

      /*
       * Destination: the exact place the badge will appear.
       *
       * The chip only renders after the roster commits (post-gate), so it cannot
       * be measured yet. The card's own chip area is used instead — approximated
       * from its padding and header height so the flight lands where the chip
       * will actually sit, rather than at a guessed fraction of the card.
       */
      const teamCard = canvasRef.value?.querySelector<HTMLElement>(
        `[data-id="${CSS.escape(teamNodeId)}"] [class*="spider-node__chips"]`,
      ) ?? canvasRef.value?.querySelector<HTMLElement>(
        `[data-id="${CSS.escape(teamNodeId)}"]`,
      );
      const cardRect = teamCard?.getBoundingClientRect() ?? null;
      const destinationRect = cardRect
        ? new DOMRect(cardRect.left + 14, cardRect.top + 10, 8, 8)
        : null;

      playLanding(carriedId);
      // Hide the antennae copy so the badge exists only once, in flight.
      dropInFlight.value = true;
      await nextTick();
      await flyBadge(carriedId, launchRect, destinationRect);
      dropInFlight.value = false;

      // Landed: the spider lets go, and only now may the replay advance.
      carriedPlayerId.value = null;
      releaseGate();

      // Give the roster a moment to commit so the chip exists on the card.
      for (let attempt = 0; attempt < 120; attempt += 1) {
        if (revealedPlayerIds.value.has(carriedId)) break;
        await new Promise((resolve) => setTimeout(resolve, 16));
      }

      // The badge now lives on the team card; unhide it.
      const stillHidden = new Set(releasingPlayerIds.value);
      stillHidden.delete(carriedId);
      releasingPlayerIds.value = stillHidden;

      /*
       * Guarded clear: with the flight happening before the gate, the next step
       * normally has not started yet, but keep the check so a superseded step
       * can never wipe the following player's highlight.
       */
      if (currentEntry.value?.id === entry.id) processingPlayerId.value = null;
      return;
    }
    processingPlayerId.value = null;

    // Non-allocation steps (swap/phase): just let the replay advance.
    releaseGate();
  },
);

watch(isComplete, (complete) => {
  if (!complete) return;
  if (agentState.value === 'failed') return;
  agent.complete();
  // No task left: patrol around the thinking card instead of freezing.
  const thinkingId = graph.value?.nodes.find((node) => node.kind === 'THINKING')?.id;
  if (!thinkingId) return;
  const rect = getNodeRect(thinkingId);
  if (!rect) return;
  agent.startWander({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, 170);
});

/** True once Vue Flow has measured every node at least once. */
const nodesMeasured = ref(false);
onNodesInitialized(() => {
  nodesMeasured.value = true;
});

/**
 * Park the spider on the thinking card at the start of a run.
 *
 * There is no "core" node any more; the thinking card is the anchor of the
 * graph, so that is where the spider begins.
 */
const startAgentOnThinking = async (): Promise<void> => {
  const thinkingId = graph.value?.nodes.find((node) => node.kind === 'THINKING')?.id;
  if (!thinkingId) return;

  // Wait for measurement: geometry is 0x0 before Vue Flow has sized the nodes.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (getNodeRect(thinkingId)) break;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  nodesMeasured.value = true;
  await agent.goToNode(thinkingId);
};

// Re-measure after every render that can change a card's height.
watch(
  [graph, () => revealedPlayerIds.value.size, () => committedStepCount.value],
  () => { void captureCardHeights(); },
  { flush: 'post' },
);

watch(
  () => graph.value?.taskId,
  (taskId) => {
    if (!taskId) return;
    agent.stop();
    agent.resetPlacement();
    carriedPlayerId.value = null;
    void startAgentOnThinking();
  },
);

/** Latest entries first, so the active step stays visible without scrolling. */
const recentEntries = computed(() => [...revealedEvents.value].reverse().slice(0, 40));

const KIND_LABELS: Record<string, string> = {
  PHASE: 'Bước',
  ALLOCATE: 'Xếp đội',
  SWAP: 'Hoán đổi',
};

const kindLabel = (kind: string): string => KIND_LABELS[kind] ?? kind;

const statusCounts = computed<Record<AiNodeStatus, number>>(() => {
  const counts: Record<AiNodeStatus, number> = {
    RUNNING: 0,
    COMPLETED: 0,
    FAILED: 0,
    PENDING: 0,
  };
  for (const node of graph.value?.nodes ?? []) counts[node.status] += 1;
  return counts;
});

const statusLegend = computed(() =>
  (['RUNNING', 'COMPLETED', 'FAILED', 'PENDING'] as AiNodeStatus[]).map((status) => ({
    status,
    label: statusLabel[status],
    color: statusColor[status],
  })),
);

const summaryItems = computed(() => {
  if (!graph.value) return [];
  const { summary } = graph.value;
  return [
    { label: 'Cầu thủ', value: summary.players },
    { label: 'Đội', value: summary.teams },
    { label: 'Lượt hoán đổi', value: summary.swaps },
    { label: 'Đổi tránh lặp', value: summary.repeatTeammateSwaps },
    { label: 'Chênh lệch Tier', value: summary.totalTierSpread.toFixed(1) },
    { label: 'Chênh lệch Tier 1', value: summary.tierOneSpread },
  ];
});

const relayout = async (): Promise<void> => {
  await nextTick();
  await fitGraph();
};

/** Persistence is only offered when the caller supplies a tournament. */
const canApply = computed(
  () => Boolean(props.applyTournamentId && props.applyField && isComplete.value),
);

const applying = ref(false);

/**
 * Persist the split the user just reviewed.
 *
 * The server re-derives the roster and reruns the pipeline, so the stored teams
 * are always valid for the tournament — the client never uploads a team layout.
 */
const applyAiTeams = async (): Promise<void> => {
  if (!props.applyTournamentId || !props.applyField || applying.value) return;
  applying.value = true;
  try {
    const response = await apiClient.post(
      `/tournaments/${props.applyTournamentId}/apply-ai-teams`,
      { teamCount: teamCount.value, field: props.applyField },
    );
    if (!response.success) throw new Error(response.error || 'Không thể áp dụng');
    toast.success('Đã áp dụng kết quả AI chia team');
    emit('applied');
    emit('close');
  } catch (err: any) {
    toast.error(err.response?.data?.error || err.message || 'Không thể áp dụng');
  } finally {
    applying.value = false;
  }
};

const runAiSplit = async (): Promise<void> => {
  if (!canRun.value || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await apiClient.post<AiSplitGraph>('/tournaments/ai-split', {
      playerIds: props.playerIds,
      teamCount: teamCount.value,
      battlePairs: props.battlePairs,
      taskId: `ai-${Date.now()}`,
    });
    if (!response.success) throw new Error(response.error || 'Không thể chạy AI chia team');
    graph.value = response.data as AiSplitGraph;
    // First run is centred by the nodes-initialized listener; a re-run reuses
    // already-measured node ids, so it has to recentre explicitly.
    await nextTick();
    await fitGraph();
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message || 'Không thể chạy AI chia team';
  } finally {
    loading.value = false;
  }
};

// The parent builds `player-ids` inline, so it is a fresh array on every
// render. Watch a stable key instead of the array reference, otherwise an
// unrelated parent re-render would wipe the finished graph.
/**
 * Refit whenever the canvas itself changes size.
 *
 * The results band appears when the replay ends and takes height from the
 * canvas, and the window can be resized at any time. Watching the canvas box is
 * the only reliable trigger: fitting on `isComplete` races the layout pass.
 */
onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas || typeof ResizeObserver === 'undefined') return;
  let lastWidth = 0;
  let lastHeight = 0;
  let pending: ReturnType<typeof setTimeout> | null = null;
  const observer = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect;
    if (!box) return;
    // Ignore sub-pixel jitter and the initial observation.
    if (Math.abs(box.width - lastWidth) < 2 && Math.abs(box.height - lastHeight) < 2) return;
    lastWidth = box.width;
    lastHeight = box.height;
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      // Keep the thinking card centred instead of recentring on the bounding
      // box, which drifts because the tier column is the tallest part.
      void fitGraph();
    }, 120);
  });
  observer.observe(canvas);
  onBeforeUnmount(() => {
    if (landingTimer) clearTimeout(landingTimer);
    observer.disconnect();
    if (pending) clearTimeout(pending);
  });
});

watch(
  () => props.playerIds.join(','),
  () => {
    graph.value = null;
    error.value = '';
  },
);

// Run immediately with the selections made on the Test chia team page, so
// opening the modal already produces a result instead of waiting for a click.
onMounted(() => {
  void runAiSplit();
});
</script>

<style scoped>
.spider-shell {
  background:
    radial-gradient(1100px 620px at 18% -10%, rgba(255, 47, 179, 0.16), transparent 60%),
    radial-gradient(900px 520px at 88% 108%, rgba(124, 58, 237, 0.2), transparent 62%),
    #050308;
  color: #efe7ff;
}

.spider-logo {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: rgba(255, 47, 179, 0.16);
  box-shadow: 0 0 18px rgba(255, 47, 179, 0.4);
  font-size: 18px;
}

.spider-canvas {
  height: 100%;
  width: 100%;
  background: transparent;
}

/*
 * The badge in flight between a card and the spider's feelers. Positioned in
 * screen space at the source centre; the Web Animations API moves it.
 */
.spider-transfer {
  position: absolute;
  z-index: 7;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  /*
   * No `translate` here: the Web Animations API below supplies the full
   * transform including the -50% centring. Having both applied the offset twice
   * and the badge appeared to start away from the source chip.
   */
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  border-radius: 999px;
  border: 1px solid rgba(255, 214, 102, 0.9);
  background: rgba(30, 18, 44, 0.97);
  padding: 2px 11px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
  color: #fff;
  pointer-events: none;
  box-shadow: 0 0 18px rgba(255, 214, 102, 0.85), 0 0 34px rgba(255, 47, 179, 0.5);
}

.spider-transfer__avatar {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  border-radius: 999px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.14);
}

.spider-transfer__avatar--initial {
  display: grid;
  place-items: center;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.spider-transfer.is-gk {
  border-color: rgba(55, 224, 160, 0.9);
  box-shadow: 0 0 18px rgba(55, 224, 160, 0.8), 0 0 30px rgba(255, 47, 179, 0.4);
}

.spider-transfer__tier {
  margin-left: 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.2);
  padding: 0 5px;
  font-size: 13px;
  font-style: normal;
  font-weight: 600;
}

.spider-agent-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  pointer-events: none;
  /* Above the nodes, below the controls. */
  z-index: 6;
  will-change: transform;
}

.spider-controls {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.spider-controls button {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(255, 110, 220, 0.32);
  background: rgba(20, 10, 30, 0.9);
  color: #ffb3e6;
  font-size: 15px;
  line-height: 1;
  transition: background 160ms ease, border-color 160ms ease;
}

.spider-controls button:hover {
  background: rgba(255, 47, 179, 0.22);
  border-color: rgba(255, 110, 220, 0.65);
}

.spider-panel {
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 14px;
  background: rgba(14, 9, 22, 0.85);
  padding: 12px;
}

/*
 * The activity panel is the only scrolling region in the column: the summary
 * stays its natural height and this one grows to fill the rest of the modal.
 */
.spider-panel--activity {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
}

.spider-activity-list {
  flex: 1 1 auto;
  min-height: 0;
}

.spider-panel__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #ff9ee0;
}

.spider-panel__count {
  border-radius: 999px;
  background: rgba(255, 47, 179, 0.18);
  padding: 1px 7px;
  font-size: 10px;
  color: #ffd0f2;
}

.spider-btn {
  border-radius: 9px;
  border: 1px solid rgba(255, 110, 220, 0.5);
  background: linear-gradient(135deg, #ff2fb3, #b13bff);
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  transition: filter 160ms ease, opacity 160ms ease;
}

.spider-btn:hover:not(:disabled) {
  filter: brightness(1.12);
}

.spider-btn:disabled {
  opacity: 0.5;
}

.spider-btn--ghost {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.18);
}

.spider-stat {
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.04);
  padding: 6px 8px;
}

.spider-stat dt {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.45);
}

.spider-stat dd {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  font-variant-numeric: tabular-nums;
}

.spider-legend {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--legend-color) 45%, transparent);
  background: color-mix(in srgb, var(--legend-color) 12%, transparent);
  padding: 2px 8px;
  font-size: 10px;
  color: #f0e6ff;
}

.spider-legend i {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--legend-color);
}

.spider-current {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  border-radius: 9px;
  border: 1px solid rgba(255, 110, 220, 0.35);
  background: rgba(255, 47, 179, 0.12);
  padding: 6px 9px;
  font-size: 11px;
  color: #ffe6f6;
}

.spider-current__kind {
  border-radius: 999px;
  background: rgba(255, 47, 179, 0.3);
  padding: 1px 7px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
}

.spider-current__kind.is-allocate {
  background: rgba(55, 224, 160, 0.24);
  color: #9df5d1;
}

.spider-current__kind.is-swap {
  background: rgba(255, 176, 32, 0.24);
  color: #ffd28a;
}

.spider-current__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spider-event {
  display: grid;
  grid-template-columns: 54px 1fr;
  gap: 8px;
  align-items: start;
  border-left: 2px solid rgba(255, 47, 179, 0.5);
  border-radius: 0 8px 8px 0;
  background: rgba(255, 255, 255, 0.03);
  padding: 4px 8px;
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.62);
}

.spider-event.is-allocate {
  border-left-color: rgba(55, 224, 160, 0.6);
}

.spider-event.is-swap {
  border-left-color: rgba(255, 176, 32, 0.65);
}

.spider-event.is-last {
  background: rgba(255, 47, 179, 0.14);
  color: rgba(255, 255, 255, 0.9);
}

.spider-event__kind {
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.07);
  padding: 0 4px;
  font-size: 8.5px;
  line-height: 1.6;
  text-align: center;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
}

.spider-event__body strong {
  display: block;
  color: #ffb3e6;
  font-size: 10.5px;
  font-weight: 600;
}

.spider-event.is-allocate .spider-event__body strong {
  color: #8ff0c8;
}

.spider-event.is-swap .spider-event__body strong {
  color: #ffd28a;
}

.spider-spinner {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 2px solid rgba(255, 110, 220, 0.25);
  border-top-color: #ff2fb3;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

:deep(.vue-flow__pane) {
  cursor: grab;
}

:deep(.vue-flow__edge-path) {
  stroke: none;
}

:deep(.vue-flow__attribution) {
  display: none;
}
</style>
