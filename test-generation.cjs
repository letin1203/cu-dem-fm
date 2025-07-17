// Test team generation logic
async function testTeamGeneration() {
  try {
    // Get tournament
    const response = await fetch('http://localhost:3001/api/tournaments?type=WEEKLY');
    const data = await response.json();
    
    const tournament = data.data.tournaments.find(t => t.status === 'UPCOMING');
    if (!tournament) {
      console.log('No upcoming tournament found');
      return;
    }
    
    console.log(`Testing team generation for: ${tournament.name}`);
    
    // Check attendance details to get players
    const detailsResponse = await fetch(`http://localhost:3001/api/tournaments/${tournament.id}/attendance-details`);
    const detailsData = await detailsResponse.json();
    
    if (!detailsData.success) {
      console.log('Failed to get attendance details');
      return;
    }
    
    const attendingPlayers = detailsData.data
      .filter(attendance => attendance.status === 'ATTEND')
      .map(attendance => attendance.player);
    
    console.log(`Found ${attendingPlayers.length} attending players`);
    
    // Simulate team generation logic
    const playerCount = attendingPlayers.length;
    let teamCount;
    if (playerCount < 15) {
      teamCount = 2;
    } else if (playerCount < 20) {
      teamCount = 3;
    } else {
      teamCount = 4;
    }
    
    console.log(`Should create ${teamCount} teams for ${playerCount} players`);
    
    // Sort players by tier
    const sortedPlayers = attendingPlayers.sort((a, b) => b.tier - a.tier);
    
    console.log('Player distribution by position:');
    const gkPlayers = sortedPlayers.filter(p => p.position === 'GK');
    const nonGkPlayers = sortedPlayers.filter(p => p.position !== 'GK');
    
    console.log(`  GK players: ${gkPlayers.length}`);
    console.log(`  Non-GK players: ${nonGkPlayers.length}`);
    
    gkPlayers.forEach(p => console.log(`    - ${p.name} (T${p.tier})`));
    
    console.log('Top 10 non-GK players:');
    nonGkPlayers.slice(0, 10).forEach(p => console.log(`    - ${p.name} (${p.position}, T${p.tier})`));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testTeamGeneration();
