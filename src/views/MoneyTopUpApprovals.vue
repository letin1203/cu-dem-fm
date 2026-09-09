<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-3">
      <div><h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Duyệt nạp tiền</h1><p class="text-sm text-gray-500 mt-1">Các yêu cầu nạp tiền đang chờ duyệt.</p></div>
      <button @click="loadPending" :disabled="loading" class="btn-secondary">{{ loading ? 'Đang tải...' : 'Tải lại' }}</button>
    </div>
    <div class="card p-0 overflow-hidden">
      <div v-if="loading" class="flex justify-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
      <div v-else-if="error" class="text-center text-red-600 py-10">{{ error }}</div>
      <div v-else-if="!requests.length" class="text-center text-gray-500 py-10">Không có yêu cầu nạp tiền đang chờ duyệt.</div>
      <div v-else class="divide-y divide-gray-200">
        <div v-for="request in requests" :key="request.id" class="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div><p class="font-semibold text-gray-900">{{ request.player.name }}</p><p class="text-sm text-gray-500">{{ request.player.position }} · Số dư hiện tại: {{ request.player.money.toLocaleString('vi-VN') }} ₫</p><p class="text-xs text-gray-400 mt-1">Yêu cầu lúc {{ formatDate(request.requestedAt) }}</p></div>
          <div class="flex items-center gap-4"><span class="font-bold text-green-600">+{{ request.amount.toLocaleString('vi-VN') }} ₫</span><button @click="approve(request.id)" :disabled="approvingId === request.id" class="btn-primary">{{ approvingId === request.id ? 'Đang duyệt...' : 'Duyệt' }}</button></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { apiClient } from '../api/client'

interface TopUpRequest { id: string; amount: number; requestedAt: string | Date; player: { name: string; position: string; money: number } }
const toast = useToast()
const requests = ref<TopUpRequest[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const approvingId = ref<string | null>(null)
const formatDate = (date: string | Date) => new Date(date).toLocaleString('vi-VN')

const loadPending = async () => {
  loading.value = true; error.value = null
  try {
    const response = await apiClient.getPendingMoneyTopUps()
    if (!response.success) throw new Error(response.error || 'Không thể tải danh sách yêu cầu')
    requests.value = (response.data || []) as TopUpRequest[]
  } catch (err) { error.value = err instanceof Error ? err.message : 'Không thể tải danh sách yêu cầu' }
  finally { loading.value = false }
}
const approve = async (id: string) => {
  approvingId.value = id
  try {
    const response = await apiClient.approveMoneyTopUp(id)
    if (!response.success) throw new Error(response.error || 'Không thể duyệt yêu cầu')
    requests.value = requests.value.filter(request => request.id !== id)
    toast.success('Đã duyệt và cộng tiền cho cầu thủ')
  } catch (err) { toast.error(err instanceof Error ? err.message : 'Không thể duyệt yêu cầu') }
  finally { approvingId.value = null }
}
onMounted(loadPending)
</script>
