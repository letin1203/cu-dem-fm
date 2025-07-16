import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createBulkPlayersAndUsers() {
  const tournamentId = 'cmd5vgov30001eideh1q5joev';
  
  // Check if tournament exists
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId }
  });
  
  if (!tournament) {
    console.error('Tournament not found!');
    process.exit(1);
  }
  
  console.log(`Creating 20 players and users for tournament: ${tournament.name}`);

  const positions = ['GK', 'CB', 'LB', 'RB', 'CM', 'CDM', 'CAM', 'LW', 'RW', 'ST'];
  const hashedPassword = await bcrypt.hash('password123', 10);

  for (let i = 1; i <= 20; i++) {
    try {
      const playerName = `Player${i.toString().padStart(2, '0')}`;
      const username = `user${i.toString().padStart(2, '0')}`;
      const email = `user${i.toString().padStart(2, '0')}@example.com`;
      const position = positions[Math.floor(Math.random() * positions.length)];
      const tier = Math.floor(Math.random() * 5) + 1; // Random tier 1-5
      const yearOfBirth = Math.floor(Math.random() * 20) + 1990; // Random year 1990-2009

      // Create player first
      const player = await prisma.player.create({
        data: {
          name: playerName,
          position: position,
          yearOfBirth: yearOfBirth,
          tier: tier,
          money: 0,
        }
      });

      console.log(`✅ Created player: ${playerName} (${position}, Tier ${tier})`);

      // Create user linked to player
      const user = await prisma.user.create({
        data: {
          username: username,
          email: email,
          password: hashedPassword,
          role: 'USER',
          playerId: player.id,
        }
      });

      console.log(`✅ Created user: ${username} linked to ${playerName}`);

      // Set attendance to ATTEND for the tournament
      await prisma.tournamentPlayerAttendance.create({
        data: {
          tournamentId: tournamentId,
          playerId: player.id,
          status: 'ATTEND',
        }
      });

      console.log(`✅ Set attendance ATTEND for ${playerName} in tournament`);

    } catch (error: any) {
      console.error(`❌ Error creating player ${i}:`, error.message);
    }
  }

  console.log('\n🎉 Bulk creation completed!');
  
  // Show summary
  const totalPlayers = await prisma.player.count();
  const totalUsers = await prisma.user.count();
  const tournamentAttendance = await prisma.tournamentPlayerAttendance.count({
    where: { 
      tournamentId: tournamentId,
      status: 'ATTEND'
    }
  });

  console.log(`\n📊 Summary:`);
  console.log(`Total players in DB: ${totalPlayers}`);
  console.log(`Total users in DB: ${totalUsers}`);
  console.log(`Players attending tournament: ${tournamentAttendance}`);
}

createBulkPlayersAndUsers()
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
