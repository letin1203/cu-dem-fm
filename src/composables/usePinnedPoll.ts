import { ref } from 'vue';
import { useToast } from 'vue-toastification';
import { apiClient } from '../api/client';

export interface PinnedPollOption {
  id: string;
  label: string;
  sortOrder?: number;
  voteCount?: number;
  selected?: boolean;
}

export interface PinnedPoll {
  id: string;
  question: string;
  allowMultiple: boolean;
  options: PinnedPollOption[];
}

const selectedOptionIds = (poll: PinnedPoll | null): string[] =>
  (poll?.options || []).filter((option) => option.selected).map((option) => option.id);

/**
 * The pinned poll shown on the weekly tournament page. Loading and voting must
 * never block the page itself, so every failure is swallowed by `load` and
 * reported through a toast on `vote`.
 */
export function usePinnedPoll() {
  const toast = useToast();
  const showPinnedPollModal = ref(false);
  const pinnedPoll = ref<PinnedPoll | null>(null);
  const pinnedPollSelectedOptionIds = ref<string[]>([]);
  const pinnedPollSaving = ref(false);

  const applyPoll = (poll: PinnedPoll | null): void => {
    pinnedPoll.value = poll;
    pinnedPollSelectedOptionIds.value = selectedOptionIds(poll);
  };

  const loadPinnedPoll = async (): Promise<void> => {
    try {
      const response = await apiClient.get<PinnedPoll>('/polls/pinned');
      if (!response.success || !response.data) return;
      applyPoll(response.data);
      showPinnedPollModal.value = pinnedPollSelectedOptionIds.value.length === 0;
    } catch {
      // A poll must never block the weekly tournament page from loading.
    }
  };

  const submitPinnedPollVote = async (): Promise<void> => {
    if (!pinnedPoll.value || pinnedPollSaving.value) return;
    pinnedPollSaving.value = true;
    try {
      const response = await apiClient.post<PinnedPoll>(
        `/polls/${pinnedPoll.value.id}/vote`,
        { optionIds: pinnedPollSelectedOptionIds.value },
      );
      if (!response.success) throw new Error(response.error || 'Không thể gửi bình chọn');
      applyPoll(response.data ?? null);
      showPinnedPollModal.value = false;
      toast.success('Đã ghi nhận bình chọn');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể gửi bình chọn');
    } finally {
      pinnedPollSaving.value = false;
    }
  };

  return {
    showPinnedPollModal,
    pinnedPoll,
    pinnedPollSelectedOptionIds,
    pinnedPollSaving,
    loadPinnedPoll,
    submitPinnedPollVote,
  };
}
