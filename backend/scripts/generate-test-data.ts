import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const TOURNAMENT_ID = 'cmtsbq4vd0002p1kfm62hxhz8';
const TOTAL_PLAYERS = 20;
const GK_COUNT = 3; // Change this value to generate a different number of goalkeepers.

async function generateTestData() {
  try {
    console.log('Starting test data generation...');

    // Check if tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id: TOURNAMENT_ID }
    });

    if (!tournament) {
      console.error(`Tournament ${TOURNAMENT_ID} not found`);
      return;
    }

    console.log(`Found tournament: ${tournament.name}`);
    const testUserPasswordHash = await bcrypt.hash('test123', 10);

    // Generate users with linked players. GK players are deliberately Tier 3-6.
    const usersData = [];
    const playersData = [];

    for (let i = 1; i <= TOTAL_PLAYERS; i++) {
      const userId = `test-user-${i.toString().padStart(2, '0')}`;
      const playerId = `test-player-${i.toString().padStart(2, '0')}`;
      
      usersData.push({
        id: userId,
        email: `testuser${i}@example.com`,
        username: `testuser${i}`,
        password: testUserPasswordHash,
        role: 'USER',
        playerId: playerId,
      });

      const isGoalkeeper = i <= GK_COUNT;
      playersData.push({
        id: playerId,
        name: `Test Player ${i}`,
        position: isGoalkeeper ? 'GK' : ['DEF', 'MID', 'FWD'][Math.floor(Math.random() * 3)],
        yearOfBirth: 1990 + Math.floor(Math.random() * 15), // 1990-2004
        tier: isGoalkeeper ? Math.floor(Math.random() * 4) + 3 : Math.floor(Math.random() * 6) + 1,
        money: Math.floor(Math.random() * 100000) + 10000, // 10k-110k
      });
    }

    // Create players first
    console.log(`Creating ${TOTAL_PLAYERS} players (${GK_COUNT} GK)...`);
    for (const playerData of playersData) {
      await prisma.player.upsert({
        where: { id: playerData.id },
        update: playerData,
        create: playerData,
      });
    }

    // Create users
    console.log(`Creating ${TOTAL_PLAYERS} users...`);
    for (const userData of usersData) {
      await prisma.user.upsert({
        where: { id: userData.id },
        update: userData,
        create: userData,
      });
    }

    // Create attendance records for 15 players (attending)
    console.log('Creating attendance records...');
    for (let i = 1; i <= TOTAL_PLAYERS; i++) {
      const playerId = `test-player-${i.toString().padStart(2, '0')}`;
      const status = i <= 15 ? 'ATTEND' : 'NOT_ATTEND'; // First 15 attend, last 5 don't attend

      await prisma.tournamentPlayerAttendance.upsert({
        where: {
          tournamentId_playerId: {
            tournamentId: TOURNAMENT_ID,
            playerId: playerId,
          },
        },
        update: {
          status: status,
        },
        create: {
          tournamentId: TOURNAMENT_ID,
          playerId: playerId,
          status: status,
        },
      });
    }

    console.log('✅ Test data generation completed!');
    console.log('📊 Summary:');
    console.log(`   - ${TOTAL_PLAYERS} users created`);
    console.log(`   - ${TOTAL_PLAYERS} players created and linked to users (${GK_COUNT} GK, Tier 3-6)`);
    console.log('   - 15 players set to ATTEND the tournament');
    console.log('   - 5 players set to NOT_ATTEND the tournament');

    // Verify the data
    const totalPlayers = await prisma.player.count();
    const totalUsers = await prisma.user.count();
    const attendanceStats = await prisma.tournamentPlayerAttendance.findMany({
      where: { tournamentId: TOURNAMENT_ID },
      select: { status: true },
    });

    const attendingCount = attendanceStats.filter(a => a.status === 'ATTEND').length;
    const notAttendingCount = attendanceStats.filter(a => a.status === 'NOT_ATTEND').length;

    console.log(`\n📈 Verification:`);
    console.log(`   - Total players in DB: ${totalPlayers}`);
    console.log(`   - Total users in DB: ${totalUsers}`);
    console.log(`   - Players attending tournament: ${attendingCount}`);
    console.log(`   - Players not attending tournament: ${notAttendingCount}`);

  } catch (error) {
    console.error('❌ Error generating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateTestData();
