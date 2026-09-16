<template>
  <div class="min-h-screen bg-gradient-to-br from-primary-50 via-secondary-50 to-primary-100">
    <div v-if="isWakingBackend" class="fixed inset-0 z-[100] flex items-center justify-center bg-white/85 p-6 backdrop-blur-sm">
      <div class="text-center"><div class="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div><p class="mt-4 font-semibold text-gray-900">Đang kết nối lại máy chủ, quá trình có thể tốn khoảng 10s...</p><p class="mt-1 text-sm text-gray-600">Dữ liệu sẽ tự làm mới sau ít phút.</p></div>
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
import Navigation from './components/Navigation.vue'
import { useAuthStore } from './stores/auth'
import { apiClient } from './api/client'

const authStore = useAuthStore()
const isAuthenticated = computed(() => authStore.isAuthenticated)
const isWakingBackend = ref(false)
const BACKEND_WAKE_AFTER_MS = 5 * 60 * 1000
let lastBackgroundAt = Date.now()
let wakeInProgress = false

const wakeAndRefresh = async () => {
  if (wakeInProgress || !isAuthenticated.value || Date.now() - lastBackgroundAt < BACKEND_WAKE_AFTER_MS) return
  wakeInProgress = true
  isWakingBackend.value = true
  try {
    await apiClient.wakeUpBackend()
    window.location.reload()
  } finally {
    // The reload normally replaces this component. Keep the UI usable if it is blocked.
    wakeInProgress = false
    isWakingBackend.value = false
  }
}

const handleVisibilityChange = () => {
  if (document.visibilityState === 'hidden') lastBackgroundAt = Date.now()
  else void wakeAndRefresh()
}

onMounted(() => document.addEventListener('visibilitychange', handleVisibilityChange))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', handleVisibilityChange))
</script>
