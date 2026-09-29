<template>
  <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Stats</h1>
      <p class="mt-1 text-sm text-gray-500">Bảng xếp hạng cầu thủ từ các giải đấu đã hoàn thành.</p>
    </div>

    <div class="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <p class="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Cầu thủ</p>
        <div class="flex gap-2 overflow-x-auto lg:block lg:space-y-1">
          <button
            v-for="criterion in criteria"
            :key="criterion.id"
            type="button"
            class="flex shrink-0 items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors lg:w-full"
            :class="selectedCriterion === criterion.id ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-700 hover:bg-primary-50 hover:text-primary-700'"
            @click="selectedCriterion = criterion.id"
          >
            <span class="text-lg">{{ criterion.icon }}</span>
            {{ criterion.label }}
          </button>
        </div>
      </aside>

      <main class="min-w-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-bold text-gray-900">{{ activeCriterion.label }}</h2>
            <p class="mt-1 text-sm text-gray-500">
              <template v-if="selectedCriterion === 'contributions'">
                Top 10 cầu thủ <strong class="font-semibold text-gray-700">“góp quỹ”</strong> nhiều nhất
              </template>
              <template v-else>Top 10 cầu thủ {{ activeCriterion.description }}</template>
            </p>
          </div>
          <button type="button" class="btn-secondary text-sm" :disabled="loading" @click="loadLeaderboard">Làm mới</button>
        </div>

        <div v-if="loading" class="flex justify-center py-20"><div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600"></div></div>
        <p v-else-if="error" class="py-12 text-center text-red-600">{{ error }}</p>
        <template v-else>
          <div class="mt-8 grid gap-4 sm:grid-cols-3">
            <article
              v-for="entry in podiumEntries"
              :key="entry.player.id"
              class="relative flex min-h-48 flex-col items-center justify-center rounded-xl border p-5 text-center"
              :class="podiumClass(entry.rank)"
            >
              <span class="absolute left-4 top-4 text-2xl">{{ medal(entry.rank) }}</span>
              <span class="rounded-full px-2 py-1 text-xs font-bold" :class="rankBadgeClass(entry.rank)">TOP {{ entry.rank }}</span>
              <div class="mt-3 h-16 w-16 overflow-hidden rounded-full bg-gray-200 ring-4 ring-white shadow">
                <img v-if="entry.player.avatar" :src="entry.player.avatar" :alt="entry.player.name" class="h-full w-full object-cover">
                <span v-else class="flex h-full w-full items-center justify-center text-xl font-bold text-gray-500">{{ entry.player.name.charAt(0) }}</span>
              </div>
              <p class="mt-3 max-w-full truncate font-semibold text-gray-900">{{ entry.player.name }}</p>
              <p class="mt-1 text-lg font-bold" :class="rankTextClass(entry.rank)">{{ displayValue(entry.value) }}</p>
            </article>
          </div>

          <div v-if="remainingEntries.length" class="mt-6 overflow-hidden rounded-xl border border-gray-200">
            <div v-for="entry in remainingEntries" :key="entry.player.id" class="flex items-center gap-3 border-b border-gray-100 p-3 last:border-b-0">
              <span class="w-7 text-center text-sm font-bold text-gray-500">{{ entry.rank }}</span>
              <div class="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-200">
                <img v-if="entry.player.avatar" :src="entry.player.avatar" :alt="entry.player.name" class="h-full w-full object-cover">
                <span v-else class="flex h-full w-full items-center justify-center font-semibold text-gray-500">{{ entry.player.name.charAt(0) }}</span>
              </div>
              <div class="min-w-0 flex-1"><p class="truncate font-medium text-gray-900">{{ entry.player.name }}</p><p class="text-xs text-gray-500">{{ entry.player.position }} · Tier {{ entry.player.tier }}</p></div>
              <strong class="whitespace-nowrap text-primary-700">{{ displayValue(entry.value) }}</strong>
            </div>
          </div>
          <p v-else-if="!currentEntries.length" class="py-12 text-center text-gray-500">Chưa có dữ liệu thống kê.</p>
        </template>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiClient } from '../api/client'

type CriterionId = 'wins' | 'losses' | 'contributions' | 'attendance'
type LeaderboardEntry = {
  rank: number
  value: number
  player: { id: string; name: string; avatar?: string | null; position: string; tier: number }
}

const criteria: Array<{ id: CriterionId; label: string; description: string; icon: string }> = [
  { id: 'wins', label: 'Win nhiều', description: 'có số lần thắng giải nhiều nhất', icon: '🏆' },
  { id: 'losses', label: 'Thua nhiều', description: 'có số lần thua giải nhiều nhất', icon: '💔' },
  { id: 'contributions', label: 'Góp quỹ', description: 'góp quỹ nhiều nhất', icon: '💰' },
  { id: 'attendance', label: 'Tham gia', description: 'tham gia giải nhiều nhất', icon: '🙋' },
]

const selectedCriterion = ref<CriterionId>('wins')
const loading = ref(true)
const error = ref('')
const leaderboards = ref<Record<CriterionId, LeaderboardEntry[]>>({ wins: [], losses: [], contributions: [], attendance: [] })
const activeCriterion = computed(() => criteria.find((criterion) => criterion.id === selectedCriterion.value)!)
const currentEntries = computed(() => leaderboards.value[selectedCriterion.value] || [])
const podiumEntries = computed(() => {
  const entries = currentEntries.value.slice(0, 3)
  // Display silver, gold, bronze so the winner stands in the centre of the podium.
  return [entries[1], entries[0], entries[2]].filter(Boolean) as LeaderboardEntry[]
})
const remainingEntries = computed(() => currentEntries.value.slice(3, 10))

const medal = (rank: number) => ['🥇', '🥈', '🥉'][rank - 1] || ''
const rankBadgeClass = (rank: number) => rank === 1 ? 'bg-amber-100 text-amber-800' : rank === 2 ? 'bg-slate-100 text-slate-700' : 'bg-orange-100 text-orange-800'
const rankTextClass = (rank: number) => rank === 1 ? 'text-amber-600' : rank === 2 ? 'text-slate-600' : 'text-orange-700'
const podiumClass = (rank: number) => rank === 1 ? 'border-amber-300 bg-amber-50 sm:-translate-y-3' : rank === 2 ? 'border-slate-300 bg-slate-50' : 'border-orange-300 bg-orange-50'
const displayValue = (value: number) => selectedCriterion.value === 'contributions' ? `${value.toLocaleString('vi-VN')} ₫` : `${value} lần`

async function loadLeaderboard() {
  loading.value = true
  error.value = ''
  try {
    const response = await apiClient.getPlayerLeaderboard()
    if (!response.success || !response.data) throw new Error(response.error || 'Không thể tải bảng xếp hạng')
    const data = response.data as Partial<Record<CriterionId, LeaderboardEntry[]>>
    leaderboards.value = {
      wins: Array.isArray(data.wins) ? data.wins : [],
      losses: Array.isArray(data.losses) ? data.losses : [],
      contributions: Array.isArray(data.contributions) ? data.contributions : [],
      attendance: Array.isArray(data.attendance) ? data.attendance : [],
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Không thể tải bảng xếp hạng'
  } finally {
    loading.value = false
  }
}

onMounted(loadLeaderboard)
</script>
