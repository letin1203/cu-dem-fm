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
          Sign in to Football Manager
        </h2>
        <p class="mt-2 text-center text-sm text-primary-700">
          Enter your credentials to access the application
        </p>
      </div>
      
      <form class="mt-8 space-y-6 bg-white/80 backdrop-blur-sm rounded-lg p-6 shadow-lg border border-primary-200" @submit.prevent="handleLogin">
        <div class="rounded-md shadow-sm -space-y-px">
          <div>
            <label for="username" class="sr-only">Username</label>
            <input
              id="username"
              v-model="credentials.username"
              name="username"
              type="text"
              required
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-primary-300 placeholder-primary-400 text-primary-900 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
              placeholder="Username"
            >
          </div>
          <div>
            <label for="password" class="sr-only">Password</label>
            <input
              id="password"
              v-model="credentials.password"
              name="password"
              type="password"
              required
              class="appearance-none rounded-none relative block w-full px-3 py-2 border border-primary-300 placeholder-primary-400 text-primary-900 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
              placeholder="Password"
            >
          </div>
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
            <span v-if="!isLoading">Sign in</span>
            <span v-else class="flex items-center">
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Signing in...
            </span>
          </button>
        </div>

        <!-- Demo credentials -->
        <div class="mt-6 border-t border-gray-200 pt-6">
          <h3 class="text-sm font-medium text-gray-900 mb-3">Demo Accounts:</h3>
          <div class="space-y-2 text-xs text-gray-600">
            <div class="flex justify-between">
              <span class="font-medium">Admin:</span>
              <span>admin / admin123</span>
            </div>
            <div class="flex justify-between">
              <span class="font-medium">Moderator:</span>
              <span>moderator / mod123</span>
            </div>
            <div class="flex justify-between">
              <span class="font-medium">User:</span>
              <span>player1 / user123</span>
            </div>
          </div>
          <div class="mt-3 space-y-1">
            <button
              type="button"
              @click="setDemoCredentials('admin', 'admin123')"
              class="text-xs text-primary-600 hover:text-primary-800 mr-4"
            >
              Use Admin
            </button>
            <button
              type="button"
              @click="setDemoCredentials('moderator', 'mod123')"
              class="text-xs text-primary-600 hover:text-primary-800 mr-4"
            >
              Use Mod
            </button>
            <button
              type="button"
              @click="setDemoCredentials('player1', 'user123')"
              class="text-xs text-primary-600 hover:text-primary-800"
            >
              Use User
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import type { LoginCredentials } from '../types'

const router = useRouter()
const authStore = useAuthStore()

const credentials = ref<LoginCredentials>({
  username: '',
  password: ''
})

const error = ref('')
const isLoading = ref(false)

async function handleLogin() {
  error.value = ''
  isLoading.value = true
  
  try {
    const success = await authStore.login(credentials.value)
    
    if (success) {
      router.push('/')
    } else {
      error.value = 'Invalid username or password'
    }
  } catch (err) {
    error.value = 'An error occurred during login'
  } finally {
    isLoading.value = false
  }
}

function setDemoCredentials(username: string, password: string) {
  credentials.value.username = username
  credentials.value.password = password
}
</script>
