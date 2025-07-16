import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateTestData() {
  try {
    console.log('Starting test data generation...');

    // Check if tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id: 'cmd4ndfqq000012ovde8mcxmw' }
    });

    if (!tournament) {
      console.error('Tournament cmd4ndfqq000012ovde8mcxmw not found');
      return;
    }

    console.log(`Found tournament: ${tournament.name}`);

    // Generate 20 users with linked players
    const usersData = [];
    const playersData = [];

    for (let i = 1; i <= 20; i++) {
      const userId = `test-user-${i.toString().padStart(2, '0')}`;
      const playerId = `test-player-${i.toString().padStart(2, '0')}`;
      
      usersData.push({
        id: userId,
        email: `testuser${i}@example.com`,
        username: `testuser${i}`,
        password: '$2a$10$example.hash.for.testing.purposes.only', // placeholder hash
        role: 'USER',
        playerId: playerId,
      });

      playersData.push({
        id: playerId,
        name: `Test Player ${i}`,
        position: ['GK', 'DEF', 'MID', 'FWD'][Math.floor(Math.random() * 4)],
        yearOfBirth: 1990 + Math.floor(Math.random() * 15), // 1990-2004
        tier: Math.floor(Math.random() * 10) + 1, // 1-10
        money: Math.floor(Math.random() * 100000) + 10000, // 10k-110k
      });
    }

    // Create players first
    console.log('Creating 20 players...');
    for (const playerData of playersData) {
      await prisma.player.upsert({
        where: { id: playerData.id },
        update: playerData,
        create: playerData,
      });
    }

    // Create users
    console.log('Creating 20 users...');
    for (const userData of usersData) {
      await prisma.user.upsert({
        where: { id: userData.id },
        update: userData,
        create: userData,
      });
    }

    // Create attendance records for 15 players (attending)
    console.log('Creating attendance records...');
    for (let i = 1; i <= 20; i++) {
      const playerId = `test-player-${i.toString().padStart(2, '0')}`;
      const status = i <= 15 ? 'ATTEND' : 'NOT_ATTEND'; // First 15 attend, last 5 don't attend

      await prisma.tournamentPlayerAttendance.upsert({
        where: {
          tournamentId_playerId: {
            tournamentId: 'cmd4ndfqq000012ovde8mcxmw',
            playerId: playerId,
          },
        },
        update: {
          status: status,
        },
        create: {
          tournamentId: 'cmd4ndfqq000012ovde8mcxmw',
          playerId: playerId,
          status: status,
        },
      });
    }

    console.log('✅ Test data generation completed!');
    console.log('📊 Summary:');
    console.log('   - 20 users created');
    console.log('   - 20 players created and linked to users');
    console.log('   - 15 players set to ATTEND the tournament');
    console.log('   - 5 players set to NOT_ATTEND the tournament');

    // Verify the data
    const totalPlayers = await prisma.player.count();
    const totalUsers = await prisma.user.count();
    const attendanceStats = await prisma.tournamentPlayerAttendance.findMany({
      where: { tournamentId: 'cmd4ndfqq000012ovde8mcxmw' },
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
