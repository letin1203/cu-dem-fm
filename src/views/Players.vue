<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">Cầu thủ</h1>
      <button 
        v-if="authStore.hasPermission('canEditPlayers')"
        @click="showAddForm = true" 
        class="btn-primary w-full sm:w-auto"
      >
        Thêm cầu thủ
      </button>
      <button v-if="authStore.hasPermission('canEditPlayers')" @click="openFriendsModal" class="btn-secondary w-full sm:w-auto">Danh sách bạn</button>
    </div>

    <!-- Filter Section -->
    <div class="card p-4 space-y-4">
      <div class="max-w-md">
        <label class="form-label">Tìm theo tên cầu thủ</label>
        <input
          v-model="playerNameFilter"
          type="text"
          class="form-input"
          placeholder="Nhập tên cầu thủ (có hoặc không dấu)..."
        >
      </div>
      
      <!-- Tier Filter -->
      <div>
        <label class="form-label">Lọc theo Tier</label>
        <div class="flex flex-wrap gap-2 mt-2">
          <button
            @click="selectedTier = null"
            :class="selectedTier === null 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
            class="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Tất cả Tier
          </button>
          <button
            v-for="tier in tierOptions"
            :key="tier"
            @click="selectedTier = tier"
            :class="selectedTier === tier 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
            class="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Tier {{ tier }}
          </button>
        </div>
      </div>

      <div>
        <button
          type="button"
          class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          :class="showDebtOnly ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-red-50 text-red-700 hover:bg-red-100'"
          @click="showDebtOnly = !showDebtOnly"
        >
          {{ showDebtOnly ? 'Đang lọc danh sách nợ' : 'Lọc danh sách nợ' }}
        </button>
      </div>
    </div>

    <!-- Players Table/Cards -->
    <div class="card p-0 sm:p-6 overflow-hidden">
      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-8">
        <div class="text-red-600 mb-2">{{ error }}</div>
        <button @click="playersStore.fetchPlayers()" class="btn-secondary">
          Thử lại
        </button>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredPlayers.length === 0" class="text-center py-8">
        <div class="text-gray-500 mb-4" v-if="playerNameFilter || selectedTier">
          Không có cầu thủ nào phù hợp với bộ lọc hiện tại.
        </div>
        <div class="text-gray-500 mb-4" v-else>
          Chưa có cầu thủ nào.
        </div>
        <button 
          v-if="authStore.hasPermission('canEditPlayers')"
          @click="showAddForm = true" 
          class="btn-primary"
        >
          Thêm cầu thủ đầu tiên
        </button>
      </div>

      <!-- Players Content -->
      <div v-else>
        <!-- Mobile Cards View -->
      <div class="block sm:hidden">
        <div
          v-for="(player, index) in filteredPlayers"
          :key="player.id"
          class="border-b border-gray-200 p-4 last:border-b-0"
        >
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center space-x-3">
              <div class="h-10 w-10 overflow-hidden rounded-full bg-primary-100 flex items-center justify-center">
                <img v-if="player.avatar" :src="player.avatar" :alt="player.name" class="h-full w-full object-cover">
                <span v-else class="text-primary-600 font-medium text-sm">
                  {{ player.name.split(' ').map(n => n[0]).join('') }}
                </span>
              </div>
              <div>
                <button type="button" class="text-left text-sm font-medium text-gray-900 hover:text-primary-700 hover:underline" @click="openPlayerProfile(player)">{{ index + 1 }}. {{ player.name }}</button>
                <div class="text-xs text-gray-500">{{ displayPosition(player.position) }}<template v-if="player.positionSecond">-{{ displayPosition(player.positionSecond) }}</template> • {{ player.yearOfBirth }}</div>
              </div>
            </div>
            <div class="flex space-x-2">
              <button @click="openMoneyHistory(player)" class="text-green-600 hover:text-green-800 p-1" title="Xem lịch sử tiền">
                ₫
              </button>
              <button
                v-if="authStore.hasPermission('canEditPlayers')"
                @click="editPlayer(player)"
                class="text-primary-600 hover:text-primary-800 p-1"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                v-if="authStore.hasPermission('canDeletePlayers')"
                @click="deletePlayer(player.id)"
                class="text-red-600 hover:text-red-800 p-1"
                title="Chuyển Inactive"
                aria-label="Chuyển Inactive"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-3 text-xs justify-between">
            <div>
              <div class="flex items-center mt-1">
                <span class="font-medium text-gray-700">Tier {{ player.tier }}</span>
              </div>
            </div>
            <div class="text-right">
              <span class="text-gray-500">Tiền:</span>
              <span class="ml-1 text-sm font-medium" :class="player.money < 0 ? 'text-red-600' : 'text-gray-900'">{{ formatMoney(player.money) }}</span>
            </div>
          </div>
        </div>
        
        <!-- Load All Players Button for Mobile -->
        <div v-if="!playersStore.isShowingAll" class="text-center mt-6 p-4 border-t border-gray-200">
          <button
            @click="loadAllPlayers"
            :disabled="playersStore.loadingAll"
            class="btn-primary w-full"
            :class="{ 'opacity-50 cursor-not-allowed': playersStore.loadingAll }"
          >
            <span v-if="playersStore.loadingAll" class="flex items-center justify-center">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Đang tải tất cả cầu thủ...
            </span>
            <span v-else>
              Tải tất cả cầu thủ (còn {{ remainingPlayersCount }})
            </span>        </button>
      </div>
      </div>

      <!-- Desktop Table View -->
      <div class="hidden sm:block overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STT</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tên
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vị trí
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vị trí 2nd
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Năm sinh
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tier
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tiền
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="(player, index) in filteredPlayers" :key="player.id" class="hover:bg-gray-50">
              <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{{ index + 1 }}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-10 w-10">
                    <div class="h-10 w-10 overflow-hidden rounded-full bg-primary-100 flex items-center justify-center">
                      <img v-if="player.avatar" :src="player.avatar" :alt="player.name" class="h-full w-full object-cover">
                      <span v-else class="text-primary-600 font-medium">
                        {{ player.name.split(' ').map(n => n[0]).join('') }}
                      </span>
                    </div>
                  </div>
                  <div class="ml-4">
                    <button type="button" class="text-left text-sm font-medium text-gray-900 hover:text-primary-700 hover:underline" @click="openPlayerProfile(player)">{{ player.name }}</button>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ displayPosition(player.position) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ player.positionSecond ? displayPosition(player.positionSecond) : '—' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ player.yearOfBirth }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <span class="font-medium text-gray-700">{{ player.tier }}</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm" :class="player.money < 0 ? 'text-red-600' : 'text-gray-900'">
                {{ player.money.toLocaleString('vi-VN') }} ₫
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex space-x-2">
                  <button @click="openMoneyHistory(player)" class="text-green-600 hover:text-green-900" title="Xem lịch sử tiền">
                    Lịch sử tiền
                  </button>
                  <button
                    v-if="authStore.hasPermission('canEditPlayers')"
                    @click="editPlayer(player)"
                    class="text-primary-600 hover:text-primary-900"
                  >
                    Sửa
                  </button>
                  <button
                    v-if="authStore.hasPermission('canDeletePlayers')"
                    @click="deletePlayer(player.id)"
                    class="text-red-600 hover:text-red-900"
                  >
                    Inactive
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Load All Players Button -->
      <div v-if="!playersStore.isShowingAll" class="text-center mt-6 p-6 border-t border-gray-200">
        <button
          @click="loadAllPlayers"
          :disabled="playersStore.loadingAll"
          class="btn-primary"
          :class="{ 'opacity-50 cursor-not-allowed': playersStore.loadingAll }"
        >
          <span v-if="playersStore.loadingAll" class="flex items-center justify-center">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Đang tải tất cả cầu thủ...
          </span>
          <span v-else>
            Tải tất cả cầu thủ (còn {{ remainingPlayersCount }})
          </span>
        </button>
      </div>
      </div>
    </div>

    <div v-if="showPlayerProfileModal" class="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/50 p-4" @click.self="closePlayerProfileModal">
      <div class="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div class="flex items-start justify-between border-b p-5">
          <div><h2 class="text-lg font-semibold text-gray-900">Hồ sơ cầu thủ</h2><p class="mt-1 text-sm text-gray-500">Thông tin, lịch sử tiền và các giải đấu đã tham gia.</p></div>
          <button type="button" class="text-2xl leading-none text-gray-400 hover:text-gray-700" @click="closePlayerProfileModal">×</button>
        </div>
        <div v-if="playerProfileLoading" class="flex justify-center py-16"><div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600"></div></div>
        <div v-else-if="playerProfileError" class="p-8 text-center text-red-600">{{ playerProfileError }}</div>
        <div v-else-if="selectedProfilePlayer" class="min-h-0 overflow-y-auto p-5">
          <div class="grid gap-5 lg:grid-cols-3">
            <div class="space-y-5">
              <section class="rounded-lg border border-gray-200 p-5 text-center">
                <div class="mx-auto mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary-100"><img v-if="selectedProfilePlayer.avatar" :src="selectedProfilePlayer.avatar" :alt="selectedProfilePlayer.name" class="h-full w-full object-cover"><span v-else class="text-xl font-semibold text-primary-700">{{ selectedProfilePlayer.name.charAt(0) }}</span></div>
                <h3 class="text-xl font-bold text-gray-900">{{ selectedProfilePlayer.name }}</h3>
                <p class="mt-1 text-sm text-gray-600">{{ displayPosition(selectedProfilePlayer.position) }}<template v-if="selectedProfilePlayer.positionSecond"> - {{ displayPosition(selectedProfilePlayer.positionSecond) }}</template> · Tier {{ selectedProfilePlayer.tier }}</p>
                <div class="mt-4 space-y-2 border-t pt-4 text-sm"><div class="flex justify-between"><span class="text-gray-600">Năm sinh</span><strong>{{ selectedProfilePlayer.yearOfBirth }}</strong></div><div class="flex justify-between"><span class="text-gray-600">Tuổi</span><strong>{{ new Date().getFullYear() - selectedProfilePlayer.yearOfBirth }} tuổi</strong></div><div class="flex justify-between"><span class="text-gray-600">Số dư</span><strong :class="selectedProfilePlayer.money < 0 ? 'text-red-600' : 'text-green-600'">{{ formatMoney(selectedProfilePlayer.money) }}</strong></div></div>
                <div v-if="isOwnProfilePlayer && profilePendingTopUpTotal > 0" class="mt-3 rounded-lg bg-yellow-50 px-3 py-2 text-left text-sm text-yellow-800"><p>Đang chờ duyệt: <strong>{{ formatMoney(profilePendingTopUpTotal) }}</strong></p><div v-for="request in profilePendingTopUps" :key="request.id" class="mt-1 flex items-center justify-between gap-2 text-xs text-yellow-700"><span>+{{ formatMoney(request.amount) }} · Nạp lúc {{ formatProfileDate(request.requestedAt) }}</span><button type="button" class="inline-flex shrink-0 items-center justify-center rounded p-0.5 text-yellow-700 hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50" :disabled="cancellingProfileTopUpId === request.id" title="Hủy yêu cầu nạp tiền" aria-label="Hủy yêu cầu nạp tiền" @click="cancelProfilePendingTopUp(request.id)"><svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M18 6 6 18" /></svg></button></div></div>
                <button v-if="isOwnProfilePlayer" type="button" class="btn-primary mt-5 w-full" @click="openSelfTopUpModal">Nạp tiền</button>
              </section>
              <section class="rounded-lg border border-gray-200 p-5"><h3 class="mb-3 font-semibold text-gray-900">Lịch sử biến động tiền</h3><p v-if="profileMoneyHistoryLoading" class="text-sm text-gray-500">Đang tải...</p><p v-else-if="!profileMoneyHistory.length" class="text-sm text-gray-500">Chưa có biến động tiền.</p><div v-else class="space-y-3"><div v-for="item in profileMoneyHistory" :key="item.id" class="border-b border-gray-100 pb-3 last:border-0"><div class="flex justify-between gap-2 text-sm"><span class="min-w-0 text-gray-700">{{ item.description }}</span><strong class="shrink-0 whitespace-nowrap" :class="item.amount >= 0 ? 'text-green-600' : 'text-red-600'">{{ item.amount >= 0 ? '+' : '' }}{{ formatMoney(item.amount) }}</strong></div><p class="mt-1 text-xs text-gray-500">{{ formatProfileDate(item.createdAt) }}</p></div></div><div v-if="profileMoneyPagination.pages > 1" class="mt-4 flex items-center justify-between border-t pt-3"><button type="button" class="btn-secondary text-sm" :disabled="profileMoneyPagination.page <= 1" @click="loadProfileMoneyHistory(profileMoneyPagination.page - 1)">Trước</button><span class="text-xs text-gray-500">Trang {{ profileMoneyPagination.page }} / {{ profileMoneyPagination.pages }}</span><button type="button" class="btn-secondary text-sm" :disabled="profileMoneyPagination.page >= profileMoneyPagination.pages" @click="loadProfileMoneyHistory(profileMoneyPagination.page + 1)">Sau</button></div></section>
            </div>
            <div class="space-y-5 lg:col-span-2">
              <section class="rounded-lg border border-gray-200 p-5"><h3 class="mb-3 text-lg font-semibold text-gray-900">Giải đấu gần nhất</h3><div v-if="latestProfileTournament" class="rounded-lg bg-gray-50 p-4 text-sm"><div class="flex flex-wrap items-start justify-between gap-2"><div><p class="font-semibold text-gray-900">{{ latestProfileTournament.tournament.name }}</p><p class="mt-1 text-gray-500">{{ formatProfileDate(latestProfileTournament.tournament.startDate) }}</p></div><span class="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-medium text-primary-700">{{ profileTournamentStatus(latestProfileTournament.tournament.status) }}</span></div><div class="mt-4 grid gap-2 sm:grid-cols-2"><p><span class="text-gray-500">Đội của cầu thủ: </span><strong>{{ profileTeamName(latestProfileTournament) }}</strong></p><p><span class="text-gray-500">Đội vô địch: </span><strong>{{ profileHighestTeam(latestProfileTournament) }}</strong></p><p><span class="text-gray-500">Đội thua: </span><strong>{{ profileLowestTeam(latestProfileTournament) }}</strong></p><p v-if="latestProfileTournament.withWater" class="text-blue-600">Có uống nước</p><p v-if="latestProfileTournament.bet" class="text-yellow-700">Có Ngôi sao hy vọng</p></div></div><p v-else class="text-sm text-gray-500">Cầu thủ chưa tham gia giải đấu nào.</p></section>
              <section class="rounded-lg border border-gray-200 p-5"><h3 class="mb-3 text-lg font-semibold text-gray-900">Lịch sử danh sách các giải đấu</h3><div v-if="olderProfileTournaments.length" class="divide-y divide-gray-100"><div v-for="attendance in olderProfileTournaments" :key="attendance.id" class="flex flex-col justify-between gap-2 py-3 first:pt-0 sm:flex-row sm:items-center"><div><p class="font-medium text-gray-900">{{ attendance.tournament.name }}</p><p class="mt-1 text-sm text-gray-500">{{ formatProfileDate(attendance.tournament.startDate) }} · {{ profileTeamName(attendance) }}</p></div><span class="w-fit rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{{ profileTournamentStatus(attendance.tournament.status) }}</span></div></div><p v-else class="text-sm text-gray-500">Chưa có giải đấu cũ hơn.</p></section>
            </div>
          </div>
        </div>
        <div class="flex justify-end border-t p-4"><button type="button" class="btn-primary" @click="closePlayerProfileModal">Đóng</button></div>
      </div>
    </div>

    <div v-if="showSelfProfileTopUpModal" class="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/50 p-4" @click.self="showSelfProfileTopUpModal = false"><div class="my-auto max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl"><h2 class="text-lg font-semibold text-gray-900">Nạp tiền</h2><p class="mt-1 text-sm text-gray-500">Yêu cầu sẽ chờ quản trị viên duyệt.</p><img src="/quy-momo.jpg" alt="Mã QR MoMo nạp quỹ" class="mx-auto my-5 w-full max-w-xs rounded-lg border border-gray-200"><div class="grid grid-cols-2 gap-3"><button v-for="amount in selfProfileTopUpOptions" :key="amount" type="button" class="rounded-lg border px-4 py-3 font-medium" :class="selfProfileTopUpAmount === amount ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-200'" @click="selfProfileTopUpAmount = amount">{{ formatMoney(amount) }}</button></div><label class="form-label mt-5 block">Hoặc nhập số tiền khác</label><input v-model.number="selfProfileTopUpAmount" type="number" min="1" class="form-input mt-1"><div class="mt-6 flex justify-end gap-3"><button type="button" class="btn-secondary" @click="showSelfProfileTopUpModal = false">Hủy</button><button type="button" class="btn-primary" :disabled="selfProfileTopUpSaving" @click="submitSelfProfileTopUp">{{ selfProfileTopUpSaving ? 'Đang gửi...' : 'Xác nhận' }}</button></div></div></div>

    <PlayerMoneyDetailModal
      :is-open="showMoneyHistory"
      :player="selectedMoneyPlayer"
      :history="moneyHistory"
      :pagination="moneyHistoryPagination"
      :loading="moneyHistoryLoading"
      :error="moneyHistoryError"
      :can-deduct="authStore.hasAnyRole(['admin', 'mod'])"
      :deducting="deductingMoney"
      @close="showMoneyHistory = false"
      @page-change="loadMoneyHistory"
      @deduct="deductPlayerMoney"
    />

    <ConfirmationModal
      :is-open="showInactiveConfirm"
      title="Chuyển cầu thủ sang Inactive"
      message="Cầu thủ sẽ không còn hiển thị trong danh sách và không thể được admin/mod điểm danh. Dữ liệu lịch sử vẫn được giữ lại."
      confirm-label="Chuyển Inactive"
      :loading="playersStore.loading"
      @cancel="showInactiveConfirm = false; inactivePlayerId = null"
      @confirm="confirmInactivePlayer"
    />

    <!-- Add/Edit Player Modal -->
    <div v-if="showAddForm || editingPlayer" class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-gray-600 bg-opacity-50 p-4">
      <div class="my-auto max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6">
        <h2 class="text-lg font-semibold mb-4">
          {{ editingPlayer ? 'Chỉnh sửa cầu thủ' : 'Thêm cầu thủ' }}
        </h2>
        
        <form @submit.prevent="submitForm" class="space-y-4">
          <div>
            <label class="form-label">Tên cầu thủ</label>
            <input
              v-model="formData.name"
              type="text"
              required
              class="form-input"
              placeholder="Nhập tên cầu thủ"
            >
          </div>
          
          <div>
            <label class="form-label">Vị trí</label>
            <select v-model="formData.position" required class="form-input">
              <option value="">Chọn vị trí</option>
              <option value="GK">GK - Thủ môn</option>
              <option value="DEF">DEF - Hậu vệ</option>
              <option value="MID">MID - Tiền vệ</option>
              <option value="FWD">FWD - Tiền đạo</option>
            </select>
          </div>
          <div v-if="formData.position">
            <label class="form-label">Vị trí 2nd</label>
            <select v-model="formData.positionSecond" class="form-input">
              <option value="">Không chọn</option>
              <option v-for="position in positionOptions.filter(item => item.value !== formData.position)" :key="position.value" :value="position.value">{{ position.label }}</option>
            </select>
          </div>
          
          <div>
            <label class="form-label">Năm sinh</label>
            <input
              v-model="formData.yearOfBirth"
              type="number"
              required
              min="1960"
              max="2010"
              class="form-input"
              placeholder="VD: 1987"
            >
          </div>
          
          <div>
            <label class="form-label">Tier (1-6, Tier 1 mạnh nhất)</label>
            <select v-model="formData.tier" required class="form-input">
              <option value="">Chọn Tier</option>
              <option v-for="tier in 6" :key="tier" :value="tier">Tier {{ tier }}</option>
            </select>
          </div>
          
          <div v-if="!editingPlayer?.friendOwnerId">
            <label class="form-label">Tiền (₫)</label>
            <input
              v-model="formData.money"
              type="number"
              :readonly="!!editingPlayer"
              :required="!editingPlayer"
              min="0"
              step="1000"
              class="form-input"
              :class="{ 'bg-gray-100 cursor-not-allowed': editingPlayer }"
              placeholder="VD: 50000"
            >
            <button v-if="editingPlayer" type="button" @click="openAdminTopUp" class="btn-secondary w-full mt-2">Nạp tiền</button>
          </div>
          
          <div class="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              @click="cancelForm"
              class="btn-secondary"
            >
              Hủy
            </button>
            <button type="submit" class="btn-primary">
              {{ editingPlayer ? 'Cập nhật' : 'Tạo cầu thủ' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="showAdminTopUpModal" class="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain bg-gray-900/50 p-4" @click.self="showAdminTopUpModal = false">
      <div class="my-auto max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <h2 class="text-lg font-semibold text-gray-900">Nạp tiền cho {{ editingPlayer?.name }}</h2>
        <p class="text-sm text-gray-500 mt-1 mb-4">Khoản nạp của Admin/Mod được duyệt tự động.</p>
        <img src="/quy-momo.jpg" alt="Mã QR MoMo nạp quỹ" class="w-full max-w-xs mx-auto rounded-lg border border-gray-200 mb-5">
        <div class="grid grid-cols-2 gap-3"><button v-for="amount in topUpAmounts" :key="amount" type="button" @click="selectedTopUpAmount = amount" class="rounded-lg border px-4 py-3 font-medium transition-colors" :class="selectedTopUpAmount === amount ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'">{{ amount.toLocaleString('vi-VN') }} ₫</button></div><label for="admin-top-up" class="form-label mt-5 block">Hoặc nhập số tiền khác</label><div class="mt-1 flex items-center gap-2"><button type="button" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xl font-semibold text-gray-700 hover:bg-gray-200" @click="selectedTopUpAmount = Math.max(0, selectedTopUpAmount - 100000)">−</button><div class="relative flex-1"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₫</span><input id="admin-top-up" v-model.number="selectedTopUpAmount" type="number" min="0" class="form-input pl-8" placeholder="Nhập số tiền"></div><button type="button" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-xl font-semibold text-primary-700 hover:bg-primary-200" @click="selectedTopUpAmount += 100000">+</button></div>
        <p class="mt-1 text-center text-xs text-gray-500">Đang nhập: {{ formatMoney(selectedTopUpAmount) }}</p><div class="mt-4"><label class="form-label">Lý do</label><textarea v-model="adminTopUpReason" rows="3" class="form-input" /></div>
        <div class="flex justify-end gap-3 mt-6"><button type="button" @click="showAdminTopUpModal = false" class="btn-secondary">Hủy</button><button type="button" @click="submitAdminTopUp" :disabled="submittingAdminTopUp" class="btn-primary">{{ submittingAdminTopUp ? 'Đang nạp...' : 'Xác nhận' }}</button></div>
      </div>
    </div>

    <div v-if="showFriendsModal" class="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/50 p-4" @click.self="showFriendsModal = false">
      <div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between"><h2 class="text-lg font-semibold">Danh sách bạn</h2><button class="text-2xl text-gray-400" @click="showFriendsModal = false">×</button></div>
        <p v-if="friendsListLoading" class="py-8 text-center text-gray-500">Đang tải...</p>
        <div v-else-if="!friendGroups.length" class="py-8 text-center text-gray-500">Chưa có bạn nào.</div>
        <div v-else class="mt-4 space-y-4"><section v-for="user in friendGroups" :key="user.id" class="rounded-lg border border-gray-200 p-4"><h3 class="font-semibold text-gray-900">{{ user.username }} <span class="font-normal text-gray-500">({{ user.player?.name || 'Chưa gắn cầu thủ' }})</span></h3><div class="mt-3 space-y-2"><div v-for="friend in user.friends" :key="friend.id" class="flex items-center justify-between rounded bg-gray-50 px-3 py-2"><span>{{ friend.name }} · {{ displayPosition(friend.position) }} · Tier {{ friend.tier }}</span><button class="text-primary-600 hover:text-primary-800" @click="editFriend(friend)">Sửa</button></div></div></section></div>
        <div class="mt-6 flex justify-end"><button class="btn-secondary" @click="showFriendsModal = false">Đóng</button></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { usePlayersStore } from '../stores/players'
import { useTeamsStore } from '../stores/teams'
import { useAuthStore } from '../stores/auth'
import { apiClient } from '../api/client'
import { useToast } from 'vue-toastification'
import PlayerMoneyDetailModal from '../components/PlayerMoneyDetailModal.vue'
import ConfirmationModal from '../components/ConfirmationModal.vue'
import type { Player, PlayerMoneyHistory } from '../types'
import { formatMoney } from '../utils/money'

const playersStore = usePlayersStore()
const teamsStore = useTeamsStore()
const authStore = useAuthStore()
const toast = useToast()

const players = computed(() => playersStore.players)
const loading = computed(() => playersStore.loading)
const error = computed(() => playersStore.error)
const showAddForm = ref(false)
const editingPlayer = ref<Player | null>(null)
const playerNameFilter = ref('')
const selectedTier = ref<number | null>(null)
const showDebtOnly = ref(false)
const showPlayerProfileModal = ref(false)
const selectedProfilePlayer = ref<Player | null>(null)
const playerProfileLoading = ref(false)
const playerProfileError = ref<string | null>(null)
const profileMoneyHistory = ref<PlayerMoneyHistory[]>([])
const profileMoneyHistoryLoading = ref(false)
const profileMoneyPagination = ref({ page: 1, pages: 0, total: 0 })
const profileTournamentHistory = ref<any[]>([])
const showSelfProfileTopUpModal = ref(false)
const selfProfileTopUpSaving = ref(false)
const selfProfileTopUpAmount = ref(100000)
const selfProfileTopUpOptions = [50000, 100000, 200000, 500000]
const profilePendingTopUps = ref<Array<{ id: string; amount: number; requestedAt: string | Date }>>([])
const cancellingProfileTopUpId = ref<string | null>(null)
const showMoneyHistory = ref(false)
const selectedMoneyPlayer = ref<Player | null>(null)
const moneyHistory = ref<PlayerMoneyHistory[]>([])
const moneyHistoryLoading = ref(false)
const moneyHistoryError = ref<string | null>(null)
const moneyHistoryPagination = ref({ page: 1, pages: 0, total: 0 })
const deductingMoney = ref(false)
const showAdminTopUpModal = ref(false)
const submittingAdminTopUp = ref(false)
const selectedTopUpAmount = ref(100000)
const adminTopUpReason = ref('')
const topUpAmounts = [50000, 100000, 200000, 500000]
const showFriendsModal = ref(false)
const friendsListLoading = ref(false)
const friendGroups = ref<any[]>([])
const showInactiveConfirm = ref(false)
const inactivePlayerId = ref<string | null>(null)

const tierOptions = [1, 2, 3, 4, 5, 6]
const positionOptions = [
  { value: 'GK', label: 'GK - Thủ môn' },
  { value: 'DEF', label: 'DEF - Hậu vệ' },
  { value: 'MID', label: 'MID - Tiền vệ' },
  { value: 'FWD', label: 'FWD - Tiền đạo' },
]

const positionLabels: Record<string, string> = {
  GK: 'GK',
  DEF: 'DEF',
  MID: 'MID',
  FWD: 'FWD',
  Goalkeeper: 'GK',
  Defender: 'DEF',
  Midfielder: 'MID',
  Forward: 'FWD'
}

function displayPosition(position: string) {
  return positionLabels[position] || position
}

const normalizeSearchText = (value: string) => value
  .toLocaleLowerCase('vi')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .trim()

// Computed properties for pagination and filtering
const filteredPlayers = computed(() => {
  // Friend players are managed from the dedicated friend list, not the main roster.
  let result = players.value.filter(player => !player.friendOwnerId)
  
  // Apply name filter if provided
  if (playerNameFilter.value) {
    const query = normalizeSearchText(playerNameFilter.value)
    result = result.filter(player => 
      normalizeSearchText(player.name).includes(query)
    )
  }
  
  // Apply tier filter if provided
  if (selectedTier.value !== null) result = result.filter(player => player.tier === selectedTier.value)

  if (showDebtOnly.value) result = result.filter(player => player.money < 0)
  
  // Keep debtors ordered from the largest debt to the smallest debt.
  return showDebtOnly.value ? [...result].sort((a, b) => a.money - b.money || a.tier - b.tier) : result
})

const remainingPlayersCount = computed(() => {
  return Math.max(0, playersStore.totalPlayers - players.value.length)
})

const isOwnProfilePlayer = computed(() => {
  const currentPlayerId = authStore.currentUser?.playerId || authStore.currentUser?.player?.id
  return Boolean(currentPlayerId && selectedProfilePlayer.value?.id === currentPlayerId)
})
const profilePendingTopUpTotal = computed(() => Array.isArray(profilePendingTopUps.value) ? profilePendingTopUps.value.reduce((total, request) => total + request.amount, 0) : 0)
const latestProfileTournament = computed(() => profileTournamentHistory.value[0] || null)
const olderProfileTournaments = computed(() => profileTournamentHistory.value.slice(1))

const formatProfileDate = (value: string | Date) => new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const profileTournamentStatus = (status: string) => ({ UPCOMING: 'Sắp diễn ra', ONGOING: 'Đang diễn ra', COMPLETED: 'Đã hoàn thành' }[status] || status)
const profileTeamName = (attendance: any) => attendance.tournament?.tournamentTeamPlayers?.[0]?.team?.name || 'Chưa chia đội'
const profileHighestTeam = (attendance: any) => {
  if (attendance.tournament?.status !== 'COMPLETED') return 'Chưa xác định'
  const teams = attendance.tournament?.teams || []
  return teams.length ? teams.reduce((highest: any, item: any) => (item.team.score > highest.team.score ? item : highest)).team.name : 'Chưa xác định'
}
const profileLowestTeam = (attendance: any) => {
  if (attendance.tournament?.status !== 'COMPLETED') return 'Chưa xác định'
  const teams = attendance.tournament?.teams || []
  return teams.length ? teams.reduce((lowest: any, item: any) => (item.team.score < lowest.team.score ? item : lowest)).team.name : 'Chưa xác định'
}

async function loadProfileMoneyHistory(page = 1) {
  if (!selectedProfilePlayer.value) return
  profileMoneyHistoryLoading.value = true
  try {
    const response = await apiClient.getPlayerMoneyHistory(selectedProfilePlayer.value.id, { page, limit: 10 })
    if (!response.success || !response.data) throw new Error(response.error || 'Không thể tải lịch sử biến động tiền')
    const data = response.data as { history: PlayerMoneyHistory[]; pagination: { page: number; pages: number; total: number } }
    profileMoneyHistory.value = data.history
    profileMoneyPagination.value = data.pagination
  } catch (error: any) {
    profileMoneyHistory.value = []
    toast.error(error.message || 'Không thể tải lịch sử biến động tiền')
  } finally { profileMoneyHistoryLoading.value = false }
}

async function loadProfilePendingTopUps() {
  if (!isOwnProfilePlayer.value) {
    profilePendingTopUps.value = []
    return
  }
  try {
    const response = await apiClient.getMyPendingMoneyTopUps()
    if (!response.success) throw new Error(response.error || 'Không thể tải yêu cầu nạp tiền đang chờ duyệt')
    const data = (response.data || {}) as { requests?: Array<{ id: string; amount: number; requestedAt: string | Date }> }
    profilePendingTopUps.value = Array.isArray(data.requests) ? data.requests : []
  } catch (error: any) {
    profilePendingTopUps.value = []
    toast.error(error.message || 'Không thể tải yêu cầu nạp tiền đang chờ duyệt')
  }
}

async function cancelProfilePendingTopUp(id: string) {
  cancellingProfileTopUpId.value = id
  try {
    const response = await apiClient.cancelMyMoneyTopUp(id)
    if (!response.success) throw new Error(response.error || 'Không thể hủy yêu cầu nạp tiền')
    await loadProfilePendingTopUps()
    window.dispatchEvent(new Event('pending-money-top-ups-changed'))
    toast.success('Đã hủy yêu cầu nạp tiền')
  } catch (error: any) { toast.error(error.message || 'Không thể hủy yêu cầu nạp tiền') }
  finally { cancellingProfileTopUpId.value = null }
}

async function openPlayerProfile(player: Player) {
  showPlayerProfileModal.value = true
  selectedProfilePlayer.value = player
  playerProfileError.value = null
  playerProfileLoading.value = true
  try {
    const [playerResponse, tournamentResponse] = await Promise.all([apiClient.getPlayer(player.id), apiClient.getPlayerTournamentHistory(player.id)])
    if (!playerResponse.success || !playerResponse.data) throw new Error(playerResponse.error || 'Không thể tải hồ sơ cầu thủ')
    if (!tournamentResponse.success) throw new Error(tournamentResponse.error || 'Không thể tải lịch sử giải đấu')
    selectedProfilePlayer.value = playerResponse.data as Player
    profileTournamentHistory.value = (tournamentResponse.data || []) as any[]
    await Promise.all([loadProfileMoneyHistory(1), loadProfilePendingTopUps()])
  } catch (error: any) { playerProfileError.value = error.message || 'Không thể tải hồ sơ cầu thủ' }
  finally { playerProfileLoading.value = false }
}

function closePlayerProfileModal() {
  showPlayerProfileModal.value = false
  selectedProfilePlayer.value = null
  profileMoneyHistory.value = []
  profileTournamentHistory.value = []
  profilePendingTopUps.value = []
}

function openSelfTopUpModal() {
  const debt = selectedProfilePlayer.value?.money || 0
  selfProfileTopUpAmount.value = debt < 0 ? Math.abs(debt) : 100000
  showSelfProfileTopUpModal.value = true
}

async function submitSelfProfileTopUp() {
  if (!Number.isInteger(selfProfileTopUpAmount.value) || selfProfileTopUpAmount.value <= 0) { toast.error('Vui lòng nhập số tiền nạp hợp lệ'); return }
  selfProfileTopUpSaving.value = true
  try {
    const response = await apiClient.createMoneyTopUp(selfProfileTopUpAmount.value)
    if (!response.success) throw new Error(response.error || 'Không thể tạo yêu cầu nạp tiền')
    showSelfProfileTopUpModal.value = false
    await loadProfilePendingTopUps()
    toast.success('Yêu cầu nạp tiền đang chờ duyệt')
  } catch (error: any) { toast.error(error.message || 'Không thể tạo yêu cầu nạp tiền') }
  finally { selfProfileTopUpSaving.value = false }
}

// Load all players function
const loadAllPlayers = async () => {
  await playersStore.loadAllPlayers()
}

onMounted(async () => {
  await Promise.all([
    playersStore.fetchPlayers(), // Load first 100 players
    teamsStore.fetchTeams()
  ])
})

// Watch for filter changes and reset pagination when filter is cleared
watch(playerNameFilter, (newValue, oldValue) => {
  // If filter is cleared (from something to empty), reload all players
  if (oldValue && !newValue) {
    playersStore.fetchPlayers()
  }
})

watch(selectedTier, (newValue, oldValue) => {
  // If tier filter is cleared (from something to null), reload all players
  if (oldValue && !newValue) {
    playersStore.fetchPlayers()
  }
})

const formData = ref({
  name: '',
  position: '',
  positionSecond: '',
  yearOfBirth: '',
  tier: '',
  money: ''
})

function editPlayer(player: Player) {
  editingPlayer.value = player
  formData.value = {
    name: player.name,
    position: player.position,
    positionSecond: player.positionSecond || '',
    yearOfBirth: player.yearOfBirth.toString(),
    tier: player.tier.toString(),
    money: player.money.toString()
  }
}

function submitForm() {
  const playerData = {
    name: formData.value.name,
    position: formData.value.position,
    positionSecond: formData.value.positionSecond || null,
    yearOfBirth: parseInt(formData.value.yearOfBirth),
    tier: parseInt(formData.value.tier),
    teamId: undefined, // Remove team assignment from player creation
    stats: {
      gamesPlayed: 0,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      minutesPlayed: 0
    }
  }

  if (editingPlayer.value) {
    playersStore.updatePlayer(editingPlayer.value.id, playerData)
      .then(() => cancelForm())
      .catch(() => {
        // Error is handled by the store
      })
  } else {
    playersStore.addPlayer({ ...playerData, money: parseInt(formData.value.money) })
      .then(() => {
        cancelForm()
        // Refresh the players list to include the new player
        playersStore.fetchPlayers()
      })
      .catch(() => {
        // Error is handled by the store
      })
  }
}

function cancelForm() {
  showAddForm.value = false
  editingPlayer.value = null
  formData.value = {
    name: '',
    position: '',
    positionSecond: '',
    yearOfBirth: '',
    tier: '',
    money: ''
  }
}

function deletePlayer(id: string) {
  inactivePlayerId.value = id
  showInactiveConfirm.value = true
}

async function confirmInactivePlayer() {
  if (!inactivePlayerId.value) return
  try {
    await playersStore.deletePlayer(inactivePlayerId.value)
    if (playersStore.players.length === 0 && playersStore.currentPage > 1) await playersStore.fetchPlayers()
    toast.success('Đã chuyển cầu thủ sang Inactive')
    showInactiveConfirm.value = false
    inactivePlayerId.value = null
  } catch {
    toast.error('Không thể chuyển cầu thủ sang Inactive')
  }
}

async function openFriendsModal() {
  showFriendsModal.value = true
  friendsListLoading.value = true
  try {
    const response = await apiClient.getFriends()
    if (!response.success) throw new Error(response.error || 'Không thể tải danh sách bạn')
    friendGroups.value = (response.data || []) as any[]
  } catch (error: any) {
    toast.error(error.message || 'Không thể tải danh sách bạn')
  } finally { friendsListLoading.value = false }
}

function editFriend(friend: Player) {
  showFriendsModal.value = false
  editPlayer(friend)
}

function openAdminTopUp() {
  if (!editingPlayer.value) return
  selectedTopUpAmount.value = 100000
  adminTopUpReason.value = `${authStore.currentUser?.username || 'Admin/Mod'} nạp tiền dùm ${editingPlayer.value.name}`
  showAdminTopUpModal.value = true
}

async function submitAdminTopUp() {
  if (!editingPlayer.value) return
  if (!Number.isInteger(selectedTopUpAmount.value) || selectedTopUpAmount.value <= 0) {
    toast.error('Vui lòng nhập số tiền nạp hợp lệ')
    return
  }
  submittingAdminTopUp.value = true
  try {
    const response = await apiClient.createAdminMoneyTopUp(editingPlayer.value.id, selectedTopUpAmount.value, adminTopUpReason.value)
    if (!response.success) throw new Error(response.error || 'Không thể nạp tiền')
    editingPlayer.value.money += selectedTopUpAmount.value
    formData.value.money = editingPlayer.value.money.toString()
    showAdminTopUpModal.value = false
    await playersStore.fetchPlayers()
    toast.success('Đã nạp tiền và duyệt tự động')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Không thể nạp tiền')
  } finally {
    submittingAdminTopUp.value = false
  }

}

async function openMoneyHistory(player: Player) {
  selectedMoneyPlayer.value = player
  showMoneyHistory.value = true
  await loadMoneyHistory(1)
}

async function loadMoneyHistory(page: number) {
  if (!selectedMoneyPlayer.value) return
  moneyHistoryLoading.value = true
  moneyHistoryError.value = null
  try {
    const response = await apiClient.getPlayerMoneyHistory(selectedMoneyPlayer.value.id, { page, limit: 5 })
    if (!response.success || !response.data) throw new Error(response.error || 'Không thể tải lịch sử biến động tiền')
    const data = response.data as { history: PlayerMoneyHistory[]; pagination: { page: number; pages: number; total: number } }
    moneyHistory.value = data.history
    moneyHistoryPagination.value = data.pagination
  } catch (error) {
    moneyHistory.value = []
    moneyHistoryError.value = error instanceof Error ? error.message : 'Không thể tải lịch sử biến động tiền'
  } finally {
    moneyHistoryLoading.value = false
  }
}

async function deductPlayerMoney(payload: { amount: number; reason: string }) {
  if (!selectedMoneyPlayer.value) return
  deductingMoney.value = true
  try {
    const response = await apiClient.deductPlayerMoney(selectedMoneyPlayer.value.id, payload.amount, payload.reason)
    if (!response.success || !response.data) throw new Error(response.error || 'Không thể trừ tiền cầu thủ')
    const data = response.data as { player: Player }
    selectedMoneyPlayer.value.money = data.player.money
    await playersStore.fetchPlayers()
    await loadMoneyHistory(1)
    toast.success('Đã trừ tiền cầu thủ')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Không thể trừ tiền cầu thủ')
  } finally {
    deductingMoney.value = false
  }
}
</script>
