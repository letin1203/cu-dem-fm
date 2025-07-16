import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@football.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  // Create mod user
  const modPassword = await bcrypt.hash('mod123', 12);
  const mod = await prisma.user.upsert({
    where: { username: 'moderator' },
    update: {},
    create: {
      username: 'moderator',
      email: 'mod@football.com',
      password: modPassword,
      role: 'MOD',
    },
  });

  // Create teams
  const teams = await Promise.all([
    prisma.team.upsert({
      where: { name: 'Real Madrid' },
      update: {},
      create: {
        name: 'Real Madrid',
        founded: new Date('1902-03-06'),
        logo: 'https://logos-world.net/wp-content/uploads/2020/06/Real-Madrid-Logo.png',
        stats: {
          create: {},
        },
      },
    }),
    prisma.team.upsert({
      where: { name: 'Barcelona' },
      update: {},
      create: {
        name: 'Barcelona',
        founded: new Date('1899-11-29'),
        logo: 'https://logos-world.net/wp-content/uploads/2020/06/Barcelona-Logo.png',
        stats: {
          create: {},
        },
      },
    }),
    prisma.team.upsert({
      where: { name: 'Manchester United' },
      update: {},
      create: {
        name: 'Manchester United',
        founded: new Date('1878-01-01'),
        logo: 'https://logos-world.net/wp-content/uploads/2020/06/Manchester-United-Logo.png',
        stats: {
          create: {},
        },
      },
    }),
    prisma.team.upsert({
      where: { name: 'Liverpool' },
      update: {},
      create: {
        name: 'Liverpool',
        founded: new Date('1892-06-03'),
        logo: 'https://logos-world.net/wp-content/uploads/2020/06/Liverpool-Logo.png',
        stats: {
          create: {},
        },
      },
    }),
  ]);

  console.log(`✅ Created ${teams.length} teams`);

  // Create players
  const players = await Promise.all([
    // Real Madrid players
    prisma.player.upsert({
      where: { name: 'Karim Benzema' },
      update: {},
      create: {
        name: 'Karim Benzema',
        position: 'Forward',
        yearOfBirth: 1987,
        tier: 9,
        money: 50000,
        teamId: teams[0].id,
        stats: {
          create: {
            goals: 25,
            assists: 8,
            gamesPlayed: 30,
            minutesPlayed: 2400,
          },
        },
      },
    }),
    prisma.player.upsert({
      where: { name: 'Luka Modric' },
      update: {},
      create: {
        name: 'Luka Modric',
        position: 'Midfielder',
        yearOfBirth: 1985,
        tier: 8,
        money: 40000,
        teamId: teams[0].id,
        stats: {
          create: {
            goals: 3,
            assists: 12,
            gamesPlayed: 28,
            minutesPlayed: 2200,
          },
        },
      },
    }),

    // Barcelona players
    prisma.player.upsert({
      where: { name: 'Robert Lewandowski' },
      update: {},
      create: {
        name: 'Robert Lewandowski',
        position: 'Forward',
        yearOfBirth: 1988,
        tier: 9,
        money: 55000,
        teamId: teams[1].id,
        stats: {
          create: {
            goals: 30,
            assists: 5,
            gamesPlayed: 32,
            minutesPlayed: 2800,
          },
        },
      },
    }),
    prisma.player.upsert({
      where: { name: 'Pedri' },
      update: {},
      create: {
        name: 'Pedri',
        position: 'Midfielder',
        yearOfBirth: 2002,
        tier: 7,
        money: 25000,
        teamId: teams[1].id,
        stats: {
          create: {
            goals: 8,
            assists: 10,
            gamesPlayed: 25,
            minutesPlayed: 2000,
          },
        },
      },
    }),

    // Manchester United players
    prisma.player.upsert({
      where: { name: 'Marcus Rashford' },
      update: {},
      create: {
        name: 'Marcus Rashford',
        position: 'Forward',
        yearOfBirth: 1997,
        tier: 8,
        money: 35000,
        teamId: teams[2].id,
        stats: {
          create: {
            goals: 20,
            assists: 6,
            gamesPlayed: 28,
            minutesPlayed: 2300,
          },
        },
      },
    }),
    prisma.player.upsert({
      where: { name: 'Bruno Fernandes' },
      update: {},
      create: {
        name: 'Bruno Fernandes',
        position: 'Midfielder',
        yearOfBirth: 1994,
        tier: 8,
        money: 40000,
        teamId: teams[2].id,
        stats: {
          create: {
            goals: 12,
            assists: 15,
            gamesPlayed: 30,
            minutesPlayed: 2600,
          },
        },
      },
    }),

    // Liverpool players
    prisma.player.upsert({
      where: { name: 'Mohamed Salah' },
      update: {},
      create: {
        name: 'Mohamed Salah',
        position: 'Forward',
        yearOfBirth: 1992,
        tier: 9,
        money: 50000,
        teamId: teams[3].id,
        stats: {
          create: {
            goals: 28,
            assists: 9,
            gamesPlayed: 31,
            minutesPlayed: 2700,
          },
        },
      },
    }),
    prisma.player.upsert({
      where: { name: 'Virgil van Dijk' },
      update: {},
      create: {
        name: 'Virgil van Dijk',
        position: 'Defender',
        yearOfBirth: 1991,
        tier: 8,
        money: 35000,
        teamId: teams[3].id,
        stats: {
          create: {
            goals: 2,
            assists: 1,
            gamesPlayed: 29,
            minutesPlayed: 2610,
          },
        },
      },
    }),
  ]);

  console.log(`✅ Created ${players.length} players`);

  // Create a tournament
  const tournament = await prisma.tournament.upsert({
    where: { name: 'Champions League 2024' },
    update: {},
    create: {
      name: 'Champions League 2024',
      type: 'KNOCKOUT',
      status: 'ONGOING',
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-05-30'),
      teams: {
        create: teams.map(team => ({
          teamId: team.id,
        })),
      },
    },
  });

  console.log('✅ Created tournament');

  // Create some matches
  const matches = await Promise.all([
    prisma.match.upsert({
      where: { id: 'match-1' },
      update: {},
      create: {
        id: 'match-1',
        tournamentId: tournament.id,
        homeTeamId: teams[0].id, // Real Madrid
        awayTeamId: teams[1].id, // Barcelona
        homeScore: 2,
        awayScore: 1,
        status: 'COMPLETED',
        scheduledDate: new Date('2024-03-15T20:00:00Z'),
        venue: 'Santiago Bernabéu',
      },
    }),
    prisma.match.upsert({
      where: { id: 'match-2' },
      update: {},
      create: {
        id: 'match-2',
        tournamentId: tournament.id,
        homeTeamId: teams[2].id, // Manchester United
        awayTeamId: teams[3].id, // Liverpool
        homeScore: null,
        awayScore: null,
        status: 'SCHEDULED',
        scheduledDate: new Date('2024-03-25T15:00:00Z'),
        venue: 'Old Trafford',
      },
    }),
  ]);

  console.log(`✅ Created ${matches.length} matches`);

  // Create some match events for the completed match
  const events = await Promise.all([
    prisma.matchEvent.create({
      data: {
        matchId: matches[0].id,
        playerId: players[0].id, // Benzema
        type: 'GOAL',
        minute: 25,
        team: 'HOME',
        description: 'Great finish from inside the box',
      },
    }),
    prisma.matchEvent.create({
      data: {
        matchId: matches[0].id,
        playerId: players[2].id, // Lewandowski
        type: 'GOAL',
        minute: 45,
        team: 'AWAY',
        description: 'Header from corner kick',
      },
    }),
    prisma.matchEvent.create({
      data: {
        matchId: matches[0].id,
        playerId: players[1].id, // Modric
        type: 'GOAL',
        minute: 78,
        team: 'HOME',
        description: 'Long-range strike',
      },
    }),
  ]);

  console.log(`✅ Created ${events.length} match events`);

  // Create some user players
  const userPassword = await bcrypt.hash('user123', 12);
  const regularUsers = await Promise.all([
    prisma.user.upsert({
      where: { username: 'player1' },
      update: {},
      create: {
        username: 'player1',
        email: 'player1@football.com',
        password: userPassword,
        role: 'USER',
        player: {
          create: {
            name: 'John Smith',
            position: 'Midfielder',
            yearOfBirth: 1995,
            tier: 5,
            money: 10000,
            stats: {
              create: {
                goals: 5,
                assists: 8,
                gamesPlayed: 15,
                minutesPlayed: 1200,
              },
            },
          },
        },
      },
    }),
    prisma.user.upsert({
      where: { username: 'player2' },
      update: {},
      create: {
        username: 'player2',
        email: 'player2@football.com',
        password: userPassword,
        role: 'USER',
        player: {
          create: {
            name: 'Alex Johnson',
            position: 'Forward',
            yearOfBirth: 1998,
            tier: 4,
            money: 8000,
            stats: {
              create: {
                goals: 12,
                assists: 3,
                gamesPlayed: 18,
                minutesPlayed: 1400,
              },
            },
          },
        },
      },
    }),
  ]);

  console.log(`✅ Created ${regularUsers.length} regular users with players`);

  console.log('🎉 Database seeding completed!');
  console.log('\n📋 Sample accounts:');
  console.log('Admin: username="admin", password="admin123"');
  console.log('Moderator: username="moderator", password="mod123"');
  console.log('User 1: username="player1", password="user123"');
  console.log('User 2: username="player2", password="user123"');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
