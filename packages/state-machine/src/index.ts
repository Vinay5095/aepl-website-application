/**
 * Main export file for @trade-os/state-machine package
 * 
 * This package implements the complete state machine for RFQ_ITEM and ORDER_ITEM workflows
 * as specified in PRD.md and README.md
 */

export * from './types';
export * from './rfq-transitions';
export * from './order-transitions';

// Re-export for convenience
export { RfqItemState, OrderItemState, Role } from '@trade-os/types';
