/**
 * Main export file for @trade-os/state-machine package
 * 
 * This package implements the complete state machine for RFQ_ITEM and ORDER_ITEM workflows
 * as specified in PRD.md and README.md
 */

export * from './types';

// Export RFQ transitions with renamed functions to avoid conflicts
export {
  RFQ_ITEM_TRANSITIONS,
  getValidTransitionsFrom as getRfqValidTransitionsFrom,
  getTransition as getRfqTransition,
  isValidTransition as isRfqValidTransition,
  canRolePerformTransition as canRolePerformRfqTransition,
} from './rfq-transitions';

// Export Order transitions with renamed functions to avoid conflicts
export {
  ORDER_ITEM_TRANSITIONS,
  getValidTransitionsFrom as getOrderValidTransitionsFrom,
  getTransition as getOrderTransition,
  isValidTransition as isOrderValidTransition,
  canRolePerformTransition as canRolePerformOrderTransition,
  isTerminalState as isOrderTerminalState,
} from './order-transitions';

// Re-export for convenience
export { RfqItemState, OrderItemState, Role } from '@trade-os/types';
