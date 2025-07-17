import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testTeamGeneration() {
  const tournamentId = 'cmd64ya4a0000c679ki2ub7dy';
  
  // Get attending players count
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

  const playerCount = attendingPlayers.length;
  console.log(`Total attending players: ${playerCount}`);

  // Calculate expected distribution
  let teamCount: number;
  if (playerCount < 15) {
    teamCount = 2;
  } else if (playerCount < 20) {
    teamCount = 3;
  } else {
    teamCount = 4;
  }

  const targetPlayersPerTeam = Math.floor(playerCount / teamCount);
  const teamsWithExtraPlayer = playerCount % teamCount;
  
  console.log(`Teams: ${teamCount}`);
  console.log(`Base players per team: ${targetPlayersPerTeam}`);
  console.log(`Teams with extra player: ${teamsWithExtraPlayer}`);
  
  // Show expected distribution
  const expectedDistribution = [];
  for (let i = 0; i < teamCount; i++) {
    const target = targetPlayersPerTeam + (i < teamsWithExtraPlayer ? 1 : 0);
    expectedDistribution.push(target);
  }
  console.log(`Expected distribution: ${expectedDistribution.join('-')}`);

  // Check current teams if they exist
  const currentTeams = await prisma.tournamentTeam.findMany({
    where: { tournamentId },
    include: {
      team: {
        include: {
          players: {
            select: {
              id: true,
              name: true,
              position: true,
              tier: true,
            },
          },
        },
      },
    },
  });

  if (currentTeams.length > 0) {
    console.log('\nCurrent team distribution:');
    const currentDistribution = currentTeams.map(t => t.team.players.length);
    console.log(`Current distribution: ${currentDistribution.join('-')}`);
    
    currentTeams.forEach((team, index) => {
      const players = team.team.players;
      console.log(`\nTeam ${index + 1}: ${team.team.name} (${players.length} players)`);
      
      const gkCount = players.filter(p => p.position === 'GK').length;
      const tier9Plus = players.filter(p => p.tier >= 9).length;
      const totalTier = players.reduce((sum, p) => sum + p.tier, 0);
      
      console.log(`  - GK: ${gkCount}, Tier 9+: ${tier9Plus}, Total Tier: ${totalTier}`);
      
      // Show players by tier
      const tierCounts = new Map();
      players.forEach(p => {
        const key = `T${p.tier}`;
        tierCounts.set(key, (tierCounts.get(key) || 0) + 1);
      });
      
      const tierSummary = Array.from(tierCounts.entries())
        .sort((a, b) => parseInt(b[0].slice(1)) - parseInt(a[0].slice(1)))
        .map(([tier, count]) => `${tier}:${count}`)
        .join(', ');
      console.log(`  - Tiers: ${tierSummary}`);
    });
  } else {
    console.log('\nNo teams generated yet');
  }

  await prisma.$disconnect();
}

testTeamGeneration().catch(console.error);
