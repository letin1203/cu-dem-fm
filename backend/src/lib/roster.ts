import { prisma } from './prisma';

const san7Roster = [
  ['Hiền Nguyễn', 5], ['Nhật CMN', 1], ['Quyền Vương', 2], ['Huy Phạm - Ken', 4],
  ['Thịnh Tạ', 1], ['Võ Út Warrior', 3], ['Tâm Phạm', 2], ['Cường Nguyễn GK', 4],
  ['Tín Lê', 4], ['Hùng Trịnh', 2], ['Chiến Trần', 1], ['Chính Nguyễn', 4],
  ['Việt Nguyễn', 3], ['Duy Lợn', 4], ['Đạt Huỳnh', 1], ['Khánh Mai', 3],
  ['Liêm Trần', 4], ['Tuấn Phạm', 3], ['Lâm Tấn Hào', 2], ['Minh Trần', 6],
  ['Sứng Phạm', 2], ['Lý', 3], ['Hải Nguyễn', 4], ['Liêm Nguyễn', 1],
  ['Việt Anh', 4], ['Hiệp NT', 2], ['Phúc Sport Zone', 2], ['Thông Phạm', 4],
  ['Lộc Nguyễn', 3], ['Minh Đoàn', 5], ['Duy GK', 3], ['Tài Võ', 6],
  ['Châu Nguyễn GK', 3], ['Hoàng Châu', 2], ['Đông', 2], ['Sinh', 2],
  ['Tô Nông', 4], ['Tuấn Trần', 4],
] as const;

const testRoster = [
  ['Tuấn Bùi', 3], ['Công Chiến', 3], ['Duy Hưng', 4], ['Hoàng Phan', 4],
  ['Kim Huy', 4], ['Vinh GK', 3], ['Sang Trần', 4], ['Tú Nguyễn', 4],
] as const;

/**
 * One-time, idempotent rename for the existing generated players.
 * Sân 7 player 09 is intentionally skipped because "Tín Lê" belongs to admin.
 */
export const syncKnownPlayerRoster = async (): Promise<number> => {
  const changes = [
    ...san7Roster.map(([name, tier], index) => ({
      id: `san7-test-player-${String(index + 1).padStart(2, '0')}`,
      expectedName: `Sân 7 Test Player ${index + 1}`,
      name,
      tier,
      skip: index === 8,
    })),
    ...testRoster.map(([name, tier], index) => ({
      id: `test-player-${String(index + 1).padStart(2, '0')}`,
      expectedName: `Test Player ${index + 1}`,
      name,
      tier,
      skip: false,
    })),
  ];

  const results = await Promise.all(changes.filter(change => !change.skip).map(change =>
    prisma.player.updateMany({
      where: { id: change.id, name: change.expectedName },
      data: { name: change.name, tier: change.tier },
    }),
  ));
  return results.reduce((total, result) => total + result.count, 0);
};
