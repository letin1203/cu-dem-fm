async function debugTeamData() {
  try {
    // Get all tournaments
    const response = await fetch('http://localhost:3001/api/tournaments?type=WEEKLY');
    const data = await response.json();
    
    if (!data.success) {
      console.error('Failed to fetch tournaments:', data.error);
      return;
    }
    
    const tournaments = data.data.tournaments;
    console.log(`Found ${tournaments.length} weekly tournaments`);
    
    for (const tournament of tournaments) {
      console.log(`\n=== Tournament: ${tournament.name} (${tournament.status}) ===`);
      console.log(`Teams: ${tournament.teams.length}`);
      console.log(`TournamentTeamPlayers: ${tournament.tournamentTeamPlayers ? tournament.tournamentTeamPlayers.length : 0}`);
      
      if (tournament.teams.length > 0) {
        // Create a map of team players from tournamentTeamPlayers
        const teamPlayersMap = new Map();
        
        if (tournament.tournamentTeamPlayers) {
          tournament.tournamentTeamPlayers.forEach(ttp => {
            if (!teamPlayersMap.has(ttp.teamId)) {
              teamPlayersMap.set(ttp.teamId, []);
            }
            teamPlayersMap.get(ttp.teamId).push(ttp.player);
          });
        }
        
        for (const tournamentTeam of tournament.teams) {
          const team = tournamentTeam.team;
          const playersInTeam = teamPlayersMap.get(team.id) || [];
          console.log(`  Team: ${team.name}`);
          console.log(`  Players in team: ${playersInTeam.length}`);
          
          if (playersInTeam.length > 0) {
            playersInTeam.forEach(player => {
              console.log(`    - ${player.name} (${player.position}, T${player.tier})`);
            });
          }
        }
        
        // Check attendance for this tournament
        console.log('\n  Checking attendance...');
        const attendanceResponse = await fetch(`http://localhost:3001/api/tournaments/${tournament.id}/attendance/stats`);
        const attendanceData = await attendanceResponse.json();
        
        if (attendanceData.success) {
          console.log(`  Attending players: ${attendanceData.data.attendingCount}`);
          console.log(`  Not attending: ${attendanceData.data.notAttendingCount}`);
          console.log(`  Betting: ${attendanceData.data.bettingCount || 0}`);
        }
      }
    }
  } catch (error) {
    console.error('Debug error:', error);
  }
}

debugTeamData();
