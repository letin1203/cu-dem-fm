<template>
  <div class="min-h-screen bg-gradient-to-br from-primary-50 via-secondary-50 to-primary-100">
    <div v-if="isWakingBackend" class="fixed inset-0 z-[100] flex items-center justify-center bg-white/85 p-6 backdrop-blur-sm">
      <div class="w-full max-w-sm text-center">
        <div class="relative mx-auto h-12 w-12">
          <div class="absolute inset-0 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
          <span class="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-primary-700">{{ wakeProgress }}%</span>
        </div>
        <p class="mt-4 break-words font-semibold leading-6 text-gray-900">Đang kết nối lại máy chủ, quá trình có thể tốn khoảng 10s-20s...</p>
        <p class="mt-1 text-sm leading-5 text-gray-600">Dữ liệu sẽ tự làm mới.</p>
      </div>
    </div>
    <div v-if="approvedTopUpQueue.length" class="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div class="border-b p-5"><h2 class="text-lg font-semibold text-primary-700">Nạp tiền đã được duyệt</h2><p class="mt-1 text-sm text-gray-600">Số tiền đã được cộng vào số dư của bạn.</p></div>
        <div class="p-5 text-center"><p class="text-sm text-gray-600">Số tiền được duyệt</p><p class="mt-2 text-2xl font-bold text-green-600">+{{ formatApprovalAmount(approvedTopUpQueue[0].amount) }} ₫</p></div>
        <div class="flex justify-end gap-3 border-t p-4"><button class="btn-secondary" @click="closeApprovedTopUpModal">Đóng</button><button class="btn-primary" @click="goToAttendance">Tới trang điểm danh</button></div>
      </div>
    </div>
    <Navigation v-if="isAuthenticated && $route.name !== 'login'" />
    <main 
      :class="[
        'w-full mx-auto',
        isAuthenticated && $route.name !== 'login' ? 'py-4 px-4 sm:py-6 sm:px-6 lg:px-8 max-w-7xl' : '' 
      ]"
    >
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import Navigation from './components/Navigation.vue'
import { useAuthStore } from './stores/auth'
import { apiClient } from './api/client'

const authStore = useAuthStore()
const router = useRouter()
const toast = useToast()
const isAuthenticated = computed(() => authStore.isAuthenticated)
const isWakingBackend = ref(false)
const wakeProgress = ref(0)
const BACKEND_WAKE_AFTER_MS = 5 * 60 * 1000
const BACKEND_WAKE_PROGRESS_DURATION_MS = 15_000
let lastBackgroundAt = Date.now()
let wakeInProgress = false
let wakeProgressTimer: number | undefined
const approvedTopUpQueue = ref<Array<{ id: string; amount: number; approvedAt: string }>>([])
let topUpApprovalPollTimer: number | undefined
let topUpApprovalSince = new Date().toISOString()
let topUpApprovalPolling = false

const formatApprovalAmount = (amount: number) => Number(amount || 0).toLocaleString('vi-VN')
const closeApprovedTopUpModal = () => { approvedTopUpQueue.value.shift() }
const goToAttendance = async () => {
  // Attendance eligibility uses the player balance stored in the auth store.
  // Refresh it first so a newly approved top-up immediately removes a stale
  // negative-balance restriction, even when the user is already on this page.
  await authStore.getCurrentUser()
  closeApprovedTopUpModal()
  if (router.currentRoute.value.name !== 'weeklyTournament') await router.push('/weekly-tournament')
}

const checkApprovedTopUps = async () => {
  if (topUpApprovalPolling || !isAuthenticated.value || document.visibilityState === 'hidden') return
  topUpApprovalPolling = true
  try {
    const response = await apiClient.getMyApprovedMoneyTopUpNotifications(topUpApprovalSince)
    if (response.success && Array.isArray(response.data)) {
      const notifications = response.data as Array<{ id: string; amount: number; status: string; requestedAt: string; approvedAt?: string; rejectedAt?: string }>
      const existingIds = new Set(approvedTopUpQueue.value.map(item => item.id))
      const approvals = notifications
        .filter(item => item.status === 'APPROVED' && !existingIds.has(item.id))
        .map(item => ({ id: item.id, amount: item.amount, approvedAt: item.approvedAt || new Date().toISOString() }))
      approvedTopUpQueue.value.push(...approvals)
      if (notifications.some(item => item.status === 'APPROVED' || item.status === 'REJECTED')) {
        window.dispatchEvent(new Event('pending-money-top-ups-changed'))
      }
      for (const rejection of notifications.filter(item => item.status === 'REJECTED')) {
        const requestedAt = new Date(rejection.requestedAt).toLocaleString('vi-VN')
        toast.error(`Số tiền ${formatApprovalAmount(rejection.amount)} ₫ bạn nạp lúc ${requestedAt} đã bị từ chối, vui lòng kiểm tra lại trong quỹ MoMo.`)
      }
    }
  } catch {
    // Notification polling must never interrupt normal use of the application.
  } finally {
    topUpApprovalSince = new Date().toISOString()
    topUpApprovalPolling = false
  }
}

const wakeAndRefresh = async () => {
  if (wakeInProgress || !isAuthenticated.value || Date.now() - lastBackgroundAt < BACKEND_WAKE_AFTER_MS) return
  wakeInProgress = true
  isWakingBackend.value = true
  wakeProgress.value = 0
  wakeProgressTimer = window.setInterval(() => {
    if (wakeProgress.value < 99) wakeProgress.value += 1
  }, BACKEND_WAKE_PROGRESS_DURATION_MS / 99)
  try {
    await apiClient.wakeUpBackend()
    window.location.reload()
  } finally {
    if (wakeProgressTimer) {
      window.clearInterval(wakeProgressTimer)
      wakeProgressTimer = undefined
    }
    // The reload normally replaces this component. Keep the UI usable if it is blocked.
    wakeInProgress = false
    isWakingBackend.value = false
  }
}

const handleVisibilityChange = () => {
  if (document.visibilityState === 'hidden') lastBackgroundAt = Date.now()
  else void wakeAndRefresh()
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  topUpApprovalSince = new Date().toISOString()
  topUpApprovalPollTimer = window.setInterval(() => void checkApprovedTopUps(), 12_000)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (topUpApprovalPollTimer) window.clearInterval(topUpApprovalPollTimer)
  if (wakeProgressTimer) window.clearInterval(wakeProgressTimer)
})
</script>
