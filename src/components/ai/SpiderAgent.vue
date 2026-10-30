<template>
  <div
    ref="rootRef"
    class="spider-agent"
    :class="[`is-${state}`, { 'is-reduced-motion': reducedMotion }]"
    aria-hidden="true"
  >
    <svg
      class="spider-agent__body"
      viewBox="-95 -75 190 165"
      width="190"
      height="165"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient :id="glowId" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stop-color="#ffb3ec" />
          <stop offset="55%" stop-color="#ff2fb3" />
          <stop offset="100%" stop-color="#7a1f6a" />
        </radialGradient>
        <linearGradient :id="legGradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ff8ede" />
          <stop offset="100%" stop-color="#8f2f86" />
        </linearGradient>
      </defs>

      <!--
        Eight anchored legs. Each foot grips a fixed point in world space and
        the leg stretches to reach it, so the spider reads as walking on a web
        instead of swinging rigid limbs. The knee is solved per frame from the
        body joint and the planted foot.
      -->
      <g
        class="spider-agent__legs"
        :stroke="`url(#${legGradientId})`"
        stroke-width="3.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <g
          v-for="(leg, index) in legGeometry"
          :key="index"
          class="spider-agent__leg"
          :class="{ 'is-lifting': leg.lifting }"
        >
          <!-- Femur: body joint to knee. -->
          <path :d="`M ${leg.jointX} ${leg.jointY} L ${leg.kneeX} ${leg.kneeY}`" class="spider-agent__leg-inner" />
          <!-- Tibia: knee to the planted foot. -->
          <path :d="`M ${leg.kneeX} ${leg.kneeY} L ${leg.footX} ${leg.footY}`" class="spider-agent__leg-inner" />
          <!-- Foot grip, with a ripple that fires each time it plants. -->
          <circle :cx="leg.footX" :cy="leg.footY" r="3.2" class="spider-agent__foot" />
          <circle
            v-if="leg.landedAt"
            :key="`${index}-${leg.landedAt}`"
            :cx="leg.footX"
            :cy="leg.footY"
            r="4"
            class="spider-agent__foot-ripple"
          />
        </g>
      </g>

      <!--
        The body turns to face travel while the legs stay planted, so the
        rotation is applied to this group only. The fangs point "up" in local
        space, matching the leg layout.
      -->
      <g class="spider-agent__body-core">
        <!-- Cephalothorax + abdomen, lifted so the feet read as contact points. -->
        <ellipse cx="0" cy="0" rx="20" ry="24" :fill="`url(#${glowId})`" class="spider-agent__abdomen" />
        <circle cx="0" cy="-28" r="15" :fill="`url(#${glowId})`" class="spider-agent__head" />

        <!-- Eyes -->
        <g class="spider-agent__eyes">
          <circle cx="-6.2" cy="-30.8" r="3.4" fill="#fff6fb" />
          <circle cx="6.2" cy="-30.8" r="3.4" fill="#fff6fb" />
          <circle cx="0" cy="-23.2" r="2.4" fill="#ffd6f3" opacity="0.85" />
        </g>

        <!-- fangs -->
        <path d="M-5.2 -17.2 L-4.4 -11.2" stroke="#ffe0f6" stroke-width="2.2" stroke-linecap="round" />
        <path d="M5.2 -17.2 L4.4 -11.2" stroke="#ffe0f6" stroke-width="2.2" stroke-linecap="round" />

        <!--
          Two antennae. Each is two thirds of the head's diameter (30 units), so
          they reach ~20 units above the head and frame the badge the spider
          carries.
        -->
        <g class="spider-agent__antennae" stroke="#ff8ede" stroke-width="2" stroke-linecap="round" fill="none">
          <path class="spider-agent__antenna is-left" d="M -5 -41 C -9 -48, -11 -54, -9 -61" />
          <path class="spider-agent__antenna is-right" d="M 5 -41 C 9 -48, 11 -54, 9 -61" />
        </g>
        <circle class="spider-agent__antenna-tip" cx="-9" cy="-61" r="2" fill="#ffd6f3" />
        <circle class="spider-agent__antenna-tip" cx="9" cy="-61" r="2" fill="#ffd6f3" />

        <!--
          The carried badge lives inside the rotated body group, anchored between
          the antenna tips. Putting it here (rather than as a sibling of the SVG)
          is what makes it actually ride the antennae instead of merely floating
          above the sprite while the head turns.
        -->
        <foreignObject
          v-if="carriedLabel && carriedVisible !== false"
          class="spider-agent__carry-holder"
          x="-70"
          y="-84"
          width="140"
          height="26"
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            :data-carried-player-id="carriedPlayerId ?? undefined"
            class="spider-agent__carry"
            :class="{ 'is-gk': carriedIsGoalkeeper, 'is-strong': (carriedTier ?? 99) <= 2 }"
          >
            <img
              v-if="carriedAvatar"
              :src="carriedAvatar"
              class="spider-agent__carry-avatar"
              alt=""
            />
            <span v-else class="spider-agent__carry-avatar spider-agent__carry-avatar--initial">
              {{ carriedLabel?.charAt(0) }}
            </span>
            {{ carriedLabel }}<em v-if="carriedTierLabel" class="spider-agent__carry-tier">{{ carriedTierLabel }}</em>
          </div>
        </foreignObject>
      </g>
    </svg>

    <span v-if="state === 'completed' || state === 'failed'" class="spider-agent__burst" :class="`is-${state}`" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { SpiderAgentState } from '../../composables/useSpiderAgent';

const props = defineProps<{
  state: SpiderAgentState;
  /** The DOM element the composable drives. */
  bind: (element: HTMLElement | null) => void;
  reducedMotion?: boolean;
  /** Id of the player badge being carried, if any. */
  carriedPlayerId?: string | null;
  /**
   * Whether to draw the carried badge.
   *
   * False while the badge is animating away, so it is not rendered twice (once
   * in the antennae and once in the flying overlay).
   */
  carriedVisible?: boolean;
  /** Name of the player badge being carried, if any. */
  carriedLabel?: string | null;
  carriedIsGoalkeeper?: boolean;
  /** Tier of the carried player, so the badge matches the card badges. */
  carriedTier?: number | null;
  /** Avatar URL of the carried player. */
  carriedAvatar?: string | null;
  /** Planted foot anchors, in body-relative coordinates. */
  feet?: Array<{ x: number; y: number; lift: number; side?: 'right' | 'left'; landedAt?: number }>;
}>();

const glowId = `spiderGlow-${Math.random().toString(36).slice(2, 8)}`;

/** Badge suffix, matching the cards: GK for keepers, T1..T6 otherwise. */
const carriedTierLabel = computed(() => {
  if (!props.carriedLabel) return '';
  if (props.carriedIsGoalkeeper) {
    // A keeper's name often already ends in "GK"; do not print it twice.
    return /\bGK\b\s*$/i.test(props.carriedLabel.trim()) ? '' : 'GK';
  }
  return props.carriedTier ? `T${props.carriedTier}` : '';
});
const legGradientId = `spiderLeg-${Math.random().toString(36).slice(2, 8)}`;

const rootRef = ref<HTMLElement | null>(null);

onMounted(() => props.bind(rootRef.value));
onBeforeUnmount(() => props.bind(null));

/**
 * Leg geometry: the spider is drawn facing up, legs sweeping out and down.
 * The animation alternates front/back pairs so the crawl reads as walking
 * rather than a single twitch.
 */
/**
 * Leg geometry solved every frame.
 *
 * The body joint is fixed on the cephalothorax; the foot is the planted world
 * anchor (or the swinging target). The knee is placed on the perpendicular of
 * the joint→foot line so the leg always bends outward, like a real spider.
 */
/**
 * Leg geometry solved every frame.
 *
 * The joint sits on the body edge for that leg's side, and the foot is the
 * planted anchor. Because every leg has its own reach and its own planted
 * point, the eight legs end up different lengths and move independently.
 *
 * The knee is placed on the perpendicular of the joint→foot line, biased
 * outward, so each leg always folds away from the body like a real spider.
 */
const legGeometry = computed(() => {
  const anchors = props.feet ?? [];
  return anchors.map((anchor) => {
    // Side comes from the composable, not from the array index: deriving it
    // from `index % 2` silently mirrored the whole rig.
    const isLeft = anchor.side === 'left';
    /*
     * Joints sit on the body edge, front legs high and back legs low.
     *
     * The abdomen is 20x24, so the joints are pushed out to ~19 units to sit on
     * its silhouette rather than inside it.
     */
    const jointX = isLeft ? -19 : 19;
    const jointY = anchor.y < -50 ? -12 : anchor.y < 0 ? -2 : anchor.y < 50 ? 8 : 18;

    /*
     * A swinging foot lifts by moving *radially outward*, not straight up.
     *
     * A plain vertical offset shortened the radius of low-lying feet and pulled
     * them back inside the minimum distance from the body, which is what made
     * legs look collapsed during a step.
     */
    const anchorRadius = Math.hypot(anchor.x, anchor.y) || 1;
    const liftAmount = anchor.lift ? 12 : 0;
    const footX = anchor.x + (anchor.x / anchorRadius) * liftAmount;
    const footY = anchor.y + (anchor.y / anchorRadius) * liftAmount;

    const dx = footX - jointX;
    const dy = footY - jointY;
    const length = Math.hypot(dx, dy) || 1;

    /*
     * Femur (joint -> knee) must be half the tibia (knee -> foot), so the knee
     * sits one third of the way along the leg.
     */
    const FEMUR_RATIO = 1 / 3;
    const baseX = jointX + dx * FEMUR_RATIO;
    const baseY = jointY + dy * FEMUR_RATIO;

    // Bend outward from the body so the joint reads as a knee, not a kink.
    const bend = Math.min(40, length * 0.32);
    const normalX = -dy / length;
    const normalY = dx / length;
    // Always fold away from the body centre.
    const outward = normalX * baseX + normalY * baseY >= 0 ? 1 : -1;
    const kneeX = baseX + normalX * bend * outward;
    const kneeY = baseY + normalY * bend * outward;

    return {
      jointX,
      jointY,
      kneeX,
      kneeY,
      footX,
      footY,
      lifting: anchor.lift === 1,
      landedAt: anchor.landedAt ?? 0,
    };
  });
});

</script>

<style scoped>
.spider-agent {
  position: absolute;
  top: 0;
  left: 0;
  width: 190px;
  height: 165px;
  /*
   * The sprite's origin (the body) sits at viewBox y = 0, which is 75 units from
   * the top of the 165-unit viewBox. Offsetting by that keeps the body on the
   * anchor point.
   */
  margin: -75px 0 0 -95px;
  pointer-events: none;
  will-change: transform;
  z-index: 5;
  filter: drop-shadow(0 0 8px rgba(255, 47, 179, 0.55));
}

.spider-agent__body {
  display: block;
  overflow: visible;
}

/*
 * The body faces the direction of travel; the legs do not, because their feet
 * are gripping fixed points. The rotation comes from the composable, which
 * publishes it as a custom property on the sprite element.
 */
.spider-agent__body-core {
  transform: rotate(var(--spider-body-rotation, 0deg));
  transform-origin: 0px 8px;
  transition: transform 90ms linear;
}

.spider-agent__abdomen,
.spider-agent__head {
  filter: drop-shadow(0 0 4px rgba(255, 47, 179, 0.8));
}

.spider-agent__eyes {
  filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.9));
}

/*
 * The carried badge is deliberately identical to the player badges on the
 * cards (same pill shape, padding and colours) so it reads as the same object
 * travelling from the tier card to the team card.
 */
.spider-agent__carry-holder {
  overflow: visible;
  pointer-events: none;
}

/*
 * The carried badge, drawn inside the rotated head group so it rides the
 * antennae. It is centred in its foreignObject and styled exactly like the
 * player badges on the cards.
 */
/*
 * The badge rides the antennae, so it rotates with the head. The text is
 * counter-rotated back so it stays readable while the attachment point still
 * tracks the tips.
 */
.spider-agent__carry {
  transform: rotate(var(--spider-counter-rotation, 0deg));
  transform-origin: center center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: max-content;
  margin: 0 auto;
  white-space: nowrap;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(30, 18, 44, 0.97);
  padding: 1px 8px;
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.5;
  color: #fff;
  /* Enlarged while held in the antennae; drops back to 1.0 on delivery. */
  scale: 2;
  box-shadow: 0 0 14px rgba(255, 47, 179, 0.6);
  animation: carryGlow 1.4s ease-in-out infinite;
}

.spider-agent__carry-avatar {
  width: 13px;
  height: 13px;
  flex: 0 0 13px;
  border-radius: 999px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.14);
}

.spider-agent__carry-avatar--initial {
  display: grid;
  place-items: center;
  font-size: 7px;
  font-weight: 700;
  text-transform: uppercase;
}

.spider-agent__carry.is-strong {
  border-color: rgba(255, 214, 102, 0.8);
  color: #fff3cc;
  box-shadow: 0 0 14px rgba(255, 214, 102, 0.6);
}

.spider-agent__carry.is-gk {
  border-color: rgba(55, 224, 160, 0.7);
}

.spider-agent__carry-tier {
  margin-left: 4px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.18);
  padding: 0 3px;
  font-size: 8.5px;
  font-style: normal;
  font-weight: 600;
  vertical-align: 1px;
}

.spider-agent__carry.is-gk .spider-agent__carry-tier {
  background: rgba(55, 224, 160, 0.3);
  color: #b9ffdf;
}

@keyframes carryBob {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-2px);
  }
}

/* The carried badge reads as "being processed": enlarged and pulsing. */
@keyframes carryGlow {
  0%,
  100% {
    box-shadow: 0 0 12px rgba(255, 47, 179, 0.55), 0 0 0 rgba(255, 214, 102, 0);
  }
  50% {
    box-shadow: 0 0 22px rgba(255, 47, 179, 0.95), 0 0 34px rgba(255, 214, 102, 0.45);
  }
}

/*
 * Anchored legs. Leg geometry is computed per frame from the planted foot
 * anchors, so there is no CSS gait: the shape of the leg *is* the motion.
 */
.spider-agent__leg {
  transition: none;
}

.spider-agent__foot {
  fill: #ffd6f3;
  filter: drop-shadow(0 0 5px rgba(255, 47, 179, 0.9));
}

/*
 * Landing glow.
 *
 * This marks the *surface* a foot just gripped, not the leg: a small bright dot
 * that blurs outward and fades quickly. A large ring read as part of the leg,
 * which is not what it is meant to show.
 */
.spider-agent__foot-ripple {
  fill: #ffffff;
  stroke: none;
  transform-box: fill-box;
  transform-origin: center;
  pointer-events: none;
  filter: blur(1.5px) drop-shadow(0 0 6px rgba(255, 255, 255, 0.95));
  animation: footFlash 620ms ease-out forwards;
}

@keyframes footFlash {
  /* A brief, bright contact point... */
  0% {
    opacity: 1;
    transform: scale(0.7);
    filter: blur(0.5px) drop-shadow(0 0 8px #fff);
  }
  30% {
    opacity: 0.95;
    transform: scale(1.1);
    filter: blur(2px) drop-shadow(0 0 12px rgba(255, 255, 255, 0.9));
  }
  /* ...that softens and disappears. */
  100% {
    opacity: 0;
    transform: scale(1.7);
    filter: blur(4px) drop-shadow(0 0 3px rgba(255, 255, 255, 0));
  }
}

@media (prefers-reduced-motion: reduce) {
  /*
   * Keep the surface glow (it shows where a foot landed); only drop the scale.
   */
  .spider-agent__foot-ripple {
    animation: footFlashStatic 620ms ease-out forwards;
  }
}

@keyframes footFlashStatic {
  0%,
  40% {
    opacity: 1;
    filter: blur(1.5px) drop-shadow(0 0 8px #fff);
  }
  100% {
    opacity: 0;
    filter: blur(3px) drop-shadow(0 0 2px rgba(255, 255, 255, 0));
  }
}

/* A lifted foot dims while it swings to its next grip. */
.spider-agent__leg.is-lifting .spider-agent__foot {
  fill: rgba(255, 255, 255, 0.45);
}

.spider-agent.is-idle .spider-agent__leg,
.spider-agent.is-paused .spider-agent__leg {
  opacity: 0.92;
}

.spider-agent.is-moving .spider-agent__body,
.spider-agent.is-approaching .spider-agent__body {
  animation: bodySway 0.62s ease-in-out infinite;
}

.spider-agent.is-interacting .spider-agent__body,
.spider-agent.is-working .spider-agent__body {
  animation: spiderBob 0.9s ease-in-out infinite;
}

.spider-agent.is-idle .spider-agent__body,
.spider-agent.is-paused .spider-agent__body {
  animation: spiderBreathe 3.2s ease-in-out infinite;
}

@keyframes spiderBob {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-2px) scale(1.04);
  }
}

@keyframes spiderBreathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.04);
  }
}

@keyframes spiderShake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-2.5px);
  }
  75% {
    transform: translateX(2.5px);
  }
}

@keyframes burst {
  0% {
    opacity: 0.85;
    transform: scale(0.55);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

@keyframes burstShake {
  0% {
    opacity: 0.9;
    transform: scale(0.8);
  }
  100% {
    opacity: 0;
    transform: scale(1.25);
  }
}

/*
 * Reduced motion trims *decoration* only: the celebratory bursts, the idle
 * breathing and the slow sway. The leg gait and the crawl itself stay, because
 * they carry meaning — they show the spider walking to the card it is working
 * on. Switching them off made the agent look like it teleported.
 */
@media (prefers-reduced-motion: reduce) {
  .spider-agent__burst {
    animation: none;
    opacity: 0;
  }

  .spider-agent.is-idle .spider-agent__body,
  .spider-agent.is-paused .spider-agent__body,
  .spider-agent.is-failed {
    animation: none;
  }

  /*
   * The legs are driven by planted anchors rather than CSS keyframes, so there
   * is nothing to soften here; only the ambient body animation is trimmed.
   */
  .spider-agent.is-moving .spider-agent__body,
  .spider-agent.is-approaching .spider-agent__body {
    animation: none;
  }
}

</style>
