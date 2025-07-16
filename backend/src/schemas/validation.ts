import { z } from 'zod';

// Define enums to match Prisma schema
const UserRole = z.enum(['ADMIN', 'MOD', 'USER']);
const TournamentType = z.enum(['LEAGUE', 'KNOCKOUT', 'GROUP', 'WEEKLY']);
const TournamentStatus = z.enum(['UPCOMING', 'ONGOING', 'COMPLETED']);
const MatchStatus = z.enum(['SCHEDULED', 'LIVE', 'COMPLETED', 'POSTPONED']);
const EventType = z.enum(['GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION']);
const TeamSide = z.enum(['HOME', 'AWAY']);
const AttendanceStatus = z.enum(['NULL', 'NOT_ATTEND', 'ATTEND']);

// Auth schemas
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: UserRole.optional(),
});

// User schemas
export const updateUserSchema = z.object({
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
  role: UserRole.optional(),
  isActive: z.boolean().optional(),
  playerId: z.string().optional().nullable(),
});

// Player schemas
export const createPlayerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  position: z.string().min(1, 'Position is required'),
  yearOfBirth: z.number().int().min(1950).max(new Date().getFullYear()),
  tier: z.number().int().min(1).max(10).default(1),
  money: z.number().int().min(0).default(0),
  avatar: z.string().url().optional(),
  teamId: z.string().optional(),
});

export const updatePlayerSchema = createPlayerSchema.partial();

// Team schemas
export const createTeamSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  logo: z.string().url().optional(),
  founded: z.string().transform((str) => new Date(str)),
});

export const updateTeamSchema = createTeamSchema.partial();

// Tournament schemas
export const createTournamentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: TournamentType,
  status: TournamentStatus.default('UPCOMING'),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)).optional().nullable(),
  teamIds: z.array(z.string()).optional().default([]),
}).superRefine((data, ctx) => {
  // For non-weekly tournaments, require at least 2 teams
  if (data.type !== 'WEEKLY' && data.teamIds && data.teamIds.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_small,
      minimum: 2,
      type: 'array',
      inclusive: true,
      path: ['teamIds'],
      message: 'At least 2 teams required for non-weekly tournaments',
    });
  }
});

export const updateTournamentSchema = z.object({
  name: z.string().min(1).optional(),
  type: TournamentType.optional(),
  status: TournamentStatus.optional(),
  startDate: z.string().transform((str) => new Date(str)).optional(),
  endDate: z.string().transform((str) => new Date(str)).optional().nullable(),
  winnerId: z.string().optional(),
});

// Match schemas
export const createMatchSchema = z.object({
  tournamentId: z.string(),
  homeTeamId: z.string(),
  awayTeamId: z.string(),
  scheduledDate: z.string().transform((str) => new Date(str)),
  venue: z.string().optional(),
});

export const updateMatchSchema = z.object({
  homeScore: z.number().int().min(0).optional(),
  awayScore: z.number().int().min(0).optional(),
  status: MatchStatus.optional(),
  scheduledDate: z.string().transform((str) => new Date(str)).optional(),
  venue: z.string().optional(),
});

// Match Event schemas
export const createMatchEventSchema = z.object({
  matchId: z.string(),
  playerId: z.string(),
  type: EventType,
  minute: z.number().int().min(0).max(120),
  team: TeamSide,
  description: z.string().optional(),
});

export const updateMatchEventSchema = createMatchEventSchema.partial().omit({ matchId: true });

// Query parameter schemas
export const paginationSchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
});

export const playerQuerySchema = paginationSchema.extend({
  teamId: z.string().optional(),
  position: z.string().optional(),
  tier: z.string().transform(Number).optional(),
});

export const matchQuerySchema = paginationSchema.extend({
  tournamentId: z.string().optional(),
  teamId: z.string().optional(),
  status: MatchStatus.optional(),
});

// Tournament Player Attendance schemas
export const updateAttendanceSchema = z.object({
  status: AttendanceStatus,
  withWater: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;
export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type UpdateMatchInput = z.infer<typeof updateMatchSchema>;
export type CreateMatchEventInput = z.infer<typeof createMatchEventSchema>;
export type UpdateMatchEventInput = z.infer<typeof updateMatchEventSchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export type PlayerQuery = z.infer<typeof playerQuerySchema>;
export type MatchQuery = z.infer<typeof matchQuerySchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
