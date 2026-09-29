<template>
  <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <h1 class="text-2xl font-bold text-gray-900">Test chia team</h1>
    <p class="mt-1 text-sm text-gray-500">
      Mọi thao tác chỉ chạy trên trình duyệt, không lưu vào hệ thống.
    </p>
    <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section class="rounded-xl border bg-white p-4 shadow-sm">
        <div class="flex flex-wrap gap-2">
          <input
            v-model="query"
            class="form-input min-w-44 flex-1"
            placeholder="Tìm tên cầu thủ"
          /><select v-model="position" class="form-input w-28">
            <option value="">Vị trí</option>
            <option v-for="item in positions" :key="item" :value="item">
              {{ item }}
            </option></select
          ><button class="btn-secondary" @click="showRandomModal = true">
            Chọn random
          </button>
        </div>
        <div v-if="loading" class="py-12 text-center text-gray-500">
          Đang tải cầu thủ...
        </div>
        <div v-else class="mt-5 space-y-5">
          <div v-for="group in groups" :key="group.label">
            <h2 class="mb-2 font-semibold text-gray-800">{{ group.label }}</h2>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="player in availablePlayers.filter(group.filter)"
                :key="player.id"
                class="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-sm transition-all duration-1000 hover:border-primary-400 hover:bg-primary-50"
                @click="togglePlayer(player)"
              >
                <img
                  v-if="player.avatar"
                  :src="player.avatar"
                  class="h-6 w-6 rounded-full object-cover"
                /><span
                  v-else
                  class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs"
                  >{{ player.name[0] }}</span
                >{{ player.name }}</button
              ><span
                v-if="!availablePlayers.filter(group.filter).length"
                class="text-sm text-gray-400"
                >Không có cầu thủ</span
              >
            </div>
          </div>
        </div>
      </section>
      <section class="rounded-xl border bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="font-semibold text-gray-900">
              Cầu thủ đã chọn ({{ selectedPlayers.length }})
            </h2>
            <p class="text-xs text-gray-500">Sắp xếp Tier thấp đến cao</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <div class="flex rounded-lg bg-gray-100 p-1">
              <button
                v-for="count in [2, 3, 4]"
                :key="count"
                class="rounded-md px-2 py-1 text-xs font-semibold"
                :class="
                  teamCount === count
                    ? 'bg-white text-primary-700 shadow'
                    : 'text-gray-600'
                "
                @click="teamCount = count"
              >
                {{ count }} Đội
              </button>
            </div>
            <button
              class="btn-primary"
              :disabled="selectedPlayers.length < 10"
              @click="splitTeams"
            >
              Chia team ngẫu nhiên</button
            ><button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-lg text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="selectedPlayers.length < 2"
              title="Random các cặp Battle"
              @click="randomizeBattles"
            >
              ⚔️</button
            ><button
              class="btn-secondary text-red-600"
              :disabled="!selectedPlayers.length"
              @click="clearAll"
            >
              Xóa hết
            </button>
          </div>
        </div>
        <div class="relative mt-5 min-h-48 rounded-lg bg-gray-50 p-3">
          <div
            v-if="randomizing"
            class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary-50/90 text-lg font-semibold text-primary-700 animate-pulse"
          >
            Đang chọn ngẫu nhiên...
          </div>
          <div
            v-if="!selectedPlayers.length"
            class="py-12 text-center text-gray-400"
          >
            Chưa chọn cầu thủ nào
          </div>
          <TransitionGroup
            v-else
            name="selected"
            tag="div"
            class="grid gap-2 sm:grid-cols-2"
            ><button
              v-for="(player, index) in selectedPlayers"
              :key="player.id"
              class="flex items-center gap-2 rounded-lg bg-white p-2 text-left shadow-sm transition-all duration-500 hover:bg-red-50"
              :style="{ transitionDelay: `${index * 500}ms` }"
              @click="togglePlayer(player)"
            >
              <img
                v-if="player.avatar"
                :src="player.avatar"
                class="h-8 w-8 rounded-full object-cover"
              /><span
                v-else
                class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200"
                >{{ player.name[0] }}</span
              ><span class="min-w-0 flex-1 truncate font-medium">{{
                player.name
              }}</span
              ><button
                v-if="battlePartnerById[player.id]"
                type="button"
                class="animate-pulse text-sm"
                :title="`Battle với ${battlePartnerById[player.id].name}`"
                @click.stop="showBattlePairsModal = true"
              >
                ⚔️</button
              ><span class="text-xs text-gray-500">T{{ player.tier }}</span>
            </button></TransitionGroup
          >
        </div>
      </section>
    </div>
    <Teleport to="body"
      ><div
        v-if="showRandomModal"
        class="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      >
        <div class="w-full max-w-md rounded-xl bg-white shadow-xl">
          <div class="border-b p-5">
            <h2 class="text-lg font-semibold">Chọn option</h2>
            <p class="mt-1 text-sm text-gray-500">Số lượng cầu thủ</p>
          </div>
          <div class="grid grid-cols-4 gap-3 p-5">
            <button
              v-for="amount in randomOptions"
              :key="amount"
              class="rounded-lg border py-3 font-semibold"
              :class="
                randomCount === amount
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : 'border-gray-200'
              "
              @click="randomCount = amount"
            >
              {{ amount }}
            </button>
          </div>
          <div class="flex justify-end gap-3 border-t p-4">
            <button class="btn-secondary" @click="showRandomModal = false">
              Hủy</button
            ><button
              class="btn-primary"
              :disabled="!randomCount"
              @click="selectRandom"
            >
              Xác nhận
            </button>
          </div>
        </div>
      </div></Teleport
    >
    <Teleport to="body"
      ><div
        v-if="showTeamResultModal"
        class="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      >
        <div
          class="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        >
          <div class="flex items-center justify-between border-b p-5">
            <div>
              <h2 class="text-lg font-semibold">Kết quả chia team</h2>
              <p class="text-sm text-gray-500">
                {{ selectedPlayers.length }} cầu thủ · {{ teamCount }} đội
              </p>
            </div>
            <button
              class="text-2xl text-gray-400"
              @click="showTeamResultModal = false"
            >
              ×
            </button>
          </div>
          <div class="min-h-0 overflow-y-auto p-5">
            <div
              class="grid gap-4"
              :class="
                teamCount === 2
                  ? 'md:grid-cols-2'
                  : teamCount === 3
                    ? 'md:grid-cols-3'
                    : 'md:grid-cols-4'
              "
            >
              <div
                v-for="(team, index) in teams"
                :key="index"
                class="flex flex-col rounded-lg border bg-white/80 p-4"
                :class="teamClass(index)"
              >
                <div class="mb-3 flex items-center gap-3">
                  <span
                    class="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white"
                    :class="teamNumberClass(index)"
                    >{{ index + 1 }}</span
                  >
                  <div>
                    <h3 class="font-semibold">
                      Team {{ index + 1 }}
                      <span
                        class="text-sm font-medium"
                        :class="teamTextClass(index)"
                        >- {{ teamShirt(index) }}</span
                      >
                    </h3>
                    <p class="text-sm text-gray-500">
                      {{ team.length }} cầu thủ
                    </p>
                  </div>
                </div>
                <div class="space-y-2">
                  <div
                    v-for="player in team"
                    :key="player.id"
                    class="flex items-center justify-between rounded p-2 text-sm"
                    :class="[
                      player.position === 'GK' ||
                      player.position === 'Goalkeeper'
                        ? 'bg-green-100 ring-1 ring-green-300'
                        : 'bg-gray-50',
                    ]"
                  >
                    <div class="flex min-w-0 items-center">
                      <img
                        v-if="player.avatar"
                        :src="player.avatar"
                        class="mr-2 h-6 w-6 rounded-full object-cover"
                      /><span
                        v-else
                        class="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs"
                        >{{ player.name[0] }}</span
                      ><span class="truncate font-medium">{{
                        player.name
                      }}</span
                      ><span
                        v-if="battlePairNumberByPlayerId[player.id]"
                        class="ml-1 shrink-0 text-xs text-red-600"
                        :title="`Cặp Battle #${battlePairNumberByPlayerId[player.id]}`"
                        >⚔️ {{ battlePairNumberByPlayerId[player.id] }}</span
                      >
                    </div>
                    <span
                      class="text-xs text-gray-600"
                      :class="player.tier <= 3 ? 'font-bold' : ''"
                      >{{ player.position }} · T{{ player.tier }}</span
                    >
                  </div>
                </div>
                <div class="mt-auto pt-3 text-xs text-gray-600">
                  <div class="flex justify-between border-t pt-3">
                    <span
                      class="rounded-md border-2 border-primary-400 bg-primary-50 px-2 py-1 font-bold text-primary-700"
                      >Tổng tier:
                      {{ team.reduce((sum, p) => sum + p.tier, 0) }}</span
                    ><span
                      class="rounded-md border-2 border-red-400 bg-red-50 px-2 py-1 font-bold text-red-700"
                      >Trung bình:
                      {{
                        (
                          team.reduce((sum, p) => sum + p.tier, 0) / team.length
                        ).toFixed(2)
                      }}</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="flex justify-end border-t p-4">
            <button class="btn-primary" @click="showTeamResultModal = false">
              Đóng
            </button>
          </div>
        </div>
      </div></Teleport
    >
    <Teleport to="body">
      <div
        v-if="showBattlePairsModal"
        class="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      >
        <div class="w-full max-w-lg rounded-xl bg-white shadow-xl">
          <div class="flex items-center justify-between border-b p-5">
            <div>
              <h2 class="text-lg font-semibold text-red-700">
                ⚔️ Các cặp Battle
              </h2>
              <p class="mt-1 text-sm text-gray-500">
                Các cầu thủ được ghép ngẫu nhiên để thách đấu.
              </p>
            </div>
            <button
              type="button"
              class="text-2xl text-gray-400 hover:text-gray-700"
              @click="showBattlePairsModal = false"
            >
              ×
            </button>
          </div>
          <div class="space-y-3 p-5">
            <div
              v-if="!battlePairs.length"
              class="rounded-lg bg-gray-50 p-5 text-center text-sm text-gray-500"
            >
              Chưa có cặp Battle nào.
            </div>
            <div
              v-for="pair in battlePairs"
              :key="`${pair.firstId}-${pair.secondId}`"
              class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center rounded-lg border border-red-100 bg-red-50/50 p-3"
            >
              <span class="truncate text-left font-semibold text-gray-800"
                >{{ selected.find((player) => player.id === pair.firstId)?.name }}
                <span class="text-sm text-gray-500">T{{ selected.find((player) => player.id === pair.firstId)?.tier }}</span></span
              ><span class="justify-self-center px-4 text-lg">⚔️</span
              ><span class="truncate text-right font-semibold text-gray-800"
                ><span class="text-sm text-gray-500">T{{ selected.find((player) => player.id === pair.secondId)?.tier }}</span>
                {{ selected.find((player) => player.id === pair.secondId)?.name }}</span
              >
            </div>
          </div>
          <div class="flex justify-end border-t p-4">
            <button
              type="button"
              class="btn-primary"
              @click="showBattlePairsModal = false"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { apiClient } from "../api/client";
type Player = {
  id: string;
  name: string;
  avatar?: string;
  position: string;
  positionSecond?: string | null;
  tier: number;
};
const players = ref<Player[]>([]),
  selected = ref<Player[]>([]),
  loading = ref(true),
  query = ref(""),
  position = ref(""),
  showRandomModal = ref(false),
  randomCount = ref<number | null>(null),
  randomizing = ref(false),
  teams = ref<Player[][]>([]),
  teamCount = ref(3),
  showTeamResultModal = ref(false),
  showBattlePairsModal = ref(false),
  battlePairs = ref<Array<{ firstId: string; secondId: string }>>([]);
const positions = ["GK", "DEF", "MID", "FWD"];
const randomOptions = [20, 24, 28, 32];
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const availablePlayers = computed(() =>
  players.value.filter(
    (p) =>
      !selected.value.some((s) => s.id === p.id) &&
      (!query.value || normalize(p.name).includes(normalize(query.value))) &&
      (!position.value || p.position === position.value),
  ),
);
const groups = [
  { label: "Tier 1-2", filter: (p: Player) => p.tier <= 2 },
  { label: "Tier 3-4", filter: (p: Player) => p.tier >= 3 && p.tier <= 4 },
  { label: "Tier 5-6", filter: (p: Player) => p.tier >= 5 },
];
const selectedPlayers = computed(() =>
  [...selected.value].sort(
    (a, b) => a.tier - b.tier || a.name.localeCompare(b.name, "vi"),
  ),
);
const battlePartnerById = computed<Record<string, Player>>(() => {
  const byId = new Map(selected.value.map((player) => [player.id, player]));
  return battlePairs.value.reduce<Record<string, Player>>((result, pair) => {
    const first = byId.get(pair.firstId);
    const second = byId.get(pair.secondId);
    if (first && second) {
      result[first.id] = second;
      result[second.id] = first;
    }
    return result;
  }, {});
});
const battlePairNumberByPlayerId = computed<Record<string, number>>(() =>
  battlePairs.value.reduce<Record<string, number>>((result, pair, index) => {
    result[pair.firstId] = index + 1;
    result[pair.secondId] = index + 1;
    return result;
  }, {}),
);
const battleGroup = (player: Player) => (player.tier <= 2 ? 1 : 2);
function randomizeBattles() {
  const targetParticipants = Math.max(
    2,
    Math.floor(selected.value.length / 4 / 2) * 2,
  );
  const candidates = [...selected.value].sort(() => Math.random() - 0.5);
  const pairs: Array<{ firstId: string; secondId: string }> = [];
  const used = new Set<string>();
  for (const player of candidates) {
    if (used.size >= targetParticipants || used.has(player.id)) continue;
    const opponent = candidates.find(
      (candidate) =>
        !used.has(candidate.id) &&
        candidate.id !== player.id &&
        battleGroup(candidate) === battleGroup(player),
    );
    if (!opponent) continue;
    pairs.push({ firstId: player.id, secondId: opponent.id });
    used.add(player.id);
    used.add(opponent.id);
  }
  battlePairs.value = pairs;
}
function togglePlayer(player: Player) {
  const index = selected.value.findIndex((p) => p.id === player.id);
  if (index >= 0) selected.value.splice(index, 1);
  else selected.value.push(player);
  battlePairs.value = battlePairs.value.filter(
    (pair) => pair.firstId !== player.id && pair.secondId !== player.id,
  );
  teams.value = [];
}
function clearAll() {
  selected.value = [];
  teams.value = [];
  battlePairs.value = [];
}
async function selectRandom() {
  if (!randomCount.value) return;
  const candidates = [...availablePlayers.value];
  showRandomModal.value = false;
  randomizing.value = true;
  teams.value = [];
  selected.value = [];
  battlePairs.value = [];
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const shuffled = candidates.sort(() => Math.random() - 0.5);
  selected.value = shuffled.slice(
    0,
    Math.min(randomCount.value, shuffled.length),
  );
  randomizing.value = false;
}
async function splitTeams() {
  if (selectedPlayers.value.length < 10) return;
  const response = await apiClient.post("/tournaments/preview-teams", {
    playerIds: selectedPlayers.value.map((player) => player.id),
    teamCount: teamCount.value,
    battlePairs: battlePairs.value,
  });
  if (!response.success) return;
  teams.value = (
    response.data as { teams: Array<{ players: Player[] }> }
  ).teams.map((team) =>
    [...team.players].sort(
      (a, b) =>
        (b.position === "GK" || b.position === "Goalkeeper" ? 1 : 0) -
          (a.position === "GK" || a.position === "Goalkeeper" ? 1 : 0) ||
        a.tier - b.tier ||
        a.name.localeCompare(b.name, "vi"),
    ),
  );
  showTeamResultModal.value = true;
}
const teamClass = (index: number) =>
  [
    "border-green-300",
    "border-orange-300",
    "border-blue-300",
    "border-gray-300",
  ][index] || "border-gray-300";
const teamNumberClass = (index: number) =>
  ["bg-green-600", "bg-orange-500", "bg-blue-600", "bg-gray-500"][index] ||
  "bg-gray-500";
const teamTextClass = (index: number) =>
  ["text-green-700", "text-orange-700", "text-blue-700", "text-gray-700"][
    index
  ] || "text-gray-700";
const teamShirt = (index: number) =>
  ["Áo xanh lá", "Áo cam", "Áo xanh dương", "Áo trắng"][index] || "Áo trắng";
onMounted(async () => {
  try {
    const response = await apiClient.getPlayers({ page: 1, limit: 200 });
    const data = response.data as any;
    players.value = (data?.players || []).filter(
      (p: any) => p.isActive !== false && !p.friendOwnerId,
    );
  } finally {
    loading.value = false;
  }
});
</script>
<style scoped>
.selected-enter-active,
.selected-leave-active {
  transition: all 0.5s ease;
}
.selected-enter-from {
  opacity: 0;
  transform: translateY(-18px) scale(0.9);
}
.selected-leave-to {
  opacity: 0;
  transform: translateY(18px) scale(0.9);
}
</style>
