/**
 * API request/response type definitions
 * For Enterprise B2B Trade & Operations OS
 */

import { RfqItemState, OrderItemState, Role } from './enums';
import { RfqItem, OrderItem } from './entities';

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  field?: string;
  timestamp: string;
  requestId: string;
  path: string;
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  page?: number;
  perPage?: number;
  total?: number;
  totalPages?: number;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  perPage?: number;
}

/**
 * State transition request
 */
export interface StateTransitionRequest {
  toState: RfqItemState | OrderItemState;
  reason?: string;
  approvalNotes?: string;
  attachments?: string[];
}

/**
 * State transition response
 */
export interface StateTransitionResponse {
  success: boolean;
  item: RfqItem | OrderItem;
  transition: {
    fromState: string;
    toState: string;
    transitionedAt: string;
    transitionedBy: string;
  };
  sideEffects: {
    notificationsSent: number;
    slaStarted: boolean;
    escalationTriggered: boolean;
  };
}

/**
 * Allowed transitions response
 */
export interface AllowedTransitionsResponse {
  currentState: string;
  allowedTransitions: {
    targetState: string;
    allowedRoles: Role[];
    requiresReason: boolean;
    requiresApproval: boolean;
  }[];
}

/**
 * Create RFQ request
 */
export interface CreateRfqRequest {
  customerId: string;
  legalEntityId: string;
  customerReference?: string;
  items: CreateRfqItemRequest[];
}

/**
 * Create RFQ item request
 */
export interface CreateRfqItemRequest {
  productId: string;
  quantity: number;
  unitOfMeasure: string;
  specifications?: Record<string, any>;
  targetPrice?: number;
  currency: string;
  internalNotes?: string;
  customerNotes?: string;
}

/**
 * Update RFQ item request
 */
export interface UpdateRfqItemRequest {
  quantity?: number;
  specifications?: Record<string, any>;
  targetPrice?: number;
  internalNotes?: string;
  customerNotes?: string;
}

/**
 * Create revision request
 */
export interface CreateRevisionRequest {
  revisionReason: string;
  quantity?: number;
  specifications?: Record<string, any>;
  targetPrice?: number;
}

/**
 * Create vendor quote request
 */
export interface CreateVendorQuoteRequest {
  vendorId: string;
  quoteReference: string;
  quoteDate: string;
  validUntil: string;
  unitPrice: number;
  currency: string;
  quantity: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  leadTimeDays?: number;
  quoteDocumentUrl?: string;
}

/**
 * Update cost breakdown request
 */
export interface UpdateCostBreakdownRequest {
  baseMaterialCost: number;
  manufacturingCost?: number;
  toolingCost?: number;
  packagingCost?: number;
  vendorFreightCost?: number;
  vendorInsuranceCost?: number;
  customsDuty?: number;
  clearingCharges?: number;
  portCharges?: number;
  inlandFreight?: number;
  handlingCharges?: number;
  overheadPct?: number;
  targetMarginPct: number;
}

/**
 * Create order from RFQ request
 */
export interface CreateOrderFromRfqRequest {
  rfqId: string;
  rfqItemIds: string[];
  customerPoNumber?: string;
}

/**
 * Create order item lot request
 */
export interface CreateOrderItemLotRequest {
  lotNumber: string;
  quantity: number;
}

/**
 * Update QC status request
 */
export interface UpdateQcStatusRequest {
  lotId: string;
  qcStatus: 'PASSED' | 'FAILED' | 'PARTIAL';
  qcRemarks?: string;
  qcCertificateUrl?: string;
}

/**
 * Create invoice request
 */
export interface CreateInvoiceRequest {
  orderItemId: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

/**
 * Record payment request
 */
export interface RecordPaymentRequest {
  invoiceId: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
}

/**
 * List filters
 */
export interface RfqItemListFilters extends PaginationParams {
  customerId?: string;
  state?: RfqItemState;
  ownerId?: string;
  slaBreached?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface OrderItemListFilters extends PaginationParams {
  customerId?: string;
  state?: OrderItemState;
  ownerId?: string;
  slaBreached?: boolean;
  isAtRisk?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Audit log query
 */
export interface AuditLogQuery extends PaginationParams {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Dashboard metrics
 */
export interface DashboardMetrics {
  rfqPipeline: {
    byState: {
      state: string;
      count: number;
      value: number;
      avgAgeHours: number;
      atRiskCount: number;
      slaBreachCount: number;
    }[];
    totalValue: number;
    conversionRate: number;
  };
  orderPipeline: {
    byState: {
      state: string;
      count: number;
      value: number;
      avgAgeHours: number;
    }[];
    totalValue: number;
  };
  slaPerformance: {
    totalItems: number;
    breachedItems: number;
    breachRate: number;
    avgCompletionTime: number;
  };
  creditExposure: {
    totalExposure: number;
    totalOverdue: number;
    customersAtRisk: number;
  };
}
