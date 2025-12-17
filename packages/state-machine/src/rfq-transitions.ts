/**
 * RFQ Item State Machine Transitions
 * Based on PRD.md Section 4.1 and README.md
 * 
 * CRITICAL: This defines ALL valid transitions for RFQ_ITEM workflow
 * Any transition not defined here is ILLEGAL and must be blocked
 */

import { RfqItemState, Role } from '@trade-os/types';
import { StateTransition } from './types';

/**
 * Complete RFQ Item State Machine
 * 16 states as per PRD.md
 */
export const RFQ_ITEM_TRANSITIONS: StateTransition<RfqItemState>[] = [
  // DRAFT → RFQ_SUBMITTED
  {
    from: RfqItemState.DRAFT,
    to: RfqItemState.RFQ_SUBMITTED,
    allowedRoles: [Role.SALES_EXECUTIVE, Role.SALES_MANAGER],
    requiredFields: ['productId', 'quantity', 'unitOfMeasure'],
    validations: [
      { type: 'PRODUCT_ACTIVE', message: 'Product must be active' },
      { type: 'QUANTITY_POSITIVE', message: 'Quantity must be greater than 0' },
      { type: 'QUANTITY_VALID', message: 'Quantity must meet MOQ and pack size requirements' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['SALES_MANAGER'] },
      { type: 'START_SLA', duration: '2h' },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // RFQ_SUBMITTED → SALES_REVIEW (Auto transition)
  {
    from: RfqItemState.RFQ_SUBMITTED,
    to: RfqItemState.SALES_REVIEW,
    allowedRoles: [], // Auto transition
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['SALES_EXECUTIVE'] },
      { type: 'START_SLA', duration: '4h' },
    ],
    auditReason: false,
    autoTransition: true,
  },

  // SALES_REVIEW → TECH_REVIEW
  {
    from: RfqItemState.SALES_REVIEW,
    to: RfqItemState.TECH_REVIEW,
    allowedRoles: [Role.SALES_EXECUTIVE, Role.SALES_MANAGER],
    requiredFields: ['targetPrice', 'currency'],
    validations: [
      { type: 'TARGET_PRICE_POSITIVE', message: 'Target price must be greater than 0' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['TECH_ENGINEER'] },
      { type: 'START_SLA', duration: '24h' },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // SALES_REVIEW → DRAFT (Reject back to draft)
  {
    from: RfqItemState.SALES_REVIEW,
    to: RfqItemState.DRAFT,
    allowedRoles: [Role.SALES_MANAGER],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['SALES_EXECUTIVE'] },
    ],
    auditReason: true, // Requires reason for rejection
    autoTransition: false,
  },

  // TECH_REVIEW → TECH_APPROVED
  {
    from: RfqItemState.TECH_REVIEW,
    to: RfqItemState.TECH_APPROVED,
    allowedRoles: [Role.TECH_ENGINEER, Role.TECH_LEAD],
    requiredFields: [],
    validations: [
      { type: 'SPECIFICATIONS_COMPLETE', message: 'Technical specifications must be complete' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['COMPLIANCE_OFFICER'] },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // TECH_REVIEW → SALES_REVIEW (Reject)
  {
    from: RfqItemState.TECH_REVIEW,
    to: RfqItemState.SALES_REVIEW,
    allowedRoles: [Role.TECH_ENGINEER, Role.TECH_LEAD],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['SALES_EXECUTIVE'] },
    ],
    auditReason: true,
    autoTransition: false,
  },

  // TECH_APPROVED → COMPLIANCE_REVIEW (Auto)
  {
    from: RfqItemState.TECH_APPROVED,
    to: RfqItemState.COMPLIANCE_REVIEW,
    allowedRoles: [],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['COMPLIANCE_OFFICER'] },
      { type: 'START_SLA', duration: '24h' },
    ],
    auditReason: false,
    autoTransition: true,
  },

  // COMPLIANCE_REVIEW → STOCK_CHECK
  {
    from: RfqItemState.COMPLIANCE_REVIEW,
    to: RfqItemState.STOCK_CHECK,
    allowedRoles: [Role.COMPLIANCE_OFFICER, Role.COMPLIANCE_MANAGER],
    requiredFields: ['complianceDataId'],
    validations: [
      { type: 'COMPLIANCE_APPROVED', message: 'Compliance check must be approved' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['WAREHOUSE_EXECUTIVE'] },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // COMPLIANCE_REVIEW → TECH_REVIEW (Reject)
  {
    from: RfqItemState.COMPLIANCE_REVIEW,
    to: RfqItemState.TECH_REVIEW,
    allowedRoles: [Role.COMPLIANCE_OFFICER, Role.COMPLIANCE_MANAGER],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['TECH_ENGINEER'] },
    ],
    auditReason: true,
    autoTransition: false,
  },

  // STOCK_CHECK → SOURCING_ACTIVE (No stock)
  {
    from: RfqItemState.STOCK_CHECK,
    to: RfqItemState.SOURCING_ACTIVE,
    allowedRoles: [Role.WAREHOUSE_EXECUTIVE, Role.WAREHOUSE_MANAGER],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['SOURCING_ENGINEER'] },
      { type: 'START_SLA', duration: '48h' },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // STOCK_CHECK → RATE_FINALIZED (Has stock, skip sourcing)
  {
    from: RfqItemState.STOCK_CHECK,
    to: RfqItemState.RATE_FINALIZED,
    allowedRoles: [Role.WAREHOUSE_EXECUTIVE, Role.WAREHOUSE_MANAGER],
    requiredFields: ['costBreakdownId'],
    validations: [
      { type: 'STOCK_AVAILABLE', message: 'Stock must be available' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['PURCHASE_MANAGER'] },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // SOURCING_ACTIVE → VENDOR_QUOTES_RECEIVED
  {
    from: RfqItemState.SOURCING_ACTIVE,
    to: RfqItemState.VENDOR_QUOTES_RECEIVED,
    allowedRoles: [Role.SOURCING_ENGINEER, Role.PURCHASE_MANAGER],
    requiredFields: [],
    validations: [
      { type: 'HAS_VENDOR_QUOTES', message: 'At least one vendor quote required' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['SOURCING_ENGINEER'] },
      { type: 'START_SLA', duration: '24h' },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // VENDOR_QUOTES_RECEIVED → RATE_FINALIZED
  {
    from: RfqItemState.VENDOR_QUOTES_RECEIVED,
    to: RfqItemState.RATE_FINALIZED,
    allowedRoles: [Role.SOURCING_ENGINEER, Role.PURCHASE_MANAGER],
    requiredFields: ['selectedVendorQuoteId', 'costBreakdownId'],
    validations: [
      { type: 'VENDOR_QUOTE_SELECTED', message: 'Vendor quote must be selected' },
      { type: 'COST_BREAKDOWN_COMPLETE', message: 'Cost breakdown must be complete' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['PURCHASE_MANAGER'] },
      { type: 'START_SLA', duration: '12h' },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // RATE_FINALIZED → MARGIN_APPROVAL (Auto)
  {
    from: RfqItemState.RATE_FINALIZED,
    to: RfqItemState.MARGIN_APPROVAL,
    allowedRoles: [],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['DIRECTOR'] },
      { type: 'START_SLA', duration: '24h' },
    ],
    auditReason: false,
    autoTransition: true,
  },

  // MARGIN_APPROVAL → PRICE_FROZEN
  {
    from: RfqItemState.MARGIN_APPROVAL,
    to: RfqItemState.PRICE_FROZEN,
    allowedRoles: [Role.DIRECTOR, Role.MD],
    requiredFields: ['sellingPrice', 'marginPct'],
    validations: [
      { type: 'MARGIN_ACCEPTABLE', message: 'Margin must be within acceptable range' },
      { type: 'COMMERCIAL_TERMS_COMPLETE', message: 'Commercial terms must be complete' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['SALES_EXECUTIVE'] },
      { type: 'UPDATE', params: { freezeCommercialTerms: true } },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // MARGIN_APPROVAL → RATE_FINALIZED (Reject, revise pricing)
  {
    from: RfqItemState.MARGIN_APPROVAL,
    to: RfqItemState.RATE_FINALIZED,
    allowedRoles: [Role.DIRECTOR, Role.MD],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['PURCHASE_MANAGER', 'SOURCING_ENGINEER'] },
    ],
    auditReason: true,
    autoTransition: false,
  },

  // PRICE_FROZEN → QUOTE_SENT
  {
    from: RfqItemState.PRICE_FROZEN,
    to: RfqItemState.QUOTE_SENT,
    allowedRoles: [Role.SALES_EXECUTIVE, Role.SALES_MANAGER],
    requiredFields: [],
    validations: [
      { type: 'QUOTE_PDF_GENERATED', message: 'Quote PDF must be generated' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['CUSTOMER'] },
      { type: 'UPDATE', params: { sentAt: new Date() } },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // QUOTE_SENT → CUSTOMER_ACCEPTED
  {
    from: RfqItemState.QUOTE_SENT,
    to: RfqItemState.CUSTOMER_ACCEPTED,
    allowedRoles: [Role.SALES_EXECUTIVE, Role.SALES_MANAGER],
    requiredFields: [],
    validations: [
      { type: 'CUSTOMER_ACCEPTANCE_CONFIRMED', message: 'Customer acceptance must be confirmed' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['SALES_MANAGER', 'PURCHASE_ENGINEER'] },
      { type: 'CREATE', params: { createOrder: true } },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // QUOTE_SENT → CUSTOMER_REJECTED
  {
    from: RfqItemState.QUOTE_SENT,
    to: RfqItemState.CUSTOMER_REJECTED,
    allowedRoles: [Role.SALES_EXECUTIVE, Role.SALES_MANAGER],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['SALES_MANAGER'] },
    ],
    auditReason: true,
    autoTransition: false,
  },

  // CUSTOMER_ACCEPTED → RFQ_CLOSED
  {
    from: RfqItemState.CUSTOMER_ACCEPTED,
    to: RfqItemState.RFQ_CLOSED,
    allowedRoles: [], // System auto-closes after order creation
    requiredFields: ['orderId', 'orderItemId'],
    validations: [
      { type: 'ORDER_CREATED', message: 'Order must be created' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['SALES_EXECUTIVE'] },
    ],
    auditReason: false,
    autoTransition: true,
  },

  // CUSTOMER_REJECTED → RFQ_CLOSED (Auto)
  {
    from: RfqItemState.CUSTOMER_REJECTED,
    to: RfqItemState.RFQ_CLOSED,
    allowedRoles: [],
    requiredFields: [],
    validations: [],
    sideEffects: [],
    auditReason: false,
    autoTransition: true,
  },

  // DRAFT → RFQ_CLOSED (Cancel)
  {
    from: RfqItemState.DRAFT,
    to: RfqItemState.RFQ_CLOSED,
    allowedRoles: [Role.SALES_EXECUTIVE, Role.SALES_MANAGER, Role.DIRECTOR],
    requiredFields: [],
    validations: [],
    sideEffects: [],
    auditReason: true,
    autoTransition: false,
  },

  // Any non-terminal state → RFQ_CLOSED (Force close by Director/MD)
  // Note: This will be checked dynamically in the state machine engine
];

/**
 * Get valid transitions from a given state
 */
export function getValidTransitionsFrom(
  state: RfqItemState
): StateTransition<RfqItemState>[] {
  return RFQ_ITEM_TRANSITIONS.filter((t) => t.from === state);
}

/**
 * Get specific transition
 */
export function getTransition(
  from: RfqItemState,
  to: RfqItemState
): StateTransition<RfqItemState> | undefined {
  return RFQ_ITEM_TRANSITIONS.find((t) => t.from === from && t.to === to);
}

/**
 * Check if transition is valid
 */
export function isValidTransition(from: RfqItemState, to: RfqItemState): boolean {
  return RFQ_ITEM_TRANSITIONS.some((t) => t.from === from && t.to === to);
}

/**
 * Check if user role can perform transition
 */
export function canRolePerformTransition(
  from: RfqItemState,
  to: RfqItemState,
  userRole: Role
): boolean {
  const transition = getTransition(from, to);
  if (!transition) return false;

  // Auto transitions don't require role check
  if (transition.autoTransition) return true;

  return transition.allowedRoles.includes(userRole);
}
