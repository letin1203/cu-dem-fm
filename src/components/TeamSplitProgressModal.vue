<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-[85] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div class="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl bg-white shadow-xl" :class="maxWidthClass" :style="modalStyle">
        <div class="border-b p-5"><h2 class="text-lg font-semibold text-primary-700">Đang thực hiện chia team</h2><p class="mt-1 text-sm text-gray-500">{{ description }}</p></div>
        <div ref="contentRef" class="min-h-0 space-y-5 overflow-y-auto p-5">
          <slot name="groups" />
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div class="mb-3 flex items-center gap-3"><span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">{{ stage }}</span><strong class="shrink-0">{{ isAssigningGoalkeeper ? 'Đang phân chia GK' : title }}</strong><div class="ml-6 hidden min-w-0 flex-1 overflow-hidden text-left lg:block" :style="{ height: `${teamCount * 16}px` }"><p class="overflow-hidden whitespace-pre-line text-xs leading-4 text-primary-700" :style="{ height: `${teamCount * 16}px` }"><template v-for="(word, index) in desktopAiWords" :key="`${aiSequence}-${index}`"><br v-if="word === '\n'" /><span v-else class="team-split-ai-word">{{ word }}</span></template></p></div></div>
            <div ref="aiRef" class="mb-4 overflow-hidden rounded-lg border border-primary-200 bg-primary-50 p-2 lg:hidden" :style="{ height: `${teamCount * 32 + 36}px` }"><p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-primary-700">AI đang suy nghĩ</p><p class="overflow-hidden whitespace-pre-line break-words text-xs leading-4 text-primary-700" :style="{ height: `${teamCount * 32}px` }"><template v-for="(word, index) in mobileAiWords" :key="`${aiSequence}-${index}`"><br v-if="word === '\n'" /><span v-else class="team-split-ai-word">{{ word }}</span></template></p></div>
            <slot name="teams" />
          </div>
        </div>
        <div v-if="$slots.footer" class="border-t p-4"><slot name="footer" /></div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';

withDefaults(defineProps<{
  modelValue: boolean;
  teamCount: number;
  stage: number;
  title: string;
  description: string;
  isAssigningGoalkeeper?: boolean;
  desktopAiWords: string[];
  mobileAiWords: string[];
  aiSequence: number;
  maxWidthClass?: string;
  modalStyle?: Record<string, string | undefined>;
}>(), { isAssigningGoalkeeper: false, maxWidthClass: 'max-w-6xl' });

const contentRef = ref<HTMLElement | null>(null);
const aiRef = ref<HTMLElement | null>(null);

function smoothScrollTo(element: HTMLElement | null, alignment: 'start' | 'center' = 'start'): Promise<void> {
  const container = contentRef.value;
  if (!element || !container || window.innerWidth >= 1024) return Promise.resolve();
  const offset = element.getBoundingClientRect().top - container.getBoundingClientRect().top;
  const target = alignment === 'center' ? offset - (container.clientHeight - element.clientHeight) / 2 : offset - 8;
  const from = container.scrollTop;
  const to = Math.max(0, Math.min(container.scrollHeight - container.clientHeight, from + target));
  const distance = to - from;
  if (Math.abs(distance) < 2) return Promise.resolve();
  const duration = Math.min(1100, Math.max(550, Math.abs(distance) * 1.25));
  const start = performance.now();
  return new Promise((resolve) => {
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      container.scrollTop = from + distance * eased;
      progress < 1 ? requestAnimationFrame(tick) : resolve();
    };
    requestAnimationFrame(tick);
  });
}

defineExpose({ scrollToAiThought: () => smoothScrollTo(aiRef.value), scrollToElement: smoothScrollTo });
</script>

<style scoped>
.team-split-ai-word { display: inline-block; margin-right: .25rem; animation: team-split-ai-word-reveal .22s ease-out both; }
@keyframes team-split-ai-word-reveal { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
</style>
