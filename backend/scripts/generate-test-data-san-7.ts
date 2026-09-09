import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const TOURNAMENT_ID = 'cmtsg7ey4000711tf0vha4c43';
const ATTENDING_PLAYERS = 33;
const TOTAL_PLAYERS = 41;
const GK_COUNT = 3; // Change this value to generate a different number of goalkeepers.

async function generateTestDataSan7() {
  try {
    console.log('Starting sân 7 test data generation...');

    const tournament = await prisma.tournament.findUnique({ where: { id: TOURNAMENT_ID } });
    if (!tournament) {
      console.error(`Tournament ${TOURNAMENT_ID} not found`);
      return;
    }

    console.log(`Found tournament: ${tournament.name}`);
    const passwordHash = await bcrypt.hash('test123', 10);

    console.log(`Creating ${TOTAL_PLAYERS} sân 7 players and users...`);
    for (let i = 1; i <= TOTAL_PLAYERS; i++) {
      const suffix = i.toString().padStart(2, '0');
      const playerId = `san7-test-player-${suffix}`;
      const userId = `san7-test-user-${suffix}`;
      const isGoalkeeper = i <= GK_COUNT;
      const position = isGoalkeeper ? 'GK' : ['DEF', 'MID', 'FWD'][(i - GK_COUNT - 1) % 3];
      const tier = isGoalkeeper ? ((i - 1) % 4) + 3 : ((i - 1) % 6) + 1;

      await prisma.player.upsert({
        where: { id: playerId },
        update: {
          name: `Sân 7 Test Player ${i}`,
          position,
          yearOfBirth: 1990 + ((i - 1) % 15),
          tier,
          money: 100000,
        },
        create: {
          id: playerId,
          name: `Sân 7 Test Player ${i}`,
          position,
          yearOfBirth: 1990 + ((i - 1) % 15),
          tier,
          money: 100000,
        },
      });

      await prisma.user.upsert({
        where: { id: userId },
        update: {
          email: `san7testuser${i}@example.com`,
          username: `san7testuser${i}`,
          password: passwordHash,
          role: 'USER',
          playerId,
        },
        create: {
          id: userId,
          email: `san7testuser${i}@example.com`,
          username: `san7testuser${i}`,
          password: passwordHash,
          role: 'USER',
          playerId,
        },
      });
    }

    console.log('Creating attendance, water, and betting records...');
    for (let i = 1; i <= TOTAL_PLAYERS; i++) {
      const playerId = `san7-test-player-${i.toString().padStart(2, '0')}`;
      const isAttending = i <= ATTENDING_PLAYERS;
      const isBetting = i <= 10;
      const withWater = i <= 5 || (i >= 11 && i <= 14);

      await prisma.tournamentPlayerAttendance.upsert({
        where: { tournamentId_playerId: { tournamentId: TOURNAMENT_ID, playerId } },
        update: {
          status: isAttending ? 'ATTEND' : 'NOT_ATTEND',
          bet: isAttending && isBetting,
          withWater: isAttending && withWater,
        },
        create: {
          tournamentId: TOURNAMENT_ID,
          playerId,
          status: isAttending ? 'ATTEND' : 'NOT_ATTEND',
          bet: isAttending && isBetting,
          withWater: isAttending && withWater,
        },
      });
    }

    const attendance = await prisma.tournamentPlayerAttendance.findMany({
      where: { tournamentId: TOURNAMENT_ID, playerId: { startsWith: 'san7-test-player-' } },
      select: { status: true, bet: true, withWater: true },
    });
    const attending = attendance.filter(item => item.status === 'ATTEND');
    const betting = attending.filter(item => item.bet);
    const water = attending.filter(item => item.withWater);
    const bettingWithWater = attending.filter(item => item.bet && item.withWater);

    console.log('✅ Sân 7 test data generation completed!');
    console.log(`   - ${GK_COUNT} GK created (Tier 3-6 only)`);
    console.log(`   - ${attending.length} players set to ATTEND`);
    console.log(`   - ${attendance.filter(item => item.status === 'NOT_ATTEND').length} players set to NOT_ATTEND`);
    console.log(`   - ${betting.length} attending players set to BET`);
    console.log(`   - ${water.length} attending players set to WATER`);
    console.log(`   - ${bettingWithWater.length} players set to both BET and WATER`);
  } catch (error) {
    console.error('❌ Error generating sân 7 test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateTestDataSan7();
