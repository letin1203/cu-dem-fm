<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Cài đặt hệ thống</h1>
    </div>

    <!-- Settings Form -->
    <div class="card">
      <h2 class="text-lg font-semibold text-gray-900 mb-6">Cài đặt tài chính chung</h2>
      
      <!-- Loading State -->
      <div v-if="systemStore.isLoading" class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
      
      <!-- Error State -->
      <div v-else-if="systemStore.error" class="text-center py-8">
        <div class="text-red-600 mb-2">{{ systemStore.error }}</div>
        <button @click="systemStore.fetchSystemSettings()" class="btn-secondary">
          Thử lại
        </button>
      </div>
      
      <!-- Settings Form -->
      <form v-else @submit.prevent="updateSettings" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Stadium Cost -->
          <div>
            <label class="form-label">
              Chi phí sân
              <span class="text-sm text-gray-500">(Giải hằng tuần)</span>
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₫</span>
              <input
                v-model.number="formData.stadiumCost"
                type="number"
                required
                min="0"
                class="form-input pl-8"
                placeholder="10000"
              >
            </div>
            <p class="text-xs text-gray-500 mt-1">
              Chi phí thuê sân mặc định cho mỗi giải hằng tuần
            </p>
          </div>
          
          <!-- Sponsor Money -->
          <div>
            <label class="form-label">
              Tiền tài trợ
              <span class="text-sm text-gray-500">(Giải hằng tuần)</span>
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₫</span>
              <input
                v-model.number="formData.sponsorMoney"
                type="number"
                required
                min="0"
                class="form-input pl-8"
                placeholder="50000"
              >
            </div>
            <p class="text-xs text-gray-500 mt-1">
              Khoản tài trợ mặc định cho mỗi giải hằng tuần
            </p>
          </div>
          
        </div>
        
        <!-- Financial Summary -->
        <div class="bg-gray-50 rounded-lg p-4">
          <h3 class="font-medium text-gray-900 mb-3">Tổng quan tài chính</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">Thu nhập giải hằng tuần:</span>
              <span class="font-medium">{{ formData.sponsorMoney.toLocaleString('vi-VN') }} ₫</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Chi phí giải hằng tuần:</span>
              <span class="font-medium">{{ formData.stadiumCost.toLocaleString('vi-VN') }} ₫</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Chênh lệch mỗi giải:</span>
              <span class="font-medium" :class="netPerTournament >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ netPerTournament.toLocaleString('vi-VN') }} ₫
              </span>
            </div>
          </div>
        </div>
        
        <!-- Actions -->
        <div class="flex justify-end">
          <button
            type="submit"
            :disabled="systemStore.isLoading"
            class="btn-primary"
          >
            {{ systemStore.isLoading ? 'Đang lưu...' : 'Lưu cài đặt' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useSystemStore } from '../stores/system'

const toast = useToast()
const systemStore = useSystemStore()

const formData = ref({
  stadiumCost: 10000,
  sponsorMoney: 50000
})

// Computed
const netPerTournament = computed(() => 
  formData.value.sponsorMoney - formData.value.stadiumCost
)

// Watch for settings changes to update form
watch(
  () => systemStore.currentSettings,
  (settings) => {
    if (settings) {
      formData.value = {
        stadiumCost: settings.stadiumCost,
        sponsorMoney: settings.sponsorMoney
      }
    }
  },
  { immediate: true }
)

// Methods
async function updateSettings() {
  const success = await systemStore.updateSystemSettings(formData.value)
  if (success) {
    toast.success('Đã cập nhật cài đặt')
  } else {
    toast.error('Không thể cập nhật cài đặt. Vui lòng thử lại.')
  }
}

// Initialize
onMounted(async () => {
  await systemStore.fetchSystemSettings()
})
</script>
