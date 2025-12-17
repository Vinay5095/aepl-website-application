/**
 * SLA Escalation Service
 * 
 * Handles automatic escalation of SLA warnings and breaches
 * Integrated with notification system for alerts
 */

import { db } from '@trade-os/database';
import { rfqItems, orderItems, notifications } from '@trade-os/database';
import { eq } from 'drizzle-orm';
import { RfqItemState, OrderItemState, Role } from '@trade-os/types';
import { queueNotification } from './notification';

interface EscalationRule {
  state: RfqItemState | OrderItemState;
  warningRoles: Role[];
  breachRoles: Role[];
  escalationRoles?: Role[]; // For critical breaches
}

/**
 * Escalation rules for RFQ items
 */
const RFQ_ESCALATION_RULES: Record<RfqItemState, EscalationRule> = {
  [RfqItemState.DRAFT]: {
    state: RfqItemState.DRAFT,
    warningRoles: [Role.SALES_OFFICER],
    breachRoles: [Role.SALES_MANAGER],
    escalationRoles: [Role.HEAD_SALES],
  },
  [RfqItemState.RFQ_SUBMITTED]: {
    state: RfqItemState.RFQ_SUBMITTED,
    warningRoles: [Role.SALES_OFFICER],
    breachRoles: [Role.SALES_MANAGER],
    escalationRoles: [Role.HEAD_SALES],
  },
  [RfqItemState.SALES_REVIEW]: {
    state: RfqItemState.SALES_REVIEW,
    warningRoles: [Role.SALES_MANAGER],
    breachRoles: [Role.HEAD_SALES],
    escalationRoles: [Role.MANAGING_DIRECTOR],
  },
  [RfqItemState.TECH_REVIEW]: {
    state: RfqItemState.TECH_REVIEW,
    warningRoles: [Role.TECH_OFFICER],
    breachRoles: [Role.TECH_MANAGER],
    escalationRoles: [Role.HEAD_TECH],
  },
  [RfqItemState.TECH_APPROVED]: {
    state: RfqItemState.TECH_APPROVED,
    warningRoles: [Role.SALES_OFFICER],
    breachRoles: [Role.SALES_MANAGER],
  },
  [RfqItemState.COMPLIANCE_REVIEW]: {
    state: RfqItemState.COMPLIANCE_REVIEW,
    warningRoles: [Role.COMPLIANCE_OFFICER],
    breachRoles: [Role.HEAD_COMPLIANCE],
    escalationRoles: [Role.DIRECTOR],
  },
  [RfqItemState.STOCK_CHECK]: {
    state: RfqItemState.STOCK_CHECK,
    warningRoles: [Role.INVENTORY_OFFICER],
    breachRoles: [Role.INVENTORY_MANAGER],
  },
  [RfqItemState.SOURCING]: {
    state: RfqItemState.SOURCING,
    warningRoles: [Role.SOURCING_OFFICER],
    breachRoles: [Role.SOURCING_MANAGER],
    escalationRoles: [Role.HEAD_SOURCING],
  },
  [RfqItemState.VENDOR_QUOTES]: {
    state: RfqItemState.VENDOR_QUOTES,
    warningRoles: [Role.SOURCING_OFFICER],
    breachRoles: [Role.SOURCING_MANAGER],
  },
  [RfqItemState.RATE_FINALIZED]: {
    state: RfqItemState.RATE_FINALIZED,
    warningRoles: [Role.COSTING_ANALYST],
    breachRoles: [Role.FINANCE_MANAGER],
  },
  [RfqItemState.MARGIN_APPROVAL]: {
    state: RfqItemState.MARGIN_APPROVAL,
    warningRoles: [Role.FINANCE_MANAGER],
    breachRoles: [Role.DIRECTOR],
    escalationRoles: [Role.MANAGING_DIRECTOR],
  },
  [RfqItemState.PRICE_FROZEN]: {
    state: RfqItemState.PRICE_FROZEN,
    warningRoles: [Role.SALES_OFFICER],
    breachRoles: [Role.SALES_MANAGER],
  },
  [RfqItemState.QUOTE_SENT]: {
    state: RfqItemState.QUOTE_SENT,
    warningRoles: [Role.SALES_OFFICER],
    breachRoles: [Role.SALES_MANAGER],
    escalationRoles: [Role.HEAD_SALES],
  },
  [RfqItemState.CUSTOMER_ACCEPTED]: {
    state: RfqItemState.CUSTOMER_ACCEPTED,
    warningRoles: [Role.SALES_OFFICER],
    breachRoles: [Role.SALES_MANAGER],
  },
  [RfqItemState.CUSTOMER_REJECTED]: {
    state: RfqItemState.CUSTOMER_REJECTED,
    warningRoles: [],
    breachRoles: [],
  },
  [RfqItemState.RFQ_CLOSED]: {
    state: RfqItemState.RFQ_CLOSED,
    warningRoles: [],
    breachRoles: [],
  },
};

/**
 * Escalation rules for Order items
 */
const ORDER_ESCALATION_RULES: Record<OrderItemState, EscalationRule> = {
  [OrderItemState.PR_CREATED]: {
    state: OrderItemState.PR_CREATED,
    warningRoles: [Role.SALES_OFFICER],
    breachRoles: [Role.SALES_MANAGER],
  },
  [OrderItemState.ACKNOWLEDGED]: {
    state: OrderItemState.ACKNOWLEDGED,
    warningRoles: [Role.OPERATIONS_OFFICER],
    breachRoles: [Role.OPERATIONS_MANAGER],
  },
  [OrderItemState.CREDIT_CHECK]: {
    state: OrderItemState.CREDIT_CHECK,
    warningRoles: [Role.FINANCE_MANAGER],
    breachRoles: [Role.DIRECTOR],
  },
  [OrderItemState.CREDIT_CHECK_APPROVED]: {
    state: OrderItemState.CREDIT_CHECK_APPROVED,
    warningRoles: [Role.OPERATIONS_OFFICER],
    breachRoles: [Role.OPERATIONS_MANAGER],
  },
  [OrderItemState.CREDIT_ON_HOLD]: {
    state: OrderItemState.CREDIT_ON_HOLD,
    warningRoles: [Role.FINANCE_MANAGER],
    breachRoles: [Role.DIRECTOR],
    escalationRoles: [Role.MANAGING_DIRECTOR],
  },
  [OrderItemState.PO_RELEASED]: {
    state: OrderItemState.PO_RELEASED,
    warningRoles: [Role.SOURCING_OFFICER],
    breachRoles: [Role.SOURCING_MANAGER],
  },
  [OrderItemState.VENDOR_CONFIRMED]: {
    state: OrderItemState.VENDOR_CONFIRMED,
    warningRoles: [Role.SOURCING_OFFICER],
    breachRoles: [Role.SOURCING_MANAGER],
  },
  [OrderItemState.IN_PRODUCTION]: {
    state: OrderItemState.IN_PRODUCTION,
    warningRoles: [Role.SOURCING_OFFICER],
    breachRoles: [Role.OPERATIONS_MANAGER],
    escalationRoles: [Role.HEAD_OPERATIONS],
  },
  [OrderItemState.GOODS_RECEIVED]: {
    state: OrderItemState.GOODS_RECEIVED,
    warningRoles: [Role.INVENTORY_OFFICER],
    breachRoles: [Role.INVENTORY_MANAGER],
  },
  [OrderItemState.QC_IN_PROGRESS]: {
    state: OrderItemState.QC_IN_PROGRESS,
    warningRoles: [Role.QC_OFFICER],
    breachRoles: [Role.QC_MANAGER],
  },
  [OrderItemState.QC_APPROVED]: {
    state: OrderItemState.QC_APPROVED,
    warningRoles: [Role.INVENTORY_OFFICER],
    breachRoles: [Role.INVENTORY_MANAGER],
  },
  [OrderItemState.QC_REJECTED]: {
    state: OrderItemState.QC_REJECTED,
    warningRoles: [Role.QC_MANAGER],
    breachRoles: [Role.HEAD_OPERATIONS],
    escalationRoles: [Role.DIRECTOR],
  },
  [OrderItemState.READY_TO_DISPATCH]: {
    state: OrderItemState.READY_TO_DISPATCH,
    warningRoles: [Role.DISPATCH_OFFICER],
    breachRoles: [Role.OPERATIONS_MANAGER],
  },
  [OrderItemState.DISPATCHED]: {
    state: OrderItemState.DISPATCHED,
    warningRoles: [Role.DISPATCH_OFFICER],
    breachRoles: [Role.OPERATIONS_MANAGER],
  },
  [OrderItemState.DELIVERED]: {
    state: OrderItemState.DELIVERED,
    warningRoles: [Role.SALES_OFFICER],
    breachRoles: [Role.SALES_MANAGER],
  },
  [OrderItemState.INVOICED]: {
    state: OrderItemState.INVOICED,
    warningRoles: [Role.FINANCE_OFFICER],
    breachRoles: [Role.FINANCE_MANAGER],
  },
  [OrderItemState.PAYMENT_PENDING]: {
    state: OrderItemState.PAYMENT_PENDING,
    warningRoles: [Role.FINANCE_OFFICER],
    breachRoles: [Role.FINANCE_MANAGER],
    escalationRoles: [Role.DIRECTOR],
  },
  [OrderItemState.CLOSED]: {
    state: OrderItemState.CLOSED,
    warningRoles: [],
    breachRoles: [],
  },
  [OrderItemState.FORCE_CLOSED]: {
    state: OrderItemState.FORCE_CLOSED,
    warningRoles: [],
    breachRoles: [],
  },
};

/**
 * Create SLA warning notification
 */
export async function createSlaWarningNotification(
  entityType: 'rfq_item' | 'order_item',
  itemId: string,
  organizationId: string,
  state: RfqItemState | OrderItemState,
  percentElapsed: number,
  timeRemaining: string
): Promise<void> {
  const rules = entityType === 'rfq_item' 
    ? RFQ_ESCALATION_RULES[state as RfqItemState]
    : ORDER_ESCALATION_RULES[state as OrderItemState];

  if (!rules || rules.warningRoles.length === 0) {
    return;
  }

  const title = `SLA Warning: ${entityType.toUpperCase()} approaching deadline`;
  const message = `Item ${itemId} in state ${state} is at ${percentElapsed.toFixed(1)}% of SLA. Time remaining: ${timeRemaining}`;

  await queueNotification({
    organizationId,
    title,
    message,
    priority: 'MEDIUM',
    type: 'SLA_WARNING',
    targetRoles: rules.warningRoles,
    entityType,
    entityId: itemId,
  });
}

/**
 * Create SLA breach notification
 */
export async function createSlaBreachNotification(
  entityType: 'rfq_item' | 'order_item',
  itemId: string,
  organizationId: string,
  state: RfqItemState | OrderItemState,
  percentElapsed: number
): Promise<void> {
  const rules = entityType === 'rfq_item' 
    ? RFQ_ESCALATION_RULES[state as RfqItemState]
    : ORDER_ESCALATION_RULES[state as OrderItemState];

  if (!rules || rules.breachRoles.length === 0) {
    return;
  }

  const title = `SLA BREACH: ${entityType.toUpperCase()} deadline exceeded`;
  const message = `URGENT: Item ${itemId} in state ${state} has breached SLA (${percentElapsed.toFixed(1)}%). Immediate action required.`;

  // Notify breach roles
  await queueNotification({
    organizationId,
    title,
    message,
    priority: 'HIGH',
    type: 'SLA_BREACH',
    targetRoles: rules.breachRoles,
    entityType,
    entityId: itemId,
  });

  // If breach is critical (> 120%), escalate to higher management
  if (percentElapsed > 120 && rules.escalationRoles && rules.escalationRoles.length > 0) {
    await queueNotification({
      organizationId,
      title: `CRITICAL SLA BREACH: ${entityType.toUpperCase()}`,
      message: `CRITICAL: Item ${itemId} in state ${state} has severe SLA breach (${percentElapsed.toFixed(1)}%). Executive attention required.`,
      priority: 'URGENT',
      type: 'SLA_CRITICAL',
      targetRoles: rules.escalationRoles,
      entityType,
      entityId: itemId,
    });
  }
}

/**
 * Get escalation rules for a state
 */
export function getEscalationRules(
  entityType: 'rfq_item' | 'order_item',
  state: RfqItemState | OrderItemState
): EscalationRule | null {
  if (entityType === 'rfq_item') {
    return RFQ_ESCALATION_RULES[state as RfqItemState] || null;
  } else {
    return ORDER_ESCALATION_RULES[state as OrderItemState] || null;
  }
}
