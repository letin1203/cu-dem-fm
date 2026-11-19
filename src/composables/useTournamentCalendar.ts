import { computed, ref } from 'vue';
import { apiClient } from '../api/client';

export const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const CALENDAR_WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/**
 * Inline month calendar highlighting days that had a completed tournament.
 *
 * Shared by the "Giải đấu cũ" date filter and the "Chọn tuần cũ" picker on the
 * Test chia team page, so both read the same endpoint and behave identically.
 */
export function useTournamentCalendar() {
  const month = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const completedDates = ref<Set<string>>(new Set());
  const loading = ref(false);

  const label = computed(() =>
    month.value.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }),
  );

  const days = computed<Array<Date | null>>(() => {
    const firstDay = new Date(month.value.getFullYear(), month.value.getMonth(), 1);
    const dayCount = new Date(
      month.value.getFullYear(),
      month.value.getMonth() + 1,
      0,
    ).getDate();
    const result: Array<Date | null> = Array.from(
      { length: firstDay.getDay() },
      () => null,
    );
    for (let day = 1; day <= dayCount; day += 1) {
      result.push(new Date(month.value.getFullYear(), month.value.getMonth(), day));
    }
    while (result.length % 7 !== 0) result.push(null);
    return result;
  });

  /** Load which days in the visible month had a finished tournament. */
  const fetchCompletedDates = async (): Promise<void> => {
    loading.value = true;
    try {
      const response = await apiClient.get<string[]>(
        `/tournaments/completed-dates?year=${month.value.getFullYear()}&month=${month.value.getMonth() + 1}`,
      );
      completedDates.value = new Set(response.success ? response.data || [] : []);
    } catch {
      // A calendar that failed to load must not break the page; it simply shows
      // no highlighted days.
      completedDates.value = new Set();
    } finally {
      loading.value = false;
    }
  };

  /** Jump the calendar to `date`'s month and load that month's days. */
  const focusMonth = async (date: Date): Promise<void> => {
    month.value = new Date(date.getFullYear(), date.getMonth(), 1);
    await fetchCompletedDates();
  };

  const changeMonth = async (offset: number): Promise<void> => {
    month.value = new Date(month.value.getFullYear(), month.value.getMonth() + offset, 1);
    await fetchCompletedDates();
  };

  return {
    month,
    label,
    days,
    weekdays: CALENDAR_WEEKDAYS,
    completedDates,
    loading,
    fetchCompletedDates,
    focusMonth,
    changeMonth,
  };
}
