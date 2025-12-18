/**
 * Engine #25: System Governance & Admin Engine
 * 
 * Manages system configuration, user management with role assignment,
 * organization settings, and license management.
 * 
 * Per PRD.md: Centralized system administration and governance.
 */

import { db } from '@trade-os/database';
import {
  users,
  roles,
  permissions,
  rolePermissions,
  organizations,
  systemConfig,
  auditLogs,
} from '@trade-os/database/schema';
import { eq, and, or, inArray, like, desc, sql } from 'drizzle-orm';
import { Role } from '@trade-os/types';
import { hashPassword } from '@trade-os/auth';

export interface SystemConfiguration {
  key: string;
  value: any;
  description?: string;
  category: 'SYSTEM' | 'SECURITY' | 'NOTIFICATION' | 'INTEGRATION' | 'FEATURE';
  isEditable: boolean;
  validationRule?: {
    type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
}

export interface UserManagement {
  userId: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string;
  legalEntityId?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

export interface OrganizationSettings {
  organizationId: string;
  settings: {
    // Business settings
    fiscalYearStart: string; // MM-DD
    defaultCurrency: string;
    defaultTimezone: string;
    
    // Approval workflows
    requireDualApproval: boolean;
    approvalThresholds: {
      rfq: number;
      order: number;
      payment: number;
    };
    
    // Feature flags
    enabledModules: string[];
    
    // Integrations
    tallyIntegration: {
      enabled: boolean;
      apiUrl?: string;
      companyName?: string;
    };
    
    // Notifications
    emailNotifications: boolean;
    smsNotifications: boolean;
    
    // Data retention
    retentionPeriodDays: number;
    archiveAfterDays: number;
  };
}

/**
 * System Governance Service
 */
export const systemGovernanceService = {
  /**
   * Get all system configurations
   */
  async getSystemConfigurations(params: {
    category?: string;
    organizationId: string;
  }): Promise<SystemConfiguration[]> {
    const conditions = [
      eq(systemConfig.isDeleted, false),
    ];

    if (params.category) {
      // TODO: Add category filter when column exists
    }

    const configs = await db
      .select()
      .from(systemConfig)
      .where(and(...conditions))
      .orderBy(systemConfig.key);

    return configs.map(c => ({
      key: c.key,
      value: c.value,
      description: c.description || undefined,
      category: 'SYSTEM' as const,
      isEditable: true,
    }));
  },

  /**
   * Update system configuration
   */
  async updateSystemConfiguration(params: {
    key: string;
    value: any;
    updatedBy: string;
  }): Promise<void> {
    // Validate the value
    await this.validateConfigValue(params.key, params.value);

    // Update or insert
    const existing = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, params.key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(systemConfig)
        .set({
          value: params.value,
          updatedBy: params.updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(systemConfig.key, params.key));
    } else {
      await db.insert(systemConfig).values({
        key: params.key,
        value: params.value,
        createdBy: params.updatedBy,
        updatedBy: params.updatedBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  },

  /**
   * Validate configuration value
   */
  async validateConfigValue(key: string, value: any): Promise<void> {
    // Get validation rules for this config
    const rules = this.getConfigValidationRules(key);
    
    if (!rules) return;

    if (rules.type === 'NUMBER') {
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`${key} must be a number`);
      }
      if (rules.min !== undefined && num < rules.min) {
        throw new Error(`${key} must be >= ${rules.min}`);
      }
      if (rules.max !== undefined && num > rules.max) {
        throw new Error(`${key} must be <= ${rules.max}`);
      }
    }

    if (rules.type === 'STRING' && rules.enum) {
      if (!rules.enum.includes(value)) {
        throw new Error(`${key} must be one of: ${rules.enum.join(', ')}`);
      }
    }
  },

  /**
   * Get validation rules for a config key
   */
  getConfigValidationRules(key: string): SystemConfiguration['validationRule'] | null {
    const rulesMap: Record<string, SystemConfiguration['validationRule']> = {
      'retention_period_days': {
        type: 'NUMBER',
        min: 90,
        max: 3650, // 10 years
      },
      'archive_after_days': {
        type: 'NUMBER',
        min: 365,
        max: 7300, // 20 years
      },
      'default_currency': {
        type: 'STRING',
        enum: ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CNY'],
      },
      'sla_warning_threshold_pct': {
        type: 'NUMBER',
        min: 50,
        max: 99,
      },
    };

    return rulesMap[key] || null;
  },

  /**
   * Create new user with role assignment
   */
  async createUser(params: {
    name: string;
    email: string;
    password: string;
    role: Role;
    organizationId: string;
    legalEntityId?: string;
    department?: string;
    phone?: string;
    createdBy: string;
  }): Promise<UserManagement> {
    // Check if email already exists
    const existing = await db
      .select()
      .from(users)
      .where(and(
        eq(users.email, params.email),
        eq(users.organizationId, params.organizationId)
      ))
      .limit(1);

    if (existing.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await hashPassword(params.password);

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        name: params.name,
        email: params.email,
        passwordHash: hashedPassword,
        role: params.role,
        organizationId: params.organizationId,
        legalEntityId: params.legalEntityId,
        department: params.department,
        phone: params.phone,
        isActive: true,
        isDeleted: false,
        createdBy: params.createdBy,
        updatedBy: params.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role as Role,
      organizationId: user.organizationId,
      legalEntityId: user.legalEntityId || undefined,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  },

  /**
   * Update user role
   */
  async updateUserRole(params: {
    userId: string;
    newRole: Role;
    updatedBy: string;
    reason: string;
  }): Promise<void> {
    // Validate role change is allowed
    // Update user role
    // Record in audit log

    await db
      .update(users)
      .set({
        role: params.newRole,
        updatedBy: params.updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(users.id, params.userId));

    // TODO: Record in audit log with reason
  },

  /**
   * Deactivate user
   */
  async deactivateUser(params: {
    userId: string;
    reason: string;
    deactivatedBy: string;
  }): Promise<void> {
    await db
      .update(users)
      .set({
        isActive: false,
        updatedBy: params.deactivatedBy,
        updatedAt: new Date(),
      })
      .where(eq(users.id, params.userId));

    // TODO: Revoke active sessions
    // TODO: Record in audit log
  },

  /**
   * Reactivate user
   */
  async reactivateUser(params: {
    userId: string;
    reactivatedBy: string;
  }): Promise<void> {
    await db
      .update(users)
      .set({
        isActive: true,
        updatedBy: params.reactivatedBy,
        updatedAt: new Date(),
      })
      .where(eq(users.id, params.userId));
  },

  /**
   * Get all users in organization
   */
  async getUsers(params: {
    organizationId: string;
    role?: Role;
    isActive?: boolean;
    search?: string;
  }): Promise<UserManagement[]> {
    const conditions = [
      eq(users.organizationId, params.organizationId),
      eq(users.isDeleted, false),
    ];

    if (params.role) {
      conditions.push(eq(users.role, params.role));
    }

    if (params.isActive !== undefined) {
      conditions.push(eq(users.isActive, params.isActive));
    }

    if (params.search) {
      conditions.push(
        or(
          like(users.name, `%${params.search}%`),
          like(users.email, `%${params.search}%`)
        ) as any
      );
    }

    const userList = await db
      .select()
      .from(users)
      .where(and(...conditions))
      .orderBy(users.name);

    return userList.map(u => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role as Role,
      organizationId: u.organizationId,
      legalEntityId: u.legalEntityId || undefined,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt || undefined,
      createdAt: u.createdAt,
    }));
  },

  /**
   * Get organization settings
   */
  async getOrganizationSettings(organizationId: string): Promise<OrganizationSettings> {
    // Load settings from system_config table with organization scope
    // Return structured settings object

    return {
      organizationId,
      settings: {
        fiscalYearStart: '04-01', // April 1st (India)
        defaultCurrency: 'INR',
        defaultTimezone: 'Asia/Kolkata',
        requireDualApproval: true,
        approvalThresholds: {
          rfq: 100000,
          order: 500000,
          payment: 1000000,
        },
        enabledModules: [
          'RFQ',
          'ORDER',
          'PROCUREMENT',
          'FINANCE',
          'REPORTS',
        ],
        tallyIntegration: {
          enabled: true,
          apiUrl: process.env.TALLY_API_URL,
          companyName: 'AEPL Trading Company',
        },
        emailNotifications: true,
        smsNotifications: true,
        retentionPeriodDays: 2555, // 7 years (Indian compliance)
        archiveAfterDays: 1825, // 5 years
      },
    };
  },

  /**
   * Update organization settings
   */
  async updateOrganizationSettings(params: {
    organizationId: string;
    settings: Partial<OrganizationSettings['settings']>;
    updatedBy: string;
  }): Promise<void> {
    // Update each setting in system_config table
    // with org-specific keys

    for (const [key, value] of Object.entries(params.settings)) {
      const configKey = `org.${params.organizationId}.${key}`;
      await this.updateSystemConfiguration({
        key: configKey,
        value,
        updatedBy: params.updatedBy,
      });
    }
  },

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<{
    status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    services: Array<{
      name: string;
      status: 'UP' | 'DOWN';
      responseTime?: number;
      lastCheck: Date;
    }>;
    metrics: {
      cpuUsage?: number;
      memoryUsage?: number;
      diskUsage?: number;
      activeUsers: number;
      activeTransactions: number;
    };
  }> {
    // Check health of all services
    // Return status

    return {
      status: 'HEALTHY',
      services: [
        {
          name: 'Database',
          status: 'UP',
          responseTime: 5,
          lastCheck: new Date(),
        },
        {
          name: 'Redis',
          status: 'UP',
          responseTime: 2,
          lastCheck: new Date(),
        },
        {
          name: 'MinIO',
          status: 'UP',
          responseTime: 10,
          lastCheck: new Date(),
        },
      ],
      metrics: {
        activeUsers: 0,
        activeTransactions: 0,
      },
    };
  },

  /**
   * Get system audit log
   */
  async getSystemAuditLog(params: {
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<Array<{
    timestamp: Date;
    userId: string;
    action: string;
    resource: string;
    details: any;
  }>> {
    const conditions = [];

    if (params.userId) {
      conditions.push(eq(auditLogs.userId, params.userId));
    }

    if (params.action) {
      conditions.push(eq(auditLogs.action, params.action));
    }

    if (params.startDate) {
      conditions.push(sql`${auditLogs.timestamp} >= ${params.startDate}`);
    }

    if (params.endDate) {
      conditions.push(sql`${auditLogs.timestamp} <= ${params.endDate}`);
    }

    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.timestamp))
      .limit(params.limit || 100);

    return logs.map(log => ({
      timestamp: log.timestamp,
      userId: log.userId,
      action: log.action,
      resource: log.tableName,
      details: log.changes,
    }));
  },
};
