/**
 * Custom Error Classes for Trade OS API
 * Provides structured error handling with consistent format
 */

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(400, 'VAL_001', message, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', code: string = 'AUTH_001') {
    super(401, code, message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', code: string = 'AUTH_004') {
    super(403, code, message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'RES_001', `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'RES_002', message);
    this.name = 'ConflictError';
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, code: string = 'BUS_001', details?: Record<string, any>) {
    super(422, code, message, details);
    this.name = 'BusinessRuleError';
  }
}

export class StateTransitionError extends AppError {
  constructor(
    message: string,
    public currentState: string,
    public requestedState: string,
    public allowedTransitions: string[]
  ) {
    super(400, 'VAL_004', message, {
      currentState,
      requestedState,
      allowedTransitions,
    });
    this.name = 'StateTransitionError';
  }
}
