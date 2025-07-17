// Test attendance count
async function checkAttendance() {
  try {
    const response = await fetch('http://localhost:3001/api/tournaments?type=WEEKLY');
    const data = await response.json();
    
    if (!data.success) {
      console.error('Failed to fetch tournaments:', data.error);
      return;
    }
    
    const tournament = data.data.tournaments.find(t => t.status === 'UPCOMING');
    if (!tournament) {
      console.log('No upcoming tournament found');
      return;
    }
    
    console.log(`Checking tournament: ${tournament.name}`);
    
    // Check attendance stats
    const statsResponse = await fetch(`http://localhost:3001/api/tournaments/${tournament.id}/attendance-stats`);
    const statsData = await statsResponse.json();
    
    if (statsData.success) {
      console.log(`Attending count from stats: ${statsData.data.attendingCount}`);
    } else {
      console.log('Stats error:', statsData.error);
    }
    
    // Check attendance details
    const detailsResponse = await fetch(`http://localhost:3001/api/tournaments/${tournament.id}/attendance-details`);
    const detailsData = await detailsResponse.json();
    
    if (detailsData.success) {
      const attendingPlayers = detailsData.data.filter(attendance => attendance.status === 'ATTEND');
      console.log(`Attending count from details: ${attendingPlayers.length}`);
      console.log('First few attending players:');
      attendingPlayers.slice(0, 5).forEach(p => {
        console.log(`  - ${p.player.name} (${p.player.position}, T${p.player.tier})`);
      });
    } else {
      console.log('Details error:', detailsData.error);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAttendance();
