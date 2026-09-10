<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Đá hằng tuần</h1>
      <button 
        v-if="authStore.hasPermission('canEditTournaments')"
        @click="handleCreateNew" 
        :disabled="loading || !canCreateNew"
        class="btn-primary w-full sm:w-auto"
        :class="{ 'opacity-50 cursor-not-allowed': loading || !canCreateNew }"
      >
        {{ loading ? 'Đang tạo...' : 'Tạo mới' }}
      </button>
    </div>

    <div v-if="showCreateTournamentModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="closeCreateTournamentModal">
      <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 class="text-lg font-semibold text-gray-900">Chọn ngày tạo giải đấu</h2>
        <p class="mt-2 text-sm text-gray-600">Tuần này đã có giải đấu kết thúc. Vui lòng chọn ngày cho giải đấu mới.</p>
        <div class="mt-5">
          <label for="new-tournament-date" class="form-label">Ngày thi đấu</label>
          <input id="new-tournament-date" v-model="newTournamentDate" type="date" class="form-input" :min="minimumSelectableDate">
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button type="button" class="btn-secondary" @click="closeCreateTournamentModal">Hủy</button>
          <button type="button" class="btn-primary" :disabled="loading || !newTournamentDate" @click="createWeeklyTournamentFromSelectedDate">
            {{ loading ? 'Đang tạo...' : 'Tạo giải đấu' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="border-b border-gray-200">
      <nav class="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
        <button
          v-for="filter in filters"
          :key="filter"
          @click="handleFilterChange(filter)"
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
      <p class="mt-2 text-gray-600">Đang tải giải đấu...</p>
    </div>

    <!-- Tournaments Content -->
    <div v-else>
      <!-- Ongoing Tournament Tab -->
      <div v-if="activeFilter === 'Đang diễn ra'">
        <div v-if="ongoingTournament" 
             class="card transition-colors duration-200"
             :class="getCardBackgroundClass(ongoingTournament.id)">
          <div class="flex flex-col space-y-4">
            <!-- Tournament Info -->
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0">
              <div class="flex-1">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div class="flex items-center gap-2">
                    <h3 class="text-lg font-semibold text-gray-900">{{ ongoingTournament.name }}</h3>
                    <button
                      type="button"
                      class="inline-flex h-6 w-6 items-center justify-center rounded-full text-primary-600 transition-colors hover:bg-primary-50 hover:text-primary-800"
                      title="Luật chơi"
                      aria-label="Luật chơi"
                      @click="showTournamentCalculationInfoModal = true"
                    >
                      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0-9h.01"/></svg>
                    </button>
                  </div>
                </div>
                <!-- Badge and Date/Time moved below title -->
                <div class="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-600">
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                        :class="getStatusBadge(ongoingTournament.status)">
                    {{ ongoingTournament.status }}
                  </span>
                  <span>{{ formatDate(ongoingTournament.startDate) }}</span>
                  <button
                    v-if="authStore.hasAnyRole(['admin', 'mod'])"
                    @click="openTournamentTimeModal(ongoingTournament)"
                    class="hover:underline"
                    title="Chỉnh sửa giờ thi đấu"
                  >
                    {{ formatTime(ongoingTournament.startDate) }}
                  </button>
                  <span v-else>{{ formatTime(ongoingTournament.startDate) }}</span>
                </div>
                <!-- Financial Information -->
                <div v-if="systemStore.currentSettings" class="flex flex-wrap items-center gap-4 mt-2 text-sm">
                  <span class="text-green-600 font-medium">
                    💰 Sponsor: {{ getTournamentSponsorMoney(ongoingTournament).toLocaleString('vi-VN') }} ₫
                  </span>
                  <button
                    v-if="authStore.hasAnyRole(['admin', 'mod'])"
                    @click="openStadiumCostModal(ongoingTournament)"
                    class="text-red-600 font-medium hover:underline"
                    title="Chỉnh sửa chi phí sân"
                  >
                    🏟️ Sân: {{ getTournamentStadiumCost(ongoingTournament).toLocaleString('vi-VN') }} ₫
                  </button>
                  <span v-else class="text-red-600 font-medium">
                    🏟️ Sân: {{ getTournamentStadiumCost(ongoingTournament).toLocaleString('vi-VN') }} ₫
                  </span>
                  <span v-for="cost in getTournamentAdditionalCosts(ongoingTournament.id)" :key="cost.id" class="text-orange-600 font-medium">
                    💸 {{ cost.description }}: {{ cost.amount.toLocaleString('vi-VN') }} ₫
                  </span>
                  <span v-if="getTournamentFundContribution(ongoingTournament) > 0" class="text-indigo-600 font-medium">
                    🏦 Trích quỹ: {{ getTournamentFundContribution(ongoingTournament).toLocaleString('vi-VN') }} ₫
                  </span>
                  <span class="text-blue-600 font-medium">
                    📊 Tổng: {{ calculateTournamentNet(ongoingTournament.id).toLocaleString('vi-VN') }} ₫
                  </span>
                  <span v-if="getAttendanceStats(ongoingTournament.id)?.attendingCount" class="text-purple-600 font-medium">
                    👥 Est mỗi cháu: {{ calculateCostPerPlayer(ongoingTournament.id).toLocaleString('vi-VN') }} ₫
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Attendance Progress Bar -->
            <div v-if="attendanceStats.has(ongoingTournament.id)" class="mt-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-gray-200">
              <div class="flex justify-between items-center mb-3">
                <span class="text-sm font-semibold text-gray-800">Điểm danh cầu thủ</span>
                <span class="text-sm font-medium text-gray-700 bg-white px-2 py-1 rounded-full">
                  {{ getHighestFieldAttendanceCount(ongoingTournament.id) }} / {{ getAttendanceStats(ongoingTournament.id)?.totalPlayers || 0 }} · S5: {{ getAttendanceStats(ongoingTournament.id)?.field5Count || 0 }} / S7: {{ getAttendanceStats(ongoingTournament.id)?.field7Count || 0 }}
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
                  <div class="font-semibold text-green-800">S5: {{ getAttendanceStats(ongoingTournament.id)?.field5Count || 0 }} / S7: {{ getAttendanceStats(ongoingTournament.id)?.field7Count || 0 }}</div>
                  <div class="text-green-600">Tham gia</div>
                </button>
                <button
                  @click="openAttendanceModal(ongoingTournament.id, 'water')"
                  class="text-center p-2 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors cursor-pointer"
                >
                  <div class="font-semibold text-blue-800">{{ getWaterCount(ongoingTournament.id) }}</div>
                  <div class="text-blue-600">Uống nước</div>
                </button>
                <button 
                  @click="openAttendanceModal(ongoingTournament.id, 'betting')"
                  class="text-center p-2 bg-yellow-100 rounded-lg hover:bg-yellow-200 transition-colors cursor-pointer"
                >
                  <div class="font-semibold text-yellow-800">{{ getBettingCount(ongoingTournament.id) }}</div>
                  <div class="text-yellow-600">Cược</div>
                </button>
              </div>
            </div>

            <!-- Tournament Teams Display -->
            <div v-if="getTournamentTeams(ongoingTournament).length > 0" class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 class="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.196-2.196M5 20h5v-2a3 3 0 015.196-2.196M12 4v.01M12 4a7 7 0 018 7c0 2-1 3-1 3s-1 1-1 3v2H8v-2s-1-1-1-3c0-2 1-3 1-3a7 7 0 018-7z" />
                </svg>
                Đội thi đấu ({{ getTournamentTeams(ongoingTournament).length }})
              </h4>
              
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <div
                  v-for="team in getTournamentTeams(ongoingTournament)"
                  :key="team.id"
                  class="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-primary-200 hover:shadow-md transition-shadow flex flex-col"
                >
                  <!-- Team Header -->
                  <div class="flex items-center mb-3">
                    <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                      <span class="text-white font-bold text-lg">{{ getTeamNumber(team.name) }}</span>
                    </div>
                    <div class="flex-1">
                      <div class="flex items-center justify-between">
                        <h5 class="font-semibold text-gray-900">{{ team.name }}</h5>
                      </div>
                      <p class="text-sm text-gray-600">{{ team.players?.length || 0 }} cầu thủ</p>
                    </div>
                  </div>

                  <!-- Team Players -->
                  <div v-if="team.players && team.players.length > 0" class="space-y-2">
                    <div
                      v-for="player in team.players"
                      :key="player.id"
                      class="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                      :class="{
                        'bg-yellow-100': isPlayerBetting(ongoingTournament.id, player.id),
                        'border-2 border-red-500': isCurrentUserPlayer(player.id),
                      }"
                    >
                      <div class="flex items-center">
                        <div class="w-6 h-6 shrink-0 overflow-hidden bg-gray-300 rounded-full flex items-center justify-center mr-2 text-xs font-medium">
                          <img v-if="player.avatar" :src="player.avatar" :alt="player.name" class="h-full w-full object-cover">
                          <span v-else>{{ player.name.charAt(0).toUpperCase() }}</span>
                        </div>
                        <span class="font-medium text-gray-900">{{ player.name }}</span>
                        <span v-if="isPlayerWithWater(ongoingTournament.id, player.id)" class="ml-1" title="Đã đăng ký uống nước">💧</span>
                      </div>
                      <div class="flex items-center text-gray-600">
                        <span class="text-xs mr-1 px-1.5 py-0.5 rounded" :class="isGoalkeeper(player.position) ? 'bg-green-100 text-green-700 font-semibold' : ''">{{ getPositionLabel(player.position) }}</span>
                        <span class="text-xs">T{{ player.tier }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="mt-auto">
                    <!-- Team Stats -->
                    <div v-if="team.players && team.players.length > 0" class="pt-3 border-t border-gray-200">
                      <div class="flex justify-between text-xs text-gray-600">
                        <span>Tổng tier: {{ team.players.reduce((sum: number, p: any) => sum + p.tier, 0) }}</span>
                        <span>Trung bình: <strong>{{ (team.players.reduce((sum: number, p: any) => sum + p.tier, 0) / team.players.length).toFixed(1) }}</strong></span>
                      </div>
                    </div>
                    <div v-if="ongoingTournament.status === 'ONGOING'" class="mt-3 pt-3 border-t border-gray-200 text-right">
                      <span class="text-lg font-bold text-blue-600">⚽: {{ team.score || 0 }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Attendance Toggle Button -->
            <div v-if="(ongoingTournament.status === 'UPCOMING' && getTournamentTeams(ongoingTournament).length === 0 && getAttendanceButtonText(ongoingTournament.id) !== 'Không có cầu thủ') || canUserToggleBet(ongoingTournament)" class="flex justify-center pt-2 border-t border-gray-200">
              <div class="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center [&>button]:w-full sm:[&>button]:w-auto">
                <div v-if="ongoingTournament.status === 'UPCOMING' && getTournamentTeams(ongoingTournament).length === 0 && getAttendanceButtonText(ongoingTournament.id) !== 'Không có cầu thủ'" class="w-full sm:w-auto">
                  <button
                    @click="toggleAttendance(ongoingTournament.id)"
                    :disabled="attendanceLoading.has(ongoingTournament.id) || (getAttendanceButtonText(ongoingTournament.id) === 'Tham gia' && cannotSelfRegisterDueToDebt)"
                    :title="cannotSelfRegisterDueToDebt ? 'Vui lòng thanh toán số dư âm trước khi đăng ký' : undefined"
                    class="w-full px-6 py-2 rounded-lg font-medium transition-colors duration-200 sm:w-auto"
                    :class="[
                      attendanceLoading.has(ongoingTournament.id) || (getAttendanceButtonText(ongoingTournament.id) === 'Tham gia' && cannotSelfRegisterDueToDebt)
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:shadow-md',
                        getAttendanceButtonText(ongoingTournament.id) === 'Tham gia'
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : getAttendanceButtonText(ongoingTournament.id) === 'Đã tham gia'
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    ]"
                  >
                    <div class="flex items-center justify-center space-x-1">
                      <span>{{ attendanceLoading.has(ongoingTournament.id) ? 'Đang tải...' : `${getAttendanceButtonText(ongoingTournament.id)}${getAttendanceButtonText(ongoingTournament.id) === 'Đã tham gia' ? ' ✓' : ''}` }}</span>
                    </div>
                  </button>
                  <p v-if="getAttendanceButtonText(ongoingTournament.id) === 'Tham gia' && cannotSelfRegisterDueToDebt" class="mt-2 text-center text-xs font-medium text-red-600">Bạn đang có số dư âm. Vui lòng thanh toán trước khi đăng ký tham gia.</p>
                </div>
                
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
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  ]"
                >
                  <div class="flex items-center justify-center space-x-1">
                    <span>{{ waterLoading.has(ongoingTournament.id) ? 'Đang tải...' : (getUserWaterStatus(ongoingTournament.id) ? 'Nước ✓' : 'Nước') }}</span>
                  </div>
                </button>

                <!-- Bet Button: available before the scheduled start time -->
                <button
                  v-if="canUserToggleBet(ongoingTournament)"
                  @click="toggleBet(ongoingTournament.id)"
                  :disabled="betLoading.has(ongoingTournament.id)"
                  class="px-4 py-2 text-center rounded-lg font-medium transition-colors duration-200"
                  :class="[betLoading.has(ongoingTournament.id) ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md', getUserBetStatus(ongoingTournament.id) ? 'bg-yellow-600 text-white hover:bg-yellow-700' : 'bg-gray-300 text-gray-700 hover:bg-gray-400']"
                >
                  {{ betLoading.has(ongoingTournament.id) ? 'Đang tải...' : (getUserBetStatus(ongoingTournament.id) ? 'Cược đội mình thắng ✓' : 'Cược đội mình thắng') }}
                </button>
                
              </div>
            </div>

            <!-- Random Team Button (Admin/Mod only) -->
            <div class="flex flex-col items-center pt-2 border-t border-gray-200">
              <div class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:[&>button]:w-auto [&>button]:w-full">
                <button
                  v-if="authStore.hasPermission('canEditTournaments') && getTournamentTeams(ongoingTournament).length === 0" 
                  @click="openTeamCountModal(ongoingTournament.id)"
                  :disabled="!canGenerateTeams(ongoingTournament.id) || teamGenerationLoading"
                  class="px-6 py-2 rounded-lg font-medium transition-colors duration-200"
                  :class="[
                    !canGenerateTeams(ongoingTournament.id) || teamGenerationLoading
                      ? 'opacity-50 cursor-not-allowed bg-gray-400 text-white' 
                      : 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md'
                  ]"
                >
                  {{ teamGenerationLoading ? 'Đang chia...' : 'Chia đội ngẫu nhiên' }}
                </button>
                <button
                  v-if="authStore.hasAnyRole(['admin', 'mod']) && ongoingTournament.status === 'UPCOMING' && getTournamentTeams(ongoingTournament).length === 0"
                  @click="openAttendanceModal(ongoingTournament.id, 'pending')"
                  class="px-6 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md transition-colors duration-200"
                >
                  Đăng ký dùm
                </button>
                <button
                  v-if="authStore.hasPermission('canEditTournaments') && ongoingTournament.status === 'UPCOMING' && getTournamentTeams(ongoingTournament).length > 0"
                  @click="openClearTeamsModal(ongoingTournament.id)"
                  class="px-6 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 hover:shadow-md transition-colors duration-200"
                >
                  Xóa đội
                </button>
                <button
                  v-if="authStore.hasPermission('canEditTournaments') && ongoingTournament.status === 'UPCOMING' && getTournamentTeams(ongoingTournament).length > 0"
                  @click="startTournament(ongoingTournament.id)"
                  class="px-6 py-2 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 hover:shadow-md transition-colors duration-200"
                >
                  Bắt đầu giải đấu
                </button>
                <button
                  v-if="authStore.hasPermission('canEditTournaments') && ongoingTournament.status === 'ONGOING' && getTournamentTeams(ongoingTournament).length > 0"
                  @click="openScoresModal(ongoingTournament.id)"
                  class="px-6 py-2 rounded-lg font-medium bg-primary-600 text-white hover:bg-primary-700 hover:shadow-md transition-colors duration-200"
                >
                  Điểm số
                </button>
                <button
                  v-if="authStore.hasRole('admin') && ongoingTournament.status === 'ONGOING'"
                  @click="endTournament(ongoingTournament.id)"
                  :disabled="!canEndTournament(ongoingTournament.id) || endTournamentSaving"
                  :class="[
                    'px-6 py-2 rounded-lg font-medium transition-colors duration-200',
                    canEndTournament(ongoingTournament.id) && !endTournamentSaving
                      ? 'bg-red-600 text-white hover:bg-red-700 hover:shadow-md' 
                      : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  ]"
                >
                  {{ endTournamentSaving ? 'Đang lưu...' : 'Kết thúc giải đấu' }}
                </button>
              </div>
              <div class="text-xs text-gray-500 mt-1 text-center">
                <span v-if="!canGenerateTeams(ongoingTournament.id)">
                  Cần thêm {{ 10 - (getAttendanceStats(ongoingTournament.id)?.attendingCount || 0) }} cầu thủ tham gia
                </span>
                <span v-if="authStore.hasPermission('canEditTournaments') && getTournamentTeams(ongoingTournament).length === 0">
                  Chọn số đội để chia cân bằng
                </span>
                <span v-if="authStore.hasRole('admin') && ongoingTournament.status === 'ONGOING' && !canEndTournament(ongoingTournament.id)" class="text-orange-600">
                  Không thể kết thúc giải đấu vì đang có {{ getTournamentEndStatusMessage(ongoingTournament.id) }}
                </span>
              </div>
            </div>

            <div
              v-if="(authStore.hasRole('admin') && getTournamentTeams(ongoingTournament).length > 0) || (authStore.hasAnyRole(['admin', 'mod']) && ongoingTournament.status !== 'COMPLETED') || (authStore.hasPermission('canDeleteTournaments') && ongoingTournament.status !== 'COMPLETED')"
              class="flex flex-col items-stretch gap-3 pt-2 border-t border-gray-200 sm:flex-row sm:flex-wrap sm:justify-end sm:[&>button]:w-auto [&>button]:w-full"
            >
              <button v-if="authStore.hasRole('admin') && getTournamentTeams(ongoingTournament).length > 0" @click="openAdditionalCostModal(ongoingTournament)" class="btn-secondary">Chi phí phát sinh</button>
              <button
                v-if="authStore.hasAnyRole(['admin', 'mod']) && ongoingTournament.status !== 'COMPLETED'"
                @click="openFundContributionModal(ongoingTournament)"
                class="btn-secondary"
              >
                Trích quỹ
              </button>
              <button
                v-if="authStore.hasPermission('canDeleteTournaments') && ongoingTournament.status !== 'COMPLETED'"
                @click="deleteTournament(ongoingTournament.id)"
                class="px-4 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Xóa giải đấu
              </button>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-8">
          <p class="text-gray-600">Không có giải hằng tuần đang diễn ra</p>
          <p class="text-sm text-gray-500 mt-1">Giải tiếp theo: {{ formatNextMonday(nextMonday) }}</p>
        </div>

        <div class="card mt-4 sm:mt-6">
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700">⚖️</div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900">Logic chia đội</h3>
              <p class="mt-1 text-sm text-gray-600">Hệ thống ưu tiên số lượng cầu thủ, vị trí thủ môn và sức mạnh đội hình để tạo các đội cân bằng nhất có thể.</p>
            </div>
          </div>
          <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4"><h4 class="font-semibold text-gray-900">1. Điều kiện và số đội</h4><p class="mt-1 text-sm text-gray-600">Cần ít nhất 10 cầu thủ đã tham gia. Admin/mod chọn 2, 3 hoặc 4 đội; số cầu thủ giữa các đội được phân bổ chênh lệch tối đa 1 người.</p></div>
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4"><h4 class="font-semibold text-gray-900">2. Phân bổ thủ môn</h4><p class="mt-1 text-sm text-gray-600">Thủ môn được xếp trước, ưu tiên mỗi đội một GK. GK còn lại được đưa vào đội có ít GK nhất để giữ cân bằng vị trí.</p></div>
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4"><h4 class="font-semibold text-gray-900">3. Ưu tiên Tier 1 và Tier 2</h4><p class="mt-1 text-sm text-gray-600">Tier 1 và Tier 2 là cầu thủ mạnh, được chia trước theo thứ tự Tier 1 rồi Tier 2. Khi chia Tier 2, đội có ít Tier 1 hơn sẽ được ưu tiên trước.</p></div>
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4"><h4 class="font-semibold text-gray-900">4. Cân bằng cuối cùng</h4><p class="mt-1 text-sm text-gray-600">Các Tier 3–6 được xếp theo sức chứa và tổng Tier. Sau đó hệ thống đổi tối đa 100 cặp cầu thủ phù hợp để giảm chênh lệch Tier trung bình; Tier 1/2 và GK chính được giữ ổn định.</p></div>
          </div>
          <p class="mt-4 text-xs text-gray-500">Trong cùng một Tier, thứ tự cầu thủ được xáo trộn để kết quả mỗi lần chia đội không hoàn toàn giống nhau.</p>
        </div>
      </div>

      <!-- Old Tournaments Tab -->
      <div v-else-if="activeFilter === 'Giải đấu cũ'">
        <div class="mb-4 flex justify-end">
          <button type="button" class="btn-secondary" @click="openOldTournamentDateModal">
            {{ oldTournamentDateFilter ? `Ngày: ${formatOldTournamentFilterDate(oldTournamentDateFilter)}` : 'Lọc theo ngày' }}
          </button>
        </div>
        <div class="space-y-3 sm:space-y-4">
          <div
            v-for="tournament in selectedOldTournament ? [selectedOldTournament] : []"
            :key="tournament.id"
            class="card transition-colors duration-200"
            :class="getCardBackgroundClass(tournament.id)"
          >
            <div class="flex flex-col space-y-4">
              <!-- Tournament Info -->
              <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0">
                <div class="flex-1">
                  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div class="flex min-w-0 flex-wrap items-center gap-2">
                      <h3 class="text-lg font-semibold text-gray-900">{{ tournament.name }}</h3>
                      <span class="inline-flex shrink-0 whitespace-nowrap rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">{{ tournament.pitchType === 'FIELD_5' ? 'Sân 5' : 'Sân 7' }}</span>
                    </div>
                    <!-- Action buttons moved to top right - hide money icon if no teams -->
                    <div class="flex items-center space-x-2 mt-2 sm:mt-0">
                      <button
                        v-if="authStore.hasPermission('canDeleteTournaments') && tournament.status !== 'COMPLETED'"
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
                        💰 Sponsor: {{ getTournamentSponsorMoney(tournament).toLocaleString('vi-VN') }} ₫
                      </span>
                      <span class="text-red-600 font-medium">
                        🏟️ Sân: {{ getTournamentStadiumCost(tournament).toLocaleString('vi-VN') }} ₫
                      </span>
                    <span v-for="cost in getTournamentAdditionalCosts(tournament.id)" :key="cost.id" class="text-orange-600 font-medium">
                      💸 {{ cost.description }}: {{ cost.amount.toLocaleString('vi-VN') }} ₫
                    </span>
                      <span v-if="getTournamentFundContribution(tournament) > 0" class="text-indigo-600 font-medium">
                        🏦 Trích quỹ: {{ getTournamentFundContribution(tournament).toLocaleString('vi-VN') }} ₫
                      </span>
                      <span class="text-blue-600 font-medium">
                        📊 Tổng: {{ calculateTournamentNet(tournament.id).toLocaleString('vi-VN') }} ₫
                      </span>
                      <span v-if="getAttendanceStats(tournament.id)?.attendingCount" class="text-purple-600 font-medium">
                        👥 Est mỗi cháu: {{ calculateCostPerPlayer(tournament.id).toLocaleString('vi-VN') }} ₫
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
                  <span class="text-sm font-semibold text-gray-800">Điểm danh cầu thủ</span>
                  <span class="text-sm font-medium text-gray-700 bg-white px-2 py-1 rounded-full">
                    {{ getHighestFieldAttendanceCount(tournament.id) }} / {{ getAttendanceStats(tournament.id)?.totalPlayers || 0 }}
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
                    <div class="font-semibold text-green-800">{{ getHighestFieldAttendanceCount(tournament.id) }}</div>
                    <div class="text-green-600">Tham gia</div>
                  </button>
                <button
                  @click="openAttendanceModal(tournament.id, 'water')"
                  class="text-center p-2 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors cursor-pointer"
                >
                  <div class="font-semibold text-blue-800">{{ getWaterCount(tournament.id) }}</div>
                  <div class="text-blue-600">Uống nước</div>
                </button>
                  <button 
                    @click="openAttendanceModal(tournament.id, 'betting')"
                    class="text-center p-2 bg-yellow-100 rounded-lg hover:bg-yellow-200 transition-colors cursor-pointer"
                  >
                    <div class="font-semibold text-yellow-800">{{ getBettingCount(tournament.id) }}</div>
                    <div class="text-yellow-600">Cược</div>
                  </button>
                </div>
              </div>

              <!-- Tournament Teams Display -->
              <div v-if="getTournamentTeams(tournament).length > 0" class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 class="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                  <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.196-2.196M5 20h5v-2a3 3 0 015.196-2.196M12 4v.01M12 4a7 7 0 018 7c0 2-1 3-1 3s-1 1-1 3v2H8v-2s-1-1-1-3c0-2 1-3 1-3a7 7 0 018-7z" />
                  </svg>
                  Đội thi đấu ({{ getTournamentTeams(tournament).length }})
                </h4>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <div
                    v-for="team in getTournamentTeams(tournament)"
                    :key="team.id"
                    class="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow flex flex-col"
                  >
                    <!-- Team Header -->
                    <div class="flex items-center mb-3">
                      <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                        <span class="text-white font-bold text-lg">{{ getTeamNumber(team.name) }}</span>
                      </div>
                      <div class="flex-1">
                        <div class="flex items-center">
                          <h5 class="font-semibold text-gray-900">{{ team.name }}</h5>
                        </div>
                        <p class="text-sm text-gray-600">{{ team.players?.length || 0 }} cầu thủ</p>
                      </div>
                    </div>

                    <!-- Team Players -->
                    <div v-if="team.players && team.players.length > 0" class="space-y-2">
                      <div
                        v-for="player in team.players"
                        :key="player.id"
                        class="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                        :class="{
                          'bg-yellow-100': isPlayerBetting(tournament.id, player.id),
                          'border-2 border-red-500': isCurrentUserPlayer(player.id),
                        }"
                      >
                        <div class="flex items-center">
                          <div class="w-6 h-6 shrink-0 overflow-hidden bg-gray-300 rounded-full flex items-center justify-center mr-2 text-xs font-medium">
                            <img v-if="player.avatar" :src="player.avatar" :alt="player.name" class="h-full w-full object-cover">
                            <span v-else>{{ player.name.charAt(0).toUpperCase() }}</span>
                          </div>
                          <span class="font-medium text-gray-900">{{ player.name }}</span>
                          <span v-if="isPlayerWithWater(tournament.id, player.id)" class="ml-1" title="Đã đăng ký uống nước">💧</span>
                        </div>
                        <div class="flex items-center text-gray-600">
                          <span class="text-xs mr-1 px-1.5 py-0.5 rounded" :class="isGoalkeeper(player.position) ? 'bg-green-100 text-green-700 font-semibold' : ''">{{ getPositionLabel(player.position) }}</span>
                          <span class="text-xs">T{{ player.tier }}</span>
                        </div>
                      </div>
                    </div>

                    <div class="mt-auto">
                      <!-- Team Stats -->
                      <div v-if="team.players && team.players.length > 0" class="pt-3 border-t border-gray-200">
                        <div class="flex justify-between text-xs text-gray-600">
                          <span>Tổng tier: {{ team.players.reduce((sum: number, p: any) => sum + p.tier, 0) }}</span>
                          <span>Trung bình: <strong>{{ (team.players.reduce((sum: number, p: any) => sum + p.tier, 0) / team.players.length).toFixed(1) }}</strong></span>
                        </div>
                      </div>
                      <div v-if="tournament.status === 'COMPLETED'" class="mt-3 pt-3 border-t border-gray-200 text-right">
                        <span class="text-lg font-bold text-gray-600">⚽: {{ team.score || 0 }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex justify-end gap-3 pt-2 border-t border-gray-200">
                <button
                  v-if="authStore.hasRole('admin') && getTournamentTeams(tournament).length > 0"
                  @click="openAdditionalCostModal(tournament)"
                  class="btn-secondary"
                >
                  Xem chi phí phát sinh
                </button>
                <button @click="openTournamentMoneyHistory(tournament)" class="btn-secondary">Xem biến động tiền</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="filteredOldTournaments.length > 0" class="mt-6 flex items-center justify-center gap-3">
          <button type="button" class="btn-secondary" :disabled="oldTournamentIndex === 0" @click="navigateOldTournament(-1)">Trước</button>
          <span class="text-sm text-gray-600">{{ oldTournamentIndex + 1 }} / {{ filteredOldTournaments.length }}</span>
          <button type="button" class="btn-secondary" :disabled="oldTournamentIndex >= filteredOldTournaments.length - 1" @click="navigateOldTournament(1)">Sau</button>
        </div>

        <!-- No tournaments message -->
        <div v-if="filteredOldTournaments.length === 0 && !tournamentsStore.loading" class="text-center py-8">
          <p class="text-gray-600">Không có giải hằng tuần hoàn thành trong ngày đã chọn</p>
        </div>
      </div>
    </div>
  </div>

  <div v-if="showOldTournamentDateModal" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" @click.self="showOldTournamentDateModal = false">
    <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
      <div class="flex items-center justify-between border-b pb-4">
        <h3 class="text-lg font-semibold text-gray-900">Lọc giải đấu theo ngày</h3>
        <button type="button" class="text-2xl leading-none text-gray-400 hover:text-gray-700" @click="showOldTournamentDateModal = false">×</button>
      </div>
      <div class="py-5">
        <div class="mb-4 flex items-center justify-between">
          <button type="button" class="rounded p-2 text-lg hover:bg-gray-100" aria-label="Tháng trước" @click="changeOldTournamentCalendarMonth(-1)">‹</button>
          <div class="text-center">
            <p class="font-semibold capitalize text-gray-900">{{ oldTournamentCalendarLabel }}</p>
            <p v-if="oldTournamentCalendarLoading" class="text-xs text-gray-500">Đang tải lịch giải...</p>
          </div>
          <button type="button" class="rounded p-2 text-lg hover:bg-gray-100" aria-label="Tháng sau" @click="changeOldTournamentCalendarMonth(1)">›</button>
        </div>
        <div class="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500">
          <span v-for="weekday in oldTournamentWeekdays" :key="weekday" class="py-1">{{ weekday }}</span>
        </div>
        <div class="mt-1 grid grid-cols-7 gap-1">
          <div v-for="(day, index) in oldTournamentCalendarDays" :key="day ? toLocalDateKey(day) : `empty-${index}`" class="aspect-square">
            <button
              v-if="day"
              type="button"
              class="h-full w-full rounded-md text-sm transition-colors"
              :class="[
                oldTournamentDateDraft === toLocalDateKey(day) ? 'bg-primary-600 font-bold text-white' : 'hover:bg-primary-50',
                completedTournamentDates.has(toLocalDateKey(day)) && oldTournamentDateDraft !== toLocalDateKey(day) ? 'font-bold text-primary-700' : 'text-gray-700'
              ]"
              :title="completedTournamentDates.has(toLocalDateKey(day)) ? 'Có giải đấu đã hoàn thành' : undefined"
              @click="oldTournamentDateDraft = toLocalDateKey(day)"
            >
              {{ day.getDate() }}
            </button>
          </div>
        </div>
        <p class="mt-3 text-xs text-gray-500"><strong class="text-primary-700">Ngày in đậm</strong> có giải đấu đã hoàn thành.</p>
      </div>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" class="btn-secondary" @click="clearOldTournamentDateFilter">Xóa lọc</button>
        <button type="button" class="btn-primary" @click="applyOldTournamentDateFilter">Áp dụng</button>
      </div>
    </div>
  </div>

  <div v-if="showTournamentCalculationInfoModal && ongoingTournament" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" @click.self="showTournamentCalculationInfoModal = false">
    <div class="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl" role="dialog" aria-modal="true" aria-labelledby="tournament-calculation-title">
      <div class="flex items-center justify-between border-b p-5">
        <div>
          <h3 id="tournament-calculation-title" class="text-lg font-semibold text-gray-900">Luật chơi</h3>
          <p class="text-sm text-gray-500">{{ ongoingTournament.name }}</p>
        </div>
        <button type="button" class="text-2xl text-gray-400 hover:text-gray-700" aria-label="Đóng" @click="showTournamentCalculationInfoModal = false">×</button>
      </div>
      <div class="overflow-y-auto p-5 space-y-5 text-sm text-gray-700">
        <section>
          <h4 class="font-semibold text-gray-900">1. Đăng ký tham gia</h4>
          <ul class="mt-2 space-y-1 leading-6">
            <li>• Chọn <strong>Tham gia</strong> khi giải đang mở đăng ký; hệ thống sẽ lưu thời điểm đăng ký.</li>
            <li>• Cầu thủ có số dư âm cần thanh toán trước khi tự đăng ký tham gia.</li>
            <li>• Khi đã chia đội, không thể tự thay đổi trạng thái tham gia. Admin/mod có thể đăng ký giúp trước khi chia đội.</li>
          </ul>
        </section>
        <section>
          <h4 class="font-semibold text-gray-900">2. Cược đội mình thắng</h4>
          <ul class="mt-2 space-y-1 leading-6">
            <li>• Chỉ cầu thủ đã tham gia mới có thể chọn cược trước giờ bắt đầu giải đấu.</li>
            <li>• Khi đã chọn, nút hiển thị dấu ✓ và dòng cầu thủ trong danh sách đội được tô vàng nhạt.</li>
            <li>• Cược thắng: +10.000 ₫; cược thua: -10.000 ₫.</li>
          </ul>
        </section>
        <section>
          <h4 class="font-semibold text-gray-900">3. Uống nước</h4>
          <ul class="mt-2 space-y-1 leading-6">
            <li>• Cầu thủ đã tham gia có thể bật hoặc tắt lựa chọn <strong>Nước</strong> trước giờ thi đấu.</li>
            <li>• Lựa chọn đã bật hiển thị dấu ✓ ở nút Nước và icon 💧 cạnh tên cầu thủ trong danh sách đội.</li>
            <li>• Chi phí nước là -10.000 ₫; cầu thủ thuộc đội thắng được miễn phí nước.</li>
          </ul>
        </section>
        <section>
          <h4 class="font-semibold text-gray-900">4. Chi phí cơ bản</h4>
          <div class="mt-2 space-y-1 rounded-lg bg-gray-50 p-3">
            <div class="flex justify-between gap-3"><span>Chi phí sân</span><strong>{{ getTournamentStadiumCost(ongoingTournament).toLocaleString('vi-VN') }} ₫</strong></div>
            <div class="flex justify-between gap-3"><span>Chi phí phát sinh</span><strong>{{ getTournamentAdditionalCostsTotal(ongoingTournament.id).toLocaleString('vi-VN') }} ₫</strong></div>
            <div class="flex justify-between gap-3 text-green-700"><span>Trừ tiền tài trợ</span><strong>-{{ getTournamentSponsorMoney(ongoingTournament).toLocaleString('vi-VN') }} ₫</strong></div>
            <div v-if="getTournamentFundContribution(ongoingTournament) > 0" class="flex justify-between gap-3 text-indigo-700"><span>Trừ phần trích quỹ</span><strong>-{{ getTournamentFundContribution(ongoingTournament).toLocaleString('vi-VN') }} ₫</strong></div>
            <div class="flex justify-between gap-3 border-t pt-2 font-semibold text-gray-900"><span>Tổng cần chia</span><span>{{ calculateTournamentNet(ongoingTournament.id).toLocaleString('vi-VN') }} ₫</span></div>
          </div>
        </section>
        <section>
          <h4 class="font-semibold text-gray-900">5. Số tiền mỗi cầu thủ</h4>
          <p class="mt-1 leading-6">Tổng cần chia được chia cho số cầu thủ tham gia, làm tròn lên bội số 5.000 ₫ rồi cộng thêm 5.000 ₫.</p>
          <p v-if="getAttendanceStats(ongoingTournament.id)?.attendingCount" class="mt-2 rounded-lg bg-primary-50 p-3 font-medium text-primary-800">Tạm tính {{ getAttendanceStats(ongoingTournament.id)?.attendingCount }} cầu thủ: {{ calculateCostPerPlayer(ongoingTournament.id).toLocaleString('vi-VN') }} ₫/người.</p>
          <p class="mt-2">Thủ môn (GK) được giảm 50% chi phí cơ bản, trừ khi admin/mod hủy ưu đãi này lúc kết thúc giải.</p>
        </section>
        <section>
          <h4 class="font-semibold text-gray-900">6. Điều chỉnh khi kết thúc giải</h4>
          <ul class="mt-2 space-y-1 leading-6">
            <li>• Cược thắng: +10.000 ₫; cược thua: -10.000 ₫.</li>
            <li>• Cầu thủ đội thua: -10.000 ₫.</li>
            <li>• Người chọn nước: -10.000 ₫; đội thắng được miễn phí nước.</li>
            <li>• Giải chỉ có thể kết thúc khi xác định được đúng một đội thắng và đúng một đội thua; không thể có hai đội thắng hoặc hai đội thua.</li>
            <li>• Nếu hai đội đồng điểm sau trận, hai đội phải đá Penalty 3 quả để phân định thắng thua.</li>
            <li>• Nếu vẫn hòa sau 3 quả Penalty, hai đội oẳn tù tì để phân định thắng thua.</li>
          </ul>
        </section>
      </div>
      <div class="flex justify-end border-t p-4"><button type="button" class="btn-primary" @click="showTournamentCalculationInfoModal = false">Đóng</button></div>
    </div>
  </div>

  <div v-if="showTournamentMoneyHistoryModal" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" @click.self="showTournamentMoneyHistoryModal = false">
    <div class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
      <div class="flex items-center justify-between border-b p-5"><div><h3 class="text-lg font-semibold text-gray-900">Biến động tiền cầu thủ</h3><p class="text-sm text-gray-500">{{ selectedMoneyHistoryTournament?.name }}</p></div><button @click="showTournamentMoneyHistoryModal = false" class="text-2xl text-gray-400 hover:text-gray-700">×</button></div>
      <div class="overflow-y-auto p-5"><div v-if="tournamentMoneyHistoryLoading" class="py-8 text-center text-gray-500">Đang tải...</div><div v-else-if="!tournamentMoneyHistory.length" class="py-8 text-center text-gray-500">Chưa có lịch sử biến động tiền.</div><div v-else class="space-y-3"><div v-for="item in tournamentMoneyHistory" :key="item.id" class="rounded-lg border p-4" :class="isCurrentUserPlayer(item.player.id) ? 'border-red-500 bg-red-50' : 'border-gray-200'"><div class="flex justify-between gap-3"><div class="min-w-0"><p class="font-medium text-gray-900">{{ item.player.name }}</p><p class="text-xs text-gray-500">{{ item.description }}</p></div><span class="shrink-0 whitespace-nowrap font-semibold" :class="item.amount >= 0 ? 'text-green-600' : 'text-red-600'">{{ item.amount >= 0 ? '+' : '' }}{{ item.amount.toLocaleString('vi-VN') }} ₫</span></div><div v-if="item.details?.length" class="mt-3 space-y-1 border-t pt-3 text-xs"><div v-for="detail in item.details" :key="`${detail.description}-${detail.amount}`" class="flex justify-between gap-3 text-gray-600"><span class="min-w-0">{{ detail.description }}</span><span class="shrink-0 whitespace-nowrap text-gray-900">{{ detail.amount >= 0 ? '+' : '' }}{{ detail.amount.toLocaleString('vi-VN') }} ₫</span></div></div><div class="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-gray-500"><span>Trước: <strong>{{ item.balanceBefore.toLocaleString('vi-VN') }} ₫</strong></span><div class="flex items-center gap-2"><span>Sau: <strong :class="item.balanceAfter < 0 ? 'text-red-600' : 'text-gray-900'">{{ item.balanceAfter.toLocaleString('vi-VN') }} ₫</strong></span><button v-if="isCurrentUserPlayer(item.player.id) && item.balanceAfter < 0" type="button" class="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700" @click="openTournamentDebtTopUp(item)">Thanh toán</button></div></div></div></div></div>
      <div class="flex justify-end border-t p-4"><button @click="showTournamentMoneyHistoryModal = false" class="btn-primary">Đóng</button></div>
    </div>
  </div>

  <div v-if="showTournamentDebtTopUpModal" class="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/50 p-4" @click.self="showTournamentDebtTopUpModal = false">
    <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
      <h2 class="text-lg font-semibold text-gray-900">Nạp tiền</h2>
      <p class="mb-4 mt-1 text-sm text-gray-500">Quét mã MoMo để nạp quỹ, sau đó chọn số tiền đã nạp. Yêu cầu sẽ chờ quản trị viên duyệt.</p>
      <img src="/quy-momo.jpg" alt="Mã QR MoMo nạp quỹ" class="mx-auto mb-5 w-full max-w-xs rounded-lg border border-gray-200">
      <div class="grid grid-cols-2 gap-3"><button v-for="amount in tournamentDebtTopUpAmounts" :key="amount" type="button" class="rounded-lg border px-4 py-3 font-medium transition-colors" :class="selectedTournamentDebtTopUpAmount === amount ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'" @click="selectedTournamentDebtTopUpAmount = amount">{{ amount.toLocaleString('vi-VN') }} ₫</button></div>
      <div class="mt-6 flex justify-end gap-3"><button type="button" class="btn-secondary" @click="showTournamentDebtTopUpModal = false">Hủy</button><button type="button" class="btn-primary" :disabled="tournamentDebtTopUpSubmitting" @click="submitTournamentDebtTopUp">{{ tournamentDebtTopUpSubmitting ? 'Đang gửi...' : 'Xác nhận' }}</button></div>
    </div>
  </div>

  <div v-if="showFieldRegistrationModal" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" @click.self="closeFieldRegistrationModal">
    <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
      <h3 class="text-lg font-semibold text-gray-900">Chọn sân đăng ký</h3>
      <p class="mt-1 text-sm text-gray-600">Bạn có thể đăng ký một hoặc cả hai sân.</p>
      <div class="mt-5 grid grid-cols-2 gap-3">
        <button type="button" class="rounded-lg border-2 px-4 py-4 font-semibold transition-colors" :class="registrationField5 ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-200 text-gray-700 hover:border-primary-400'" @click="registrationField5 = !registrationField5">Sân 5 {{ registrationField5 ? '✓' : '' }}</button>
        <button type="button" class="rounded-lg border-2 px-4 py-4 font-semibold transition-colors" :class="registrationField7 ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-200 text-gray-700 hover:border-primary-400'" @click="registrationField7 = !registrationField7">Sân 7 {{ registrationField7 ? '✓' : '' }}</button>
      </div>
      <p v-if="!registrationField5 && !registrationField7" class="mt-3 text-sm text-red-600">Vui lòng chọn ít nhất một sân.</p>
      <div class="mt-6 flex justify-end gap-3"><button type="button" class="btn-secondary" @click="closeFieldRegistrationModal">Hủy</button><button type="button" class="btn-primary" :disabled="!registrationField5 && !registrationField7" @click="confirmFieldRegistration">Xác nhận</button></div>
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
        <div class="mb-4">
          <label class="form-label">Tìm theo tên cầu thủ</label>
          <input v-model="attendancePlayerNameFilter" type="text" class="form-input mt-1" placeholder="Nhập tên cầu thủ...">
        </div>
        <div v-if="attendanceModalType === 'attending'" class="mb-4 flex gap-2">
          <button type="button" class="rounded-lg px-4 py-2 text-sm font-medium" :class="attendanceFieldTab === 'FIELD_5' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'" @click="attendanceFieldTab = 'FIELD_5'">Sân 5</button>
          <button type="button" class="rounded-lg px-4 py-2 text-sm font-medium" :class="attendanceFieldTab === 'FIELD_7' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'" @click="attendanceFieldTab = 'FIELD_7'">Sân 7</button>
        </div>
        <div v-if="attendanceModalType === 'pending'" class="mb-4">
          <p class="form-label">Lọc theo Tier</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button type="button" class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors" :class="attendancePlayerTierFilter === null ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'" @click="attendancePlayerTierFilter = null">Tất cả</button>
            <button v-for="tier in 6" :key="tier" type="button" class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors" :class="attendancePlayerTierFilter === tier ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'" @click="attendancePlayerTierFilter = tier">Tier {{ tier }}</button>
          </div>
        </div>
        <div v-if="attendanceModalType === 'pending' && authStore.hasAnyRole(['admin', 'mod']) && !attendanceModalLoading && getFilteredModalData().length" class="mb-4 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <button
            type="button"
            class="flex items-center gap-2 font-medium hover:text-blue-700"
            :aria-pressed="areAllPendingPlayersSelected"
            @click="toggleAllPendingPlayers"
          >
            <span class="flex h-5 w-5 items-center justify-center rounded border transition-colors" :class="areAllPendingPlayersSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-300 bg-white'">{{ areAllPendingPlayersSelected ? '✓' : '' }}</span>
            Chọn tất cả ({{ getFilteredModalData().length }})
          </button>
          <span>{{ selectedPendingPlayerIds.size }} đã chọn</span>
        </div>
        <!-- Loading State -->
        <div v-if="attendanceModalLoading" class="text-center py-8">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p class="text-gray-600 mt-2">Đang tải cầu thủ...</p>
        </div>
        
        <!-- No Data State -->
        <div v-else-if="getFilteredModalData().length === 0" class="text-center py-8">
          <p class="text-gray-600">Không có cầu thủ {{ attendanceModalType === 'pending' ? 'chưa phản hồi' : attendanceModalType === 'attending' ? 'tham gia' : attendanceModalType === 'not-attending' ? 'không tham gia' : attendanceModalType === 'water' ? 'uống nước' : 'cược' }} giải đấu này.</p>
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
                    :title="attendance.withWater ? 'Nhấn để bỏ chọn nước' : 'Nhấn để chọn nước'"
                  >
                    <div v-if="playerWaterLoading.has(attendance.player.id)" class="flex items-center">
                      <div class="animate-spin rounded-full h-3 w-3 border-b border-current mr-1"></div>
                      <span>Đang tải...</span>
                    </div>
                    <span v-else>
                      <span class="sm:hidden">{{ attendance.withWater ? '💧' : '🚫' }}</span>
                      <span class="hidden sm:inline">{{ attendance.withWater ? '💧 Có uống nước' : '🚫 Không uống nước' }}</span>
                    </span>
                  </button>
                  <button
                    @click="cancelPlayerAttendance(attendance)"
                    :disabled="playerAttendanceLoading.has(attendance.player.id)"
                    :title="`Hủy ${attendanceFieldTab === 'FIELD_5' ? 'Sân 5' : 'Sân 7'}`"
                    class="ml-2 rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    <span v-if="playerAttendanceLoading.has(attendance.player.id)">Đang cập nhật...</span>
                    <template v-else><span class="sm:hidden">✕</span><span class="hidden sm:inline">Hủy {{ attendanceFieldTab === 'FIELD_5' ? 'Sân 5' : 'Sân 7' }}</span></template>
                  </button>
                </div>
              </div>
              
              <!-- Player Details Row -->
              <div class="mt-1 flex items-center justify-between gap-3">
                <span class="text-sm text-gray-600">{{ attendance.player.position }} - Tier {{ attendance.player.tier }}</span>
                <span v-if="attendanceModalType === 'attending' && attendance.registeredAt" class="shrink-0 text-xs text-gray-500">{{ formatRegistrationTime(attendance.registeredAt) }}</span>
              </div>
            </div>
            <button
              v-if="attendanceModalType === 'pending' && authStore.hasAnyRole(['admin', 'mod'])"
              type="button"
              class="ml-3 flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-full border text-sm font-bold transition-colors"
              :class="selectedPendingPlayerIds.has(attendance.player.id) ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-transparent hover:border-blue-400'"
              :aria-label="`Chọn ${attendance.player.name}`"
              :aria-pressed="selectedPendingPlayerIds.has(attendance.player.id)"
              @click="togglePendingPlayer(attendance.player.id)"
            >
              ✓
            </button>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="flex items-center justify-between border-t border-gray-200 bg-gray-50 p-6" :class="attendanceModalType === 'pending' ? 'flex-col' : ''">
        <p v-if="attendanceModalType !== 'pending'" class="text-sm text-gray-600">
          {{ getFilteredModalData().length }} cầu thủ {{ attendanceModalType === 'attending' ? 'tham gia' : attendanceModalType === 'not-attending' ? 'không tham gia' : attendanceModalType === 'water' ? 'uống nước' : 'cược' }}
        </p>
        <div class="flex items-center gap-3" :class="attendanceModalType === 'pending' ? 'w-full flex-col sm:w-auto sm:flex-row' : ''">
          <button
            v-if="attendanceModalType === 'pending' && authStore.hasAnyRole(['admin', 'mod'])"
            @click="registerSelectedPlayers"
            :disabled="selectedPendingPlayerIds.size === 0 || batchAttendanceSaving"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            :class="attendanceModalType === 'pending' ? 'w-full sm:w-auto' : ''"
          >
            {{ batchAttendanceSaving ? 'Đang đăng ký...' : `Đăng ký (${selectedPendingPlayerIds.size})` }}
          </button>
          <button
            @click="closeAttendanceModal"
            :disabled="batchAttendanceSaving"
            class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            :class="attendanceModalType === 'pending' ? 'w-full sm:w-auto' : ''"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  </div>

  <div v-if="showStadiumCostModal" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" @click.self="closeStadiumCostModal">
    <form class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" @submit.prevent="saveStadiumCost">
      <div class="flex items-center justify-between border-b pb-4">
        <div><h3 class="text-lg font-semibold text-gray-900">Chỉnh sửa chi phí sân</h3><p class="text-sm text-gray-500">{{ stadiumCostTournament?.name }}</p></div>
        <button type="button" @click="closeStadiumCostModal" class="text-2xl text-gray-400 hover:text-gray-700">×</button>
      </div>
      <div class="py-5">
        <label for="stadium-cost" class="form-label">Chi phí sân</label>
        <div class="relative mt-1"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₫</span><input id="stadium-cost" v-model.number="stadiumCostForm" type="number" min="0" required class="form-input pl-8" placeholder="Nhập chi phí sân"></div>
      </div>
      <div class="flex justify-end gap-3 border-t pt-4"><button type="button" @click="closeStadiumCostModal" class="btn-secondary">Hủy</button><button type="submit" :disabled="stadiumCostSaving" class="btn-primary disabled:opacity-50">{{ stadiumCostSaving ? 'Đang lưu...' : 'Lưu' }}</button></div>
    </form>
  </div>

  <div v-if="showTournamentTimeModal" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" @click.self="closeTournamentTimeModal">
    <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
      <div class="flex items-center justify-between border-b pb-4">
        <div><h3 class="text-lg font-semibold text-gray-900">Chỉnh sửa giờ thi đấu</h3><p class="text-sm text-gray-500">{{ timeTournament?.name }}</p></div>
        <button type="button" @click="closeTournamentTimeModal" class="text-2xl text-gray-400 hover:text-gray-700">×</button>
      </div>
      <div class="py-5"><p class="form-label mb-3">Chọn giờ bắt đầu</p><div class="grid grid-cols-3 gap-3"><button v-for="time in tournamentTimeOptions" :key="time" type="button" @click="selectedTournamentTime = time" class="rounded-lg border px-3 py-3 font-medium transition-colors" :class="selectedTournamentTime === time ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'">{{ time }}</button></div></div>
      <div class="flex justify-end gap-3 border-t pt-4"><button type="button" @click="closeTournamentTimeModal" class="btn-secondary">Hủy</button><button type="button" @click="saveTournamentTime" :disabled="tournamentTimeSaving" class="btn-primary disabled:opacity-50">{{ tournamentTimeSaving ? 'Đang lưu...' : 'Lưu' }}</button></div>
    </div>
  </div>

  <div v-if="showFundContributionModal" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" @click.self="closeFundContributionModal">
    <form class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" @submit.prevent="saveFundContribution">
      <div class="flex items-center justify-between border-b pb-4"><div><h3 class="text-lg font-semibold text-gray-900">Trích quỹ</h3><p class="text-sm text-gray-500">{{ fundContributionTournament?.name }}</p></div><button type="button" @click="closeFundContributionModal" class="text-2xl text-gray-400 hover:text-gray-700">×</button></div>
      <div class="py-5"><p class="form-label mb-3">Chọn số tiền trích quỹ</p><div class="grid grid-cols-2 gap-3"><button v-for="amount in fundContributionOptions" :key="amount" type="button" @click="fundContributionForm = amount" class="rounded-lg border px-4 py-3 font-medium transition-colors" :class="fundContributionForm === amount ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'">{{ amount.toLocaleString('vi-VN') }} ₫</button></div><label for="fund-contribution" class="form-label mt-5 block">Hoặc nhập số tiền khác</label><div class="relative mt-1"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₫</span><input id="fund-contribution" v-model.number="fundContributionForm" type="number" min="0" required class="form-input pl-8" placeholder="Nhập số tiền trích quỹ"></div></div>
      <div class="flex justify-end gap-3 border-t pt-4"><button type="button" @click="closeFundContributionModal" class="btn-secondary">Hủy</button><button type="submit" :disabled="fundContributionSaving" class="btn-primary disabled:opacity-50">{{ fundContributionSaving ? 'Đang lưu...' : 'Lưu' }}</button></div>
    </form>
  </div>

  <!-- Additional Cost Modal -->
  <div v-if="showAdditionalCostModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-md">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-semibold">Chi phí phát sinh</h2>
        <button @click="closeAdditionalCostModal" class="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>
      
      <!-- Add/Edit Cost Form -->
      <form v-if="selectedTournamentForCosts?.status !== 'COMPLETED'" @submit.prevent="saveAdditionalCost" class="space-y-4 mb-6">
        <div>
          <label class="form-label">Mô tả</label>
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
            Mô tả phải có ít nhất 3 ký tự
          </p>
        </div>
        
        <div>
          <label class="form-label">Số tiền</label>
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
            Số tiền phải là số hợp lệ lớn hơn 0
          </p>
        </div>
        
        <button 
          type="submit" 
          :disabled="additionalCostLoading || !isFormValid"
          class="btn-primary w-full"
          :class="{ 'opacity-50 cursor-not-allowed': additionalCostLoading || !isFormValid }"
        >
          {{ additionalCostLoading ? (editingCostId ? 'Đang cập nhật...' : 'Đang thêm...') : (editingCostId ? 'Cập nhật chi phí' : 'Thêm chi phí') }}
        </button>
        <button 
          v-if="editingCostId"
          type="button"
          @click="cancelEdit"
          class="btn-secondary w-full mt-2"
        >
          Hủy chỉnh sửa
        </button>
      </form>
      
      <!-- Additional Costs List -->
      <div>
        <h3 class="font-medium text-gray-900 mb-3">Chi phí phát sinh hiện tại</h3>
        <div v-if="currentAdditionalCosts.length === 0" class="text-gray-500 text-sm">
          Chưa có chi phí phát sinh
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="cost in currentAdditionalCosts"
            :key="cost.id"
            class="flex justify-between items-center p-3 bg-gray-50 rounded"
          >
            <div>
              <div class="font-medium">{{ cost.description }}</div>
              <div class="text-sm text-gray-500">{{ cost.amount.toLocaleString('vi-VN') }} ₫</div>
            </div>
            <div v-if="selectedTournamentForCosts?.status !== 'COMPLETED'" class="flex space-x-2">
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
                title="Xóa chi phí"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
        
        <!-- Total -->
        <div v-if="currentAdditionalCosts.length > 0" class="mt-4 pt-4 border-t">
          <div class="flex justify-between font-semibold">
            <span>Tổng chi phí phát sinh:</span>
            <span>{{ totalAdditionalCosts.toLocaleString('vi-VN') }} ₫</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Tournament Score Modal -->
  <div v-if="showScoresModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" @click="showScoresModal = false">
    <div class="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto" @click.stop>
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Điểm số giải đấu</h3>
      
      <!-- Team scores -->
      <div v-if="scoresTournamentId && getTournamentTeams(weeklyTournaments.find(t => t.id === scoresTournamentId) || {} as Tournament).length > 0" class="mb-6">
        <p class="hidden sm:block text-gray-600 mb-4">
          Cập nhật điểm số của các đội trong giải đấu đang diễn ra.
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
                  <p class="text-sm text-gray-600">{{ team.players?.length || 0 }} cầu thủ</p>
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
          Không tìm thấy đội nào trong giải đấu này.
        </p>
      </div>
      
      <div class="flex justify-end space-x-3">
        <button
          @click="showScoresModal = false; scoresTournamentId = null"
          class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Đóng
        </button>
        <button
          @click="saveScores"
          class="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
        >
          Lưu điểm số
        </button>
      </div>
    </div>
  </div>

  <!-- End Tournament Modal -->
  <div v-if="showEndTournamentModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" @click="showEndTournamentModal = false">
    <div class="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto" @click.stop>
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Kết thúc giải đấu</h3>
      
      <!-- Tournament teams showing auto-selected winner and loser -->
      <div v-if="endTournamentId && getTournamentTeams(weeklyTournaments.find(t => t.id === endTournamentId) || {} as Tournament).length > 0" class="mb-6">
        <p class="text-gray-600 mb-4">
          Giải đấu sẽ được kết thúc với kết quả sau, dựa trên điểm số của các đội:
        </p>
        
        <div class="space-y-4 mb-6">
          <!-- Winner Team -->
          <div v-if="selectedWinningTeam" class="bg-green-50 border border-green-200 rounded-lg p-4">
            <div class="flex items-center justify-between">
              <div class="flex-1">
                <h4 class="font-semibold text-green-800">🏆 Đội thắng: {{ selectedWinningTeam.name }}</h4>
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
                <h4 class="font-semibold text-red-800">😔 Đội thua: {{ selectedLosingTeam.name }}</h4>
              </div>
              <div class="text-right">
                <span class="text-lg font-bold text-red-700">⚽: {{ selectedLosingTeam.score || 0 }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Money Calculation Info -->
        <div class="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4">
          <h5 class="font-semibold text-primary-800 mb-2">💰 Cách tính tiền:</h5>
          <ul class="text-xs text-primary-700 space-y-1">
            <li>• Chi phí giải đấu mỗi cầu thủ: -{{ calculateCostPerPlayer(endTournamentId).toLocaleString('vi-VN') }} ₫</li>
            <li>• GK được giảm 50% chi phí giải đấu</li>
            <li>• Cược thắng: +10.000 ₫</li>
            <li>• Cược thua: -10.000 ₫</li>
            <li>• Cầu thủ đội thua: -10.000 ₫</li>
            <li>• Chi phí nước: -10.000 ₫</li>
            <li>• Đội thắng được miễn phí nước</li>
          </ul>
        </div>

        <!-- Preview Change Block -->
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <h5 class="font-semibold text-gray-800 mb-2">🔎 Xem trước biến động tiền</h5>
          <div v-for="team in getTournamentTeams(weeklyTournaments.find(t => t.id === endTournamentId) || {} as Tournament)" :key="team.id" class="mb-4">
            <div class="font-semibold text-primary-700 mb-2">{{ team.name }}</div>
            <div v-for="player in team.players.filter((p: any) => endTournamentId && getAttendanceStatus(endTournamentId, p.id) === 'ATTEND')" :key="player.id" class="bg-white rounded-lg p-3 mb-2 border border-gray-100">
              <!-- Player Header -->
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center">
                  <div class="w-6 h-6 shrink-0 overflow-hidden bg-gray-300 rounded-full flex items-center justify-center mr-2 text-xs font-medium">
                    <img v-if="player.avatar" :src="player.avatar" :alt="player.name" class="h-full w-full object-cover">
                    <span v-else>{{ player.name.charAt(0).toUpperCase() }}</span>
                  </div>
                  <span class="font-medium text-gray-900">{{ player.name }}</span>
                  <span class="ml-2 text-xs text-gray-500">{{ player.position }}</span>
                  <span class="ml-2 text-xs text-gray-500">T{{ player.tier }}</span>
                  <button v-if="isGoalkeeper(player.position)" @click="toggleGkTournamentDiscount(player.id)" class="ml-2 text-xs px-2 py-1 rounded" :class="isGkTournamentDiscountCancelled(player.id) ? 'bg-gray-200 text-gray-700' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'">
                    {{ isGkTournamentDiscountCancelled(player.id) ? 'Áp dụng giảm 50%' : 'Hủy giảm 50%' }}
                  </button>
                </div>
              </div>
              
              <!-- Detailed Changes -->
              <div v-if="endTournamentId" class="ml-8 space-y-1">
                <div 
                  v-for="change in getDetailedMoneyChange(endTournamentId, team, player).changes" 
                  :key="change.type"
                  class="flex justify-between items-center gap-3 text-xs"
                >
                  <span class="min-w-0 text-gray-600">{{ change.description }}:</span>
                  <span class="shrink-0 whitespace-nowrap font-medium text-gray-900">
                    {{ change.amount >= 0 ? '+' : '' }}{{ change.amount.toLocaleString('vi-VN') }} ₫
                  </span>
                </div>
                <div class="flex justify-between items-center gap-3 text-xs">
                  <span>Tổng thay đổi: </span>
                  <span class="shrink-0 whitespace-nowrap" :class="endTournamentId && getDetailedMoneyChange(endTournamentId, team, player).total >= 0 ? 'text-green-600' : 'text-red-600'">{{ endTournamentId && getDetailedMoneyChange(endTournamentId, team, player).total >= 0 ? '+' : '' }}{{ endTournamentId ? getDetailedMoneyChange(endTournamentId, team, player).total.toLocaleString('vi-VN') : '0' }} ₫</span>
                </div>
                <div class="flex justify-between items-center gap-3 text-xs">
                  <span>Hiện tại: </span>
                  <span class="shrink-0 whitespace-nowrap">{{ (player.money || 0).toLocaleString('vi-VN') }} ₫</span>
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
          :disabled="endTournamentSaving"
          class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Hủy
        </button>
        <button
          @click="confirmEndTournament"
          :disabled="endTournamentSaving"
          class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {{ endTournamentSaving ? 'Đang lưu...' : 'Kết thúc giải đấu' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Delete Tournament Confirmation Modal -->
  <div v-if="showDeleteTournamentModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" @click="showDeleteTournamentModal = false">
    <div class="bg-white rounded-lg p-6 max-w-lg w-full" @click.stop>
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Xóa giải đấu</h3>
      <div class="text-gray-600 mb-6">
        <p class="mb-2">Bạn có chắc muốn xóa <strong>"{{ deleteTournamentData?.name }}"</strong>?</p>
        <div v-if="deleteTournamentInfo" class="bg-red-50 p-3 rounded-lg">
          <p class="font-medium text-red-800 mb-2">Thao tác này sẽ xóa vĩnh viễn:</p>
          <ul class="text-red-700 text-sm space-y-1">
            <li v-if="deleteTournamentInfo.teamCount > 0">• {{ deleteTournamentInfo.teamCount }} phân công đội</li>
            <li v-if="deleteTournamentInfo.attendanceCount > 0">• {{ deleteTournamentInfo.attendanceCount }} bản ghi điểm danh</li>
            <li v-if="deleteTournamentInfo.additionalCostCount > 0">• {{ deleteTournamentInfo.additionalCostCount }} khoản chi phí phát sinh</li>
          </ul>
          <p class="text-red-800 font-medium mt-2">Thao tác này không thể hoàn tác.</p>
        </div>
      </div>
      <div class="flex justify-end space-x-3">
        <button
          @click="showDeleteTournamentModal = false"
          class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Hủy
        </button>
        <button
          @click="confirmDeleteTournament"
          class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Xóa giải đấu
        </button>
      </div>
    </div>
  </div>

  <!-- Team Count Selection Modal -->
  <div v-if="showTeamCountModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" @click.self="closeTeamCountModal">
    <div class="bg-white rounded-lg p-6 max-w-md w-full">
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Chọn số lượng đội</h3>
      <p class="text-sm text-gray-600 mb-5">Chọn một số lượng đội để hệ thống chia cầu thủ cân bằng.</p>
      <div class="grid grid-cols-3 gap-3">
        <button v-for="count in teamCountOptions" :key="count" type="button" @click="selectedTeamCount = count"
          class="rounded-lg border-2 px-3 py-3 font-semibold transition-colors"
          :class="selectedTeamCount === count ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-200 text-gray-700 hover:border-primary-400'">
          {{ count }} đội
        </button>
      </div>
      <p class="mt-5 text-sm font-medium text-gray-700">Chọn sân</p>
      <div class="mt-2 grid grid-cols-2 gap-3">
        <button v-for="field in [{ value: 'FIELD_5', label: 'Sân 5' }, { value: 'FIELD_7', label: 'Sân 7' }]" :key="field.value" type="button" @click="selectedTeamField = field.value as 'FIELD_5' | 'FIELD_7'" class="rounded-lg border-2 px-3 py-3 font-semibold transition-colors" :class="selectedTeamField === field.value ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-200 text-gray-700 hover:border-primary-400'">{{ field.label }}</button>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button type="button" class="btn-secondary" @click="closeTeamCountModal">Hủy</button>
        <button type="button" class="btn-primary" :disabled="teamGenerationLoading" @click="confirmGenerateRandomTeams">
          {{ teamGenerationLoading ? 'Đang chia...' : 'Chia đội' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Clear Teams Confirmation Modal -->
  <div v-if="showClearTeamsModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" @click="showClearTeamsModal = false">
    <div class="bg-white rounded-lg p-6 max-w-lg w-full" @click.stop>
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Xóa đội</h3>
      <div class="text-gray-600 mb-6">
        <p class="mb-2">Bạn có chắc muốn xóa tất cả đội của giải đấu này?</p>
        <p class="text-red-600 font-medium text-sm">
          Thao tác này không thể hoàn tác. Toàn bộ phân công cầu thủ vào đội sẽ bị xóa.
        </p>
      </div>
      <div class="flex justify-end space-x-3">
        <button
          @click="showClearTeamsModal = false"
          class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Hủy
        </button>
        <button
          @click="confirmClearTeams"
          class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Xóa đội
        </button>
      </div>
    </div>
  </div>

  <!-- Delete Additional Cost Confirmation Modal -->
  <div v-if="showDeleteCostModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" @click="showDeleteCostModal = false">
    <div class="bg-white rounded-lg p-6 max-w-md w-full" @click.stop>
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Xóa chi phí phát sinh</h3>
      <p class="text-gray-600 mb-6">
        Are you sure you want to delete this additional cost? This action cannot be undone.
      </p>
      <div class="flex justify-end space-x-3">
        <button
          @click="showDeleteCostModal = false"
          class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Hủy
        </button>
        <button
          @click="confirmDeleteCost"
          class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Xóa chi phí
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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
const showCreateTournamentModal = ref(false)
const showTournamentCalculationInfoModal = ref(false)
const newTournamentDate = ref('')
const activeFilter = ref('Đang diễn ra')
const filters = ['Đang diễn ra', 'Giải đấu cũ']

// Attendance tracking
const attendanceMap = ref<Map<string, TournamentPlayerAttendance>>(new Map())
const attendanceLoading = ref<Set<string>>(new Set())
const attendanceStats = ref<Map<string, TournamentAttendanceStats>>(new Map())
const cannotSelfRegisterDueToDebt = computed(() => (authStore.currentUser?.player?.money ?? 0) < 0)

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
const attendanceModalType = ref<'attending' | 'not-attending' | 'betting' | 'water' | 'pending'>('attending')
const attendanceModalLoading = ref(false)
const playerAttendanceLoading = ref<Set<string>>(new Set())
const attendancePlayerNameFilter = ref('')
const attendancePlayerTierFilter = ref<number | null>(null)
const attendanceFieldTab = ref<'FIELD_5' | 'FIELD_7'>('FIELD_5')
const attendanceModalTournamentId = ref<string | null>(null)
const selectedPendingPlayerIds = ref<Set<string>>(new Set())
const showFieldRegistrationModal = ref(false)
const fieldRegistrationTournamentId = ref<string | null>(null)
const registrationField5 = ref(true)
const registrationField7 = ref(true)
const batchAttendanceSaving = ref(false)
const attendanceDetailsLoadingIds = ref<Set<string>>(new Set())
const areAllPendingPlayersSelected = computed(() => {
  const pendingPlayers = getFilteredModalData()
  return pendingPlayers.length > 0 && pendingPlayers.every(item => selectedPendingPlayerIds.value.has(item.player.id))
})

interface TournamentMoneyHistoryItem {
  id: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string
  details?: Array<{ description: string; amount: number }> | null
  player: { id: string; name: string }
}
const showTournamentMoneyHistoryModal = ref(false)
const selectedMoneyHistoryTournament = ref<Tournament | null>(null)
const tournamentMoneyHistory = ref<TournamentMoneyHistoryItem[]>([])
const tournamentMoneyHistoryLoading = ref(false)
const showTournamentDebtTopUpModal = ref(false)
const tournamentDebtAmount = ref<number | null>(null)
const selectedTournamentDebtTopUpAmount = ref(100000)
const tournamentDebtTopUpSubmitting = ref(false)
const standardTopUpAmounts = [50000, 100000, 200000, 500000]
const tournamentDebtTopUpAmounts = computed(() => {
  const debtAmount = tournamentDebtAmount.value
  return debtAmount && !standardTopUpAmounts.includes(debtAmount)
    ? [debtAmount, ...standardTopUpAmounts]
    : standardTopUpAmounts
})

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

const showStadiumCostModal = ref(false)
const stadiumCostTournament = ref<Tournament | null>(null)
const stadiumCostForm = ref<number | null>(null)
const stadiumCostSaving = ref(false)

const showTournamentTimeModal = ref(false)
const timeTournament = ref<Tournament | null>(null)
const selectedTournamentTime = ref('19:00')
const tournamentTimeSaving = ref(false)
const tournamentTimeOptions = ['19:00', '19:30', '20:00']

const showFundContributionModal = ref(false)
const fundContributionTournament = ref<Tournament | null>(null)
const fundContributionForm = ref<number | null>(null)
const fundContributionSaving = ref(false)
const fundContributionOptions = [100000, 200000, 300000, 400000, 500000]

// Confirmation Modal variables
const showEndTournamentModal = ref(false)
const endTournamentId = ref<string | null>(null)
const selectedWinningTeam = ref<any | null>(null)
const selectedLosingTeam = ref<any | null>(null)
const cancelledGkDiscountPlayerIds = ref<Set<string>>(new Set())
const endTournamentSaving = ref(false)

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
const showTeamCountModal = ref(false)
const teamCountModalTournamentId = ref<string | null>(null)
const selectedTeamCount = ref<2 | 3 | 4>(2)
const teamCountOptions: Array<2 | 3 | 4> = [2, 3, 4]
const selectedTeamField = ref<'FIELD_5' | 'FIELD_7'>('FIELD_5')

const showDeleteCostModal = ref(false)
const deleteCostId = ref<string | null>(null)

// Computed properties for additional costs
const currentAdditionalCosts = computed(() => {
  const tournamentId = selectedTournamentForCosts.value?.id
  return tournamentId
    ? systemStore.additionalCosts.filter(cost => cost.tournamentId === tournamentId)
    : []
})
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
  return systemStore.additionalCosts.filter(cost => cost.tournamentId === tournamentId)
}

const getTournamentAdditionalCostsTotal = (tournamentId: string) => {
  return getTournamentAdditionalCosts(tournamentId).reduce((total, cost) => total + cost.amount, 0)
}

// Financial calculation functions
const calculateTournamentNet = (tournamentId: string) => {
  if (!systemStore.currentSettings) return 0
  const tournament = weeklyTournaments.value.find(item => item.id === tournamentId)
  const sponsor = tournament ? getTournamentSponsorMoney(tournament) : systemStore.currentSettings.sponsorMoney
  const stadium = tournament ? getTournamentStadiumCost(tournament) : systemStore.currentSettings.stadiumCost
  const additionalCosts = getTournamentAdditionalCostsTotal(tournamentId)
  return stadium - sponsor + additionalCosts - (tournament ? getTournamentFundContribution(tournament) : 0)
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
  
  // A scheduled or ongoing tournament already occupies this date. A completed
  // tournament may be followed by a new tournament on a different day.
  const targetDate = nextMonday.value
  const targetDateStr = toLocalDateKey(targetDate)
  
  const tournamentForNextMonday = weeklyTournaments.value.find(tournament => {
    const tournamentDateStr = toLocalDateKey(new Date(tournament.startDate))
    return tournamentDateStr === targetDateStr && tournament.status !== 'COMPLETED'
  })
  
  return !tournamentForNextMonday
})

const completedTournamentForNextMonday = computed(() => {
  const targetDateStr = toLocalDateKey(nextMonday.value)
  return weeklyTournaments.value.find(tournament =>
    tournament.status === 'COMPLETED' && toLocalDateKey(new Date(tournament.startDate)) === targetDateStr
  )
})

const minimumNewTournamentDate = computed(() => {
  return toLocalDateKey(new Date())
})

const minimumSelectableDate = computed(() => toLocalDateKey(new Date()))

// Get old tournaments (completed or past)
const oldTournaments = ref<Tournament[]>([])
const oldTournamentIndex = ref(0)
const oldTournamentDateFilter = ref('')
const oldTournamentDateDraft = ref('')
const showOldTournamentDateModal = ref(false)
const oldTournamentCalendarMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const completedTournamentDates = ref<Set<string>>(new Set())
const oldTournamentCalendarLoading = ref(false)
const oldTournamentWeekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const filteredOldTournaments = computed(() => {
  const filterDate = oldTournamentDateFilter.value
  return weeklyTournaments.value
    .filter(tournament => tournament.status === 'COMPLETED')
    .filter(tournament => !filterDate || toLocalDateKey(new Date(tournament.startDate)) === filterDate)
    .sort((first, second) => new Date(second.startDate).getTime() - new Date(first.startDate).getTime())
})
const selectedOldTournament = computed(() => filteredOldTournaments.value[oldTournamentIndex.value] || null)

// Helper functions
const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const oldTournamentCalendarLabel = computed(() => oldTournamentCalendarMonth.value.toLocaleDateString('vi-VN', {
  month: 'long',
  year: 'numeric',
}))

const oldTournamentCalendarDays = computed(() => {
  const month = oldTournamentCalendarMonth.value
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const days: Array<Date | null> = Array.from({ length: firstDay.getDay() }, () => null)
  for (let day = 1; day <= dayCount; day++) days.push(new Date(month.getFullYear(), month.getMonth(), day))
  while (days.length % 7 !== 0) days.push(null)
  return days
})

const fetchCompletedTournamentDates = async (): Promise<void> => {
  try {
    oldTournamentCalendarLoading.value = true
    const month = oldTournamentCalendarMonth.value
    const response = await apiClient.get<string[]>(`/tournaments/completed-dates?year=${month.getFullYear()}&month=${month.getMonth() + 1}`)
    if (!response.success) throw new Error(response.error || 'Không thể tải lịch giải đấu')
    completedTournamentDates.value = new Set(response.data || [])
  } catch (error) {
    completedTournamentDates.value = new Set()
    toast.error(error instanceof Error ? error.message : 'Không thể tải lịch giải đấu')
  } finally {
    oldTournamentCalendarLoading.value = false
  }
}

const openOldTournamentDateModal = async (): Promise<void> => {
  oldTournamentDateDraft.value = oldTournamentDateFilter.value
  const sourceDate = oldTournamentDateDraft.value ? new Date(`${oldTournamentDateDraft.value}T00:00:00`) : new Date()
  oldTournamentCalendarMonth.value = new Date(sourceDate.getFullYear(), sourceDate.getMonth(), 1)
  showOldTournamentDateModal.value = true
  await fetchCompletedTournamentDates()
}

const changeOldTournamentCalendarMonth = async (offset: number): Promise<void> => {
  const current = oldTournamentCalendarMonth.value
  oldTournamentCalendarMonth.value = new Date(current.getFullYear(), current.getMonth() + offset, 1)
  await fetchCompletedTournamentDates()
}

const getTournamentSponsorMoney = (tournament: Tournament) => {
  return tournament.status === 'COMPLETED' && tournament.sponsorMoney !== null && tournament.sponsorMoney !== undefined
    ? tournament.sponsorMoney
    : (systemStore.currentSettings?.sponsorMoney || 0)
}

const getTournamentStadiumCost = (tournament: Tournament) => {
  return tournament.stadiumCost !== null && tournament.stadiumCost !== undefined
    ? tournament.stadiumCost
    : (systemStore.currentSettings?.stadiumCost || 0)
}

const getTournamentFundContribution = (tournament: Tournament) => tournament.fundContribution || 0

const formatDate = (date: string | Date): string => {
  if (!date) return 'Không có'
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  } catch {
    return 'Ngày không hợp lệ'
  }
}

const formatTime = (date: string | Date): string => {
  if (!date) return 'Không có'
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return 'Giờ không hợp lệ'
  }
}

const formatRegistrationTime = (date: string | Date): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
  } catch {
    return ''
  }
}

const formatNextMonday = (date: Date): string => {
  return date.toLocaleDateString('vi-VN', {
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
  
  const currentStatus = currentAttendance.status || 'NULL'
  if (currentStatus !== 'ATTEND') {
    fieldRegistrationTournamentId.value = tournamentId
    registrationField5.value = true
    registrationField7.value = true
    showFieldRegistrationModal.value = true
    return
  }

  try {
    attendanceLoading.value.add(tournamentId)
    const response = await apiClient.put<TournamentPlayerAttendance>(
      `/tournaments/${tournamentId}/attendance`,
      { status: 'NOT_ATTEND' }
    )
    
    if (response.success && response.data) {
      attendanceMap.value.set(tournamentId, response.data)
      // Refresh attendance stats
      await fetchAttendanceStats(tournamentId)
    }
  } catch (err: any) {
    console.error('Toggle attendance error:', err)
    toast.error(err.response?.data?.error || 'Không thể cập nhật điểm danh')
  } finally {
    attendanceLoading.value.delete(tournamentId)
  }
}

const getAttendanceButtonText = (tournamentId: string): string => {
  const attendance = attendanceMap.value.get(tournamentId)
  if (!attendance || (attendance as any).status === 'NO_PLAYER') return 'Không có cầu thủ'
  if (attendance.status === 'NULL') return 'Tham gia'
  return attendance.status === 'ATTEND' ? 'Đã tham gia' : 'Tham gia'
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
  return Math.round((getHighestFieldAttendanceCount(tournamentId) / stats.totalPlayers) * 100)
}

const getHighestFieldAttendanceCount = (tournamentId: string): number => {
  const stats = attendanceStats.value.get(tournamentId)
  if (!stats) return 0
  return Math.max(stats.field5Count ?? stats.attendingCount, stats.field7Count ?? stats.attendingCount)
}

// Modal functions
const fetchAttendanceDetails = async (tournamentId: string): Promise<void> => {
  if (attendanceDetailsLoadingIds.value.has(tournamentId)) return
  try {
    attendanceDetailsLoadingIds.value = new Set(attendanceDetailsLoadingIds.value).add(tournamentId)
    attendanceModalLoading.value = true
    const response = await apiClient.get<TournamentAttendanceDetails[]>(`/tournaments/${tournamentId}/attendance-details`)
    if (response.success && response.data) {
      attendanceModalData.value = response.data
      // Store in map for betting count calculation
      attendanceDetailsMap.value.set(tournamentId, response.data)
    }
  } catch (err: any) {
    console.error('Fetch attendance details error:', err)
    toast.error('Không thể tải chi tiết điểm danh')
    attendanceModalData.value = []
  } finally {
    attendanceModalLoading.value = false
    const loadingIds = new Set(attendanceDetailsLoadingIds.value)
    loadingIds.delete(tournamentId)
    attendanceDetailsLoadingIds.value = loadingIds
  }
}

const closeFieldRegistrationModal = (): void => {
  showFieldRegistrationModal.value = false
  fieldRegistrationTournamentId.value = null
}

const confirmFieldRegistration = async (): Promise<void> => {
  const tournamentId = fieldRegistrationTournamentId.value
  if (!tournamentId || (!registrationField5.value && !registrationField7.value) || attendanceLoading.value.has(tournamentId)) return
  try {
    attendanceLoading.value.add(tournamentId)
    const response = await apiClient.put<TournamentPlayerAttendance>(`/tournaments/${tournamentId}/attendance`, {
      status: 'ATTEND', field5: registrationField5.value, field7: registrationField7.value,
    })
    if (!response.success || !response.data) throw new Error(response.error || 'Không thể đăng ký tham gia')
    attendanceMap.value.set(tournamentId, response.data)
    await fetchAttendanceStats(tournamentId)
    closeFieldRegistrationModal()
    toast.success('Đã đăng ký tham gia')
  } catch (err: any) {
    toast.error(err.response?.data?.error || err.message || 'Không thể đăng ký tham gia')
  } finally {
    attendanceLoading.value.delete(tournamentId)
  }
}

const openAttendanceModal = async (tournamentId: string, type: 'attending' | 'not-attending' | 'betting' | 'water' | 'pending'): Promise<void> => {
  attendanceModalType.value = type
  if (type === 'pending') {
    attendanceModalTitle.value = 'Điểm danh cầu thủ'
  } else if (type === 'attending') {
    attendanceModalTitle.value = 'Cầu thủ tham gia'
  } else if (type === 'not-attending') {
    attendanceModalTitle.value = 'Cầu thủ không tham gia'
  } else if (type === 'betting') {
    attendanceModalTitle.value = 'Cầu thủ cược'
  } else if (type === 'water') {
    attendanceModalTitle.value = 'Cầu thủ uống nước'
  }
  showAttendanceModal.value = true
  attendanceModalData.value = [] // Clear previous data
  attendancePlayerNameFilter.value = ''
  attendancePlayerTierFilter.value = null
  attendanceFieldTab.value = 'FIELD_5'
  attendanceModalTournamentId.value = tournamentId
  selectedPendingPlayerIds.value = new Set()
  
  await fetchAttendanceDetails(tournamentId)
}

const closeAttendanceModal = (): void => {
  showAttendanceModal.value = false
  attendanceModalData.value = []
  attendanceModalLoading.value = false
  attendancePlayerNameFilter.value = ''
  attendancePlayerTierFilter.value = null
  attendanceModalTournamentId.value = null
  selectedPendingPlayerIds.value = new Set()
}

const getFilteredModalData = (): TournamentAttendanceDetails[] => {
  const matchesName = (item: TournamentAttendanceDetails) =>
    item.player.name.toLowerCase().includes(attendancePlayerNameFilter.value.trim().toLowerCase())
  if (attendanceModalType.value === 'pending') {
    return attendanceModalData.value
      .filter(item => item.status !== 'ATTEND' && item.status !== 'NOT_ATTEND')
      .filter(matchesName)
      .filter(item => attendancePlayerTierFilter.value === null || item.player.tier === attendancePlayerTierFilter.value)
      .sort((a, b) => a.player.tier - b.player.tier || a.player.name.localeCompare(b.player.name, 'vi'))
  }
  if (attendanceModalType.value === 'betting') {
    // Filter by bet field for betting players
    return attendanceModalData.value
      .filter(item => item.bet === true)
      .filter(matchesName)
      .sort((a, b) => b.player.tier - a.player.tier) // Sort by tier descending (highest tier first)
  } else if (attendanceModalType.value === 'water') {
    return attendanceModalData.value
      .filter(item => item.status === 'ATTEND' && item.withWater === true)
      .filter(matchesName)
      .sort((a, b) => b.player.tier - a.player.tier)
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
      .filter(item => attendanceModalType.value !== 'attending' || (attendanceFieldTab.value === 'FIELD_5' ? item.field5 !== false : item.field7 !== false))
      .filter(matchesName)
      .sort((a, b) => attendanceModalType.value === 'attending'
        ? new Date(b.registeredAt || b.createdAt).getTime() - new Date(a.registeredAt || a.createdAt).getTime()
          || a.player.name.localeCompare(b.player.name, 'vi')
        : b.player.tier - a.player.tier) // Attending players are listed by latest registration; other lists keep tier order.
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
      players: [...(teamPlayersMap.get(team.id) || [])].sort((first, second) => {
        const firstIsGoalkeeper = isGoalkeeper(first.position)
        const secondIsGoalkeeper = isGoalkeeper(second.position)
        if (firstIsGoalkeeper !== secondIsGoalkeeper) return firstIsGoalkeeper ? -1 : 1
        return first.tier - second.tier || first.name.localeCompare(second.name, 'vi')
      }),
      score: team.score || 0
    }
  })
}

const getPositionLabel = (position: string): string => ({
  GK: 'GK',
  DEF: 'DEF',
  MID: 'MID',
  FWD: 'FWD',
  Goalkeeper: 'GK',
  Defender: 'DEF',
  Midfielder: 'MID',
  Forward: 'FWD'
}[position] || position)

const isGoalkeeper = (position: string): boolean => position === 'GK' || position === 'Goalkeeper'

const openTeamCountModal = (tournamentId: string): void => {
  if (!canGenerateTeams(tournamentId) || teamGenerationLoading.value) return
  selectedTeamCount.value = getTeamCount(tournamentId) as 2 | 3 | 4
  selectedTeamField.value = 'FIELD_5'
  teamCountModalTournamentId.value = tournamentId
  showTeamCountModal.value = true
}

const closeTeamCountModal = (): void => {
  showTeamCountModal.value = false
  teamCountModalTournamentId.value = null
}

const confirmGenerateRandomTeams = async (): Promise<void> => {
  if (!teamCountModalTournamentId.value) return
  await generateRandomTeams(teamCountModalTournamentId.value, selectedTeamCount.value, selectedTeamField.value)
}

const generateRandomTeams = async (tournamentId: string, teamCount: 2 | 3 | 4, field: 'FIELD_5' | 'FIELD_7'): Promise<void> => {
  if (!canGenerateTeams(tournamentId) || teamGenerationLoading.value) return
  
  const stats = attendanceStats.value.get(tournamentId)
  if (!stats) return
  
  try {
    teamGenerationLoading.value = true
    
    const response = await apiClient.post(`/tournaments/${tournamentId}/generate-teams`, { teamCount, field })
    
    if (response.success) {
      // Show success message with team details
      const data = response.data as any
      toast.success(`Đã chia ${data.playerCount} cầu thủ Sân ${field === 'FIELD_5' ? '5' : '7'} thành ${data.teamCount} đội!`)
      
      // Refresh tournament data
      await fetchData()
      closeTeamCountModal()
    }
  } catch (err: any) {
    console.error('Generate teams error:', err)
    toast.error(err.response?.data?.error || 'Không thể chia đội')
  } finally {
    teamGenerationLoading.value = false
  }
}

const handleCreateNew = () => {
  const completedTournament = completedTournamentForNextMonday.value
  if (!completedTournament) {
    createWeeklyTournament(nextMonday.value)
    return
  }

  newTournamentDate.value = minimumNewTournamentDate.value
  showCreateTournamentModal.value = true
}

const closeCreateTournamentModal = () => {
  showCreateTournamentModal.value = false
  newTournamentDate.value = ''
}

const createWeeklyTournamentFromSelectedDate = async () => {
  if (!newTournamentDate.value) return
  await createWeeklyTournament(new Date(`${newTournamentDate.value}T00:00:00`))
}

// Create new weekly tournament
const createWeeklyTournament = async (tournamentDay: Date) => {
  if (!canCreateNew.value || loading.value) return
  if (weeklyTournaments.value.some(tournament => toLocalDateKey(new Date(tournament.startDate)) === toLocalDateKey(tournamentDay))) {
    toast.error('Ngày đã chọn đã có giải đấu. Vui lòng chọn ngày khác.')
    return
  }
  
  try {
    loading.value = true
    
    // Create dates in local time
    const startDate = new Date(tournamentDay)
    startDate.setHours(19, 0, 0, 0) // 7:00 PM local time
    
    const endDate = new Date(tournamentDay)
    endDate.setHours(21, 0, 0, 0) // 9:00 PM local time
    
    // Convert to ISO strings to preserve the exact time we want
    const startDateISO = startDate.toISOString()
    const endDateISO = endDate.toISOString()
    
    const tournamentData: CreateTournamentRequest = {
      name: `Giải hằng tuần - ${formatDate(startDate)}`,
      type: 'WEEKLY' as const,
      status: 'UPCOMING' as const,
      startDate: startDateISO,
      endDate: endDateISO
    }
    
    await tournamentsStore.addTournament(tournamentData)
    closeCreateTournamentModal()
    await fetchData()
    toast.success('Đã tạo giải hằng tuần!')
  } catch (err: any) {
    console.error('Create weekly tournament error:', err)
    toast.error(err.response?.data?.error || 'Không thể tạo giải hằng tuần')
  } finally {
    loading.value = false
  }
}

// Load old tournaments with pagination
const loadOldTournaments = async () => {
  try {
    oldTournaments.value = weeklyTournaments.value
      .filter(t => t.status === 'COMPLETED')
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    oldTournamentIndex.value = 0
  } catch (err: any) {
    console.error('Load old tournaments error:', err)
    toast.error('Không thể tải giải đấu cũ')
  }
}

const navigateOldTournament = async (direction: -1 | 1): Promise<void> => {
  const nextIndex = oldTournamentIndex.value + direction
  if (nextIndex < 0 || nextIndex >= filteredOldTournaments.value.length) return
  oldTournamentIndex.value = nextIndex
  if (selectedOldTournament.value) await loadAttendanceData([selectedOldTournament.value])
}

const applyOldTournamentDateFilter = async (): Promise<void> => {
  oldTournamentDateFilter.value = oldTournamentDateDraft.value
  oldTournamentIndex.value = 0
  showOldTournamentDateModal.value = false
  if (selectedOldTournament.value) await loadAttendanceData([selectedOldTournament.value])
}

const clearOldTournamentDateFilter = async (): Promise<void> => {
  oldTournamentDateDraft.value = ''
  oldTournamentDateFilter.value = ''
  oldTournamentIndex.value = 0
  showOldTournamentDateModal.value = false
  if (selectedOldTournament.value) await loadAttendanceData([selectedOldTournament.value])
}

const formatOldTournamentFilterDate = (value: string): string => {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
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
      toast.success('Đã bắt đầu giải đấu!')
      await fetchData()
    } else {
      toast.error('Không thể bắt đầu giải đấu')
    }
  } catch (err: any) {
    console.error('Start tournament error:', err)
    toast.error(err.response?.data?.error || 'Không thể bắt đầu giải đấu')
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
      toast.success('Đã lưu điểm số!')
      
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
      throw new Error(response.error || 'Không thể lưu điểm số')
    }
  } catch (err: any) {
    console.error('Save scores error:', err)
    toast.error(err.response?.data?.error || err.message || 'Không thể lưu điểm số')
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
    toast.error(`Không thể kết thúc giải đấu: ${statusMessage}`)
    return
  }
  
  endTournamentId.value = tournamentId
  cancelledGkDiscountPlayerIds.value = new Set()
  
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
  if (!endTournamentId.value || endTournamentSaving.value) return
  
  try {
    endTournamentSaving.value = true
    // No need to send winnerId - backend will auto-select based on scores
    const response = await apiClient.put(`/tournaments/${endTournamentId.value}/end`, {
      cancelledGkDiscountPlayerIds: [...cancelledGkDiscountPlayerIds.value]
    })
    
    if (response.success) {
      const data = response.data as any
      let message = 'Đã kết thúc giải đấu!'
      
      if (data.winner) {
        message += ` Đội thắng: ${data.winner.name} (${data.winner.score} điểm).`
      }
      
      if (data.loser) {
        message += ` Đội thua: ${data.loser.name} (${data.loser.score} điểm).`
      }
      
      if (data.playersUpdated > 0) {
        message += ` Đã cập nhật tiền cho ${data.playersUpdated} cầu thủ.`
      }
      
      if (data.totalAdded > 0) {
        message += ` Tổng tiền cộng: ${data.totalAdded.toLocaleString('vi-VN')} ₫.`
      }
      
      if (data.totalDeducted > 0) {
        message += ` Tổng tiền trừ: ${data.totalDeducted.toLocaleString('vi-VN')} ₫.`
      }
      
      toast.success(message)
      await fetchData()
    } else {
      toast.error('Không thể kết thúc giải đấu')
    }
  } catch (err: any) {
    console.error('End tournament error:', err)
    toast.error(err.response?.data?.error || 'Không thể kết thúc giải đấu')
  } finally {
    endTournamentSaving.value = false
    showEndTournamentModal.value = false
    endTournamentId.value = null
    selectedWinningTeam.value = null
    selectedLosingTeam.value = null
    cancelledGkDiscountPlayerIds.value = new Set()
  }
}

const deleteTournament = async (id: string) => {
  // Find the tournament to show detailed confirmation
  const tournament = weeklyTournaments.value.find(t => t.id === id) || 
                    oldTournaments.value.find(t => t.id === id);
  
  if (!tournament) {
    toast.error('Không tìm thấy giải đấu');
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
    toast.success('Đã xóa giải đấu cùng các đội, điểm danh và chi phí liên quan.');
  } catch (err: any) {
    console.error('Delete tournament error:', err);
    toast.error(err.response?.data?.error || 'Không thể xóa giải đấu')
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
      toast.success('Đã xóa toàn bộ đội!')
      await fetchData()
    } else {
      toast.error('Không thể xóa đội')
    }
  } catch (err: any) {
    console.error('Clear teams error:', err)
    toast.error(err.response?.data?.error || 'Không thể xóa đội')
  } finally {
    showClearTeamsModal.value = false
    clearTeamsModalTournamentId.value = null
  }
}

const openStadiumCostModal = (tournament: Tournament) => {
  stadiumCostTournament.value = tournament
  stadiumCostForm.value = getTournamentStadiumCost(tournament)
  showStadiumCostModal.value = true
}

const loadAttendanceData = async (tournaments: Tournament[]): Promise<void> => {
  const tournamentIds = [...new Set(tournaments.map(tournament => tournament.id))]
  await Promise.all([
    ...tournamentIds.map(id => fetchAttendance(id)),
    ...tournamentIds.map(id => fetchAttendanceStats(id)),
    ...tournamentIds.map(id => fetchAttendanceDetails(id)),
    ...tournamentIds.map(id => systemStore.fetchAdditionalCosts(id)),
  ])
}

const handleFilterChange = async (filter: string): Promise<void> => {
  activeFilter.value = filter
  if (filter === 'Giải đấu cũ' && selectedOldTournament.value) {
    await loadAttendanceData([selectedOldTournament.value])
  }
}

const togglePendingPlayer = (playerId: string): void => {
  const selected = new Set(selectedPendingPlayerIds.value)
  if (selected.has(playerId)) selected.delete(playerId)
  else selected.add(playerId)
  selectedPendingPlayerIds.value = selected
}

const toggleAllPendingPlayers = (): void => {
  const pendingPlayerIds = getFilteredModalData().map(item => item.player.id)
  const allSelected = pendingPlayerIds.length > 0 && pendingPlayerIds.every(playerId => selectedPendingPlayerIds.value.has(playerId))
  const selected = new Set(selectedPendingPlayerIds.value)
  if (allSelected) pendingPlayerIds.forEach(playerId => selected.delete(playerId))
  else pendingPlayerIds.forEach(playerId => selected.add(playerId))
  selectedPendingPlayerIds.value = selected
}

const registerSelectedPlayers = async (): Promise<void> => {
  const tournamentId = attendanceModalTournamentId.value
  const playerIds = [...selectedPendingPlayerIds.value]
  if (!tournamentId || playerIds.length === 0 || batchAttendanceSaving.value) return

  try {
    batchAttendanceSaving.value = true
    const response = await apiClient.put<{ updatedCount: number; playerIds: string[] }>(
      `/tournaments/${tournamentId}/attendance/batch`,
      { playerIds },
    )
    if (!response.success) throw new Error(response.error || 'Không thể đăng ký cầu thủ')

    const updatedPlayerIds = new Set(response.data?.playerIds || [])
    attendanceModalData.value = attendanceModalData.value.map(item =>
      updatedPlayerIds.has(item.player.id) ? { ...item, status: 'ATTEND' } : item,
    )
    attendanceDetailsMap.value.set(tournamentId, attendanceModalData.value)
    selectedPendingPlayerIds.value = new Set()
    await fetchAttendanceStats(tournamentId)
    toast.success(`Đã đăng ký ${response.data?.updatedCount || 0} cầu thủ`)
  } catch (error: any) {
    toast.error(error.response?.data?.error || error.message || 'Không thể đăng ký cầu thủ')
  } finally {
    batchAttendanceSaving.value = false
  }
}

const closeStadiumCostModal = () => {
  showStadiumCostModal.value = false
  stadiumCostTournament.value = null
  stadiumCostForm.value = null
}

const saveStadiumCost = async () => {
  if (!stadiumCostTournament.value || stadiumCostForm.value === null || stadiumCostForm.value < 0 || stadiumCostSaving.value) return

  try {
    stadiumCostSaving.value = true
    const response = await apiClient.updateTournament(stadiumCostTournament.value.id, {
      stadiumCost: Math.round(stadiumCostForm.value),
    })
    if (!response.success || !response.data) throw new Error(response.error || 'Không thể lưu chi phí sân')

    const tournament = weeklyTournaments.value.find(item => item.id === stadiumCostTournament.value?.id)
    if (tournament) tournament.stadiumCost = (response.data as Tournament).stadiumCost
    toast.success('Đã cập nhật chi phí sân')
    closeStadiumCostModal()
  } catch (error: any) {
    toast.error(error.response?.data?.error || error.message || 'Không thể lưu chi phí sân')
  } finally {
    stadiumCostSaving.value = false
  }
}

const openTournamentTimeModal = (tournament: Tournament) => {
  const date = new Date(tournament.startDate)
  selectedTournamentTime.value = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  timeTournament.value = tournament
  showTournamentTimeModal.value = true
}

const closeTournamentTimeModal = () => {
  showTournamentTimeModal.value = false
  timeTournament.value = null
}

const saveTournamentTime = async () => {
  if (!timeTournament.value || tournamentTimeSaving.value) return

  try {
    tournamentTimeSaving.value = true
    const [hours, minutes] = selectedTournamentTime.value.split(':').map(Number)
    const startDate = new Date(timeTournament.value.startDate)
    startDate.setHours(hours, minutes, 0, 0)
    const response = await apiClient.updateTournament(timeTournament.value.id, { startDate: startDate.toISOString() })
    if (!response.success || !response.data) throw new Error(response.error || 'Không thể lưu giờ thi đấu')

    const tournament = weeklyTournaments.value.find(item => item.id === timeTournament.value?.id)
    if (tournament) tournament.startDate = (response.data as Tournament).startDate
    toast.success('Đã cập nhật giờ thi đấu')
    closeTournamentTimeModal()
  } catch (error: any) {
    toast.error(error.response?.data?.error || error.message || 'Không thể lưu giờ thi đấu')
  } finally {
    tournamentTimeSaving.value = false
  }
}

const openFundContributionModal = (tournament: Tournament) => {
  fundContributionTournament.value = tournament
  fundContributionForm.value = getTournamentFundContribution(tournament)
  showFundContributionModal.value = true
}

const closeFundContributionModal = () => {
  showFundContributionModal.value = false
  fundContributionTournament.value = null
  fundContributionForm.value = null
}

const saveFundContribution = async () => {
  if (!fundContributionTournament.value || fundContributionForm.value === null || fundContributionForm.value < 0 || fundContributionSaving.value) return

  try {
    fundContributionSaving.value = true
    const response = await apiClient.updateTournament(fundContributionTournament.value.id, {
      fundContribution: Math.round(fundContributionForm.value),
    })
    if (!response.success || !response.data) throw new Error(response.error || 'Không thể lưu số tiền trích quỹ')

    const tournament = weeklyTournaments.value.find(item => item.id === fundContributionTournament.value?.id)
    if (tournament) tournament.fundContribution = (response.data as Tournament).fundContribution || 0
    toast.success('Đã cập nhật số tiền trích quỹ')
    closeFundContributionModal()
  } catch (error: any) {
    toast.error(error.response?.data?.error || error.message || 'Không thể lưu số tiền trích quỹ')
  } finally {
    fundContributionSaving.value = false
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
  if (currentAdditionalCosts.value.length === 0) {
    additionalCostForm.value.description = 'Tiền Nước'
  }
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
    toast.error('Mô tả phải có ít nhất 3 ký tự')
    return
  }
  
  if (!additionalCostForm.value.amount || additionalCostForm.value.amount <= 0) {
    toast.error('Số tiền phải lớn hơn 0')
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
        toast.success('Đã cập nhật chi phí phát sinh')
      }
    } else {
      // Add new cost
      response = await systemStore.createAdditionalCost({
        tournamentId: selectedTournamentForCosts.value.id,
        ...costData
      })
      if (response) {
        toast.success('Đã thêm chi phí phát sinh')
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
    toast.error(err.response?.data?.error || 'Không thể lưu chi phí phát sinh')
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
      toast.success('Đã xóa chi phí phát sinh');
      // Refresh the costs if we have a selected tournament
      if (selectedTournamentForCosts.value) {
        await systemStore.fetchAdditionalCosts(selectedTournamentForCosts.value.id);
      }
    }
  } catch (err: any) {
    console.error('Delete additional cost error:', err);
    toast.error(err.response?.data?.error || 'Không thể xóa chi phí phát sinh');
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

const getWaterCount = (tournamentId: string): number => {
  const details = attendanceDetailsMap.value.get(tournamentId)
  return Array.isArray(details)
    ? details.filter((detail: any) => detail.status === 'ATTEND' && detail.withWater === true).length
    : 0
}

// Helper function to calculate betting win amount based on number of teams
const getBettingWinAmount = (): number => 10000

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
  if (teams.length < 2) return 'Cần ít nhất 2 đội'
  
  const scores = teams.map(team => team.score || 0)
  const uniqueScores = [...new Set(scores)].sort((a, b) => b - a)
  
  if (uniqueScores.length < 2) return 'Tất cả đội có cùng điểm số'
  
  const highestScore = uniqueScores[0]
  const lowestScore = uniqueScores[uniqueScores.length - 1]
  
  const teamsWithHighestScore = teams.filter(team => (team.score || 0) === highestScore)
  const teamsWithLowestScore = teams.filter(team => (team.score || 0) === lowestScore)
  
  if (teamsWithHighestScore.length > 1) {
    return `${teamsWithHighestScore.length} đội đồng điểm cao nhất (${highestScore})`
  }
  
  if (teamsWithLowestScore.length > 1) {
    return `${teamsWithLowestScore.length} đội đồng điểm thấp nhất (${lowestScore})`
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
    await loadOldTournaments()
    
    // Only load attendance for the currently displayed tournament on first render.
    // Historical tournaments are loaded on demand when the user opens that tab.
    await loadAttendanceData(weeklyTournaments.value.filter(tournament => tournament.status !== 'COMPLETED'))
  } catch (err: any) {
    console.error('Fetch data error:', err)
    toast.error(err.response?.data?.error || 'Không thể tải dữ liệu')
  }
}

// Initialize
onMounted(async () => {
  await fetchData()
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

const isCurrentUserPlayer = (playerId: string): boolean => {
  const currentPlayerId = authStore.currentUser?.player?.id || authStore.currentUser?.playerId
  return Boolean(currentPlayerId && currentPlayerId === playerId)
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
      toast.success(newWaterStatus ? 'Đã chọn nước!' : 'Đã bỏ chọn nước!')
    }
  } catch (err: any) {
    console.error('Toggle water error:', err)
    toast.error(err.response?.data?.error || 'Không thể cập nhật lựa chọn nước')
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
      { toggleBet: true }
    )
    
    if (response.success && response.data) {
      attendanceMap.value.set(tournamentId, response.data)
      
      // Refresh attendance details to update betting count
      await fetchAttendanceDetails(tournamentId)
      
      toast.success(newBetStatus ? 'Đã chọn cược!' : 'Đã bỏ chọn cược!')
    }
  } catch (err: any) {
    console.error('Toggle bet error:', err)
    toast.error(err.response?.data?.error || 'Không thể cập nhật cược')
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
      
      toast.success(`${attendance.player.name}: ${newWaterStatus ? 'Đã chọn nước!' : 'Đã bỏ chọn nước!'}`)
    }
  } catch (err: any) {
    console.error('Toggle player water error:', err)
    toast.error(err.response?.data?.error || 'Không thể cập nhật lựa chọn nước')
  } finally {
    playerWaterLoading.value.delete(attendance.player.id)
  }
}

const canUserToggleBet = (tournament: Tournament): boolean => {
  return ['UPCOMING', 'ONGOING'].includes(tournament.status)
    && new Date(tournament.startDate).getTime() > Date.now()
    && getUserAttendanceStatus(tournament.id) === 'ATTEND'
}

const isPlayerBetting = (tournamentId: string, playerId: string): boolean => {
  const details = attendanceDetailsMap.value.get(tournamentId)
  return Array.isArray(details) && details.some((detail: any) => detail.playerId === playerId && detail.bet === true)
}

const isPlayerWithWater = (tournamentId: string, playerId: string): boolean => {
  const details = attendanceDetailsMap.value.get(tournamentId)
  return Array.isArray(details) && details.some((detail: any) => detail.playerId === playerId && detail.withWater === true)
}

const markPlayerAttending = async (attendance: TournamentAttendanceDetails): Promise<void> => {
  if (playerAttendanceLoading.value.has(attendance.player.id)) return
  try {
    playerAttendanceLoading.value.add(attendance.player.id)
    const response = await apiClient.put<TournamentPlayerAttendance>(
      `/tournaments/${attendance.tournamentId}/attendance/${attendance.player.id}`,
      { status: 'ATTEND' }
    )
    if (!response.success) throw new Error(response.error || 'Không thể cập nhật điểm danh')
    const index = attendanceModalData.value.findIndex(item => item.id === attendance.id)
    if (index !== -1) attendanceModalData.value[index] = { ...attendanceModalData.value[index], status: 'ATTEND' }
    attendanceDetailsMap.value.set(attendance.tournamentId, attendanceModalData.value)
    await fetchAttendanceStats(attendance.tournamentId)
    toast.success(`${attendance.player.name} đã tham gia`)
  } catch (error: any) {
    toast.error(error.response?.data?.error || error.message || 'Không thể cập nhật điểm danh')
  } finally {
    playerAttendanceLoading.value.delete(attendance.player.id)
  }
}

const cancelPlayerAttendance = async (attendance: TournamentAttendanceDetails): Promise<void> => {
  if (playerAttendanceLoading.value.has(attendance.player.id)) return
  try {
    const loadingIds = new Set(playerAttendanceLoading.value)
    loadingIds.add(attendance.player.id)
    playerAttendanceLoading.value = loadingIds
    const field5 = attendanceFieldTab.value === 'FIELD_5' ? false : attendance.field5 !== false
    const field7 = attendanceFieldTab.value === 'FIELD_7' ? false : attendance.field7 !== false
    const remainsRegistered = field5 || field7
    const response = await apiClient.put<TournamentPlayerAttendance>(
      `/tournaments/${attendance.tournamentId}/attendance/${attendance.player.id}`,
      { status: remainsRegistered ? 'ATTEND' : 'NULL', field5, field7, withWater: remainsRegistered ? attendance.withWater : false, bet: remainsRegistered ? attendance.bet : false },
    )
    if (!response.success) throw new Error(response.error || 'Không thể hủy tham gia')
    const index = attendanceModalData.value.findIndex(item => item.id === attendance.id)
    if (index !== -1) attendanceModalData.value[index] = { ...attendanceModalData.value[index], status: remainsRegistered ? 'ATTEND' : 'NULL', field5, field7, withWater: remainsRegistered ? attendance.withWater : false, bet: remainsRegistered ? attendance.bet : false }
    attendanceDetailsMap.value.set(attendance.tournamentId, attendanceModalData.value)
    await fetchAttendanceStats(attendance.tournamentId)
    toast.success(`Đã hủy ${attendanceFieldTab.value === 'FIELD_5' ? 'Sân 5' : 'Sân 7'} của ${attendance.player.name}`)
  } catch (error: any) {
    toast.error(error.response?.data?.error || error.message || 'Không thể hủy tham gia')
  } finally {
    const loadingIds = new Set(playerAttendanceLoading.value)
    loadingIds.delete(attendance.player.id)
    playerAttendanceLoading.value = loadingIds
  }
}

const isGkTournamentDiscountCancelled = (playerId: string): boolean => cancelledGkDiscountPlayerIds.value.has(playerId)

const toggleGkTournamentDiscount = (playerId: string): void => {
  const updatedCancelledIds = new Set(cancelledGkDiscountPlayerIds.value)
  if (updatedCancelledIds.has(playerId)) updatedCancelledIds.delete(playerId)
  else updatedCancelledIds.add(playerId)
  cancelledGkDiscountPlayerIds.value = updatedCancelledIds
}

const openTournamentMoneyHistory = async (tournament: Tournament): Promise<void> => {
  selectedMoneyHistoryTournament.value = tournament
  tournamentMoneyHistory.value = []
  showTournamentMoneyHistoryModal.value = true
  tournamentMoneyHistoryLoading.value = true
  try {
    const response = await apiClient.getTournamentMoneyHistory(tournament.id)
    if (!response.success) throw new Error(response.error || 'Không thể tải biến động tiền')
    const history = (response.data || []) as TournamentMoneyHistoryItem[]
    const currentPlayerId = authStore.currentUser?.player?.id || authStore.currentUser?.playerId
    tournamentMoneyHistory.value = currentPlayerId
      ? [...history].sort((first, second) => Number(second.player.id === currentPlayerId) - Number(first.player.id === currentPlayerId))
      : history
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Không thể tải biến động tiền')
  } finally {
    tournamentMoneyHistoryLoading.value = false
  }
}

const openTournamentDebtTopUp = async (item: TournamentMoneyHistoryItem): Promise<void> => {
  let currentBalance = item.balanceAfter
  try {
    const response = await apiClient.getPlayer(item.player.id)
    if (response.success && response.data) currentBalance = Number((response.data as any).money)
  } catch (error) {
    console.warn('Unable to refresh player balance before top-up:', error)
  }

  if (currentBalance >= 0) {
    toast.info('Số dư hiện tại không còn âm')
    return
  }

  tournamentDebtAmount.value = Math.abs(currentBalance)
  selectedTournamentDebtTopUpAmount.value = tournamentDebtAmount.value
  showTournamentDebtTopUpModal.value = true
}

const submitTournamentDebtTopUp = async (): Promise<void> => {
  if (tournamentDebtTopUpSubmitting.value) return
  tournamentDebtTopUpSubmitting.value = true
  try {
    const response = await apiClient.createMoneyTopUp(selectedTournamentDebtTopUpAmount.value)
    if (!response.success) throw new Error(response.error || 'Không thể gửi yêu cầu nạp tiền')
    showTournamentDebtTopUpModal.value = false
    toast.success('Yêu cầu nạp tiền đã được gửi và đang chờ duyệt')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Không thể gửi yêu cầu nạp tiền')
  } finally {
    tournamentDebtTopUpSubmitting.value = false
  }
}

const getTournamentCostForPlayer = (tournamentId: string, player: any): number => {
  const baseCost = calculateCostPerPlayer(tournamentId)
  return isGoalkeeper(player.position) && !isGkTournamentDiscountCancelled(player.id)
    ? Math.round(baseCost / 2)
    : baseCost
}

// Helper function to get detailed money change breakdown for a player
const getDetailedMoneyChange = (tournamentId: string, team: any, player: any): { changes: Array<{type: string, amount: number, description: string}>, total: number } => {
  if (!systemStore.currentSettings) return { changes: [], total: 0 }
  
  const tournament = weeklyTournaments.value.find(t => t.id === tournamentId)
  if (!tournament) return { changes: [], total: 0 }
  
  const changes: Array<{type: string, amount: number, description: string}> = []
  
  // Base tournament cost per player
  const costPerPlayer = getTournamentCostForPlayer(tournamentId, player)
  changes.push({
    type: 'cost',
    amount: -costPerPlayer,
    description: isGoalkeeper(player.position) && !isGkTournamentDiscountCancelled(player.id)
      ? 'Chi phí giải đấu mỗi cầu thủ (GK giảm 50%)'
      : 'Chi phí giải đấu mỗi cầu thủ'
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
      const winAmount = getBettingWinAmount()
      changes.push({
        type: 'betting_win',
        amount: winAmount,
        description: 'Cược thắng'
      })
    } else {
      // Betting loser
      changes.push({
        type: 'betting_loss',
        amount: -10000,
        description: 'Cược thua'
      })
    }
  }
  
  if (isLoserTeam) {
    // Loser team penalty
    changes.push({
      type: 'team_loss',
      amount: -10000,
      description: 'Cầu thủ đội thua'
    })
  }
  
  // Water cost calculations
  if (hasWater && !isWinnerTeam) {
    // Winner team gets free water, others pay if they selected water
    const waterCost = 10000
    changes.push({
      type: 'water',
      amount: -waterCost,
      description: 'Chi phí nước'
    })
  } else if (hasWater && isWinnerTeam) {
    changes.push({
      type: 'water_free',
      amount: 0,
      description: 'Miễn phí nước (đội thắng)'
    })
  }
  
  const total = changes.reduce((sum, change) => sum + change.amount, 0)
  
  return { changes, total }
}
</script>
