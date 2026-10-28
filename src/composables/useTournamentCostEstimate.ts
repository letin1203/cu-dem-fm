import { useSystemStore } from '../stores/system';
import type { Tournament, TournamentAttendanceStats } from '../types';

/**
 * Display-only financial estimates for the weekly tournament cards.
 *
 * These never persist anything: the authoritative charge is computed once by
 * `PUT /tournaments/:id/end` on the backend.
 */
export function useTournamentCostEstimate(options: {
  getTournamentById: (tournamentId: string | null) => Tournament | undefined;
  getAttendanceStats: (tournamentId: string) => TournamentAttendanceStats | undefined;
}) {
  const systemStore = useSystemStore();

  const getTournamentSponsorMoney = (tournament: Tournament): number => {
    if (tournament.selfFunded) return 0;
    return tournament.sponsorMoney !== null && tournament.sponsorMoney !== undefined
      ? tournament.sponsorMoney
      : systemStore.currentSettings?.sponsorMoney || 0;
  };

  const getTournamentStadiumCost = (tournament: Tournament): number =>
    tournament.stadiumCost !== null && tournament.stadiumCost !== undefined
      ? tournament.stadiumCost
      : systemStore.currentSettings?.stadiumCost || 0;

  const getTournamentFundContribution = (tournament: Tournament): number =>
    tournament.fundContribution || 0;

  const getTournamentAdditionalCosts = (tournamentId: string) => {
    const tournament = options.getTournamentById(tournamentId);
    if (tournament?.selfFunded) return [];
    return systemStore.additionalCosts.filter((cost) => cost.tournamentId === tournamentId);
  };

  const getTournamentAdditionalCostsTotal = (tournamentId: string): number =>
    getTournamentAdditionalCosts(tournamentId).reduce((total, cost) => total + cost.amount, 0);

  const calculateTournamentNet = (tournamentId: string): number => {
    if (!systemStore.currentSettings) return 0;
    const tournament = options.getTournamentById(tournamentId);
    const sponsor = tournament
      ? getTournamentSponsorMoney(tournament)
      : systemStore.currentSettings.sponsorMoney;
    const stadium = tournament
      ? getTournamentStadiumCost(tournament)
      : systemStore.currentSettings.stadiumCost;
    const additionalCosts = getTournamentAdditionalCostsTotal(tournamentId);
    return (
      stadium -
      sponsor +
      additionalCosts -
      (tournament ? getTournamentFundContribution(tournament) : 0)
    );
  };

  const calculateCostPerPlayerForCount = (tournamentId: string, divisor: number): number => {
    const net = calculateTournamentNet(tournamentId);
    if (divisor <= 0) return 0;
    const baseCost = net / divisor;
    const tournament = options.getTournamentById(tournamentId);
    if (tournament?.selfFunded) return Math.round(baseCost);
    return Math.ceil(baseCost / 5000) * 5000;
  };

  const getCostEstimateInfo = (tournamentId: string) => {
    const stats = options.getAttendanceStats(tournamentId);
    const attendingCount = stats?.attendingCount || 0;
    const field5Count = stats?.field5Count ?? attendingCount;
    const field7Count = stats?.field7Count ?? attendingCount;
    const useField5 = field5Count >= field7Count;
    const registered = useField5 ? field5Count : field7Count;
    const minimum = useField5 ? 12 : 16;
    return { registered, minimum, divisor: Math.max(registered, minimum) };
  };

  const calculateCostPerPlayer = (tournamentId: string): number => {
    const { divisor } = getCostEstimateInfo(tournamentId);
    return calculateCostPerPlayerForCount(tournamentId, divisor);
  };

  // This adjustment is intentionally display-only. The persisted end-tournament
  // calculation is unchanged.
  const getEstimateAdditionalCost = (tournamentId: string): number => {
    const tournament = options.getTournamentById(tournamentId);
    if (tournament?.selfFunded || getTournamentAdditionalCostsTotal(tournamentId) > 0) return 0;
    return 120000;
  };

  const calculateDisplayEstimateNet = (tournamentId: string): number =>
    calculateTournamentNet(tournamentId) + getEstimateAdditionalCost(tournamentId);

  const calculateDisplayEstimateCostForCount = (tournamentId: string, divisor: number): number => {
    const estimateAdditionalCost = getEstimateAdditionalCost(tournamentId);
    if (estimateAdditionalCost === 0) return calculateCostPerPlayerForCount(tournamentId, divisor);
    if (divisor <= 0) return 0;
    return Math.ceil(calculateDisplayEstimateNet(tournamentId) / divisor / 5000) * 5000;
  };

  const calculateDisplayEstimateCost = (tournamentId: string): number => {
    const { divisor } = getCostEstimateInfo(tournamentId);
    return calculateDisplayEstimateCostForCount(tournamentId, divisor);
  };

  const shouldShowMaxCostRange = (tournament: Tournament): boolean => {
    const { divisor } = getCostEstimateInfo(tournament.id);
    return Boolean(tournament.maxAttendance && tournament.maxAttendance > divisor);
  };

  return {
    getTournamentSponsorMoney,
    getTournamentStadiumCost,
    getTournamentFundContribution,
    getTournamentAdditionalCosts,
    getTournamentAdditionalCostsTotal,
    calculateTournamentNet,
    calculateCostPerPlayerForCount,
    getCostEstimateInfo,
    calculateCostPerPlayer,
    getEstimateAdditionalCost,
    calculateDisplayEstimateNet,
    calculateDisplayEstimateCostForCount,
    calculateDisplayEstimateCost,
    shouldShowMaxCostRange,
  };
}
