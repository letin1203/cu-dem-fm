// Test scores endpoint
async function testScoresEndpoint() {
  try {
    // Get tournament ID
    const response = await fetch('http://localhost:3001/api/tournaments?type=WEEKLY');
    const data = await response.json();
    
    console.log(`Found ${data.data.tournaments.length} tournaments:`);
    data.data.tournaments.forEach(t => {
      console.log(`  - ${t.name} (${t.status})`);
    });
    
    const tournament = data.data.tournaments.find(t => t.status === 'UPCOMING') || data.data.tournaments[0];
    if (!tournament) {
      console.log('No tournament found');
      return;
    }
    
    console.log(`Testing scores endpoint for: ${tournament.name}`);
    console.log(`Tournament ID: ${tournament.id}`);
    
    if (tournament.teams && tournament.teams.length > 0) {
      console.log('Teams in tournament:');
      tournament.teams.forEach(tt => {
        console.log(`  - ${tt.team.name} (ID: ${tt.team.id})`);
      });
      
      // Create test scores payload
      const scores = {};
      tournament.teams.forEach((tt, index) => {
        scores[tt.team.id] = index + 1; // Give each team a different score
      });
      
      console.log('Test scores payload:', scores);
      console.log(`Endpoint: PUT /api/tournaments/${tournament.id}/scores`);
    } else {
      console.log('No teams in tournament');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testScoresEndpoint();
