<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-3">
      <div><h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Duyệt</h1><p class="text-sm text-gray-500 mt-1">{{ activeTab === 'top-up' ? 'Các yêu cầu nạp tiền đang chờ duyệt.' : 'Các yêu cầu đổi mật khẩu đang chờ xử lý.' }}</p></div>
      <button @click="loadActiveTab" :disabled="loading" class="btn-secondary">{{ loading ? 'Đang tải...' : 'Tải lại' }}</button>
    </div>
    <div class="flex border-b border-gray-200">
      <button class="border-b-2 px-4 py-2 text-sm font-medium" :class="activeTab === 'top-up' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'" @click="activeTab = 'top-up'; loadPending()">Nạp tiền</button>
      <button v-if="authStore.hasRole('admin')" class="border-b-2 px-4 py-2 text-sm font-medium" :class="activeTab === 'password' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'" @click="activeTab = 'password'; loadPasswordRequests()">Quên mật khẩu</button>
    </div>
    <div class="card p-0 overflow-hidden">
      <div v-if="loading" class="flex justify-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
      <div v-else-if="error" class="text-center text-red-600 py-10">{{ error }}</div>
      <div v-else-if="activeTab === 'top-up' && !requests.length" class="text-center text-gray-500 py-10">Không có yêu cầu nạp tiền đang chờ duyệt.</div>
      <div v-else-if="activeTab === 'password' && !passwordRequests.length" class="text-center text-gray-500 py-10">Không có yêu cầu đổi mật khẩu đang chờ xử lý.</div>
      <div v-else class="divide-y divide-gray-200">
        <template v-if="activeTab === 'top-up'"><div v-for="request in requests" :key="request.id" class="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div><p class="font-semibold text-gray-900">{{ request.player.name }}</p><p class="text-sm text-gray-500">{{ request.player.position }} · Số dư hiện tại: {{ request.player.money.toLocaleString('vi-VN') }} ₫</p><p class="text-xs text-gray-400 mt-1">Yêu cầu lúc {{ formatDate(request.requestedAt) }}</p></div>
          <div class="flex items-center gap-4"><span class="font-bold text-green-600">+{{ request.amount.toLocaleString('vi-VN') }} ₫</span><button @click="approve(request.id)" :disabled="approvingId === request.id" class="btn-primary">{{ approvingId === request.id ? 'Đang duyệt...' : 'Duyệt' }}</button></div>
        </div></template>
        <template v-else><div v-for="user in passwordRequests" :key="user.id" class="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p class="font-semibold text-gray-900">{{ user.username }}</p><p class="text-sm text-gray-500">{{ user.player?.name || 'Chưa liên kết cầu thủ' }}</p><p class="text-xs text-gray-400 mt-1">{{ user.email }}</p></div><button @click="copyPasswordResetLink(user.id)" :disabled="linkLoadingId === user.id" class="btn-primary">{{ linkLoadingId === user.id ? 'Đang tạo...' : 'Lấy link' }}</button></div></template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { apiClient } from '../api/client'
import { useAuthStore } from '../stores/auth'

interface TopUpRequest { id: string; amount: number; requestedAt: string | Date; player: { name: string; position: string; money: number } }
const toast = useToast()
const authStore = useAuthStore()
const activeTab = ref<'top-up' | 'password'>('top-up')
const requests = ref<TopUpRequest[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const approvingId = ref<string | null>(null)
const passwordRequests = ref<{ id: string; username: string; email: string; player?: { name: string } | null }[]>([])
const linkLoadingId = ref<string | null>(null)
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
const loadPasswordRequests = async () => {
  loading.value = true; error.value = null
  try { const response = await apiClient.getPasswordResetRequests(); if (!response.success) throw new Error(response.error || 'Không thể tải yêu cầu'); passwordRequests.value = response.data || [] }
  catch (err) { error.value = err instanceof Error ? err.message : 'Không thể tải yêu cầu' }
  finally { loading.value = false }
}
const loadActiveTab = () => activeTab.value === 'top-up' ? loadPending() : loadPasswordRequests()
const copyPasswordResetLink = async (userId: string) => {
  linkLoadingId.value = userId
  try { const response = await apiClient.getPasswordResetLink(userId); const link = response.data?.link; if (!response.success || !link) throw new Error(response.error || 'Không thể tạo link'); await navigator.clipboard.writeText(link); toast.success('Đã copy link đặt lại mật khẩu') }
  catch (err) { toast.error(err instanceof Error ? err.message : 'Không thể copy link') }
  finally { linkLoadingId.value = null }
}
onMounted(loadPending)
</script>
