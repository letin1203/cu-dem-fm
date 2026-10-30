<template>
  <div
    class="spider-node"
    :class="[
      `spider-node--${data.kind.toLowerCase()}`,
      `is-${data.status.toLowerCase()}`,
      {
        'is-selected': selected,
        'is-active': data.status === 'RUNNING',
        'is-agent-focus': agentFocused,
      },
    ]"
    :style="{ '--node-accent': accent }"
  >
    <!-- Target handle on the TOP edge: flow comes down into this card. -->
    <Handle
      v-if="data.kind !== 'THINKING'"
      type="target"
      :position="Position.Top"
      class="spider-handle spider-handle--top"
    />

    <header class="spider-node__head">
      <span class="spider-node__badge">{{ kindGlyph }}</span>
      <div class="min-w-0 flex-1">
        <p class="spider-node__label">{{ data.label }}</p>
        <p class="spider-node__sub">{{ headerSublabel }}</p>
      </div>
      <!-- Team totals live in the header so the body is only badges. -->
      <dl v-if="data.kind === 'TEAM'" class="spider-node__head-stats">
        <div>
          <dt>Tổng Tier</dt>
          <dd>{{ teamTotalTier }}</dd>
        </div>
        <div>
          <dt>Tier TB</dt>
          <dd>{{ teamAverageTier }}</dd>
        </div>
      </dl>
      <span class="spider-node__dot" :class="`is-${data.status.toLowerCase()}`" />
    </header>

    <!-- Tier cards list their players as chips. -->
    <div v-if="data.kind === 'TIER'" class="spider-node__chips">
      <span
        v-for="player in tierVisiblePlayers"
        :key="player.id"
        class="spider-chip"
        :data-player-id="player.id"
        :class="{
          'is-new': revealedPlayerIds.has(player.id),
          'is-gk': isGoalkeeper(player.position),
          'is-strong': player.tier <= 2,
          'is-processing': isProcessing(player.id),
        }"
      >
        <img
          v-if="player.avatar"
          :src="player.avatar"
          class="spider-chip__avatar"
          alt=""
          loading="lazy"
        />
        <span v-else class="spider-chip__avatar spider-chip__avatar--initial">
          {{ player.name.charAt(0) }}
        </span>
        {{ player.name }}<em v-if="tierLabel(player)" class="spider-chip__tier">{{ tierLabel(player) }}</em>
      </span>
    </div>

    <!-- Team cards: explicit totals, then one badge per player. -->
    <div v-else-if="data.kind === 'TEAM'" class="spider-node__team-body">
      <div class="spider-node__chips">
        <span
          v-for="player in teamPlayers"
          :key="player.id"
          class="spider-chip is-new"
          :data-player-id="player.id"
          :class="{
            'is-gk': isGoalkeeper(player.position),
            'is-strong': player.tier <= 2,
            'is-landing': isJustDelivered(player.id),
          }"
        >
          <img
            v-if="player.avatar"
            :src="player.avatar"
            class="spider-chip__avatar"
            alt=""
            loading="lazy"
          />
          <span v-else class="spider-chip__avatar spider-chip__avatar--initial">
            {{ player.name.charAt(0) }}
          </span>
          {{ player.name }}<em v-if="tierLabel(player)" class="spider-chip__tier">{{ tierLabel(player) }}</em>
        </span>
      </div>
    </div>

    <!-- Core keeps its connection summary. -->
    <p v-if="data.kind === 'CORE'" class="spider-node__core-hint">
      Kết nối {{ data.metrics.players }} cầu thủ · {{ data.metrics.teams }} đội
    </p>

    <!--
      The thinking card shows the real pipeline steps, not counters: each phase
      is listed with its measured duration, and the one currently running is
      highlighted. Data comes from the backend graph's `phases`.
    -->
    <ol v-else-if="data.kind === 'THINKING'" ref="phaseListRef" class="spider-node__phases">
      <li
        v-for="phase in visiblePhases"
        :key="phase.id"
        class="spider-node__phase"
        :class="{
          'is-done': completedPhaseIds.has(phase.id),
          'is-live': activePhaseId === phase.id,
        }"
      >
        <span class="spider-node__phase-dot" />
        <span class="spider-node__phase-text">
          <strong>{{ phase.label }}</strong>
          <span>{{ phase.detail }}</span>
        </span>
        <span class="spider-node__phase-ms">{{ phase.durationMs }}ms</span>
      </li>
    </ol>

    <!-- Source handle on the BOTTOM edge: flow leaves this card downwards. -->
    <Handle
      v-if="data.kind !== 'TEAM'"
      type="source"
      :position="Position.Bottom"
      class="spider-handle spider-handle--bottom"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import type { AiGraphNode, AiGraphPlayer } from '../../types/aiGraph';
import { statusColor } from '../../utils/aiGraphLayout';

const props = defineProps<{
  data: AiGraphNode;
  selected?: boolean;
  /** Player ids that have already been placed during the replay. */
  revealedPlayerIds?: Set<string>;
  /** Player ids currently on THIS team according to the replay position. */
  rosterPlayerIds?: Set<string>;
  /** Player the spider is about to pick up (highlighted on its tier card). */
  processingPlayerId?: string | null;
  /** Player just delivered (plays the shrink-back animation on the team card). */
  deliveredPlayerId?: string | null;
  /** Players whose badge is mid-flight between the spider and a team card. */
  releasingPlayerIds?: Set<string>;
  /**
   * Full player lookup for the run.
   *
   * Team rosters are resolved from this rather than from `data.players`: a
   * swapped player is temporarily on a team their FINAL roster does not list,
   * and filtering the final roster silently dropped them.
   */
  playersById?: Map<string, AiGraphPlayer>;
  /** True while the spider agent is working on this card. */
  agentFocused?: boolean;
  /** Backend phase ids that have already finished replaying. */
  completedPhaseIds?: Set<string>;
  /** Backend phase id currently replaying, if any. */
  activePhaseId?: string | null;
  /** Player id the spider is currently carrying, if any. */
  carriedPlayerId?: string | null;
}>();

const accent = computed(() => statusColor[props.data.status]);

const revealedPlayerIds = computed(() => props.revealedPlayerIds ?? new Set<string>());

const isGoalkeeper = (position: string): boolean =>
  position === 'GK' || position === 'Goalkeeper';

const kindGlyph = computed(() => {
  switch (props.data.kind) {
    case 'CORE':
      return '🕷';
    case 'TIER':
      return '◈';
    case 'THINKING':
      return '✦';
    default:
      return '⚑';
  }
});

const completedPhaseIds = computed(() => props.completedPhaseIds ?? new Set<string>());
const activePhaseId = computed(() => props.activePhaseId ?? null);
const carriedPlayerId = computed(() => props.carriedPlayerId ?? null);

/**
 * A player leaves its tier card for good once it has been allocated, and the
 * badge disappears immediately while the spider is carrying it. Both cards
 * therefore show exactly one copy of every player at any moment.
 */
/**
 * The tier header reports how many players are still on that card, so it must
 * shrink as players are allocated away instead of showing the original count.
 */
const headerSublabel = computed(() => {
  if (props.data.kind === 'TEAM') {
    const count = teamPlayers.value.length;
    return count === 1 ? '1 cầu thủ' : `${count} cầu thủ`;
  }
  if (props.data.kind === 'TIER') {
    const remaining = tierVisiblePlayers.value.length;
    return remaining === 1 ? '1 cầu thủ' : `${remaining} cầu thủ`;
  }
  return props.data.sublabel;
});

const tierVisiblePlayers = computed(() =>
  (props.data.players ?? []).filter(
    (player) =>
      !revealedPlayerIds.value.has(player.id)
      && player.id !== carriedPlayerId.value
      && !isReleasing(player.id),
  ),
);

/**
 * A player being processed is enlarged and glows on its tier card, so it is
 * obvious which badge the spider is about to take. It stays highlighted from
 * the moment the step starts until the badge is actually picked up.
 */
const isProcessing = (playerId: string): boolean => props.processingPlayerId === playerId;

const isJustDelivered = (playerId: string): boolean =>
  props.deliveredPlayerId === playerId;

/**
 * True while this player's badge is in the air.
 *
 * Hidden on both cards so exactly one copy exists during a hand-off; otherwise
 * the tier card briefly re-rendered the badge after the carry was cleared but
 * before the roster committed.
 */
const isReleasing = (playerId: string): boolean =>
  props.releasingPlayerIds?.has(playerId) ?? false;

/**
 * Badge suffix: the player's position for keepers, otherwise their tier.
 *
 * Always rendered — suppressing it for keepers whose *name* happens to end in
 * "GK" left an empty pill and hid the position, which read as a bug.
 */
const tierLabel = (player: { tier: number; position: string }): string =>
  isGoalkeeper(player.position) ? 'GK' : `T${player.tier}`;

/**
 * The thinking card shows at most four steps at a time.
 *
 * The window follows the active phase instead of always showing the top of the
 * list, so the step being replayed is always visible and older ones scroll up
 * out of view as the run progresses.
 */
const MAX_VISIBLE_PHASES = 4;
const phaseListRef = ref<HTMLElement | null>(null);

const visiblePhases = computed(() => {
  const phases = props.data.phases ?? [];
  if (phases.length <= MAX_VISIBLE_PHASES) return phases;

  const activeIndex = activePhaseId.value
    ? phases.findIndex((phase) => phase.id === activePhaseId.value)
    : -1;

  /*
   * When the run finishes there is no active phase, so the window must show the
   * LAST steps. Showing the first four (the old fallback) made a completed run
   * look like it had barely started.
   */
  if (activeIndex < 0) {
    const completedCount = props.completedPhaseIds?.size ?? 0;
    const start = completedCount >= phases.length
      ? phases.length - MAX_VISIBLE_PHASES
      : Math.max(0, completedCount - 1);
    return phases.slice(start, start + MAX_VISIBLE_PHASES);
  }

  // Keep the active step at the bottom of the window once it passes it.
  const start = Math.max(0, Math.min(activeIndex - MAX_VISIBLE_PHASES + 1, phases.length - MAX_VISIBLE_PHASES));
  return phases.slice(start, start + MAX_VISIBLE_PHASES);
});

// Scroll the active row into view whenever the window shifts.
watch(
  () => activePhaseId.value,
  async () => {
    await nextTick();
    const list = phaseListRef.value;
    const active = list?.querySelector('.spider-node__phase.is-live') as HTMLElement | null;
    active?.scrollIntoView({ block: 'nearest' });
  },
);

/**
 * Team cards start empty and fill up as the replay allocates players, so the
 * roster on screen always matches the progress of the run.
 */
/**
 * A team shows a player once the timeline has allocated them AND the spider is
 * not currently carrying them. Combined with the tier filter, every player is
 * visible on exactly one card, except while it is in the spider's grasp.
 */
const teamPlayers = computed(() => {
  const roster = props.rosterPlayerIds;
  if (!roster) {
    return (props.data.players ?? []).filter(
      (player) =>
        revealedPlayerIds.value.has(player.id) && player.id !== carriedPlayerId.value,
    );
  }

  // Resolve each id through the full lookup. Using `data.players` (the final
  // roster) dropped any player who is currently on this team because of a swap
  // but ends up elsewhere, which is exactly the "missing player" symptom.
  const lookup = props.playersById;
  const players: AiGraphPlayer[] = [];
  for (const id of roster) {
    if (id === carriedPlayerId.value) continue;
    if (isReleasing(id)) continue;
    const player = lookup?.get(id) ?? props.data.players?.find((item) => item.id === id);
    if (player) players.push(player);
  }
  /*
   * Order: goalkeepers first, then by tier, then by name.
   *
   * Keepers are listed at the top of a team card because they are the least
   * interchangeable position, so a reader checks them first.
   */
  players.sort((first, second) => {
    const goalkeeperDifference =
      Number(isGoalkeeper(second.position)) - Number(isGoalkeeper(first.position));
    if (goalkeeperDifference) return goalkeeperDifference;
    const tierDifference = first.tier - second.tier;
    if (tierDifference) return tierDifference;
    return first.name.localeCompare(second.name, 'vi');
  });
  return players;
});

/**
 * Tier totals follow the badges actually rendered, not the backend's final
 * numbers, so the header ticks up as players arrive.
 */
const teamTotalTier = computed(() =>
  teamPlayers.value.reduce((total, player) => total + player.tier, 0),
);

const teamAverageTier = computed(() => {
  if (!teamPlayers.value.length) return '—';
  const average = teamTotalTier.value / teamPlayers.value.length;
  return average.toFixed(2);
});

</script>

<style scoped>
.spider-node {
  width: 400px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--node-accent) 45%, transparent);
  background: linear-gradient(150deg, rgba(22, 14, 34, 0.96), rgba(12, 8, 20, 0.98));
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.6),
    0 0 22px color-mix(in srgb, var(--node-accent) 30%, transparent),
    inset 0 0 28px color-mix(in srgb, var(--node-accent) 12%, transparent);
  color: #efe7ff;
  padding: 12px;
  transition:
    box-shadow 220ms ease,
    transform 220ms ease,
    border-color 220ms ease,
    width 220ms ease;
  backdrop-filter: blur(10px);
}

/*
 * Tier cards are 1.2x wider than team cards: they hold the full roster before
 * distribution, so their badges need more horizontal room.
 */
.spider-node--tier {
  width: 480px;
}

.spider-node--team {
  width: 400px;
}

/*
 * Team cards match the thinking card's rendered height (its four-row phase list
 * plus header comes to ~159px at 1x) so the right column reads as one set.
 */
.spider-node--team {
  min-height: 159px;
}

.spider-node:hover {
  transform: translateY(-2px);
}

.spider-node.is-selected {
  border-color: var(--node-accent);
  box-shadow:
    0 0 0 1px var(--node-accent),
    0 0 34px color-mix(in srgb, var(--node-accent) 55%, transparent),
    inset 0 0 34px color-mix(in srgb, var(--node-accent) 20%, transparent);
}

.spider-node.is-active {
  transform: translateY(-3px) scale(1.015);
}

/* The card the spider agent is currently working on. */
.spider-node.is-agent-focus {
  border-color: color-mix(in srgb, var(--node-accent) 85%, white);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--node-accent) 70%, transparent),
    0 0 30px color-mix(in srgb, var(--node-accent) 60%, transparent),
    inset 0 0 26px color-mix(in srgb, var(--node-accent) 22%, transparent);
}

.spider-node--core {
  width: 268px;
  border-radius: 999px;
  background:
    radial-gradient(circle at 50% 0%, rgba(255, 47, 179, 0.32), transparent 62%),
    linear-gradient(160deg, #25103a, #0d0714);
  animation: corePulse 3.4s ease-in-out infinite;
}

.spider-node__head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.spider-node__badge {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--node-accent) 22%, transparent);
  color: var(--node-accent);
  font-size: 15px;
}

.spider-node__label {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #fff;
  margin: 0;
}

.spider-node__sub {
  margin: 0;
  font-size: 11px;
  /* Lifted from #a99cc4 for legibility against the card background. */
  color: #cfc4e6;
}

.spider-node__dot {
  margin-left: auto;
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border-radius: 999px;
  background: var(--node-accent);
  box-shadow: 0 0 10px var(--node-accent);
}

.spider-node__dot.is-running {
  animation: dotBlink 1.1s ease-in-out infinite;
}

.spider-node__dot.is-pending {
  box-shadow: none;
  opacity: 0.7;
}

/* Tier chips */
.spider-node__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.spider-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  /* All badges are 1.5x their original size. */
  padding: 2px 11px 2px 3px;
  font-size: 15px;
  line-height: 1.5;
  color: #cfc2e6;
  transition: background 200ms ease, border-color 200ms ease, color 200ms ease;
}

.spider-chip.is-gk {
  border-color: rgba(55, 224, 160, 0.45);
  color: #8ff0c8;
}

/* Player avatar inside a badge. Sized to the badge's text height. */
.spider-chip__avatar {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  border-radius: 999px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.12);
}

/* Fallback when the player has no avatar: their initial. */
.spider-chip__avatar--initial {
  display: grid;
  place-items: center;
  font-size: 10px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.75);
  text-transform: uppercase;
}

.spider-chip.is-gk .spider-chip__avatar {
  box-shadow: 0 0 0 1px rgba(55, 224, 160, 0.5);
}

.spider-chip.is-strong .spider-chip__avatar {
  box-shadow: 0 0 0 1px rgba(255, 214, 102, 0.55);
}

.spider-chip.is-new {
  border-color: rgba(255, 110, 220, 0.7);
  background: rgba(255, 47, 179, 0.22);
  color: #fff;
}

/* Tier 1-2 players are the strongest picks, so their badge is emphasised. */
/*
 * Badge the spider is about to collect: enlarged and glowing so it is obvious
 * which player is being processed.
 */
.spider-chip.is-processing {
  scale: 1.2;
  border-color: rgba(255, 214, 102, 0.95);
  background: rgba(255, 180, 40, 0.3);
  color: #fff8e1;
  box-shadow: 0 0 14px rgba(255, 200, 60, 0.85), 0 0 26px rgba(255, 47, 179, 0.5);
  animation: chipProcessing 1.1s ease-in-out infinite;
  transition: scale 160ms ease, box-shadow 160ms ease;
  z-index: 2;
}

@keyframes chipProcessing {
  0%,
  100% {
    box-shadow: 0 0 12px rgba(255, 200, 60, 0.7), 0 0 22px rgba(255, 47, 179, 0.4);
  }
  50% {
    box-shadow: 0 0 22px rgba(255, 214, 102, 1), 0 0 38px rgba(255, 47, 179, 0.7);
  }
}

/*
 * Badge just delivered: it lands at 1.2x and settles back to 1.0, losing the
 * glow, so the hand-off is visible on the team card.
 */
.spider-chip.is-landing {
  animation: chipLanding 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes chipLanding {
  0% {
    scale: 1.2;
    box-shadow: 0 0 18px rgba(255, 214, 102, 0.9), 0 0 30px rgba(255, 47, 179, 0.6);
  }
  100% {
    scale: 1;
    box-shadow: 0 0 0 rgba(255, 214, 102, 0);
  }
}

.spider-chip.is-strong {
  font-weight: 700;
  border-color: rgba(255, 214, 102, 0.55);
  color: #ffe9a8;
}

.spider-chip.is-strong.is-new {
  border-color: rgba(255, 214, 102, 0.8);
  color: #fff3cc;
}

/* The badge the spider is carrying right now. */
.spider-chip.is-carried {
  outline: 1px solid #ffd666;
  box-shadow: 0 0 12px rgba(255, 214, 102, 0.65);
}

.spider-chip__tier {
  margin-left: 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.14);
  padding: 0 5px;
  font-size: 13px;
  font-style: normal;
  font-weight: 600;
  letter-spacing: 0.02em;
  vertical-align: 1px;
}

.spider-chip.is-gk .spider-chip__tier {
  background: rgba(55, 224, 160, 0.28);
  color: #b9ffdf;
}

/* Team card: totals then badges */
.spider-node__team-body {
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

/*
 * Team badges are laid out in exactly two columns so the rows line up and a
 * 21-player roster is easy to scan, instead of a ragged flex wrap.
 */
.spider-node--team .spider-node__chips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
  align-items: start;
}

.spider-node--team .spider-chip {
  min-width: 0;
  overflow: hidden;
  /*
   * Full-width rows so the position/tier pill can sit flush against the right
   * edge: the two columns then line up vertically instead of the pill floating
   * directly after each name.
   */
  display: flex;
  width: 100%;
}

.spider-node--team .spider-chip__tier {
  margin-left: auto;
  flex: 0 0 auto;
}

/* Team totals sit in the card header, right-aligned. */
.spider-node__head-stats {
  display: flex;
  gap: 10px;
  flex: 0 0 auto;
  margin: 0;
  padding-left: 8px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.spider-node__head-stats dt {
  font-size: 8px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  /* Was 38% white, which was hard to read on the dark card. */
  color: rgba(255, 255, 255, 0.72);
}

.spider-node__head-stats dd {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

/* The team body owns the separation now. */
.spider-node--team .spider-node__chips {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

/* Thinking list is a fixed window of four; rows are clipped, not scrolled by
   the user, so the step that moves is always the active one. */
.spider-node__phases {
  max-height: 236px;
  overflow: hidden;
}

/* Thinking: real pipeline steps */
.spider-node--thinking {
  width: 340px;
}

.spider-node__phases {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 9px 0 0;
  padding: 8px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  list-style: none;
}

.spider-node__phase {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  border-radius: 6px;
  padding: 2px 4px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.42);
  transition: background 180ms ease, color 180ms ease;
}

.spider-node__phase.is-done {
  color: rgba(255, 255, 255, 0.72);
}

.spider-node__phase.is-live {
  background: rgba(255, 47, 179, 0.18);
  color: #fff;
}

.spider-node__phase-dot {
  margin-top: 4px;
  width: 5px;
  height: 5px;
  flex: 0 0 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
}

.spider-node__phase.is-done .spider-node__phase-dot {
  background: #37e0a0;
}

.spider-node__phase.is-live .spider-node__phase-dot {
  background: #ff2fb3;
  box-shadow: 0 0 8px #ff2fb3;
  animation: dotBlink 1s ease-in-out infinite;
}

.spider-node__phase-text {
  flex: 1;
  min-width: 0;
}

.spider-node__phase-text strong {
  display: block;
  font-size: 10px;
  font-weight: 600;
  color: inherit;
}

.spider-node__phase-text span {
  display: block;
  font-size: 9px;
  color: rgba(255, 255, 255, 0.32);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spider-node__phase-ms {
  flex: 0 0 auto;
  font-size: 9px;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.3);
}

.spider-node__core-hint {
  margin: 8px 0 0;
  font-size: 10.5px;
  text-align: center;
  color: #ffa8e0;
}

.spider-handle {
  width: 9px !important;
  height: 9px !important;
  border: none !important;
  background: var(--node-accent) !important;
  box-shadow: 0 0 10px var(--node-accent);
}

@keyframes corePulse {
  0%,
  100% {
    box-shadow:
      0 0 0 1px rgba(255, 47, 179, 0.4),
      0 0 26px rgba(255, 47, 179, 0.35),
      inset 0 0 30px rgba(255, 47, 179, 0.18);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(255, 47, 179, 0.65),
      0 0 48px rgba(255, 47, 179, 0.55),
      inset 0 0 42px rgba(255, 47, 179, 0.3);
  }
}

@keyframes dotBlink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spider-node--core,
  .spider-node__dot.is-running {
    animation: none;
  }
}
</style>
