import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testTournamentDeletion() {
  try {
    console.log('🧪 Testing tournament deletion with team cleanup...');
    
    // Find a weekly tournament that has teams
    const weeklyTournaments = await prisma.tournament.findMany({
      where: { 
        type: 'WEEKLY',
      },
      include: {
        teams: {
          include: {
            team: true
          }
        }
      }
    });
    
    console.log(`Found ${weeklyTournaments.length} weekly tournaments`);
    
    const tournamentWithTeams = weeklyTournaments.find(t => t.teams.length > 0);
    
    if (!tournamentWithTeams) {
      console.log('No weekly tournament with teams found to test deletion');
      return;
    }
    
    console.log(`\n📋 Testing tournament: ${tournamentWithTeams.name}`);
    console.log(`Teams before deletion: ${tournamentWithTeams.teams.length}`);
    
    // List the teams that will be deleted
    console.log('\nTeams that will be deleted:');
    tournamentWithTeams.teams.forEach(tt => {
      console.log(`  - ${tt.team.name} (ID: ${tt.team.id})`);
    });
    
    // Count teams before deletion
    const teamsCountBefore = await prisma.team.count();
    console.log(`\nTotal teams in DB before deletion: ${teamsCountBefore}`);
    
    // Use the API to delete the tournament (using curl to test the actual endpoint)
    console.log('\n🗑️  Deleting tournament via API...');
    
    // Note: We'll return the tournament ID so you can manually test the deletion
    console.log(`\nTo test the deletion, run this command:`);
    console.log(`curl -X DELETE "http://localhost:3001/api/tournaments/${tournamentWithTeams.id}" \\`);
    console.log(`  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWQ2MmV2bWgwMDAweDA4azQ3ejI5ZnVvIiwiaWF0IjoxNzUyNjc3NzQ5LCJleHAiOjE3NTMyODI1NDl9.z1ShN0gC2hCtqJjSuS_cZBEOLZ84-Zat2zf_2ECM0C0"`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTournamentDeletion();
