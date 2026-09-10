<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-secondary-50 to-primary-100 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <div class="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary-200">
          <svg class="h-8 w-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-primary-900">
          Đăng nhập
        </h2>
      </div>
      
      <form class="mt-8 space-y-6 bg-white/80 backdrop-blur-sm rounded-lg p-6 shadow-lg border border-primary-200" @submit.prevent="handleLogin">
        <div class="rounded-md shadow-sm -space-y-px">
          <div>
            <label for="username" class="sr-only">Tên đăng nhập</label>
            <input
              id="username"
              v-model="credentials.username"
              name="username"
              type="text"
              required
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-primary-300 placeholder-primary-400 text-primary-900 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
              placeholder="Tên đăng nhập hoặc email"
            >
          </div>
          <div>
            <label for="password" class="sr-only">Mật khẩu</label>
            <input
              id="password"
              v-model="credentials.password"
              name="password"
              type="password"
              required
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-primary-300 placeholder-primary-400 text-primary-900 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
              placeholder="Mật khẩu"
            >
          </div>
        </div>

        <div class="flex items-center justify-between">
          <label class="flex items-center text-sm text-primary-700">
            <input type="checkbox" v-model="rememberMe" class="form-checkbox h-4 w-4 text-primary-600 rounded" />
            <span class="ml-2">Ghi nhớ đăng nhập</span>
          </label>
          <button type="button" class="text-sm font-medium text-primary-600 hover:text-primary-800" @click="openForgotPasswordModal">Quên mật khẩu?</button>
        </div>

        <div v-if="error" class="rounded-md bg-red-50 p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-800">
                {{ error }}
              </h3>
            </div>
          </div>
        </div>

        <div>
          <button
            type="submit"
            :disabled="isLoading"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="!isLoading">Đăng nhập</span>
            <span v-else class="flex items-center">
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Đang đăng nhập...
            </span>
          </button>
        </div>

        <button type="button" class="w-full text-center text-sm font-medium text-primary-600 hover:text-primary-800" :disabled="isLoading" @click="handleGuestLogin">Đăng nhập để xem</button>

        <!-- Version Information -->
        <div class="mt-6 pt-4 border-t border-gray-200">
          <div class="text-center">
            <div v-if="versionInfo" class="space-y-1 text-xs text-gray-500">
              <div class="flex justify-between items-center">
                <span>Frontend:</span>
                <span class="font-mono">v{{ versionInfo.frontend.version }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span>Backend:</span>
                <span class="font-mono">v{{ versionInfo.backend.version }}</span>
              </div>
              <div class="text-center text-gray-400 mt-2">
                <span class="text-xs">{{ versionInfo.backend.environment }}</span>
              </div>
            </div>
            <div v-else class="text-xs text-gray-400">
              Loading version info...
            </div>
          </div>
        </div>
      </form>

      <div v-if="showForgotPasswordModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="closeForgotPasswordModal">
        <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="forgot-password-title">
          <div class="flex items-start justify-between gap-4">
            <div><h3 id="forgot-password-title" class="text-lg font-semibold text-gray-900">Quên mật khẩu</h3><p class="mt-1 text-sm text-gray-600">Nhập email để gửi yêu cầu đổi mật khẩu đến quản trị viên.</p></div>
            <button type="button" class="text-2xl leading-none text-gray-400 hover:text-gray-700" aria-label="Đóng" @click="closeForgotPasswordModal">×</button>
          </div>
          <form class="mt-5" @submit.prevent="submitForgotPassword">
            <label for="forgot-password-email" class="form-label">Email</label>
            <input id="forgot-password-email" v-model="forgotPasswordEmail" type="email" required class="form-input mt-1" placeholder="Nhập địa chỉ email">
            <p v-if="forgotPasswordError" class="mt-3 text-sm text-red-600">{{ forgotPasswordError }}</p>
            <p v-if="forgotPasswordMessage" class="mt-3 text-sm text-green-600">{{ forgotPasswordMessage }}</p>
            <div class="mt-6 flex justify-end gap-3"><button type="button" class="btn-secondary" :disabled="forgotPasswordLoading" @click="closeForgotPasswordModal">Đóng</button><button type="submit" class="btn-primary" :disabled="forgotPasswordLoading">{{ forgotPasswordLoading ? 'Đang gửi...' : 'Gửi liên kết' }}</button></div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { apiClient } from '../api/client'
import type { LoginCredentials } from '../types'
import axios from 'axios' // Import axios for API calls

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const credentials = ref<LoginCredentials>({
  username: '',
  password: ''
})

const rememberMe = ref(false)
const error = ref('')
const isLoading = ref(false)
const versionInfo = ref<any>(null)
const showForgotPasswordModal = ref(false)
const forgotPasswordEmail = ref('')
const forgotPasswordLoading = ref(false)
const forgotPasswordError = ref('')
const forgotPasswordMessage = ref('')

// The interceptor logic has been moved to a global location

// Fetch version information on component mount
onMounted(async () => {
  try {
    const response = await apiClient.getVersion()
    if (response && response.success) {
      versionInfo.value = response.data
    }
  } catch (err) {
    console.warn('Failed to fetch version info:', err)
  }

  // Try to restore user session if token exists
  await authStore.initializeAuth?.()
})

async function handleLogin() {
  error.value = ''
  isLoading.value = true
  try {
    const success = await authStore.login(credentials.value)
    if (success) {
      if (rememberMe.value) {
        localStorage.setItem('fm_rememberMe', 'true')
        localStorage.setItem('fm_username', credentials.value.username)
      } else {
        localStorage.removeItem('fm_rememberMe')
        localStorage.removeItem('fm_username')
      }
      router.push('/')
    } else {
      error.value = 'Invalid username or password'
    }
  } catch (err: any) {
    console.error('Login error:', err)
    
    // Handle specific timeout errors
    if (err.code === 'ECONNABORTED' && err.message?.includes('timeout')) {
      error.value = 'Connection timeout. The server may be starting up (this can take up to 60 seconds on first load). Please wait a moment and try again.'
    } else if (err.code === 'NETWORK_ERROR' || err.code === 'ERR_NETWORK') {
      error.value = 'Network connection error. Please check your internet connection and try again.'
    } else if (err.response?.status === 500) {
      error.value = 'Server error. The server may be starting up. Please wait a moment and try again.'
    } else if (err.response?.data?.error) {
      error.value = err.response.data.error
    } else {
      error.value = 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin và thử lại.'
    }
  } finally {
    isLoading.value = false
  }
}

function openForgotPasswordModal() {
  forgotPasswordEmail.value = ''
  forgotPasswordError.value = ''
  forgotPasswordMessage.value = ''
  showForgotPasswordModal.value = true
}

async function handleGuestLogin() {
  error.value = ''
  const success = await authStore.loginAsGuest()
  if (success) router.push('/weekly-tournament')
  else error.value = 'Không thể đăng nhập để xem. Vui lòng thử lại.'
}

function closeForgotPasswordModal() {
  if (!forgotPasswordLoading.value) showForgotPasswordModal.value = false
}

async function submitForgotPassword() {
  forgotPasswordLoading.value = true
  forgotPasswordError.value = ''
  forgotPasswordMessage.value = ''
  try {
    const response = await apiClient.forgotPassword(forgotPasswordEmail.value)
    if (!response.success) throw new Error(response.error || 'Không thể gửi liên kết đặt lại mật khẩu.')
    forgotPasswordMessage.value = response.message || 'Yêu cầu đổi mật khẩu đã được gửi. Vui lòng chờ quản trị viên cấp liên kết.'
  } catch (err: any) {
    forgotPasswordError.value = err.response?.data?.error || err.message || 'Không thể gửi liên kết đặt lại mật khẩu.'
  } finally {
    forgotPasswordLoading.value = false
  }
}

onMounted(() => {
  if (typeof route.query.username === 'string') {
    credentials.value.username = route.query.username
  }
  if (localStorage.getItem('fm_rememberMe') === 'true') {
    rememberMe.value = true
    credentials.value.username = credentials.value.username || localStorage.getItem('fm_username') || ''
  }
})
</script>
