import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugGenerateTeams() {
  const tournamentId = 'cmd643d2r0000o0ki127ycub2';
  
  try {
    console.log('1. Checking tournament...');
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    
    if (!tournament) {
      console.error('Tournament not found!');
      return;
    }
    console.log('✅ Tournament found:', tournament.name);

    console.log('2. Getting attending players...');
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
    
    console.log(`✅ Found ${attendingPlayers.length} attending players`);
    
    if (attendingPlayers.length < 10) {
      console.error('Need at least 10 attending players');
      return;
    }

    console.log('3. Testing team creation...');
    const testTeam = await prisma.team.create({
      data: {
        name: 'Test Team Debug',
        founded: new Date(),
      },
    });
    console.log('✅ Test team created:', testTeam.id);

    console.log('4. Testing player assignment...');
    const firstPlayer = attendingPlayers[0].player;
    await prisma.player.update({
      where: { id: firstPlayer.id },
      data: { teamId: testTeam.id },
    });
    console.log('✅ Player assigned to team');

    console.log('5. Testing tournament team creation...');
    await prisma.tournamentTeam.create({
      data: {
        tournamentId,
        teamId: testTeam.id,
      },
    });
    console.log('✅ Tournament team created');

    console.log('6. Cleaning up...');
    // Reset player team
    await prisma.player.update({
      where: { id: firstPlayer.id },
      data: { teamId: null },
    });
    
    // Delete tournament team
    await prisma.tournamentTeam.deleteMany({
      where: { teamId: testTeam.id },
    });
    
    // Delete test team
    await prisma.team.delete({
      where: { id: testTeam.id },
    });
    console.log('✅ Cleanup completed');

    console.log('🎉 All operations successful - the issue might be in the logic');

  } catch (error) {
    console.error('❌ Error occurred:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugGenerateTeams();
