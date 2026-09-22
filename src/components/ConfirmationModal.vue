<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/50 p-4">
    <div class="my-auto max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl" role="dialog" aria-modal="true">
      <h2 class="text-lg font-semibold text-gray-900">{{ title }}</h2>
      <p class="mt-3 text-sm leading-6 text-gray-600">{{ message }}</p>
      <div class="mt-6 flex justify-end gap-3">
        <button type="button" class="btn-secondary" :disabled="loading" @click="$emit('cancel')">Hủy</button>
        <button type="button" class="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50" :disabled="loading" @click="$emit('confirm')">{{ loading ? 'Đang xử lý...' : confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ isOpen: boolean; title?: string; message: string; confirmLabel?: string; loading?: boolean }>(), {
  title: 'Xác nhận', confirmLabel: 'Xác nhận', loading: false,
})
defineEmits<{ confirm: []; cancel: [] }>()
</script>
