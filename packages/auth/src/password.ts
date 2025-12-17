/**
 * Password Hashing and Validation
 * Per PRD.md: Password policies with bcrypt
 */

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Hash a plain text password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Password strength validation
 * Per PRD.md: Strong password requirements
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Minimum length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Maximum length (prevent DoS)
  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }

  // Require uppercase
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Require lowercase
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Require number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Require special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if password is in common password list (basic check)
 */
export function isCommonPassword(password: string): boolean {
  const common = [
    'password', 'Password123', '12345678', 'qwerty', 'abc123',
    'password123', 'Password1', 'admin', 'letmein', 'welcome',
  ];
  return common.includes(password);
}
