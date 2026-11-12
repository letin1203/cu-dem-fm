<template>
  <div class="admin-shell">
    <div class="admin-layout">
      <!-- ============ LEFT: admin/mod features ============ -->
      <aside class="admin-sidebar">
        <header class="admin-brand">
          <span class="admin-brand__logo">🕷</span>
          <div>
            <h1 class="admin-brand__title">Bảng điều khiển</h1>
            <p class="admin-brand__sub">
              {{ authStore.currentUser?.username }} ·
              {{ (authStore.currentUser?.role || '').toUpperCase() }}
            </p>
          </div>
        </header>

        <nav class="admin-nav">
          <button
            v-for="item in sections"
            :key="item.id"
            type="button"
            class="admin-nav__item"
            :class="{ 'is-active': activeSection === item.id }"
            @click="activeSection = item.id"
          >
            <span class="admin-nav__glyph">{{ item.glyph }}</span>
            <span class="admin-nav__label">{{ item.label }}</span>
            <span
              v-if="item.badge && item.badge() > 0"
              class="admin-nav__badge"
            >
              {{ item.badge() }}
            </span>
          </button>
        </nav>

        <div class="admin-sidebar__foot">
          <router-link to="/weekly-tournament" class="admin-link">
            ← Về Đá hằng tuần
          </router-link>
        </div>
      </aside>

      <!-- ============ RIGHT: the selected section ============ -->
      <main class="admin-main">
        <header class="admin-main__head">
          <div>
            <h2 class="admin-main__title">{{ currentSection.label }}</h2>
            <p class="admin-main__desc">{{ currentSection.description }}</p>
          </div>
          <button
            type="button"
            class="admin-btn admin-btn--ghost"
            :disabled="loadingSummary"
            @click="loadSummary"
          >
            {{ loadingSummary ? 'Đang tải…' : '↻ Tải lại' }}
          </button>
        </header>

        <!-- Overview -->
        <section v-if="activeSection === 'overview'" class="admin-grid">
          <article
            v-for="card in summaryCards"
            :key="card.label"
            class="admin-card admin-card--stat"
            :style="{ '--card-accent': card.color }"
          >
            <p class="admin-card__label">{{ card.label }}</p>
            <p class="admin-card__value">{{ card.value }}</p>
            <p class="admin-card__hint">{{ card.hint }}</p>
          </article>
        </section>

        <!-- Pending approvals -->
        <section v-else-if="activeSection === 'approvals'" class="admin-stack">
          <div class="admin-card__head">
            <p class="admin-main__desc">
              {{ pendingApprovalTotal }} yêu cầu đang chờ duyệt
            </p>
            <button
              type="button"
              class="admin-btn"
              :disabled="!pendingApprovalTotal || approvingAll"
              @click="approveAll"
            >
              {{ approvingAll ? 'Đang duyệt…' : 'Duyệt tất cả' }}
            </button>
          </div>

          <article class="admin-card">
            <h3 class="admin-card__title">Yêu cầu nạp tiền</h3>
            <p v-if="!pendingTopUps.length" class="admin-empty">
              Không có yêu cầu nạp tiền nào đang chờ.
            </p>
            <ul v-else class="admin-list">
              <li v-for="request in pendingTopUps" :key="request.id" class="admin-row">
                <span class="admin-row__main">
                  <strong>{{ request.player?.name || request.playerId }}</strong>
                  <em>{{ formatDate(request.requestedAt) }}</em>
                </span>
                <span class="admin-row__amount">+{{ formatMoney(request.amount) }}</span>
                <button
                  type="button"
                  class="admin-btn"
                  :disabled="approvingId === request.id"
                  @click="approveTopUp(request.id)"
                >
                  {{ approvingId === request.id ? 'Đang duyệt…' : 'Duyệt' }}
                </button>
              </li>
            </ul>
          </article>

          <article class="admin-card">
            <h3 class="admin-card__title">Góp quỹ</h3>
            <p v-if="!pendingFunds.length" class="admin-empty">
              Không có khoản góp quỹ nào đang chờ.
            </p>
            <ul v-else class="admin-list">
              <li v-for="request in pendingFunds" :key="request.id" class="admin-row">
                <span class="admin-row__main">
                  <strong>{{ request.user?.player?.name || request.user?.username }}</strong>
                  <em>{{ request.reason || formatDate(request.requestedAt) }}</em>
                </span>
                <span class="admin-row__amount">+{{ formatMoney(request.amount) }}</span>
                <button
                  type="button"
                  class="admin-btn"
                  :disabled="approvingId === request.id"
                  @click="approveFund(request.id)"
                >
                  {{ approvingId === request.id ? 'Đang duyệt…' : 'Duyệt' }}
                </button>
              </li>
            </ul>
          </article>

          <article v-if="isAdmin" class="admin-card">
            <h3 class="admin-card__title">Yêu cầu quên mật khẩu</h3>
            <!--
              The full user list is hidden by default: it is long and only
              needed when an admin actually has to hand out a reset link.
              Searching reveals matching accounts.
            -->
            <div class="admin-field">
              <input
                v-model="passwordSearch"
                type="search"
                class="form-input"
                placeholder="Tìm theo tên cầu thủ hoặc tên người dùng…"
                aria-label="Tìm người dùng để lấy link đặt lại mật khẩu"
              />
            </div>

            <p v-if="!passwordSearch.trim()" class="admin-empty">
              Nhập tên cầu thủ hoặc người dùng để tìm.
            </p>
            <p v-else-if="!filteredPasswordRequests.length" class="admin-empty">
              Không tìm thấy người dùng phù hợp.
            </p>
            <ul v-else class="admin-list">
              <li v-for="user in filteredPasswordRequests" :key="user.id" class="admin-row">
                <span class="admin-row__main">
                  <strong>{{ user.player?.name || user.username }}</strong>
                  <em>
                    {{ user.username }}
                    <template v-if="user.passwordResetLinkCreatedAt">
                      · Tạo link lần cuối {{ formatDate(user.passwordResetLinkCreatedAt) }}
                    </template>
                  </em>
                </span>
                <button
                  type="button"
                  class="admin-btn"
                  :disabled="linkLoadingId === user.id"
                  @click="copyResetLink(user.id)"
                >
                  {{ linkLoadingId === user.id ? 'Đang tạo…' : 'Lấy link' }}
                </button>
              </li>
            </ul>
          </article>
        </section>

        <!-- Inactive players -->
        <section v-else-if="activeSection === 'inactive'" class="admin-card">
          <h3 class="admin-card__title">Cầu thủ đang inactive</h3>
          <p v-if="!inactivePlayers.length" class="admin-empty">
            Không có cầu thủ inactive.
          </p>
          <ul v-else class="admin-list">
            <li v-for="player in inactivePlayers" :key="player.id" class="admin-row">
              <span class="admin-row__main">
                <strong>{{ player.name }}</strong>
                <em>{{ player.position }} · Tier {{ player.tier }}</em>
              </span>
              <button
                type="button"
                class="admin-btn"
                :disabled="activatingId === player.id"
                @click="activatePlayer(player.id)"
              >
                {{ activatingId === player.id ? 'Đang Active…' : 'Active' }}
              </button>
            </li>
          </ul>
        </section>

        <!-- Polls -->
        <section v-else-if="activeSection === 'polls'" class="admin-stack">
          <article class="admin-card">
            <div class="admin-card__head">
              <h3 class="admin-card__title">Bình chọn</h3>
              <router-link to="/duyet-nap-tien" class="admin-link">
                Quản lý đầy đủ →
              </router-link>
            </div>
            <p v-if="!polls.length" class="admin-empty">Chưa có bình chọn nào.</p>
            <ul v-else class="admin-list">
              <li v-for="poll in polls" :key="poll.id" class="admin-row">
                <span class="admin-row__main">
                  <strong>{{ poll.question }}</strong>
                  <em>
                    {{ poll.options?.length || 0 }} lựa chọn ·
                    {{ poll.allowMultiple ? 'nhiều đáp án' : 'một đáp án' }}
                  </em>
                </span>
                <span v-if="poll.isPinned" class="admin-pill is-pinned">PINNED</span>
              </li>
            </ul>
          </article>
        </section>

        <!-- Tools -->
        <section v-else-if="activeSection === 'tools'" class="admin-grid admin-grid--tools">
          <router-link
            v-for="tool in tools"
            :key="tool.path"
            :to="tool.path"
            class="admin-card admin-card--tool"
          >
            <span class="admin-card__glyph">{{ tool.glyph }}</span>
            <span class="admin-tool__body">
              <strong>{{ tool.label }}</strong>
              <span>{{ tool.description }}</span>
            </span>
            <span class="admin-tool__arrow">→</span>
          </router-link>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useToast } from 'vue-toastification';
import { apiClient } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useSystemStore } from '../stores/system';

interface NavSection {
  id: string;
  label: string;
  description: string;
  glyph: string;
  badge?: () => number;
}

const toast = useToast();
const authStore = useAuthStore();
const systemStore = useSystemStore();

const isAdmin = computed(() => authStore.currentUser?.role === 'admin');

const activeSection = ref('overview');
const loadingSummary = ref(false);
const approvingId = ref<string | null>(null);
const activatingId = ref<string | null>(null);
const linkLoadingId = ref<string | null>(null);

const pendingTopUps = ref<any[]>([]);
const pendingFunds = ref<any[]>([]);
const passwordRequests = ref<any[]>([]);
/** Search query for the password-reset section; the list stays hidden until typed. */
const passwordSearch = ref('');
const inactivePlayers = ref<any[]>([]);
const polls = ref<any[]>([]);

const sections = computed<NavSection[]>(() => {
  const list: NavSection[] = [
    {
      id: 'overview',
      label: 'Tổng quan',
      description: 'Số liệu nhanh về giải đấu, quỹ và cầu thủ.',
      glyph: '◈',
    },
    {
      id: 'approvals',
      label: 'Duyệt yêu cầu',
      description: 'Nạp tiền, góp quỹ và yêu cầu quên mật khẩu.',
      glyph: '✓',
      badge: () => pendingTopUps.value.length + pendingFunds.value.length,
    },
    {
      id: 'inactive',
      label: 'Cầu thủ inactive',
      description: 'Kích hoạt lại cầu thủ đã ngừng tham gia.',
      glyph: '☾',
      badge: () => inactivePlayers.value.length,
    },
    {
      id: 'polls',
      label: 'Bình chọn',
      description: 'Các bình chọn đang chạy và trạng thái ghim.',
      glyph: '◉',
      badge: () => polls.value.length,
    },
    {
      id: 'tools',
      label: 'Công cụ',
      description: 'Các trang quản trị chuyên sâu.',
      glyph: '✦',
    },
  ];
  return list;
});

const currentSection = computed(
  () => sections.value.find((item) => item.id === activeSection.value) ?? sections.value[0],
);

const tools = computed(() => {
  const list = [
    {
      glyph: '🕷',
      label: 'Test chia team',
      description: 'Chạy thử thuật toán chia đội và xem đồ thị AI.',
      path: '/test-chia-team',
    },
    {
      glyph: '⚖',
      label: 'Duyệt đầy đủ',
      description: 'Trang duyệt đầy đủ với bộ lọc và phân trang.',
      path: '/duyet-nap-tien',
    },
    {
      glyph: '♟',
      label: 'Cầu thủ',
      description: 'Quản lý hồ sơ và chỉ số cầu thủ.',
      path: '/players',
    },
    {
      glyph: '◫',
      label: 'Đội',
      description: 'Danh sách đội và thành viên.',
      path: '/teams',
    },
  ];

  if (isAdmin.value) {
    list.push(
      {
        glyph: '⚙',
        label: 'Cấu hình hệ thống',
        description: 'Chi phí sân, tài trợ và quỹ câu lạc bộ.',
        path: '/system-settings',
      },
      {
        glyph: '☰',
        label: 'Người dùng',
        description: 'Tài khoản, vai trò và quyền truy cập.',
        path: '/users',
      },
    );
  }

  return list;
});

const summaryCards = computed(() => [
  {
    label: 'Giải đang diễn ra',
    value: String(ongoingCount.value),
    hint: 'Tuần này',
    color: '#ff2fb3',
  },
  {
    label: 'Chờ duyệt',
    value: String(pendingTopUps.value.length + pendingFunds.value.length),
    hint: 'Nạp tiền + góp quỹ',
    color: '#ffb020',
  },
  {
    label: 'Cầu thủ inactive',
    value: String(inactivePlayers.value.length),
    hint: 'Có thể kích hoạt lại',
    color: '#b13bff',
  },
  {
    label: 'Quỹ câu lạc bộ',
    value: formatMoney(systemStore.currentSettings?.clubFund ?? 0),
    hint: 'Số dư hiện tại',
    color: '#37e0a0',
  },
]);

const ongoingCount = ref(0);

const formatMoney = (amount: number | null | undefined): string =>
  `${Number(amount || 0).toLocaleString('vi-VN')} ₫`;

const formatDate = (value: string | Date | undefined): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Load every widget this page shows.
 *
 * Each request is independent, so one failing endpoint cannot blank the whole
 * dashboard; failures are reported once and the rest still render.
 */
const loadSummary = async (): Promise<void> => {
  loadingSummary.value = true;
  const failures: string[] = [];

  const settle = async (label: string, run: () => Promise<void>): Promise<void> => {
    try {
      await run();
    } catch {
      failures.push(label);
    }
  };

  await Promise.all([
    settle('nạp tiền', async () => {
      const response = await apiClient.getPendingMoneyTopUps();
      if (response.success) pendingTopUps.value = (response.data as any[]) || [];
    }),
    settle('góp quỹ', async () => {
      const response = await apiClient.getPendingFundContributions();
      if (response.success) pendingFunds.value = (response.data as any[]) || [];
    }),
    settle('cầu thủ inactive', async () => {
      const response = await apiClient.get<{ players: any[] }>('/players/inactive', {
        params: { page: 1, limit: 10 },
      });
      if (response.success && response.data) inactivePlayers.value = response.data.players || [];
    }),
    settle('bình chọn', async () => {
      const response = await apiClient.get<any[]>('/polls');
      if (response.success) polls.value = response.data || [];
    }),
    settle('giải đấu', async () => {
      const response = await apiClient.get<any>('/tournaments', {
        params: { status: 'ONGOING', limit: 50 },
      });
      if (response.success) {
        ongoingCount.value = response.data?.tournaments?.length ?? 0;
      }
    }),
    settle('quỹ', async () => {
      await systemStore.fetchSystemSettings();
    }),
  ]);

  if (isAdmin.value) {
    await settle('quên mật khẩu', async () => {
      const response = await apiClient.getPasswordResetRequests();
      if (response.success) passwordRequests.value = response.data || [];
    });
  }

  if (failures.length) toast.error(`Không tải được: ${failures.join(', ')}`);
  loadingSummary.value = false;
};

const approveTopUp = async (id: string): Promise<void> => {
  approvingId.value = id;
  try {
    const response = await apiClient.approveMoneyTopUp(id);
    if (!response.success) throw new Error(response.error || 'Không thể duyệt');
    toast.success('Đã duyệt nạp tiền');
    pendingTopUps.value = pendingTopUps.value.filter((item) => item.id !== id);
  } catch (error: any) {
    toast.error(error.response?.data?.error || error.message || 'Không thể duyệt');
  } finally {
    approvingId.value = null;
  }
};

const approveFund = async (id: string): Promise<void> => {
  approvingId.value = id;
  try {
    const response = await apiClient.approveFundContribution(id);
    if (!response.success) throw new Error(response.error || 'Không thể duyệt');
    toast.success('Đã duyệt góp quỹ');
    pendingFunds.value = pendingFunds.value.filter((item) => item.id !== id);
  } catch (error: any) {
    toast.error(error.response?.data?.error || error.message || 'Không thể duyệt');
  } finally {
    approvingId.value = null;
  }
};

/** True while a bulk approve is running, so the button cannot double-fire. */
const approvingAll = ref(false);

/** Total pending approvals shown in the section header. */
const pendingApprovalTotal = computed(
  () => pendingTopUps.value.length + pendingFunds.value.length,
);

/**
 * Approve every pending request.
 *
 * Requests are approved one by one because the backend exposes single-item
 * endpoints; running them sequentially (rather than in parallel) keeps load
 * predictable and lets a partial failure leave the successful approvals applied
 * instead of rolling the whole batch back.
 */
const approveAll = async (): Promise<void> => {
  if (approvingAll.value || !pendingApprovalTotal.value) return;
  approvingAll.value = true;

  const topUpIds = pendingTopUps.value.map((item) => item.id);
  const fundIds = pendingFunds.value.map((item) => item.id);
  let approved = 0;
  let failed = 0;

  try {
    for (const id of topUpIds) {
      try {
        const response = await apiClient.approveMoneyTopUp(id);
        if (!response.success) throw new Error(response.error || 'failed');
        approved += 1;
        pendingTopUps.value = pendingTopUps.value.filter((item) => item.id !== id);
      } catch {
        failed += 1;
      }
    }

    for (const id of fundIds) {
      try {
        const response = await apiClient.approveFundContribution(id);
        if (!response.success) throw new Error(response.error || 'failed');
        approved += 1;
        pendingFunds.value = pendingFunds.value.filter((item) => item.id !== id);
      } catch {
        failed += 1;
      }
    }

    if (approved) toast.success(`Đã duyệt ${approved} yêu cầu`);
    if (failed) toast.error(`${failed} yêu cầu không duyệt được`);
  } finally {
    approvingAll.value = false;
  }
};

const activatePlayer = async (id: string): Promise<void> => {
  activatingId.value = id;
  try {
    const response = await apiClient.put(`/players/inactive/${id}/activate`);
    if (!response.success) throw new Error(response.error || 'Không thể Active');
    toast.success('Đã Active cầu thủ');
    inactivePlayers.value = inactivePlayers.value.filter((item) => item.id !== id);
  } catch (error: any) {
    toast.error(error.response?.data?.error || error.message || 'Không thể Active');
  } finally {
    activatingId.value = null;
  }
};

/**
 * Strip Vietnamese diacritics so "dat huynh" matches "Đạt Huỳnh".
 *
 * Same normalisation the Users page uses: lower-case, decompose to NFD, drop the
 * combining marks, then map đ -> d.
 */
const normalizeSearchText = (value: string): string =>
  value
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();

/**
 * Password-reset results.
 *
 * Empty until the admin searches, and then matched against BOTH the linked
 * player's name and the account username, so either name finds the account.
 */
const filteredPasswordRequests = computed(() => {
  const query = normalizeSearchText(passwordSearch.value);
  if (!query) return [];

  return passwordRequests.value.filter((user) => {
    const playerName = normalizeSearchText(user.player?.name || '');
    const username = normalizeSearchText(user.username || '');
    return playerName.includes(query) || username.includes(query);
  });
});

const copyResetLink = async (userId: string): Promise<void> => {
  linkLoadingId.value = userId;
  try {
    const response = await apiClient.getPasswordResetLink(userId);
    const link = (response.data as any)?.resetUrl || (response.data as any)?.link;
    if (!response.success || !link) throw new Error(response.error || 'Không thể tạo link');
    await navigator.clipboard.writeText(link);
    toast.success('Đã copy link đặt lại mật khẩu');
  } catch (error: any) {
    toast.error(error.response?.data?.error || error.message || 'Không thể tạo link');
  } finally {
    linkLoadingId.value = null;
  }
};

onMounted(loadSummary);
</script>

<style scoped>
/*
 * Visual language copied from the "AI chia team" modal: near-black canvas,
 * magenta/violet accents, soft glowing panels.
 */
.admin-shell {
  min-height: 100vh;
  background:
    radial-gradient(1100px 620px at 18% -10%, rgba(255, 47, 179, 0.16), transparent 60%),
    radial-gradient(900px 520px at 88% 108%, rgba(124, 58, 237, 0.2), transparent 62%),
    #050308;
  color: #efe7ff;
}

.admin-layout {
  display: flex;
  min-height: 100vh;
  max-width: 1500px;
  margin: 0 auto;
}

/* ---------- Sidebar ---------- */
.admin-sidebar {
  display: flex;
  width: 280px;
  flex: 0 0 280px;
  flex-direction: column;
  gap: 18px;
  border-right: 1px solid rgba(255, 255, 255, 0.09);
  padding: 20px 16px;
}

.admin-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.admin-brand__logo {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: rgba(255, 47, 179, 0.16);
  box-shadow: 0 0 18px rgba(255, 47, 179, 0.4);
  font-size: 18px;
}

.admin-brand__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
}

.admin-brand__sub {
  margin: 0;
  font-size: 11px;
  color: #ff9ee0;
}

.admin-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.admin-nav__item {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  border-radius: 12px;
  padding: 9px 11px;
  font-size: 13px;
  text-align: left;
  color: rgba(255, 255, 255, 0.66);
  transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
}

.admin-nav__item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.admin-nav__item.is-active {
  border-color: rgba(255, 110, 220, 0.55);
  background: rgba(255, 47, 179, 0.16);
  color: #fff;
}

.admin-nav__glyph {
  width: 16px;
  flex: 0 0 16px;
  text-align: center;
  color: #ff9ee0;
}

.admin-nav__label {
  flex: 1;
}

.admin-nav__badge {
  border-radius: 999px;
  background: rgba(255, 47, 179, 0.3);
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 700;
  color: #ffd0f2;
}

.admin-sidebar__foot {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.admin-link {
  font-size: 12px;
  color: #ff9ee0;
}

.admin-link:hover {
  color: #fff;
}

/* ---------- Main ---------- */
.admin-main {
  min-width: 0;
  flex: 1;
  padding: 20px 24px 40px;
  overflow-y: auto;
}

.admin-main__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.admin-main__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.admin-main__desc {
  margin: 3px 0 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.admin-btn {
  border-radius: 9px;
  border: 1px solid rgba(255, 110, 220, 0.5);
  background: linear-gradient(135deg, #ff2fb3, #b13bff);
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  transition: filter 160ms ease, opacity 160ms ease;
}

.admin-btn:hover:not(:disabled) {
  filter: brightness(1.12);
}

.admin-btn:disabled {
  opacity: 0.5;
}

.admin-btn--ghost {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.18);
}

/* ---------- Cards ---------- */
.admin-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.admin-grid--tools {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.admin-card {
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 14px;
  background: rgba(14, 9, 22, 0.85);
  padding: 14px;
}

.admin-card--stat {
  border-color: color-mix(in srgb, var(--card-accent) 40%, transparent);
  box-shadow: inset 0 0 30px color-mix(in srgb, var(--card-accent) 10%, transparent);
}

.admin-card__label {
  margin: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #ff9ee0;
}

.admin-card__value {
  margin: 6px 0 0;
  font-size: 26px;
  font-weight: 700;
  color: #fff;
  font-variant-numeric: tabular-nums;
}

.admin-card__hint {
  margin: 2px 0 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.42);
}

.admin-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.admin-card__title {
  margin: 0 0 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #ff9ee0;
}

.admin-card__head .admin-card__title {
  margin-bottom: 10px;
}

.admin-card--tool {
  display: flex;
  align-items: center;
  gap: 12px;
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
}

.admin-card--tool:hover {
  border-color: rgba(255, 110, 220, 0.6);
  background: rgba(255, 47, 179, 0.1);
  transform: translateY(-1px);
}

.admin-card__glyph {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: 10px;
  background: rgba(255, 47, 179, 0.18);
  color: #ff9ee0;
  font-size: 16px;
}

.admin-tool__body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.admin-tool__body strong {
  font-size: 13px;
  color: #fff;
}

.admin-tool__body span {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}

.admin-tool__arrow {
  color: #ff9ee0;
}

/* ---------- Lists ---------- */
.admin-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.admin-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.admin-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.035);
  padding: 8px 10px;
}

.admin-row__main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 1px;
}

.admin-row__main strong {
  font-size: 12.5px;
  color: #fff;
}

.admin-row__main em {
  font-size: 10.5px;
  font-style: normal;
  color: rgba(255, 255, 255, 0.42);
}

.admin-row__amount {
  font-size: 12px;
  font-weight: 700;
  color: #37e0a0;
  font-variant-numeric: tabular-nums;
}

.admin-field {
  margin-bottom: 10px;
}

.admin-empty {
  margin: 0;
  padding: 10px 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.admin-pill {
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.admin-pill.is-pinned {
  background: rgba(255, 176, 32, 0.22);
  color: #ffd28a;
}

@media (max-width: 900px) {
  .admin-layout {
    flex-direction: column;
  }

  .admin-sidebar {
    width: 100%;
    flex: 0 0 auto;
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  }

  .admin-nav {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .admin-sidebar__foot {
    display: none;
  }
}
</style>
