-- Enhanced RFQ & Quote Workflow Schema
-- Adds: Technical qualification, Vendor RFQ, Rate analysis, Multi-level approvals

-- ========================================
-- TECHNICAL QUALIFICATION
-- ========================================

CREATE TYPE technical_status AS ENUM (
  'pending',
  'under_review',
  'qualified',
  'rejected',
  'more_info_needed'
);

-- Technical qualification of customer RFQs
CREATE TABLE rfq_technical_qualifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id UUID REFERENCES rfqs(id) ON DELETE CASCADE NOT NULL,
  qualified_by UUID REFERENCES profiles(id),
  status technical_status DEFAULT 'pending',
  technical_notes TEXT,
  specifications_reviewed BOOLEAN DEFAULT false,
  feasibility_confirmed BOOLEAN DEFAULT false,
  special_requirements TEXT,
  estimated_delivery_days INTEGER,
  rejection_reason TEXT,
  qualified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- VENDOR RFQ SYSTEM
-- ========================================

CREATE TYPE vendor_rfq_status AS ENUM (
  'draft',
  'sent_to_vendor',
  'acknowledged',
  'quoted',
  'rejected',
  'expired'
);

-- Vendor RFQs (sent to suppliers for quotes)
CREATE TABLE vendor_rfqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_rfq_number VARCHAR(50) UNIQUE NOT NULL,
  customer_rfq_id UUID REFERENCES rfqs(id) NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  purchase_handler_id UUID REFERENCES profiles(id), -- Purchase dept handler
  status vendor_rfq_status DEFAULT 'draft',
  sent_date DATE,
  response_due_date DATE,
  terms_and_conditions TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vendor RFQ line items
CREATE TABLE vendor_rfq_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_rfq_id UUID REFERENCES vendor_rfqs(id) ON DELETE CASCADE,
  customer_rfq_item_id UUID REFERENCES rfq_items(id),
  product_id UUID REFERENCES products(id),
  product_description TEXT,
  quantity DECIMAL(10, 2) NOT NULL,
  uom VARCHAR(50),
  required_by_date DATE,
  technical_specs JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vendor quotes received
CREATE TABLE vendor_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_quote_number VARCHAR(50) NOT NULL,
  vendor_rfq_id UUID REFERENCES vendor_rfqs(id) NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  quote_date DATE NOT NULL,
  valid_until DATE,
  currency VARCHAR(3) DEFAULT 'INR',
  subtotal DECIMAL(15, 2),
  tax_amount DECIMAL(15, 2),
  freight_charges DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2),
  payment_terms VARCHAR(255),
  delivery_terms VARCHAR(255),
  lead_time_days INTEGER,
  notes TEXT,
  attachments JSONB, -- Array of file URLs
  received_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vendor quote line items
CREATE TABLE vendor_quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_quote_id UUID REFERENCES vendor_quotes(id) ON DELETE CASCADE,
  vendor_rfq_item_id UUID REFERENCES vendor_rfq_items(id),
  product_id UUID REFERENCES products(id),
  product_name VARCHAR(500),
  description TEXT,
  quantity DECIMAL(10, 2) NOT NULL,
  uom VARCHAR(50),
  unit_price DECIMAL(15, 2) NOT NULL,
  discount_percent DECIMAL(5, 2) DEFAULT 0,
  discount_amount DECIMAL(15, 2) DEFAULT 0,
  tax_rate DECIMAL(5, 2),
  tax_amount DECIMAL(15, 2),
  line_total DECIMAL(15, 2) NOT NULL,
  lead_time_days INTEGER,
  brand_offered VARCHAR(255),
  specifications_met BOOLEAN DEFAULT true,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- RATE ANALYSIS & COMPARISON
-- ========================================

CREATE TYPE analysis_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'approved'
);

-- Rate comparison analysis
CREATE TABLE rate_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_rfq_id UUID REFERENCES rfqs(id) NOT NULL,
  analysis_number VARCHAR(50) UNIQUE NOT NULL,
  status analysis_status DEFAULT 'pending',
  analyzed_by UUID REFERENCES profiles(id),
  analysis_date DATE,
  
  -- Criteria weights
  price_weightage DECIMAL(5, 2) DEFAULT 60, -- Percentage
  quality_weightage DECIMAL(5, 2) DEFAULT 20,
  delivery_weightage DECIMAL(5, 2) DEFAULT 15,
  payment_terms_weightage DECIMAL(5, 2) DEFAULT 5,
  
  recommendations TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Detailed comparison per item across vendors
CREATE TABLE rate_analysis_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rate_analysis_id UUID REFERENCES rate_analysis(id) ON DELETE CASCADE,
  customer_rfq_item_id UUID REFERENCES rfq_items(id),
  product_id UUID REFERENCES products(id),
  product_name VARCHAR(500),
  quantity DECIMAL(10, 2),
  
  -- Best offer details
  recommended_vendor_id UUID REFERENCES suppliers(id),
  recommended_vendor_quote_item_id UUID REFERENCES vendor_quote_items(id),
  recommended_unit_price DECIMAL(15, 2),
  recommended_total_price DECIMAL(15, 2),
  recommendation_reason TEXT,
  
  -- Override capability
  overridden BOOLEAN DEFAULT false,
  override_vendor_id UUID REFERENCES suppliers(id),
  override_vendor_quote_item_id UUID REFERENCES vendor_quote_items(id),
  override_unit_price DECIMAL(15, 2),
  override_total_price DECIMAL(15, 2),
  override_reason TEXT,
  overridden_by UUID REFERENCES profiles(id),
  overridden_at TIMESTAMP WITH TIME ZONE,
  
  -- Final selection
  selected_vendor_id UUID REFERENCES suppliers(id),
  selected_vendor_quote_item_id UUID REFERENCES vendor_quote_items(id),
  selected_unit_price DECIMAL(15, 2),
  selected_total_price DECIMAL(15, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vendor scoring for selection
CREATE TABLE vendor_quote_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rate_analysis_item_id UUID REFERENCES rate_analysis_items(id) ON DELETE CASCADE,
  vendor_quote_item_id UUID REFERENCES vendor_quote_items(id) NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  
  -- Individual scores (0-100)
  price_score DECIMAL(5, 2),
  quality_score DECIMAL(5, 2),
  delivery_score DECIMAL(5, 2),
  payment_terms_score DECIMAL(5, 2),
  
  -- Weighted total score
  total_weighted_score DECIMAL(5, 2),
  rank INTEGER,
  
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- PROFIT MARGIN & PRICING
-- ========================================

CREATE TYPE pricing_status AS ENUM (
  'pending_approval',
  'approved',
  'rejected',
  'revision_required'
);

-- Sales pricing with profit margin
CREATE TABLE sales_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_rfq_id UUID REFERENCES rfqs(id) NOT NULL,
  rate_analysis_id UUID REFERENCES rate_analysis(id),
  pricing_number VARCHAR(50) UNIQUE NOT NULL,
  status pricing_status DEFAULT 'pending_approval',
  
  -- Cost breakdown
  total_purchase_cost DECIMAL(15, 2) NOT NULL,
  freight_cost DECIMAL(15, 2) DEFAULT 0,
  handling_cost DECIMAL(15, 2) DEFAULT 0,
  other_costs DECIMAL(15, 2) DEFAULT 0,
  total_cost DECIMAL(15, 2) NOT NULL,
  
  -- Margin & pricing
  target_margin_percent DECIMAL(5, 2),
  approved_margin_percent DECIMAL(5, 2),
  sales_price DECIMAL(15, 2),
  
  -- Approvals
  submitted_by UUID REFERENCES profiles(id),
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES profiles(id), -- CEO/Director
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales pricing line items
CREATE TABLE sales_pricing_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_pricing_id UUID REFERENCES sales_pricing(id) ON DELETE CASCADE,
  customer_rfq_item_id UUID REFERENCES rfq_items(id),
  rate_analysis_item_id UUID REFERENCES rate_analysis_items(id),
  product_id UUID REFERENCES products(id),
  product_name VARCHAR(500),
  quantity DECIMAL(10, 2) NOT NULL,
  uom VARCHAR(50),
  
  -- Purchase cost
  purchase_unit_cost DECIMAL(15, 2) NOT NULL,
  purchase_total_cost DECIMAL(15, 2) NOT NULL,
  
  -- Additional costs
  freight_per_unit DECIMAL(15, 2) DEFAULT 0,
  handling_per_unit DECIMAL(15, 2) DEFAULT 0,
  other_cost_per_unit DECIMAL(15, 2) DEFAULT 0,
  
  -- Total cost
  total_unit_cost DECIMAL(15, 2) NOT NULL,
  total_cost DECIMAL(15, 2) NOT NULL,
  
  -- Margin
  margin_percent DECIMAL(5, 2),
  margin_amount DECIMAL(15, 2),
  
  -- Sales price
  sales_unit_price DECIMAL(15, 2) NOT NULL,
  sales_total_price DECIMAL(15, 2) NOT NULL,
  
  -- Tax
  tax_rate DECIMAL(5, 2),
  tax_amount DECIMAL(15, 2),
  
  -- Final
  final_unit_price DECIMAL(15, 2) NOT NULL,
  final_line_total DECIMAL(15, 2) NOT NULL,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- APPROVAL WORKFLOWS
-- ========================================

CREATE TYPE approval_type AS ENUM (
  'technical_qualification',
  'rate_analysis',
  'pricing_approval',
  'quote_approval'
);

CREATE TYPE approval_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'escalated',
  'cancelled'
);

-- Approval records
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  approval_type approval_type NOT NULL,
  reference_type VARCHAR(50) NOT NULL, -- 'RFQ', 'Rate Analysis', 'Sales Pricing'
  reference_id UUID NOT NULL,
  status approval_status DEFAULT 'pending',
  
  -- Approval hierarchy
  approval_level INTEGER DEFAULT 1,
  required_role user_role,
  assigned_to UUID REFERENCES profiles(id),
  
  -- Timeline
  requested_by UUID REFERENCES profiles(id),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date DATE,
  
  -- Response
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  decision approval_status,
  comments TEXT,
  
  -- Escalation
  escalated_to UUID REFERENCES profiles(id),
  escalated_at TIMESTAMP WITH TIME ZONE,
  escalation_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Approval history
CREATE TABLE approval_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  approval_request_id UUID REFERENCES approval_requests(id) ON DELETE CASCADE,
  previous_status approval_status,
  new_status approval_status,
  changed_by UUID REFERENCES profiles(id),
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- ENHANCED QUOTE EXTENSIONS
-- ========================================

-- Link quotes to sales pricing
ALTER TABLE quotes ADD COLUMN sales_pricing_id UUID REFERENCES sales_pricing(id);
ALTER TABLE quotes ADD COLUMN customer_approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE quotes ADD COLUMN customer_approved_by UUID REFERENCES profiles(id);
ALTER TABLE quotes ADD COLUMN customer_rejection_reason TEXT;

-- Link RFQs to technical qualification
ALTER TABLE rfqs ADD COLUMN technical_qualification_id UUID REFERENCES rfq_technical_qualifications(id);
ALTER TABLE rfqs ADD COLUMN purchase_handler_id UUID REFERENCES profiles(id);
ALTER TABLE rfqs ADD COLUMN rate_analysis_id UUID REFERENCES rate_analysis(id);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Technical qualifications
CREATE INDEX idx_tech_qual_rfq ON rfq_technical_qualifications(rfq_id);
CREATE INDEX idx_tech_qual_status ON rfq_technical_qualifications(status);

-- Vendor RFQs
CREATE INDEX idx_vendor_rfq_customer ON vendor_rfqs(customer_rfq_id);
CREATE INDEX idx_vendor_rfq_supplier ON vendor_rfqs(supplier_id);
CREATE INDEX idx_vendor_rfq_status ON vendor_rfqs(status);
CREATE INDEX idx_vendor_rfq_handler ON vendor_rfqs(purchase_handler_id);

-- Vendor quotes
CREATE INDEX idx_vendor_quote_rfq ON vendor_quotes(vendor_rfq_id);
CREATE INDEX idx_vendor_quote_supplier ON vendor_quotes(supplier_id);

-- Rate analysis
CREATE INDEX idx_rate_analysis_rfq ON rate_analysis(customer_rfq_id);
CREATE INDEX idx_rate_analysis_status ON rate_analysis(status);

-- Sales pricing
CREATE INDEX idx_sales_pricing_rfq ON sales_pricing(customer_rfq_id);
CREATE INDEX idx_sales_pricing_status ON sales_pricing(status);

-- Approvals
CREATE INDEX idx_approval_reference ON approval_requests(reference_type, reference_id);
CREATE INDEX idx_approval_assigned ON approval_requests(assigned_to);
CREATE INDEX idx_approval_status ON approval_requests(status);

-- ========================================
-- TRIGGERS FOR AUTO-UPDATES
-- ========================================

CREATE TRIGGER update_tech_qual_updated_at BEFORE UPDATE ON rfq_technical_qualifications 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendor_rfq_updated_at BEFORE UPDATE ON vendor_rfqs 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendor_quote_updated_at BEFORE UPDATE ON vendor_quotes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_analysis_updated_at BEFORE UPDATE ON rate_analysis 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_pricing_updated_at BEFORE UPDATE ON sales_pricing 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_approval_requests_updated_at BEFORE UPDATE ON approval_requests 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
