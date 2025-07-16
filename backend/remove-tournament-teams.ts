import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeTournamentTeams() {
  const tournamentId = 'cmd4ndfqq000012ovde8mcxmw';
  
  try {
    console.log(`Removing all teams from tournament: ${tournamentId}`);

    // First, get the tournament teams to see what we're removing
    const tournamentTeams = await prisma.tournamentTeam.findMany({
      where: { tournamentId },
      include: {
        team: {
          include: {
            players: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (tournamentTeams.length === 0) {
      console.log('No teams found for this tournament.');
      return;
    }

    console.log(`Found ${tournamentTeams.length} teams to remove:`);
    tournamentTeams.forEach((tt: any) => {
      console.log(`- ${tt.team.name} (${tt.team.players.length} players)`);
    });

    // Step 1: Remove all players from teams (set teamId to null)
    for (const tournamentTeam of tournamentTeams) {
      const teamId = tournamentTeam.team.id;
      const playerCount = tournamentTeam.team.players.length;
      
      if (playerCount > 0) {
        await prisma.player.updateMany({
          where: { teamId },
          data: { teamId: null },
        });
        console.log(`✅ Removed ${playerCount} players from ${tournamentTeam.team.name}`);
      }
    }

    // Step 2: Remove tournament team relationships
    const deletedTournamentTeams = await prisma.tournamentTeam.deleteMany({
      where: { tournamentId },
    });
    console.log(`✅ Removed ${deletedTournamentTeams.count} tournament team relationships`);

    // Step 3: Delete the teams themselves
    const teamIds = tournamentTeams.map(tt => tt.team.id);
    const deletedTeams = await prisma.team.deleteMany({
      where: {
        id: {
          in: teamIds,
        },
      },
    });
    console.log(`✅ Deleted ${deletedTeams.count} teams`);

    console.log('\n🎉 Successfully removed all teams from the tournament!');
    
  } catch (error) {
    console.error('❌ Error removing tournament teams:', error);
  } finally {
    await prisma.$disconnect();
  }
}

removeTournamentTeams();
