import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function simpleGenerateTeams() {
  const tournamentId = 'cmd643d2r0000o0ki127ycub2';
  
  try {
    console.log('Starting simple team generation...');
    
    // Get attending players
    const attendingPlayers = await prisma.tournamentPlayerAttendance.findMany({
      where: { 
        tournamentId,
        status: 'ATTEND'
      },
      include: {
        player: {
          select: {
            id: true,
            name: true,
            position: true,
            tier: true,
          },
        },
      },
    });
    
    const players = attendingPlayers.map(attendance => attendance.player);
    console.log(`Found ${players.length} players`);
    
    // Determine team count
    const teamCount = players.length < 15 ? 2 : players.length < 20 ? 3 : 4;
    console.log(`Will create ${teamCount} teams`);
    
    // Simple distribution - just split players evenly
    const teams: Array<{
      name: string;
      players: typeof players;
    }> = [];
    for (let i = 0; i < teamCount; i++) {
      teams.push({
        name: `Team ${i + 1}`,
        players: []
      });
    }
    
    // Distribute players round-robin style
    players.forEach((player, index) => {
      const teamIndex = index % teamCount;
      teams[teamIndex].players.push(player);
    });
    
    console.log('Teams created in memory:');
    teams.forEach((team, index) => {
      console.log(`  ${team.name}: ${team.players.length} players`);
    });
    
    // Create teams in database
    for (let i = 0; i < teams.length; i++) {
      const teamData = teams[i];
      
      console.log(`Creating ${teamData.name}...`);
      const team = await prisma.team.create({
        data: {
          name: teamData.name,
          founded: new Date(),
        },
      });
      
      console.log(`Assigning players to ${teamData.name}...`);
      await prisma.player.updateMany({
        where: {
          id: {
            in: teamData.players.map(p => p.id),
          },
        },
        data: {
          teamId: team.id,
        },
      });
      
      console.log(`Adding ${teamData.name} to tournament...`);
      await prisma.tournamentTeam.create({
        data: {
          tournamentId,
          teamId: team.id,
        },
      });
      
      console.log(`✅ ${teamData.name} completed`);
    }
    
    console.log('🎉 Simple team generation completed successfully!');
    
  } catch (error) {
    console.error('❌ Error in simple team generation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

simpleGenerateTeams();
