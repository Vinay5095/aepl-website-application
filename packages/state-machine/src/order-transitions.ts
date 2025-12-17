/**
 * ORDER Item State Machine Transitions
 * Based on PRD.md Section 4.2 and README.md
 * 
 * CRITICAL: This defines ALL valid transitions for ORDER_ITEM workflow
 * Any transition not defined here is ILLEGAL and must be blocked
 */

import { OrderItemState, Role } from '@trade-os/types';
import { StateTransition } from './types';

/**
 * Complete ORDER Item State Machine
 * 18 states as per PRD.md
 */
export const ORDER_ITEM_TRANSITIONS: StateTransition<OrderItemState>[] = [
  // PR_CREATED → PR_ACKNOWLEDGED
  {
    from: OrderItemState.PR_CREATED,
    to: OrderItemState.PR_ACKNOWLEDGED,
    allowedRoles: [Role.PURCHASE_ENGINEER, Role.PURCHASE_MANAGER],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['FINANCE_OFFICER'] },
      { type: 'START_SLA', duration: '4h' },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // PR_ACKNOWLEDGED → CREDIT_CHECK (Auto)
  {
    from: OrderItemState.PR_ACKNOWLEDGED,
    to: OrderItemState.CREDIT_CHECK,
    allowedRoles: [],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['FINANCE_OFFICER'] },
      { type: 'START_SLA', duration: '4h' },
    ],
    auditReason: false,
    autoTransition: true,
  },

  // CREDIT_CHECK → PO_RELEASED (Pass)
  {
    from: OrderItemState.CREDIT_CHECK,
    to: OrderItemState.PO_RELEASED,
    allowedRoles: [Role.FINANCE_OFFICER, Role.FINANCE_MANAGER],
    requiredFields: [],
    validations: [
      { type: 'CREDIT_AVAILABLE', message: 'Customer must have sufficient credit' },
      { type: 'CUSTOMER_NOT_BLOCKED', message: 'Customer must not be blocked' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['PURCHASE_ENGINEER', 'VENDOR'] },
      { type: 'CREATE', params: { generatePO: true } },
      { type: 'START_SLA', duration: '12h' },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // CREDIT_CHECK → CREDIT_HOLD (Fail)
  {
    from: OrderItemState.CREDIT_CHECK,
    to: OrderItemState.CREDIT_HOLD,
    allowedRoles: [Role.FINANCE_OFFICER, Role.FINANCE_MANAGER],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['FINANCE_MANAGER', 'SALES_EXECUTIVE'] },
    ],
    auditReason: true,
    autoTransition: false,
  },

  // CREDIT_HOLD → PO_RELEASED (Override)
  {
    from: OrderItemState.CREDIT_HOLD,
    to: OrderItemState.PO_RELEASED,
    allowedRoles: [Role.FINANCE_MANAGER, Role.DIRECTOR, Role.MD],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['PURCHASE_ENGINEER', 'VENDOR'] },
      { type: 'CREATE', params: { generatePO: true } },
      { type: 'START_SLA', duration: '12h' },
    ],
    auditReason: true, // Must document override reason
    autoTransition: false,
  },

  // PO_RELEASED → VENDOR_CONFIRMED
  {
    from: OrderItemState.PO_RELEASED,
    to: OrderItemState.VENDOR_CONFIRMED,
    allowedRoles: [Role.PURCHASE_ENGINEER, Role.PURCHASE_MANAGER],
    requiredFields: [],
    validations: [
      { type: 'VENDOR_CONFIRMATION_RECEIVED', message: 'Vendor must confirm PO' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['PURCHASE_ENGINEER'] },
      { type: 'START_SLA', duration: '48h' },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // VENDOR_CONFIRMED → IN_PRODUCTION
  {
    from: OrderItemState.VENDOR_CONFIRMED,
    to: OrderItemState.IN_PRODUCTION,
    allowedRoles: [Role.PURCHASE_ENGINEER, Role.PURCHASE_MANAGER],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['PURCHASE_ENGINEER'] },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // IN_PRODUCTION → GOODS_RECEIVED
  {
    from: OrderItemState.IN_PRODUCTION,
    to: OrderItemState.GOODS_RECEIVED,
    allowedRoles: [Role.WAREHOUSE_EXECUTIVE, Role.WAREHOUSE_MANAGER],
    requiredFields: [],
    validations: [
      { type: 'GRN_CREATED', message: 'GRN must be created' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['QC_ENGINEER'] },
      { type: 'CREATE', params: { createLots: true } },
      { type: 'START_SLA', duration: '24h' },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // GOODS_RECEIVED → QC_APPROVED (Pass)
  {
    from: OrderItemState.GOODS_RECEIVED,
    to: OrderItemState.QC_APPROVED,
    allowedRoles: [Role.QC_ENGINEER, Role.QC_MANAGER],
    requiredFields: [],
    validations: [
      { type: 'QC_INSPECTION_COMPLETE', message: 'QC inspection must be complete' },
      { type: 'QC_STATUS_PASSED', message: 'All lots must pass QC' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['LOGISTICS_EXECUTIVE'] },
      { type: 'START_SLA', duration: '24h' },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // GOODS_RECEIVED → QC_REJECTED (Fail)
  {
    from: OrderItemState.GOODS_RECEIVED,
    to: OrderItemState.QC_REJECTED,
    allowedRoles: [Role.QC_ENGINEER, Role.QC_MANAGER],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['PURCHASE_ENGINEER', 'VENDOR', 'QC_MANAGER'] },
      { type: 'CREATE', params: { createRMA: true } },
    ],
    auditReason: true,
    autoTransition: false,
  },

  // QC_REJECTED → VENDOR_CONFIRMED (Rework/Replacement)
  {
    from: OrderItemState.QC_REJECTED,
    to: OrderItemState.VENDOR_CONFIRMED,
    allowedRoles: [Role.PURCHASE_ENGINEER, Role.PURCHASE_MANAGER],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['VENDOR'] },
    ],
    auditReason: true,
    autoTransition: false,
  },

  // QC_APPROVED → READY_TO_DISPATCH (Auto)
  {
    from: OrderItemState.QC_APPROVED,
    to: OrderItemState.READY_TO_DISPATCH,
    allowedRoles: [],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['LOGISTICS_EXECUTIVE'] },
    ],
    auditReason: false,
    autoTransition: true,
  },

  // READY_TO_DISPATCH → DISPATCHED
  {
    from: OrderItemState.READY_TO_DISPATCH,
    to: OrderItemState.DISPATCHED,
    allowedRoles: [Role.LOGISTICS_EXECUTIVE, Role.LOGISTICS_MANAGER],
    requiredFields: [],
    validations: [
      { type: 'SHIPMENT_CREATED', message: 'Shipment must be created' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['CUSTOMER', 'SALES_EXECUTIVE'] },
      { type: 'START_SLA', duration: '24h' },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // DISPATCHED → DELIVERED
  {
    from: OrderItemState.DISPATCHED,
    to: OrderItemState.DELIVERED,
    allowedRoles: [Role.LOGISTICS_EXECUTIVE, Role.LOGISTICS_MANAGER],
    requiredFields: [],
    validations: [
      { type: 'DELIVERY_CONFIRMED', message: 'Delivery must be confirmed' },
      { type: 'POD_UPLOADED', message: 'Proof of delivery must be uploaded' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['FINANCE_EXECUTIVE'] },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // DELIVERED → INVOICED
  {
    from: OrderItemState.DELIVERED,
    to: OrderItemState.INVOICED,
    allowedRoles: [Role.FINANCE_EXECUTIVE, Role.FINANCE_OFFICER],
    requiredFields: [],
    validations: [
      { type: 'INVOICE_GENERATED', message: 'Invoice must be generated' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['CUSTOMER', 'FINANCE_OFFICER'] },
      { type: 'CREATE', params: { queueTallySync: true } },
      { type: 'START_SLA', duration: '24h' },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // INVOICED → PAYMENT_PARTIAL
  {
    from: OrderItemState.INVOICED,
    to: OrderItemState.PAYMENT_PARTIAL,
    allowedRoles: [Role.FINANCE_OFFICER, Role.FINANCE_EXECUTIVE],
    requiredFields: [],
    validations: [
      { type: 'PAYMENT_RECORDED', message: 'Payment must be recorded' },
      { type: 'PAYMENT_NOT_FULL', message: 'Payment must be partial (not full)' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['SALES_EXECUTIVE'] },
      { type: 'UPDATE', params: { updateCreditExposure: true } },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // INVOICED → PAYMENT_CLOSED (Full payment)
  {
    from: OrderItemState.INVOICED,
    to: OrderItemState.PAYMENT_CLOSED,
    allowedRoles: [Role.FINANCE_OFFICER, Role.FINANCE_EXECUTIVE],
    requiredFields: [],
    validations: [
      { type: 'PAYMENT_RECORDED', message: 'Payment must be recorded' },
      { type: 'PAYMENT_FULL', message: 'Payment must be full' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['SALES_EXECUTIVE'] },
      { type: 'UPDATE', params: { updateCreditExposure: true } },
      { type: 'CREATE', params: { queueTallySync: true } },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // PAYMENT_PARTIAL → PAYMENT_CLOSED (Remaining payment)
  {
    from: OrderItemState.PAYMENT_PARTIAL,
    to: OrderItemState.PAYMENT_CLOSED,
    allowedRoles: [Role.FINANCE_OFFICER, Role.FINANCE_EXECUTIVE],
    requiredFields: [],
    validations: [
      { type: 'PAYMENT_BALANCE_FULL', message: 'Balance payment must be full' },
    ],
    sideEffects: [
      { type: 'NOTIFY', targets: ['SALES_EXECUTIVE'] },
      { type: 'UPDATE', params: { updateCreditExposure: true } },
      { type: 'CREATE', params: { queueTallySync: true } },
    ],
    auditReason: false,
    autoTransition: false,
  },

  // PAYMENT_CLOSED → CLOSED (Auto)
  {
    from: OrderItemState.PAYMENT_CLOSED,
    to: OrderItemState.CLOSED,
    allowedRoles: [],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['SALES_EXECUTIVE'] },
      { type: 'UPDATE', params: { makeImmutable: true } },
    ],
    auditReason: false,
    autoTransition: true,
  },

  // PR_CREATED → CANCELLED
  {
    from: OrderItemState.PR_CREATED,
    to: OrderItemState.CANCELLED,
    allowedRoles: [Role.SALES_MANAGER, Role.DIRECTOR],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['SALES_EXECUTIVE', 'PURCHASE_ENGINEER'] },
    ],
    auditReason: true,
    autoTransition: false,
  },

  // PO_RELEASED → CANCELLED
  {
    from: OrderItemState.PO_RELEASED,
    to: OrderItemState.CANCELLED,
    allowedRoles: [Role.PURCHASE_MANAGER, Role.DIRECTOR],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'NOTIFY', targets: ['VENDOR', 'PURCHASE_ENGINEER'] },
    ],
    auditReason: true,
    autoTransition: false,
  },

  // CANCELLED → FORCE_CLOSED
  {
    from: OrderItemState.CANCELLED,
    to: OrderItemState.FORCE_CLOSED,
    allowedRoles: [Role.DIRECTOR, Role.MD],
    requiredFields: [],
    validations: [],
    sideEffects: [
      { type: 'UPDATE', params: { makeImmutable: true } },
    ],
    auditReason: true,
    autoTransition: false,
  },

  // Any state → FORCE_CLOSED (Emergency closure by Director/MD)
  // This will be handled as a special case in the state machine engine
];

/**
 * Get valid transitions from a given state
 */
export function getValidTransitionsFrom(
  state: OrderItemState
): StateTransition<OrderItemState>[] {
  return ORDER_ITEM_TRANSITIONS.filter((t) => t.from === state);
}

/**
 * Get specific transition
 */
export function getTransition(
  from: OrderItemState,
  to: OrderItemState
): StateTransition<OrderItemState> | undefined {
  return ORDER_ITEM_TRANSITIONS.find((t) => t.from === from && t.to === to);
}

/**
 * Check if transition is valid
 */
export function isValidTransition(from: OrderItemState, to: OrderItemState): boolean {
  return ORDER_ITEM_TRANSITIONS.some((t) => t.from === from && t.to === to);
}

/**
 * Check if user role can perform transition
 */
export function canRolePerformTransition(
  from: OrderItemState,
  to: OrderItemState,
  userRole: Role
): boolean {
  const transition = getTransition(from, to);
  if (!transition) return false;

  // Auto transitions don't require role check
  if (transition.autoTransition) return true;

  // Special case: FORCE_CLOSED can be done by Director/MD from any non-terminal state
  if (to === OrderItemState.FORCE_CLOSED && 
      (userRole === Role.DIRECTOR || userRole === Role.MD)) {
    return true;
  }

  return transition.allowedRoles.includes(userRole);
}

/**
 * Check if state is terminal (immutable)
 */
export function isTerminalState(state: OrderItemState): boolean {
  return state === OrderItemState.CLOSED || state === OrderItemState.FORCE_CLOSED;
}
