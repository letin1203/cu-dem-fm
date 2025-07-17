import axios from 'axios';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private client: any;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config: any) => {
        // Note: We can't directly import the store here due to circular dependency
        // So we'll get the token from localStorage
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error: any) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors
    this.client.interceptors.response.use(
      (response: any) => response,
      (error: any) => {
        if (error.response?.status === 401) {
          // Clear token and redirect to login
          localStorage.removeItem('auth_token');
          // Redirect to login page
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Helper methods for role conversion
  private convertRoleToBackend(role: string): string {
    return role.toUpperCase();
  }

  private convertRoleToFrontend(role: string): string {
    return role.toLowerCase();
  }

  private prepareUserDataForBackend(userData: any) {
    if (userData.role) {
      return {
        ...userData,
        role: this.convertRoleToBackend(userData.role)
      };
    }
    return userData;
  }

  // Generic methods
  async get<T>(url: string, config?: any): Promise<ApiResponse<T>> {
    const response = await this.client.get(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: any): Promise<ApiResponse<T>> {
    const response = await this.client.post(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: any): Promise<ApiResponse<T>> {
    const response = await this.client.put(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: any): Promise<ApiResponse<T>> {
    const response = await this.client.patch(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: any): Promise<ApiResponse<T>> {
    const response = await this.client.delete(url, config);
    return response.data;
  }

  // Auth endpoints
  async login(credentials: { username: string; password: string }) {
    return this.post('/auth/login', credentials);
  }

  async register(userData: { username: string; email: string; password: string; role?: string }) {
    return this.post('/auth/register', this.prepareUserDataForBackend(userData));
  }

  async getCurrentUser() {
    return this.get('/auth/me');
  }

  async logout() {
    return this.post('/auth/logout');
  }

  // Users endpoints
  async getUsers(params?: any) {
    return this.get('/users', { params });
  }

  async getUser(id: string) {
    return this.get(`/users/${id}`);
  }

  async updateUser(id: string, data: any) {
    return this.put(`/users/${id}`, this.prepareUserDataForBackend(data));
  }

  async deleteUser(id: string) {
    return this.delete(`/users/${id}`);
  }

  async updateUserStatus(id: string, isActive: boolean) {
    return this.patch(`/users/${id}/status`, { isActive });
  }

  async createBulkUserPlayer() {
    return this.post('/users/bulk-user-player');
  }

  // Players endpoints
  async getPlayers(params?: any) {
    return this.get('/players', { params });
  }

  async getPlayer(id: string) {
    return this.get(`/players/${id}`);
  }

  async createPlayer(data: any) {
    return this.post('/players', data);
  }

  async updatePlayer(id: string, data: any) {
    return this.put(`/players/${id}`, data);
  }

  async deletePlayer(id: string) {
    return this.delete(`/players/${id}`);
  }

  async updatePlayerStats(id: string, stats: any) {
    return this.put(`/players/${id}/stats`, stats);
  }

  // Teams endpoints
  async getTeams(params?: any) {
    return this.get('/teams', { params });
  }

  async getTeam(id: string) {
    return this.get(`/teams/${id}`);
  }

  async createTeam(data: any) {
    return this.post('/teams', data);
  }

  async updateTeam(id: string, data: any) {
    return this.put(`/teams/${id}`, data);
  }

  async deleteTeam(id: string) {
    return this.delete(`/teams/${id}`);
  }

  async addPlayerToTeam(teamId: string, playerId: string) {
    return this.post(`/teams/${teamId}/players/${playerId}`);
  }

  async removePlayerFromTeam(teamId: string, playerId: string) {
    return this.delete(`/teams/${teamId}/players/${playerId}`);
  }

  // Tournaments endpoints
  async getTournaments(params?: any) {
    return this.get('/tournaments', { params });
  }

  async getTournament(id: string) {
    return this.get(`/tournaments/${id}`);
  }

  async createTournament(data: any) {
    return this.post('/tournaments', data);
  }

  async updateTournament(id: string, data: any) {
    return this.put(`/tournaments/${id}`, data);
  }

  async deleteTournament(id: string) {
    return this.delete(`/tournaments/${id}`);
  }

  async addTeamToTournament(tournamentId: string, teamId: string) {
    return this.post(`/tournaments/${tournamentId}/teams/${teamId}`);
  }

  async removeTeamFromTournament(tournamentId: string, teamId: string) {
    return this.delete(`/tournaments/${tournamentId}/teams/${teamId}`);
  }

  // Tournament scores endpoints
  async updateTournamentScores(tournamentId: string, scores: Record<string, number>) {
    return this.put(`/tournaments/${tournamentId}/scores`, { scores });
  }

  // Matches endpoints
  async getMatches(params?: any) {
    return this.get('/matches', { params });
  }

  async getMatch(id: string) {
    return this.get(`/matches/${id}`);
  }

  async createMatch(data: any) {
    return this.post('/matches', data);
  }

  async updateMatch(id: string, data: any) {
    return this.put(`/matches/${id}`, data);
  }

  async deleteMatch(id: string) {
    return this.delete(`/matches/${id}`);
  }

  async addMatchEvent(matchId: string, event: any) {
    return this.post(`/matches/${matchId}/events`, event);
  }

  async deleteMatchEvent(matchId: string, eventId: string) {
    return this.delete(`/matches/${matchId}/events/${eventId}`);
  }

  // Stats endpoints
  async getDashboardStats() {
    return this.get('/stats/dashboard');
  }

  async getPlayerStats(params?: any) {
    return this.get('/stats/players', { params });
  }

  async getTeamStats() {
    return this.get('/stats/teams');
  }

  async getTournamentStats() {
    return this.get('/stats/tournaments');
  }

  async getMatchStats() {
    return this.get('/stats/matches');
  }

  // System Settings endpoints
  async getSystemSettings() {
    return this.get('/system-settings');
  }

  async updateSystemSettings(data: any) {
    return this.put('/system-settings', data);
  }

  // Additional Costs endpoints
  async getAdditionalCosts(tournamentId: string) {
    return this.get(`/additional-costs/tournament/${tournamentId}`);
  }

  async createAdditionalCost(data: any) {
    return this.post('/additional-costs', data);
  }

  async updateAdditionalCost(id: string, data: any) {
    return this.put(`/additional-costs/${id}`, data);
  }

  async deleteAdditionalCost(id: string) {
    return this.delete(`/additional-costs/${id}`);
  }
}

export const apiClient = new ApiClient();
