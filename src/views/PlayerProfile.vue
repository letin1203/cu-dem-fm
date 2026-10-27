<template>
  <div class="space-y-4 sm:space-y-6">
    <div
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">
        Hồ sơ cầu thủ của tôi
      </h1>
      <button
        @click="refresh"
        :disabled="loading"
        class="btn-secondary inline-flex items-center space-x-2"
      >
        <svg
          class="w-4 h-4"
          :class="{ 'animate-spin': loading }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span>{{ loading ? "Đang tải lại..." : "Tải lại" }}</span>
      </button>
    </div>

    <PlayerProfilePanel ref="panelRef" @update:loading="loading = $event" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import PlayerProfilePanel from "../components/PlayerProfilePanel.vue";

const panelRef = ref<InstanceType<typeof PlayerProfilePanel> | null>(null);
const loading = ref(false);

const refresh = () => panelRef.value?.refresh();
</script>
