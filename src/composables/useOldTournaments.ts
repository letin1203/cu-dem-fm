import { computed, ref } from 'vue';
import { useToast } from 'vue-toastification';
import { apiClient } from '../api/client';
import type { Tournament } from '../types';

export const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * The "Giải đấu cũ" browser: date filter, month calendar and the attendance
 * loading that follows the selected tournament.
 */
export function useOldTournaments(options: {
  weeklyTournaments: () => Tournament[];
  loadAttendanceData: (tournaments: Tournament[]) => Promise<void>;
}) {
  const toast = useToast();
  const oldTournaments = ref<Tournament[]>([]);
  const oldTournamentIndex = ref(0);
  const oldTournamentDateFilter = ref('');
  const oldTournamentDateDraft = ref('');
  const showOldTournamentDateModal = ref(false);
  const oldTournamentCalendarMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const completedTournamentDates = ref<Set<string>>(new Set());
  const oldTournamentCalendarLoading = ref(false);
  const oldTournamentWeekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  const filteredOldTournaments = computed(() => {
    const filterDate = oldTournamentDateFilter.value;
    return options
      .weeklyTournaments()
      .filter((tournament) => ['COMPLETED', 'DELETED'].includes(tournament.status))
      .filter(
        (tournament) =>
          !filterDate || toLocalDateKey(new Date(tournament.startDate)) === filterDate,
      )
      .sort(
        (first, second) =>
          new Date(second.startDate).getTime() - new Date(first.startDate).getTime(),
      );
  });

  const selectedOldTournament = computed(
    () => filteredOldTournaments.value[oldTournamentIndex.value] || null,
  );

  const oldTournamentCalendarLabel = computed(() =>
    oldTournamentCalendarMonth.value.toLocaleDateString('vi-VN', {
      month: 'long',
      year: 'numeric',
    }),
  );

  const oldTournamentCalendarDays = computed(() => {
    const month = oldTournamentCalendarMonth.value;
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const days: Array<Date | null> = Array.from({ length: firstDay.getDay() }, () => null);
    for (let day = 1; day <= dayCount; day += 1) {
      days.push(new Date(month.getFullYear(), month.getMonth(), day));
    }
    while (days.length % 7 !== 0) days.push(null);
    return days;
  });

  const fetchCompletedTournamentDates = async (): Promise<void> => {
    try {
      oldTournamentCalendarLoading.value = true;
      const month = oldTournamentCalendarMonth.value;
      const response = await apiClient.get<string[]>(
        `/tournaments/completed-dates?year=${month.getFullYear()}&month=${month.getMonth() + 1}`,
      );
      if (!response.success) throw new Error(response.error || 'Không thể tải lịch giải đấu');
      completedTournamentDates.value = new Set(response.data || []);
    } catch (error) {
      completedTournamentDates.value = new Set();
      toast.error(error instanceof Error ? error.message : 'Không thể tải lịch giải đấu');
    } finally {
      oldTournamentCalendarLoading.value = false;
    }
  };

  const openOldTournamentDateModal = async (): Promise<void> => {
    oldTournamentDateDraft.value = oldTournamentDateFilter.value;
    const sourceDate = oldTournamentDateDraft.value
      ? new Date(`${oldTournamentDateDraft.value}T00:00:00`)
      : new Date();
    oldTournamentCalendarMonth.value = new Date(sourceDate.getFullYear(), sourceDate.getMonth(), 1);
    showOldTournamentDateModal.value = true;
    await fetchCompletedTournamentDates();
  };

  const changeOldTournamentCalendarMonth = async (offset: number): Promise<void> => {
    const current = oldTournamentCalendarMonth.value;
    oldTournamentCalendarMonth.value = new Date(current.getFullYear(), current.getMonth() + offset, 1);
    await fetchCompletedTournamentDates();
  };

  const loadOldTournaments = async (): Promise<void> => {
    try {
      oldTournaments.value = options
        .weeklyTournaments()
        .filter((tournament) => ['COMPLETED', 'DELETED'].includes(tournament.status))
        .sort(
          (first, second) =>
            new Date(second.startDate).getTime() - new Date(first.startDate).getTime(),
        );
      oldTournamentIndex.value = 0;
    } catch (error) {
      console.error('Load old tournaments error:', error);
      toast.error('Không thể tải giải đấu cũ');
    }
  };

  const navigateOldTournament = async (direction: -1 | 1): Promise<void> => {
    const nextIndex = oldTournamentIndex.value + direction;
    if (nextIndex < 0 || nextIndex >= filteredOldTournaments.value.length) return;
    oldTournamentIndex.value = nextIndex;
    if (selectedOldTournament.value) await options.loadAttendanceData([selectedOldTournament.value]);
  };

  const applyOldTournamentDateFilter = async (): Promise<void> => {
    oldTournamentDateFilter.value = oldTournamentDateDraft.value;
    oldTournamentIndex.value = 0;
    showOldTournamentDateModal.value = false;
    if (selectedOldTournament.value) await options.loadAttendanceData([selectedOldTournament.value]);
  };

  const clearOldTournamentDateFilter = async (): Promise<void> => {
    oldTournamentDateDraft.value = '';
    oldTournamentDateFilter.value = '';
    oldTournamentIndex.value = 0;
    showOldTournamentDateModal.value = false;
    if (selectedOldTournament.value) await options.loadAttendanceData([selectedOldTournament.value]);
  };

  const formatOldTournamentFilterDate = (value: string): string => {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  };

  return {
    oldTournaments,
    oldTournamentIndex,
    oldTournamentDateFilter,
    oldTournamentDateDraft,
    showOldTournamentDateModal,
    oldTournamentCalendarMonth,
    completedTournamentDates,
    oldTournamentCalendarLoading,
    oldTournamentWeekdays,
    filteredOldTournaments,
    selectedOldTournament,
    oldTournamentCalendarLabel,
    oldTournamentCalendarDays,
    fetchCompletedTournamentDates,
    openOldTournamentDateModal,
    changeOldTournamentCalendarMonth,
    loadOldTournaments,
    navigateOldTournament,
    applyOldTournamentDateFilter,
    clearOldTournamentDateFilter,
    formatOldTournamentFilterDate,
  };
}
