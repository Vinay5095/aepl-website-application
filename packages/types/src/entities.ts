/**
 * Core entity type definitions for Enterprise B2B Trade & Operations OS
 * Based on README.md and PRD.md specifications
 */

import {
  RfqItemState,
  OrderItemState,
  Role,
  RiskCategory,
  CreditStatus,
  Incoterm,
  Currency,
  VendorQuoteStatus,
  QcStatus,
  RmaType,
  RmaResolutionType,
  ComplianceStatus,
} from './enums';

/**
 * Base entity with mandatory audit fields
 * Every entity MUST extend this
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  deletionReason?: string;
}

/**
 * User entity
 */
export interface User extends BaseEntity {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: Role;
  phone?: string;
  isActive: boolean;
  mfaEnabled: boolean;
  mfaSecret?: string;
  lastLoginAt?: Date;
  loginAttempts: number;
  lockedUntil?: Date;
  organizationId: string;
  legalEntityId?: string;
}

/**
 * Customer entity
 */
export interface Customer extends BaseEntity {
  name: string;
  legalName: string;
  taxId: string;
  companyType: string;
  industryType: string;
  website?: string;
  creditStatus: CreditStatus;
  riskCategory: RiskCategory;
  primaryContactId?: string;
  billingAddressId: string;
  shippingAddressId: string;
  organizationId: string;
}

/**
 * Customer credit profile
 */
export interface CustomerCreditProfile extends BaseEntity {
  customerId: string;
  legalEntityId: string;
  creditLimit: number;
  creditCurrency: Currency;
  creditDaysAllowed: number;
  currentExposure: number;
  currentOverdue: number;
  riskCategory: RiskCategory;
  lastReviewedAt?: Date;
  reviewedBy?: string;
}

/**
 * Vendor entity
 */
export interface Vendor extends BaseEntity {
  name: string;
  legalName: string;
  taxId: string;
  vendorCode: string;
  website?: string;
  rating: number;
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  organizationId: string;
}

/**
 * Product entity
 */
export interface Product extends BaseEntity {
  name: string;
  sku: string;
  categoryId: string;
  specifications: Record<string, any>;
  hsCode?: string;
  unitOfMeasure: string;
  isActive: boolean;
  organizationId: string;
}

/**
 * Product quantity rules
 */
export interface ProductQuantityRule extends BaseEntity {
  productId: string;
  moq?: number; // Minimum Order Quantity
  packSize?: number; // Must order in multiples
  overDeliveryTolerancePct: number;
  underDeliveryTolerancePct: number;
}

/**
 * RFQ (Header - Container only, NO workflow logic)
 */
export interface Rfq extends BaseEntity {
  rfqNumber: string;
  customerId: string;
  legalEntityId: string;
  customerReference?: string;
  rfqDate: Date;
  organizationId: string;
}

/**
 * RFQ_ITEM (Primary workflow entity)
 */
export interface RfqItem extends BaseEntity {
  rfqId: string;
  itemNumber: number;
  
  // Product
  productId: string;
  productName: string;
  specifications: Record<string, any>;
  
  // Quantity
  quantity: number;
  unitOfMeasure: string;
  
  // Pricing
  targetPrice?: number;
  vendorPrice?: number;
  sellingPrice?: number;
  currency: Currency;
  marginPct?: number;
  
  // State machine fields (CRITICAL)
  state: RfqItemState;
  stateEnteredAt: Date;
  ownerId?: string; // Current state owner
  
  // SLA tracking
  slaDueAt?: Date;
  slaBreached: boolean;
  slaWarning: boolean;
  slaWarningAt?: Date;
  
  // References
  commercialTermsId?: string;
  selectedVendorQuoteId?: string;
  costBreakdownId?: string;
  complianceDataId?: string;
  
  // Lineage (item becomes order_item)
  orderId?: string;
  orderItemId?: string;
  
  // Notes
  internalNotes?: string;
  customerNotes?: string;
}

/**
 * RFQ Item Revision (version history)
 */
export interface RfqItemRevision extends BaseEntity {
  rfqItemId: string;
  revisionNumber: number;
  
  // Snapshot of item data at revision time
  productId: string;
  quantity: number;
  unitOfMeasure: string;
  specifications: Record<string, any>;
  targetPrice?: number;
  currency: Currency;
  
  // Revision metadata
  revisionReason: string;
  approvedBy?: string;
  approvedAt?: Date;
}

/**
 * Commercial terms
 */
export interface CommercialTerms extends BaseEntity {
  rfqItemId: string;
  
  // Incoterms
  incoterm: Incoterm;
  incotermLocation?: string;
  
  // Payment
  paymentTerms: Record<string, any>; // { advance_pct: 30, balance_days: 45 }
  creditDays?: number;
  paymentCurrency: Currency;
  
  // Validity
  quoteValidityDays: number;
  quoteValidUntil?: Date;
  
  // Warranty
  warrantyMonths?: number;
  warrantyScope?: string;
  warrantyExclusions?: string;
  
  // Penalties
  penaltyClauses?: Record<string, any>[];
  
  // Lock status (frozen after PRICE_FROZEN)
  isFrozen: boolean;
  frozenAt?: Date;
  frozenBy?: string;
}

/**
 * Vendor quote
 */
export interface VendorQuote extends BaseEntity {
  rfqItemId: string;
  vendorId: string;
  
  // Quote details
  quoteReference: string;
  quoteDate: Date;
  validUntil: Date;
  
  // Pricing
  unitPrice: number;
  currency: Currency;
  quantity: number;
  totalAmount: number;
  
  // Terms
  paymentTerms?: string;
  deliveryTerms?: string;
  leadTimeDays?: number;
  
  // Status
  status: VendorQuoteStatus;
  
  // Selection
  isSelected: boolean;
  selectedAt?: Date;
  selectedBy?: string;
  selectionReason?: string;
  rejectionReason?: string;
  
  // Attachments
  quoteDocumentUrl?: string;
}

/**
 * Cost breakdown
 */
export interface CostBreakdown extends BaseEntity {
  rfqItemId: string;
  
  // Base cost
  baseMaterialCost: number;
  baseCurrency: Currency;
  
  // Manufacturing
  manufacturingCost: number;
  toolingCost: number;
  packagingCost: number;
  
  // Logistics (vendor side)
  vendorFreightCost: number;
  vendorInsuranceCost: number;
  
  // Import costs
  customsDuty: number;
  clearingCharges: number;
  portCharges: number;
  
  // Domestic logistics
  inlandFreight: number;
  handlingCharges: number;
  
  // Overheads
  overheadPct: number;
  overheadAmount: number;
  
  // Computed totals
  totalLandedCost: number;
  costPerUnit: number;
  
  // Margin
  targetMarginPct: number;
  actualMarginPct: number;
  
  // Selling price
  suggestedSellingPrice: number;
  finalSellingPrice: number;
  sellingCurrency: Currency;
  
  // FX at costing time
  fxRateUsed?: number;
  fxRateDate?: Date;
}

/**
 * Order (Header - Container only, NO workflow logic)
 */
export interface Order extends BaseEntity {
  orderNumber: string;
  customerId: string;
  legalEntityId: string;
  customerPoNumber?: string;
  orderDate: Date;
  organizationId: string;
}

/**
 * ORDER_ITEM (Primary workflow entity)
 */
export interface OrderItem extends BaseEntity {
  orderId: string;
  itemNumber: number;
  
  // Reference to RFQ
  rfqId: string;
  rfqItemId: string;
  rfqItemRevisionId?: string;
  
  // Product
  productId: string;
  productName: string;
  specifications: Record<string, any>;
  
  // Quantity
  orderedQuantity: number;
  receivedQuantity: number;
  invoicedQuantity: number;
  deliveredQuantity: number;
  unitOfMeasure: string;
  
  // Pricing
  unitPrice: number;
  currency: Currency;
  totalAmount: number;
  
  // State machine fields (CRITICAL)
  state: OrderItemState;
  stateEnteredAt: Date;
  ownerId?: string;
  
  // SLA tracking
  slaDueAt?: Date;
  slaBreached: boolean;
  slaWarning: boolean;
  
  // References
  purchaseOrderId?: string;
  vendorId?: string;
  
  // Flags
  isAtRisk: boolean;
  atRiskReason?: string;
  
  // Notes
  internalNotes?: string;
}

/**
 * Order item lot (quantity splits)
 */
export interface OrderItemLot extends BaseEntity {
  orderItemId: string;
  lotNumber: string;
  
  quantity: number;
  unitOfMeasure: string;
  
  // QC
  qcStatus: QcStatus;
  qcDate?: Date;
  qcRemarks?: string;
  qcCertificateUrl?: string;
  
  // Fulfillment references
  shipmentId?: string;
  invoiceId?: string;
  grnId?: string;
  
  // Tracking
  currentLocation?: string;
  locationUpdatedAt?: Date;
}

/**
 * State transition definition
 */
export interface StateTransition {
  from: RfqItemState | OrderItemState;
  to: RfqItemState | OrderItemState;
  allowedRoles: Role[];
  requiredFields: string[];
  validations: ValidationRule[];
  sideEffects: SideEffect[];
  auditReason: boolean; // Must provide reason
}

/**
 * Validation rule
 */
export interface ValidationRule {
  type: string;
  message: string;
  params?: Record<string, any>;
}

/**
 * Side effect
 */
export interface SideEffect {
  type: 'NOTIFY' | 'START_SLA' | 'STOP_SLA' | 'CREATE' | 'UPDATE';
  targets?: string[];
  duration?: string;
  params?: Record<string, any>;
}

/**
 * Audit log entry
 */
export interface AuditLog {
  id: string;
  tableName: string;
  recordId: string;
  action: string;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
  userId: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}

/**
 * SLA rule configuration
 */
export interface SlaRule extends BaseEntity {
  entityType: 'RFQ_ITEM' | 'ORDER_ITEM';
  state: string;
  slaDuration: string; // PostgreSQL interval format
  warningThreshold: string;
  escalationRole: Role;
  autoAction?: 'ESCALATE' | 'AUTO_CLOSE' | 'AT_RISK';
}

/**
 * Compliance data
 */
export interface ComplianceData extends BaseEntity {
  rfqItemId: string;
  
  // Export control
  exportControlClassification?: string;
  isDualUse: boolean;
  requiresExportLicense: boolean;
  exportLicenseNumber?: string;
  
  // Country restrictions
  destinationCountry: string;
  isSanctionedCountry: boolean;
  sanctionCheckDate?: Date;
  sanctionCheckResult?: string;
  
  // End-user verification
  endUserName?: string;
  endUserType?: string;
  endUseStatement?: string;
  isDeniedParty: boolean;
  deniedPartyCheckDate?: Date;
  
  // Product restrictions
  hsCode: string;
  isControlledItem: boolean;
  controlReason?: string;
  
  // Compliance status
  complianceStatus: ComplianceStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  
  // Documents
  endUserCertificateUrl?: string;
  exportLicenseUrl?: string;
}

/**
 * FX Rate
 */
export interface FxRate extends BaseEntity {
  fromCurrency: Currency;
  toCurrency: Currency;
  rate: number;
  rateDate: Date;
  source: 'RBI' | 'OANDA' | 'MANUAL';
}

/**
 * Invoice
 */
export interface Invoice extends BaseEntity {
  invoiceNumber: string;
  orderItemId: string;
  customerId: string;
  
  invoiceDate: Date;
  dueDate: Date;
  
  // Amounts
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: Currency;
  
  // Payment status
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  
  // E-Invoice (India)
  irnNumber?: string;
  irnGeneratedAt?: Date;
  
  // Tally sync
  tallySyncStatus?: 'PENDING' | 'SYNCED' | 'FAILED';
  tallySyncedAt?: Date;
  tallySyncError?: string;
}

/**
 * Payment
 */
export interface Payment extends BaseEntity {
  invoiceId: string;
  customerId: string;
  
  paymentDate: Date;
  amount: number;
  currency: Currency;
  
  paymentMethod: string;
  referenceNumber?: string;
  
  // Tally sync
  tallySyncStatus?: 'PENDING' | 'SYNCED' | 'FAILED';
  tallySyncedAt?: Date;
}

/**
 * RMA (Return Material Authorization)
 */
export interface Rma extends BaseEntity {
  rmaNumber: string;
  orderItemId: string;
  
  // Reason
  rmaType: RmaType;
  reason: string;
  reasonDetail?: string;
  
  // Quantity
  returnQuantity: number;
  receivedQuantity: number;
  
  // Resolution
  resolutionType?: RmaResolutionType;
  
  // Status
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'GOODS_RECEIVED' | 'UNDER_INSPECTION' | 'RESOLVED' | 'CLOSED';
  
  // Vendor handling
  vendorRmaRaised: boolean;
  vendorRmaNumber?: string;
  vendorCreditReceived: boolean;
  vendorCreditAmount?: number;
  
  // Customer handling
  customerCreditAmount?: number;
  customerCreditNoteId?: string;
  
  // Tracking
  returnShipmentId?: string;
  replacementShipmentId?: string;
  
  // Audit
  requestedBy: string;
  requestedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}
