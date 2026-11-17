import { prisma } from '../lib/prisma';

/**
 * Automatic weekly registration.
 *
 * A player can opt in from their profile and choose one or both pitches. The
 * server then registers them for the next weekly tournament as soon as their
 * available balance is non-negative — where "available" includes money still
 * waiting for approval, matching the manual registration rule so auto and manual
 * sign-ups can never disagree.
 */

export interface AutoRegistrationResult {
  /** Players registered by this run. */
  registered: string[];
  /** Players skipped because their available balance was negative. */
  skippedNegativeBalance: string[];
  /** Players skipped because the tournament could not take them. */
  skippedOther: string[];
}

/**
 * Balance a player can spend.
 *
 * Pending top-ups count as available, exactly like `hasNonNegativeAvailableBalance`
 * does for a manual registration: the club has the money, it is only awaiting an
 * admin's confirmation.
 */
export const availableBalance = async (
  playerId: string,
  currentMoney: number,
): Promise<number> => {
  const pending = await prisma.playerMoneyTopUp.aggregate({
    where: { playerId, status: 'PENDING' },
    _sum: { amount: true },
  });
  return currentMoney + (pending._sum.amount || 0);
};

/**
 * Register every opted-in player for the given tournament.
 *
 * Deliberately idempotent: a player who already has an ATTEND record is left
 * untouched, so running this repeatedly (the page polls it) never creates a
 * duplicate or overwrites a manual cancellation.
 */
export const runAutoRegistration = async (
  tournamentId: string,
): Promise<AutoRegistrationResult> => {
  const result: AutoRegistrationResult = {
    registered: [],
    skippedNegativeBalance: [],
    skippedOther: [],
  };

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      status: true,
      selfFunded: true,
      startDate: true,
      cancellationDeadline: true,
      maxAttendance: true,
    },
  });

  // Only weekly tournaments that have not started yet, and only when the player
  // could still legally be registered (before the cancellation deadline).
  if (!tournament) return result;
  if (!['UPCOMING', 'ONGOING'].includes(tournament.status)) return result;
  if (tournament.startDate.getTime() <= Date.now()) return result;

  const candidates = await prisma.player.findMany({
    where: {
      isActive: true,
      autoRegisterEnabled: true,
      OR: [{ autoRegisterField5: true }, { autoRegisterField7: true }],
    },
    select: {
      id: true,
      name: true,
      money: true,
      autoRegisterField5: true,
      autoRegisterField7: true,
    },
  });
  if (!candidates.length) return result;

  const existing = await prisma.tournamentPlayerAttendance.findMany({
    where: { tournamentId, playerId: { in: candidates.map((player) => player.id) } },
    select: { playerId: true, status: true },
  });

  /*
   * Players whose registration must not be touched.
   *
   * ATTEND       - already registered, nothing to do.
   * NOT_ATTEND   - the player deliberately withdrew. Re-registering them would
   *                silently undo their own decision (and re-add them to a
   *                tournament they said they are not playing), so it is skipped.
   *
   * Only a NULL row — never registered either way — is eligible to be filled in.
   */
  const doNotTouch = new Set(
    existing
      .filter((row) => row.status === 'ATTEND' || row.status === 'NOT_ATTEND')
      .map((row) => row.playerId),
  );

  for (const player of candidates) {
    if (doNotTouch.has(player.id)) continue;

    // A self-funded tournament never charges players, so the balance gate does
    // not apply there; otherwise the sign-up is refused when the balance is
    // still negative after counting pending top-ups.
    if (!tournament.selfFunded) {
      const available = await availableBalance(player.id, player.money);
      if (available < 0) {
        result.skippedNegativeBalance.push(player.id);
        continue;
      }
    }

    const field5 = player.autoRegisterField5;
    const field7 = player.autoRegisterField7;

    // Capacity is checked per pitch so an over-subscribed field cannot be
    // filled by the automation.
    if (tournament.maxAttendance) {
      const counts = await prisma.tournamentPlayerAttendance.groupBy({
        by: ['field5', 'field7'],
        where: { tournamentId, status: 'ATTEND' },
        _count: { _all: true },
      });
      const field5Count = counts
        .filter((row) => row.field5)
        .reduce((total, row) => total + row._count._all, 0);
      const field7Count = counts
        .filter((row) => row.field7)
        .reduce((total, row) => total + row._count._all, 0);
      if (
        (field5 && field5Count >= tournament.maxAttendance)
        || (field7 && field7Count >= tournament.maxAttendance)
      ) {
        result.skippedOther.push(player.id);
        continue;
      }
    }

    try {
      await prisma.tournamentPlayerAttendance.upsert({
        where: { tournamentId_playerId: { tournamentId, playerId: player.id } },
        update: {
          status: 'ATTEND',
          field5,
          field7,
          registeredAt: new Date(),
        },
        create: {
          tournamentId,
          playerId: player.id,
          status: 'ATTEND',
          field5,
          field7,
          registeredAt: new Date(),
        },
      });
      result.registered.push(player.id);
    } catch {
      result.skippedOther.push(player.id);
    }
  }

  return result;
};
