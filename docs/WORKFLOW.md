# End-to-End Workflow System

## Overview

The AEPL ERP Platform includes a powerful, single-click end-to-end workflow engine that automates the complete business process flow from customer inquiry to payment receipt.

## Workflow Flow

```
RFQ → Quote → Sales Order → Stock Check → 
  ├─ Stock Available → Reserve
  └─ Stock Insufficient → Purchase Order → GRN → QC → Inventory
→ Dispatch → Invoice → Payment → Complete
```

## Complete Workflow Steps

### 1. RFQ (Request for Quote)
- Customer submits inquiry with product requirements
- System generates unique RFQ number
- Stores customer details and line items

### 2. Quote Generation
- Automatically builds quote from RFQ
- Calculates pricing, discounts, taxes
- Sets validity period (default 30 days)
- Generates unique quote number

### 3. Quote Acceptance
- Can be auto-approved or requires manual approval
- Updates quote status to 'accepted'
- Triggers sales order creation

### 4. Sales Order Creation
- Converts accepted quote to sales order
- Generates unique SO number
- Copies all line items and pricing
- Sets order status to 'confirmed'

### 5. Stock Availability Check
- Checks real-time inventory for each product
- Returns one of three scenarios:
  - **Full Stock Available**: All items in stock
  - **Partial Stock Available**: Some items in stock
  - **No Stock Available**: Out of stock, purchase needed

### 6. Stock Management

#### Scenario A: Stock Available
- Reserves stock for sales order
- Updates stock balance (available vs reserved)
- Proceeds to dispatch planning

#### Scenario B: Partial Stock
- Reserves available quantities
- Creates purchase flow for shortfall
- Supports partial fulfillment if enabled

#### Scenario C: No Stock
- Creates purchase requisition (PR)
- Generates purchase order (PO)
- Sends to supplier

### 7. Purchase Flow (if needed)

#### 7a. Purchase Requisition
- Auto-generates PR for stock shortfall
- Lists required quantities per product
- Auto-approves if configured

#### 7b. Purchase Order
- Converts PR to PO
- Selects approved supplier
- Sets delivery expectations
- Can auto-approve or require approval

#### 7c. PO to Supplier
- Sends PO to supplier (email/portal)
- Tracks acknowledgment
- Monitors delivery timeline

### 8. Goods Received Note (GRN)
- Records receipt of goods from supplier
- Verifies quantities against PO
- Generates batch/lot numbers
- Captures supplier invoice details
- Supports full or partial receipt

### 9. Quality Control (QC)

#### 9a. QC Inspection
- Mandatory for inbound goods
- Three types supported:
  - **Inbound QC**: After GRN
  - **In-process QC**: During production
  - **Outbound QC**: Before dispatch
- Records inspection results
- Pass/fail determination

#### 9b. QC Results
- **Pass**: Goods move to available inventory
- **Fail**: Goods quarantined, NCR created
- **On Hold**: Requires investigation

#### 9c. Non-Conformance Report (NCR)
- Automatically created for failed QC
- Documents quality issues
- Tracks root cause analysis
- Manages CAPA workflow

### 10. Inventory Update
- Adds passed quantities to stock
- Updates stock balances
- Creates stock movement records
- Tracks lot/batch in inventory
- Calculates valuation (FIFO/Weighted Avg)

### 11. Dispatch Planning

#### 11a. Shipment Creation
- Plans shipment for sales order
- Selects carrier
- Generates shipment number
- Sets delivery expectations

#### 11b. Pick-Pack-Ship
- **Pick**: Items picked from warehouse
- **Pack**: Items packed for transport
- **Ship**: Handed over to carrier
- Generates tracking number
- Updates order status

### 12. Invoice Generation
- Automatically creates sales invoice
- GST-compliant calculation:
  - CGST/SGST (intra-state)
  - IGST (inter-state)
- Includes HSN codes
- E-invoice ready (IRN generation)
- Sets payment due date

### 13. Payment Processing
- Records payment receipt
- Supports multiple modes:
  - Bank transfer
  - UPI
  - Cheque
  - Card
- Allocates to invoice
- Updates invoice status
- Tracks partial payments

### 14. Order Completion
- Marks order as delivered
- Updates all statuses
- Completes audit trail
- Triggers customer notification

## Edge Cases Handled

### Stock-Related Edge Cases

1. **Partial Stock Available**
   - System splits order fulfillment
   - Ships available stock immediately
   - Purchases remaining quantity
   - Notifies customer of split delivery

2. **Stock Reserved by Others**
   - Checks both available and reserved quantities
   - Prevents over-commitment
   - Suggests alternative products

3. **Multiple Warehouses**
   - Checks stock across all warehouses
   - Optimizes fulfillment by location
   - Supports inter-warehouse transfers

### Purchase-Related Edge Cases

1. **Multiple Suppliers Needed**
   - Splits PO across multiple suppliers
   - Tracks each PO separately
   - Consolidates GRN updates

2. **Supplier Out of Stock**
   - Identifies alternative suppliers
   - Adjusts delivery timelines
   - Notifies sales team

3. **Partial GRN**
   - Accepts partial deliveries
   - Updates PO quantities
   - Tracks pending quantities
   - Creates multiple GRNs per PO

4. **Supplier Invoice Mismatch**
   - 3-way matching (PO-GRN-Invoice)
   - Flags discrepancies
   - Requires approval for differences

### QC-Related Edge Cases

1. **Complete QC Failure**
   - Quarantines entire lot
   - Creates NCR
   - Initiates return to supplier
   - Blocks from inventory

2. **Partial QC Failure**
   - Accepts good quantities
   - Rejects failed quantities
   - Updates stock accordingly
   - NCR for failed portion

3. **QC On Hold**
   - Holds stock in quarantine
   - Requires additional testing
   - Suspends order fulfillment
   - Notifies relevant teams

4. **Supplier Quality Issues**
   - Tracks supplier quality score
   - Impacts future PO decisions
   - Triggers supplier review

### Dispatch-Related Edge Cases

1. **Partial Dispatch**
   - Ships available quantities
   - Creates multiple shipments
   - Tracks each shipment separately
   - Partial invoicing

2. **Carrier Unavailable**
   - Selects alternative carrier
   - Adjusts delivery timeline
   - Notifies customer

3. **Dispatch Delay**
   - Updates expected delivery
   - Notifies customer proactively
   - Tracks SLA compliance

4. **Failed Delivery**
   - Records delivery attempts
   - Initiates return process
   - Re-schedules delivery

### Payment-Related Edge Cases

1. **Partial Payment**
   - Allocates to invoice
   - Tracks balance due
   - Sends payment reminders
   - Updates AR aging

2. **Payment Failed**
   - Records failed attempt
   - Notifies customer
   - Initiates follow-up
   - May hold future orders

3. **Overpayment**
   - Records excess amount
   - Creates credit note
   - Applies to future orders

4. **Payment Disputes**
   - Flags for investigation
   - Holds invoice closure
   - Tracks resolution

### General Edge Cases

1. **Customer Cancellation**
   - At any stage before dispatch
   - Releases reserved stock
   - Cancels downstream processes
   - Issues credit note if paid

2. **Product Discontinued**
   - Suggests alternatives
   - Allows substitution with approval
   - Updates quote/order

3. **Price Changes**
   - Locks price at quote acceptance
   - Honors quoted price
   - New orders at new price

4. **Approval Pending**
   - Pauses workflow
   - Sends notifications
   - Tracks approval timeline
   - Escalation after timeout

## Workflow Options

Configure workflow behavior with these options:

```typescript
interface WorkflowOptions {
  // Automatic approvals
  autoApproveQuote?: boolean;           // Default: false
  autoApprovePO?: boolean;              // Default: false
  
  // Stock behavior
  createPOOnStockShortfall?: boolean;   // Default: true
  allowPartialFulfillment?: boolean;    // Default: true
  
  // QC behavior
  autoPassQC?: boolean;                 // Default: false (testing only)
  blockDispatchOnQCFail?: boolean;      // Default: true
  
  // Invoice behavior
  autoGenerateInvoice?: boolean;        // Default: true
  
  // Notification settings
  notifyOnEachStep?: boolean;           // Default: true
  notifyOnError?: boolean;              // Default: true
  
  // Retry settings
  maxRetries?: number;                  // Default: 3
  retryDelayMs?: number;                // Default: 1000
}
```

## API Usage

### Execute Workflow

```bash
POST /api/workflow/execute
```

#### Request Payload

```json
{
  "context": {
    "customerId": "550e8400-e29b-41d4-a716-446655440000",
    "items": [
      {
        "productId": "660e8400-e29b-41d4-a716-446655440000",
        "productName": "Industrial Valve DN50",
        "quantity": 10,
        "unitPrice": 1500,
        "discountPercent": 5,
        "taxRate": 18
      }
    ]
  },
  "options": {
    "autoApproveQuote": true,
    "createPOOnStockShortfall": true,
    "autoPassQC": true,
    "autoGenerateInvoice": true
  }
}
```

#### Response

```json
{
  "result": {
    "success": true,
    "status": "completed",
    "currentStep": "order_completed",
    "context": {
      "rfqId": "...",
      "quoteId": "...",
      "salesOrderId": "...",
      "purchaseOrderId": "...",
      "grnId": "...",
      "shipmentId": "...",
      "invoiceId": "...",
      "paymentId": "..."
    },
    "message": "Order workflow completed successfully"
  },
  "summary": {
    "currentStep": "order_completed",
    "errors": [],
    "warnings": [],
    "duration": 15234
  }
}
```

## Benefits

### 1. **Automation**
- Eliminates manual data entry
- Reduces human error
- Increases processing speed
- 90% faster order processing

### 2. **Consistency**
- Standard process for all orders
- Uniform data quality
- Predictable outcomes
- Audit compliance

### 3. **Visibility**
- Real-time status tracking
- Complete audit trail
- KPI monitoring
- Bottleneck identification

### 4. **Scalability**
- Handles high volume
- Parallel processing
- Resource optimization
- Growth-ready architecture

### 5. **Compliance**
- GST calculations
- E-invoice generation
- Statutory records
- Audit trail

## Monitoring & Reporting

### Workflow Metrics

- **Cycle Time**: Average time from RFQ to completion
- **Success Rate**: Percentage of successful completions
- **Failure Points**: Most common failure steps
- **Stock-out Rate**: Frequency of stock shortfall
- **QC Pass Rate**: Quality metrics
- **On-Time Delivery**: Delivery performance

### Alerts & Notifications

- Workflow failure alerts
- Approval pending notifications
- Stock shortfall warnings
- QC failure alerts
- Payment overdue reminders
- Delivery delay notifications

## Best Practices

### 1. **Configuration**
- Set realistic approval timeouts
- Configure automatic approvals carefully
- Define clear QC criteria
- Establish inventory thresholds

### 2. **Monitoring**
- Review failed workflows daily
- Analyze bottlenecks weekly
- Optimize based on metrics
- Update processes quarterly

### 3. **Data Quality**
- Maintain accurate product data
- Keep pricing up-to-date
- Verify customer information
- Clean supplier data regularly

### 4. **Testing**
- Test edge cases thoroughly
- Validate data integrity
- Verify integrations
- Performance test under load

## Future Enhancements

- AI-based demand forecasting
- Predictive stock replenishment
- Dynamic pricing optimization
- Supplier performance prediction
- Customer behavior analytics
- IoT integration for real-time tracking
- Blockchain for supply chain transparency

## Support

For issues or questions about the workflow system:
- Email: support@aepl.com
- Documentation: /docs/workflows
- API Reference: /api/workflow/execute
