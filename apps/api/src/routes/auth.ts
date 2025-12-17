/**
 * Authentication Routes
 * Login, logout, token refresh, MFA
 */

import { Router } from 'express';
import { z } from 'zod';
import { db, users, roles } from '@trade-os/database';
import { 
  verifyPassword, 
  generateTokenPair, 
  verifyRefreshToken,
  generateMfaSecret,
  generateMfaQrCode,
  verifyMfaToken,
  sessionStore,
} from '@trade-os/auth';
import { asyncHandler, AppError } from '../middleware/error';
import { AuthRequest, authenticate } from '../middleware/auth';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router: Router = Router();

/**
 * Login validation schema
 */
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  mfaToken: z.string().optional(),
});

/**
 * POST /api/v1/auth/login
 * User login with password and optional MFA
 */
router.post('/login', asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body);

  // Check if account is locked
  if (sessionStore.isAccountLocked(body.email)) {
    const minutes = sessionStore.getLockRemainingMinutes(body.email);
    throw new AppError(
      'ACCOUNT_LOCKED',
      `Account locked due to too many failed login attempts. Try again in ${minutes} minutes.`,
      403
    );
  }

  // Find user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email))
    .leftJoin(roles, eq(users.roleId, roles.id));

  if (!user) {
    sessionStore.recordFailedLogin(body.email);
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  // Check if user is active
  if (!user.users.isActive) {
    throw new AppError('ACCOUNT_DISABLED', 'Your account has been disabled', 403);
  }

  // Verify password
  const isValidPassword = await verifyPassword(body.password, user.users.passwordHash);
  
  if (!isValidPassword) {
    sessionStore.recordFailedLogin(body.email);
    throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  // Check MFA if enabled
  if (user.users.mfaEnabled) {
    if (!body.mfaToken) {
      return res.json({
        success: false,
        error: {
          code: 'MFA_REQUIRED',
          message: 'Multi-factor authentication required',
        },
        requiresMfa: true,
      });
    }

    if (!user.users.mfaSecret) {
      throw new AppError('MFA_NOT_CONFIGURED', 'MFA is enabled but not configured', 500);
    }

    const isValidMfa = verifyMfaToken(user.users.mfaSecret, body.mfaToken);
    
    if (!isValidMfa) {
      sessionStore.recordFailedLogin(body.email);
      throw new AppError('INVALID_MFA_TOKEN', 'Invalid MFA token', 401);
    }
  }

  // Clear failed login attempts
  sessionStore.clearLoginAttempts(body.email);

  // Generate tokens
  const tokenPayload = {
    userId: user.users.id,
    email: user.users.email,
    role: user.roles!.code as any,
    organizationId: user.users.organizationId,
    legalEntityId: user.users.legalEntityId || undefined,
  };

  const { accessToken, refreshToken } = generateTokenPair(tokenPayload);

  // Create session
  const sessionId = uuidv4();
  sessionStore.createSession({
    userId: user.users.id,
    sessionId,
    accessToken,
    refreshToken,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Update last login
  await db
    .update(users)
    .set({ 
      lastLoginAt: new Date(),
      loginAttempts: 0,
    })
    .where(eq(users.id, user.users.id));

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      sessionId,
      user: {
        id: user.users.id,
        email: user.users.email,
        firstName: user.users.firstName,
        lastName: user.users.lastName,
        role: user.roles!.code,
        roleName: user.roles!.name,
        organizationId: user.users.organizationId,
      },
    },
  });
}));

/**
 * POST /api/v1/auth/logout
 * Logout current session
 */
router.post('/logout', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const sessionId = req.headers['x-session-id'] as string;
  
  if (sessionId) {
    sessionStore.deleteSession(sessionId);
  }

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
}));

/**
 * POST /api/v1/auth/logout-all
 * Logout all sessions for current user
 */
router.post('/logout-all', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }

  sessionStore.deleteUserSessions(req.user.userId);

  res.json({
    success: true,
    message: 'Logged out from all devices',
  });
}));

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const refreshTokenSchema = z.object({
    refreshToken: z.string(),
  });

  const body = refreshTokenSchema.parse(req.body);

  // Verify refresh token
  const payload = verifyRefreshToken(body.refreshToken);

  // Generate new access token
  const tokenPayload = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    organizationId: payload.organizationId,
    legalEntityId: payload.legalEntityId,
  };

  const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(tokenPayload);

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken: newRefreshToken,
    },
  });
}));

/**
 * GET /api/v1/auth/me
 * Get current user info
 */
router.get('/me', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'User not authenticated', 401);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.user.userId))
    .leftJoin(roles, eq(users.roleId, roles.id));

  if (!user) {
    throw new AppError('USER_NOT_FOUND', 'User not found', 404);
  }

  res.json({
    success: true,
    data: {
      id: user.users.id,
      email: user.users.email,
      firstName: user.users.firstName,
      lastName: user.users.lastName,
      role: user.roles!.code,
      roleName: user.roles!.name,
      organizationId: user.users.organizationId,
      mfaEnabled: user.users.mfaEnabled,
    },
  });
}));

export default router;
