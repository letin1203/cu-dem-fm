<template>
  <nav
    v-if="authStore.currentUser"
    class="relative z-50 bg-white/80 backdrop-blur-md shadow-lg border-b border-primary-200"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="relative flex justify-between h-16">
        <!-- Logo -->
        <div class="flex items-center">
          <router-link
            to="/weekly-tournament"
            class="flex items-center space-x-2"
          >
            <svg
              class="h-6 w-6 sm:h-8 sm:w-8 text-primary-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <span
              class="text-lg sm:text-xl font-bold text-primary-900 hidden xs:block"
              >Cú Đêm</span
            >
            <span class="text-lg font-bold text-primary-900 xs:hidden"
              >Cú Đêm</span
            >
          </router-link>
          <!-- Club Money Display (Mobile) -->
          <button
            v-if="
              systemStore.currentSettings &&
              systemStore.currentSettings.clubFund !== undefined
            "
            @click="openFundHistoryModal"
            class="absolute left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-md bg-primary-50 px-2 py-2 text-sm font-semibold text-primary-800 hover:bg-primary-100 md:hidden"
            title="Xem lịch sử quỹ"
          >
            <svg
              class="w-5 h-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 0V4m0 16v-4"
              />
            </svg>
            <span class="whitespace-nowrap">{{ formatCompactMoney(systemStore.currentSettings.clubFund) }}</span>
          </button>
        </div>

        <!-- Desktop Navigation -->
        <div
          class="hidden md:flex items-center space-x-2 lg:space-x-6 xl:space-x-8"
        >
          <!-- Club Money Display -->
          <button
            v-if="
              systemStore.currentSettings &&
              systemStore.currentSettings.clubFund !== undefined
            "
            @click="openFundHistoryModal"
            class="flex items-center space-x-2 px-2 py-2 rounded-md bg-primary-50 text-primary-800 font-semibold text-sm hover:bg-primary-100"
            title="Xem lịch sử quỹ"
          >
            <svg
              class="w-5 h-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 0V4m0 16v-4"
              />
            </svg>
            <span>Tiền Quỹ: </span>
            <span class="ml-1 whitespace-nowrap">{{ formatCompactMoney(systemStore.currentSettings.clubFund) }}</span>
          </button>

          <router-link
            v-for="item in visibleNavigationItems"
            :key="item.name"
            :to="item.path"
            class="text-primary-700 hover:text-primary-800 hover:bg-primary-100/50 px-2 lg:px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-1 whitespace-nowrap"
            :class="{
              'text-primary-800 bg-primary-200/50': $route.path === item.path,
            }"
          >
            <component
              :is="item.icon"
              class="w-4 h-4 lg:w-5 lg:h-5 flex-shrink-0"
            />
            <span class="hidden lg:block">{{ item.name }}</span>
            <span v-if="item.name === 'Duyệt' && pendingTopUpCount > 0" class="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">{{ pendingTopUpCount }}</span>
          </router-link>

          <!-- User Menu -->
          <div class="relative ml-3">
            <button
              @click="userMenuOpen = !userMenuOpen"
              class="flex items-center space-x-2 text-primary-700 hover:text-primary-800 hover:bg-primary-100/50 px-3 py-2 rounded-md text-sm font-medium"
            >
              <div
                class="h-6 w-6 rounded-full bg-primary-200 flex items-center justify-center"
              >
                <span class="text-primary-800 font-medium text-xs">
                  {{ authStore.currentUser?.username.charAt(0).toUpperCase() }}
                </span>
              </div>
              <span class="hidden lg:block">{{
                authStore.currentUser?.username
              }}</span>
              <span
                class="px-2 py-1 text-xs rounded-full"
                :class="getRoleClasses(authStore.currentUser?.role || 'user')"
              >
                {{ authStore.currentUser?.role.toUpperCase() }}
              </span>
            </button>

            <!-- User Dropdown -->
            <div
              v-if="userMenuOpen"
              class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-[60]"
            >
              <div class="py-1">
                <div class="px-4 py-2 text-sm text-gray-700 border-b">
                  <div class="font-medium">
                    {{ authStore.currentUser?.username }}
                  </div>
                </div>
                <router-link
                  v-if="authStore.currentUser?.role !== 'guest'"
                  to="/my-profile"
                  @click="userMenuOpen = false"
                  class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Hồ sơ cầu thủ
                </router-link>
                <button
                  @click="handleLogout"
                  :disabled="isLoggingOut"
                  class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  <span v-if="isLoggingOut">Đang đăng xuất...</span>
                  <span v-else>Đăng xuất</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Mobile menu button -->
        <div class="md:hidden flex items-center">
          <button
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="relative text-gray-600 hover:text-primary-600 p-2 rounded-md"
            :class="{ 'text-primary-600': mobileMenuOpen }"
          >
            <svg
              v-if="!mobileMenuOpen"
              class="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
            <svg
              v-else
              class="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <span v-if="pendingTopUpCount > 0" class="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold leading-none text-white">!</span>
          </button>
        </div>
      </div>
    </div>
    <!-- Mobile Navigation Menu -->
    <div
      v-if="mobileMenuOpen"
      class="md:hidden bg-white border-t border-gray-200"
    >
      <div class="px-2 pt-2 pb-3 space-y-1">
        <router-link
          v-for="item in visibleNavigationItems"
          :key="item.name"
          :to="item.path"
          @click="mobileMenuOpen = false"
          class="text-gray-600 hover:text-primary-600 hover:bg-primary-50 flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium transition-colors"
          :class="{
            'text-primary-600 bg-primary-50': $route.path === item.path,
          }"
        >
          <component :is="item.icon" class="w-5 h-5" />
          <span>{{ item.name }}</span>
          <span v-if="item.name === 'Duyệt' && pendingTopUpCount > 0" class="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">{{ pendingTopUpCount }}</span>
        </router-link>

        <!-- Mobile User Info -->
        <div class="border-t pt-3 mt-3">
          <div class="px-3 py-2 text-sm">
            <span class="font-medium text-gray-900">{{
              authStore.currentUser?.username
            }}</span>
            <span
              class="ml-2 inline-block mt-1 px-2 py-1 text-xs rounded-full"
              :class="getRoleClasses(authStore.currentUser?.role || 'user')"
            >
              {{ authStore.currentUser?.role.toUpperCase() }}
            </span>
          </div>
          <router-link
            v-if="authStore.currentUser?.role !== 'guest'"
            to="/my-profile"
            @click="mobileMenuOpen = false"
            class="text-gray-600 hover:text-primary-600 hover:bg-primary-50 block px-3 py-2 rounded-md text-base font-medium transition-colors"
          >
            Hồ sơ cầu thủ
          </router-link>
          <button
            @click="handleLogout"
            :disabled="isLoggingOut"
            class="w-full text-left text-gray-600 hover:text-primary-600 hover:bg-primary-50 block px-3 py-2 rounded-md text-base font-medium transition-colors disabled:opacity-50"
          >
            <span v-if="isLoggingOut">Đang đăng xuất...</span>
            <span v-else>Đăng xuất</span>
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
    <div
      v-if="showFundHistoryModal"
      class="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/50 p-4"
      @click.self="showFundHistoryModal = false"
    >
      <div
        class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <div class="flex items-center justify-between border-b p-5">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">
              Lịch sử Tiền Quỹ
            </h2>
            <p class="text-sm text-gray-500">
              Cập nhật sau mỗi giải đấu hoàn thành và khoản góp quỹ đã duyệt
            </p>
          </div>
          <button
            @click="showFundHistoryModal = false"
            class="text-2xl text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        </div>
        <div class="min-h-0 overflow-y-auto p-5">
          <div
            class="rounded-lg border border-primary-200 bg-primary-50 p-4 text-sm text-primary-900"
          >
            <p class="font-semibold">Công thức cập nhật quỹ</p>
            <p class="mt-1">
              Quỹ thay đổi = Thu/chi ròng của cầu thủ + Tiền tài trợ − Chi phí
              sân − Chi phí phát sinh.
            </p>
            <p class="mt-2">
              Tiền quỹ hiện tại = Tiền quỹ dự tính − Tổng số dư âm của các cầu
              thủ + Tổng số dư dương của các cầu thủ.
            </p>
            <p class="mt-2 text-xs text-primary-700">
              Khoản “Trích quỹ” giảm phần tiền thu từ cầu thủ trước khi chia
              phí, nên đã được phản ánh trong mục Thu/chi ròng của cầu thủ.
            </p>
          </div>
          <div
            class="mt-4 flex items-center justify-between rounded-lg bg-gray-50 p-4"
          >
            <span class="font-medium text-gray-700">Tiền quỹ dự tính</span
            ><strong
              class="whitespace-nowrap text-lg"
              :class="
                fundHistoryEstimatedFund >= 0 ? 'text-green-600' : 'text-red-600'
              "
              >{{ formatMoney(fundHistoryEstimatedFund) }} ₫</strong
            >
          </div>
          <div class="mt-3 flex items-center justify-between rounded-lg bg-amber-50 p-4">
            <div><span class="font-medium text-gray-700">Tiền quỹ hiện tại</span><p class="mt-1 text-xs text-amber-800">Trừ số dư âm: {{ formatMoney(fundHistoryTotalPlayerDebt) }} ₫ · Cộng số dư dương: {{ formatMoney(fundHistoryTotalPlayerCredit) }} ₫</p></div>
            <strong class="whitespace-nowrap text-lg" :class="fundHistoryActualFund >= 0 ? 'text-green-600' : 'text-red-600'">{{ formatMoney(fundHistoryActualFund) }} ₫</strong>
          </div>
          <div
            v-if="fundHistoryLoading"
            class="py-10 text-center text-gray-500"
          >
            Đang tải...
          </div>
          <div
            v-else-if="!fundHistory.length"
            class="py-10 text-center text-gray-500"
          >
            Chưa có giải đấu đã hoàn thành.
          </div>
          <div v-else class="mt-4 space-y-3">
            <div
              v-for="entry in fundHistory"
              :key="entry.id"
              class="rounded-lg border border-gray-200 p-4"
            >
              <div class="flex justify-between gap-3">
                <div class="min-w-0">
                  <p class="font-semibold text-gray-900">{{ entry.name }}</p>
                  <p class="text-xs text-gray-500">
                    {{ formatDate(entry.startDate) }}
                  </p>
                </div>
                <strong
                  class="shrink-0 whitespace-nowrap"
                  :class="
                    entry.fundChange >= 0 ? 'text-green-600' : 'text-red-600'
                  "
                  >{{ entry.fundChange >= 0 ? "+" : ""
                  }}{{ formatMoney(entry.fundChange) }} ₫</strong
                >
              </div>
              <div v-if="entry.type === 'CONTRIBUTION'" class="mt-3 space-y-1 border-t pt-3 text-sm text-gray-600">
                <p>Lý do: {{ entry.reason }}</p>
                <p v-if="entry.approvedByUsername">Duyệt bởi: <strong class="text-gray-800">{{ entry.approvedByUsername }}</strong></p>
              </div>
              <div v-else class="mt-3 space-y-1 border-t pt-3 text-xs">
                <div class="flex justify-between gap-3">
                  <span class="min-w-0 text-gray-600"
                    >Thu/chi ròng của cầu thủ</span
                  ><span
                    class="shrink-0 whitespace-nowrap"
                    :class="
                      entry.playerFundImpact >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    "
                    >{{ entry.playerFundImpact >= 0 ? "+" : ""
                    }}{{
                      formatMoney(entry.playerFundImpact)
                    }}
                    ₫</span
                  >
                </div>
                <div class="flex justify-between gap-3">
                  <span class="text-gray-600">Tiền tài trợ</span
                  ><span class="shrink-0 whitespace-nowrap text-green-600"
                    >+{{ formatMoney(entry.sponsorMoney) }} ₫</span
                  >
                </div>
                <div class="flex justify-between gap-3">
                  <span class="text-gray-600">Chi phí sân</span
                  ><span class="shrink-0 whitespace-nowrap text-red-600"
                    >-{{ formatMoney(entry.stadiumCost) }} ₫</span
                  >
                </div>
                <div
                  v-for="cost in entry.additionalCosts"
                  :key="`${cost.description}-${cost.amount}`"
                  class="flex justify-between gap-3"
                >
                  <span class="min-w-0 text-gray-600">{{
                    cost.description
                  }}</span
                  ><span class="shrink-0 whitespace-nowrap text-red-600"
                    >-{{ formatMoney(cost.amount) }} ₫</span
                  >
                </div>
                <div
                  v-if="entry.fundContribution > 0"
                  class="flex justify-between gap-3 text-indigo-700"
                >
                  <span>Trích quỹ hỗ trợ chi phí</span
                  ><span class="shrink-0 whitespace-nowrap"
                    >{{
                      formatMoney(entry.fundContribution)
                    }}
                    ₫</span
                  >
                </div>
              </div>
              <div class="mt-3 flex justify-between border-t pt-3 text-sm">
                <span class="text-gray-600">Số dư sau giải</span
                ><strong
                  class="whitespace-nowrap"
                  :class="
                    entry.balanceAfter >= 0 ? 'text-green-600' : 'text-red-600'
                  "
                  >{{ formatMoney(entry.balanceAfter) }} ₫</strong
                >
              </div>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-3 border-t p-4">
          <button @click="openFundContributionModal" class="btn-secondary">Góp quỹ</button>
          <button
            v-if="isStaff"
            type="button"
            class="btn-secondary"
            :disabled="exportingFundHistory"
            @click="exportFundHistory"
          >
            {{ exportingFundHistory ? "Đang xuất..." : "Export lịch sử" }}
          </button>
          <button @click="showFundHistoryModal = false" class="btn-primary">
            Đóng
          </button>
        </div>
      </div>
    </div>
    <div v-if="showFundContributionModal" class="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/50 p-4" @click.self="showFundContributionModal = false">
      <div class="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div class="flex items-center justify-between border-b p-5"><div><h2 class="text-lg font-semibold text-gray-900">Góp quỹ</h2><p class="mt-1 text-sm text-gray-500">{{ isStaff ? 'Khoản góp sẽ được cộng ngay vào quỹ.' : 'Yêu cầu góp quỹ sẽ chờ admin/mod duyệt.' }}</p></div><button type="button" class="text-2xl text-gray-400 hover:text-gray-700" @click="showFundContributionModal = false">×</button></div>
        <div class="min-h-0 overflow-y-auto p-5">
          <img src="/quy-momo.jpg" alt="Mã QR MoMo góp quỹ" class="mx-auto mb-5 w-full max-w-xs rounded-lg border border-gray-200">
          <div class="grid grid-cols-2 gap-3"><button v-for="amount in fundContributionAmounts" :key="amount" type="button" class="rounded-lg border px-4 py-3 font-medium transition-colors" :class="selectedFundContributionAmount === amount ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'" @click="selectedFundContributionAmount = amount">{{ formatMoney(amount) }} ₫</button></div>
          <label class="form-label mt-5 block">Hoặc nhập số tiền khác</label>
          <div class="mt-1 flex items-center gap-2"><button type="button" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xl font-semibold text-gray-700 hover:bg-gray-200" :disabled="submittingFundContribution" @click="selectedFundContributionAmount = Math.max(1, selectedFundContributionAmount - 100000)">−</button><input v-model.number="selectedFundContributionAmount" type="number" min="1" class="form-input text-center" placeholder="Nhập số tiền" :disabled="submittingFundContribution"><button type="button" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-xl font-semibold text-primary-700 hover:bg-primary-200" :disabled="submittingFundContribution" @click="selectedFundContributionAmount += 100000">+</button></div><p class="mt-1 text-center text-xs text-gray-500">Đang nhập: {{ formatMoney(selectedFundContributionAmount) }} ₫</p>
          <label class="form-label mt-5 block">Lý do</label><textarea v-model="fundContributionReason" rows="3" class="form-input" :disabled="submittingFundContribution"></textarea>
        </div>
        <div class="flex justify-end gap-3 border-t p-4"><button type="button" class="btn-secondary" :disabled="submittingFundContribution" @click="showFundContributionModal = false">Hủy</button><button type="button" class="btn-primary" :disabled="submittingFundContribution || selectedFundContributionAmount < 1 || !fundContributionReason.trim()" @click="submitFundContribution">{{ submittingFundContribution ? 'Đang gửi...' : 'Xác nhận' }}</button></div>
      </div>
    </div>
    </Teleport>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { usePlayersStore } from "../stores/players";
import { useSystemStore } from "../stores/system";
import { apiClient } from "../api/client";
import { useToast } from "vue-toastification";
import * as XLSX from "xlsx";
import {
  TrophyIcon,
  CalendarIcon,
  UserGroupIcon,
  UsersIcon,
  CogIcon,
  CircleStackIcon,
} from "@heroicons/vue/24/outline";
import type { UserRole } from "../types";

const router = useRouter();
const authStore = useAuthStore();
const playersStore = usePlayersStore();
const systemStore = useSystemStore();
const toast = useToast();

const mobileMenuOpen = ref(false);
const userMenuOpen = ref(false);
const showFundHistoryModal = ref(false);
const showFundContributionModal = ref(false);
const submittingFundContribution = ref(false);
const selectedFundContributionAmount = ref(100000);
const fundContributionReason = ref("");
const fundContributionAmounts = [50000, 100000, 200000, 500000];
const isStaff = computed(() => authStore.hasAnyRole(["admin", "mod"]));
const fundHistoryLoading = ref(false);
const exportingFundHistory = ref(false);
const fundHistoryEstimatedFund = ref(0);
const fundHistoryTotalPlayerDebt = ref(0);
const fundHistoryTotalPlayerCredit = ref(0);
const fundHistoryActualFund = computed(() => fundHistoryEstimatedFund.value - fundHistoryTotalPlayerDebt.value + fundHistoryTotalPlayerCredit.value);
const fundHistory = ref<
  Array<{
    id: string;
    name: string;
    startDate: string | Date;
    playerFundImpact: number;
    stadiumCost: number;
    sponsorMoney: number;
    additionalCosts: Array<{ description: string; amount: number }>;
    fundContribution: number;
    fundChange: number;
    balanceAfter: number;
    type?: "TOURNAMENT" | "CONTRIBUTION";
    reason?: string;
    approvedByUsername?: string | null;
  }>
>([]);

const navigationItems = [
  {
    name: "Đá hằng tuần",
    path: "/weekly-tournament",
    icon: TrophyIcon,
    permission: "canViewTournaments",
  },
  // { name: 'Tournaments', path: '/tournaments', icon: TrophyIcon, permission: 'canViewTournaments' },
  // { name: 'Matches', path: '/matches', icon: CalendarIcon, permission: 'canViewMatches' },
  //{ name: 'Teams', path: '/teams', icon: UserGroupIcon, permission: 'canViewTeams' },
  {
    name: "Cầu thủ",
    path: "/players",
    icon: UsersIcon,
    permission: "canViewPlayers",
  },
  {
    name: "Người dùng",
    path: "/users",
    icon: CogIcon,
    permission: "canManageUsers",
  },
  {
    name: "Duyệt",
    path: "/duyet-nap-tien",
    icon: CircleStackIcon,
    roles: ["admin", "mod"],
  },
  { name: "Cài đặt", path: "/system-settings", icon: CogIcon, role: "admin" },
];

const visibleNavigationItems = computed(() => {
  return navigationItems.filter((item) => {
    // Check for permission-based access
    if (item.permission) {
      return authStore.hasPermission(item.permission as any);
    }
    // Check for role-based access
    if (item.role) {
      return authStore.hasRole(item.role as any);
    }
    if (item.roles) {
      return item.roles.includes(authStore.currentUser?.role || "");
    }
    return true;
  });
});

const linkedPlayer = computed(() => {
  if (!authStore.currentUser?.playerId) return null;
  return playersStore.players.find(
    (p) => p.id === authStore.currentUser?.playerId,
  );
});

const formatDate = (date: string | Date) =>
  new Date(date).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const formatMoney = (amount: number | null | undefined) => formatCompactMoney(amount);

const formatCompactMoney = (amount: number | null | undefined) => {
  const value = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  return Math.abs(value) >= 1000
    ? `${(value / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}K`
    : value.toLocaleString("vi-VN");
};

const toMoneyNumber = (amount: unknown) =>
  typeof amount === "number" && Number.isFinite(amount) ? amount : 0;

function formatDateTimeForExport(date: string | Date) {
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime())
    ? ""
    : parsedDate.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function formatPlayerMoneyDetails(details: unknown) {
  if (!Array.isArray(details)) return "";
  return details
    .map((detail: any) => {
      const description = String(detail?.description || "Chi tiết");
      const amount = toMoneyNumber(detail?.amount);
      return `${description}: ${amount >= 0 ? "+" : ""}${amount.toLocaleString("vi-VN")} đ`;
    })
    .join("\n");
}

async function exportFundHistory() {
  exportingFundHistory.value = true;
  try {
    const [fundHistoryResponse, playerMoneyHistoryResponse] = await Promise.all([
      apiClient.getFundHistory(),
      apiClient.getAllPlayerMoneyHistory(),
    ]);
    if (!fundHistoryResponse.success || !fundHistoryResponse.data) {
      throw new Error(fundHistoryResponse.error || "Không thể tải lịch sử quỹ");
    }
    if (!playerMoneyHistoryResponse.success || !playerMoneyHistoryResponse.data) {
      throw new Error(playerMoneyHistoryResponse.error || "Không thể tải lịch sử biến động tiền của cầu thủ");
    }

    const data = fundHistoryResponse.data as any;
    const entries = Array.isArray(data.history) ? data.history : [];
    const detailRows = entries.map((entry: any) => {
      const additionalCosts = Array.isArray(entry.additionalCosts)
        ? entry.additionalCosts.filter((cost: any) => toMoneyNumber(cost?.amount) > 0)
        : [];
      const totalAdditionalCosts = additionalCosts.reduce(
        (total: number, cost: any) => total + toMoneyNumber(cost.amount),
        0,
      );
      const isContribution = entry.type === "CONTRIBUTION";

      return {
        "Thời gian": formatDateTimeForExport(entry.startDate),
        "Loại": isContribution ? "Góp quỹ" : "Giải đấu",
        "Tên / giải đấu": entry.name || "",
        "Lý do": entry.reason || "",
        "Duyệt bởi": entry.approvedByUsername || "",
        "Thu/chi ròng cầu thủ (đ)": isContribution ? "" : toMoneyNumber(entry.playerFundImpact),
        "Tiền tài trợ (đ)": isContribution ? "" : toMoneyNumber(entry.sponsorMoney),
        "Chi phí sân (đ)": isContribution ? "" : toMoneyNumber(entry.stadiumCost),
        "Tổng chi phí phát sinh (đ)": isContribution ? "" : totalAdditionalCosts,
        "Chi tiết chi phí phát sinh": additionalCosts
          .map((cost: any) => `${cost.description || "Chi phí phát sinh"}: ${toMoneyNumber(cost.amount).toLocaleString("vi-VN")} đ`)
          .join("\n"),
        "Trích quỹ hỗ trợ chi phí (đ)": isContribution ? "" : toMoneyNumber(entry.fundContribution),
        "Góp quỹ (đ)": isContribution ? toMoneyNumber(entry.amount ?? entry.fundChange) : "",
        "Thay đổi quỹ (đ)": toMoneyNumber(entry.fundChange),
        "Số dư quỹ sau mốc (đ)": toMoneyNumber(entry.balanceAfter),
      };
    });

    const estimatedFund = toMoneyNumber(data.estimatedFund ?? data.currentFund);
    const totalPlayerDebt = toMoneyNumber(data.totalPlayerDebt);
    const totalPlayerCredit = toMoneyNumber(data.totalPlayerCredit);
    const overviewRows = [
      { "Chỉ số": "Tiền quỹ dự tính (đ)", "Số tiền": estimatedFund },
      { "Chỉ số": "Tổng số dư âm của cầu thủ (đ)", "Số tiền": totalPlayerDebt },
      { "Chỉ số": "Tổng số dư dương của cầu thủ (đ)", "Số tiền": totalPlayerCredit },
      { "Chỉ số": "Tiền quỹ hiện tại (đ)", "Số tiền": estimatedFund - totalPlayerDebt + totalPlayerCredit },
      { "Chỉ số": "Tổng số mốc lịch sử", "Số tiền": entries.length },
    ];

    const workbook = XLSX.utils.book_new();
    const overviewSheet = XLSX.utils.json_to_sheet(overviewRows);
    overviewSheet["!cols"] = [{ wch: 38 }, { wch: 22 }];
    const detailSheet = XLSX.utils.json_to_sheet(detailRows);
    detailSheet["!cols"] = [
      { wch: 20 }, { wch: 14 }, { wch: 38 }, { wch: 42 }, { wch: 20 },
      { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 25 }, { wch: 45 },
      { wch: 27 }, { wch: 16 }, { wch: 18 },
    ];
    const playerMoneyHistory = Array.isArray(playerMoneyHistoryResponse.data)
      ? playerMoneyHistoryResponse.data
      : [];
    const playerMoneyHistoryRows = playerMoneyHistory.map((entry: any) => ({
      "Thời gian": formatDateTimeForExport(entry.createdAt),
      "Cầu thủ": entry.player?.name || "",
      "Vị trí": entry.player?.position || "",
      "Tier": toMoneyNumber(entry.player?.tier),
      "Giải đấu": entry.tournament?.name || "",
      "Mô tả": entry.description || "",
      "Chi tiết": formatPlayerMoneyDetails(entry.details),
      "Số dư trước (đ)": toMoneyNumber(entry.balanceBefore),
      "Biến động (đ)": toMoneyNumber(entry.amount),
      "Số dư sau (đ)": toMoneyNumber(entry.balanceAfter),
    }));
    const playerMoneyHistorySheet = XLSX.utils.json_to_sheet(playerMoneyHistoryRows);
    playerMoneyHistorySheet["!cols"] = [
      { wch: 20 }, { wch: 28 }, { wch: 12 }, { wch: 8 }, { wch: 38 },
      { wch: 42 }, { wch: 52 }, { wch: 20 }, { wch: 18 }, { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(workbook, overviewSheet, "Tổng quan");
    XLSX.utils.book_append_sheet(workbook, detailSheet, "Lịch sử chi tiết");
    XLSX.utils.book_append_sheet(workbook, playerMoneyHistorySheet, "Biến động cầu thủ");
    XLSX.writeFile(workbook, `lich-su-tien-quy-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Đã tải file lịch sử tiền quỹ");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Không thể xuất lịch sử tiền quỹ");
  } finally {
    exportingFundHistory.value = false;
  }
}

async function openFundHistoryModal() {
  showFundHistoryModal.value = true;
  fundHistoryLoading.value = true;
  try {
    const response = await apiClient.getFundHistory();
    if (!response.success || !response.data)
      throw new Error(response.error || "Không thể tải lịch sử quỹ");
    const data = response.data as any;
    fundHistoryEstimatedFund.value = toMoneyNumber(data.estimatedFund ?? data.currentFund);
    fundHistoryTotalPlayerDebt.value = toMoneyNumber(data.totalPlayerDebt);
    fundHistoryTotalPlayerCredit.value = toMoneyNumber(data.totalPlayerCredit);
    fundHistory.value = Array.isArray(data.history)
      ? data.history.map((entry: any) => ({
          ...entry,
          type: entry.type || "TOURNAMENT",
          playerFundImpact: toMoneyNumber(entry.playerFundImpact),
          stadiumCost: toMoneyNumber(entry.stadiumCost),
          sponsorMoney: toMoneyNumber(entry.sponsorMoney),
          fundContribution: toMoneyNumber(entry.fundContribution),
          fundChange: toMoneyNumber(entry.fundChange),
          balanceAfter: toMoneyNumber(entry.balanceAfter),
          additionalCosts: Array.isArray(entry.additionalCosts)
            ? entry.additionalCosts
                .filter((cost: any) => toMoneyNumber(cost?.amount) > 0)
                .map((cost: any) => ({ description: cost.description || "Chi phí phát sinh", amount: toMoneyNumber(cost.amount) }))
            : [],
        }))
      : [];
  } catch (error) {
    fundHistory.value = [];
  } finally {
    fundHistoryLoading.value = false;
  }
}

function openFundContributionModal() {
  selectedFundContributionAmount.value = 100000;
  const contributorName = linkedPlayer.value?.name || authStore.currentUser?.username || "Người dùng";
  fundContributionReason.value = `${contributorName} góp chút tiền cho quỹ`;
  showFundContributionModal.value = true;
}

async function submitFundContribution() {
  if (selectedFundContributionAmount.value < 1 || !fundContributionReason.value.trim()) return;
  submittingFundContribution.value = true;
  try {
    const response = await apiClient.createFundContribution(selectedFundContributionAmount.value, fundContributionReason.value.trim());
    if (!response.success) throw new Error(response.error || "Không thể góp quỹ");
    showFundContributionModal.value = false;
    toast.success(response.message || (isStaff.value ? "Đã cộng tiền vào quỹ" : "Yêu cầu góp quỹ đang chờ duyệt"));
    if (isStaff.value) {
      await Promise.all([openFundHistoryModal(), systemStore.fetchSystemSettings()]);
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Không thể góp quỹ");
  } finally {
    submittingFundContribution.value = false;
  }
}

function getRoleClasses(role: UserRole) {
  const classes = {
    admin: "bg-red-100 text-red-800",
    mod: "bg-yellow-100 text-yellow-800",
    user: "bg-blue-100 text-blue-800",
    guest: "bg-gray-100 text-gray-700",
  };
  return classes[role] || classes.user;
}

const isLoggingOut = ref(false);
const pendingTopUpCount = ref(0);
let pendingTopUpRefreshTimer: ReturnType<typeof setInterval> | null = null;

async function loadPendingTopUpCount() {
  if (!authStore.hasAnyRole(["admin", "mod"])) {
    pendingTopUpCount.value = 0;
    return;
  }
  try {
    const response = await apiClient.getPendingMoneyTopUps();
    if (response.success) pendingTopUpCount.value = Array.isArray(response.data) ? response.data.length : 0;
  } catch {
    // The navigation remains usable if the optional badge cannot be refreshed.
  }
}

onMounted(() => {
  void loadPendingTopUpCount();
  pendingTopUpRefreshTimer = setInterval(() => void loadPendingTopUpCount(), 60000);
});

onBeforeUnmount(() => {
  if (pendingTopUpRefreshTimer) clearInterval(pendingTopUpRefreshTimer);
});

async function handleLogout() {
  if (isLoggingOut.value) return; // Prevent multiple logout attempts

  try {
    isLoggingOut.value = true;
    userMenuOpen.value = false;
    mobileMenuOpen.value = false;

    // Perform logout
    await authStore.logout();

    // Redirect to login page
    await router.push("/login");
  } catch (error) {
    console.error("Logout error:", error);
    // Ensure redirect happens even if logout fails
    await router.push("/login");
  } finally {
    isLoggingOut.value = false;
  }
}
</script>
