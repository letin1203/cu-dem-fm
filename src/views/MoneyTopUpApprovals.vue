<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between gap-3">
      <div><h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Duyệt</h1><p class="text-sm text-gray-500 mt-1">{{ activeTab === 'top-up' ? 'Các yêu cầu nạp tiền đang chờ duyệt.' : activeTab === 'password' ? 'Các yêu cầu đổi mật khẩu đang chờ xử lý.' : 'Danh sách cầu thủ đã chuyển sang inactive.' }}</p></div>
      <button @click="loadActiveTab" :disabled="loading" class="btn-secondary">{{ loading ? 'Đang tải...' : 'Tải lại' }}</button>
    </div>
    <div class="flex border-b border-gray-200">
      <button class="border-b-2 px-4 py-2 text-sm font-medium" :class="activeTab === 'top-up' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'" @click="activeTab = 'top-up'; loadPending()">Nạp tiền</button>
      <button v-if="authStore.hasRole('admin')" class="border-b-2 px-4 py-2 text-sm font-medium" :class="activeTab === 'password' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'" @click="activeTab = 'password'; loadPasswordRequests()">Quên mật khẩu</button>
      <button v-if="authStore.hasAnyRole(['admin', 'mod'])" class="border-b-2 px-4 py-2 text-sm font-medium" :class="activeTab === 'inactive' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'" @click="activeTab = 'inactive'; loadInactivePlayers()">Cầu thủ inactive</button>
    </div>
    <div class="card p-0 overflow-hidden">
      <div v-if="loading" class="flex justify-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
      <div v-else-if="error" class="text-center text-red-600 py-10">{{ error }}</div>
      <div v-else-if="activeTab === 'top-up' && !requests.length && !fundRequests.length" class="text-center text-gray-500 py-10">Không có yêu cầu nạp tiền hoặc góp quỹ đang chờ duyệt.</div>
      <div v-else-if="activeTab === 'password'" class="p-6 text-center">
        <p class="text-gray-600">Tạo link đặt lại mật khẩu cho người dùng trong hệ thống.</p>
        <button type="button" class="btn-primary mt-4" @click="openPasswordLinkModal">Lấy link quên mật khẩu</button>
      </div>
      <div v-else-if="activeTab === 'inactive'" class="p-6">
        <div v-if="!inactivePlayers.length" class="py-8 text-center text-gray-500">Không có cầu thủ inactive.</div>
        <div v-else class="space-y-3"><div v-for="player in inactivePlayers" :key="player.id" class="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p class="font-semibold text-gray-900">{{ player.name }}</p><p class="mt-1 text-sm text-gray-500">{{ player.position }} · Tier {{ player.tier }} · {{ player.yearOfBirth }}</p></div><button type="button" class="btn-primary" :disabled="activatingPlayerId === player.id" @click="activatePlayer(player.id)">{{ activatingPlayerId === player.id ? 'Đang Active...' : 'Active' }}</button></div></div>
        <div v-if="inactivePagination.pages > 1" class="mt-6 flex items-center justify-center gap-3"><button type="button" class="btn-secondary" :disabled="inactivePagination.page <= 1" @click="loadInactivePlayers(inactivePagination.page - 1)">Trước</button><span class="text-sm text-gray-600">Trang {{ inactivePagination.page }} / {{ inactivePagination.pages }}</span><button type="button" class="btn-secondary" :disabled="inactivePagination.page >= inactivePagination.pages" @click="loadInactivePlayers(inactivePagination.page + 1)">Sau</button></div>
      </div>
      <div v-else class="divide-y divide-gray-200">
        <template v-if="activeTab === 'top-up'"><div v-for="request in requests" :key="request.id" class="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div><p class="font-semibold text-gray-900">{{ request.player.name }}</p><p class="text-sm text-gray-500">{{ request.player.position }} · Số dư hiện tại: {{ request.player.money.toLocaleString('vi-VN') }} ₫</p><p class="text-xs text-gray-400 mt-1">Yêu cầu lúc {{ formatDate(request.requestedAt) }}</p></div>
          <div class="flex items-center gap-3"><span class="font-bold text-green-600">+{{ request.amount.toLocaleString('vi-VN') }} ₫</span><button @click="approve(request.id)" :disabled="approvingId === request.id || deletingId === request.id" class="btn-primary">{{ approvingId === request.id ? 'Đang duyệt...' : 'Duyệt' }}</button><button v-if="authStore.hasAnyRole(['admin', 'mod'])" type="button" @click="deleteRequestId = request.id" :disabled="approvingId === request.id || deletingId === request.id" class="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50">Xóa</button></div>
        </div><div v-for="request in fundRequests" :key="request.id" class="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-amber-50/40"><div><p class="font-semibold text-gray-900">Góp quỹ · {{ request.user.player?.name || request.user.username }}</p><p class="text-sm text-gray-500">{{ request.reason }}</p><p class="text-xs text-gray-400 mt-1">Yêu cầu lúc {{ formatDate(request.requestedAt) }}</p></div><div class="flex items-center gap-3"><span class="font-bold text-green-600">+{{ request.amount.toLocaleString('vi-VN') }} ₫</span><button @click="approveFund(request.id)" :disabled="fundApprovingId === request.id" class="btn-primary">{{ fundApprovingId === request.id ? 'Đang duyệt...' : 'Duyệt góp quỹ' }}</button></div></div></template>
        <template v-else></template>
      </div>
    </div>

    <div v-if="showPasswordLinkModal" class="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/50 p-4" @click.self="showPasswordLinkModal = false">
      <div class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div class="flex items-center justify-between border-b p-5"><div><h2 class="text-lg font-semibold text-gray-900">Lấy link quên mật khẩu</h2><p class="mt-1 text-sm text-gray-500">Chọn user để copy link đặt lại mật khẩu.</p></div><button type="button" class="text-2xl text-gray-400 hover:text-gray-700" @click="showPasswordLinkModal = false">×</button></div>
        <div class="min-h-0 overflow-y-auto p-5"><input v-model="passwordRequestNameFilter" type="search" class="form-input mb-4" placeholder="Lọc theo tên user hoặc cầu thủ..."><div v-if="loading" class="py-8 text-center text-gray-500">Đang tải...</div><div v-else-if="!filteredPasswordRequests.length" class="py-8 text-center text-gray-500">Không có người dùng nào.</div><div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2"><div v-for="user in filteredPasswordRequests" :key="user.id" class="rounded-lg border border-gray-200 p-4"><p class="font-semibold text-gray-900">{{ user.username }}</p><p class="mt-1 text-sm text-gray-500">{{ user.player?.name || 'Chưa liên kết cầu thủ' }}</p><p class="mt-1 truncate text-xs text-gray-400">{{ user.email }}</p><p class="mt-2 text-xs text-gray-500">Tạo link lần cuối: <strong class="text-gray-700">{{ user.passwordResetLinkCreatedAt ? formatDate(user.passwordResetLinkCreatedAt) : 'n/a' }}</strong></p><button type="button" class="btn-primary mt-4 w-full" :disabled="linkLoadingId === user.id" @click="copyPasswordResetLink(user.id)">{{ linkLoadingId === user.id ? 'Đang tạo...' : 'Lấy link' }}</button></div></div></div>
        <div class="flex justify-end border-t p-4"><button type="button" class="btn-secondary" @click="showPasswordLinkModal = false">Đóng</button></div>
      </div>
    </div>
    <ConfirmationModal :is-open="Boolean(deleteRequestId)" title="Xóa yêu cầu nạp tiền" message="Yêu cầu nạp tiền này sẽ bị xóa và không cộng vào số dư cầu thủ." confirm-label="Xóa yêu cầu" :loading="Boolean(deletingId)" @cancel="deleteRequestId = null" @confirm="deleteTopUpRequest" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { apiClient } from '../api/client'
import { useAuthStore } from '../stores/auth'
import { useSystemStore } from '../stores/system'
import ConfirmationModal from '../components/ConfirmationModal.vue'

interface TopUpRequest { id: string; amount: number; requestedAt: string | Date; player: { name: string; position: string; money: number } }
interface FundRequest { id: string; amount: number; reason: string; requestedAt: string | Date; user: { username: string; player?: { name: string } | null } }
const toast = useToast()
const authStore = useAuthStore()
const systemStore = useSystemStore()
const activeTab = ref<'top-up' | 'password' | 'inactive'>('top-up')
const requests = ref<TopUpRequest[]>([])
const fundRequests = ref<FundRequest[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const approvingId = ref<string | null>(null)
const fundApprovingId = ref<string | null>(null)
const deleteRequestId = ref<string | null>(null)
const deletingId = ref<string | null>(null)
const passwordRequests = ref<{ id: string; username: string; email: string; passwordResetLinkCreatedAt: string | Date | null; player?: { name: string } | null }[]>([])
const linkLoadingId = ref<string | null>(null)
const showPasswordLinkModal = ref(false)
const passwordRequestNameFilter = ref('')
const inactivePlayers = ref<any[]>([])
const inactivePagination = ref({ page: 1, pages: 0, total: 0 })
const activatingPlayerId = ref<string | null>(null)
const formatDate = (date: string | Date) => new Date(date).toLocaleString('vi-VN')

const loadPending = async () => {
  loading.value = true; error.value = null
  try {
    const [topUpResponse, fundResponse] = await Promise.all([apiClient.getPendingMoneyTopUps(), apiClient.getPendingFundContributions()])
    if (!topUpResponse.success) throw new Error(topUpResponse.error || 'Không thể tải danh sách yêu cầu nạp tiền')
    if (!fundResponse.success) throw new Error(fundResponse.error || 'Không thể tải danh sách yêu cầu góp quỹ')
    requests.value = (topUpResponse.data || []) as TopUpRequest[]
    fundRequests.value = (fundResponse.data || []) as FundRequest[]
  } catch (err) { error.value = err instanceof Error ? err.message : 'Không thể tải danh sách yêu cầu' }
  finally { loading.value = false }
}
const approve = async (id: string) => {
  approvingId.value = id
  try {
    const response = await apiClient.approveMoneyTopUp(id)
    if (!response.success) throw new Error(response.error || 'Không thể duyệt yêu cầu')
    requests.value = requests.value.filter(request => request.id !== id)
    window.dispatchEvent(new Event('pending-money-top-ups-changed'))
    toast.success('Đã duyệt và cộng tiền cho cầu thủ')
  } catch (err) { toast.error(err instanceof Error ? err.message : 'Không thể duyệt yêu cầu') }
  finally { approvingId.value = null }
}
const approveFund = async (id: string) => {
  fundApprovingId.value = id
  try {
    const response = await apiClient.approveFundContribution(id)
    if (!response.success) throw new Error(response.error || 'Không thể duyệt góp quỹ')
    fundRequests.value = fundRequests.value.filter(request => request.id !== id)
    await systemStore.fetchSystemSettings()
    toast.success('Đã duyệt và cộng tiền vào quỹ')
  } catch (err) { toast.error(err instanceof Error ? err.message : 'Không thể duyệt góp quỹ') }
  finally { fundApprovingId.value = null }
}
const deleteTopUpRequest = async () => {
  const id = deleteRequestId.value
  if (!id) return
  deletingId.value = id
  try {
    const response = await apiClient.deleteMoneyTopUp(id)
    if (!response.success) throw new Error(response.error || 'Không thể xóa yêu cầu nạp tiền')
    requests.value = requests.value.filter(request => request.id !== id)
    deleteRequestId.value = null
    window.dispatchEvent(new Event('pending-money-top-ups-changed'))
    toast.success('Đã xóa yêu cầu nạp tiền')
  } catch (err) { toast.error(err instanceof Error ? err.message : 'Không thể xóa yêu cầu nạp tiền') }
  finally { deletingId.value = null }
}
const loadPasswordRequests = async () => {
  loading.value = true; error.value = null
  try { const response = await apiClient.getPasswordResetRequests(); if (!response.success) throw new Error(response.error || 'Không thể tải yêu cầu'); passwordRequests.value = response.data || [] }
  catch (err) { error.value = err instanceof Error ? err.message : 'Không thể tải yêu cầu' }
  finally { loading.value = false }
}
const loadInactivePlayers = async (page = 1) => {
  loading.value = true; error.value = null
  try { const response = await apiClient.get<{ players: any[]; pagination: { page: number; pages: number; total: number } }>('/players/inactive', { params: { page, limit: 10 } }); if (!response.success || !response.data) throw new Error(response.error || 'Không thể tải cầu thủ inactive'); inactivePlayers.value = response.data.players || []; inactivePagination.value = response.data.pagination || { page: 1, pages: 0, total: 0 } }
  catch (err) { error.value = err instanceof Error ? err.message : 'Không thể tải cầu thủ inactive' }
  finally { loading.value = false }
}
const activatePlayer = async (id: string) => {
  activatingPlayerId.value = id
  try { const response = await apiClient.put(`/players/inactive/${id}/activate`); if (!response.success) throw new Error(response.error || 'Không thể Active cầu thủ'); toast.success('Đã Active cầu thủ'); await loadInactivePlayers(inactivePlayers.value.length === 1 && inactivePagination.value.page > 1 ? inactivePagination.value.page - 1 : inactivePagination.value.page) }
  catch (err) { toast.error(err instanceof Error ? err.message : 'Không thể Active cầu thủ') }
  finally { activatingPlayerId.value = null }
}
const loadActiveTab = () => activeTab.value === 'top-up' ? loadPending() : activeTab.value === 'password' ? loadPasswordRequests() : loadInactivePlayers()
const filteredPasswordRequests = computed(() => {
  const query = passwordRequestNameFilter.value.trim().toLocaleLowerCase('vi')
  if (!query) return passwordRequests.value
  return passwordRequests.value.filter(user => `${user.username} ${user.player?.name || ''}`.toLocaleLowerCase('vi').includes(query))
})
const openPasswordLinkModal = async () => {
  passwordRequestNameFilter.value = ''
  showPasswordLinkModal.value = true
  await loadPasswordRequests()
}
const copyPasswordResetLink = async (userId: string) => {
  linkLoadingId.value = userId
  try { const response = await apiClient.getPasswordResetLink(userId); const link = response.data?.link; if (!response.success || !link) throw new Error(response.error || 'Không thể tạo link'); await navigator.clipboard.writeText(`${link}\n\nReset password xong login điểm danh nha`); passwordRequests.value = passwordRequests.value.map(user => user.id === userId ? { ...user, passwordResetLinkCreatedAt: response.data?.passwordResetLinkCreatedAt || new Date() } : user); toast.success('Đã copy link đặt lại mật khẩu') }
  catch (err) { toast.error(err instanceof Error ? err.message : 'Không thể copy link') }
  finally { linkLoadingId.value = null }
}
onMounted(loadPending)
</script>
