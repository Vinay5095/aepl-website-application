/**
 * Session Management
 * Tracks active sessions, login attempts, account locking
 */

export interface Session {
  userId: string;
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Session store (in-memory for now, should be Redis in production)
 */
class SessionStore {
  private sessions: Map<string, Session> = new Map();
  private loginAttempts: Map<string, { count: number; lastAttempt: Date }> = new Map();

  /**
   * Create new session
   */
  createSession(session: Session): void {
    this.sessions.set(session.sessionId, session);
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) return null;
    
    // Check if expired
    if (session.expiresAt < new Date()) {
      this.sessions.delete(sessionId);
      return null;
    }
    
    return session;
  }

  /**
   * Delete session (logout)
   */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Delete all sessions for user (logout all devices)
   */
  deleteUserSessions(userId: string): void {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Get all sessions for user
   */
  getUserSessions(userId: string): Session[] {
    const sessions: Session[] = [];
    
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.expiresAt >= new Date()) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }

  /**
   * Record failed login attempt
   */
  recordFailedLogin(email: string): void {
    const attempts = this.loginAttempts.get(email) || { count: 0, lastAttempt: new Date() };
    
    this.loginAttempts.set(email, {
      count: attempts.count + 1,
      lastAttempt: new Date(),
    });
  }

  /**
   * Clear login attempts (after successful login)
   */
  clearLoginAttempts(email: string): void {
    this.loginAttempts.delete(email);
  }

  /**
   * Check if account is locked
   * Lock after 5 failed attempts within 15 minutes
   */
  isAccountLocked(email: string): boolean {
    const attempts = this.loginAttempts.get(email);
    
    if (!attempts) return false;
    
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    // If last attempt was more than 15 minutes ago, reset
    if (attempts.lastAttempt < fifteenMinutesAgo) {
      this.loginAttempts.delete(email);
      return false;
    }
    
    // Lock if 5 or more attempts within 15 minutes
    return attempts.count >= 5;
  }

  /**
   * Get lock remaining time in minutes
   */
  getLockRemainingMinutes(email: string): number {
    const attempts = this.loginAttempts.get(email);
    
    if (!attempts) return 0;
    
    const lockExpiry = new Date(attempts.lastAttempt.getTime() + 15 * 60 * 1000);
    const now = new Date();
    
    if (lockExpiry <= now) return 0;
    
    return Math.ceil((lockExpiry.getTime() - now.getTime()) / 60000);
  }

  /**
   * Clean up expired sessions (should run periodically)
   */
  cleanupExpiredSessions(): number {
    let cleaned = 0;
    const now = new Date();
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }
    
    return cleaned;
  }
}

// Singleton instance
export const sessionStore = new SessionStore();

// Cleanup expired sessions every hour
setInterval(() => {
  const cleaned = sessionStore.cleanupExpiredSessions();
  if (cleaned > 0) {
    console.log(`[Session] Cleaned up ${cleaned} expired sessions`);
  }
}, 60 * 60 * 1000);
