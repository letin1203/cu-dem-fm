<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Weekly Tournament</h1>
      <button 
        v-if="authStore.hasPermission('canEditTournaments') && canCreateNew"
        @click="createWeeklyTournament" 
        :disabled="loading"
        class="btn-primary w-full sm:w-auto"
        :class="{ 'opacity-50 cursor-not-allowed': loading }"
      >
        {{ loading ? 'Creating...' : 'Create New' }}
      </button>
      <div v-else-if="authStore.hasPermission('canEditTournaments')" class="text-sm text-gray-500">
        Weekly tournament already exists for {{ formatNextMonday(nextMonday) }}
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="border-b border-gray-200">
      <nav class="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
        <button
          v-for="filter in filters"
          :key="filter"
          @click="activeFilter = filter"
          :class="[
            'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0',
            activeFilter === filter
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          {{ filter }}
        </button>
      </nav>
    </div>

    <!-- Loading State -->
    <div v-if="tournamentsStore.loading" class="text-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
      <p class="mt-2 text-gray-600">Loading tournaments...</p>
    </div>

    <!-- Tournaments Content -->
    <div v-else>
      <!-- Ongoing Tournament Tab -->
      <div v-if="activeFilter === 'Ongoing'">
        <div v-if="ongoingTournament" 
             class="card transition-colors duration-200"
             :class="getCardBackgroundClass(ongoingTournament.id)">
          <div class="flex flex-col space-y-4">
            <!-- Tournament Info -->
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0">
              <div class="flex-1">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <h3 class="text-lg font-semibold text-gray-900">{{ ongoingTournament.name }}</h3>
                </div>
                <!-- Badge and Date/Time moved below title -->
                <div class="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-600">
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                        :class="getStatusBadge(ongoingTournament.status)">
                    {{ ongoingTournament.status }}
                  </span>
                  <span>{{ formatDate(ongoingTournament.startDate) }}</span>
                  <span>{{ formatTime(ongoingTournament.startDate) }}</span>
                </div>
                <!-- Action buttons moved to top right -->
                  <div class="flex items-center justify-end space-x-2 mt-2 sm:mt-0">
                    <button
                      v-if="authStore.hasRole('admin')"
                      @click="openAdditionalCostModal(ongoingTournament)"
                      class="text-green-600 hover:text-green-800"
                      title="Manage Additional Costs"
                    >
                      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </button>
                    <button
                      v-if="authStore.hasPermission('canDeleteTournaments')"
                      @click="deleteTournament(ongoingTournament.id)"
                      class="text-red-600 hover:text-red-800"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                <!-- Financial Information -->
                <div v-if="systemStore.currentSettings" class="flex flex-wrap items-center gap-4 mt-2 text-sm">
                  <span class="text-green-600 font-medium">
                    💰 Sponsor: ${{ systemStore.currentSettings.sponsorMoney.toLocaleString() }}
                  </span>
                  <span class="text-red-600 font-medium">
                    🏟️ Stadium: ${{ systemStore.currentSettings.stadiumCost.toLocaleString() }}
                  </span>
                  <span class="text-orange-600 font-medium">
                    💸 Additional: ${{ getTournamentAdditionalCostsTotal(ongoingTournament.id).toLocaleString() }}
                  </span>
                  <span class="text-blue-600 font-medium">
                    📊 Net: -${{ calculateTournamentNet(ongoingTournament.id).toLocaleString() }}
                  </span>
                  <span v-if="getAttendanceStats(ongoingTournament.id)?.attendingCount" class="text-purple-600 font-medium">
                    👥 Est. Cost per Player: -${{ calculateCostPerPlayer(ongoingTournament.id).toLocaleString() }}
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Attendance Progress Bar -->
            <div v-if="attendanceStats.has(ongoingTournament.id)" class="mt-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-gray-200">
              <div class="flex justify-between items-center mb-3">
                <span class="text-sm font-semibold text-gray-800">Player Attendance</span>
                <span class="text-sm font-medium text-gray-700 bg-white px-2 py-1 rounded-full">
                  {{ getAttendanceStats(ongoingTournament.id)?.attendingCount || 0 }} / {{ getAttendanceStats(ongoingTournament.id)?.totalPlayers || 0 }}
                </span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-4 mb-3 shadow-inner">
                <div 
                  class="bg-gradient-to-r from-green-500 to-green-600 h-4 rounded-full transition-all duration-700 ease-out shadow-sm relative overflow-hidden"
                  :style="{ width: `${getAttendancePercentage(ongoingTournament.id)}%` }"
                >
                  <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-2 text-xs">
                <button 
                  @click="openAttendanceModal(ongoingTournament.id, 'attending')"
                  class="text-center p-2 bg-green-100 rounded-lg hover:bg-green-200 transition-colors cursor-pointer"
                >
                  <div class="font-semibold text-green-800">{{ getAttendanceStats(ongoingTournament.id)?.attendingCount || 0 }}</div>
                  <div class="text-green-600">Attending</div>
                </button>
                <button 
                  @click="openAttendanceModal(ongoingTournament.id, 'not-attending')"
                  class="text-center p-2 bg-red-100 rounded-lg hover:bg-red-200 transition-colors cursor-pointer"
                >
                  <div class="font-semibold text-red-800">{{ getAttendanceStats(ongoingTournament.id)?.notAttendingCount || 0 }}</div>
                  <div class="text-red-600">Not Attending</div>
                </button>
                <button 
                  @click="openAttendanceModal(ongoingTournament.id, 'betting')"
                  class="text-center p-2 bg-yellow-100 rounded-lg hover:bg-yellow-200 transition-colors cursor-pointer"
                >
                  <div class="font-semibold text-yellow-800">{{ getBettingCount(ongoingTournament.id) }}</div>
                  <div class="text-yellow-600">Betting</div>
                </button>
              </div>
            </div>

            <!-- Tournament Teams Display -->
            <div v-if="getTournamentTeams(ongoingTournament).length > 0" class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 class="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.196-2.196M5 20h5v-2a3 3 0 015.196-2.196M12 4v.01M12 4a7 7 0 018 7c0 2-1 3-1 3s-1 1-1 3v2H8v-2s-1-1-1-3c0-2 1-3 1-3a7 7 0 018-7z" />
                </svg>
                Tournament Teams ({{ getTournamentTeams(ongoingTournament).length }})
              </h4>
              
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <div
                  v-for="team in getTournamentTeams(ongoingTournament)"
                  :key="team.id"
                  class="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <!-- Team Header -->
                  <div class="flex items-center mb-3">
                    <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                      <span class="text-white font-bold text-lg">{{ getTeamNumber(team.name) }}</span>
                    </div>
                    <div class="flex-1">
                      <div class="flex items-center justify-between">
                        <h5 class="font-semibold text-gray-900">{{ team.name }}</h5>
                        <span v-if="ongoingTournament.status === 'ONGOING'" class="text-lg font-bold text-blue-600 flex items-center">
                          ⚽: {{ team.score || 0 }}
                        </span>
                      </div>
                      <p class="text-sm text-gray-600">{{ team.players?.length || 0 }} players</p>
                    </div>
                  </div>

                  <!-- Team Players -->
                  <div v-if="team.players && team.players.length > 0" class="space-y-2">
                    <div
                      v-for="player in team.players"
                      :key="player.id"
                      class="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                    >
                      <div class="flex items-center">
                        <div class="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center mr-2 text-xs font-medium">
                          {{ player.name.charAt(0).toUpperCase() }}
                        </div>
                        <span class="font-medium text-gray-900">{{ player.name }}</span>
                      </div>
                      <div class="flex items-center text-gray-600">
                        <span class="text-xs mr-1">{{ player.position }}</span>
                        <span class="text-xs">T{{ player.tier }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Team Stats -->
                  <div v-if="team.players && team.players.length > 0" class="mt-3 pt-3 border-t border-gray-200">
                    <div class="flex justify-between text-xs text-gray-600">
                      <span>Total Tier: {{ team.players.reduce((sum: number, p: any) => sum + p.tier, 0) }}</span>
                      <span>Avg: {{ (team.players.reduce((sum: number, p: any) => sum + p.tier, 0) / team.players.length).toFixed(1) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Attendance Toggle Button -->
            <div v-if="ongoingTournament.status === 'UPCOMING' && getAttendanceButtonText(ongoingTournament.id) !== 'No Player'" class="flex justify-center pt-2 border-t border-gray-200">
              <div class="flex space-x-3">
                <button
                  @click="toggleAttendance(ongoingTournament.id)"
                  :disabled="attendanceLoading.has(ongoingTournament.id)"
                  class="px-6 py-2 rounded-lg font-medium transition-colors duration-200"
                  :class="[
                    attendanceLoading.has(ongoingTournament.id)
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:shadow-md',
                    getAttendanceButtonText(ongoingTournament.id) === 'Attend'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : getAttendanceButtonText(ongoingTournament.id) === 'Attended'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  ]"
                >
                  <div class="flex items-center space-x-1">
                    <span>{{ attendanceLoading.has(ongoingTournament.id) ? 'Loading...' : getAttendanceButtonText(ongoingTournament.id) }}</span>
                    <!-- Check icon (only shown when attended) -->
                    <svg 
                      v-if="getAttendanceButtonText(ongoingTournament.id) === 'Attended'" 
                      class="w-4 h-4" 
                      fill="currentColor" 
                      viewBox="0 0 20 20"
                    >
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                  </div>
                </button>
                
                <!-- Water Button -->
                <button
                  v-if="getUserAttendanceStatus(ongoingTournament.id) === 'ATTEND'"
                  @click="toggleWater(ongoingTournament.id)"
                  :disabled="waterLoading.has(ongoingTournament.id)"
                  class="px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                  :class="[
                    waterLoading.has(ongoingTournament.id)
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:shadow-md',
                    getUserWaterStatus(ongoingTournament.id)
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  ]"
                >
                  <div class="flex items-center space-x-1">
                    <span>{{ waterLoading.has(ongoingTournament.id) ? 'Loading...' : (getUserWaterStatus(ongoingTournament.id) ? 'Water ✓' : 'Water') }}</span>
                  </div>
                </button>
                
                <!-- Bet Button -->
                <button
                  v-if="getUserAttendanceStatus(ongoingTournament.id) === 'ATTEND'"
                  @click="toggleBet(ongoingTournament.id)"
                  :disabled="betLoading.has(ongoingTournament.id)"
                  class="px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                  :class="[
                    betLoading.has(ongoingTournament.id)
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:shadow-md',
                    getUserBetStatus(ongoingTournament.id)
                      ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  ]"
                >
                  <div class="flex items-center space-x-1">
                    <span>{{ betLoading.has(ongoingTournament.id) ? 'Loading...' : (getUserBetStatus(ongoingTournament.id) ? 'Bet ✓' : 'Bet') }}</span>
                  </div>
                </button>
              </div>
            </div>
            
            <!-- Random Team Button (Admin/Mod only) -->
            <div class="flex flex-col items-center pt-2 border-t border-gray-200">
              <div class="flex space-x-3">
                <button
                  v-if="authStore.hasPermission('canEditTournaments') && getTournamentTeams(ongoingTournament).length === 0" 
                  @click="generateRandomTeams(ongoingTournament.id)"
                  :disabled="!canGenerateTeams(ongoingTournament.id) || teamGenerationLoading"
                  class="px-6 py-2 rounded-lg font-medium transition-colors duration-200"
                  :class="[
                    !canGenerateTeams(ongoingTournament.id) || teamGenerationLoading
                      ? 'opacity-50 cursor-not-allowed bg-gray-400 text-white' 
                      : 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md'
                  ]"
                >
                  {{ teamGenerationLoading ? 'Generating...' : 'Random Team' }}
                </button>
                <button
                  v-if="authStore.hasPermission('canEditTournaments') && ongoingTournament.status === 'UPCOMING' && getTournamentTeams(ongoingTournament).length > 0"
                  @click="openClearTeamsModal(ongoingTournament.id)"
                  class="px-6 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 hover:shadow-md transition-colors duration-200"
                >
                  Clear Teams
                </button>
                <button
                  v-if="authStore.hasPermission('canEditTournaments') && ongoingTournament.status === 'UPCOMING' && getTournamentTeams(ongoingTournament).length > 0"
                  @click="startTournament(ongoingTournament.id)"
                  class="px-6 py-2 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 hover:shadow-md transition-colors duration-200"
                >
                  Start Tournament
                </button>
                <button
                  v-if="authStore.hasPermission('canEditTournaments') && ongoingTournament.status === 'ONGOING' && getTournamentTeams(ongoingTournament).length > 0"
                  @click="openScoresModal(ongoingTournament.id)"
                  class="px-6 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md transition-colors duration-200"
                >
                  Scores
                </button>
                <button
                  v-if="authStore.hasRole('admin') && ongoingTournament.status === 'ONGOING'"
                  @click="endTournament(ongoingTournament.id)"
                  :disabled="!canEndTournament(ongoingTournament.id)"
                  :class="[
                    'px-6 py-2 rounded-lg font-medium transition-colors duration-200',
                    canEndTournament(ongoingTournament.id) 
                      ? 'bg-red-600 text-white hover:bg-red-700 hover:shadow-md' 
                      : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  ]"
                >
                  End Tournament
                </button>
              </div>
              <div class="text-xs text-gray-500 mt-1 text-center">
                <span v-if="!canGenerateTeams(ongoingTournament.id)">
                  Need {{ 10 - (getAttendanceStats(ongoingTournament.id)?.attendingCount || 0) }} more attending players
                </span>
                <span v-if="authStore.hasPermission('canEditTournaments') && getTournamentTeams(ongoingTournament).length === 0">
                  Will create {{ getTeamCount(ongoingTournament.id) }} balanced teams
                </span>
                <span v-if="authStore.hasRole('admin') && ongoingTournament.status === 'ONGOING' && !canEndTournament(ongoingTournament.id)" class="text-orange-600">
                  {{ getTournamentEndStatusMessage(ongoingTournament.id) }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-8">
          <p class="text-gray-600">No ongoing weekly tournament</p>
          <p class="text-sm text-gray-500 mt-1">Next tournament: {{ formatNextMonday(nextMonday) }}</p>
        </div>
      </div>

      <!-- Old Tournaments Tab -->
      <div v-else-if="activeFilter === 'Old Tournament'">
        <div class="space-y-3 sm:space-y-4">
          <div
            v-for="tournament in oldTournaments"
            :key="tournament.id"
            class="card transition-colors duration-200"
            :class="getCardBackgroundClass(tournament.id)"
          >
            <div class="flex flex-col space-y-4">
              <!-- Tournament Info -->
              <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0">
                <div class="flex-1">
                  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <h3 class="text-lg font-semibold text-gray-900">{{ tournament.name }}</h3>
                    <!-- Action buttons moved to top right - hide money icon if no teams -->
                    <div class="flex items-center space-x-2 mt-2 sm:mt-0">
                      <button
                        v-if="authStore.hasRole('admin') && getTournamentTeams(tournament).length > 0"
                        @click="openAdditionalCostModal(tournament)"
                        class="text-green-600 hover:text-green-800"
                        title="Manage Additional Costs"
                      >
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </button>
                      <button
                        v-if="authStore.hasPermission('canDeleteTournaments')"
                        @click="deleteTournament(tournament.id)"
                        class="text-red-600 hover:text-red-800"
                      >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <!-- Badge and Date/Time moved below title -->
                  <div class="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-600">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                          :class="getStatusBadge(tournament.status)">
                      {{ tournament.status }}
                    </span>
                    <span>{{ formatDate(tournament.startDate) }}</span>
                    <span>{{ formatTime(tournament.startDate) }}</span>
                    <span v-if="tournament.winner" class="text-yellow-600 font-medium">
                      🏆 {{ tournament.winner.name }}
                    </span>
                  </div>
                  <!-- Financial Information or Postponed Status -->
                  <div v-if="getTournamentTeams(tournament).length > 0" class="mt-2">
                    <div v-if="systemStore.currentSettings" class="flex flex-wrap items-center gap-4 text-sm">
                      <span class="text-green-600 font-medium">
                        💰 Sponsor: ${{ systemStore.currentSettings.sponsorMoney.toLocaleString() }}
                      </span>
                      <span class="text-red-600 font-medium">
                        🏟️ Stadium: ${{ systemStore.currentSettings.stadiumCost.toLocaleString() }}
                      </span>
                      <span class="text-orange-600 font-medium">
                        💸 Additional: ${{ getTournamentAdditionalCostsTotal(tournament.id).toLocaleString() }}
                      </span>
                      <span class="text-blue-600 font-medium">
                        📊 Net: ${{ calculateTournamentNet(tournament.id).toLocaleString() }}
                      </span>
                      <span v-if="getAttendanceStats(tournament.id)?.attendingCount" class="text-purple-600 font-medium">
                        👥 Est. Cost per Player: ${{ calculateCostPerPlayer(tournament.id).toLocaleString() }}
                      </span>
                    </div>
                  </div>
                  <div v-else class="mt-2">
                    <div class="text-red-600 font-bold text-2xl">
                      POSTPONED
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Attendance Progress Bar -->
              <div v-if="attendanceStats.has(tournament.id)" class="mt-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-gray-200">
                <div class="flex justify-between items-center mb-3">
                  <span class="text-sm font-semibold text-gray-800">Player Attendance</span>
                  <span class="text-sm font-medium text-gray-700 bg-white px-2 py-1 rounded-full">
                    {{ getAttendanceStats(tournament.id)?.attendingCount || 0 }} / {{ getAttendanceStats(tournament.id)?.totalPlayers || 0 }}
                  </span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-4 mb-3 shadow-inner">
                  <div 
                    class="bg-gradient-to-r from-green-500 to-green-600 h-4 rounded-full transition-all duration-700 ease-out shadow-sm relative overflow-hidden"
                    :style="{ width: `${getAttendancePercentage(tournament.id)}%` }"
                  >
                    <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
                <div class="grid grid-cols-3 gap-2 text-xs">
                  <button 
                    @click="openAttendanceModal(tournament.id, 'attending')"
                    class="text-center p-2 bg-green-100 rounded-lg hover:bg-green-200 transition-colors cursor-pointer"
                  >
                    <div class="font-semibold text-green-800">{{ getAttendanceStats(tournament.id)?.attendingCount || 0 }}</div>
                    <div class="text-green-600">Attending</div>
                  </button>
                  <button 
                    @click="openAttendanceModal(tournament.id, 'not-attending')"
                    class="text-center p-2 bg-red-100 rounded-lg hover:bg-red-200 transition-colors cursor-pointer"
                  >
                    <div class="font-semibold text-red-800">{{ getAttendanceStats(tournament.id)?.notAttendingCount || 0 }}</div>
                    <div class="text-red-600">Not Attending</div>
                  </button>
                  <button 
                    @click="openAttendanceModal(tournament.id, 'betting')"
                    class="text-center p-2 bg-yellow-100 rounded-lg hover:bg-yellow-200 transition-colors cursor-pointer"
                  >
                    <div class="font-semibold text-yellow-800">{{ getBettingCount(tournament.id) }}</div>
                    <div class="text-yellow-600">Betting</div>
                  </button>
                </div>
              </div>

              <!-- Tournament Teams Display -->
              <div v-if="getTournamentTeams(tournament).length > 0" class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 class="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.196-2.196M5 20h5v-2a3 3 0 015.196-2.196M12 4v.01M12 4a7 7 0 018 7c0 2-1 3-1 3s-1 1-1 3v2H8v-2s-1-1-1-3c0-2 1-3 1-3a7 7 0 018-7z" />
                  </svg>
                  Tournament Teams ({{ getTournamentTeams(tournament).length }})
                </h4>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <div
                    v-for="team in getTournamentTeams(tournament)"
                    :key="team.id"
                    class="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <!-- Team Header -->
                    <div class="flex items-center mb-3">
                      <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                        <span class="text-white font-bold text-lg">{{ getTeamNumber(team.name) }}</span>
                      </div>
                      <div class="flex-1">
                        <div class="flex items-center justify-between">
                          <h5 class="font-semibold text-gray-900">{{ team.name }}</h5>
                          <span v-if="tournament.status === 'COMPLETED'" class="text-lg font-bold text-gray-600 flex items-center">
                            ⚽: {{ team.score || 0 }}
                          </span>
                        </div>
                        <p class="text-sm text-gray-600">{{ team.players?.length || 0 }} players</p>
                      </div>
                    </div>

                    <!-- Team Players -->
                    <div v-if="team.players && team.players.length > 0" class="space-y-2">
                      <div
                        v-for="player in team.players"
                        :key="player.id"
                        class="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                      >
                        <div class="flex items-center">
                          <div class="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center mr-2 text-xs font-medium">
                            {{ player.name.charAt(0).toUpperCase() }}
                          </div>
                          <span class="font-medium text-gray-900">{{ player.name }}</span>
                        </div>
                        <div class="flex items-center text-gray-600">
                          <span class="text-xs mr-1">{{ player.position }}</span>
                          <span class="text-xs">T{{ player.tier }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Team Stats -->
                    <div v-if="team.players && team.players.length > 0" class="mt-3 pt-3 border-t border-gray-200">
                      <div class="flex justify-between text-xs text-gray-600">
                        <span>Total Tier: {{ team.players.reduce((sum: number, p: any) => sum + p.tier, 0) }}</span>
                        <span>Avg: {{ (team.players.reduce((sum: number, p: any) => sum + p.tier, 0) / team.players.length).toFixed(1) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Load More Button -->
        <div v-if="hasMoreOldTournaments" class="text-center mt-6">
          <button
            @click="loadMoreOldTournaments"
            :disabled="loadingMore"
            class="btn-secondary"
            :class="{ 'opacity-50 cursor-not-allowed': loadingMore }"
          >
            {{ loadingMore ? 'Loading...' : 'Load More' }}
          </button>
        </div>

        <!-- No tournaments message -->
        <div v-if="oldTournaments.length === 0 && !tournamentsStore.loading" class="text-center py-8">
          <p class="text-gray-600">No old weekly tournaments found</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Attendance Details Modal -->
  <div v-if="showAttendanceModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click="closeAttendanceModal">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden" @click.stop>
      <!-- Modal Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">{{ attendanceModalTitle }}</h3>
        <button 
          @click="closeAttendanceModal"
          class="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Modal Content -->
      <div class="p-6 overflow-y-auto max-h-[60vh]">
        <!-- Loading State -->
        <div v-if="attendanceModalLoading" class="text-center py-8">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p class="text-gray-600 mt-2">Loading players...</p>
        </div>
        
        <!-- No Data State -->
        <div v-else-if="getFilteredModalData().length === 0" class="text-center py-8">
          <p class="text-gray-600">No players {{ attendanceModalType === 'attending' ? 'attending' : attendanceModalType === 'not-attending' ? 'not attending' : 'betting on' }} this tournament.</p>
        </div>
        
        <!-- Player List -->
        <div v-else class="space-y-3">
          <div 
            v-for="attendance in getFilteredModalData()" 
            :key="attendance.id"
            class="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <!-- Player Avatar -->
            <div class="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center mr-4">
              <img 
                v-if="attendance.player.avatar" 
                :src="attendance.player.avatar" 
                :alt="attendance.player.name"
                class="w-12 h-12 rounded-full object-cover"
              />
              <span v-else class="text-gray-600 font-medium text-lg">
                {{ attendance.player.name.charAt(0).toUpperCase() }}
              </span>
            </div>

            <!-- Player Info -->
            <div class="flex-1">
              <!-- Player Name Row with Water Toggle Button -->
              <div class="flex items-center justify-between">
                <h4 class="font-semibold text-gray-900">{{ attendance.player.name }}</h4>
                
                <!-- Water Toggle Button (Admin/Mod only) - Shows same as water status -->
                <div v-if="attendanceModalType === 'attending' && authStore.hasAnyRole(['admin', 'mod'])" class="flex items-center">
                  <button
                    @click="togglePlayerWater(attendance)"
                    :disabled="playerWaterLoading.has(attendance.player.id)"
                    class="text-xs px-2 py-1 rounded-full transition-colors"
                    :class="attendance.withWater 
                      ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                    :title="attendance.withWater ? 'Click to remove water preference' : 'Click to add water preference'"
                  >
                    <div v-if="playerWaterLoading.has(attendance.player.id)" class="flex items-center">
                      <div class="animate-spin rounded-full h-3 w-3 border-b border-current mr-1"></div>
                      <span>Loading...</span>
                    </div>
                    <span v-else>
                      {{ attendance.withWater ? '💧 Water' : '🚫 No Water' }}
                    </span>
                  </button>
                </div>
              </div>
              
              <!-- Player Details Row -->
              <div class="flex items-center justify-between mt-1">
                <span class="text-sm text-gray-600">{{ attendance.player.position }}</span>
                <span class="flex items-center text-sm text-gray-600">
                  <span class="ml-1">
                    {{ '⭐'.repeat(attendance.player.tier) }}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
        <p class="text-sm text-gray-600">
          {{ getFilteredModalData().length }} player{{ getFilteredModalData().length !== 1 ? 's' : '' }} {{ attendanceModalType === 'attending' ? 'attending' : attendanceModalType === 'not-attending' ? 'not attending' : 'betting' }}
        </p>
        <button 
          @click="closeAttendanceModal"
          class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>

  <!-- Additional Cost Modal -->
  <div v-if="showAdditionalCostModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-md">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-semibold">Additional Costs</h2>
        <button @click="closeAdditionalCostModal" class="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>
      
      <!-- Add/Edit Cost Form -->
      <form @submit.prevent="saveAdditionalCost" class="space-y-4 mb-6">
        <div>
          <label class="form-label">Description</label>
          <input
            v-model="additionalCostForm.description"
            type="text"
            required
            minlength="3"
            maxlength="100"
            class="form-input"
            :class="{ 'border-red-500': additionalCostForm.description.length > 0 && additionalCostForm.description.length < 3 }"
            placeholder="Enter cost description (min 3 characters)"
          >
          <p v-if="additionalCostForm.description.length > 0 && additionalCostForm.description.length < 3" 
             class="text-red-500 text-xs mt-1">
            Description must be at least 3 characters long
          </p>
        </div>
        
        <div>
          <label class="form-label">Amount</label>
          <input
            v-model.number="additionalCostForm.amount"
            type="number"
            required
            min="0.01"
            max="999999"
            step="0.01"
            class="form-input"
            :class="{ 'border-red-500': additionalCostForm.amount !== null && (additionalCostForm.amount <= 0 || isNaN(additionalCostForm.amount)) }"
            placeholder="Enter amount (must be greater than 0)"
          >
          <p v-if="additionalCostForm.amount !== null && (additionalCostForm.amount <= 0 || isNaN(additionalCostForm.amount))" 
             class="text-red-500 text-xs mt-1">
            Amount must be a valid number greater than 0
          </p>
        </div>
        
        <button 
          type="submit" 
          :disabled="additionalCostLoading || !isFormValid"
          class="btn-primary w-full"
          :class="{ 'opacity-50 cursor-not-allowed': additionalCostLoading || !isFormValid }"
        >
          {{ additionalCostLoading ? (editingCostId ? 'Updating...' : 'Adding...') : (editingCostId ? 'Update Cost' : 'Add Cost') }}
        </button>
        <button 
          v-if="editingCostId"
          type="button"
          @click="cancelEdit"
          class="btn-secondary w-full mt-2"
        >
          Cancel Edit
        </button>
      </form>
      
      <!-- Additional Costs List -->
      <div>
        <h3 class="font-medium text-gray-900 mb-3">Current Additional Costs</h3>
        <div v-if="currentAdditionalCosts.length === 0" class="text-gray-500 text-sm">
          No additional costs added yet
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="cost in currentAdditionalCosts"
            :key="cost.id"
            class="flex justify-between items-center p-3 bg-gray-50 rounded"
          >
            <div>
              <div class="font-medium">{{ cost.description }}</div>
              <div class="text-sm text-gray-500">${{ cost.amount.toLocaleString() }}</div>
            </div>
            <div class="flex space-x-2">
              <button
                @click="editAdditionalCost(cost)"
                class="text-blue-600 hover:text-blue-800 text-sm"
                title="Edit Cost"
              >
                Edit
              </button>
              <button
                @click="deleteAdditionalCost(cost.id)"
                class="text-red-600 hover:text-red-800 text-sm"
                title="Delete Cost"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
        
        <!-- Total -->
        <div v-if="currentAdditionalCosts.length > 0" class="mt-4 pt-4 border-t">
          <div class="flex justify-between font-semibold">
            <span>Total Additional Costs:</span>
            <span>${{ totalAdditionalCosts.toLocaleString() }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Tournament Score Modal -->
  <div v-if="showScoresModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" @click="showScoresModal = false">
    <div class="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto" @click.stop>
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Tournament Scores</h3>
      
      <!-- Team scores -->
      <div v-if="scoresTournamentId && getTournamentTeams(weeklyTournaments.find(t => t.id === scoresTournamentId) || {} as Tournament).length > 0" class="mb-6">
        <p class="text-gray-600 mb-4">
          Manage team scores for the ongoing tournament.
        </p>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="team in getTournamentTeams(weeklyTournaments.find(t => t.id === scoresTournamentId) || {} as Tournament)"
            :key="team.id"
            class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <!-- Team Header -->
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center">
                <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                  <span class="text-white font-bold text-lg">{{ getTeamNumber(team.name) }}</span>
                </div>
                <div>
                  <h5 class="font-semibold text-gray-900">{{ team.name }}</h5>
                  <p class="text-sm text-gray-600">{{ team.players?.length || 0 }} players</p>
                </div>
              </div>
              <span class="text-lg font-bold text-blue-600 flex items-center">
                ⚽: {{ getTeamScore(team.id) }}
              </span>
            </div>

            <!-- Score Controls -->
            <div class="flex items-center justify-center space-x-4 mt-4 p-3 bg-gray-50 rounded-lg">
              <button
                @click="decreaseScore(team.id)"
                class="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                :disabled="getTeamScore(team.id) <= 0"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
                </svg>
              </button>
              
              <div class="text-center">
                <div class="text-3xl font-bold text-gray-900">{{ getTeamScore(team.id) }}</div>
              </div>
              
              <button
                @click="increaseScore(team.id)"
                class="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- No teams message -->
      <div v-else class="mb-6">
        <p class="text-gray-600">
          No teams found for this tournament.
        </p>
      </div>
      
      <div class="flex justify-end space-x-3">
        <button
          @click="showScoresModal = false; scoresTournamentId = null"
          class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Close
        </button>
        <button
          @click="saveScores"
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Save Scores
        </button>
      </div>
    </div>
  </div>

  <!-- End Tournament Modal -->
  <div v-if="showEndTournamentModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" @click="showEndTournamentModal = false">
    <div class="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto" @click.stop>
      <h3 class="text-lg font-semibold text-gray-900 mb-4">End Tournament</h3>
      
      <!-- Tournament teams showing auto-selected winner and loser -->
      <div v-if="endTournamentId && getTournamentTeams(weeklyTournaments.find(t => t.id === endTournamentId) || {} as Tournament).length > 0" class="mb-6">
        <p class="text-gray-600 mb-4">
          The tournament will be ended with the following results based on team scores:
        </p>
        
        <div class="space-y-4 mb-6">
          <!-- Winner Team -->
          <div v-if="selectedWinningTeam" class="bg-green-50 border border-green-200 rounded-lg p-4">
            <div class="flex items-center justify-between">
              <div class="flex-1">
                <h4 class="font-semibold text-green-800">🏆 Winner: {{ selectedWinningTeam.name }}</h4>
              </div>
              <div class="text-right">
                <span class="text-lg font-bold text-green-700">⚽: {{ selectedWinningTeam.score || 0 }}</span>
              </div>
            </div>
          </div>
          
          <!-- Loser Team -->
          <div v-if="selectedLosingTeam" class="bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex items-center justify-between">
              <div class="flex-1">
                <h4 class="font-semibold text-red-800">😔 Loser: {{ selectedLosingTeam.name }}</h4>
              </div>
              <div class="text-right">
                <span class="text-lg font-bold text-red-700">⚽: {{ selectedLosingTeam.score || 0 }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Money Calculation Info -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h5 class="font-semibold text-blue-800 mb-2">💰 Money Calculations:</h5>
          <ul class="text-xs text-blue-700 space-y-1">
            <li>• Tournament cost per player: -{{ calculateCostPerPlayer(endTournamentId).toLocaleString() }} VND</li>
            <li>• Betting winners: +{{ getBettingWinAmount(getTournamentTeams(weeklyTournaments.find(t => t.id === endTournamentId) || {} as Tournament).length).toLocaleString() }} VND</li>
            <li>• Betting losers: -10,000 VND</li>
            <li>• Loser team players: -5,000 VND</li>
            <li>• Winner team gets free water (no water cost)</li>
            <li>• Other players pay water cost if selected</li>
          </ul>
        </div>

        <!-- Preview Change Block -->
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <h5 class="font-semibold text-gray-800 mb-2">🔎 Preview Money Changes</h5>
          <div v-for="team in getTournamentTeams(weeklyTournaments.find(t => t.id === endTournamentId) || {} as Tournament)" :key="team.id" class="mb-4">
            <div class="font-semibold text-blue-700 mb-2">{{ team.name }}</div>
            <div v-for="player in team.players.filter((p: any) => endTournamentId && getAttendanceStatus(endTournamentId, p.id) === 'ATTEND')" :key="player.id" class="bg-white rounded-lg p-3 mb-2 border border-gray-100">
              <!-- Player Header -->
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center">
                  <div class="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center mr-2 text-xs font-medium">
                    {{ player.name.charAt(0).toUpperCase() }}
                  </div>
                  <span class="font-medium text-gray-900">{{ player.name }}</span>
                  <span class="ml-2 text-xs text-gray-500">{{ player.position }}</span>
                  <span class="ml-2 text-xs text-gray-500">T{{ player.tier }}</span>
                </div>
              </div>
              
              <!-- Detailed Changes -->
              <div v-if="endTournamentId" class="ml-8 space-y-1">
                <div 
                  v-for="change in getDetailedMoneyChange(endTournamentId, team, player).changes" 
                  :key="change.type"
                  class="flex justify-between items-center text-xs"
                >
                  <span class="text-gray-600">{{ change.description }}:</span>
                  <span 
                    :class="change.amount >= 0 ? 'text-green-600' : 'text-red-600'"
                    class="font-medium"
                  >
                    {{ change.amount >= 0 ? '+' : '' }}{{ change.amount.toLocaleString() }} VND
                  </span>
                </div>
                <div class="flex justify-between items-center text-xs" :class="endTournamentId && getDetailedMoneyChange(endTournamentId, team, player).total >= 0 ? 'text-green-600' : 'text-red-600'">
                  <span>Total Change: </span>
                  <span>{{ endTournamentId && getDetailedMoneyChange(endTournamentId, team, player).total >= 0 ? '+' : '' }}{{ endTournamentId ? getDetailedMoneyChange(endTournamentId, team, player).total.toLocaleString() : '0' }} VND</span>
                </div>
                <div class="flex justify-between items-center text-xs">
                  <span>Current: </span>
                  <span>{{ (player.money || 0).toLocaleString() }} VND</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- No teams message -->
      <div v-else class="mb-6">
        <p class="text-gray-600">
          Are you sure you want to end this tournament? This will mark it as COMPLETED and cannot be undone.
        </p>
      </div>
      
      <div class="flex justify-end space-x-3">
        <button
          @click="showEndTournamentModal = false; selectedWinningTeam = null; selectedLosingTeam = null"
          class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          @click="confirmEndTournament"
          class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          End Tournament
        </button>
      </div>
    </div>
  </div>

  <!-- Delete Tournament Confirmation Modal -->
  <div v-if="showDeleteTournamentModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" @click="showDeleteTournamentModal = false">
    <div class="bg-white rounded-lg p-6 max-w-lg w-full" @click.stop>
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Delete Tournament</h3>
      <div class="text-gray-600 mb-6">
        <p class="mb-2">Are you sure you want to delete <strong>"{{ deleteTournamentData?.name }}"</strong>?</p>
        <div v-if="deleteTournamentInfo" class="bg-red-50 p-3 rounded-lg">
          <p class="font-medium text-red-800 mb-2">This will permanently remove:</p>
          <ul class="text-red-700 text-sm space-y-1">
            <li v-if="deleteTournamentInfo.teamCount > 0">• {{ deleteTournamentInfo.teamCount }} team assignments</li>
            <li v-if="deleteTournamentInfo.attendanceCount > 0">• {{ deleteTournamentInfo.attendanceCount }} player attendance records</li>
            <li v-if="deleteTournamentInfo.additionalCostCount > 0">• {{ deleteTournamentInfo.additionalCostCount }} additional cost entries</li>
          </ul>
          <p class="text-red-800 font-medium mt-2">This action cannot be undone.</p>
        </div>
      </div>
      <div class="flex justify-end space-x-3">
        <button
          @click="showDeleteTournamentModal = false"
          class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          @click="confirmDeleteTournament"
          class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Delete Tournament
        </button>
      </div>
    </div>
  </div>

  <!-- Clear Teams Confirmation Modal -->
  <div v-if="showClearTeamsModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" @click="showClearTeamsModal = false">
    <div class="bg-white rounded-lg p-6 max-w-lg w-full" @click.stop>
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Clear Teams</h3>
      <div class="text-gray-600 mb-6">
        <p class="mb-2">Are you sure you want to clear all teams for this tournament?</p>
        <p class="text-red-600 font-medium text-sm">
          This action cannot be undone. All team assignments will be removed.
        </p>
      </div>
      <div class="flex justify-end space-x-3">
        <button
          @click="showClearTeamsModal = false"
          class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          @click="confirmClearTeams"
          class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Clear Teams
        </button>
      </div>
    </div>
  </div>

  <!-- Delete Additional Cost Confirmation Modal -->
  <div v-if="showDeleteCostModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" @click="showDeleteCostModal = false">
    <div class="bg-white rounded-lg p-6 max-w-md w-full" @click.stop>
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Delete Additional Cost</h3>
      <p class="text-gray-600 mb-6">
        Are you sure you want to delete this additional cost? This action cannot be undone.
      </p>
      <div class="flex justify-end space-x-3">
        <button
          @click="showDeleteCostModal = false"
          class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
        <button
          @click="confirmDeleteCost"
          class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Delete Cost
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useTournamentsStore } from '../stores/tournaments'
import { useAuthStore } from '../stores/auth'
import { useTeamsStore } from '../stores/teams'
import { useSystemStore } from '../stores/system'
import type { Tournament, CreateTournamentRequest, TournamentPlayerAttendance, TournamentAttendanceStats, TournamentAttendanceDetails, TournamentEndResponse } from '../types'
import { apiClient } from '../api/client'

const toast = useToast()
const tournamentsStore = useTournamentsStore()
const authStore = useAuthStore()
const teamsStore = useTeamsStore()
const systemStore = useSystemStore()

const loading = ref(false)
const loadingMore = ref(false)
const activeFilter = ref('Ongoing')
const filters = ['Ongoing', 'Old Tournament']

// Attendance tracking
const attendanceMap = ref<Map<string, TournamentPlayerAttendance>>(new Map())
const attendanceLoading = ref<Set<string>>(new Set())
const attendanceStats = ref<Map<string, TournamentAttendanceStats>>(new Map())

// Water tracking
const waterLoading = ref<Set<string>>(new Set())
const playerWaterLoading = ref<Set<string>>(new Set())

// Bet tracking
const betLoading = ref<Set<string>>(new Set())

// Modal for attendance details
const showAttendanceModal = ref(false)
const attendanceModalData = ref<TournamentAttendanceDetails[]>([])
const attendanceDetailsMap = ref<Map<string, TournamentAttendanceDetails[]>>(new Map())
const attendanceModalTitle = ref('')
const attendanceModalType = ref<'attending' | 'not-attending' | 'betting'>('attending')
const attendanceModalLoading = ref(false)

// Team generation
const teamGenerationLoading = ref(false)

// Additional Cost Modal variables
const showAdditionalCostModal = ref(false)
const selectedTournamentForCosts = ref<Tournament | null>(null)
const additionalCostForm = ref({
  description: '',
  amount: null as number | null
})
const editingCostId = ref<string | null>(null)
const additionalCostLoading = ref(false)

// Confirmation Modal variables
const showEndTournamentModal = ref(false)
const endTournamentId = ref<string | null>(null)
const selectedWinningTeam = ref<any | null>(null)
const selectedLosingTeam = ref<any | null>(null)

// Scores Modal variables
const showScoresModal = ref(false)
const scoresTournamentId = ref<string | null>(null)
const teamScores = ref<Map<string, number>>(new Map())

const showDeleteTournamentModal = ref(false)
const deleteTournamentData = ref<Tournament | null>(null)
const deleteTournamentInfo = ref<{
  teamCount: number
  attendanceCount: number
  additionalCostCount: number
} | null>(null)

const showClearTeamsModal = ref(false)
const clearTeamsModalTournamentId = ref<string | null>(null)

const showDeleteCostModal = ref(false)
const deleteCostId = ref<string | null>(null)

// Computed properties for additional costs
const currentAdditionalCosts = computed(() => systemStore.additionalCosts)
const totalAdditionalCosts = computed(() => 
  currentAdditionalCosts.value.reduce((total, cost) => total + cost.amount, 0)
)

// Form validation computed property
const isFormValid = computed(() => {
  const descriptionValid = additionalCostForm.value.description.trim().length >= 3
  const amountValid = additionalCostForm.value.amount !== null && 
                      additionalCostForm.value.amount !== undefined &&
                      typeof additionalCostForm.value.amount === 'number' && 
                      !isNaN(additionalCostForm.value.amount) && 
                      additionalCostForm.value.amount > 0
  return descriptionValid && amountValid
})

// Helper functions for tournament-specific additional costs
const getTournamentAdditionalCosts = (tournamentId: string) => {
  return currentAdditionalCosts.value.filter(cost => cost.tournamentId === tournamentId)
}

const getTournamentAdditionalCostsTotal = (tournamentId: string) => {
  return getTournamentAdditionalCosts(tournamentId).reduce((total, cost) => total + cost.amount, 0)
}

// Financial calculation functions
const calculateTournamentNet = (tournamentId: string) => {
  if (!systemStore.currentSettings) return 0
  const sponsor = systemStore.currentSettings.sponsorMoney
  const stadium = systemStore.currentSettings.stadiumCost
  const additionalCosts = getTournamentAdditionalCostsTotal(tournamentId)
  return stadium - sponsor + additionalCosts
}

const calculateCostPerPlayer = (tournamentId: string) => {
  const net = calculateTournamentNet(tournamentId)
  const attendingCount = getAttendanceStats(tournamentId)?.attendingCount || 0
  if (attendingCount === 0) return 0
  
  const baseCost = net / attendingCount
  // Round up to nearest 5000 and add 5000
  const roundedUp = Math.ceil(baseCost / 5000) * 5000
  return roundedUp + 5000
}

// Pagination for old tournaments
const oldTournamentPage = ref(1)
const oldTournamentLimit = 5
const hasMoreOldTournaments = ref(true)

// Get next Monday (or today if today is Monday)
const nextMonday = computed(() => {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.
  
  if (dayOfWeek === 1) {
    // Today is Monday
    return new Date(today.getFullYear(), today.getMonth(), today.getDate())
  } else {
    // Calculate next Monday
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
    const nextMondayDate = new Date(today)
    nextMondayDate.setDate(today.getDate() + daysUntilMonday)
    return new Date(nextMondayDate.getFullYear(), nextMondayDate.getMonth(), nextMondayDate.getDate())
  }
})

// Get tournaments filtered for weekly tournaments
const weeklyTournaments = computed(() => {
  return tournamentsStore.tournaments.filter(tournament => 
    tournament.type === 'WEEKLY'
  )
})

// Get ongoing tournament (filter by status = 'UPCOMING' or 'ONGOING')
const ongoingTournament = computed(() => {
  return weeklyTournaments.value.find(tournament => 
    tournament.status === 'UPCOMING' || tournament.status === 'ONGOING'
  )
})

// Check if we can create a new tournament
const canCreateNew = computed(() => {
  // Don't allow creating if there's an ongoing tournament
  if (ongoingTournament.value) return false
  
  // Don't allow creating if there's already an upcoming tournament for next Monday
  const targetDate = nextMonday.value
  const targetDateStr = targetDate.toISOString().split('T')[0]
  
  const upcomingForNextMonday = weeklyTournaments.value.find(tournament => {
    const tournamentDate = new Date(tournament.startDate)
    const tournamentDateStr = tournamentDate.toISOString().split('T')[0]
    return tournamentDateStr === targetDateStr && tournament.status === 'UPCOMING'
  })
  
  return !upcomingForNextMonday
})

// Get old tournaments (completed or past)
const oldTournaments = ref<Tournament[]>([])

// Helper functions
const formatDate = (date: string | Date): string => {
  if (!date) return 'N/A'
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  } catch {
    return 'Invalid Date'
  }
}

const formatTime = (date: string | Date): string => {
  if (!date) return 'N/A'
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return 'Invalid Time'
  }
}

const formatNextMonday = (date: Date): string => {
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  })
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'UPCOMING':
      return 'bg-blue-100 text-blue-800'
    case 'ONGOING':
      return 'bg-green-100 text-green-800'
    case 'COMPLETED':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

// Attendance functions
const fetchAttendance = async (tournamentId: string): Promise<void> => {
  try {
    const response = await apiClient.get<TournamentPlayerAttendance>(`/tournaments/${tournamentId}/attendance`)
    if (response.success) {
      // If response.data is empty object {}, user has no player record
      if (response.data && Object.keys(response.data).length > 0) {
        attendanceMap.value.set(tournamentId, response.data)
      } else {
        // User has no player record, set a special marker
        const noPlayerMarker = { 
          id: '', 
          tournamentId, 
          playerId: '', 
          status: 'NO_PLAYER' as any,
          withWater: false,
          bet: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        attendanceMap.value.set(tournamentId, noPlayerMarker)
      }
    }
  } catch (err: any) {
    console.error('Fetch attendance error:', err)
    // Silent error for attendance fetch - we don't want to spam the user with toasts
  }
}

const toggleAttendance = async (tournamentId: string): Promise<void> => {
  if (attendanceLoading.value.has(tournamentId)) return
  
  const currentAttendance = attendanceMap.value.get(tournamentId)
  
  // Don't allow toggle if user has no player
  if (!currentAttendance || (currentAttendance as any).status === 'NO_PLAYER') {
    return
  }
  
  try {
    attendanceLoading.value.add(tournamentId)
    
    const currentStatus = currentAttendance.status || 'NULL'
    
    // Toggle between ATTEND and NOT_ATTEND
    const newStatus = currentStatus === 'ATTEND' ? 'NOT_ATTEND' : 'ATTEND'
    
    const response = await apiClient.put<TournamentPlayerAttendance>(
      `/tournaments/${tournamentId}/attendance`,
      { status: newStatus }
    )
    
    if (response.success && response.data) {
      attendanceMap.value.set(tournamentId, response.data)
      // Refresh attendance stats
      await fetchAttendanceStats(tournamentId)
    }
  } catch (err: any) {
    console.error('Toggle attendance error:', err)
    toast.error(err.response?.data?.error || 'Failed to update attendance')
  } finally {
    attendanceLoading.value.delete(tournamentId)
  }
}

const getAttendanceButtonText = (tournamentId: string): string => {
  const attendance = attendanceMap.value.get(tournamentId)
  if (!attendance || (attendance as any).status === 'NO_PLAYER') return 'No Player'
  if (attendance.status === 'NULL') return 'Attend'
  return attendance.status === 'ATTEND' ? 'Attended' : 'Attend'
}

const getCardBackgroundClass = (tournamentId: string): string => {
  const attendance = attendanceMap.value.get(tournamentId)
  if (!attendance || (attendance as any).status === 'NO_PLAYER' || attendance.status === 'NULL') return ''
  return attendance.status === 'ATTEND' ? 'bg-green-50' : 'bg-red-50'
}

// Attendance statistics functions
const fetchAttendanceStats = async (tournamentId: string): Promise<void> => {
  try {
    const response = await apiClient.get<TournamentAttendanceStats>(`/tournaments/${tournamentId}/attendance-stats`)
    if (response.success && response.data) {
      attendanceStats.value.set(tournamentId, response.data)
    }
  } catch (err: any) {
    console.error('Fetch attendance stats error:', err)
    // Silent error for attendance stats fetch
  }
}

const getAttendanceStats = (tournamentId: string): TournamentAttendanceStats | undefined => {
  return attendanceStats.value.get(tournamentId)
}

const getAttendancePercentage = (tournamentId: string): number => {
  const stats = attendanceStats.value.get(tournamentId)
  if (!stats || stats.totalPlayers === 0) return 0
  return Math.round((stats.attendingCount / stats.totalPlayers) * 100)
}

// Modal functions
const fetchAttendanceDetails = async (tournamentId: string): Promise<void> => {
  try {
    attendanceModalLoading.value = true
    const response = await apiClient.get<TournamentAttendanceDetails[]>(`/tournaments/${tournamentId}/attendance-details`)
    if (response.success && response.data) {
      attendanceModalData.value = response.data
      // Store in map for betting count calculation
      attendanceDetailsMap.value.set(tournamentId, response.data)
    }
  } catch (err: any) {
    console.error('Fetch attendance details error:', err)
    toast.error('Failed to load attendance details')
    attendanceModalData.value = []
  } finally {
    attendanceModalLoading.value = false
  }
}

const openAttendanceModal = async (tournamentId: string, type: 'attending' | 'not-attending' | 'betting'): Promise<void> => {
  attendanceModalType.value = type
  if (type === 'attending') {
    attendanceModalTitle.value = 'Players Attending'
  } else if (type === 'not-attending') {
    attendanceModalTitle.value = 'Players Not Attending'
  } else if (type === 'betting') {
    attendanceModalTitle.value = 'Betting Players'
  }
  showAttendanceModal.value = true
  attendanceModalData.value = [] // Clear previous data
  
  await fetchAttendanceDetails(tournamentId)
}

const closeAttendanceModal = (): void => {
  showAttendanceModal.value = false
  attendanceModalData.value = []
  attendanceModalLoading.value = false
}

const getFilteredModalData = (): TournamentAttendanceDetails[] => {
  if (attendanceModalType.value === 'betting') {
    // Filter by bet field for betting players
    return attendanceModalData.value
      .filter(item => item.bet === true)
      .sort((a, b) => b.player.tier - a.player.tier) // Sort by tier descending (highest tier first)
  } else {
    // Filter by status for attending/not-attending players
    let targetStatus: string
    if (attendanceModalType.value === 'attending') {
      targetStatus = 'ATTEND'
    } else if (attendanceModalType.value === 'not-attending') {
      targetStatus = 'NOT_ATTEND'
    }
    
    return attendanceModalData.value
      .filter(item => item.status === targetStatus)
      .sort((a, b) => b.player.tier - a.player.tier) // Sort by tier descending (highest tier first)
  }
}

// Team generation functions
const canGenerateTeams = (tournamentId: string): boolean => {
  const stats = attendanceStats.value.get(tournamentId)
  return stats ? stats.attendingCount >= 10 : false
}

const getTeamCount = (tournamentId: string): number => {
  const stats = attendanceStats.value.get(tournamentId)
  if (!stats) return 0
  
  const playerCount = stats.attendingCount
  if (playerCount < 15) return 2
  if (playerCount < 20) return 3
  return 4
}

// Helper function to get teams with players from tournament data
const getTournamentTeams = (tournament: Tournament): any[] => {
  if (!tournament.teams) return []
  
  // Create a map of team players from tournamentTeamPlayers
  const teamPlayersMap = new Map<string, any[]>()
  
  if (tournament.tournamentTeamPlayers) {
    tournament.tournamentTeamPlayers.forEach((ttp: any) => {
      if (!teamPlayersMap.has(ttp.teamId)) {
        teamPlayersMap.set(ttp.teamId, [])
      }
      teamPlayersMap.get(ttp.teamId)!.push(ttp.player)
    })
  }
  
   
  
  // Tournament teams come as { team: { id, name, logo, score } } structure
  return tournament.teams.map((tournamentTeam: any) => {
    const team = tournamentTeam.team || tournamentTeam
    return {
      id: team.id,
      name: team.name,
      logo: team.logo,
      players: teamPlayersMap.get(team.id) || [],
      score: team.score || 0
    }
  })
}

const generateRandomTeams = async (tournamentId: string): Promise<void> => {
  if (!canGenerateTeams(tournamentId) || teamGenerationLoading.value) return
  
  const stats = attendanceStats.value.get(tournamentId)
  if (!stats) return
  
  try {
    teamGenerationLoading.value = true
    
    const response = await apiClient.post(`/tournaments/${tournamentId}/generate-teams`)
    
    if (response.success) {
      // Show success message with team details
      const data = response.data as any
      toast.success(`Teams generated successfully! Created ${data.teamCount} teams for ${data.playerCount} players`)
      
      // Refresh tournament data
      await fetchData()
    }
  } catch (err: any) {
    console.error('Generate teams error:', err)
    toast.error(err.response?.data?.error || 'Failed to generate teams')
  } finally {
    teamGenerationLoading.value = false
  }
}

// Create new weekly tournament
const createWeeklyTournament = async () => {
  if (!canCreateNew.value || loading.value) return
  
  try {
    loading.value = true
    
    // Create dates in local time
    const startDate = new Date(nextMonday.value)
    startDate.setHours(19, 0, 0, 0) // 7:00 PM local time
    
    const endDate = new Date(nextMonday.value)
    endDate.setHours(21, 0, 0, 0) // 9:00 PM local time
    
    // Convert to ISO strings to preserve the exact time we want
    const startDateISO = startDate.toISOString()
    const endDateISO = endDate.toISOString()
    
    const tournamentData: CreateTournamentRequest = {
      name: `Weekly Tournament - ${formatDate(startDate)}`,
      type: 'WEEKLY' as const,
      status: 'UPCOMING' as const,
      startDate: startDateISO,
      endDate: endDateISO
    }
    
    await tournamentsStore.addTournament(tournamentData)
    await fetchData()
    toast.success('Weekly tournament created successfully!')
  } catch (err: any) {
    console.error('Create weekly tournament error:', err)
    toast.error(err.response?.data?.error || 'Failed to create weekly tournament')
  } finally {
    loading.value = false
  }
}

// Load old tournaments with pagination
const loadOldTournaments = async (page: number = 1, append: boolean = false) => {
  try {
    if (page === 1) {
      oldTournaments.value = []
    }
    
    // Filter completed weekly tournaments, sorted by start date descending
    const allWeeklyTournaments = weeklyTournaments.value
      .filter(t => t.status === 'COMPLETED' || new Date(t.startDate) < new Date())
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    
    const startIndex = (page - 1) * oldTournamentLimit
    const endIndex = startIndex + oldTournamentLimit
    const pageData = allWeeklyTournaments.slice(startIndex, endIndex)
    
    if (append) {
      oldTournaments.value.push(...pageData)
    } else {
      oldTournaments.value = pageData
    }
    
    hasMoreOldTournaments.value = endIndex < allWeeklyTournaments.length
  } catch (err: any) {
    console.error('Load old tournaments error:', err)
    toast.error('Failed to load old tournaments')
  }
}

const loadMoreOldTournaments = async () => {
  if (loadingMore.value || !hasMoreOldTournaments.value) return
  
  try {
    loadingMore.value = true
    oldTournamentPage.value++
    await loadOldTournaments(oldTournamentPage.value, true)
  } finally {
    loadingMore.value = false
  }
}

// Tournament actions
const editTournament = (tournament: Tournament) => {
  // Navigate to regular tournaments page with edit functionality
  // Since we're reusing tournament functionality
  console.log('Edit tournament:', tournament.id)
  // You can implement this based on your tournament editing needs
}

const startTournament = async (tournamentId: string) => {
  try {
    const response = await apiClient.put(`/tournaments/${tournamentId}`, {
      status: 'ONGOING'
    })
    
    if (response.success) {
      toast.success('Tournament started successfully!')
      await fetchData()
    } else {
      toast.error('Failed to start tournament')
    }
  } catch (err: any) {
    console.error('Start tournament error:', err)
    toast.error(err.response?.data?.error || 'Failed to start tournament')
  }
}

const openScoresModal = async (tournamentId: string) => {
  scoresTournamentId.value = tournamentId
  showScoresModal.value = true
  
  // Initialize scores for all teams
  const tournament = weeklyTournaments.value.find(t => t.id === tournamentId)
  if (tournament) {
    const teams = getTournamentTeams(tournament)
    teamScores.value.clear()
    
    console.log('Opening scores modal for tournament:', tournamentId)
    console.log('Teams found:', teams.map(t => ({ id: t.id, name: t.name, score: t.score })))
    
    // Use team scores directly from tournament data
    teams.forEach(team => {
      console.log(`Setting score for team ${team.name} (${team.id}): ${team.score || 0}`)
      teamScores.value.set(team.id, team.score || 0)
    })
    
    console.log('Final teamScores Map:', Object.fromEntries(teamScores.value))
  }
}

const getTeamScore = (teamId: string): number => {
  return teamScores.value.get(teamId) || 0
}

const increaseScore = (teamId: string) => {
  const currentScore = teamScores.value.get(teamId) || 0
  teamScores.value.set(teamId, currentScore + 1)
}

const decreaseScore = (teamId: string) => {
  const currentScore = teamScores.value.get(teamId) || 0
  if (currentScore > 0) {
    teamScores.value.set(teamId, currentScore - 1)
  }
}

const saveScores = async () => {
  if (!scoresTournamentId.value) return
  
  try {
    // Prepare scores data for API call - convert Map to object
    const scores: Record<string, number> = {}
    teamScores.value.forEach((score, teamId) => {
      scores[teamId] = score
    })

    // Call the API to update tournament scores
    const response = await apiClient.updateTournamentScores(scoresTournamentId.value, scores)
    
    if (response.success) {
      toast.success('Scores saved successfully!')
      
      // Update local tournament data immediately with new scores for instant UI feedback
      const tournament = weeklyTournaments.value.find(t => t.id === scoresTournamentId.value)
      if (tournament?.teams) {
        tournament.teams.forEach(team => {
          if (scores[team.id] !== undefined) {
            (team as any).score = scores[team.id]
          }
        })
      }
      
      // Refresh modal scores to reflect the changes
      if (scoresTournamentId.value) {
        await refreshModalScores(scoresTournamentId.value)
      }
      
      showScoresModal.value = false
      scoresTournamentId.value = null
      
      // Also refresh tournament data from backend to ensure consistency
      setTimeout(() => {
        tournamentsStore.fetchTournaments()
      }, 100)
    } else {
      throw new Error(response.error || 'Failed to save scores')
    }
  } catch (err: any) {
    console.error('Save scores error:', err)
    toast.error(err.response?.data?.error || err.message || 'Failed to save scores')
  }
}

// Helper function to refresh modal scores
const refreshModalScores = async (tournamentId: string) => {
  // Refresh scores from tournament data instead of API call
  const tournament = weeklyTournaments.value.find(t => t.id === tournamentId)
  if (tournament) {
    const teams = getTournamentTeams(tournament)
    teams.forEach(team => {
      teamScores.value.set(team.id, team.score || 0)
    })
  }
}

const endTournament = async (tournamentId: string) => {
  // Check if tournament can be ended
  if (!canEndTournament(tournamentId)) {
    const statusMessage = getTournamentEndStatusMessage(tournamentId)
    toast.error(`Cannot end tournament: ${statusMessage}`)
    return
  }
  
  endTournamentId.value = tournamentId
  
  // Auto-select the team with the highest score as winner and lowest score as loser
  const tournament = weeklyTournaments.value.find(t => t.id === tournamentId)
  if (tournament) {
    const teams = getTournamentTeams(tournament)
    if (teams.length > 0) {
      const highestScoreTeam = getHighestScoreTeam(teams)
      const lowestScoreTeam = getLowestScoreTeam(teams)
      
      selectedWinningTeam.value = highestScoreTeam
      selectedLosingTeam.value = lowestScoreTeam
    }
  }
  
  showEndTournamentModal.value = true
}

const confirmEndTournament = async () => {
  if (!endTournamentId.value) return
  
  try {
    // No need to send winnerId - backend will auto-select based on scores
    const response = await apiClient.put(`/tournaments/${endTournamentId.value}/end`, {})
    
    if (response.success) {
      const data = response.data as any
      let message = 'Tournament ended successfully!'
      
      if (data.winner) {
        message += ` Winner: ${data.winner.name} (${data.winner.score} points).`
      }
      
      if (data.loser) {
        message += ` Loser: ${data.loser.name} (${data.loser.score} points).`
      }
      
      if (data.playersUpdated > 0) {
        message += ` ${data.playersUpdated} players had money updated.`
      }
      
      if (data.totalAdded > 0) {
        message += ` Total added: ${data.totalAdded.toLocaleString()} VND.`
      }
      
      if (data.totalDeducted > 0) {
        message += ` Total deducted: ${data.totalDeducted.toLocaleString()} VND.`
      }
      
      toast.success(message)
      await fetchData()
    } else {
      toast.error('Failed to end tournament')
    }
  } catch (err: any) {
    console.error('End tournament error:', err)
    toast.error(err.response?.data?.error || 'Failed to end tournament')
  } finally {
    showEndTournamentModal.value = false
    endTournamentId.value = null
    selectedWinningTeam.value = null
    selectedLosingTeam.value = null
  }
}

const deleteTournament = async (id: string) => {
  // Find the tournament to show detailed confirmation
  const tournament = weeklyTournaments.value.find(t => t.id === id) || 
                    oldTournaments.value.find(t => t.id === id);
  
  if (!tournament) {
    toast.error('Tournament not found');
    return;
  }

  const teamCount = getTournamentTeams(tournament).length;
  const attendanceCount = attendanceStats.value.get(id)?.totalPlayers || 0;
  const additionalCostCount = getTournamentAdditionalCosts(id).length;
  
  // Set up modal data
  deleteTournamentData.value = tournament;
  deleteTournamentInfo.value = {
    teamCount,
    attendanceCount,
    additionalCostCount
  };
  showDeleteTournamentModal.value = true;
}

const confirmDeleteTournament = async () => {
  if (!deleteTournamentData.value) return;
  
  try {
    await tournamentsStore.deleteTournament(deleteTournamentData.value.id);
    
    // Clear local data
    attendanceMap.value.delete(deleteTournamentData.value.id);
    attendanceStats.value.delete(deleteTournamentData.value.id);
    
    await fetchData();
    toast.success(`Tournament deleted successfully! Removed all associated teams, attendance records, and additional costs.`);
  } catch (err: any) {
    console.error('Delete tournament error:', err);
    toast.error(err.response?.data?.error || 'Failed to delete tournament')
  } finally {
    showDeleteTournamentModal.value = false;
    deleteTournamentData.value = null;
    deleteTournamentInfo.value = null;
  }
}

// Clear Teams functions
const openClearTeamsModal = (tournamentId: string) => {
  clearTeamsModalTournamentId.value = tournamentId
  showClearTeamsModal.value = true
}

const closeClearTeamsModal = () => {
  showClearTeamsModal.value = false
  clearTeamsModalTournamentId.value = null
}

const confirmClearTeams = async () => {
  if (!clearTeamsModalTournamentId.value) return
  
  try {
    const response = await apiClient.put(`/tournaments/${clearTeamsModalTournamentId.value}/clear-teams`)
    
    if (response.success) {
      toast.success('All teams cleared successfully!')
      await fetchData()
    } else {
      toast.error('Failed to clear teams')
    }
  } catch (err: any) {
    console.error('Clear teams error:', err)
    toast.error(err.response?.data?.error || 'Failed to clear teams')
  } finally {
    showClearTeamsModal.value = false
    clearTeamsModalTournamentId.value = null
  }
}

// Additional Cost functions
const openAdditionalCostModal = async (tournament: Tournament) => {
  selectedTournamentForCosts.value = tournament
  showAdditionalCostModal.value = true
  editingCostId.value = null
  additionalCostForm.value = {
    description: '',
    amount: null
  }
  // Fetch additional costs for this tournament
  await systemStore.fetchAdditionalCosts(tournament.id)
}

const closeAdditionalCostModal = () => {
  showAdditionalCostModal.value = false
  selectedTournamentForCosts.value = null
  editingCostId.value = null
  additionalCostForm.value = {
    description: '',
    amount: null
  }
}

const editAdditionalCost = (cost: any) => {
  additionalCostForm.value = {
    description: cost.description,
    amount: cost.amount
  }
  editingCostId.value = cost.id
}

const cancelEdit = () => {
  additionalCostForm.value = {
    description: '',
    amount: null
  }
  editingCostId.value = null
}

const saveAdditionalCost = async () => {
  if (!selectedTournamentForCosts.value || additionalCostLoading.value) return
  
  // Client-side validation
  if (additionalCostForm.value.description.trim().length < 3) {
    toast.error('Description must be at least 3 characters long')
    return
  }
  
  if (!additionalCostForm.value.amount || additionalCostForm.value.amount <= 0) {
    toast.error('Amount must be greater than 0')
    return
  }
  
  try {
    additionalCostLoading.value = true
    
    const costData = {
      description: additionalCostForm.value.description.trim(),
      amount: additionalCostForm.value.amount
    }
    
    let response
    if (editingCostId.value) {
      // Edit existing cost
      response = await systemStore.updateAdditionalCost(editingCostId.value, costData)
      if (response) {
        toast.success('Additional cost updated successfully')
      }
    } else {
      // Add new cost
      response = await systemStore.createAdditionalCost({
        tournamentId: selectedTournamentForCosts.value.id,
        ...costData
      })
      if (response) {
        toast.success('Additional cost added successfully')
      }
    }
    
    if (response) {
      // Reset form
      additionalCostForm.value = {
        description: '',
        amount: null
      }
      editingCostId.value = null
      // Refresh the costs
      await systemStore.fetchAdditionalCosts(selectedTournamentForCosts.value.id)
    }
  } catch (err: any) {
    console.error('Save additional cost error:', err)
    toast.error(err.response?.data?.error || 'Failed to save additional cost')
  } finally {
    additionalCostLoading.value = false
  }
}

const deleteAdditionalCost = async (costId: string) => {
  deleteCostId.value = costId;
  showDeleteCostModal.value = true;
}

const confirmDeleteCost = async () => {
  if (!deleteCostId.value) return;
  
  try {
    const success = await systemStore.deleteAdditionalCost(deleteCostId.value);
    if (success) {
      toast.success('Additional cost deleted successfully');
      // Refresh the costs if we have a selected tournament
      if (selectedTournamentForCosts.value) {
        await systemStore.fetchAdditionalCosts(selectedTournamentForCosts.value.id);
      }
    }
  } catch (err: any) {
    console.error('Delete additional cost error:', err);
    toast.error(err.response?.data?.error || 'Failed to delete additional cost');
  } finally {
    showDeleteCostModal.value = false;
    deleteCostId.value = null;
  }
}

// Helper function to extract team number from team name
const getTeamNumber = (teamName: string): string => {
  // Extract number from team name like "Team 1 - 2025-07-21" => "1"
  const match = teamName.match(/Team (\d+)/)
  return match ? match[1] : teamName.charAt(teamName.length - 1)
}

// Helper function to get the team with the highest score
const getHighestScoreTeam = (teams: any[]): any | null => {
  if (!teams || teams.length === 0) return null
  return teams.reduce((highest, current) => {
    const currentScore = current.score || 0
    const highestScore = highest.score || 0
    return currentScore > highestScore ? current : highest
  })
}

// Helper function to get sorted teams by score (highest to lowest)
const getSortedTeamsByScore = (teams: any[]): any[] => {
  if (!teams || teams.length === 0) return []
  return [...teams].sort((a, b) => (b.score || 0) - (a.score || 0))
}

// Helper function to get the team with the lowest score
const getLowestScoreTeam = (teams: any[]): any | null => {
  if (!teams || teams.length === 0) return null
  return teams.reduce((lowest, current) => {
    const currentScore = current.score || 0
    const lowestScore = lowest.score || 0
    return currentScore < lowestScore ? current : lowest
  })
}

// Helper function to calculate betting win amount based on number of teams
// Helper function to get betting count from attendance details
const getBettingCount = (tournamentId: string): number => {
  const details = attendanceDetailsMap.value.get(tournamentId)
  if (!details || !Array.isArray(details) || !details.length) return 0
  
  // Count players who are betting (regardless of attendance status for now)
  return details.filter((detail: any) => detail.bet === true).length
}

// Helper function to calculate betting win amount based on number of teams
const getBettingWinAmount = (numberOfTeams: number): number => {
  if (numberOfTeams >= 3) {
    // 3+ teams: +10000 * (teams - 2)
    return 10000 * (numberOfTeams - 2)
  } else {
    // 2 teams: +10000
    return 10000
  }
}

// Helper function to get attendance status for a player in a tournament
const getAttendanceStatus = (tournamentId: string, playerId: string): string => {
  const details = attendanceDetailsMap.value.get(tournamentId)
  if (!details || !Array.isArray(details)) return 'NULL'
  
  const playerAttendance = details.find((d: any) => d.playerId === playerId)
  return playerAttendance?.status || 'NULL'
}

// Check if tournament can be ended (clear winner and loser)
const canEndTournament = (tournamentId: string): boolean => {
  const tournament = weeklyTournaments.value.find(t => t.id === tournamentId)
  if (!tournament || tournament.status !== 'ONGOING') return false
  
  const teams = getTournamentTeams(tournament)
  if (teams.length < 2) return false
  
  // Get all unique scores
  const scores = teams.map(team => team.score || 0)
  const uniqueScores = [...new Set(scores)].sort((a, b) => b - a) // Sort descending
  
  if (uniqueScores.length < 2) return false // All teams have same score
  
  const highestScore = uniqueScores[0]
  const lowestScore = uniqueScores[uniqueScores.length - 1]
  
  // Count teams with highest score
  const teamsWithHighestScore = teams.filter(team => (team.score || 0) === highestScore)
  // Count teams with lowest score  
  const teamsWithLowestScore = teams.filter(team => (team.score || 0) === lowestScore)
  
  // Can end only if there's exactly one team with highest score and one with lowest score
  return teamsWithHighestScore.length === 1 && teamsWithLowestScore.length === 1
}

// Get tournament end status message
const getTournamentEndStatusMessage = (tournamentId: string): string => {
  const tournament = weeklyTournaments.value.find(t => t.id === tournamentId)
  if (!tournament || tournament.status !== 'ONGOING') return ''
  
  const teams = getTournamentTeams(tournament)
  if (teams.length < 2) return 'Need at least 2 teams'
  
  const scores = teams.map(team => team.score || 0)
  const uniqueScores = [...new Set(scores)].sort((a, b) => b - a)
  
  if (uniqueScores.length < 2) return 'All teams have the same score'
  
  const highestScore = uniqueScores[0]
  const lowestScore = uniqueScores[uniqueScores.length - 1]
  
  const teamsWithHighestScore = teams.filter(team => (team.score || 0) === highestScore)
  const teamsWithLowestScore = teams.filter(team => (team.score || 0) === lowestScore)
  
  if (teamsWithHighestScore.length > 1) {
    return `${teamsWithHighestScore.length} teams tied for highest score (${highestScore})`
  }
  
  if (teamsWithLowestScore.length > 1) {
    return `${teamsWithLowestScore.length} teams tied for lowest score (${lowestScore})`
  }
  
  return '' // Can end tournament
}

// Fetch all data
const fetchData = async () => {
  try {
    await Promise.all([
      tournamentsStore.fetchTournaments(),
      teamsStore.fetchTeams(),
      systemStore.fetchSystemSettings()
    ])
    await loadOldTournaments(1)
    
    // Fetch attendance and additional costs for all weekly tournaments
    const weeklyTournamentIds = weeklyTournaments.value.map(t => t.id)
    await Promise.all([
      ...weeklyTournamentIds.map(id => fetchAttendance(id)),
      ...weeklyTournamentIds.map(id => fetchAttendanceStats(id)),
      ...weeklyTournamentIds.map(id => fetchAttendanceDetails(id)),
      ...weeklyTournamentIds.map(id => systemStore.fetchAdditionalCosts(id))
    ])
  } catch (err: any) {
    console.error('Fetch data error:', err)
    toast.error(err.response?.data?.error || 'Failed to load data')
  }
}

// Initialize
onMounted(async () => {
  await fetchData()
})

// Scroll listener for infinite scroll on old tournaments
const handleScroll = () => {
  if (activeFilter.value !== 'Old Tournament') return
  
  const scrollHeight = document.documentElement.scrollHeight
  const scrollTop = document.documentElement.scrollTop
  const clientHeight = document.documentElement.clientHeight
  
  if (scrollTop + clientHeight >= scrollHeight - 100 && hasMoreOldTournaments.value && !loadingMore.value) {
    loadMoreOldTournaments()
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

// Water-related functions
const getUserWaterStatus = (tournamentId: string): boolean => {
  const attendance = attendanceMap.value.get(tournamentId)
  return attendance?.withWater || false
}

// Bet-related functions
const getUserBetStatus = (tournamentId: string): boolean => {
  const attendance = attendanceMap.value.get(tournamentId)
  return attendance?.bet || false
}

const getUserAttendanceStatus = (tournamentId: string): string => {
  const attendance = attendanceMap.value.get(tournamentId)
  if (!attendance || (attendance as any).status === 'NO_PLAYER') return 'NO_PLAYER'
  return attendance.status || 'NULL'
}

const toggleWater = async (tournamentId: string): Promise<void> => {
  if (waterLoading.value.has(tournamentId)) return
  
  const currentAttendance = attendanceMap.value.get(tournamentId)
  
  // Only allow water toggle if user is attending
  if (!currentAttendance || currentAttendance.status !== 'ATTEND') {
    return
  }
  
  try {
    waterLoading.value.add(tournamentId)
    
    const newWaterStatus = !currentAttendance.withWater
    
    const response = await apiClient.put<TournamentPlayerAttendance>(
      `/tournaments/${tournamentId}/attendance`,
      { 
        status: currentAttendance.status,
        withWater: newWaterStatus
      }
    )
    
    if (response.success && response.data) {
      attendanceMap.value.set(tournamentId, response.data)
      toast.success(newWaterStatus ? 'Water preference added!' : 'Water preference removed!')
    }
  } catch (err: any) {
    console.error('Toggle water error:', err)
    toast.error(err.response?.data?.error || 'Failed to update water preference')
  } finally {
    waterLoading.value.delete(tournamentId)
  }
}

const toggleBet = async (tournamentId: string): Promise<void> => {
  if (betLoading.value.has(tournamentId)) return
  
  const currentAttendance = attendanceMap.value.get(tournamentId)
  
  // Only allow bet toggle if user is attending
  if (!currentAttendance || currentAttendance.status !== 'ATTEND') {
    return
  }
  
  try {
    betLoading.value.add(tournamentId)
    
    const newBetStatus = !currentAttendance.bet
    
    const response = await apiClient.put<TournamentPlayerAttendance>(
      `/tournaments/${tournamentId}/attendance`,
      { 
        status: currentAttendance.status,
        withWater: currentAttendance.withWater,
        bet: newBetStatus
      }
    )
    
    if (response.success && response.data) {
      attendanceMap.value.set(tournamentId, response.data)
      
      // Refresh attendance details to update betting count
      await fetchAttendanceDetails(tournamentId)
      
      toast.success(newBetStatus ? 'Bet placed!' : 'Bet removed!')
    }
  } catch (err: any) {
    console.error('Toggle bet error:', err)
    toast.error(err.response?.data?.error || 'Failed to update bet status')
  } finally {
    betLoading.value.delete(tournamentId)
  }
}

const togglePlayerWater = async (attendance: TournamentAttendanceDetails): Promise<void> => {
  if (playerWaterLoading.value.has(attendance.player.id)) return
  
  // Only allow water toggle for attending players
  if (attendance.status !== 'ATTEND') {
    return
  }
  
  try {
    playerWaterLoading.value.add(attendance.player.id)
    
    const newWaterStatus = !attendance.withWater
    
    // Use admin endpoint to update any player's attendance
    const response = await apiClient.put<TournamentPlayerAttendance>(
      `/tournaments/${attendance.tournamentId}/attendance/${attendance.player.id}`,
      { 
        status: attendance.status,
        withWater: newWaterStatus
      }
    )
    
    if (response.success && response.data) {
      // Update the attendance in the modal data
      const index = attendanceModalData.value.findIndex(a => a.id === attendance.id)
      if (index !== -1) {
        attendanceModalData.value[index] = {
          ...attendanceModalData.value[index],
          withWater: newWaterStatus
        }
      }
      
      // Also update the main attendance map if it's the current user
      if (authStore.currentUser?.player?.id === attendance.player.id) {
        attendanceMap.value.set(attendance.tournamentId, response.data)
      }
      
      toast.success(`${attendance.player.name}: ${newWaterStatus ? 'Water preference added!' : 'Water preference removed!'}`)
    }
  } catch (err: any) {
    console.error('Toggle player water error:', err)
    toast.error(err.response?.data?.error || 'Failed to update water preference')
  } finally {
    playerWaterLoading.value.delete(attendance.player.id)
  }
}

// Helper function to get detailed money change breakdown for a player
const getDetailedMoneyChange = (tournamentId: string, team: any, player: any): { changes: Array<{type: string, amount: number, description: string}>, total: number } => {
  if (!systemStore.currentSettings) return { changes: [], total: 0 }
  
  const tournament = weeklyTournaments.value.find(t => t.id === tournamentId)
  if (!tournament) return { changes: [], total: 0 }
  
  const changes: Array<{type: string, amount: number, description: string}> = []
  
  // Base tournament cost per player
  const costPerPlayer = calculateCostPerPlayer(tournamentId)
  changes.push({
    type: 'cost',
    amount: -costPerPlayer,
    description: 'Tournament cost per player'
  })
  
  // Check if player is betting
  const details = attendanceDetailsMap.value.get(tournamentId)
  const playerAttendance = Array.isArray(details) ? details.find((d: any) => d.playerId === player.id) : null
  const isBetting = playerAttendance?.bet === true
  const hasWater = playerAttendance?.withWater === true
  
  // Team result calculations
  const isWinnerTeam = selectedWinningTeam.value?.id === team.id
  const isLoserTeam = selectedLosingTeam.value?.id === team.id
  
  // Betting calculations
  if (isBetting) {
    if (isWinnerTeam) {
      // Betting winner
      const teamCount = getTournamentTeams(tournament).length
      const winAmount = getBettingWinAmount(teamCount)
      changes.push({
        type: 'betting_win',
        amount: winAmount,
        description: 'Betting winner bonus'
      })
    } else {
      // Betting loser
      changes.push({
        type: 'betting_loss',
        amount: -10000,
        description: 'Betting loser penalty'
      })
    }
  }
  
  if (isLoserTeam) {
    // Loser team penalty
    changes.push({
      type: 'team_loss',
      amount: -5000,
      description: 'Loser team penalty'
    })
  }
  
  // Water cost calculations
  if (hasWater && !isWinnerTeam) {
    // Winner team gets free water, others pay if they selected water
    const waterCost = systemStore.currentSettings.waterCost || 5000
    changes.push({
      type: 'water',
      amount: -waterCost,
      description: 'Water cost'
    })
  } else if (hasWater && isWinnerTeam) {
    changes.push({
      type: 'water_free',
      amount: 0,
      description: 'Free water (winner team)'
    })
  }
  
  const total = changes.reduce((sum, change) => sum + change.amount, 0)
  
  return { changes, total }
}
</script>
