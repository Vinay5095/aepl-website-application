/**
 * Type definitions for state machine engine
 */

import { Role } from '@trade-os/types';

/**
 * Validation rule for state transitions
 */
export interface ValidationRule {
  type: string;
  message: string;
  params?: Record<string, any>;
}

/**
 * Side effect to execute after transition
 */
export interface SideEffect {
  type: 'NOTIFY' | 'START_SLA' | 'STOP_SLA' | 'CREATE' | 'UPDATE';
  targets?: string[];
  duration?: string;
  params?: Record<string, any>;
}

/**
 * State transition definition
 */
export interface StateTransition<TState = string> {
  from: TState;
  to: TState;
  allowedRoles: Role[];
  requiredFields: string[];
  validations: ValidationRule[];
  sideEffects: SideEffect[];
  auditReason: boolean; // Whether reason is required
  autoTransition: boolean; // Whether this is an automatic transition
}

/**
 * Transition validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Transition execution context
 */
export interface TransitionContext {
  userId: string;
  userRole: Role;
  itemId: string;
  reason?: string;
  approvalNotes?: string;
  attachments?: string[];
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Transition execution result
 */
export interface TransitionResult {
  success: boolean;
  newState?: string;
  errors?: string[];
  sideEffectsExecuted?: {
    type: string;
    success: boolean;
    details?: any;
  }[];
}
