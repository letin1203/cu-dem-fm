import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * The service talks to Prisma directly, so the module is mocked per test rather
 * than spun up against a database: these tests pin the decision rules that
 * matter (opt-in, balance gate, pitch selection, idempotency).
 */
const prismaMock = {
  tournament: { findUnique: vi.fn() },
  player: { findMany: vi.fn() },
  tournamentPlayerAttendance: {
    findMany: vi.fn(),
    groupBy: vi.fn(),
    upsert: vi.fn(),
  },
  playerMoneyTopUp: { aggregate: vi.fn() },
};

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }));

const { availableBalance, runAutoRegistration } = await import('./autoRegistration');

const futureTournament = (overrides: Record<string, unknown> = {}) => ({
  id: 't1',
  status: 'UPCOMING',
  selfFunded: false,
  startDate: new Date(Date.now() + 86_400_000),
  cancellationDeadline: null,
  maxAttendance: null,
  ...overrides,
});

const player = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: 'Player One',
  money: 50_000,
  autoRegisterField5: true,
  autoRegisterField7: false,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.tournament.findUnique.mockResolvedValue(futureTournament());
  prismaMock.player.findMany.mockResolvedValue([player()]);
  prismaMock.tournamentPlayerAttendance.findMany.mockResolvedValue([]);
  prismaMock.tournamentPlayerAttendance.groupBy.mockResolvedValue([]);
  prismaMock.tournamentPlayerAttendance.upsert.mockResolvedValue({});
  prismaMock.playerMoneyTopUp.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
});

describe('availableBalance', () => {
  it('adds pending top-ups to the current balance', async () => {
    prismaMock.playerMoneyTopUp.aggregate.mockResolvedValue({ _sum: { amount: 30_000 } });
    await expect(availableBalance('p1', -50_000)).resolves.toBe(-20_000);
  });

  it('treats a missing sum as zero', async () => {
    prismaMock.playerMoneyTopUp.aggregate.mockResolvedValue({ _sum: { amount: null } });
    await expect(availableBalance('p1', 10_000)).resolves.toBe(10_000);
  });
});

describe('runAutoRegistration', () => {
  it('registers an opted-in player on the chosen pitches only', async () => {
    const result = await runAutoRegistration('t1');

    expect(result.registered).toEqual(['p1']);
    expect(prismaMock.tournamentPlayerAttendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ field5: true, field7: false, status: 'ATTEND' }),
      }),
    );
  });

  it('skips a player whose available balance is negative', async () => {
    prismaMock.player.findMany.mockResolvedValue([player({ money: -10_000 })]);
    prismaMock.playerMoneyTopUp.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    const result = await runAutoRegistration('t1');

    expect(result.registered).toEqual([]);
    expect(result.skippedNegativeBalance).toEqual(['p1']);
    expect(prismaMock.tournamentPlayerAttendance.upsert).not.toHaveBeenCalled();
  });

  it('registers when pending top-ups make the balance non-negative', async () => {
    prismaMock.player.findMany.mockResolvedValue([player({ money: -10_000 })]);
    prismaMock.playerMoneyTopUp.aggregate.mockResolvedValue({ _sum: { amount: 25_000 } });

    const result = await runAutoRegistration('t1');

    expect(result.registered).toEqual(['p1']);
  });

  it('ignores the balance gate for a self-funded tournament', async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(futureTournament({ selfFunded: true }));
    prismaMock.player.findMany.mockResolvedValue([player({ money: -99_000 })]);
    prismaMock.playerMoneyTopUp.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    const result = await runAutoRegistration('t1');

    expect(result.registered).toEqual(['p1']);
  });

  it('never double-registers a player who already attends', async () => {
    prismaMock.tournamentPlayerAttendance.findMany.mockResolvedValue([
      { playerId: 'p1', status: 'ATTEND' },
    ]);

    const result = await runAutoRegistration('t1');

    expect(result.registered).toEqual([]);
    expect(prismaMock.tournamentPlayerAttendance.upsert).not.toHaveBeenCalled();
  });

  it('never re-registers a player who withdrew themselves', async () => {
    // NOT_ATTEND means the player chose not to play; auto-registration must not
    // undo that decision.
    prismaMock.tournamentPlayerAttendance.findMany.mockResolvedValue([
      { playerId: 'p1', status: 'NOT_ATTEND' },
    ]);

    const result = await runAutoRegistration('t1');

    expect(result.registered).toEqual([]);
    expect(prismaMock.tournamentPlayerAttendance.upsert).not.toHaveBeenCalled();
  });

  it('fills in a player who has only a placeholder row', async () => {
    // A NULL row means "never registered either way", so it is eligible.
    prismaMock.tournamentPlayerAttendance.findMany.mockResolvedValue([
      { playerId: 'p1', status: 'NULL' },
    ]);

    const result = await runAutoRegistration('t1');

    expect(result.registered).toEqual(['p1']);
    expect(prismaMock.tournamentPlayerAttendance.upsert).toHaveBeenCalled();
  });

  it('does nothing for a tournament that already started', async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(
      futureTournament({ startDate: new Date(Date.now() - 1000) }),
    );

    const result = await runAutoRegistration('t1');

    expect(result.registered).toEqual([]);
    expect(prismaMock.player.findMany).not.toHaveBeenCalled();
  });

  it('does nothing for a completed tournament', async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(futureTournament({ status: 'COMPLETED' }));

    const result = await runAutoRegistration('t1');

    expect(result.registered).toEqual([]);
  });

  it('returns quietly when the tournament does not exist', async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(null);

    const result = await runAutoRegistration('missing');

    expect(result).toEqual({
      registered: [],
      skippedNegativeBalance: [],
      skippedOther: [],
    });
  });

  it('stops when the chosen pitch is full', async () => {
    prismaMock.tournament.findUnique.mockResolvedValue(futureTournament({ maxAttendance: 2 }));
    prismaMock.tournamentPlayerAttendance.groupBy.mockResolvedValue([
      { field5: true, field7: false, _count: { _all: 2 } },
    ]);

    const result = await runAutoRegistration('t1');

    expect(result.registered).toEqual([]);
    expect(result.skippedOther).toEqual(['p1']);
  });

  it('only queries players that opted in and chose a pitch', async () => {
    await runAutoRegistration('t1');

    const where = prismaMock.player.findMany.mock.calls[0][0].where;
    expect(where.autoRegisterEnabled).toBe(true);
    expect(where.OR).toEqual([{ autoRegisterField5: true }, { autoRegisterField7: true }]);
  });
});
