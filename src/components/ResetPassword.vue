<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-secondary-50 to-primary-100 px-4 py-12">
    <div class="w-full max-w-md rounded-lg border border-primary-200 bg-white/80 p-6 shadow-lg backdrop-blur-sm">
      <h1 class="text-center text-2xl font-bold text-primary-900">Đặt lại mật khẩu</h1>
      <p class="mt-2 text-center text-sm text-gray-600">Tạo mật khẩu mới cho tài khoản <strong>{{ username || 'của bạn' }}</strong>. Sau đó bạn có thể đăng nhập bằng tên đăng nhập hoặc email.</p>

      <form v-if="token && !successMessage" class="mt-6 space-y-4" @submit.prevent="submitResetPassword">
        <div><label for="new-password" class="form-label">Mật khẩu mới</label><div class="relative"><input id="new-password" v-model="password" :type="revealPassword ? 'text' : 'password'" required minlength="6" class="form-input mt-1 pr-12" placeholder="Ít nhất 6 ký tự"><button type="button" class="absolute inset-y-0 right-0 mt-1 px-3 text-gray-500" :aria-label="revealPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'" @click="revealPassword = !revealPassword">{{ revealPassword ? '🙈' : '👁' }}</button></div></div>
        <div v-if="!revealPassword"><label for="confirm-password" class="form-label">Xác nhận mật khẩu mới</label><input id="confirm-password" v-model="confirmPassword" type="password" required minlength="6" class="form-input mt-1" placeholder="Nhập lại mật khẩu"></div>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <button type="submit" class="btn-primary w-full" :disabled="loading">{{ loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu' }}</button>
      </form>

      <p v-else-if="successMessage" class="mt-6 rounded-lg bg-green-50 p-4 text-sm text-green-700">{{ successMessage }}</p>
      <p v-else class="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">Liên kết đặt lại mật khẩu không hợp lệ.</p>

      <button type="button" class="mt-6 block w-full text-center text-sm font-medium text-primary-600 hover:text-primary-800" @click="backToLogin">Quay lại đăng nhập</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiClient } from '../api/client'

const route = useRoute()
const router = useRouter()
const token = typeof route.query.token === 'string' ? route.query.token : ''
const username = typeof route.query.username === 'string' ? route.query.username : ''
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const successMessage = ref('')
const revealPassword = ref(false)

async function submitResetPassword() {
  error.value = ''
  if (!revealPassword.value && password.value !== confirmPassword.value) {
    error.value = 'Mật khẩu xác nhận không khớp.'
    return
  }

  loading.value = true
  try {
    const response = await apiClient.resetPassword(token, password.value)
    if (!response.success) throw new Error(response.error || 'Không thể đặt lại mật khẩu.')
    successMessage.value = response.message || 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.'
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message || 'Không thể đặt lại mật khẩu.'
  } finally {
    loading.value = false
  }
}

function backToLogin() {
  router.push({ path: '/login', query: username ? { username } : {} })
}
</script>
