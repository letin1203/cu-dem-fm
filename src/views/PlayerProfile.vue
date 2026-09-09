<template>
  <div class="space-y-4 sm:space-y-6">
    <div
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">
        Hồ sơ cầu thủ của tôi
      </h1>
      <button
        @click="refreshPlayerProfile"
        :disabled="loading"
        class="btn-secondary inline-flex items-center space-x-2"
      >
        <svg
          class="w-4 h-4"
          :class="{ 'animate-spin': loading }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span>{{ loading ? "Đang tải lại..." : "Tải lại" }}</span>
      </button>
    </div>

    <div v-if="loading" class="flex justify-center items-center py-8">
      <div
        class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"
      ></div>
    </div>
    <div v-else-if="error" class="text-center py-8">
      <div class="text-red-600 mb-2">{{ error }}</div>
      <button @click="fetchPlayerProfile" class="btn-secondary">Thử lại</button>
    </div>
    <div v-else-if="!playerProfile" class="text-center py-8 text-gray-500">
      <p class="text-lg font-medium">Chưa có hồ sơ cầu thủ</p>
      <p class="text-sm mt-1">
        Tài khoản của bạn chưa được liên kết với một cầu thủ.
      </p>
      <p class="text-sm mt-4 text-gray-600">
        Vui lòng liên hệ quản trị viên để được liên kết hồ sơ.
      </p>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-1">
        <div class="card">
          <div class="text-center">
            <div
              class="mx-auto h-20 w-20 rounded-full bg-gray-300 flex items-center justify-center mb-4"
            >
              <img v-if="playerProfile.avatar" :src="playerProfile.avatar" :alt="playerProfile.name" class="h-20 w-20 rounded-full object-cover" />
              <svg
                v-else
                class="h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <button type="button" class="mb-3 text-sm font-medium text-primary-600 hover:text-primary-700" @click="openAvatarModal">Đổi avatar</button>
            <h2 class="text-xl font-bold text-gray-900 mb-2">
              {{ playerProfile.name }}
            </h2>
            <p class="text-gray-600 mb-4">
              {{ displayPosition(playerProfile.position) }}
            </p>
            <div class="flex justify-center items-center mb-4">
              <span class="text-sm text-gray-500 mr-2">Tier:</span>
              <div class="flex">
                <span
                  v-for="star in 6"
                  :key="star"
                  class="w-4 h-4 flex items-center justify-center"
                  :class="
                    star <= 7 - playerProfile.tier
                      ? 'text-yellow-400'
                      : 'text-gray-300'
                  "
                  >★</span
                >
              </div>
              <span class="text-sm text-gray-600 ml-2"
                >(Tier {{ playerProfile.tier }}/6)</span
              >
            </div>
          </div>
          <div class="border-t pt-4 space-y-3">
            <div class="flex justify-between">
              <span class="text-gray-600">Năm sinh:</span
              ><span class="font-medium">{{ playerProfile.yearOfBirth }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Tuổi:</span
              ><span class="font-medium">{{ currentAge }} tuổi</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Số dư:</span
              ><span
                class="font-medium"
                :class="playerProfile.money < 0 ? 'text-red-600' : 'text-green-600'"
                >{{ playerProfile.money.toLocaleString("vi-VN") }} ₫</span
              >
            </div>
            <div
              v-if="pendingTopUpTotal > 0"
              class="rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-800"
            >
              <div>
                Đang chờ duyệt:
                <span class="font-semibold"
                  >{{ pendingTopUpTotal.toLocaleString("vi-VN") }} ₫</span
                >
              </div>
              <div
                v-for="request in pendingTopUps"
                :key="request.id"
                class="mt-1 text-xs text-yellow-700"
              >
                +{{ request.amount.toLocaleString("vi-VN") }} ₫ · Nạp lúc
                {{ formatDateTime(request.requestedAt) }}
              </div>
            </div>
            <button
              @click="openTopUpModal"
              class="btn-primary w-full mt-1"
            >
              Nạp tiền
            </button>
          </div>
        </div>
        <div class="card mt-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            Lịch sử biến động tiền
          </h3>
          <div v-if="moneyHistoryLoading" class="text-sm text-gray-500">
            Đang tải...
          </div>
          <div v-else-if="!moneyHistory.length" class="text-sm text-gray-500">
            Chưa có biến động tiền.
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="item in moneyHistory"
              :key="item.id"
              class="border-b border-gray-100 pb-3 last:border-0 last:pb-0"
            >
              <div class="flex justify-between gap-2 text-sm">
                <span class="min-w-0 text-gray-700">{{ item.description }}</span
                ><span
                  class="shrink-0 whitespace-nowrap font-semibold"
                  :class="item.amount >= 0 ? 'text-green-600' : 'text-red-600'"
                  >{{ item.amount >= 0 ? "+" : ""
                  }}{{ item.amount.toLocaleString("vi-VN") }} ₫</span
                >
              </div>
              <p class="mt-1 text-xs text-gray-500">
                {{ formatDateTime(item.createdAt) }}
              </p>
            </div>
          </div>
          <div
            v-if="moneyHistoryPagination.pages > 1"
            class="mt-4 flex items-center justify-between border-t pt-3"
          >
            <button
              @click="
                loadMoneyHistory(
                  playerProfile!.id,
                  moneyHistoryPagination.page - 1,
                )
              "
              :disabled="moneyHistoryPagination.page <= 1"
              class="btn-secondary text-sm disabled:opacity-50"
            >
              Trước
            </button>
            <span class="text-xs text-gray-500"
              >Trang {{ moneyHistoryPagination.page }} /
              {{ moneyHistoryPagination.pages }}</span
            >
            <button
              @click="
                loadMoneyHistory(
                  playerProfile!.id,
                  moneyHistoryPagination.page + 1,
                )
              "
              :disabled="
                moneyHistoryPagination.page >= moneyHistoryPagination.pages
              "
              class="btn-secondary text-sm disabled:opacity-50"
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      <div class="lg:col-span-2 space-y-6">
        <div class="card">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            Giải đấu gần nhất
          </h3>
          <div
            v-if="latestTournament"
            class="rounded-lg bg-gray-50 p-4 space-y-3"
          >
            <div
              class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"
            >
              <div>
                <p class="font-semibold text-gray-900">
                  {{ latestTournament.tournament.name }}
                </p>
                <p class="text-sm text-gray-500">
                  {{ formatDate(latestTournament.tournament.startDate) }}
                </p>
              </div>
              <span
                class="inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium"
                :class="statusClass(latestTournament.tournament.status)"
                >{{ statusLabel(latestTournament.tournament.status) }}</span
              >
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span class="text-gray-500">Đội của bạn: </span
                ><span class="font-medium">{{
                  teamName(latestTournament)
                }}</span>
              </div>
              <div>
                <span class="text-gray-500">Đội vô địch: </span
                ><span class="font-medium">{{
                  highestScoreTeamName(latestTournament)
                }}</span>
              </div>
              <div>
                <span class="text-gray-500">Đội thua: </span
                ><span class="font-medium">{{
                  lowestScoreTeamName(latestTournament)
                }}</span>
              </div>
              <div v-if="latestTournament.withWater" class="text-blue-600">
                Có uống nước
              </div>
              <div v-if="latestTournament.bet" class="text-yellow-700">
                Có cược
              </div>
            </div>
            <div class="mt-4">
              <h4 class="font-semibold text-gray-900 mb-2">Điểm các đội</h4>
              <div class="space-y-2">
                <div
                  v-for="entry in scoreSortedTeams(latestTournament)"
                  :key="entry.team.id"
                  class="flex justify-between rounded bg-white px-3 py-2 text-sm"
                >
                  <span>{{ entry.team.name }}</span
                  ><strong>⚽ {{ entry.team.score }}</strong>
                </div>
              </div>
            </div>
            <div
              v-if="
                getMoneyHistoryForTournament(latestTournament.tournament.id)
                  .length
              "
              class="mt-4"
            >
              <h4 class="font-semibold text-gray-900 mb-2">
                Lịch sử biến động tiền của bạn
              </h4>
              <div
                v-for="item in getMoneyHistoryForTournament(
                  latestTournament.tournament.id,
                )"
                :key="item.id"
                class="rounded bg-white px-3 py-2 text-sm"
              >
                <div class="flex justify-between gap-3">
                  <span class="min-w-0">{{ item.description }}</span
                  ><strong
                    class="shrink-0 whitespace-nowrap"
                    :class="
                      item.amount >= 0 ? 'text-green-600' : 'text-red-600'
                    "
                    >{{ item.amount >= 0 ? "+" : ""
                    }}{{ item.amount.toLocaleString("vi-VN") }} ₫</strong
                  >
                </div>
                <div
                  v-if="item.details?.length"
                  class="mt-2 space-y-1 border-t pt-2 text-xs text-gray-600"
                >
                  <div
                    v-for="detail in item.details"
                    :key="`${detail.description}-${detail.amount}`"
                    class="flex justify-between gap-3"
                  >
                    <span class="min-w-0">{{ detail.description }}</span
                    ><span class="shrink-0 whitespace-nowrap"
                      >{{ detail.amount >= 0 ? "+" : ""
                      }}{{ detail.amount.toLocaleString("vi-VN") }} ₫</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-gray-500">
            Bạn chưa tham gia giải đấu nào.
          </p>
        </div>

        <div class="card">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            Lịch sử danh sách các giải đấu
          </h3>
          <div
            v-if="olderTournamentHistory.length"
            class="divide-y divide-gray-200"
          >
            <button
              v-for="attendance in paginatedTournamentHistory"
              :key="attendance.id"
              @click="selectedTournamentDetail = attendance"
              class="w-full py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-sm"
            >
              <div>
                <p class="font-medium text-gray-900">
                  {{ attendance.tournament.name }}
                </p>
                <p class="text-sm text-gray-500">
                  {{ formatDate(attendance.tournament.startDate) }} ·
                  {{ teamName(attendance) }}
                </p>
              </div>
              <span
                class="inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium"
                :class="statusClass(attendance.tournament.status)"
                >{{ statusLabel(attendance.tournament.status) }}</span
              >
            </button>
          </div>
          <p v-else class="text-sm text-gray-500">Chưa có giải đấu cũ hơn.</p>
          <div
            v-if="tournamentHistoryPages > 1"
            class="mt-4 flex items-center justify-between border-t pt-3"
          >
            <button
              @click="tournamentHistoryPage--"
              :disabled="tournamentHistoryPage <= 1"
              class="btn-secondary text-sm disabled:opacity-50"
            >
              Trước</button
            ><span class="text-xs text-gray-500"
              >Trang {{ tournamentHistoryPage }} /
              {{ tournamentHistoryPages }}</span
            ><button
              @click="tournamentHistoryPage++"
              :disabled="tournamentHistoryPage >= tournamentHistoryPages"
              class="btn-secondary text-sm disabled:opacity-50"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="showTopUpModal"
      class="fixed inset-0 z-[70] bg-gray-900/50 flex items-center justify-center p-4"
      @click.self="showTopUpModal = false"
    >
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 class="text-lg font-semibold text-gray-900">Nạp tiền</h2>
        <p class="text-sm text-gray-500 mt-1 mb-4">
          Quét mã MoMo để nạp quỹ, sau đó chọn số tiền đã nạp. Yêu cầu sẽ chờ
          quản trị viên duyệt.
        </p>
        <img
          src="/quy-momo.jpg"
          alt="Mã QR MoMo nạp quỹ"
          class="w-full max-w-xs mx-auto rounded-lg border border-gray-200 mb-5"
        />
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="amount in topUpAmounts"
            :key="amount"
            @click="selectedTopUpAmount = amount"
            class="rounded-lg border px-4 py-3 font-medium transition-colors"
            :class="
              selectedTopUpAmount === amount
                ? 'border-primary-600 bg-primary-600 text-white'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            "
          >
            {{ amount.toLocaleString("vi-VN") }} ₫
          </button>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button @click="showTopUpModal = false" class="btn-secondary">
            Hủy</button
          ><button
            @click="submitTopUp"
            :disabled="submittingTopUp"
            class="btn-primary"
          >
            {{ submittingTopUp ? "Đang gửi..." : "Xác nhận" }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showAvatarModal" class="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/50 p-4" @click.self="showAvatarModal = false">
      <div class="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl">
        <div class="flex items-center justify-between border-b p-5">
          <div><h2 class="text-lg font-semibold text-gray-900">Chọn avatar</h2><p class="text-sm text-gray-500">Chọn một hình đại diện cho hồ sơ của bạn.</p></div>
          <button type="button" class="text-2xl leading-none text-gray-400 hover:text-gray-700" @click="showAvatarModal = false">×</button>
        </div>
        <div class="grid grid-cols-4 gap-3 overflow-y-auto p-5 sm:grid-cols-6">
          <button v-for="avatar in avatarOptions" :key="avatar" type="button" class="rounded-full border-2 p-0.5 transition-colors" :class="selectedAvatar === avatar ? 'border-primary-600' : 'border-transparent hover:border-primary-300'" @click="selectedAvatar = avatar">
            <img :src="avatar" alt="Avatar" class="aspect-square w-full rounded-full object-cover">
          </button>
        </div>
        <div class="flex justify-end gap-3 border-t p-4"><button type="button" class="btn-secondary" @click="showAvatarModal = false">Hủy</button><button type="button" class="btn-primary" :disabled="savingAvatar || !selectedAvatar" @click="saveAvatar">{{ savingAvatar ? 'Đang lưu...' : 'Lưu avatar' }}</button></div>
      </div>
    </div>

    <div
      v-if="selectedTournamentDetail"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      @click.self="selectedTournamentDetail = null"
    >
      <div class="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div class="flex items-start justify-between border-b p-5">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">
              {{ selectedTournamentDetail.tournament.name }}
            </h2>
            <p class="text-sm text-gray-500">
              {{ formatDate(selectedTournamentDetail.tournament.startDate) }}
            </p>
          </div>
          <button
            @click="selectedTournamentDetail = null"
            class="text-2xl text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        </div>
        <div class="min-h-0 space-y-4 overflow-y-auto p-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span class="text-gray-500">Trạng thái: </span
              ><span class="font-medium">{{
                statusLabel(selectedTournamentDetail.tournament.status)
              }}</span>
            </div>
            <div>
              <span class="text-gray-500">Đội của bạn: </span
              ><span class="font-medium">{{
                teamName(selectedTournamentDetail)
              }}</span>
            </div>
            <div>
              <span class="text-gray-500">Đội vô địch: </span
              ><span class="font-medium">{{
                highestScoreTeamName(selectedTournamentDetail)
              }}</span>
            </div>
            <div>
              <span class="text-gray-500">Đội thua: </span
              ><span class="font-medium">{{
                lowestScoreTeamName(selectedTournamentDetail)
              }}</span>
            </div>
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 mb-2">Điểm các đội</h3>
            <div class="space-y-2">
              <div
                v-for="entry in scoreSortedTeams(selectedTournamentDetail)"
                :key="entry.team.id"
                class="flex justify-between rounded bg-gray-50 px-3 py-2 text-sm"
              >
                <span>{{ entry.team.name }}</span
                ><strong>⚽ {{ entry.team.score }}</strong>
              </div>
            </div>
          </div>
          <div
            v-if="
              getMoneyHistoryForTournament(
                selectedTournamentDetail.tournament.id,
              ).length
            "
          >
            <h3 class="font-semibold text-gray-900 mb-2">
              Lịch sử biến động tiền của bạn
            </h3>
            <div
              v-for="item in getMoneyHistoryForTournament(
                selectedTournamentDetail.tournament.id,
              )"
              :key="item.id"
              class="rounded bg-gray-50 px-3 py-2 text-sm"
            >
              <div class="flex justify-between gap-3">
                <span class="min-w-0">{{ item.description }}</span
                ><strong
                  class="shrink-0 whitespace-nowrap"
                  :class="item.amount >= 0 ? 'text-green-600' : 'text-red-600'"
                  >{{ item.amount >= 0 ? "+" : ""
                  }}{{ item.amount.toLocaleString("vi-VN") }} ₫</strong
                >
              </div>
              <div
                v-if="item.details?.length"
                class="mt-2 space-y-1 border-t pt-2 text-xs text-gray-600"
              >
                <div
                  v-for="detail in item.details"
                  :key="`${detail.description}-${detail.amount}`"
                  class="flex justify-between gap-3"
                >
                  <span class="min-w-0">{{ detail.description }}</span
                  ><span class="shrink-0 whitespace-nowrap"
                    >{{ detail.amount >= 0 ? "+" : ""
                    }}{{ detail.amount.toLocaleString("vi-VN") }} ₫</span
                  >
                </div>
              </div>
            </div>
          </div>
          <div class="flex gap-2 text-sm">
            <span
              v-if="selectedTournamentDetail.withWater"
              class="rounded bg-blue-100 px-2 py-1 text-blue-700"
              >Có uống nước</span
            ><span
              v-if="selectedTournamentDetail.bet"
              class="rounded bg-yellow-100 px-2 py-1 text-yellow-700"
              >Có cược</span
            >
          </div>
        </div>
        <div class="flex justify-end border-t p-4">
          <button @click="selectedTournamentDetail = null" class="btn-primary">
            Đóng
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useAuthStore } from "../stores/auth";
import { apiClient } from "../api/client";
import { useToast } from "vue-toastification";
import type { Player, PlayerMoneyHistory } from "../types";

interface TournamentAttendanceHistory {
  id: string;
  withWater: boolean;
  bet: boolean;
  tournament: {
    id: string;
    name: string;
    status: "UPCOMING" | "ONGOING" | "COMPLETED";
    startDate: string | Date;
    winner?: { id: string; name: string } | null;
    teams: Array<{ team: { id: string; name: string; score: number } }>;
    tournamentTeamPlayers: Array<{ team: { id: string; name: string } }>;
  };
}

const authStore = useAuthStore();
const toast = useToast();
const loading = ref(false);
const error = ref<string | null>(null);
const playerProfile = ref<Player | null>(null);
const tournamentHistory = ref<TournamentAttendanceHistory[]>([]);
const selectedTournamentDetail = ref<TournamentAttendanceHistory | null>(null);
const tournamentHistoryPage = ref(1);
const tournamentHistoryLimit = 10;
const moneyHistory = ref<PlayerMoneyHistory[]>([]);
const moneyHistoryLoading = ref(false);
const moneyHistoryPagination = ref({ page: 1, pages: 0, total: 0 });
const pendingTopUpTotal = ref(0);
const pendingTopUps = ref<
  Array<{ id: string; amount: number; requestedAt: string | Date }>
>([]);
const showTopUpModal = ref(false);
const submittingTopUp = ref(false);
const selectedTopUpAmount = ref(100000);
const standardTopUpAmounts = [50000, 100000, 200000, 500000];
const debtSettlementAmount = computed(() => {
  const balance = playerProfile.value?.money || 0;
  return balance < 0 ? Math.abs(balance) : null;
});
const topUpAmounts = computed(() => {
  const debtAmount = debtSettlementAmount.value;
  return debtAmount && !standardTopUpAmounts.includes(debtAmount)
    ? [debtAmount, ...standardTopUpAmounts]
    : standardTopUpAmounts;
});
const showAvatarModal = ref(false);
const savingAvatar = ref(false);
const selectedAvatar = ref('');
const avatarOptions = [
  '/avatars/01-side-eye.png', '/avatars/01-sleepy.png', '/avatars/02-excited.png', '/avatars/02-worried.png',
  '/avatars/03-masked.png', '/avatars/03-unimpressed.png', '/avatars/04-laughing.png', '/avatars/04-shouting.png',
  '/avatars/05-popcorn.png', '/avatars/05-smile.png', '/avatars/06-heart.png', '/avatars/06-thinking.png',
  '/avatars/07-bandana.png', '/avatars/07-gesture.png', '/avatars/08-crying.png', '/avatars/08-smirk.png',
  '/avatars/09-annoyed.png', '/avatars/09-laughing-tears.png', '/avatars/10-cool.png', '/avatars/10-sunglasses.png',
  '/avatars/11-kiss.png', '/avatars/11-score-10.png', '/avatars/12-confused.png', '/avatars/12-loser.png',
];
const currentAge = computed(() =>
  playerProfile.value
    ? new Date().getFullYear() - playerProfile.value.yearOfBirth
    : 0,
);
const latestTournament = computed(() => tournamentHistory.value[0] || null);
const olderTournamentHistory = computed(() => tournamentHistory.value.slice(1));
const tournamentHistoryPages = computed(() =>
  Math.ceil(olderTournamentHistory.value.length / tournamentHistoryLimit),
);
const paginatedTournamentHistory = computed(() => {
  const start = (tournamentHistoryPage.value - 1) * tournamentHistoryLimit;
  return olderTournamentHistory.value.slice(
    start,
    start + tournamentHistoryLimit,
  );
});
const positionLabels: Record<string, string> = {
  GK: "GK - Thủ môn",
  DEF: "DEF - Hậu vệ",
  MID: "MID - Tiền vệ",
  FWD: "FWD - Tiền đạo",
  Goalkeeper: "Thủ môn",
  Defender: "Hậu vệ",
  Midfielder: "Tiền vệ",
  Forward: "Tiền đạo",
};
const displayPosition = (position: string) =>
  positionLabels[position] || position;
const teamName = (attendance: TournamentAttendanceHistory) =>
  attendance.tournament.tournamentTeamPlayers[0]?.team.name || "Chưa chia đội";
const scoreSortedTeams = (attendance: TournamentAttendanceHistory) =>
  [...attendance.tournament.teams].sort(
    (first, second) => second.team.score - first.team.score,
  );
const highestScoreTeamName = (attendance: TournamentAttendanceHistory) =>
  scoreSortedTeams(attendance)[0]?.team.name || "Chưa xác định";
const lowestScoreTeamName = (attendance: TournamentAttendanceHistory) => {
  const teams = scoreSortedTeams(attendance);
  return teams[teams.length - 1]?.team.name || "Chưa xác định";
};
const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
const formatDateTime = (date: Date | string) =>
  new Date(date).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const statusLabel = (status: string) =>
  ({
    UPCOMING: "Sắp diễn ra",
    ONGOING: "Đang diễn ra",
    COMPLETED: "Đã hoàn thành",
  })[status] || status;
const statusClass = (status: string) =>
  ({
    UPCOMING: "bg-blue-100 text-blue-700",
    ONGOING: "bg-yellow-100 text-yellow-700",
    COMPLETED: "bg-green-100 text-green-700",
  })[status] || "bg-gray-100 text-gray-700";
const getMoneyHistoryForTournament = (tournamentId: string) =>
  moneyHistory.value.filter((item) => item.tournamentId === tournamentId);

const loadTournamentHistory = async (playerId: string) => {
  const response = await apiClient.getPlayerTournamentHistory(playerId);
  if (!response.success)
    throw new Error(response.error || "Không thể tải lịch sử giải đấu");
  tournamentHistory.value = (response.data ||
    []) as TournamentAttendanceHistory[];
  tournamentHistoryPage.value = 1;
};
const loadMoneyHistory = async (playerId: string, page: number = 1) => {
  moneyHistoryLoading.value = true;
  try {
    const response = await apiClient.getPlayerMoneyHistory(playerId, {
      page,
      limit: 10,
    });
    if (!response.success)
      throw new Error(response.error || "Không thể tải lịch sử biến động tiền");
    const data = response.data as {
      history?: PlayerMoneyHistory[];
      pagination?: { page: number; pages: number; total: number };
    };
    moneyHistory.value = data?.history || [];
    moneyHistoryPagination.value = data?.pagination || {
      page: 1,
      pages: 0,
      total: 0,
    };
  } finally {
    moneyHistoryLoading.value = false;
  }
};
const loadPendingTopUps = async () => {
  const response = await apiClient.getMyPendingMoneyTopUps();
  if (!response.success)
    throw new Error(response.error || "Không thể tải yêu cầu nạp tiền");
  const data = response.data as {
    totalPending?: number;
    requests?: Array<{
      id: string;
      amount: number;
      requestedAt: string | Date;
    }>;
  };
  pendingTopUpTotal.value = Number(data?.totalPending || 0);
  pendingTopUps.value = data?.requests || [];
};
const fetchPlayerProfile = async () => {
  loading.value = true;
  error.value = null;
  try {
    // Refresh the user first so a newly linked player is available immediately.
    await authStore.getCurrentUser();
    if (authStore.currentUser?.player)
      playerProfile.value = authStore.currentUser.player;
    else if (authStore.currentUser?.playerId) {
      const response = await apiClient.getPlayer(authStore.currentUser.playerId);
      if (!response.success || !response.data)
        throw new Error(response.error || "Không thể tải hồ sơ cầu thủ");
      playerProfile.value = response.data as Player;
    } else playerProfile.value = null;
    if (playerProfile.value) {
      // History widgets are supplementary and must never block the profile card.
      void Promise.allSettled([
        loadTournamentHistory(playerProfile.value.id),
        loadPendingTopUps(),
        loadMoneyHistory(playerProfile.value.id),
      ]).catch((loadError) => console.error("Error loading player history:", loadError));
    }
  } catch (err) {
    console.error("Error fetching player profile:", err);
    error.value =
      err instanceof Error
        ? err.message
        : "Không thể tải hồ sơ cầu thủ. Vui lòng thử lại.";
  } finally {
    loading.value = false;
  }
};
const refreshPlayerProfile = async () => {
  await authStore.getCurrentUser();
  await fetchPlayerProfile();
};
const openAvatarModal = (): void => {
  selectedAvatar.value = playerProfile.value?.avatar || avatarOptions[0];
  showAvatarModal.value = true;
};
const openTopUpModal = (): void => {
  selectedTopUpAmount.value = debtSettlementAmount.value || 100000;
  showTopUpModal.value = true;
};
const saveAvatar = async () => {
  if (!playerProfile.value || !selectedAvatar.value) return;
  savingAvatar.value = true;
  try {
    const response = await apiClient.updateMyPlayerAvatar(playerProfile.value.id, selectedAvatar.value);
    if (!response.success) throw new Error(response.error || 'Không thể cập nhật avatar');
    playerProfile.value = { ...playerProfile.value, avatar: selectedAvatar.value };
    if (authStore.currentUser?.player) authStore.currentUser.player.avatar = selectedAvatar.value;
    showAvatarModal.value = false;
    toast.success('Đã cập nhật avatar');
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Không thể cập nhật avatar');
  } finally {
    savingAvatar.value = false;
  }
};
const submitTopUp = async () => {
  submittingTopUp.value = true;
  try {
    const response = await apiClient.createMoneyTopUp(
      selectedTopUpAmount.value,
    );
    if (!response.success)
      throw new Error(response.error || "Không thể gửi yêu cầu nạp tiền");
    showTopUpModal.value = false;
    await loadPendingTopUps();
    toast.success("Yêu cầu nạp tiền đã được gửi và đang chờ duyệt");
  } catch (err) {
    toast.error(
      err instanceof Error ? err.message : "Không thể gửi yêu cầu nạp tiền",
    );
  } finally {
    submittingTopUp.value = false;
  }
};
onMounted(fetchPlayerProfile);
</script>
