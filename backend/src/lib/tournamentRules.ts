import { prisma } from './prisma';

export const getDefaultCancellationDeadline = (startDate: Date): Date => {
  const deadline = new Date(startDate);
  const daysSinceThursday = (deadline.getDay() - 4 + 7) % 7;
  deadline.setDate(deadline.getDate() - daysSinceThursday);
  deadline.setHours(14, 0, 0, 0);
  if (deadline.getTime() >= startDate.getTime()) {
    deadline.setDate(deadline.getDate() - 7);
  }
  return deadline;
};

export const getTournamentCancellationDeadline = (tournament: {
  startDate: Date;
  cancellationDeadline: Date | null;
}): Date => tournament.cancellationDeadline ?? getDefaultCancellationDeadline(tournament.startDate);

export const hasNonNegativeAvailableBalance = async (
  playerId: string,
  currentBalance: number,
): Promise<boolean> => {
  if (currentBalance >= 0) return true;

  const pendingTopUps = await prisma.playerMoneyTopUp.aggregate({
    where: { playerId, status: 'PENDING' },
    _sum: { amount: true },
  });
  return currentBalance + (pendingTopUps._sum.amount || 0) >= 0;
};

export const hasAttendanceCapacity = async (
  tournamentId: string,
  maxAttendance: number | null | undefined,
  field5: boolean,
  field7: boolean,
  additions = 1,
): Promise<boolean> => {
  if (!maxAttendance) return true;
  const [field5Count, field7Count] = await Promise.all([
    field5 ? prisma.tournamentPlayerAttendance.count({ where: { tournamentId, status: { in: ['ATTEND', 'ATTENDING'] }, field5: true } }) : 0,
    field7 ? prisma.tournamentPlayerAttendance.count({ where: { tournamentId, status: { in: ['ATTEND', 'ATTENDING'] }, field7: true } }) : 0,
  ]);
  return (!field5 || field5Count + additions <= maxAttendance) && (!field7 || field7Count + additions <= maxAttendance);
};

export const isChallengeEligible = (
  attendance: { status: string; field5: boolean; field7: boolean } | null,
  field: string | null,
): boolean =>
  attendance?.status === 'ATTEND'
  && (field === 'FIELD_5' ? attendance.field5 : field === 'FIELD_7' ? attendance.field7 : false);
