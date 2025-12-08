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
  | 'technical_qualification_pending'
  | 'technical_qualification_completed'
  | 'assigned_to_purchase'
  | 'vendor_rfq_created'
  | 'vendor_rfq_sent'
  | 'vendor_quotes_received'
  | 'rate_analysis_started'
  | 'rate_analysis_completed'
  | 'pricing_calculation_done'
  | 'pricing_approval_pending'
  | 'pricing_approved'
  | 'quote_prepared'
  | 'quote_sent_to_customer'
  | 'quote_accepted_by_customer'
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
  technicalQualificationId?: string;
  vendorRfqIds?: string[];
  vendorQuoteIds?: string[];
  rateAnalysisId?: string;
  salesPricingId?: string;
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
  
  // Enhanced workflow data
  technicalQualification?: TechnicalQualification;
  vendorRfqs?: VendorRFQ[];
  vendorQuotes?: VendorQuote[];
  rateAnalysis?: RateAnalysis;
  salesPricing?: SalesPricing;
  approvalRequests?: ApprovalRequest[];
  
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
  
  // Product code traceability
  clientProductCode?: string;  // Customer's part number
  clientProductName?: string;  // Customer's product name
  ourProductCode?: string;     // Our SKU/part number
  vendorProductCode?: string;  // Vendor's part number (after sourcing)
  
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
  
  // Vendor details (multiple vendors per product support)
  selectedVendorId?: string;
  selectedVendorCode?: string;
  selectedVendorPrice?: number;
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
  autoApproveTechnicalQualification?: boolean;
  autoApproveRateAnalysis?: boolean;
  autoApprovePricing?: boolean;
  
  // Stock behavior
  createPOOnStockShortfall?: boolean;
  allowPartialFulfillment?: boolean;
  
  // QC behavior
  autoPassQC?: boolean; // For testing only
  blockDispatchOnQCFail?: boolean;
  
  // Invoice behavior
  autoGenerateInvoice?: boolean;
  
  // Vendor RFQ behavior
  sendToMultipleVendors?: boolean;
  minimumVendorQuotes?: number;
  maxVendorQuoteWaitDays?: number;
  
  // Rate analysis
  enableAutomaticScoring?: boolean;
  priceWeightage?: number;
  qualityWeightage?: number;
  deliveryWeightage?: number;
  paymentTermsWeightage?: number;
  
  // Pricing
  defaultMarginPercent?: number;
  requireManagementApprovalAboveMargin?: number;
  
  // Notification settings
  notifyOnEachStep?: boolean;
  notifyOnError?: boolean;
  notifyOnApprovalRequired?: boolean;
  
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

// ========================================
// ENHANCED WORKFLOW TYPES
// ========================================

export interface TechnicalQualification {
  id: string;
  rfqId: string;
  status: 'pending' | 'under_review' | 'qualified' | 'rejected' | 'more_info_needed';
  qualifiedBy?: string;
  technicalNotes?: string;
  specificationsReviewed: boolean;
  feasibilityConfirmed: boolean;
  specialRequirements?: string;
  estimatedDeliveryDays?: number;
  rejectionReason?: string;
}

export interface VendorRFQ {
  id: string;
  vendorRfqNumber: string;
  customerRfqId: string;
  supplierId: string;
  purchaseHandlerId?: string;
  status: 'draft' | 'sent_to_vendor' | 'acknowledged' | 'quoted' | 'rejected' | 'expired';
  items: VendorRFQItem[];
}

export interface VendorRFQItem {
  id: string;
  vendorRfqId: string;
  customerRfqItemId?: string;
  productId: string;
  productDescription: string;
  quantity: number;
  uom: string;
  requiredByDate?: string;
  technicalSpecs?: any;
}

export interface VendorQuote {
  id: string;
  vendorQuoteNumber: string;
  vendorRfqId: string;
  supplierId: string;
  quoteDate: string;
  validUntil?: string;
  subtotal: number;
  taxAmount: number;
  freightCharges: number;
  totalAmount: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  leadTimeDays?: number;
  items: VendorQuoteItem[];
}

export interface VendorQuoteItem {
  id: string;
  vendorQuoteId: string;
  vendorRfqItemId?: string;
  productId: string;
  productName: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  lineTotal: number;
  leadTimeDays?: number;
  brandOffered?: string;
  specificationsMet: boolean;
}

export interface RateAnalysis {
  id: string;
  customerRfqId: string;
  analysisNumber: string;
  status: 'pending' | 'in_progress' | 'completed' | 'approved';
  analyzedBy?: string;
  priceWeightage: number;
  qualityWeightage: number;
  deliveryWeightage: number;
  paymentTermsWeightage: number;
  items: RateAnalysisItem[];
  recommendations?: string;
}

export interface RateAnalysisItem {
  id: string;
  rateAnalysisId: string;
  customerRfqItemId: string;
  productId: string;
  productName: string;
  quantity: number;
  recommendedVendorId?: string;
  recommendedUnitPrice?: number;
  recommendedTotalPrice?: number;
  recommendationReason?: string;
  overridden: boolean;
  overrideVendorId?: string;
  overrideUnitPrice?: number;
  overrideTotalPrice?: number;
  overrideReason?: string;
  selectedVendorId?: string;
  selectedUnitPrice?: number;
  selectedTotalPrice?: number;
  scores?: VendorQuoteScore[];
}

export interface VendorQuoteScore {
  id: string;
  rateAnalysisItemId: string;
  vendorQuoteItemId: string;
  supplierId: string;
  priceScore: number;
  qualityScore: number;
  deliveryScore: number;
  paymentTermsScore: number;
  totalWeightedScore: number;
  rank: number;
}

export interface SalesPricing {
  id: string;
  customerRfqId: string;
  rateAnalysisId?: string;
  pricingNumber: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'revision_required';
  totalPurchaseCost: number;
  freightCost: number;
  handlingCost: number;
  otherCosts: number;
  totalCost: number;
  targetMarginPercent?: number;
  approvedMarginPercent?: number;
  salesPrice?: number;
  submittedBy?: string;
  approvedBy?: string;
  items: SalesPricingItem[];
}

export interface SalesPricingItem {
  id: string;
  salesPricingId: string;
  customerRfqItemId?: string;
  productId: string;
  productName: string;
  quantity: number;
  uom: string;
  purchaseUnitCost: number;
  purchaseTotalCost: number;
  totalUnitCost: number;
  totalCost: number;
  marginPercent: number;
  marginAmount: number;
  salesUnitPrice: number;
  salesTotalPrice: number;
  taxRate: number;
  taxAmount: number;
  finalUnitPrice: number;
  finalLineTotal: number;
}

export interface ApprovalRequest {
  id: string;
  approvalType: 'technical_qualification' | 'rate_analysis' | 'pricing_approval' | 'quote_approval';
  referenceType: string;
  referenceId: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'cancelled';
  approvalLevel: number;
  requiredRole?: string;
  assignedTo?: string;
  requestedBy?: string;
  reviewedBy?: string;
  decision?: string;
  comments?: string;
}
