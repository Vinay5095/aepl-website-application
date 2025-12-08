# Product Code Traceability System

## Overview

The AEPL ERP Platform includes a comprehensive **dual product code traceability system** that tracks products using both **client product codes** (customer part numbers) and **vendor product codes** (supplier part numbers), mapped through **our product codes** as the central hub.

This enables complete end-to-end visibility from customer inquiry to vendor fulfillment.

## Concept: Three-Way Product Code Mapping

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Client Product │         │   Our Product   │         │ Vendor Product  │
│      Code       │────────▶│      Code       │◀────────│      Code       │
│                 │         │     (Hub)       │         │                 │
│ Customer A:     │         │                 │         │ Vendor 1:       │
│ "VALVE-123"     │         │  Our SKU:       │         │ "V-XYZ-456"     │
│                 │         │  "DN50-VALVE"   │         │                 │
│ Customer B:     │         │                 │         │ Vendor 2:       │
│ "CV-ABC-789"    │         │                 │         │ "SUP-VAL-999"   │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

### Why Three Codes?

1. **Client Product Code**: Each customer has their own part numbering system
2. **Our Product Code**: Our internal SKU/part number (standardized)
3. **Vendor Product Code**: Each supplier has their own part numbering system

### The Hub Model

Our product code acts as the **central hub**:
- Multiple **clients** can have different codes for the same product
- Multiple **vendors** can supply the same product with different codes
- Complete **traceability** maintained throughout the workflow

## Database Schema

### Core Tables

#### 1. `client_product_codes`
Maps customer part numbers to our products.

```sql
CREATE TABLE client_product_codes (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES companies(id),
  client_product_code VARCHAR(100) NOT NULL,
  client_product_name VARCHAR(500),
  our_product_id UUID REFERENCES products(id),
  our_product_code VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  verified_by UUID,
  verified_at TIMESTAMP,
  UNIQUE(customer_id, client_product_code)
);
```

**Key Features:**
- One customer can have multiple product codes
- Each client code maps to exactly one of our products
- Verification tracking for quality control
- Historical data preserved with `is_active` flag

#### 2. `vendor_product_codes`
Maps supplier part numbers to our products.

```sql
CREATE TABLE vendor_product_codes (
  id UUID PRIMARY KEY,
  supplier_id UUID REFERENCES suppliers(id),
  vendor_product_code VARCHAR(100) NOT NULL,
  vendor_product_name VARCHAR(500),
  our_product_id UUID REFERENCES products(id),
  our_product_code VARCHAR(100),
  last_purchase_price DECIMAL(15, 2),
  last_purchase_date DATE,
  standard_lead_time_days INTEGER,
  is_active BOOLEAN DEFAULT true,
  is_preferred BOOLEAN DEFAULT false,
  UNIQUE(supplier_id, vendor_product_code)
);
```

**Key Features:**
- Multiple vendors can supply the same product
- Each vendor code maps to exactly one of our products
- Price and lead time tracking
- Preferred vendor marking for automatic selection

#### 3. `product_code_cross_reference`
Complete three-way mapping for traceability.

```sql
CREATE TABLE product_code_cross_reference (
  id UUID PRIMARY KEY,
  client_product_code_id UUID,
  customer_id UUID,
  client_code VARCHAR(100),
  our_product_id UUID NOT NULL,
  our_product_code VARCHAR(100),
  vendor_product_code_id UUID,
  supplier_id UUID,
  vendor_code VARCHAR(100),
  mapped_by UUID,
  is_verified BOOLEAN DEFAULT false
);
```

**Key Features:**
- Complete lineage from client to vendor
- Audit trail of who created the mapping
- Verification status tracking

### Product Code Tracking Across All Tables

Every transaction table now includes product code fields:

#### RFQ Items
```sql
rfq_items:
  - client_product_code (customer's code)
  - client_product_name (customer's name)
  - our_product_code (our SKU)
  - client_product_code_id (reference)
  - cross_reference_id (complete mapping)
```

#### Vendor RFQ Items
```sql
vendor_rfq_items:
  - client_product_code (from customer)
  - our_product_code (our SKU)
  - vendor_product_code (for this vendor)
  - vendor_product_code_id (reference)
```

#### Vendor Quote Items
```sql
vendor_quote_items:
  - client_product_code (original customer code)
  - our_product_code (our SKU)
  - vendor_product_code (vendor's quoted code)
```

#### Rate Analysis Items
```sql
rate_analysis_items:
  - client_product_code
  - our_product_code
  - selected_vendor_code (winning vendor's code)
```

#### Sales Order Items
```sql
sales_order_items:
  - client_product_code (customer's reference)
  - our_product_code (our SKU)
```

#### Purchase Order Items
```sql
purchase_order_items:
  - client_product_code (original customer code)
  - our_product_code (our SKU)
  - vendor_product_code (supplier's code)
```

#### GRN Items
```sql
grn_items:
  - client_product_code (tracking back to customer)
  - our_product_code (our SKU)
  - vendor_product_code (received from vendor)
```

#### Stock Lots
```sql
stock_lots:
  - vendor_product_code (supplier code)
  - client_product_codes JSONB (array - can fulfill multiple clients)
```

#### Shipment Items
```sql
shipment_items:
  - client_product_code (customer's reference)
  - our_product_code (our SKU)
  - vendor_product_code (source vendor)
```

#### Invoice Items
```sql
sales_invoice_items:
  - client_product_code (customer reference)
  - our_product_code (our SKU)

purchase_bill_items:
  - our_product_code (our SKU)
  - vendor_product_code (vendor's invoice code)
```

## Traceability Views

### Complete Product Traceability
View all mappings for a product across customers and vendors:

```sql
SELECT * FROM vw_product_traceability 
WHERE our_product_code = 'DN50-VALVE';
```

**Returns:**
- All customer codes for this product
- All vendor codes for this product
- Pricing and lead time information
- Preferred vendors
- Verification status

### RFQ to Vendor Traceability
Track complete journey from customer inquiry to vendor fulfillment:

```sql
SELECT * FROM vw_rfq_vendor_traceability 
WHERE client_product_code = 'VALVE-123';
```

**Returns:**
- Customer RFQ details with client code
- Our product code mapping
- All vendors who quoted
- Selected vendor and their code
- Rate analysis results
- Customer quote with final pricing
- Sales order details
- Purchase order with vendor code
- Complete timeline of all steps

## Helper Functions

### 1. Map Client Product Code

```sql
SELECT map_client_product_code(
  p_customer_id := '...',
  p_client_code := 'VALVE-123',
  p_our_product_id := '...',
  p_verified_by := '...'
);
```

Creates or updates a client product code mapping.

### 2. Map Vendor Product Code

```sql
SELECT map_vendor_product_code(
  p_supplier_id := '...',
  p_vendor_code := 'V-XYZ-456',
  p_our_product_id := '...',
  p_last_price := 1500.00,
  p_lead_time_days := 10
);
```

Creates or updates a vendor product code mapping.

### 3. Create Complete Cross-Reference

```sql
SELECT create_product_cross_reference(
  p_customer_id := '...',
  p_client_code := 'VALVE-123',
  p_our_product_id := '...',
  p_supplier_id := '...',
  p_vendor_code := 'V-XYZ-456',
  p_mapped_by := '...'
);
```

Creates a complete three-way mapping in one operation.

### 4. Get Vendor Codes for Product

```sql
SELECT * FROM get_vendor_codes_for_product(
  p_our_product_id := '...',
  p_preferred_only := false
);
```

Returns all vendor codes for our product, optionally filtered to preferred vendors only.

## Usage in Workflow

### Customer RFQ Processing

1. **Customer submits RFQ** with their product codes:
   ```json
   {
     "items": [
       {
         "clientProductCode": "VALVE-123",
         "clientProductName": "Ball Valve 2 inch",
         "quantity": 10
       }
     ]
   }
   ```

2. **System maps to our products**:
   - Searches `client_product_codes` for existing mapping
   - If not found, creates new mapping (manual or automatic)
   - Updates RFQ item with `our_product_code`

3. **Technical qualification** verifies:
   - Client code correctly mapped
   - Our product matches specifications
   - Updates verification status

### Vendor RFQ Creation

4. **System creates vendor RFQs**:
   - For each product, finds all approved vendors
   - Uses `vendor_product_codes` to get vendor-specific codes
   - Creates vendor RFQ with three codes:
     ```sql
     vendor_rfq_items:
       client_product_code: "VALVE-123"
       our_product_code: "DN50-VALVE"
       vendor_product_code: "V-XYZ-456" (for Vendor A)
     ```

5. **Vendor quotes** reference their codes:
   - Vendor sees their own product code
   - System maintains all three codes
   - Rate analysis compares using our code as hub

### Purchase & Fulfillment

6. **Purchase order** includes all codes:
   ```sql
   purchase_order_items:
     client_product_code: "VALVE-123"  (origin)
     our_product_code: "DN50-VALVE"    (our reference)
     vendor_product_code: "V-XYZ-456"  (vendor ships this)
   ```

7. **GRN receipt** verifies:
   - Vendor shipped correct product using their code
   - Maps back to our code
   - Can trace to original client code

8. **Inventory** tracks:
   - Stock lot has vendor code
   - Can fulfill multiple client codes
   - Complete traceability maintained

### Customer Fulfillment

9. **Shipment** includes:
   - Client product code (customer's reference)
   - Our product code (our internal tracking)
   - Vendor product code (source tracing)

10. **Invoice** shows:
    - Client product code (customer recognizes this)
    - Our product code (our records)

## Traceability Benefits

### 1. Complete Visibility

**Query: "Where did we source Customer A's VALVE-123?"**

```sql
SELECT 
  client_product_code,
  our_product_code,
  vendor_code,
  supplier_name,
  po_number,
  grn_number
FROM vw_rfq_vendor_traceability
WHERE client_product_code = 'VALVE-123'
  AND customer_name = 'Customer A';
```

**Result:** Complete chain from customer code to actual vendor who supplied it.

### 2. Quality Issues Tracing

**Scenario:** Customer reports issue with their part "CV-ABC-789"

```sql
-- Find all occurrences
SELECT * FROM vw_rfq_vendor_traceability
WHERE client_product_code = 'CV-ABC-789'
ORDER BY rfq_received_at DESC;
```

**Result:**
- Which vendor supplied it
- Vendor's product code
- GRN and lot numbers
- QC inspection results
- Can trace back to specific vendor batch

### 3. Vendor Performance

**Query: "How many different products does Vendor X supply?"**

```sql
SELECT 
  vendor_product_code,
  our_product_code,
  our_product_name,
  last_purchase_price,
  standard_lead_time_days,
  COUNT(DISTINCT client_code) as client_variants
FROM vendor_product_codes vpc
JOIN product_code_cross_reference pcr ON vpc.id = pcr.vendor_product_code_id
WHERE supplier_id = 'vendor-x-id'
GROUP BY vendor_product_code, our_product_code, our_product_name, 
         last_purchase_price, standard_lead_time_days;
```

### 4. Customer Product Analysis

**Query: "Which products does Customer Y order?"**

```sql
SELECT 
  client_product_code,
  client_product_name,
  our_product_code,
  our_product_name,
  COUNT(*) as order_count,
  SUM(quantity) as total_quantity,
  AVG(quoted_price_to_customer) as avg_price
FROM vw_rfq_vendor_traceability
WHERE customer_name = 'Customer Y'
GROUP BY client_product_code, client_product_name, 
         our_product_code, our_product_name
ORDER BY order_count DESC;
```

### 5. Multi-Vendor Sourcing

**Query: "Show all vendors for our product DN50-VALVE"**

```sql
SELECT * FROM get_vendor_codes_for_product(
  (SELECT id FROM products WHERE sku = 'DN50-VALVE')
);
```

**Result:**
- All vendors who can supply this product
- Their respective product codes
- Latest prices
- Lead times
- Preferred vendor indication

## API Integration

### Workflow Engine Enhancement

The enhanced workflow engine automatically:

1. **Maps client codes** when RFQ is received
2. **Finds vendor codes** when creating vendor RFQs
3. **Maintains all three codes** through entire workflow
4. **Updates cross-references** as new vendors are discovered
5. **Records traceability data** in every transaction

### Example: Complete Traceability Query

```typescript
// Get complete product journey
const traceability = await supabase
  .from('vw_rfq_vendor_traceability')
  .select('*')
  .eq('client_product_code', 'VALVE-123')
  .eq('rfq_number', 'RFQ-12345')
  .single();

// Returns complete picture:
console.log({
  customerCode: traceability.client_product_code,
  ourCode: traceability.our_product_code,
  vendorCode: traceability.selected_vendor_code,
  vendorName: traceability.supplier_name,
  priceFromVendor: traceability.vendor_unit_price,
  priceToCustomer: traceability.quoted_price_to_customer,
  margin: traceability.quoted_price_to_customer - traceability.vendor_unit_price,
  timeline: {
    rfqReceived: traceability.rfq_received_at,
    vendorQuoteReceived: traceability.vendor_quote_received_at,
    customerQuoteSent: traceability.customer_quote_sent_at,
    orderPlaced: traceability.sales_order_created_at,
    purchaseOrdered: traceability.purchase_order_created_at
  }
});
```

## Best Practices

### 1. Code Verification
- Always verify client code mappings during technical qualification
- Update vendor codes when receiving quotes
- Maintain preferred vendor flags

### 2. Multiple Vendors
- Map all potential vendors for each product
- Update pricing and lead times regularly
- Use rate analysis to select best vendor per transaction

### 3. Code Updates
- Never delete codes, use `is_active = false`
- Maintain historical data for audit purposes
- Version control for code changes

### 4. Traceability Reports
- Run weekly traceability audits
- Verify all new mappings
- Check for orphaned codes

## Future Enhancements

1. **Automatic Code Mapping**: AI/ML to suggest mappings based on product descriptions
2. **Code Standards**: Support for industry-standard product codes (UPC, EAN, etc.)
3. **Image Recognition**: Match products using images alongside codes
4. **Blockchain Integration**: Immutable traceability records
5. **Real-time Tracking**: IoT integration for physical product tracking

## Support

For questions about product code traceability:
- Documentation: `/docs/PRODUCT_CODE_TRACEABILITY.md`
- Database Views: `vw_product_traceability`, `vw_rfq_vendor_traceability`
- Helper Functions: See "Helper Functions" section above

---

**Built for complete supply chain visibility** 🔍

**Tracks every product from customer inquiry to vendor fulfillment**
