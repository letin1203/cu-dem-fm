import { computed, ref } from 'vue';
import { useToast } from 'vue-toastification';
import { apiClient } from '../api/client';
import type { Tournament } from '../types';

export interface DeadmatchEntry {
  id: string;
  playerId: string;
  teamId: string;
  opponentTeamId: string;
  queueNumber: number;
  status: string;
  matchKey?: string | null;
  player: { id: string; name: string };
}

/**
 * Deadmatch (side-match) sign-up between two tournament teams.
 *
 * All money is settled when the tournament ends; this composable only owns the
 * queue UI state and the join/cancel calls.
 */
export function useDeadmatches(options: {
  getCurrentPlayerId: () => string | null;
  getTournamentTeams: (tournament: Tournament) => any[];
}) {
  const toast = useToast();
  const showDeadmatchModal = ref(false);
  const showDeadmatchHistoryModal = ref(false);
  const deadmatchHistoryLoading = ref(false);
  const deadmatchHistoryPairs = ref<any[]>([]);
  const deadmatchTournament = ref<Tournament | null>(null);
  const deadmatchOpponentTeam = ref<any | null>(null);
  const deadmatchEntries = ref<DeadmatchEntry[]>([]);
  const deadmatchLoading = ref(false);
  const deadmatchSaving = ref(false);

  const getCurrentPlayerTeam = (tournament: Tournament): any | null => {
    const playerId = options.getCurrentPlayerId();
    if (!playerId) return null;
    return (
      options
        .getTournamentTeams(tournament)
        .find((team) => team.players.some((player: any) => player.id === playerId)) || null
    );
  };

  const deadmatchTeams = computed(() => {
    if (!deadmatchTournament.value || !deadmatchOpponentTeam.value) return [];
    const ownTeam = getCurrentPlayerTeam(deadmatchTournament.value);
    return [ownTeam, deadmatchOpponentTeam.value].filter(Boolean);
  });

  const currentDeadmatchEntry = computed(() => {
    const playerId = options.getCurrentPlayerId();
    return deadmatchEntries.value.find(
      (entry) => entry.playerId === playerId && entry.status !== 'CANCELLED',
    );
  });

  const canManageDeadmatch = computed(() =>
    Boolean(
      deadmatchTournament.value &&
        Date.now() < new Date(deadmatchTournament.value.startDate).getTime(),
    ),
  );

  const getDeadmatchTeamEntries = (teamId: string): DeadmatchEntry[] =>
    deadmatchEntries.value
      .filter((entry) => entry.teamId === teamId)
      .sort((first, second) => {
        const firstWaiting = first.status === 'WAITING' ? 0 : 1;
        const secondWaiting = second.status === 'WAITING' ? 0 : 1;
        return firstWaiting - secondWaiting || first.queueNumber - second.queueNumber;
      });

  const getDeadmatchOpponentName = (entry: DeadmatchEntry): string | null => {
    if (!entry.matchKey) return null;
    return (
      deadmatchEntries.value.find(
        (candidate) => candidate.id !== entry.id && candidate.matchKey === entry.matchKey,
      )?.player?.name || null
    );
  };

  const loadDeadmatches = async (): Promise<void> => {
    if (!deadmatchTournament.value || !deadmatchOpponentTeam.value) return;
    deadmatchLoading.value = true;
    try {
      const response = await apiClient.getTournamentDeadmatches(
        deadmatchTournament.value.id,
        deadmatchOpponentTeam.value.id,
      );
      if (!response.success) throw new Error(response.error || 'Không thể tải Deadmatch');
      deadmatchEntries.value = (response.data as any)?.entries || [];
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Không thể tải Deadmatch');
    } finally {
      deadmatchLoading.value = false;
    }
  };

  const openDeadmatchModal = async (tournament: Tournament, opponentTeam: any): Promise<void> => {
    deadmatchTournament.value = tournament;
    deadmatchOpponentTeam.value = opponentTeam;
    deadmatchEntries.value = [];
    showDeadmatchModal.value = true;
    await loadDeadmatches();
  };

  const openDeadmatchHistoryModal = async (tournament: Tournament): Promise<void> => {
    showDeadmatchHistoryModal.value = true;
    deadmatchHistoryLoading.value = true;
    deadmatchHistoryPairs.value = [];
    try {
      const response = await apiClient.getTournamentDeadmatchHistory(tournament.id);
      if (!response.success) throw new Error(response.error || 'Không thể tải lịch sử Deadmatch');
      deadmatchHistoryPairs.value = (response.data as any)?.pairs || [];
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || error.message || 'Không thể tải lịch sử Deadmatch',
      );
    } finally {
      deadmatchHistoryLoading.value = false;
    }
  };

  const joinDeadmatch = async (): Promise<void> => {
    if (!deadmatchTournament.value || !deadmatchOpponentTeam.value || deadmatchSaving.value) return;
    deadmatchSaving.value = true;
    try {
      const response = await apiClient.joinTournamentDeadmatch(
        deadmatchTournament.value.id,
        deadmatchOpponentTeam.value.id,
      );
      if (!response.success) throw new Error(response.error || 'Không thể tham gia Deadmatch');
      await loadDeadmatches();
      toast.success(
        (response.data as any)?.matched ? 'Đã ghép cặp Deadmatch' : 'Đã vào hàng chờ Deadmatch',
      );
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Không thể tham gia Deadmatch');
    } finally {
      deadmatchSaving.value = false;
    }
  };

  const cancelDeadmatch = async (): Promise<void> => {
    if (!deadmatchTournament.value || !deadmatchOpponentTeam.value || deadmatchSaving.value) return;
    deadmatchSaving.value = true;
    try {
      const response = await apiClient.cancelTournamentDeadmatch(
        deadmatchTournament.value.id,
        deadmatchOpponentTeam.value.id,
      );
      if (!response.success) throw new Error(response.error || 'Không thể hủy Deadmatch');
      await loadDeadmatches();
      toast.success('Đã hủy tham gia Deadmatch');
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Không thể hủy Deadmatch');
    } finally {
      deadmatchSaving.value = false;
    }
  };

  return {
    showDeadmatchModal,
    showDeadmatchHistoryModal,
    deadmatchHistoryLoading,
    deadmatchHistoryPairs,
    deadmatchTournament,
    deadmatchOpponentTeam,
    deadmatchEntries,
    deadmatchLoading,
    deadmatchSaving,
    deadmatchTeams,
    currentDeadmatchEntry,
    canManageDeadmatch,
    getCurrentPlayerTeam,
    getDeadmatchTeamEntries,
    getDeadmatchOpponentName,
    loadDeadmatches,
    openDeadmatchModal,
    openDeadmatchHistoryModal,
    joinDeadmatch,
    cancelDeadmatch,
  };
}
