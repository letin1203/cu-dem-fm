export interface Player {
  id: string
  name: string
  position: string
  yearOfBirth: number
  tier: number // Tier rating from 1-10
  money: number // Player's money/value
  teamId?: string
  team?: {
    name: string
    logo?: string
  }
  stats: PlayerStats
  avatar?: string
  createdAt: string | Date
  updatedAt: string | Date
}

export interface TournamentAttendanceDetails {
  id: string
  status: 'NULL' | 'NOT_ATTEND' | 'ATTEND'
  withWater?: boolean
  bet?: boolean
  tournamentId: string
  playerId: string
  createdAt: string | Date
  updatedAt: string | Date
  player: {
    id: string
    name: string
    position: string
    tier: number
    avatar?: string
  }
}

export interface PlayerStats {
  gamesPlayed: number
  goals: number
  assists: number
  yellowCards: number
  redCards: number
  minutesPlayed: number
}

export interface Team {
  id: string
  name: string
  logo?: string
  founded: string | Date
  score?: number
  players: Player[]
  stats: TeamStats
  createdAt: string | Date
  updatedAt: string | Date
}

export interface TeamStats {
  gamesPlayed: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  points: number
}

export interface Tournament {
  id: string
  name: string
  type: 'LEAGUE' | 'KNOCKOUT' | 'GROUP' | 'WEEKLY'
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED'
  startDate: string | Date
  endDate?: string | Date
  teams: Team[]
  tournamentTeamPlayers?: TournamentTeamPlayer[]
  matches: Match[]
  winner?: Team
  loser?: Team
  createdAt: string | Date
  updatedAt: string | Date
}

export interface CreateTournamentRequest {
  name: string
  type: 'LEAGUE' | 'KNOCKOUT' | 'GROUP' | 'WEEKLY'
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED'
  startDate: string
  endDate?: string
  teamIds?: string[]
}

export interface TournamentPlayerAttendance {
  id: string
  status: 'NULL' | 'NOT_ATTEND' | 'ATTEND'
  withWater: boolean
  bet: boolean
  tournamentId: string
  playerId: string
  createdAt: string | Date
  updatedAt: string | Date
}

export interface SystemSettings {
  id: string
  stadiumCost: number
  sponsorMoney: number
  clubFund: number
  waterCost?: number
  createdAt: string | Date
  updatedAt: string | Date
}

export interface AdditionalCost {
  id: string
  description: string
  amount: number
  tournamentId: string
  createdAt: string | Date
  updatedAt: string | Date
}

export interface Match {
  id: string
  tournamentId: string
  homeTeam: { id: string; name: string; logo?: string }
  awayTeam: { id: string; name: string; logo?: string }
  homeScore?: number
  awayScore?: number
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'POSTPONED'
  scheduledDate: string | Date
  venue?: string
  currentMinute?: number
  events: MatchEvent[]
  createdAt: string | Date
  updatedAt: string | Date
  tournament?: {
    id: string
    name: string
    type: string
  }
}

export interface MatchEvent {
  id: string
  matchId: string
  type: 'GOAL' | 'OWN_GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'SUBSTITUTION'
  minute: number
  playerId: string
  player?: {
    id: string
    name: string
  }
  playerName?: string
  team: 'HOME' | 'AWAY'
  description?: string
  tempId?: string // For new events before they're saved
  createdAt?: string | Date
}

export interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string | string[]
    borderWidth?: number
  }[]
}

export interface User {
  id: string
  username: string
  email?: string // Made optional since we're removing email support
  password: string
  role: UserRole
  playerId?: string // Links to a player for their personal stats
  player?: Player // Full player object when populated
  isActive: boolean
  lastLogin?: string | Date
  createdAt: string | Date
  updatedAt: string | Date
}

export type UserRole = 'admin' | 'mod' | 'user'

export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface Permission {
  canViewPlayers: boolean
  canEditPlayers: boolean
  canDeletePlayers: boolean
  canViewTeams: boolean
  canEditTeams: boolean
  canDeleteTeams: boolean
  canViewTournaments: boolean
  canEditTournaments: boolean
  canDeleteTournaments: boolean
  canViewMatches: boolean
  canEditMatches: boolean
  canDeleteMatches: boolean
  canManageUsers: boolean
}

export interface TournamentAttendanceStats {
  totalPlayers: number
  attendingCount: number
  notAttendingCount: number
  bettingCount: number
  nullCount: number
  responseRate: string
  attendanceRate: string
}

export interface TournamentAttendanceDetails {
  id: string
  status: 'NULL' | 'NOT_ATTEND' | 'ATTEND'
  withWater?: boolean
  bet?: boolean
  tournamentId: string
  playerId: string
  createdAt: string | Date
  updatedAt: string | Date
  player: {
    id: string
    name: string
    position: string
    tier: number
    avatar?: string
  }
}

export interface TournamentEndResponse {
  message: string
  playersUpdated: number
  totalDeducted: number
}

export interface TournamentTeamPlayer {
  tournamentId: string
  teamId: string
  playerId: string
  player: Player
  team: Team
  assignedAt: string | Date
}
