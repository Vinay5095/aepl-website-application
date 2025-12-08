-- RLS Policies for Product Code Traceability Tables

-- Enable RLS
ALTER TABLE client_product_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_product_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_code_cross_reference ENABLE ROW LEVEL SECURITY;

-- ========================================
-- CLIENT PRODUCT CODES
-- ========================================

-- Customers can view their own product codes
CREATE POLICY "Customers can view own product codes" ON client_product_codes
  FOR SELECT USING (
    customer_id = get_user_company()
    OR get_user_role() IN ('sales_executive', 'sales_manager', 'purchase_executive', 'procurement_manager', 'super_admin', 'ceo', 'director')
  );

-- Internal users can manage client product codes
CREATE POLICY "Internal users can manage client codes" ON client_product_codes
  FOR ALL USING (
    get_user_role() IN ('sales_executive', 'sales_manager', 'purchase_executive', 'procurement_manager', 'super_admin', 'ceo', 'director')
  );

-- ========================================
-- VENDOR PRODUCT CODES
-- ========================================

-- Suppliers can view their own product codes
CREATE POLICY "Suppliers can view own product codes" ON vendor_product_codes
  FOR SELECT USING (
    supplier_id IN (SELECT id FROM suppliers WHERE company_id = get_user_company())
    OR get_user_role() IN ('purchase_executive', 'procurement_manager', 'sales_executive', 'sales_manager', 'super_admin', 'ceo', 'director')
  );

-- Purchase team can manage vendor product codes
CREATE POLICY "Purchase team can manage vendor codes" ON vendor_product_codes
  FOR ALL USING (
    get_user_role() IN ('purchase_executive', 'procurement_manager', 'super_admin', 'ceo', 'director')
  );

-- Suppliers can update their own codes
CREATE POLICY "Suppliers can update own codes" ON vendor_product_codes
  FOR UPDATE USING (
    supplier_id IN (SELECT id FROM suppliers WHERE company_id = get_user_company())
  );

-- ========================================
-- PRODUCT CODE CROSS REFERENCE
-- ========================================

-- Customers can view their product cross-references
CREATE POLICY "Customers can view own cross references" ON product_code_cross_reference
  FOR SELECT USING (
    customer_id = get_user_company()
    OR get_user_role() IN ('sales_executive', 'sales_manager', 'purchase_executive', 'procurement_manager', 'super_admin', 'ceo', 'director')
  );

-- Suppliers can view cross-references for their products
CREATE POLICY "Suppliers can view relevant cross references" ON product_code_cross_reference
  FOR SELECT USING (
    supplier_id IN (SELECT id FROM suppliers WHERE company_id = get_user_company())
    OR get_user_role() IN ('purchase_executive', 'procurement_manager', 'sales_executive', 'sales_manager', 'super_admin', 'ceo', 'director')
  );

-- Internal users can manage cross-references
CREATE POLICY "Internal users can manage cross references" ON product_code_cross_reference
  FOR ALL USING (
    get_user_role() IN ('sales_executive', 'sales_manager', 'purchase_executive', 'procurement_manager', 'super_admin', 'ceo', 'director')
  );
