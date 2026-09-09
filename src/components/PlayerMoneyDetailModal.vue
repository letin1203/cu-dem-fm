<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="emit('close')">
    <div class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
      <div class="flex items-center justify-between border-b p-5">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Chi tiết biến động tiền</h2>
          <p class="text-sm text-gray-500"><span class="font-semibold text-gray-800">{{ player?.name }}</span> · Số dư hiện tại: <span class="font-semibold text-gray-800">{{ formatMoney(player?.money || 0) }}</span></p>
        </div>
        <button class="text-2xl leading-none text-gray-400 hover:text-gray-700" aria-label="Đóng" @click="emit('close')">×</button>
      </div>

      <div class="min-h-48 overflow-y-auto p-5">
        <div v-if="loading" class="py-10 text-center text-gray-500">Đang tải lịch sử...</div>
        <div v-else-if="error" class="py-10 text-center text-red-600">{{ error }}</div>
        <div v-else-if="history.length === 0" class="py-10 text-center text-gray-500">Chưa có biến động tiền nào.</div>
        <div v-else class="space-y-3">
          <div v-for="item in history" :key="item.id" class="rounded-lg border border-gray-200 p-4">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p class="font-medium text-gray-900">{{ item.description }}</p>
                <p v-if="item.tournament" class="mt-1 text-sm text-primary-700">{{ item.tournament.name }}</p>
                <p class="mt-1 text-xs text-gray-500">{{ formatDate(item.createdAt) }}</p>
              </div>
              <span class="font-semibold" :class="item.amount >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ item.amount >= 0 ? '+' : '' }}{{ formatMoney(item.amount) }}
              </span>
            </div>
            <div class="mt-3 flex justify-between border-t pt-3 text-sm text-gray-600">
              <span>Trước: {{ formatMoney(item.balanceBefore) }}</span>
              <span>Sau: {{ formatMoney(item.balanceAfter) }}</span>
            </div>
            <div v-if="item.details?.length" class="mt-3 space-y-1 border-t pt-3 text-xs">
              <div v-for="detail in item.details" :key="`${detail.description}-${detail.amount}`" class="flex justify-between gap-3 text-gray-600">
                <span>{{ detail.description }}</span>
                <span class="text-gray-900">{{ detail.amount >= 0 ? '+' : '' }}{{ formatMoney(detail.amount) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="pagination.total > 5" class="flex items-center justify-between border-t p-4">
        <span class="text-sm text-gray-500">{{ pagination.total }} bản ghi</span>
        <div class="flex items-center gap-3">
          <button class="btn-secondary" :disabled="pagination.page <= 1 || loading" @click="emit('page-change', pagination.page - 1)">Trước</button>
          <span class="text-sm text-gray-600">Trang {{ pagination.page }} / {{ Math.max(pagination.pages, 1) }}</span>
          <button class="btn-secondary" :disabled="pagination.page >= pagination.pages || loading" @click="emit('page-change', pagination.page + 1)">Sau</button>
        </div>
      </div>
      <div class="flex justify-end border-t p-4"><button class="btn-primary" @click="emit('close')">Đóng</button></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Player, PlayerMoneyHistory } from '../types'

defineProps<{
  isOpen: boolean
  player: Player | null
  history: PlayerMoneyHistory[]
  pagination: { page: number; pages: number; total: number }
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{ close: []; 'page-change': [page: number] }>()
const formatMoney = (value: number) => `${value.toLocaleString('vi-VN')} ₫`
const formatDate = (value: string | Date) => new Date(value).toLocaleString('vi-VN')
</script>
