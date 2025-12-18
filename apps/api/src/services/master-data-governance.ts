/**
 * Engine #14: Master Data Governance Engine
 * 
 * Manages lifecycle of master data entities (Products, Customers, Vendors)
 * with approval workflows, data quality rules, and version control.
 * 
 * Per PRD.md: All master data changes must be approved and audited.
 */

import { db } from '@trade-os/database';
import {
  products,
  customers,
  vendors,
  users,
  auditLogs,
} from '@trade-os/database/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { Role } from '@trade-os/types';
import { notificationService } from './notification';

export interface MasterDataApprovalRequest {
  id: string;
  entityType: 'PRODUCT' | 'CUSTOMER' | 'VENDOR';
  entityId: string | null; // null for new entities
  action: 'CREATE' | 'UPDATE' | 'DEACTIVATE';
  proposedData: any;
  requestedBy: string;
  requestedAt: Date;
  approvers: string[]; // User IDs who must approve
  approvals: Array<{
    approverId: string;
    approvedAt: Date;
    decision: 'APPROVED' | 'REJECTED';
    comments?: string;
  }>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  finalApprovedBy?: string;
  finalApprovedAt?: Date;
  organizationId: string;
}

export interface DataQualityRule {
  id: string;
  entityType: 'PRODUCT' | 'CUSTOMER' | 'VENDOR';
  field: string;
  ruleType: 'REQUIRED' | 'FORMAT' | 'RANGE' | 'UNIQUE' | 'CUSTOM';
  validation: any;
  errorMessage: string;
  isActive: boolean;
}

export interface ProductLifecycle {
  productId: string;
  stage: 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE' | 'OBSOLETE';
  stageEnteredAt: Date;
  stageEnteredBy: string;
  reason?: string;
}

/**
 * Master Data Governance Service
 */
export const masterDataGovernanceService = {
  /**
   * Request creation of a new product
   */
  async requestProductCreation(params: {
    productData: {
      name: string;
      sku: string;
      categoryId: string;
      description?: string;
      hsCode?: string;
      specifications?: any;
      unitOfMeasure: string;
      standardCost?: number;
      standardPrice?: number;
    };
    requestedBy: string;
    organizationId: string;
  }): Promise<MasterDataApprovalRequest> {
    // Validate data quality
    const violations = await this.validateDataQuality({
      entityType: 'PRODUCT',
      data: params.productData,
    });

    if (violations.length > 0) {
      throw new Error(`Data quality violations: ${violations.map(v => v.message).join(', ')}`);
    }

    // Check for duplicate SKU
    const existing = await db
      .select()
      .from(products)
      .where(and(
        eq(products.sku, params.productData.sku),
        eq(products.organizationId, params.organizationId),
        eq(products.isDeleted, false)
      ))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Product with SKU ${params.productData.sku} already exists`);
    }

    // Determine approvers based on role hierarchy
    const approvers = await this.getRequiredApprovers({
      entityType: 'PRODUCT',
      action: 'CREATE',
      organizationId: params.organizationId,
    });

    // Create approval request
    const request: MasterDataApprovalRequest = {
      id: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entityType: 'PRODUCT',
      entityId: null,
      action: 'CREATE',
      proposedData: params.productData,
      requestedBy: params.requestedBy,
      requestedAt: new Date(),
      approvers: approvers.map(a => a.id),
      approvals: [],
      status: 'PENDING',
      organizationId: params.organizationId,
    };

    // TODO: Store in approval_requests table (to be created)
    // For now, we'll simulate storage

    // Notify approvers
    for (const approver of approvers) {
      await notificationService.createNotification({
        recipientId: approver.id,
        type: 'MASTER_DATA_APPROVAL',
        priority: 'MEDIUM',
        subject: 'Product Creation Approval Required',
        message: `Product "${params.productData.name}" (SKU: ${params.productData.sku}) requires your approval.`,
        entityType: 'PRODUCT',
        entityId: request.id,
        actionUrl: `/admin/approvals/${request.id}`,
        organizationId: params.organizationId,
        createdBy: params.requestedBy,
      });
    }

    return request;
  },

  /**
   * Approve or reject a master data request
   */
  async processApproval(params: {
    requestId: string;
    approverId: string;
    decision: 'APPROVED' | 'REJECTED';
    comments?: string;
    organizationId: string;
  }): Promise<MasterDataApprovalRequest> {
    // TODO: Load request from database
    // For now, simulated

    // Validate approver is in the list
    // Record approval decision
    // Check if all approvals are complete
    // If approved by all, execute the proposed change
    // If rejected by any, mark as rejected

    throw new Error('Not fully implemented - requires approval_requests table');
  },

  /**
   * Validate data quality rules
   */
  async validateDataQuality(params: {
    entityType: 'PRODUCT' | 'CUSTOMER' | 'VENDOR';
    data: any;
  }): Promise<Array<{ field: string; message: string }>> {
    const violations: Array<{ field: string; message: string }> = [];

    // Get active rules for entity type
    const rules = await this.getDataQualityRules(params.entityType);

    for (const rule of rules) {
      if (!rule.isActive) continue;

      const value = params.data[rule.field];

      switch (rule.ruleType) {
        case 'REQUIRED':
          if (!value || value === '') {
            violations.push({
              field: rule.field,
              message: rule.errorMessage || `${rule.field} is required`,
            });
          }
          break;

        case 'FORMAT':
          if (value && rule.validation.pattern) {
            const regex = new RegExp(rule.validation.pattern);
            if (!regex.test(value)) {
              violations.push({
                field: rule.field,
                message: rule.errorMessage || `${rule.field} has invalid format`,
              });
            }
          }
          break;

        case 'RANGE':
          if (value !== undefined && rule.validation) {
            const num = Number(value);
            if (rule.validation.min !== undefined && num < rule.validation.min) {
              violations.push({
                field: rule.field,
                message: rule.errorMessage || `${rule.field} must be >= ${rule.validation.min}`,
              });
            }
            if (rule.validation.max !== undefined && num > rule.validation.max) {
              violations.push({
                field: rule.field,
                message: rule.errorMessage || `${rule.field} must be <= ${rule.validation.max}`,
              });
            }
          }
          break;

        case 'UNIQUE':
          // Check uniqueness in database
          // TODO: Implement uniqueness check
          break;
      }
    }

    return violations;
  },

  /**
   * Get data quality rules for entity type
   */
  async getDataQualityRules(
    entityType: 'PRODUCT' | 'CUSTOMER' | 'VENDOR'
  ): Promise<DataQualityRule[]> {
    // Default rules for each entity type
    const defaultRules: Record<string, DataQualityRule[]> = {
      PRODUCT: [
        {
          id: 'prod_rule_1',
          entityType: 'PRODUCT',
          field: 'name',
          ruleType: 'REQUIRED',
          validation: {},
          errorMessage: 'Product name is required',
          isActive: true,
        },
        {
          id: 'prod_rule_2',
          entityType: 'PRODUCT',
          field: 'sku',
          ruleType: 'REQUIRED',
          validation: {},
          errorMessage: 'SKU is required',
          isActive: true,
        },
        {
          id: 'prod_rule_3',
          entityType: 'PRODUCT',
          field: 'sku',
          ruleType: 'UNIQUE',
          validation: {},
          errorMessage: 'SKU must be unique',
          isActive: true,
        },
        {
          id: 'prod_rule_4',
          entityType: 'PRODUCT',
          field: 'unitOfMeasure',
          ruleType: 'REQUIRED',
          validation: {},
          errorMessage: 'Unit of measure is required',
          isActive: true,
        },
      ],
      CUSTOMER: [
        {
          id: 'cust_rule_1',
          entityType: 'CUSTOMER',
          field: 'name',
          ruleType: 'REQUIRED',
          validation: {},
          errorMessage: 'Customer name is required',
          isActive: true,
        },
        {
          id: 'cust_rule_2',
          entityType: 'CUSTOMER',
          field: 'email',
          ruleType: 'FORMAT',
          validation: { pattern: '^[^@]+@[^@]+\\.[^@]+$' },
          errorMessage: 'Valid email is required',
          isActive: true,
        },
        {
          id: 'cust_rule_3',
          entityType: 'CUSTOMER',
          field: 'taxId',
          ruleType: 'REQUIRED',
          validation: {},
          errorMessage: 'Tax ID/GSTIN is required',
          isActive: true,
        },
      ],
      VENDOR: [
        {
          id: 'vend_rule_1',
          entityType: 'VENDOR',
          field: 'name',
          ruleType: 'REQUIRED',
          validation: {},
          errorMessage: 'Vendor name is required',
          isActive: true,
        },
        {
          id: 'vend_rule_2',
          entityType: 'VENDOR',
          field: 'email',
          ruleType: 'FORMAT',
          validation: { pattern: '^[^@]+@[^@]+\\.[^@]+$' },
          errorMessage: 'Valid email is required',
          isActive: true,
        },
        {
          id: 'vend_rule_3',
          entityType: 'VENDOR',
          field: 'taxId',
          ruleType: 'REQUIRED',
          validation: {},
          errorMessage: 'Tax ID/GSTIN is required',
          isActive: true,
        },
      ],
    };

    return defaultRules[entityType] || [];
  },

  /**
   * Get required approvers for a master data change
   */
  async getRequiredApprovers(params: {
    entityType: 'PRODUCT' | 'CUSTOMER' | 'VENDOR';
    action: 'CREATE' | 'UPDATE' | 'DEACTIVATE';
    organizationId: string;
  }): Promise<Array<{ id: string; name: string; role: Role }>> {
    // Approval hierarchy:
    // - Product: HEAD_TECH (create), DIRECTOR (deactivate)
    // - Customer: HEAD_SALES (create), DIRECTOR (deactivate)
    // - Vendor: HEAD_PROCUREMENT (create), DIRECTOR (deactivate)

    const approverRoles: Record<string, Record<string, Role[]>> = {
      PRODUCT: {
        CREATE: [Role.HEAD_TECH],
        UPDATE: [Role.HEAD_TECH],
        DEACTIVATE: [Role.DIRECTOR],
      },
      CUSTOMER: {
        CREATE: [Role.HEAD_SALES],
        UPDATE: [Role.HEAD_SALES],
        DEACTIVATE: [Role.DIRECTOR],
      },
      VENDOR: {
        CREATE: [Role.HEAD_PROCUREMENT],
        UPDATE: [Role.HEAD_PROCUREMENT],
        DEACTIVATE: [Role.DIRECTOR],
      },
    };

    const roles = approverRoles[params.entityType][params.action] || [];

    // Get users with these roles
    const approvers = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
      })
      .from(users)
      .where(and(
        eq(users.organizationId, params.organizationId),
        eq(users.isActive, true),
        sql`${users.role} = ANY(${roles})`
      ));

    return approvers as Array<{ id: string; name: string; role: Role }>;
  },

  /**
   * Manage product lifecycle
   */
  async transitionProductLifecycle(params: {
    productId: string;
    targetStage: 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE' | 'OBSOLETE';
    reason?: string;
    userId: string;
    organizationId: string;
  }): Promise<ProductLifecycle> {
    // Validate transition is allowed
    // Update product status
    // Record in lifecycle history
    // Notify stakeholders

    const product = await db
      .select()
      .from(products)
      .where(and(
        eq(products.id, params.productId),
        eq(products.organizationId, params.organizationId)
      ))
      .limit(1);

    if (product.length === 0) {
      throw new Error('Product not found');
    }

    // Update product status
    await db
      .update(products)
      .set({
        isActive: params.targetStage === 'ACTIVE',
        updatedBy: params.userId,
        updatedAt: new Date(),
      })
      .where(eq(products.id, params.productId));

    // Record lifecycle transition
    const lifecycle: ProductLifecycle = {
      productId: params.productId,
      stage: params.targetStage,
      stageEnteredAt: new Date(),
      stageEnteredBy: params.userId,
      reason: params.reason,
    };

    // TODO: Store in product_lifecycle_history table

    return lifecycle;
  },

  /**
   * Bulk import products with validation
   */
  async bulkImportProducts(params: {
    products: Array<any>;
    validateOnly: boolean;
    userId: string;
    organizationId: string;
  }): Promise<{
    valid: number;
    invalid: number;
    errors: Array<{ row: number; errors: string[] }>;
    imported?: number;
  }> {
    const errors: Array<{ row: number; errors: string[] }> = [];
    let validCount = 0;
    let importedCount = 0;

    for (let i = 0; i < params.products.length; i++) {
      const productData = params.products[i];
      const rowErrors: string[] = [];

      // Validate data quality
      const violations = await this.validateDataQuality({
        entityType: 'PRODUCT',
        data: productData,
      });

      if (violations.length > 0) {
        rowErrors.push(...violations.map(v => v.message));
      }

      if (rowErrors.length > 0) {
        errors.push({ row: i + 1, errors: rowErrors });
      } else {
        validCount++;

        // Import if not validate-only mode
        if (!params.validateOnly) {
          try {
            await db.insert(products).values({
              organizationId: params.organizationId,
              ...productData,
              isActive: false, // Requires approval
              createdBy: params.userId,
              updatedBy: params.userId,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            importedCount++;
          } catch (error: any) {
            errors.push({ row: i + 1, errors: [error.message] });
          }
        }
      }
    }

    return {
      valid: validCount,
      invalid: errors.length,
      errors,
      imported: params.validateOnly ? undefined : importedCount,
    };
  },

  /**
   * Get master data audit trail
   */
  async getMasterDataAuditTrail(params: {
    entityType: 'PRODUCT' | 'CUSTOMER' | 'VENDOR';
    entityId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Array<{
    timestamp: Date;
    action: string;
    userId: string;
    userName: string;
    changes: any;
  }>> {
    const tableName = {
      PRODUCT: 'products',
      CUSTOMER: 'customers',
      VENDOR: 'vendors',
    }[params.entityType];

    const logs = await db
      .select({
        timestamp: auditLogs.timestamp,
        action: auditLogs.action,
        userId: auditLogs.userId,
        changes: auditLogs.changes,
      })
      .from(auditLogs)
      .where(and(
        eq(auditLogs.tableName, tableName),
        eq(auditLogs.recordId, params.entityId),
        params.startDate ? sql`${auditLogs.timestamp} >= ${params.startDate}` : undefined,
        params.endDate ? sql`${auditLogs.timestamp} <= ${params.endDate}` : undefined
      ))
      .orderBy(desc(auditLogs.timestamp));

    // Enrich with user names
    // TODO: Join with users table

    return logs as any;
  },
};
