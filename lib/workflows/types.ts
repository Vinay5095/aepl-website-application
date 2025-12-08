/**
 * Workflow Engine Types
 * Defines all types for the end-to-end business workflow
 */

export type WorkflowStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'requires_action'
  | 'cancelled';

export type WorkflowStep = 
  | 'rfq_received'
  | 'quote_prepared'
  | 'quote_sent'
  | 'quote_accepted'
  | 'sales_order_created'
  | 'stock_checked'
  | 'stock_available'
  | 'stock_insufficient'
  | 'purchase_requisition_created'
  | 'purchase_order_created'
  | 'po_sent_to_supplier'
  | 'po_acknowledged'
  | 'grn_created'
  | 'qc_initiated'
  | 'qc_in_progress'
  | 'qc_passed'
  | 'qc_failed'
  | 'ncr_created'
  | 'stock_updated'
  | 'shipment_planned'
  | 'items_picked'
  | 'items_packed'
  | 'shipment_dispatched'
  | 'invoice_generated'
  | 'invoice_sent'
  | 'payment_received'
  | 'order_completed';

export interface WorkflowContext {
  rfqId?: string;
  quoteId?: string;
  salesOrderId?: string;
  purchaseRequisitionId?: string;
  purchaseOrderId?: string;
  grnId?: string;
  qcInspectionId?: string;
  ncrId?: string;
  shipmentId?: string;
  invoiceId?: string;
  paymentId?: string;
  
  customerId: string;
  items: WorkflowItem[];
  
  // Stock check results
  stockCheckResults?: StockCheckResult[];
  itemsRequiringPurchase?: WorkflowItem[];
  
  // QC results
  qcResults?: QCResult[];
  
  // Calculated amounts
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  
  // Timestamps
  startedAt: Date;
  completedAt?: Date;
  
  // Error handling
  errors: WorkflowError[];
  warnings: WorkflowWarning[];
}

export interface WorkflowItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxRate: number;
  
  // Stock details
  availableStock?: number;
  quantityToOrder?: number;
  
  // QC details
  qcStatus?: 'pending' | 'passed' | 'failed' | 'on_hold';
  quantityAccepted?: number;
  quantityRejected?: number;
  
  // Lot tracking
  lotNumber?: string;
  batchNumber?: string;
}

export interface StockCheckResult {
  productId: string;
  availableQuantity: number;
  requiredQuantity: number;
  shortfall: number;
  warehouseId: string;
  needsPurchase: boolean;
}

export interface QCResult {
  productId: string;
  lotId: string;
  inspectionId: string;
  status: 'passed' | 'failed' | 'on_hold';
  quantityInspected: number;
  quantityPassed: number;
  quantityFailed: number;
  remarks?: string;
}

export interface WorkflowError {
  step: WorkflowStep;
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  recoverable: boolean;
}

export interface WorkflowWarning {
  step: WorkflowStep;
  message: string;
  details?: any;
  timestamp: Date;
}

export interface WorkflowResult {
  success: boolean;
  status: WorkflowStatus;
  currentStep: WorkflowStep;
  context: WorkflowContext;
  message: string;
}

export interface WorkflowOptions {
  // Automatic approvals
  autoApproveQuote?: boolean;
  autoApprovePO?: boolean;
  
  // Stock behavior
  createPOOnStockShortfall?: boolean;
  allowPartialFulfillment?: boolean;
  
  // QC behavior
  autoPassQC?: boolean; // For testing only
  blockDispatchOnQCFail?: boolean;
  
  // Invoice behavior
  autoGenerateInvoice?: boolean;
  
  // Notification settings
  notifyOnEachStep?: boolean;
  notifyOnError?: boolean;
  
  // Retry settings
  maxRetries?: number;
  retryDelayMs?: number;
}

// Workflow state machine
export interface WorkflowStateMachine {
  currentStep: WorkflowStep;
  previousSteps: WorkflowStep[];
  context: WorkflowContext;
  status: WorkflowStatus;
  canProceed: boolean;
  nextPossibleSteps: WorkflowStep[];
}

// Edge cases to handle
export enum EdgeCase {
  // Stock related
  PARTIAL_STOCK_AVAILABLE = 'partial_stock_available',
  NO_STOCK_AVAILABLE = 'no_stock_available',
  STOCK_RESERVED_BY_OTHERS = 'stock_reserved_by_others',
  
  // Purchase related
  MULTIPLE_SUPPLIERS_NEEDED = 'multiple_suppliers_needed',
  SUPPLIER_OUT_OF_STOCK = 'supplier_out_of_stock',
  PO_REJECTED_BY_SUPPLIER = 'po_rejected_by_supplier',
  PARTIAL_GRN = 'partial_grn',
  
  // QC related
  QC_FAILED_COMPLETE = 'qc_failed_complete',
  QC_FAILED_PARTIAL = 'qc_failed_partial',
  QC_ON_HOLD = 'qc_on_hold',
  NCR_RAISED = 'ncr_raised',
  
  // Dispatch related
  PARTIAL_DISPATCH = 'partial_dispatch',
  DISPATCH_DELAYED = 'dispatch_delayed',
  CARRIER_UNAVAILABLE = 'carrier_unavailable',
  
  // Payment related
  PARTIAL_PAYMENT = 'partial_payment',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_DELAYED = 'payment_delayed',
  
  // General
  CUSTOMER_CANCELLED = 'customer_cancelled',
  PRODUCT_DISCONTINUED = 'product_discontinued',
  PRICE_CHANGED = 'price_changed',
  APPROVAL_PENDING = 'approval_pending',
}

export interface EdgeCaseHandler {
  edgeCase: EdgeCase;
  handle: (context: WorkflowContext) => Promise<WorkflowResult>;
  canRecover: boolean;
  requiresManualIntervention: boolean;
}
