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
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-lg border border-yellow-300 bg-yellow-50 text-lg text-yellow-600 transition hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!selectedPlayers.length"
              title="Random Ngôi sao hy vọng"
              @click="randomizeHopeStars"
            >
              ⭐</button
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
              ><span
                v-if="hopeStarPlayerIds.has(player.id)"
                class="text-sm"
                title="Ngôi sao hy vọng"
                >⭐</span
              ><span class="text-xs text-gray-500">T{{ player.tier }}</span>
            </button></TransitionGroup
          >
        </div>
      </section>
    </div>
    <Teleport to="body">
      <div
        v-if="showTeamSplitProgressModal"
        class="fixed inset-0 z-[85] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      >
        <div
          class="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
          :style="teamSplitModalStyle"
        >
          <div class="border-b p-5">
            <h2 class="text-lg font-semibold text-primary-700">
              Đang thực hiện chia team
            </h2>
            <p class="mt-1 text-sm text-gray-500">
              {{ teamSplitSteps[teamSplitStep]?.description }}
            </p>
          </div>
          <div class="min-h-0 space-y-5 overflow-y-auto p-5">
            <div class="grid gap-3 md:grid-cols-3">
              <div
                v-for="group in splitProgressGroups"
                :key="group.label"
                :ref="(element) => setSplitTierGroupRef(group.label, element as HTMLElement | null)"
                class="rounded-lg border p-3"
                :class="
                  teamSplitStep >= group.step
                    ? 'border-primary-300 bg-primary-50'
                    : 'border-gray-200 bg-gray-50 opacity-60'
                "
              >
                <p class="mb-3 text-center text-sm font-semibold text-gray-800">
                  {{ group.label }}
                </p>
                <TransitionGroup
                  name="split-chip"
                  tag="div"
                  class="flex flex-wrap justify-center gap-2"
                  ><div
                    v-for="player in group.players"
                    :key="player.id"
                    class="w-16 text-center"
                  >
                    <img
                      v-if="player.avatar"
                      :src="player.avatar"
                      class="mx-auto h-9 w-9 rounded-full object-cover"
                    /><span
                      v-else
                      class="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-xs"
                      >{{ player.name[0] }}</span
                    ><span
                      class="mt-1 block truncate text-[10px] font-medium"
                      >{{ player.name }}</span
                    >
                  </div></TransitionGroup
                >
              </div>
            </div>
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div class="mb-3 flex items-center gap-3">
                <span
                  class="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white"
                  >{{ teamSplitStep + 1 }}</span
                ><strong class="shrink-0">{{ teamSplitSteps[teamSplitStep]?.title }}</strong><div class="ml-6 hidden h-11 min-w-0 flex-1 overflow-hidden text-left lg:block"><TransitionGroup name="ai-thought" tag="div" class="space-y-1"><p v-for="thought in aiThoughts" :key="thought.id" class="truncate text-xs text-primary-700">🤖 {{ thought.text }}</p></TransitionGroup></div>
              </div>
              <div ref="aiThoughtBlockRef" class="mb-4 h-24 overflow-hidden rounded-lg border border-primary-200 bg-primary-50 p-2 lg:hidden"><p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-primary-700">AI đang suy nghĩ</p><TransitionGroup name="ai-thought" tag="div"><p v-if="aiThoughts.length" :key="aiThoughts[aiThoughts.length - 1].id" class="max-h-16 overflow-hidden whitespace-normal break-words text-xs leading-4 text-primary-700">🤖 {{ aiThoughts[aiThoughts.length - 1].text }}</p></TransitionGroup></div>
              <div
                class="grid gap-3"
                :class="
                  teamCount === 2
                    ? 'sm:grid-cols-2'
                    : teamCount === 3
                      ? 'sm:grid-cols-3'
                      : 'sm:grid-cols-4'
                "
              >
                <div
                  v-for="(team, index) in processingTeams"
                  :key="index"
                  :ref="(element) => setSplitTeamRef(index, element as HTMLElement | null)"
                  class="flex min-h-32 flex-col rounded-lg border bg-white p-3"
                  :class="teamClass(index)"
                >
                  <div class="mb-3 flex items-center gap-2"><span class="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white" :class="teamNumberClass(index)">{{ index + 1 }}</span><div><p class="text-sm font-semibold">Team {{ index + 1 }} <span class="font-medium" :class="teamTextClass(index)">- {{ teamShirt(index) }}</span></p><p class="text-xs text-gray-500">{{ team.length }} cầu thủ</p></div></div>
                  <TransitionGroup
                    name="team-chip"
                    tag="div"
                    class="space-y-1"
                    ><div
                      v-for="player in team"
                      :key="player.id"
                      class="flex items-center justify-between rounded bg-gray-50 p-1.5 text-xs"
                    >
                      <div class="flex min-w-0 items-center"><img
                        v-if="player.avatar"
                        :src="player.avatar"
                        class="mr-1.5 h-6 w-6 rounded-full object-cover"
                      /><span
                        v-else
                        class="mr-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs"
                        >{{ player.name[0] }}</span
                      ><span class="truncate font-medium">{{ player.name }}</span></div><span :class="player.tier <= 3 ? 'font-bold' : 'text-gray-600'">{{ player.position }} · T{{ player.tier }}</span>
                    </div></TransitionGroup
                  >
                  <p
                    v-if="!team.length"
                    class="py-7 text-center text-xs text-gray-400"
                  >
                    Đang chờ
                  </p>
                  <div v-if="team.length" class="mt-auto flex justify-between border-t pt-2 text-[10px] text-gray-600"><span class="rounded border border-primary-300 bg-primary-50 px-1.5 py-0.5 font-bold text-primary-700">Tổng tier: {{ team.reduce((sum, player) => sum + player.tier, 0) }}</span><span class="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 font-bold text-red-700">TB: {{ (team.reduce((sum, player) => sum + player.tier, 0) / team.length).toFixed(2) }}</span></div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="teamSplitComplete" class="flex justify-end gap-3 border-t p-4"><button type="button" class="btn-secondary" :disabled="teamSplitRunning" @click="splitTeams">Chia team lại</button><button type="button" class="btn-primary" @click="openTeamResultFromProgress">Kết quả chia team</button></div>
        </div>
      </div>
    </Teleport>
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
                      <span
                        v-if="hopeStarPlayerIds.has(player.id)"
                        class="ml-1 shrink-0 text-sm"
                        title="Ngôi sao hy vọng"
                        >⭐</span
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
          <div class="flex justify-end gap-3 border-t p-4">
            <button class="btn-secondary" @click="openTestMoneyModal">
              Thử tính tiền
            </button>
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
                >{{
                  selected.find((player) => player.id === pair.firstId)?.name
                }}
                <span class="text-sm text-gray-500"
                  >T{{
                    selected.find((player) => player.id === pair.firstId)?.tier
                  }}</span
                ></span
              ><span class="justify-self-center px-4 text-lg">⚔️</span
              ><span class="truncate text-right font-semibold text-gray-800"
                ><span class="text-sm text-gray-500"
                  >T{{
                    selected.find((player) => player.id === pair.secondId)?.tier
                  }}</span
                >
                {{
                  selected.find((player) => player.id === pair.secondId)?.name
                }}</span
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
    <Teleport to="body">
      <div
        v-if="showTestMoneyModal"
        class="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      >
        <div
          class="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        >
          <div class="flex items-center justify-between border-b p-5">
            <div>
              <h2 class="text-lg font-semibold text-gray-900">
                Chi tiết biến động tiền
              </h2>
              <p class="mt-1 text-sm text-gray-500">
                Mô phỏng trên trình duyệt, không lưu vào hệ thống.
              </p>
            </div>
            <button
              type="button"
              class="text-2xl text-gray-400 hover:text-gray-700"
              @click="showTestMoneyModal = false"
            >
              ×
            </button>
          </div>
          <div class="min-h-0 space-y-5 overflow-y-auto p-5">
            <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <div
                v-for="(team, index) in teams"
                :key="index"
                class="rounded-lg border p-3"
                :class="
                  index === simulatedWinnerIndex
                    ? 'border-green-300 bg-green-50'
                    : index === simulatedLoserIndex
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200'
                "
              >
                <div class="flex items-center justify-between font-semibold">
                  <span>Team {{ index + 1 }}</span
                  ><span>⚽ {{ simulatedScores[index] }}</span>
                </div>
                <p
                  class="mt-1 text-xs"
                  :class="
                    index === simulatedWinnerIndex
                      ? 'text-green-700'
                      : index === simulatedLoserIndex
                        ? 'text-red-700'
                        : 'text-gray-500'
                  "
                >
                  {{
                    index === simulatedWinnerIndex
                      ? "🏆 Đội thắng"
                      : index === simulatedLoserIndex
                        ? "😔 Đội thua"
                        : "Hòa thứ hạng giữa"
                  }}
                </p>
              </div>
            </div>
            <div
              class="rounded-lg border border-primary-200 bg-primary-50 p-4 text-xs text-primary-800"
            >
              <p class="mb-1 font-semibold">💰 Cách tính tiền mô phỏng</p>
              <ul class="list-disc space-y-1 pl-4">
                <li>Chi phí giải: -50.000 ₫ mỗi cầu thủ; GK giảm 50%.</li>
                <li>
                  Đội thua: -10.000 ₫; Ngôi sao hy vọng thắng +10.000 ₫, thua
                  -10.000 ₫.
                </li>
                <li>
                  Battle: cầu thủ thuộc đội có điểm cao hơn +10.000 ₫, điểm thấp
                  hơn -10.000 ₫.
                </li>
              </ul>
            </div>
            <div v-for="(team, teamIndex) in teams" :key="`money-${teamIndex}`">
              <h3 class="mb-2 font-semibold" :class="teamTextClass(teamIndex)">
                Team {{ teamIndex + 1 }}
              </h3>
              <div
                v-for="player in team"
                :key="player.id"
                class="mb-2 rounded-lg border border-gray-100 bg-gray-50 p-3"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="flex min-w-0 items-center">
                    <img
                      v-if="player.avatar"
                      :src="player.avatar"
                      class="mr-2 h-7 w-7 rounded-full object-cover"
                    /><span
                      v-else
                      class="mr-2 flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs"
                      >{{ player.name[0] }}</span
                    ><span class="truncate font-medium">{{ player.name }}</span>
                  </div>
                  <span class="text-xs text-gray-500"
                    >{{ player.position }} · T{{ player.tier }}</span
                  >
                </div>
                <div class="mt-2 space-y-1 border-t pt-2 text-xs">
                  <div
                    v-for="change in getTestMoneyChanges(player, teamIndex)
                      .changes"
                    :key="change.description"
                    class="flex justify-between gap-3"
                  >
                    <span class="text-gray-600">{{ change.description }}</span
                    ><span
                      :class="
                        change.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      "
                      >{{ change.amount >= 0 ? "+" : ""
                      }}{{ change.amount.toLocaleString("vi-VN") }} ₫</span
                    >
                  </div>
                  <div class="flex justify-between border-t pt-1 font-semibold">
                    <span>Tổng thay đổi</span
                    ><span
                      :class="
                        getTestMoneyChanges(player, teamIndex).total >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      "
                      >{{
                        getTestMoneyChanges(player, teamIndex).total >= 0
                          ? "+"
                          : ""
                      }}{{
                        getTestMoneyChanges(
                          player,
                          teamIndex,
                        ).total.toLocaleString("vi-VN")
                      }}
                      ₫</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="flex justify-end border-t p-4">
            <button
              type="button"
              class="btn-primary"
              @click="showTestMoneyModal = false"
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
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
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
  showTeamSplitProgressModal = ref(false),
  teamSplitStep = ref(0),
  processingTeams = ref<Player[][]>([]),
  teamSplitComplete = ref(false),
  teamSplitRunning = ref(false),
  aiThoughts = ref<Array<{ id: number; text: string }>>([]),
  aiThoughtSequence = ref(0),
  viewportWidth = ref(window.innerWidth),
  viewportHeight = ref(window.innerHeight),
  splitTierGroupRefs = ref<Record<string, HTMLElement | null>>({}),
  splitTeamRefs = ref<Record<number, HTMLElement | null>>({}),
  aiThoughtBlockRef = ref<HTMLElement | null>(null),
  showTeamResultModal = ref(false),
  showBattlePairsModal = ref(false),
  showTestMoneyModal = ref(false),
  simulatedScores = ref<number[]>([]),
  battlePairs = ref<Array<{ firstId: string; secondId: string }>>([]),
  hopeStarPlayerIds = ref<Set<string>>(new Set());
const positions = ["GK", "DEF", "MID", "FWD"];
const randomOptions = [20, 24, 28, 32];
const teamSplitSteps = [
  {
    title: "Phân loại theo Tier",
    description: "Tách cầu thủ thành ba nhóm Tier để chuẩn bị chia đội.",
  },
  {
    title: "Rải đều Tier 1–2",
    description: "Ưu tiên rải đều cầu thủ mạnh và thủ môn cho các đội.",
  },
  {
    title: "Cân bằng Tier 3–4",
    description: "Bổ sung nhóm Tier trung bình để cân bằng từng đội.",
  },
  {
    title: "Cân bằng Tier 5–6",
    description: "Hoàn thiện đội hình và tối ưu Tier trung bình.",
  },
  {
    title: "Chốt kết quả",
    description:
      "Đảm bảo các cặp Battle ở hai đội khác nhau rồi hiển thị kết quả.",
  },
];
const aiHealthTimeframes = [
  'Đầu tuần',
  'Hôm qua',
  'Hôm kia',
  'Ba ngày trước',
  'Cuối tuần qua',
  'Sáng hôm qua',
  'Tối qua',
  'Trong tuần vừa rồi',
  'Mấy hôm trước',
  'Gần đây',
];

const aiHealthEvents = [
  'vừa đi massage cổ vai gáy nên cơ thể đang thư giãn',
  'đã thức tới 4 giờ sáng nên cần giữ sức',
  'ngủ đủ tám tiếng liên tiếp nên thể trạng khá ổn định',
  'hơi đau đầu do thay đổi thời tiết',
  'vừa tập gym nhẹ nên cơ bắp còn căng',
  'đã đi bộ nhiều nên đôi chân cần được cân bằng tải',
  'ăn uống thất thường nên năng lượng có thể dao động',
  'vừa cảm lạnh nhẹ và đang trong giai đoạn hồi phục',
  'đã uống đủ nước đều đặn nên cơ thể có tín hiệu tốt',
  'phải làm việc khuya liên tục nên nhịp sinh hoạt chưa ổn định',
];

const aiHealthReasons = aiHealthTimeframes.flatMap((timeframe) =>
  aiHealthEvents.map((event) => `${timeframe} ${event}`),
);
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
const teamSplitModalStyle = computed(() => {
  if (viewportWidth.value < 1024) return {};
  const maxPlayersPerTeam = Math.ceil(selectedPlayers.value.length / teamCount.value);
  const groupCounts = [
    selectedPlayers.value.filter((player) => player.tier <= 2).length,
    selectedPlayers.value.filter((player) => player.tier >= 3 && player.tier <= 4).length,
    selectedPlayers.value.filter((player) => player.tier >= 5).length,
  ];
  const tierRows = Math.max(1, Math.ceil(Math.max(...groupCounts) / 5));
  const estimatedHeight = 230 + tierRows * 62 + maxPlayersPerTeam * 35 + 120;
  return { height: `${Math.min(Math.max(540, estimatedHeight), Math.floor(viewportHeight.value * 0.9))}px` };
});
const assignedProcessingPlayerIds = computed(
  () => new Set(processingTeams.value.flat().map((player) => player.id)),
);
const splitProgressGroups = computed(() => [
  {
    label: "Tier 1-2",
    step: 1,
    players: selectedPlayers.value.filter(
      (player) => player.tier <= 2 && !assignedProcessingPlayerIds.value.has(player.id),
    ),
  },
  {
    label: "Tier 3-4",
    step: 2,
    players: selectedPlayers.value.filter(
      (player) => player.tier >= 3 && player.tier <= 4 && !assignedProcessingPlayerIds.value.has(player.id),
    ),
  },
  {
    label: "Tier 5-6",
    step: 3,
    players: selectedPlayers.value.filter(
      (player) => player.tier >= 5 && !assignedProcessingPlayerIds.value.has(player.id),
    ),
  },
]);
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
const simulatedWinnerIndex = computed(() =>
  simulatedScores.value.length
    ? simulatedScores.value.indexOf(Math.max(...simulatedScores.value))
    : -1,
);
const simulatedLoserIndex = computed(() =>
  simulatedScores.value.length
    ? simulatedScores.value.indexOf(Math.min(...simulatedScores.value))
    : -1,
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
function randomizeHopeStars() {
  if (!selected.value.length) return;
  const maximum = Math.max(1, Math.floor(selected.value.length / 4));
  const count = 1 + Math.floor(Math.random() * maximum);
  hopeStarPlayerIds.value = new Set(
    [...selected.value]
      .sort(() => Math.random() - 0.5)
      .slice(0, count)
      .map((player) => player.id),
  );
}
function addAiThought(text: string) {
  aiThoughtSequence.value += 1;
  aiThoughts.value = [...aiThoughts.value, { id: aiThoughtSequence.value, text }].slice(-4);
}
function openTestMoneyModal() {
  const ranking = teams.value
    .map((_, index) => index)
    .sort(() => Math.random() - 0.5);
  const scores = Array.from({ length: teams.value.length }, () => 0);
  // Make every score distinct so the simulation always has exactly one winner and loser.
  ranking.forEach((teamIndex, rank) => {
    scores[teamIndex] = (teams.value.length - rank) * 2;
  });
  simulatedScores.value = scores;
  showTestMoneyModal.value = true;
}
function getTestMoneyChanges(player: Player, teamIndex: number) {
  const changes: Array<{ description: string; amount: number }> = [];
  const goalkeeper =
    player.position === "GK" || player.position === "Goalkeeper";
  changes.push({
    description: goalkeeper
      ? "Chi phí giải đấu (GK giảm 50%)"
      : "Chi phí giải đấu",
    amount: goalkeeper ? -25000 : -50000,
  });
  if (teamIndex === simulatedLoserIndex.value)
    changes.push({ description: "Đội thua", amount: -10000 });
  if (hopeStarPlayerIds.value.has(player.id))
    changes.push({
      description: "Ngôi sao hy vọng",
      amount: teamIndex === simulatedWinnerIndex.value ? 10000 : -10000,
    });
  const pair = battlePairs.value.find(
    (item) => item.firstId === player.id || item.secondId === player.id,
  );
  if (pair) {
    const opponentId =
      pair.firstId === player.id ? pair.secondId : pair.firstId;
    const opponentTeamIndex = teams.value.findIndex((team) =>
      team.some((candidate) => candidate.id === opponentId),
    );
    if (opponentTeamIndex >= 0) {
      const amount =
        simulatedScores.value[teamIndex] >
        simulatedScores.value[opponentTeamIndex]
          ? 10000
          : -10000;
      changes.push({
        description: `Battle với ${selected.value.find((candidate) => candidate.id === opponentId)?.name || "đối thủ"}`,
        amount,
      });
    }
  }
  return {
    changes,
    total: changes.reduce((sum, change) => sum + change.amount, 0),
  };
}
function setSplitTierGroupRef(label: string, element: HTMLElement | null) {
  splitTierGroupRefs.value[label] = element;
}
function setSplitTeamRef(index: number, element: HTMLElement | null) {
  splitTeamRefs.value[index] = element;
}
async function scrollMobileToSplitElement(element: HTMLElement | null, pause: (milliseconds: number) => Promise<unknown>) {
  if (viewportWidth.value >= 1024 || !element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await pause(2000);
}
function togglePlayer(player: Player) {
  const index = selected.value.findIndex((p) => p.id === player.id);
  if (index >= 0) selected.value.splice(index, 1);
  else selected.value.push(player);
  battlePairs.value = battlePairs.value.filter(
    (pair) => pair.firstId !== player.id && pair.secondId !== player.id,
  );
  hopeStarPlayerIds.value.delete(player.id);
  teams.value = [];
}
function clearAll() {
  selected.value = [];
  teams.value = [];
  battlePairs.value = [];
  hopeStarPlayerIds.value = new Set();
}
async function selectRandom() {
  if (!randomCount.value) return;
  const candidates = [...availablePlayers.value];
  showRandomModal.value = false;
  randomizing.value = true;
  teams.value = [];
  selected.value = [];
  battlePairs.value = [];
  hopeStarPlayerIds.value = new Set();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const shuffled = candidates.sort(() => Math.random() - 0.5);
  selected.value = shuffled.slice(
    0,
    Math.min(randomCount.value, shuffled.length),
  );
  randomizing.value = false;
}
async function splitTeams() {
  if (selectedPlayers.value.length < 10 || teamSplitRunning.value) return;
  showTeamSplitProgressModal.value = true;
  showTeamResultModal.value = false;
  teamSplitStep.value = 0;
  teamSplitComplete.value = false;
  teamSplitRunning.value = true;
  processingTeams.value = Array.from({ length: teamCount.value }, () => []);
  aiThoughts.value = [];
  addAiThought('AI đang rà soát thể trạng và lịch sinh hoạt của cầu thủ trong tuần qua...');
  try {
    const response = await apiClient.post("/tournaments/preview-teams", {
      playerIds: selectedPlayers.value.map((player) => player.id),
      teamCount: teamCount.value,
      battlePairs: battlePairs.value,
    });
    if (!response.success || !response.data) {
      showTeamSplitProgressModal.value = false;
      return;
    }
    const result = response.data as { teams: Array<{ players: Player[] }>; swaps?: Array<{ firstId: string; secondId: string }> };
    const finalTeams = result.teams
      .map((team) =>
      [...team.players].sort(
        (a, b) =>
          (b.position === "GK" || b.position === "Goalkeeper" ? 1 : 0) -
            (a.position === "GK" || a.position === "Goalkeeper" ? 1 : 0) ||
          a.tier - b.tier ||
          a.name.localeCompare(b.name, "vi"),
      ),
    );
    const pause = (milliseconds: number) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds));
    // Each player is shown for a full three seconds so the allocation is easy
    // to follow, regardless of the total number of selected players.
    await pause(5000);
    const swapTeamsByPlayerIds = (sourceTeams: Player[][], firstId: string, secondId: string): Player[][] => {
      const nextTeams = sourceTeams.map((team) => [...team]);
      const locations = new Map<string, { team: number; player: number }>();
      nextTeams.forEach((team, teamIndex) => team.forEach((player, playerIndex) => {
        if (player.id === firstId || player.id === secondId) locations.set(player.id, { team: teamIndex, player: playerIndex });
      }));
      const first = locations.get(firstId);
      const second = locations.get(secondId);
      if (!first || !second) return sourceTeams;
      const swap = nextTeams[first.team][first.player];
      nextTeams[first.team][first.player] = nextTeams[second.team][second.player];
      nextTeams[second.team][second.player] = swap;
      return nextTeams;
    };
    const swaps = result.swaps || [];
    const preBalanceTeams = [...swaps].reverse().reduce(
      (currentTeams, swap) => swapTeamsByPlayerIds(currentTeams, swap.firstId, swap.secondId),
      finalTeams.map((team) => [...team]),
    );
    const stages = [
      (player: Player) => player.tier <= 2,
      (player: Player) => player.tier >= 3 && player.tier <= 4,
      (player: Player) => player.tier >= 5,
    ];
    const playerDelay = 3000;
    const tierLabels = ['Tier 1-2', 'Tier 3-4', 'Tier 5-6'];
    for (let index = 0; index < stages.length; index++) {
      teamSplitStep.value = index + 1;
      const stagePlayers = preBalanceTeams.map((team) => team.filter(stages[index]));
      const rounds = Math.max(...stagePlayers.map((team) => team.length));
      for (let round = 0; round < rounds; round++) {
        for (let teamIndex = 0; teamIndex < stagePlayers.length; teamIndex++) {
          const player = stagePlayers[teamIndex][round];
          if (!player) continue;
          addAiThought(
            `${player.name}: ${aiHealthReasons[Math.floor(Math.random() * aiHealthReasons.length)]} → Chia vào Đội ${teamIndex + 1}`,
          );
          await scrollMobileToSplitElement(aiThoughtBlockRef.value, pause);
          await scrollMobileToSplitElement(splitTierGroupRefs.value[tierLabels[index]], pause);
          await scrollMobileToSplitElement(splitTeamRefs.value[teamIndex], pause);
          const nextTeams = processingTeams.value.map((team) => [...team]);
          nextTeams[teamIndex].push(player);
          processingTeams.value = nextTeams;
          // Mobile waits at each scroll destination (AI → Tier → Team), rather
          // than imposing the desktop's fixed three-second delay per player.
          await pause(viewportWidth.value < 1024 ? 0 : playerDelay);
        }
      }
    }
    teamSplitStep.value = 4;
    for (const swap of swaps) {
      processingTeams.value = swapTeamsByPlayerIds(processingTeams.value, swap.firstId, swap.secondId);
      const firstName = selected.value.find((player) => player.id === swap.firstId)?.name || 'Cầu thủ';
      const secondName = selected.value.find((player) => player.id === swap.secondId)?.name || 'cầu thủ khác';
      addAiThought(`Cân bằng Tier: hoán đổi ${firstName} ↔ ${secondName}`);
      await pause(1500);
    }
    await pause(5000);
    teams.value = finalTeams;
    teamSplitComplete.value = true;
  } finally {
    teamSplitRunning.value = false;
  }
}
function openTeamResultFromProgress() {
  showTeamSplitProgressModal.value = false;
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
const updateViewport = () => {
  viewportWidth.value = window.innerWidth;
  viewportHeight.value = window.innerHeight;
};
onMounted(async () => {
  window.addEventListener('resize', updateViewport);
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
onBeforeUnmount(() => window.removeEventListener('resize', updateViewport));
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
.split-chip-enter-active,
.split-chip-leave-active,
.team-chip-enter-active,
.team-chip-leave-active {
  transition: all 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}
.split-chip-enter-from {
  opacity: 0;
  transform: scale(0.55);
}
.team-chip-enter-from {
  opacity: 0;
  transform: translateY(-22px) scale(0.7);
}
.team-chip-leave-to {
  opacity: 0;
  transform: translateY(22px) scale(0.7);
}
.split-chip-leave-to {
  opacity: 0;
  transform: translateY(22px) scale(0.7);
}
.ai-thought-enter-active,
.ai-thought-leave-active {
  transition: all 0.65s ease;
}
.ai-thought-enter-from {
  opacity: 0;
  transform: translateY(24px);
}
.ai-thought-leave-to {
  opacity: 0;
  transform: translateY(-24px);
}
</style>
