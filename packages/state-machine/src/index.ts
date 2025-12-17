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

// Helper functions
import { RFQ_TRANSITIONS } from './rfq-transitions';
import { ORDER_TRANSITIONS } from './order-transitions';
import { RfqItemState, OrderItemState } from '@trade-os/types';
import type { StateTransition } from './types';

/**
 * Get a specific RFQ transition
 */
export function getRfqTransition(from: RfqItemState, to: RfqItemState): StateTransition | undefined {
  return RFQ_TRANSITIONS.find(t => t.from === from && t.to === to);
}

/**
 * Get all RFQ transitions from a specific state
 */
export function getRfqTransitionsFromState(from: RfqItemState): StateTransition[] {
  return RFQ_TRANSITIONS.filter(t => t.from === from);
}

/**
 * Get a specific Order transition
 */
export function getOrderTransition(from: OrderItemState, to: OrderItemState): StateTransition | undefined {
  return ORDER_TRANSITIONS.find(t => t.from === from && t.to === to);
}

/**
 * Get all Order transitions from a specific state
 */
export function getOrderTransitionsFromState(from: OrderItemState): StateTransition[] {
  return ORDER_TRANSITIONS.filter(t => t.from === from);
}
