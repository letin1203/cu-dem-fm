import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testTeamGenerationWithExistingPlayers() {
  const tournamentId = 'cmd77yo2e0000g3iaudionejn';
  
  // First, clear any existing attendance for this tournament
  await prisma.tournamentPlayerAttendance.deleteMany({
    where: { tournamentId }
  });
  
  // Get the 20 existing bulk-created players (those starting with "Player")
  const existingPlayers = await prisma.player.findMany({
    where: {
      name: { startsWith: 'Player' }
    },
    select: {
      id: true,
      name: true,
      position: true,
      tier: true,
    },
    take: 20,
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Found ${existingPlayers.length} existing players`);
  
  if (existingPlayers.length < 20) {
    console.log('Warning: Less than 20 existing players found. Need to create more players first.');
    await prisma.$disconnect();
    return;
  }

  // Set attendance for these 20 players
  console.log('Setting attendance for 20 existing players...');
  for (const player of existingPlayers) {
    const withWater = Math.random() > 0.5; // Random water preference
    const bet = Math.random() > 0.7; // 30% chance of betting
    await prisma.tournamentPlayerAttendance.create({
      data: {
        tournamentId,
        playerId: player.id,
        status: 'ATTEND',
        withWater,
        bet,
      }
    });
    console.log(`✅ Set attendance for ${player.name} (water: ${withWater ? 'yes' : 'no'}, bet: ${bet ? 'yes' : 'no'})`);
  }

  // Get attending players count
  const attendingPlayers = await prisma.tournamentPlayerAttendance.findMany({
    where: { 
      tournamentId,
      status: 'ATTEND'
    },
    select: {
      withWater: true,
      bet: true,
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
  console.log(`\nTotal attending players: ${playerCount}`);

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

  // Show player breakdown by tier and position
  const positionCounts = new Map();
  const tierCounts = new Map();
  let waterCount = 0;
  let betCount = 0;
  
  attendingPlayers.forEach(({ player, withWater, bet }) => {
    positionCounts.set(player.position, (positionCounts.get(player.position) || 0) + 1);
    tierCounts.set(player.tier, (tierCounts.get(player.tier) || 0) + 1);
    if (withWater) waterCount++;
    if (bet) betCount++;
  });

  console.log('\nPlayer breakdown:');
  console.log('Positions:', Array.from(positionCounts.entries()).map(([pos, count]) => `${pos}:${count}`).join(', '));
  console.log('Tiers:', Array.from(tierCounts.entries()).sort((a, b) => b[0] - a[0]).map(([tier, count]) => `T${tier}:${count}`).join(', '));
  console.log(`Water: ${waterCount}/${playerCount} (${((waterCount/playerCount)*100).toFixed(1)}%)`);
  console.log(`Betting: ${betCount}/${playerCount} (${((betCount/playerCount)*100).toFixed(1)}%)`);

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
      
      // List all players
      console.log(`  - Players: ${players.map(p => `${p.name}(${p.position},T${p.tier})`).join(', ')}`);
    });
  } else {
    console.log('\nNo teams generated yet');
    console.log('Run team generation API to create teams with these players');
  }

  await prisma.$disconnect();
}

testTeamGenerationWithExistingPlayers().catch(console.error);
