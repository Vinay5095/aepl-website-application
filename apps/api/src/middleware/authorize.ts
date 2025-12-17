/**
 * Authorization Middleware
 * Checks if authenticated user has permission to perform the requested action
 */

import { Request, Response, NextFunction } from 'express';
import { Role } from '@trade-os/types';
import { checkPermission } from '@trade-os/auth';
import { AuthorizationError } from '../utils/errors';

/**
 * Middleware to authorize user based on allowed roles
 */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // User should be attached by authenticate middleware
      if (!req.user) {
        throw new AuthorizationError('User not authenticated');
      }

      // Check if user's role is in allowed roles
      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
        throw new AuthorizationError(
          `Role ${req.user.role} is not authorized to perform this action`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to authorize user for specific permission
 */
export function authorizePermission(resource: string, action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('User not authenticated');
      }

      const hasPermission = checkPermission(req.user.role, resource, action);
      if (!hasPermission) {
        throw new AuthorizationError(
          `Role ${req.user.role} does not have ${action} permission on ${resource}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
