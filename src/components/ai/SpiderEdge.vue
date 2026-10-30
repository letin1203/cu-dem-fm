<template>
  <path
    :d="path"
    class="spider-edge__rail"
    :class="[`is-${data.status.toLowerCase()}`, { 'is-settled': settled }]"
    fill="none"
  />
  <path
    v-if="!settled"
    :d="path"
    class="spider-edge__flow"
    :class="[`is-${data.status.toLowerCase()}`]"
    fill="none"
  />
  <circle
    v-for="particle in particles"
    :key="particle.key"
    r="2.4"
    class="spider-edge__particle"
    :class="[`is-${data.status.toLowerCase()}`]"
  >
    <animateMotion
      :dur="`${particle.duration}s`"
      :begin="`${particle.delay}s`"
      repeatCount="indefinite"
      :path="path"
    />
  </circle>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getBezierPath, Position, type EdgeProps } from '@vue-flow/core';
import type { AiNodeStatus } from '../../types/aiGraph';

const props = defineProps<
  EdgeProps<{
    status: AiNodeStatus;
    label?: string;
    /** True once the whole run has finished: motion stops, the rail stays. */
    settled?: boolean;
  }>
>();

const settled = computed(() => Boolean(props.data?.settled));

/**
 * Connectors run vertically: the graph is stacked tiers -> thinking -> teams,
 * so edges leave the bottom of a card and enter the top of the next one.
 *
 * The handle positions decide the curve, so they default to Bottom/Top rather
 * than the horizontal Left/Right they used to be.
 */
const path = computed(() => {
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition ?? Position.Bottom,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition ?? Position.Top,
    curvature: 0.35,
  });
  return edgePath;
});

/**
 * Particles only run while information is actually moving. Pending and failed
 * links stay inert, and once the split is finished every particle stops so the
 * final teams can be read without motion on top of them.
 */
const particles = computed(() => {
  if (settled.value) return [];
  if (props.data?.status === 'PENDING' || props.data?.status === 'FAILED') return [];
  const seed = props.id.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  return Array.from({ length: 3 }, (_, index) => ({
    key: `${props.id}-${index}`,
    delay: Number(((seed % 17) / 10 + index * 1.1).toFixed(2)),
    duration: Number((2.4 + (seed % 5) / 10).toFixed(2)),
  }));
});
</script>

<style scoped>
.spider-edge__rail {
  stroke: rgba(150, 120, 200, 0.22);
  stroke-width: 1.4;
}

.spider-edge__rail.is-completed {
  stroke: rgba(255, 47, 179, 0.42);
}

.spider-edge__rail.is-running {
  stroke: rgba(255, 47, 179, 0.7);
}

.spider-edge__rail.is-failed {
  stroke: rgba(255, 77, 109, 0.6);
}

/* Settled: the link is still visible but no longer signals live traffic. */
.spider-edge__rail.is-settled {
  stroke: rgba(255, 47, 179, 0.3);
}

.spider-edge__flow {
  stroke: rgba(255, 255, 255, 0.34);
  stroke-width: 1.1;
  stroke-dasharray: 4 10;
  animation: edgeFlow 1.6s linear infinite;
}

.spider-edge__flow.is-pending {
  animation: none;
  stroke: rgba(120, 108, 150, 0.2);
}

.spider-edge__flow.is-failed {
  animation: none;
  stroke-dasharray: 2 6;
  stroke: rgba(255, 77, 109, 0.45);
}

.spider-edge__particle {
  fill: #ff8ede;
  filter: drop-shadow(0 0 5px #ff2fb3);
}

.spider-edge__particle.is-running {
  fill: #ffd0f2;
}

.spider-edge__particle.is-completed {
  fill: #ff6cc9;
}

@keyframes edgeFlow {
  to {
    stroke-dashoffset: -28;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spider-edge__flow {
    animation: none;
  }
}
</style>
