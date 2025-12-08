-- Row Level Security Policies for Enhanced RFQ Workflow

-- Enable RLS on new tables
ALTER TABLE rfq_technical_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_rfq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_analysis_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_quote_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_pricing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;

-- ========================================
-- TECHNICAL QUALIFICATIONS
-- ========================================

-- Technical engineers can view and manage qualifications
CREATE POLICY "Technical engineers can view qualifications" ON rfq_technical_qualifications
  FOR SELECT USING (
    get_user_role() IN ('super_admin', 'ceo', 'director', 'sales_manager')
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('sales_executive', 'sales_manager')
    )
  );

CREATE POLICY "Technical engineers can manage qualifications" ON rfq_technical_qualifications
  FOR ALL USING (
    get_user_role() IN ('super_admin', 'ceo', 'director', 'sales_manager')
  );

-- ========================================
-- VENDOR RFQs
-- ========================================

-- Purchase team can view and manage vendor RFQs
CREATE POLICY "Purchase team can view vendor RFQs" ON vendor_rfqs
  FOR SELECT USING (
    get_user_role() IN ('purchase_executive', 'procurement_manager', 'super_admin', 'ceo', 'director')
  );

CREATE POLICY "Purchase team can manage vendor RFQs" ON vendor_rfqs
  FOR ALL USING (
    get_user_role() IN ('purchase_executive', 'procurement_manager', 'super_admin', 'ceo', 'director')
  );

-- Suppliers can view their assigned vendor RFQs
CREATE POLICY "Suppliers can view own vendor RFQs" ON vendor_rfqs
  FOR SELECT USING (
    supplier_id IN (
      SELECT id FROM suppliers WHERE company_id = get_user_company()
    )
  );

-- ========================================
-- VENDOR RFQ ITEMS
-- ========================================

-- Purchase team can view vendor RFQ items
CREATE POLICY "Purchase team can view vendor RFQ items" ON vendor_rfq_items
  FOR SELECT USING (
    get_user_role() IN ('purchase_executive', 'procurement_manager', 'super_admin', 'ceo', 'director')
  );

-- Suppliers can view items for their vendor RFQs
CREATE POLICY "Suppliers can view own vendor RFQ items" ON vendor_rfq_items
  FOR SELECT USING (
    vendor_rfq_id IN (
      SELECT id FROM vendor_rfqs 
      WHERE supplier_id IN (
        SELECT id FROM suppliers WHERE company_id = get_user_company()
      )
    )
  );

-- ========================================
-- VENDOR QUOTES
-- ========================================

-- Purchase team can view all vendor quotes
CREATE POLICY "Purchase team can view vendor quotes" ON vendor_quotes
  FOR SELECT USING (
    get_user_role() IN ('purchase_executive', 'procurement_manager', 'super_admin', 'ceo', 'director')
  );

CREATE POLICY "Purchase team can manage vendor quotes" ON vendor_quotes
  FOR ALL USING (
    get_user_role() IN ('purchase_executive', 'procurement_manager', 'super_admin', 'ceo', 'director')
  );

-- Suppliers can view and create their own quotes
CREATE POLICY "Suppliers can view own quotes" ON vendor_quotes
  FOR SELECT USING (
    supplier_id IN (
      SELECT id FROM suppliers WHERE company_id = get_user_company()
    )
  );

CREATE POLICY "Suppliers can create quotes" ON vendor_quotes
  FOR INSERT WITH CHECK (
    supplier_id IN (
      SELECT id FROM suppliers WHERE company_id = get_user_company()
    )
  );

-- ========================================
-- VENDOR QUOTE ITEMS
-- ========================================

-- Purchase team can view vendor quote items
CREATE POLICY "Purchase team can view vendor quote items" ON vendor_quote_items
  FOR SELECT USING (
    get_user_role() IN ('purchase_executive', 'procurement_manager', 'super_admin', 'ceo', 'director')
  );

-- Suppliers can view their quote items
CREATE POLICY "Suppliers can view own quote items" ON vendor_quote_items
  FOR SELECT USING (
    vendor_quote_id IN (
      SELECT id FROM vendor_quotes 
      WHERE supplier_id IN (
        SELECT id FROM suppliers WHERE company_id = get_user_company()
      )
    )
  );

-- ========================================
-- RATE ANALYSIS
-- ========================================

-- Purchase and sales teams can view rate analysis
CREATE POLICY "Purchase and sales can view rate analysis" ON rate_analysis
  FOR SELECT USING (
    get_user_role() IN (
      'purchase_executive', 'procurement_manager', 
      'sales_executive', 'sales_manager',
      'super_admin', 'ceo', 'director'
    )
  );

CREATE POLICY "Purchase team can manage rate analysis" ON rate_analysis
  FOR ALL USING (
    get_user_role() IN ('purchase_executive', 'procurement_manager', 'super_admin', 'ceo', 'director')
  );

-- ========================================
-- RATE ANALYSIS ITEMS
-- ========================================

CREATE POLICY "Purchase and sales can view rate analysis items" ON rate_analysis_items
  FOR SELECT USING (
    get_user_role() IN (
      'purchase_executive', 'procurement_manager', 
      'sales_executive', 'sales_manager',
      'super_admin', 'ceo', 'director'
    )
  );

CREATE POLICY "Purchase team can manage rate analysis items" ON rate_analysis_items
  FOR ALL USING (
    get_user_role() IN ('purchase_executive', 'procurement_manager', 'super_admin', 'ceo', 'director')
  );

-- ========================================
-- VENDOR QUOTE SCORES
-- ========================================

CREATE POLICY "Purchase and management can view scores" ON vendor_quote_scores
  FOR SELECT USING (
    get_user_role() IN (
      'purchase_executive', 'procurement_manager',
      'sales_manager', 'super_admin', 'ceo', 'director'
    )
  );

-- ========================================
-- SALES PRICING
-- ========================================

-- Sales and management can view pricing
CREATE POLICY "Sales and management can view pricing" ON sales_pricing
  FOR SELECT USING (
    get_user_role() IN (
      'sales_executive', 'sales_manager',
      'super_admin', 'ceo', 'director'
    )
  );

-- Sales can create pricing submissions
CREATE POLICY "Sales can create pricing" ON sales_pricing
  FOR INSERT WITH CHECK (
    get_user_role() IN ('sales_executive', 'sales_manager', 'super_admin')
  );

-- Management can approve pricing
CREATE POLICY "Management can update pricing" ON sales_pricing
  FOR UPDATE USING (
    get_user_role() IN ('super_admin', 'ceo', 'director')
  );

-- ========================================
-- SALES PRICING ITEMS
-- ========================================

CREATE POLICY "Sales and management can view pricing items" ON sales_pricing_items
  FOR SELECT USING (
    get_user_role() IN (
      'sales_executive', 'sales_manager',
      'super_admin', 'ceo', 'director'
    )
  );

-- ========================================
-- APPROVAL REQUESTS
-- ========================================

-- Users can view approvals assigned to them
CREATE POLICY "Users can view assigned approvals" ON approval_requests
  FOR SELECT USING (
    assigned_to = auth.uid()
    OR requested_by = auth.uid()
    OR get_user_role() IN ('super_admin', 'ceo', 'director')
  );

-- Users can update approvals assigned to them
CREATE POLICY "Users can update assigned approvals" ON approval_requests
  FOR UPDATE USING (
    assigned_to = auth.uid()
    OR get_user_role() IN ('super_admin', 'ceo', 'director')
  );

-- System can create approval requests
CREATE POLICY "System can create approvals" ON approval_requests
  FOR INSERT WITH CHECK (true);

-- ========================================
-- APPROVAL HISTORY
-- ========================================

-- Users can view approval history for their approvals
CREATE POLICY "Users can view approval history" ON approval_history
  FOR SELECT USING (
    approval_request_id IN (
      SELECT id FROM approval_requests 
      WHERE assigned_to = auth.uid() 
         OR requested_by = auth.uid()
         OR get_user_role() IN ('super_admin', 'ceo', 'director')
    )
  );

-- System can log approval history
CREATE POLICY "System can log history" ON approval_history
  FOR INSERT WITH CHECK (true);
