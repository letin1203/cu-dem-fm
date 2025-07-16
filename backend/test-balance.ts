import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testBalanceTeams() {
  try {
    const tournamentId = 'cmd4ndfqq000012ovde8mcxmw';

    // Get tournament teams with players
    const tournamentTeams = await prisma.tournamentTeam.findMany({
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

    console.log('=== BEFORE BALANCING ===');
    tournamentTeams.forEach((tt: any) => {
      const team = tt.team;
      const totalTier = team.players.reduce((sum: number, p: any) => sum + p.tier, 0);
      console.log(`${team.name}: ${team.players.length} players, Total Tier: ${totalTier}`);
      team.players.forEach((p: any) => {
        console.log(`  - ${p.name} (${p.position} T${p.tier})`);
      });
    });

    // Get all players from all teams
    const allPlayers: any[] = [];
    const teamData: Array<{
      id: string;
      name: string;
      players: any[];
      totalTier: number;
      tier9Plus: number;
      lockedPlayers: Set<string>;
    }> = [];

    tournamentTeams.forEach((tournamentTeam: any) => {
      const team = tournamentTeam.team;
      const players = team.players || [];
      allPlayers.push(...players);

      // Create set of locked players (highest tier GK + all T9/T10 players)
      const lockedPlayerIds = new Set<string>();
      
      // 1. Lock the highest tier GK in this team (only 1 GK per team)
      const gkPlayers = players.filter((p: any) => p.position === 'GK');
      if (gkPlayers.length > 0) {
        // Sort GK players by tier (highest first) and lock only the highest tier one
        const sortedGks = gkPlayers.sort((a: any, b: any) => b.tier - a.tier);
        lockedPlayerIds.add(sortedGks[0].id); // Lock only the highest tier GK
      }
      
      // 2. Lock all T9 and T10 players (regardless of position)
      const highTierPlayers = players.filter((p: any) => p.tier >= 9);
      highTierPlayers.forEach((p: any) => {
        lockedPlayerIds.add(p.id);
      });

      teamData.push({
        id: team.id,
        name: team.name,
        players: [...players],
        totalTier: players.reduce((sum: number, p: any) => sum + p.tier, 0),
        tier9Plus: players.filter((p: any) => p.tier >= 9).length,
        lockedPlayers: lockedPlayerIds,
      });
    });

    // Get all locked player IDs (highest tier GK from each team)
    const allLockedPlayerIds = new Set<string>();
    teamData.forEach(team => {
      team.lockedPlayers.forEach(id => allLockedPlayerIds.add(id));
    });

    // Players that can be balanced: tier <= 8 AND (non-GK OR unlocked GK)
    const balanceablePlayers = allPlayers.filter((p: any) => 
      p.tier <= 8 && (p.position !== 'GK' || !allLockedPlayerIds.has(p.id))
    );
    
    console.log(`\\n=== BALANCEABLE PLAYERS ===`);
    console.log(`Found ${balanceablePlayers.length} balanceable players (tier ≤8, unlocked)`);
    balanceablePlayers.forEach((p: any) => {
      const isUnlockedGk = p.position === 'GK' && !allLockedPlayerIds.has(p.id);
      console.log(`  - ${p.name} (${p.position} T${p.tier})${isUnlockedGk ? ' [UNLOCKED GK]' : ''}`);
    });

    // Balance algorithm: swap players to minimize team differences
    const maxIterations = 100;
    let improved = true;
    let iterations = 0;

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      // Try swapping players between teams
      for (let i = 0; i < teamData.length; i++) {
        for (let j = i + 1; j < teamData.length; j++) {
          const team1 = teamData[i];
          const team2 = teamData[j];

          // Get swappable players from each team (tier <= 8 AND not locked)
          const team1SwappablePlayers = team1.players.filter((p: any) => 
            p.tier <= 8 && !team1.lockedPlayers.has(p.id)
          );
          const team2SwappablePlayers = team2.players.filter((p: any) => 
            p.tier <= 8 && !team2.lockedPlayers.has(p.id)
          );

          // Try swapping each player from team1 with each player from team2
          for (const p1 of team1SwappablePlayers) {
            for (const p2 of team2SwappablePlayers) {
              // Calculate current imbalance
              const currentPlayerDiff = Math.abs(team1.players.length - team2.players.length);
              const currentTierDiff = Math.abs(team1.totalTier - team2.totalTier);
              const currentTier9PlusDiff = Math.abs(team1.tier9Plus - team2.tier9Plus);
              const currentScore = currentPlayerDiff * 10 + currentTierDiff + currentTier9PlusDiff * 5;

              // Calculate new values after swap
              const newTeam1TotalTier = team1.totalTier - p1.tier + p2.tier;
              const newTeam2TotalTier = team2.totalTier - p2.tier + p1.tier;
              const newTierDiff = Math.abs(newTeam1TotalTier - newTeam2TotalTier);
              
              // Player count stays the same after swap
              const newScore = currentPlayerDiff * 10 + newTierDiff + currentTier9PlusDiff * 5;

              // Special case: if one team has fewer players, prioritize balancing player count
              // by ensuring the team with fewer players has lower total tier
              let shouldSwap = false;
              
              if (team1.players.length !== team2.players.length) {
                const smallerTeam = team1.players.length < team2.players.length ? team1 : team2;
                const largerTeam = team1.players.length < team2.players.length ? team2 : team1;
                
                // Target: larger team should have total tier 3-5 higher than smaller team
                const targetDiff = 4; // Target difference
                const currentDiff = largerTeam.totalTier - smallerTeam.totalTier;
                
                // If larger team has too much tier advantage, move higher tier player to smaller team
                if (currentDiff > targetDiff + 2) {
                  if ((largerTeam === team1 && p1.tier > p2.tier) || 
                      (largerTeam === team2 && p2.tier > p1.tier)) {
                    console.log(`Iteration ${iterations}: Swapping ${p1.name} (T${p1.tier}) from ${team1.name} with ${p2.name} (T${p2.tier}) from ${team2.name} - reducing large team tier`);
                    shouldSwap = true;
                  }
                }
                // If smaller team has higher or close total tier, move lower tier player from smaller team
                else if (currentDiff < targetDiff - 1) {
                  if ((smallerTeam === team1 && p1.tier < p2.tier) || 
                      (smallerTeam === team2 && p2.tier < p1.tier)) {
                    console.log(`Iteration ${iterations}: Swapping ${p1.name} (T${p1.tier}) from ${team1.name} with ${p2.name} (T${p2.tier}) from ${team2.name} - reducing small team tier`);
                    shouldSwap = true;
                  }
                }
              } else {
                // Equal player count - just balance tiers
                shouldSwap = newScore < currentScore;
                if (shouldSwap) {
                  console.log(`Iteration ${iterations}: Swapping ${p1.name} (T${p1.tier}) from ${team1.name} with ${p2.name} (T${p2.tier}) from ${team2.name} - equal teams balance`);
                }
              }

              if (shouldSwap) {
                // Perform the swap
                const p1Index = team1.players.findIndex((p: any) => p.id === p1.id);
                const p2Index = team2.players.findIndex((p: any) => p.id === p2.id);

                team1.players[p1Index] = p2;
                team2.players[p2Index] = p1;

                team1.totalTier = newTeam1TotalTier;
                team2.totalTier = newTeam2TotalTier;

                improved = true;
                break;
              }
            }
            if (improved) break;
          }
          if (improved) break;
        }
        if (improved) break;
      }
    }

    console.log(`\\n=== AFTER ${iterations} ITERATIONS ===`);
    teamData.forEach(team => {
      console.log(`${team.name}: ${team.players.length} players, Total Tier: ${team.totalTier}, T9+ players: ${team.tier9Plus}`);
      
      // Find the highest tier GK to properly label it
      const gkPlayers = team.players.filter((p: any) => p.position === 'GK');
      let highestTierGkId = '';
      if (gkPlayers.length > 0) {
        const sortedGks = gkPlayers.sort((a: any, b: any) => b.tier - a.tier);
        highestTierGkId = sortedGks[0].id;
      }
      
      team.players.forEach((p: any) => {
        const lockedReasons: string[] = [];
        if (p.position === 'GK' && p.id === highestTierGkId) {
          lockedReasons.push('HIGHEST TIER GK');
        }
        if (p.tier >= 9) {
          lockedReasons.push('T9/T10 PLAYER');
        }
        const locked = lockedReasons.length > 0 ? ` (LOCKED - ${lockedReasons.join(', ')})` : '';
        console.log(`  - ${p.name} (${p.position} T${p.tier})${locked}`);
      });
    });

    console.log('\\n=== BALANCE TEST COMPLETE ===');
    console.log('Note: This is a simulation - no database changes were made');
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBalanceTeams();
