/**
 * Engine #18: Multi-Entity & Legal Structure Engine
 * 
 * Manages multiple legal entities, inter-company transactions,
 * legal entity isolation, and cross-entity reporting.
 * 
 * Per PRD.md: Support multi-company operations with proper isolation.
 */

import { db } from '@trade-os/database';
import {
  organizations,
  legalEntities,
  orders,
  orderItems,
  rfqs,
  rfqItems,
  auditLogs,
} from '@trade-os/database/schema';
import { eq, and, or, inArray, sql, desc } from 'drizzle-orm';
import { Role } from '@trade-os/types';

export interface InterCompanyTransaction {
  id: string;
  transactionType: 'SALE' | 'PURCHASE' | 'TRANSFER';
  sourceEntityId: string;
  targetEntityId: string;
  orderItemId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'CONFIRMED' | 'RECONCILED' | 'CANCELLED';
  createdAt: Date;
  reconciledAt?: Date;
}

export interface LegalEntityConfig {
  entityId: string;
  name: string;
  taxId: string;
  country: string;
  isActive: boolean;
  // Permissions and access controls
  canTrade: boolean;
  canProcure: boolean;
  canSell: boolean;
  // Transfer pricing settings
  useTransferPricing: boolean;
  transferPricingMethod?: 'COST_PLUS' | 'RESALE_MINUS' | 'COMPARABLE_UNCONTROLLED_PRICE';
  transferPricingMargin?: number;
}

/**
 * Multi-Entity Service
 */
export const multiEntityService = {
  /**
   * Get all legal entities for an organization
   */
  async getLegalEntities(organizationId: string): Promise<LegalEntityConfig[]> {
    const entities = await db
      .select()
      .from(legalEntities)
      .where(and(
        eq(legalEntities.organizationId, organizationId),
        eq(legalEntities.isDeleted, false)
      ))
      .orderBy(legalEntities.name);

    return entities.map(e => ({
      entityId: e.id,
      name: e.name,
      taxId: e.taxId,
      country: e.country,
      isActive: e.isActive,
      canTrade: true,
      canProcure: true,
      canSell: true,
      useTransferPricing: false,
    }));
  },

  /**
   * Create inter-company transaction
   * When an order involves multiple legal entities
   */
  async createInterCompanyTransaction(params: {
    transactionType: 'SALE' | 'PURCHASE' | 'TRANSFER';
    sourceEntityId: string;
    targetEntityId: string;
    orderItemId: string;
    amount: number;
    currency: string;
    organizationId: string;
    createdBy: string;
  }): Promise<InterCompanyTransaction> {
    // Validate both entities belong to same organization
    const entities = await db
      .select()
      .from(legalEntities)
      .where(and(
        inArray(legalEntities.id, [params.sourceEntityId, params.targetEntityId]),
        eq(legalEntities.organizationId, params.organizationId)
      ));

    if (entities.length !== 2) {
      throw new Error('Invalid legal entities or not in same organization');
    }

    // Create transaction record
    const transaction: InterCompanyTransaction = {
      id: `ict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      transactionType: params.transactionType,
      sourceEntityId: params.sourceEntityId,
      targetEntityId: params.targetEntityId,
      orderItemId: params.orderItemId,
      amount: params.amount,
      currency: params.currency,
      status: 'PENDING',
      createdAt: new Date(),
    };

    // TODO: Store in inter_company_transactions table
    // For now, return the object

    // If transfer pricing is enabled, calculate and apply markup
    if (params.transactionType === 'TRANSFER') {
      await this.applyTransferPricing({
        transactionId: transaction.id,
        sourceEntityId: params.sourceEntityId,
        targetEntityId: params.targetEntityId,
        baseAmount: params.amount,
      });
    }

    return transaction;
  },

  /**
   * Apply transfer pricing rules
   */
  async applyTransferPricing(params: {
    transactionId: string;
    sourceEntityId: string;
    targetEntityId: string;
    baseAmount: number;
  }): Promise<{
    baseAmount: number;
    markup: number;
    transferPrice: number;
    method: string;
  }> {
    // Get transfer pricing config for source entity
    // Apply appropriate markup based on method
    // Calculate final transfer price

    const markup = params.baseAmount * 0.10; // 10% default markup
    const transferPrice = params.baseAmount + markup;

    return {
      baseAmount: params.baseAmount,
      markup,
      transferPrice,
      method: 'COST_PLUS',
    };
  },

  /**
   * Reconcile inter-company transaction
   * Both sides must confirm for reconciliation
   */
  async reconcileTransaction(params: {
    transactionId: string;
    confirmedBy: string;
    organizationId: string;
  }): Promise<InterCompanyTransaction> {
    // Load transaction
    // Mark as reconciled
    // Create accounting entries on both sides
    // Update status

    throw new Error('Not fully implemented - requires inter_company_transactions table');
  },

  /**
   * Get inter-company transactions for reporting
   */
  async getInterCompanyTransactions(params: {
    organizationId: string;
    entityId?: string;
    status?: 'PENDING' | 'CONFIRMED' | 'RECONCILED' | 'CANCELLED';
    startDate?: Date;
    endDate?: Date;
  }): Promise<InterCompanyTransaction[]> {
    // Query inter-company transactions with filters
    // Return list

    // TODO: Implement actual query
    return [];
  },

  /**
   * Validate entity isolation
   * Ensures users can only access data from their assigned entities
   */
  async validateEntityAccess(params: {
    userId: string;
    entityId: string;
    organizationId: string;
  }): Promise<boolean> {
    // Check if user has access to this entity
    // Users with certain roles (DIRECTOR, MD, ADMIN) have access to all entities
    // Other users only see their assigned entity

    // TODO: Implement user-entity assignment table and check
    // For now, return true (no isolation)
    return true;
  },

  /**
   * Get cross-entity report
   * Consolidated view across multiple entities
   */
  async getCrossEntityReport(params: {
    organizationId: string;
    entityIds: string[];
    reportType: 'SALES' | 'PURCHASES' | 'INVENTORY' | 'PROFITABILITY';
    startDate: Date;
    endDate: Date;
  }): Promise<{
    summary: any;
    byEntity: Array<{
      entityId: string;
      entityName: string;
      metrics: any;
    }>;
  }> {
    const entities = await this.getLegalEntities(params.organizationId);
    const filteredEntities = entities.filter(e => params.entityIds.includes(e.entityId));

    const byEntity: Array<{
      entityId: string;
      entityName: string;
      metrics: any;
    }> = [];

    for (const entity of filteredEntities) {
      let metrics = {};

      switch (params.reportType) {
        case 'SALES':
          metrics = await this.getSalesMetrics({
            entityId: entity.entityId,
            startDate: params.startDate,
            endDate: params.endDate,
          });
          break;

        case 'PURCHASES':
          metrics = await this.getPurchaseMetrics({
            entityId: entity.entityId,
            startDate: params.startDate,
            endDate: params.endDate,
          });
          break;

        case 'INVENTORY':
          metrics = await this.getInventoryMetrics({
            entityId: entity.entityId,
          });
          break;

        case 'PROFITABILITY':
          metrics = await this.getProfitabilityMetrics({
            entityId: entity.entityId,
            startDate: params.startDate,
            endDate: params.endDate,
          });
          break;
      }

      byEntity.push({
        entityId: entity.entityId,
        entityName: entity.name,
        metrics,
      });
    }

    // Calculate summary across all entities
    const summary = this.aggregateMetrics(byEntity.map(e => e.metrics));

    return {
      summary,
      byEntity,
    };
  },

  /**
   * Get sales metrics for an entity
   */
  async getSalesMetrics(params: {
    entityId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<{
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
  }> {
    const result = await db
      .select({
        count: sql<number>`count(distinct ${orders.id})`,
        revenue: sql<number>`sum(${orderItems.totalAmount})`,
      })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(and(
        eq(orders.legalEntityId, params.entityId),
        sql`${orders.orderDate} >= ${params.startDate}`,
        sql`${orders.orderDate} <= ${params.endDate}`,
        eq(orders.isDeleted, false)
      ));

    const totalOrders = Number(result[0]?.count || 0);
    const totalRevenue = Number(result[0]?.revenue || 0);

    return {
      totalOrders,
      totalRevenue,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    };
  },

  /**
   * Get purchase metrics for an entity
   */
  async getPurchaseMetrics(params: {
    entityId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<{
    totalPurchases: number;
    totalCost: number;
    averagePurchaseValue: number;
  }> {
    // Similar to sales metrics but for purchases
    // TODO: Implement purchase order tracking

    return {
      totalPurchases: 0,
      totalCost: 0,
      averagePurchaseValue: 0,
    };
  },

  /**
   * Get inventory metrics for an entity
   */
  async getInventoryMetrics(params: {
    entityId: string;
  }): Promise<{
    totalSKUs: number;
    totalQuantity: number;
    totalValue: number;
  }> {
    // TODO: Implement inventory tracking per entity

    return {
      totalSKUs: 0,
      totalQuantity: 0,
      totalValue: 0,
    };
  },

  /**
   * Get profitability metrics for an entity
   */
  async getProfitabilityMetrics(params: {
    entityId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<{
    revenue: number;
    cost: number;
    grossProfit: number;
    grossMargin: number;
  }> {
    const sales = await this.getSalesMetrics(params);
    const purchases = await this.getPurchaseMetrics(params);

    const revenue = sales.totalRevenue;
    const cost = purchases.totalCost;
    const grossProfit = revenue - cost;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    return {
      revenue,
      cost,
      grossProfit,
      grossMargin,
    };
  },

  /**
   * Aggregate metrics from multiple entities
   */
  aggregateMetrics(metrics: any[]): any {
    // Sum up common fields
    const aggregate: any = {};

    for (const metric of metrics) {
      for (const [key, value] of Object.entries(metric)) {
        if (typeof value === 'number') {
          aggregate[key] = (aggregate[key] || 0) + value;
        }
      }
    }

    return aggregate;
  },

  /**
   * Create legal entity
   */
  async createLegalEntity(params: {
    organizationId: string;
    name: string;
    legalName: string;
    taxId: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    phone?: string;
    email?: string;
    createdBy: string;
  }): Promise<{ id: string }> {
    const [entity] = await db
      .insert(legalEntities)
      .values({
        organizationId: params.organizationId,
        name: params.name,
        legalName: params.legalName,
        taxId: params.taxId,
        addressLine1: params.addressLine1,
        addressLine2: params.addressLine2,
        city: params.city,
        state: params.state,
        country: params.country,
        postalCode: params.postalCode,
        phone: params.phone,
        email: params.email,
        isActive: true,
        isDeleted: false,
        createdBy: params.createdBy,
        updatedBy: params.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: legalEntities.id });

    return entity;
  },

  /**
   * Update legal entity
   */
  async updateLegalEntity(params: {
    entityId: string;
    updates: Partial<{
      name: string;
      legalName: string;
      taxId: string;
      addressLine1: string;
      city: string;
      state: string;
      country: string;
      postalCode: string;
      phone: string;
      email: string;
      isActive: boolean;
    }>;
    updatedBy: string;
  }): Promise<void> {
    await db
      .update(legalEntities)
      .set({
        ...params.updates,
        updatedBy: params.updatedBy,
        updatedAt: new Date(),
      })
      .where(eq(legalEntities.id, params.entityId));
  },
};
