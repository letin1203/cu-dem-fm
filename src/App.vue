<template>
  <div class="min-h-screen bg-gradient-to-br from-primary-50 via-secondary-50 to-primary-100">
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
import { computed } from 'vue'
import Navigation from './components/Navigation.vue'
import { useAuthStore } from './stores/auth'

const authStore = useAuthStore()
const isAuthenticated = computed(() => authStore.isAuthenticated)
</script>
