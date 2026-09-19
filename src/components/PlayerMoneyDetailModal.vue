<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/50 p-4" @click.self="emit('close')">
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
                <p class="font-medium text-gray-900">{{ getDescription(item) }}</p>
                <p v-if="item.tournament" class="mt-1 text-sm text-primary-700">{{ item.tournament.name }}</p>
                <p v-if="getApprovedByUsername(item)" class="mt-1 text-sm text-gray-600">Duyệt bởi: <strong class="text-gray-800">{{ getApprovedByUsername(item) }}</strong></p>
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
      <div class="flex flex-wrap justify-end gap-3 border-t p-4">
        <button v-if="canDeduct" type="button" class="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700" @click="openDeductModal">Trừ tiền</button>
        <button class="btn-primary" @click="emit('close')">Đóng</button>
      </div>

      <div v-if="showDeductModal" class="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4" @click.self="showDeductModal = false">
        <div class="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
          <h3 class="text-lg font-semibold text-gray-900">Trừ tiền cầu thủ</h3>
          <p class="mt-1 text-sm text-gray-500">{{ player?.name }}</p>
          <label class="form-label mt-4">Số tiền trừ</label>
          <div class="flex items-center gap-2"><button type="button" class="btn-secondary h-10 w-10 px-0 text-lg" :disabled="deductAmount <= 1 || deducting" @click="deductAmount = Math.max(1, deductAmount - 50000)">−</button><input v-model.number="deductAmount" type="number" min="1" step="50000" class="form-input text-center" :disabled="deducting"><button type="button" class="btn-secondary h-10 w-10 px-0 text-lg" :disabled="deducting" @click="deductAmount += 50000">+</button></div><p class="mt-1 text-center text-xs text-gray-500">{{ formatMoney(deductAmount) }}</p>
          <label class="form-label mt-4">Lý do</label>
          <textarea v-model="deductReason" rows="3" class="form-input" placeholder="Nhập lý do trừ tiền..." :disabled="deducting"></textarea>
          <div class="mt-5 flex justify-end gap-3"><button type="button" class="btn-secondary" :disabled="deducting" @click="showDeductModal = false">Hủy</button><button type="button" class="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50" :disabled="deducting || !isValidDeduction" @click="submitDeduction">{{ deducting ? 'Đang lưu...' : 'Xác nhận' }}</button></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Player, PlayerMoneyHistory } from '../types'
import { formatMoney as formatCompactMoney } from '../utils/money'

defineProps<{
  isOpen: boolean
  player: Player | null
  history: PlayerMoneyHistory[]
  pagination: { page: number; pages: number; total: number }
  loading: boolean
  error: string | null
  canDeduct?: boolean
  deducting?: boolean
}>()

const emit = defineEmits<{ close: []; 'page-change': [page: number]; deduct: [payload: { amount: number; reason: string }] }>()
const showDeductModal = ref(false)
const deductAmount = ref(50000)
const deductReason = ref('')
const isValidDeduction = computed(() => Number.isInteger(deductAmount.value) && deductAmount.value >= 1 && Boolean(deductReason.value.trim()))
const openDeductModal = () => {
  deductAmount.value = 50000
  deductReason.value = ''
  showDeductModal.value = true
}
const submitDeduction = () => {
  if (!isValidDeduction.value) return
  emit('deduct', { amount: deductAmount.value, reason: deductReason.value.trim() })
  showDeductModal.value = false
}
const formatMoney = (value: number) => formatCompactMoney(value)
const formatDate = (value: string | Date) => new Date(value).toLocaleString('vi-VN')
const getApprovedByUsername = (item: PlayerMoneyHistory) =>
  item.approvedByUsername || item.description.match(/^Nạp tiền đã được duyệt bởi (.+)$/)?.[1] || null
const getDescription = (item: PlayerMoneyHistory) =>
  item.approvedByUsername ? item.description : item.description.replace(/^Nạp tiền đã được duyệt bởi .+$/, 'Nạp tiền đã được duyệt')
</script>
