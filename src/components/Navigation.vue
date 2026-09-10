<template>
  <nav
    v-if="authStore.currentUser"
    class="relative z-50 bg-white/80 backdrop-blur-md shadow-lg border-b border-primary-200"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
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
            class="flex md:hidden items-center space-x-2 px-2 py-2 rounded-md bg-primary-50 text-primary-800 font-semibold text-sm hover:bg-primary-100"
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
            <span class="ml-1"
              >{{
                systemStore.currentSettings.clubFund.toLocaleString("vi-VN")
              }}
              ₫</span
            >
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
            <span class="ml-1"
              >{{
                systemStore.currentSettings.clubFund.toLocaleString("vi-VN")
              }}
              ₫</span
            >
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
            class="text-gray-600 hover:text-primary-600 p-2 rounded-md"
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
      class="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
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
              Cập nhật sau mỗi giải đấu đã hoàn thành
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
              thủ.
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
            <div><span class="font-medium text-gray-700">Tiền quỹ hiện tại</span><p class="mt-1 text-xs text-amber-800">Đã trừ tổng số dư âm: {{ formatMoney(fundHistoryTotalPlayerDebt) }} ₫</p></div>
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
              <div class="mt-3 space-y-1 border-t pt-3 text-xs">
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
        <div class="flex justify-end border-t p-4">
          <button @click="showFundHistoryModal = false" class="btn-primary">
            Đóng
          </button>
        </div>
      </div>
    </div>
    </Teleport>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { usePlayersStore } from "../stores/players";
import { useSystemStore } from "../stores/system";
import { apiClient } from "../api/client";
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

const mobileMenuOpen = ref(false);
const userMenuOpen = ref(false);
const showFundHistoryModal = ref(false);
const fundHistoryLoading = ref(false);
const fundHistoryEstimatedFund = ref(0);
const fundHistoryTotalPlayerDebt = ref(0);
const fundHistoryActualFund = computed(() => fundHistoryEstimatedFund.value - fundHistoryTotalPlayerDebt.value);
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

const formatMoney = (amount: number | null | undefined) =>
  (typeof amount === "number" && Number.isFinite(amount) ? amount : 0).toLocaleString("vi-VN");

const toMoneyNumber = (amount: unknown) =>
  typeof amount === "number" && Number.isFinite(amount) ? amount : 0;

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
    fundHistory.value = Array.isArray(data.history)
      ? data.history.map((entry: any) => ({
          ...entry,
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

function getRoleClasses(role: UserRole) {
  const classes = {
    admin: "bg-red-100 text-red-800",
    mod: "bg-yellow-100 text-yellow-800",
    user: "bg-blue-100 text-blue-800",
  };
  return classes[role] || classes.user;
}

const isLoggingOut = ref(false);

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
