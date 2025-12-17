/**
 * Multi-Factor Authentication (MFA)
 * Per PRD.md Section 13.1: MFA required for Director+ roles
 * Uses TOTP (Time-based One-Time Password)
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

/**
 * Generate MFA secret for user
 */
export function generateMfaSecret(email: string, organizationName: string = 'Trade OS') {
  const secret = speakeasy.generateSecret({
    name: `${organizationName} (${email})`,
    length: 32,
  });

  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url!,
  };
}

/**
 * Generate QR code for MFA setup
 */
export async function generateMfaQrCode(otpauthUrl: string): Promise<string> {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return qrCodeDataUrl;
  } catch (error) {
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Verify MFA token
 */
export function verifyMfaToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1, // Allow 1 step before/after for clock drift
  });
}

/**
 * Generate backup codes (for account recovery)
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = Array.from({ length: 8 }, () => 
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 36)]
    ).join('');
    
    // Format as XXXX-XXXX
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  
  return codes;
}

/**
 * Check if user role requires MFA
 * Per PRD.md: MFA required for Director+ roles
 */
export function requiresMfa(role: string): boolean {
  const mfaRequiredRoles = [
    'MD',
    'DIRECTOR',
    'SUPER_ADMIN',
    'ADMIN',
    'FINANCE_MANAGER',
    'PURCHASE_MANAGER',
    'SALES_MANAGER',
    'COMPLIANCE_MANAGER',
  ];
  
  return mfaRequiredRoles.includes(role);
}
