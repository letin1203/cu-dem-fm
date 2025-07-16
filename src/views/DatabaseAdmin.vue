<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold text-gray-900">Database Administration</h1>
      <div class="flex space-x-3">
        <button @click="refreshData" class="btn-secondary">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
          Refresh
        </button>
        <button @click="showExecuteQuery = true" class="btn-primary">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
          </svg>
          Execute Query
        </button>
      </div>
    </div>

    <!-- Database Overview -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="card p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-blue-100">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-1a6 6 0 01-4 5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Users</p>
            <p class="text-2xl font-semibold text-gray-900">{{ dbStats.users || 0 }}</p>
          </div>
        </div>
      </div>

      <div class="card p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-green-100">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Players</p>
            <p class="text-2xl font-semibold text-gray-900">{{ dbStats.players || 0 }}</p>
          </div>
        </div>
      </div>

      <div class="card p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-purple-100">
            <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Teams</p>
            <p class="text-2xl font-semibold text-gray-900">{{ dbStats.teams || 0 }}</p>
          </div>
        </div>
      </div>

      <div class="card p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-orange-100">
            <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Tournaments</p>
            <p class="text-2xl font-semibold text-gray-900">{{ dbStats.tournaments || 0 }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tables Tabs -->
    <div class="card">
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            v-for="table in availableTables"
            :key="table.name"
            @click="selectedTable = table.name"
            :class="[
              selectedTable === table.name
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'
            ]"
          >
            {{ table.label }}
          </button>
        </nav>
      </div>

      <!-- Table Content -->
      <div class="p-6">
        <div v-if="loading" class="flex justify-center items-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>

        <div v-else-if="error" class="text-center py-8">
          <div class="text-red-600 mb-2">{{ error }}</div>
          <button @click="loadTableData" class="btn-secondary">Try Again</button>
        </div>

        <div v-else-if="tableData.length === 0" class="text-center py-8">
          <p class="text-gray-500">No data found in {{ selectedTable }} table</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  v-for="column in tableColumns"
                  :key="column"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {{ column }}
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="(row, index) in tableData" :key="index" class="hover:bg-gray-50">
                <td
                  v-for="column in tableColumns"
                  :key="column"
                  class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                >
                  <div class="max-w-xs truncate" :title="formatCellValue(row[column])">
                    {{ formatCellValue(row[column]) }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="tableData.length > 0" class="flex items-center justify-between mt-6">
          <div class="text-sm text-gray-700">
            Showing {{ ((currentPage - 1) * pageSize) + 1 }} to 
            {{ Math.min(currentPage * pageSize, totalRecords) }} of {{ totalRecords }} results
          </div>
          <div class="flex space-x-2">
            <button
              @click="previousPage"
              :disabled="currentPage === 1"
              class="btn-secondary"
              :class="{ 'opacity-50 cursor-not-allowed': currentPage === 1 }"
            >
              Previous
            </button>
            <span class="flex items-center px-3 py-2 text-sm text-gray-700">
              Page {{ currentPage }} of {{ totalPages }}
            </span>
            <button
              @click="nextPage"
              :disabled="currentPage === totalPages"
              class="btn-secondary"
              :class="{ 'opacity-50 cursor-not-allowed': currentPage === totalPages }"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Execute Query Modal -->
    <div v-if="showExecuteQuery" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h2 class="text-lg font-semibold mb-4">Execute SQL Query</h2>
        
        <div class="space-y-4">
          <div>
            <label class="form-label">SQL Query</label>
            <textarea
              v-model="sqlQuery"
              rows="8"
              class="form-input font-mono text-sm"
              placeholder="SELECT * FROM users LIMIT 10;"
            ></textarea>
            <p class="text-sm text-gray-500 mt-1">
              ⚠️ Be careful with UPDATE/DELETE queries. This executes directly on the database.
            </p>
          </div>

          <!-- Query Result -->
          <div v-if="queryResult.length > 0" class="border rounded-lg p-4 bg-gray-50">
            <h3 class="text-sm font-medium text-gray-700 mb-2">Query Result:</h3>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-100">
                  <tr>
                    <th
                      v-for="column in queryResultColumns"
                      :key="column"
                      class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                    >
                      {{ column }}
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-for="(row, index) in queryResult" :key="index">
                    <td
                      v-for="column in queryResultColumns"
                      :key="column"
                      class="px-3 py-2 text-xs text-gray-900"
                    >
                      {{ formatCellValue(row[column]) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="queryError" class="border rounded-lg p-4 bg-red-50 border-red-200">
            <h3 class="text-sm font-medium text-red-700 mb-2">Query Error:</h3>
            <pre class="text-xs text-red-600 whitespace-pre-wrap">{{ queryError }}</pre>
          </div>
        </div>
        
        <div class="flex justify-end space-x-3 pt-4">
          <button @click="cancelQuery" class="btn-secondary">Cancel</button>
          <button @click="executeQuery" :disabled="!sqlQuery.trim()" class="btn-primary">
            Execute Query
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { apiClient } from '../api/client'

const dbStats = ref({
  users: 0,
  players: 0,
  teams: 0,
  tournaments: 0
})

const availableTables = [
  { name: 'users', label: 'Users' },
  { name: 'players', label: 'Players' },
  { name: 'teams', label: 'Teams' },
  { name: 'tournaments', label: 'Tournaments' },
  { name: 'matches', label: 'Matches' },
  { name: 'player_stats', label: 'Player Stats' },
  { name: 'system_settings', label: 'System Settings' },
  { name: 'additional_costs', label: 'Additional Costs' },
  { name: 'tournament_player_attendances', label: 'Tournament Attendances' }
]

const selectedTable = ref('users')
const tableData = ref([])
const tableColumns = ref([])
const loading = ref(false)
const error = ref<string | null>(null)

// Pagination
const currentPage = ref(1)
const pageSize = ref(50)
const totalRecords = ref(0)
const totalPages = computed(() => Math.ceil(totalRecords.value / pageSize.value))

// Query Modal
const showExecuteQuery = ref(false)
const sqlQuery = ref('')
const queryResult = ref([])
const queryResultColumns = ref([])
const queryError = ref<string | null>(null)

onMounted(async () => {
  await Promise.all([
    loadDbStats(),
    loadTableData()
  ])
})

watch(selectedTable, () => {
  currentPage.value = 1
  loadTableData()
})

async function loadDbStats() {
  try {
    const response = await apiClient.get('/database/stats')
    if (response.success && response.data) {
      dbStats.value = response.data as any
    }
  } catch (err) {
    console.error('Failed to load database stats:', err)
  }
}

async function loadTableData() {
  if (loading.value) return
  
  try {
    loading.value = true
    error.value = null
    
    const response = await apiClient.get(`/database/table/${selectedTable.value}`, {
      params: {
        page: currentPage.value,
        limit: pageSize.value
      }
    })
    
    if (response.success && response.data) {
      const data = response.data as any
      tableData.value = data.data || []
      tableColumns.value = data.columns || []
      totalRecords.value = data.total || 0
    }
  } catch (err) {
    error.value = 'Failed to load table data'
    console.error('Load table data error:', err)
  } finally {
    loading.value = false
  }
}

async function executeQuery() {
  if (!sqlQuery.value.trim()) return
  
  try {
    queryError.value = null
    queryResult.value = []
    queryResultColumns.value = []
    
    const response = await apiClient.post('/database/query', {
      query: sqlQuery.value
    })
    
    if (response.success && response.data) {
      const data = response.data as any
      queryResult.value = data.data || []
      queryResultColumns.value = data.columns || []
      
      // Refresh stats and current table data if it was a modifying query
      const isModifyingQuery = /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(sqlQuery.value)
      if (isModifyingQuery) {
        await Promise.all([
          loadDbStats(),
          loadTableData()
        ])
      }
    }
  } catch (err: any) {
    queryError.value = err.response?.data?.error || 'Failed to execute query'
    console.error('Execute query error:', err)
  }
}

function cancelQuery() {
  showExecuteQuery.value = false
  sqlQuery.value = ''
  queryResult.value = []
  queryResultColumns.value = []
  queryError.value = null
}

function refreshData() {
  Promise.all([
    loadDbStats(),
    loadTableData()
  ])
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    loadTableData()
  }
}

function previousPage() {
  if (currentPage.value > 1) {
    currentPage.value--
    loadTableData()
  }
}

function formatCellValue(value: any): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'string' && value.length > 100) {
    return value.substring(0, 100) + '...'
  }
  return String(value)
}
</script>
