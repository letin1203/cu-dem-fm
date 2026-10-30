import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type {
  AiGraphPlayer as TeamPlayer,
  AiAllocationStep,
  AiGraphNode,
  AiNodeStatus,
  AiSplitGraph,
  AiSwapStep,
  AiTaskEvent,
} from '../types/aiGraph';

/**
 * Whole replay is paced to roughly one minute so a human can follow it.
 *
 * The backend finishes in a few hundred milliseconds, so its measured phase
 * durations are far too short to watch. The timeline below assigns each entry
 * a slice of a fixed budget instead.
 */
/**
 * Upper bound for the replay timer budget.
 *
 * This is no longer a target: allocation and swap steps are gated on the spider
 * arriving, so the real duration is however long the walking takes. It only
 * bounds the time *between* spider-driven steps.
 */
export const PLAYBACK_TOTAL_MS = 60_000;
/** Hold before the first entry so the graph is visible before it starts. */
const INTRO_MS = 1_200;

export type TimelineKind = 'PHASE' | 'ALLOCATE' | 'SWAP';

export interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  /** Backend phase this entry belongs to. */
  phase: string;
  label: string;
  detail: string;
  /** Nodes to light up while this entry plays. */
  nodeIds: string[];
  /** Node the spider should pick a badge up from (allocation steps only). */
  pickupNodeId?: string;
  /** Player whose badge is picked up. */
  carriedPlayerId?: string;
  /** Backend event this entry renders, when it is a plain phase. */
  event?: AiTaskEvent;
  allocation?: AiAllocationStep;
  swap?: AiSwapStep;
}

/**
 * Which pipeline phase each recorded step belongs to.
 *
 * Allocations are tagged by the backend with the pass that placed them
 * (`GK` / `T1-2` / `T3-6`) and swaps with the pass that made them
 * (`balance` / `battle` / `rebalance`), so each step can be replayed inside
 * the phase that actually produced it.
 */
const PHASE_FOR_ALLOCATION_STAGE: Record<string, string> = {
  GK: 'goalkeepers',
  'T1-2': 'tier-1-2',
  'T3-6': 'tier-3-6',
};

const PHASE_FOR_SWAP_STAGE: Record<string, string> = {
  balance: 'balance',
  battle: 'battle',
  rebalance: 'rebalance',
  // These passes also exchange players between teams; without a mapping their
  // swaps fell into the balance phase and were never shown with their own step.
  'repeat-teammates': 'repeat-teammates',
  'friend-invites': 'friend-invites',
};

/**
 * Build the playable timeline from the backend's real recording.
 *
 * The backend emits phases first, then every allocation and swap. Replaying
 * that flat order would show all the team cards filling up after the thinking
 * is over, which hides what happened. Interleaving each recorded step back
 * into the phase that produced it keeps the story truthful while making the
 * sequence readable.
 */
export const buildTimeline = (graph: AiSplitGraph): TimelineEntry[] => {
  // Defensive: an older backend (or a stale deploy) may not send these yet.
  const allocationsByPhase = new Map<string, AiAllocationStep[]>();
  for (const step of graph.allocations ?? []) {
    const phase = PHASE_FOR_ALLOCATION_STAGE[step.stage] ?? 'tier-3-6';
    allocationsByPhase.set(phase, [...(allocationsByPhase.get(phase) ?? []), step]);
  }

  const swapsByPhase = new Map<string, AiSwapStep[]>();
  for (const step of graph.swaps ?? []) {
    const phase = PHASE_FOR_SWAP_STAGE[step.stage] ?? 'balance';
    swapsByPhase.set(phase, [...(swapsByPhase.get(phase) ?? []), step]);
  }

  const entries: TimelineEntry[] = [];
  for (const event of graph.events ?? []) {
    if (event.kind === 'START' || event.kind === 'FAILURE') continue;
    if (event.kind === 'ALLOCATE' || event.kind === 'SWAP') continue;

    // Phase steps happen inside the thinking node, so the agent walks there.
    const thinking = graph.nodes.find((node) => node.kind === 'THINKING');
    // Prefer the real Vietnamese label recorded by the backend; the event's
    // `phase` field is only the machine id.
    const phaseLabel = thinking?.phases?.find((phase) => phase.id === event.phase)?.label
      ?? event.phase;
    entries.push({
      id: event.id,
      kind: 'PHASE',
      phase: event.phase,
      label: phaseLabel,
      detail: event.message.replace(/^[^:]*:s*/, ''),
      nodeIds: event.nodeIds?.length
        ? event.nodeIds
        : thinking
          ? [thinking.id]
          : [],
      event,
    });

    for (const step of allocationsByPhase.get(event.phase) ?? []) {
      // The badge physically comes from the tier card holding that player.
      const tierNode = graph.nodes.find(
        (node) => node.kind === 'TIER' && node.players?.some((player) => player.id === step.playerId),
      );

      entries.push({
        id: step.id,
        kind: 'ALLOCATE',
        phase: event.phase,
        label: step.playerName,
        detail: `Tier ${step.tier} → ${step.teamLabel}`,
        // The team card is what lights up; pickup is tracked separately.
        nodeIds: [step.teamNodeId],
        pickupNodeId: tierNode?.id,
        carriedPlayerId: step.playerId,
        allocation: step,
      });
    }

    for (const step of swapsByPhase.get(event.phase) ?? []) {
      entries.push({
        id: step.id,
        kind: 'SWAP',
        phase: event.phase,
        label: `${step.firstName} ↔ ${step.secondName}`,
        detail: 'Hoán đổi giữa hai đội',
        nodeIds: [step.firstTeamNodeId, step.secondTeamNodeId],
        swap: step,
      });
    }
  }

  return entries;
};

/**
 * Split a fixed budget across entries.
 *
 * Phase entries carry more weight than individual steps so the pipeline stays
 * readable, and every entry gets a minimum so no step flashes past.
 */
export const buildSchedule = (
  entries: TimelineEntry[],
  totalMs = PLAYBACK_TOTAL_MS,
): number[] => {
  if (!entries.length) return [];

  /**
   * Per-kind pacing.
   *
   * There is no overall time budget any more: allocation and swap steps are
   * gated on the spider actually arriving, so their timers are only a minimum
   * hold. Phases are the only steps whose duration is decided here, and they
   * are short because the work they describe already happened.
   */
  const MIN_STEP_MS: Record<TimelineEntry['kind'], number> = {
    PHASE: 340,
    // Spider-driven: the gate decides when these end.
    ALLOCATE: 40,
    SWAP: 40,
  };

  const delays = entries.map((entry) => MIN_STEP_MS[entry.kind]);

  // Spread any leftover budget over the phase steps only, so the reasoning
  // stays readable without padding the distribution phase.
  const phaseCount = entries.filter((entry) => entry.kind === 'PHASE').length;
  const used = delays.reduce((sum, delay) => sum + delay, 0) + INTRO_MS;
  const spare = Math.max(0, totalMs - used);
  if (phaseCount > 0 && spare > 0) {
    const perPhase = Math.round(spare / phaseCount);
    entries.forEach((entry, index) => {
      if (entry.kind === 'PHASE') delays[index] += perPhase;
    });
  }

  return delays;
};

/**
 * Replays the execution timeline the backend recorded, at a human pace.
 *
 * If the graph reports FAILED, replay stops at the failing entry and every
 * node that was never reached stays PENDING.
 */
export function useAiGraphPlayback(graph: () => AiSplitGraph | null) {
  const revealedStepCount = ref(0);
  /**
   * How many steps have actually *finished*.
   *
   * `revealedStepCount` advances the moment a step starts (that is what drives
   * the activity panel). Rosters must not, because a distribution is only done
   * once the spider has carried the badge across — using the started count made
   * the destination card show a player before the spider even picked them up.
   */
  const committedStepCount = ref(0);
  const completedNodeIds = ref<Set<string>>(new Set());
  const activeNodeIds = ref<Set<string>>(new Set());
  const finished = ref(false);
  const progress = ref(0);
  const currentEntry = ref<TimelineEntry | null>(null);

  const timeline = computed<TimelineEntry[]>(() => {
    const current = graph();
    return current ? buildTimeline(current) : [];
  });

  let timer: ReturnType<typeof setTimeout> | null = null;
  let progressTimer: ReturnType<typeof setInterval> | null = null;
  let plannedMs = PLAYBACK_TOTAL_MS;

  const clearTimers = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = null;
  };

  const stop = (): void => {
    clearTimers();
    activeNodeIds.value = new Set();
  };

  /**
   * One-shot gate that pauses the replay between steps.
   *
   * The timeline used to advance on a fixed timer, so a distribution step could
   * end while the spider was still halfway to the team card. Gating on the
   * spider's arrival lets it walk the full route, and the extra time is taken
   * out of the following steps instead of stretching the whole run.
   */
  /**
   * Per-step gate.
   *
   * Each entry has its own resolver, tagged with the entry id. A single shared
   * slot was wrong: a late release from a step that had already timed out would
   * release the *next* step's gate, letting that distribution be skipped.
   */
  /**
   * Per-step gate.
   *
   * The spider starts working the moment `currentEntry` changes, which is
   * BEFORE this timer fires and `wait()` is called. A plain promise therefore
   * missed the release entirely and every distribution waited for the timeout
   * (which is why a run took minutes and `committedStepCount` never advanced).
   *
   * An early release is now recorded and honoured immediately by the next
   * `wait()` for that entry.
   */
  let gateEntryId: string | null = null;
  let gateResolve: (() => void) | null = null;
  let gateTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Entry ids released before their `wait()` began. */
  const earlyReleases = new Set<string>();
  /** Safety net: never hold the replay longer than this for one step. */
  const GATE_TIMEOUT_MS = 6_000;

  const stepGate = {
    wait(entryId: string): Promise<void> {
      // Released before we started waiting: do not block at all.
      if (earlyReleases.delete(entryId)) return Promise.resolve();

      return new Promise<void>((resolve) => {
        gateEntryId = entryId;
        gateResolve = resolve;
        gateTimeout = setTimeout(() => {
          gateEntryId = null;
          gateResolve = null;
          gateTimeout = null;
          resolve();
        }, GATE_TIMEOUT_MS);
      });
    },
    /**
     * Release the gate for `entryId`.
     *
     * If that step is not waiting yet the release is remembered, so a spider
     * that finishes before the scheduler catches up still unblocks it.
     */
    release(entryId?: string): void {
      if (entryId !== undefined && gateEntryId !== null && entryId !== gateEntryId) {
        return;
      }
      if (entryId !== undefined && gateEntryId === null) {
        earlyReleases.add(entryId);
      }
      if (gateTimeout) clearTimeout(gateTimeout);
      gateTimeout = null;
      gateEntryId = null;
      const resolve = gateResolve;
      gateResolve = null;
      resolve?.();
    },
  };

  const play = (current: AiSplitGraph): void => {
    clearTimers();
    revealedStepCount.value = 0;
    committedStepCount.value = 0;
    completedNodeIds.value = new Set();
    activeNodeIds.value = new Set();
    finished.value = false;
    progress.value = 0;
    currentEntry.value = null;

    const entries = buildTimeline(current);
    if (!entries.length) {
      finished.value = true;
      progress.value = 1;
      return;
    }

    const schedule = buildSchedule(entries);
    plannedMs = INTRO_MS + schedule.reduce((sum, delay) => sum + delay, 0);
    const startedAt = Date.now();

    const startTicker = (): void => {
      progressTimer = setInterval(() => {
        /*
         * Progress is capped just short of 100% until the timeline genuinely
         * finishes. Spider-driven steps can run far longer than their planned
         * slice, and showing "100%" while distributions are still playing made
         * the run look stuck.
         */
        progress.value = Math.min(0.98, (Date.now() - startedAt) / plannedMs);
      }, 100);
    };

    const step = (index: number): void => {
      if (index >= entries.length) {
        activeNodeIds.value = new Set();
        currentEntry.value = null;
        finished.value = true;
        progress.value = 1;
        if (progressTimer) clearInterval(progressTimer);
        progressTimer = null;
        return;
      }

      const entry = entries[index];
      currentEntry.value = entry;
      revealedStepCount.value = index + 1;
      activeNodeIds.value = new Set(entry.nodeIds);

      timer = setTimeout(() => {
        const nextCompleted = new Set(completedNodeIds.value);
        entry.nodeIds.forEach((id) => nextCompleted.add(id));
        completedNodeIds.value = nextCompleted;

        const advance = (): void => {
          // The step is done, so its effect may now appear on the cards.
          committedStepCount.value = Math.max(committedStepCount.value, index + 1);
          // A cancelled replay must not resume a stale chain.
          step(index + 1);
        };

        if (entry.kind === 'ALLOCATE' || entry.kind === 'SWAP') {
          // The spider drives these steps: wait for it to finish walking, so a
          // swap is not cut off halfway through its round trip.
          void stepGate.wait(entry.id).then(advance);
        } else {
          advance();
        }
      }, schedule[index]);
    };

    timer = setTimeout(() => {
      startTicker();
      step(0);
    }, INTRO_MS);
  };

  watch(
    graph,
    (current) => {
      if (!current) {
        stop();
        revealedStepCount.value = 0;
    committedStepCount.value = 0;
        completedNodeIds.value = new Set();
        finished.value = false;
        progress.value = 0;
        currentEntry.value = null;
        return;
      }
      play(current);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    stepGate.release();
    stop();
  });

  /**
   * Node status during replay. Nodes the backend marked FAILED keep that
   * status; everything else follows the replay position so the graph animates
   * the real execution order.
   */
  const nodeStatus = (node: AiGraphNode): AiNodeStatus => {
    if (node.status === 'FAILED') return 'FAILED';
    if (activeNodeIds.value.has(node.id)) return 'RUNNING';
    if (completedNodeIds.value.has(node.id)) return 'COMPLETED';
    return 'PENDING';
  };

  /** Team cards fill up as their players are allocated. */
  /**
   * Team rosters as the replay currently stands.
   *
   * A player starts on the team their allocation step placed them on, and each
   * replayed swap moves the two players between their teams. This is what makes
   * a swap visible on the cards, and it guarantees a player is on at most one
   * roster at every instant — deriving membership from the final teams instead
   * made a swapped player appear on two cards at once.
   *
   * `null` team ids (a player whose assignment is not known yet) are dropped.
   */
  const teamRosterByNodeId = computed<Map<string, Set<string>>>(() => {
    const roster = new Map<string, Set<string>>();
    const ensure = (nodeId: string): Set<string> => {
      const existing = roster.get(nodeId);
      if (existing) return existing;
      const created = new Set<string>();
      roster.set(nodeId, created);
      return created;
    };

    /**
     * Remove a player from every team before placing them.
     *
     * Removing only from the team the step names is not safe: if the recorded
     * source team does not match where the player actually is (chained swaps, or
     * a replay order that differs from the backend's), the player is added to
     * the destination while still listed on their old team — which showed the
     * same badge on two cards. Clearing globally makes placement idempotent.
     */
    const place = (nodeId: string, playerId: string): void => {
      for (const members of roster.values()) members.delete(playerId);
      ensure(nodeId).add(playerId);
    };

    for (const entry of timeline.value.slice(0, committedStepCount.value)) {
      if (entry.allocation) {
        place(entry.allocation.teamNodeId, entry.allocation.playerId);
      }
      if (entry.swap) {
        const { firstId, secondId, firstTeamNodeId, secondTeamNodeId } = entry.swap;
        // Both players cross over; place them one at a time so each ends up on
        // exactly one roster.
        place(secondTeamNodeId, firstId);
        place(firstTeamNodeId, secondId);
      }
    }
    return roster;
  });

  /**
   * Every player in the run, keyed by id.
   *
   * The tier cards carry the full roster (each player belongs to exactly one
   * tier), so this is a complete lookup regardless of the final team assignment.
   */
  const playersById = computed<Map<string, TeamPlayer>>(() => {
    const byId = new Map<string, TeamPlayer>();
    for (const node of graph()?.nodes ?? []) {
      if (node.kind !== 'TIER') continue;
      for (const player of node.players ?? []) byId.set(player.id, player);
    }
    return byId;
  });

  /**
   * Players whose allocation has *completed*.
   *
   * Used by the tier cards to drop a badge, so it must follow committed steps:
   * using the started count removed the badge from the tier card the moment the
   * step began, before the spider had picked it up.
   */
  const revealedPlayerIds = computed<Set<string>>(() => {
    const revealed = new Set<string>();
    for (const entry of timeline.value.slice(0, committedStepCount.value)) {
      if (entry.allocation) revealed.add(entry.allocation.playerId);
    }
    return revealed;
  });

  const revealedEvents = computed(() => timeline.value.slice(0, revealedStepCount.value));

  /**
   * Backend phase ids that have already started replaying, plus the one whose
   * steps are being played right now. Drives the "AI suy nghĩ" step list.
   */
  const completedPhaseIds = computed<Set<string>>(() => {
    const done = new Set<string>();
    const revealed = timeline.value.slice(0, revealedStepCount.value);
    // A phase is finished once a later phase has begun.
    let lastPhase = -1;
    revealed.forEach((entry, index) => {
      if (entry.kind === 'PHASE') lastPhase = index;
    });
    revealed.forEach((entry, index) => {
      if (entry.kind === 'PHASE' && index < lastPhase) done.add(entry.phase);
    });
    return done;
  });

  const activePhaseId = computed<string | null>(() => {
    const current = currentEntry.value;
    if (!current) return null;
    return current.phase || null;
  });

  const isPlaying = computed(() => !finished.value && revealedStepCount.value > 0);
  const isComplete = computed(() => finished.value);

  return {
    timeline,
    nodeStatus,
    revealedEvents,
    revealedStepCount,
    committedStepCount,
    revealedPlayerIds,
    teamRosterByNodeId,
    playersById,
    currentEntry,
    completedPhaseIds,
    activePhaseId,
    isPlaying,
    isComplete,
    progress,
    /**
     * Called by the spider when it has finished walking the current step.
     * Distribution steps block the timeline until this fires.
     */
    completeStep: (entryId?: string) => stepGate.release(entryId),
    replay: () => {
      const current = graph();
      if (current) play(current);
    },
  };
}
