<template>
  <div class="min-h-screen bg-gray-50">
    <Navigation v-if="authStore.isAuthenticated" />
    <main 
      :class="[
        'w-full mx-auto',
        authStore.isAuthenticated 
          ? 'py-4 px-4 sm:py-6 sm:px-6 lg:px-8 max-w-7xl' 
          : ''
      ]"
    >
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import Navigation from './components/Navigation.vue'
import { useAuthStore } from './stores/auth'

const authStore = useAuthStore()

onMounted(() => {
  // Initialize authentication state from localStorage
  authStore.initializeAuth()
})
</script>
