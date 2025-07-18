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
      timeout: 30000, // Increased timeout to 30 seconds for cold starts
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

    // Response interceptor to handle errors and retries
    this.client.interceptors.response.use(
      (response: any) => response,
      async (error: any) => {
        const originalRequest = error.config;
        
        // Retry logic for timeout errors (cold start issues)
        if (error.code === 'ECONNABORTED' && error.message.includes('timeout') && !originalRequest._retry) {
          originalRequest._retry = true;
          originalRequest.timeout = 60000; // Very long timeout for retry (60s)
          console.log('Request timed out, retrying with longer timeout...');
          
          // Add a small delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.client(originalRequest);
        }
        
        // Also handle network errors that might indicate cold starts
        if ((error.code === 'NETWORK_ERROR' || error.code === 'ERR_NETWORK') && !originalRequest._retry) {
          originalRequest._retry = true;
          originalRequest.timeout = 60000;
          console.log('Network error, retrying...');
          
          // Add a delay before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
          return this.client(originalRequest);
        }
        
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
    // Special handling for login with additional retry logic
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`Login attempt ${retryCount + 1}/${maxRetries}`);
        return await this.post('/auth/login', credentials);
      } catch (error: any) {
        retryCount++;
        
        if (retryCount >= maxRetries) {
          throw error;
        }
        
        // Check if it's a timeout or network error that might be due to cold start
        const isRetryableError = error.code === 'ECONNABORTED' || 
                                error.code === 'NETWORK_ERROR' || 
                                error.code === 'ERR_NETWORK' ||
                                (error.message && error.message.includes('timeout'));
        
        if (isRetryableError) {
          const delay = retryCount * 3000; // Increasing delay: 3s, 6s
          console.log(`Login failed with ${error.code || 'timeout'}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Non-retryable error, throw immediately
          throw error;
        }
      }
    }
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

  // Method to wake up the backend (for cold start issues)
  async wakeUpBackend(): Promise<void> {
    try {
      // Try a simple request to wake up the backend
      await this.client.get('/auth/me', { timeout: 45000 });
    } catch (error) {
      // Ignore errors, this is just to wake up the backend
      console.log('Backend wake-up request completed');
    }
  }
}

export const apiClient = new ApiClient();
