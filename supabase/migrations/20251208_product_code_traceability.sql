-- Product Code Traceability Enhancement
-- Adds dual product code tracking: Client Product Code + Vendor/Our Product Code
-- Enables end-to-end traceability from customer inquiry to vendor fulfillment

-- ========================================
-- PRODUCT CODE MAPPING
-- ========================================

-- Client product codes (customer's part numbers)
CREATE TABLE client_product_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES companies(id) NOT NULL,
  client_product_code VARCHAR(100) NOT NULL,
  client_product_name VARCHAR(500),
  client_product_description TEXT,
  client_specifications JSONB,
  
  -- Mapping to our product
  our_product_id UUID REFERENCES products(id),
  our_product_code VARCHAR(100), -- Our SKU
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(customer_id, client_product_code)
);

-- Vendor product codes (supplier's part numbers)
CREATE TABLE vendor_product_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  vendor_product_code VARCHAR(100) NOT NULL,
  vendor_product_name VARCHAR(500),
  vendor_product_description TEXT,
  vendor_specifications JSONB,
  vendor_brand VARCHAR(255),
  
  -- Mapping to our product
  our_product_id UUID REFERENCES products(id),
  our_product_code VARCHAR(100), -- Our SKU
  
  -- Pricing from vendor
  last_purchase_price DECIMAL(15, 2),
  last_purchase_date DATE,
  
  -- Lead time
  standard_lead_time_days INTEGER,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_preferred BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(supplier_id, vendor_product_code)
);

-- Product code cross-reference for traceability
CREATE TABLE product_code_cross_reference (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Client side
  client_product_code_id UUID REFERENCES client_product_codes(id),
  customer_id UUID REFERENCES companies(id),
  client_code VARCHAR(100) NOT NULL,
  client_name VARCHAR(500),
  
  -- Our product (hub)
  our_product_id UUID REFERENCES products(id) NOT NULL,
  our_product_code VARCHAR(100) NOT NULL,
  our_product_name VARCHAR(500),
  
  -- Vendor side
  vendor_product_code_id UUID REFERENCES vendor_product_codes(id),
  supplier_id UUID REFERENCES suppliers(id),
  vendor_code VARCHAR(100),
  vendor_name VARCHAR(500),
  
  -- Traceability metadata
  mapped_by UUID REFERENCES profiles(id),
  mapped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_verified BOOLEAN DEFAULT false,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- ENHANCED RFQ WITH PRODUCT CODES
-- ========================================

-- Add client product code tracking to RFQ items
ALTER TABLE rfq_items 
  ADD COLUMN client_product_code VARCHAR(100),
  ADD COLUMN client_product_name VARCHAR(500),
  ADD COLUMN client_product_code_id UUID REFERENCES client_product_codes(id),
  ADD COLUMN cross_reference_id UUID REFERENCES product_code_cross_reference(id);

-- Add our product code reference
ALTER TABLE rfq_items 
  ADD COLUMN our_product_code VARCHAR(100);

-- Update existing product_id to be optional since client may not know our code
ALTER TABLE rfq_items 
  ALTER COLUMN product_id DROP NOT NULL;

-- ========================================
-- VENDOR RFQ WITH PRODUCT CODES
-- ========================================

-- Add product code tracking to vendor RFQ items
ALTER TABLE vendor_rfq_items 
  ADD COLUMN client_product_code VARCHAR(100),
  ADD COLUMN client_product_name VARCHAR(500),
  ADD COLUMN our_product_code VARCHAR(100),
  ADD COLUMN vendor_product_code VARCHAR(100),
  ADD COLUMN vendor_product_code_id UUID REFERENCES vendor_product_codes(id),
  ADD COLUMN cross_reference_id UUID REFERENCES product_code_cross_reference(id);

-- ========================================
-- VENDOR QUOTE WITH PRODUCT CODES
-- ========================================

-- Add vendor product code to vendor quote items
ALTER TABLE vendor_quote_items 
  ADD COLUMN client_product_code VARCHAR(100),
  ADD COLUMN our_product_code VARCHAR(100),
  ADD COLUMN vendor_product_code VARCHAR(100),
  ADD COLUMN vendor_product_code_id UUID REFERENCES vendor_product_codes(id),
  ADD COLUMN cross_reference_id UUID REFERENCES product_code_cross_reference(id);

-- ========================================
-- RATE ANALYSIS WITH PRODUCT CODES
-- ========================================

-- Add product codes to rate analysis items
ALTER TABLE rate_analysis_items 
  ADD COLUMN client_product_code VARCHAR(100),
  ADD COLUMN our_product_code VARCHAR(100),
  ADD COLUMN selected_vendor_code VARCHAR(100);

-- ========================================
-- QUOTE WITH PRODUCT CODES
-- ========================================

-- Add client product code to quote items
ALTER TABLE quote_items 
  ADD COLUMN client_product_code VARCHAR(100),
  ADD COLUMN our_product_code VARCHAR(100);

-- ========================================
-- SALES ORDER WITH PRODUCT CODES
-- ========================================

-- Add product codes to sales order items
ALTER TABLE sales_order_items 
  ADD COLUMN client_product_code VARCHAR(100),
  ADD COLUMN our_product_code VARCHAR(100);

-- ========================================
-- PURCHASE ORDER WITH PRODUCT CODES
-- ========================================

-- Add product codes to purchase order items
ALTER TABLE purchase_order_items 
  ADD COLUMN client_product_code VARCHAR(100),
  ADD COLUMN our_product_code VARCHAR(100),
  ADD COLUMN vendor_product_code VARCHAR(100),
  ADD COLUMN vendor_product_code_id UUID REFERENCES vendor_product_codes(id);

-- ========================================
-- GRN WITH PRODUCT CODES
-- ========================================

-- Add product codes to GRN items
ALTER TABLE grn_items 
  ADD COLUMN client_product_code VARCHAR(100),
  ADD COLUMN our_product_code VARCHAR(100),
  ADD COLUMN vendor_product_code VARCHAR(100),
  ADD COLUMN vendor_product_code_id UUID REFERENCES vendor_product_codes(id);

-- ========================================
-- INVENTORY WITH PRODUCT CODES
-- ========================================

-- Add vendor product code tracking to stock lots
ALTER TABLE stock_lots 
  ADD COLUMN vendor_product_code VARCHAR(100),
  ADD COLUMN vendor_product_code_id UUID REFERENCES vendor_product_codes(id),
  ADD COLUMN client_product_codes JSONB; -- Array of client codes this lot can fulfill

-- Add product code to stock moves
ALTER TABLE stock_moves 
  ADD COLUMN our_product_code VARCHAR(100),
  ADD COLUMN vendor_product_code VARCHAR(100);

-- ========================================
-- SHIPMENT WITH PRODUCT CODES
-- ========================================

-- Add product codes to shipment items
ALTER TABLE shipment_items 
  ADD COLUMN client_product_code VARCHAR(100),
  ADD COLUMN our_product_code VARCHAR(100),
  ADD COLUMN vendor_product_code VARCHAR(100);

-- ========================================
-- INVOICE WITH PRODUCT CODES
-- ========================================

-- Add client product code to sales invoice items
ALTER TABLE sales_invoice_items 
  ADD COLUMN client_product_code VARCHAR(100),
  ADD COLUMN our_product_code VARCHAR(100);

-- Add vendor product code to purchase bill items
ALTER TABLE purchase_bill_items 
  ADD COLUMN our_product_code VARCHAR(100),
  ADD COLUMN vendor_product_code VARCHAR(100);

-- ========================================
-- TRACEABILITY VIEWS
-- ========================================

-- Complete traceability view: Client Product → Our Product → Vendor Products
CREATE OR REPLACE VIEW vw_product_traceability AS
SELECT 
  -- Client side
  cpc.customer_id,
  c.name as customer_name,
  cpc.client_product_code,
  cpc.client_product_name,
  
  -- Our product (hub)
  p.id as our_product_id,
  p.sku as our_product_code,
  p.name as our_product_name,
  
  -- All mapped vendors
  json_agg(
    json_build_object(
      'supplier_id', vpc.supplier_id,
      'supplier_name', s.name,
      'vendor_code', vpc.vendor_product_code,
      'vendor_name', vpc.vendor_product_name,
      'last_price', vpc.last_purchase_price,
      'lead_time_days', vpc.standard_lead_time_days,
      'is_preferred', vpc.is_preferred
    )
  ) as vendor_mappings,
  
  -- Traceability status
  cpc.is_active as client_mapping_active,
  cpc.verified_at as client_verified_at

FROM client_product_codes cpc
JOIN companies c ON cpc.customer_id = c.id
JOIN products p ON cpc.our_product_id = p.id
LEFT JOIN vendor_product_codes vpc ON vpc.our_product_id = p.id AND vpc.is_active = true
LEFT JOIN suppliers sup ON vpc.supplier_id = sup.id
LEFT JOIN companies s ON sup.company_id = s.id

WHERE cpc.is_active = true

GROUP BY 
  cpc.customer_id, c.name, cpc.client_product_code, cpc.client_product_name,
  p.id, p.sku, p.name, cpc.is_active, cpc.verified_at;

-- RFQ to Vendor traceability
CREATE OR REPLACE VIEW vw_rfq_vendor_traceability AS
SELECT 
  -- RFQ details
  r.id as rfq_id,
  r.rfq_number,
  r.customer_id,
  c.name as customer_name,
  
  -- RFQ items with client codes
  ri.id as rfq_item_id,
  ri.client_product_code,
  ri.our_product_code,
  p.name as our_product_name,
  ri.quantity as requested_quantity,
  
  -- Vendor RFQ details
  vrfq.id as vendor_rfq_id,
  vrfq.vendor_rfq_number,
  vrfq.supplier_id,
  s.name as supplier_name,
  
  -- Vendor quote details
  vq.id as vendor_quote_id,
  vq.vendor_quote_number,
  vqi.vendor_product_code,
  vqi.unit_price as vendor_unit_price,
  vqi.lead_time_days as vendor_lead_time,
  
  -- Rate analysis
  ra.id as rate_analysis_id,
  rai.selected_vendor_id,
  rai.selected_vendor_code,
  rai.selected_unit_price,
  
  -- Final quote to customer
  q.id as quote_id,
  q.quote_number,
  qi.unit_price as quoted_price_to_customer,
  
  -- Sales order
  so.id as sales_order_id,
  so.order_number as sales_order_number,
  soi.quantity_shipped,
  
  -- Purchase order
  po.id as purchase_order_id,
  po.po_number,
  poi.vendor_product_code as po_vendor_code,
  
  -- Traceability timestamps
  r.created_at as rfq_received_at,
  vrfq.sent_date as vendor_rfq_sent_at,
  vq.quote_date as vendor_quote_received_at,
  ra.analysis_date as rate_analysis_completed_at,
  q.quote_date as customer_quote_sent_at,
  so.order_date as sales_order_created_at,
  po.po_date as purchase_order_created_at

FROM rfqs r
JOIN companies c ON r.customer_id = c.id
LEFT JOIN rfq_items ri ON r.id = ri.rfq_id
LEFT JOIN products p ON ri.product_id = p.id

-- Vendor RFQ chain
LEFT JOIN vendor_rfqs vrfq ON r.id = vrfq.customer_rfq_id
LEFT JOIN companies s ON vrfq.supplier_id IN (SELECT id FROM suppliers WHERE company_id = s.id)
LEFT JOIN vendor_quotes vq ON vrfq.id = vq.vendor_rfq_id
LEFT JOIN vendor_quote_items vqi ON vq.id = vqi.vendor_quote_id AND vqi.product_id = ri.product_id

-- Rate analysis
LEFT JOIN rate_analysis ra ON r.id = ra.customer_rfq_id
LEFT JOIN rate_analysis_items rai ON ra.id = rai.rate_analysis_id AND rai.product_id = ri.product_id

-- Customer quote
LEFT JOIN quotes q ON r.id = q.rfq_id
LEFT JOIN quote_items qi ON q.id = qi.quote_id AND qi.product_id = ri.product_id

-- Sales order
LEFT JOIN sales_orders so ON q.id = so.quote_id
LEFT JOIN sales_order_items soi ON so.id = soi.sales_order_id AND soi.product_id = ri.product_id

-- Purchase order
LEFT JOIN purchase_orders po ON r.id IN (
  SELECT pr.id FROM purchase_requisitions pr WHERE pr.id = po.pr_id
)
LEFT JOIN purchase_order_items poi ON po.id = poi.po_id AND poi.product_id = ri.product_id

ORDER BY r.created_at DESC, ri.id;

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Client product codes
CREATE INDEX idx_client_product_codes_customer ON client_product_codes(customer_id);
CREATE INDEX idx_client_product_codes_our_product ON client_product_codes(our_product_id);
CREATE INDEX idx_client_product_codes_client_code ON client_product_codes(client_product_code);
CREATE INDEX idx_client_product_codes_active ON client_product_codes(is_active);

-- Vendor product codes
CREATE INDEX idx_vendor_product_codes_supplier ON vendor_product_codes(supplier_id);
CREATE INDEX idx_vendor_product_codes_our_product ON vendor_product_codes(our_product_id);
CREATE INDEX idx_vendor_product_codes_vendor_code ON vendor_product_codes(vendor_product_code);
CREATE INDEX idx_vendor_product_codes_active ON vendor_product_codes(is_active);
CREATE INDEX idx_vendor_product_codes_preferred ON vendor_product_codes(is_preferred);

-- Cross reference
CREATE INDEX idx_cross_ref_client ON product_code_cross_reference(client_product_code_id);
CREATE INDEX idx_cross_ref_our_product ON product_code_cross_reference(our_product_id);
CREATE INDEX idx_cross_ref_vendor ON product_code_cross_reference(vendor_product_code_id);
CREATE INDEX idx_cross_ref_customer ON product_code_cross_reference(customer_id);
CREATE INDEX idx_cross_ref_supplier ON product_code_cross_reference(supplier_id);

-- RFQ items product codes
CREATE INDEX idx_rfq_items_client_code ON rfq_items(client_product_code);
CREATE INDEX idx_rfq_items_our_code ON rfq_items(our_product_code);

-- Vendor RFQ items product codes
CREATE INDEX idx_vendor_rfq_items_client_code ON vendor_rfq_items(client_product_code);
CREATE INDEX idx_vendor_rfq_items_our_code ON vendor_rfq_items(our_product_code);
CREATE INDEX idx_vendor_rfq_items_vendor_code ON vendor_rfq_items(vendor_product_code);

-- ========================================
-- TRIGGERS FOR AUTO-UPDATES
-- ========================================

CREATE TRIGGER update_client_product_codes_updated_at BEFORE UPDATE ON client_product_codes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendor_product_codes_updated_at BEFORE UPDATE ON vendor_product_codes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Function to map client product code to our product
CREATE OR REPLACE FUNCTION map_client_product_code(
  p_customer_id UUID,
  p_client_code VARCHAR,
  p_our_product_id UUID,
  p_verified_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_mapping_id UUID;
BEGIN
  -- Insert or update client product code mapping
  INSERT INTO client_product_codes (
    customer_id,
    client_product_code,
    our_product_id,
    verified_by,
    verified_at
  )
  VALUES (
    p_customer_id,
    p_client_code,
    p_our_product_id,
    p_verified_by,
    CASE WHEN p_verified_by IS NOT NULL THEN NOW() ELSE NULL END
  )
  ON CONFLICT (customer_id, client_product_code)
  DO UPDATE SET
    our_product_id = EXCLUDED.our_product_id,
    verified_by = EXCLUDED.verified_by,
    verified_at = EXCLUDED.verified_at,
    updated_at = NOW()
  RETURNING id INTO v_mapping_id;
  
  RETURN v_mapping_id;
END;
$$ LANGUAGE plpgsql;

-- Function to map vendor product code to our product
CREATE OR REPLACE FUNCTION map_vendor_product_code(
  p_supplier_id UUID,
  p_vendor_code VARCHAR,
  p_our_product_id UUID,
  p_last_price DECIMAL DEFAULT NULL,
  p_lead_time_days INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_mapping_id UUID;
BEGIN
  -- Insert or update vendor product code mapping
  INSERT INTO vendor_product_codes (
    supplier_id,
    vendor_product_code,
    our_product_id,
    last_purchase_price,
    last_purchase_date,
    standard_lead_time_days
  )
  VALUES (
    p_supplier_id,
    p_vendor_code,
    p_our_product_id,
    p_last_price,
    CASE WHEN p_last_price IS NOT NULL THEN CURRENT_DATE ELSE NULL END,
    p_lead_time_days
  )
  ON CONFLICT (supplier_id, vendor_product_code)
  DO UPDATE SET
    our_product_id = EXCLUDED.our_product_id,
    last_purchase_price = COALESCE(EXCLUDED.last_purchase_price, vendor_product_codes.last_purchase_price),
    last_purchase_date = CASE 
      WHEN EXCLUDED.last_purchase_price IS NOT NULL THEN CURRENT_DATE 
      ELSE vendor_product_codes.last_purchase_date 
    END,
    standard_lead_time_days = COALESCE(EXCLUDED.standard_lead_time_days, vendor_product_codes.standard_lead_time_days),
    updated_at = NOW()
  RETURNING id INTO v_mapping_id;
  
  RETURN v_mapping_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create complete cross-reference
CREATE OR REPLACE FUNCTION create_product_cross_reference(
  p_customer_id UUID,
  p_client_code VARCHAR,
  p_our_product_id UUID,
  p_supplier_id UUID,
  p_vendor_code VARCHAR,
  p_mapped_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_client_code_id UUID;
  v_vendor_code_id UUID;
  v_cross_ref_id UUID;
  v_our_product_code VARCHAR;
BEGIN
  -- Get our product code
  SELECT sku INTO v_our_product_code FROM products WHERE id = p_our_product_id;
  
  -- Map client code
  v_client_code_id := map_client_product_code(p_customer_id, p_client_code, p_our_product_id, p_mapped_by);
  
  -- Map vendor code
  v_vendor_code_id := map_vendor_product_code(p_supplier_id, p_vendor_code, p_our_product_id);
  
  -- Create cross-reference
  INSERT INTO product_code_cross_reference (
    client_product_code_id,
    customer_id,
    client_code,
    our_product_id,
    our_product_code,
    vendor_product_code_id,
    supplier_id,
    vendor_code,
    mapped_by,
    is_verified
  )
  VALUES (
    v_client_code_id,
    p_customer_id,
    p_client_code,
    p_our_product_id,
    v_our_product_code,
    v_vendor_code_id,
    p_supplier_id,
    p_vendor_code,
    p_mapped_by,
    true
  )
  RETURNING id INTO v_cross_ref_id;
  
  RETURN v_cross_ref_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get vendor product codes for our product
CREATE OR REPLACE FUNCTION get_vendor_codes_for_product(
  p_our_product_id UUID,
  p_preferred_only BOOLEAN DEFAULT false
)
RETURNS TABLE (
  vendor_code_id UUID,
  supplier_id UUID,
  supplier_name VARCHAR,
  vendor_product_code VARCHAR,
  last_purchase_price DECIMAL,
  standard_lead_time_days INTEGER,
  is_preferred BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vpc.id,
    vpc.supplier_id,
    c.name,
    vpc.vendor_product_code,
    vpc.last_purchase_price,
    vpc.standard_lead_time_days,
    vpc.is_preferred
  FROM vendor_product_codes vpc
  JOIN suppliers s ON vpc.supplier_id = s.id
  JOIN companies c ON s.company_id = c.id
  WHERE vpc.our_product_id = p_our_product_id
    AND vpc.is_active = true
    AND s.is_approved = true
    AND (NOT p_preferred_only OR vpc.is_preferred = true)
  ORDER BY vpc.is_preferred DESC, vpc.last_purchase_price ASC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- COMMENTS FOR DOCUMENTATION
-- ========================================

COMMENT ON TABLE client_product_codes IS 'Customer part numbers mapped to our products for traceability';
COMMENT ON TABLE vendor_product_codes IS 'Supplier part numbers mapped to our products for sourcing traceability';
COMMENT ON TABLE product_code_cross_reference IS 'Complete traceability: Client Code → Our Code → Vendor Code';
COMMENT ON VIEW vw_product_traceability IS 'Complete product code traceability across customers and vendors';
COMMENT ON VIEW vw_rfq_vendor_traceability IS 'End-to-end traceability from customer RFQ to vendor fulfillment';
