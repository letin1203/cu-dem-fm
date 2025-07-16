<template>
  <div class="card">
    <div class="flex items-center">
      <div class="flex-shrink-0">
        <div :class="iconClasses">
          <component :is="iconComponent" class="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
      </div>
      <div class="ml-3 sm:ml-4 min-w-0 flex-1">
        <div class="text-xs sm:text-sm font-medium text-gray-500 truncate">
          {{ title }}
        </div>
        <div class="text-lg sm:text-2xl font-semibold text-gray-900">
          {{ formattedValue }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  UserGroupIcon,
  UsersIcon,
  TrophyIcon,
  CalendarIcon,
  ChartBarIcon
} from '@heroicons/vue/24/outline'

interface Props {
  title: string
  value: number | string
  icon: string
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
}

const props = defineProps<Props>()

const iconComponent = computed(() => {
  const icons = {
    UserGroupIcon,
    UsersIcon,
    TrophyIcon,
    CalendarIcon,
    ChartBarIcon
  }
  return icons[props.icon as keyof typeof icons] || ChartBarIcon
})

const iconClasses = computed(() => {
  const baseClasses = 'p-2 rounded-lg'
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600'
  }
  return `${baseClasses} ${colorClasses[props.color]}`
})

const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    return props.value.toLocaleString()
  }
  return props.value
})
</script>
