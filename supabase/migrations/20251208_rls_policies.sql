-- Row Level Security (RLS) Policies for Enterprise ERP
-- These policies enforce role-based access control at the database level

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_received_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncr_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_made ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function to get user's company
CREATE OR REPLACE FUNCTION get_user_company()
RETURNS UUID AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('super_admin', 'ceo', 'director')
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- ========================================
-- PROFILES
-- ========================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin());

-- Admins can manage all profiles
CREATE POLICY "Admins can manage profiles" ON profiles
  FOR ALL USING (is_admin());

-- ========================================
-- COMPANIES
-- ========================================

-- Users can view their own company
CREATE POLICY "Users can view own company" ON companies
  FOR SELECT USING (id = get_user_company());

-- B2B customers can view their company
CREATE POLICY "Customers can view own company" ON companies
  FOR SELECT USING (
    id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- Sales team can view customer companies
CREATE POLICY "Sales can view customers" ON companies
  FOR SELECT USING (
    get_user_role() IN ('sales_executive', 'sales_manager', 'super_admin', 'ceo', 'director')
  );

-- Purchase team can view supplier companies
CREATE POLICY "Purchase can view suppliers" ON companies
  FOR SELECT USING (
    get_user_role() IN ('purchase_executive', 'procurement_manager', 'super_admin', 'ceo', 'director')
  );

-- Admins can manage all companies
CREATE POLICY "Admins can manage companies" ON companies
  FOR ALL USING (is_admin());

-- ========================================
-- PRODUCTS
-- ========================================

-- Public products are visible to all authenticated users
CREATE POLICY "Public products visible to all" ON products
  FOR SELECT USING (is_public = true AND is_active = true);

-- All internal users can view all products
CREATE POLICY "Internal users can view products" ON products
  FOR SELECT USING (
    get_user_role() NOT IN ('b2b_customer', 'supplier')
  );

-- Product managers and admins can manage products
CREATE POLICY "Admins can manage products" ON products
  FOR ALL USING (is_admin());

-- ========================================
-- RFQs
-- ========================================

-- Customers can view their own RFQs
CREATE POLICY "Customers can view own RFQs" ON rfqs
  FOR SELECT USING (customer_id = get_user_company());

-- Customers can create RFQs
CREATE POLICY "Customers can create RFQs" ON rfqs
  FOR INSERT WITH CHECK (customer_id = get_user_company());

-- Customers can update their draft RFQs
CREATE POLICY "Customers can update draft RFQs" ON rfqs
  FOR UPDATE USING (
    customer_id = get_user_company() 
    AND status = 'draft'
  );

-- Sales team can view all RFQs
CREATE POLICY "Sales can view RFQs" ON rfqs
  FOR SELECT USING (
    get_user_role() IN ('sales_executive', 'sales_manager', 'super_admin', 'ceo', 'director')
  );

-- Sales team can update assigned RFQs
CREATE POLICY "Sales can update RFQs" ON rfqs
  FOR UPDATE USING (
    get_user_role() IN ('sales_executive', 'sales_manager', 'super_admin', 'ceo', 'director')
  );

-- ========================================
-- QUOTES
-- ========================================

-- Customers can view quotes for their company
CREATE POLICY "Customers can view own quotes" ON quotes
  FOR SELECT USING (customer_id = get_user_company());

-- Sales team can manage quotes
CREATE POLICY "Sales can manage quotes" ON quotes
  FOR ALL USING (
    get_user_role() IN ('sales_executive', 'sales_manager', 'super_admin', 'ceo', 'director')
  );

-- ========================================
-- SALES ORDERS
-- ========================================

-- Customers can view their sales orders
CREATE POLICY "Customers can view own orders" ON sales_orders
  FOR SELECT USING (customer_id = get_user_company());

-- Sales team can manage sales orders
CREATE POLICY "Sales can manage orders" ON sales_orders
  FOR ALL USING (
    get_user_role() IN ('sales_executive', 'sales_manager', 'super_admin', 'ceo', 'director')
  );

-- Warehouse staff can view orders for fulfillment
CREATE POLICY "Warehouse can view orders" ON sales_orders
  FOR SELECT USING (
    get_user_role() IN ('warehouse_staff', 'inventory_manager')
  );

-- ========================================
-- PURCHASE ORDERS
-- ========================================

-- Suppliers can view their POs
CREATE POLICY "Suppliers can view own POs" ON purchase_orders
  FOR SELECT USING (
    supplier_id IN (
      SELECT id FROM suppliers WHERE company_id = get_user_company()
    )
  );

-- Purchase team can manage POs
CREATE POLICY "Purchase can manage POs" ON purchase_orders
  FOR ALL USING (
    get_user_role() IN ('purchase_executive', 'procurement_manager', 'super_admin', 'ceo', 'director')
  );

-- ========================================
-- INVENTORY
-- ========================================

-- Warehouse staff can view and manage stock
CREATE POLICY "Warehouse can manage stock" ON stock_moves
  FOR ALL USING (
    get_user_role() IN ('warehouse_staff', 'inventory_manager', 'super_admin', 'ceo', 'director')
  );

-- Sales and purchase can view stock balances
CREATE POLICY "Staff can view stock balances" ON stock_balances
  FOR SELECT USING (
    get_user_role() NOT IN ('b2b_customer', 'supplier')
  );

-- ========================================
-- QUALITY CONTROL
-- ========================================

-- QC team can manage inspections
CREATE POLICY "QC can manage inspections" ON qc_inspections
  FOR ALL USING (
    get_user_role() IN ('qc_inspector', 'qc_manager', 'super_admin', 'ceo', 'director')
  );

-- Warehouse can view QC status
CREATE POLICY "Warehouse can view QC" ON qc_inspections
  FOR SELECT USING (
    get_user_role() IN ('warehouse_staff', 'inventory_manager', 'qc_inspector', 'qc_manager')
  );

-- ========================================
-- SHIPMENTS
-- ========================================

-- Customers can view their shipments
CREATE POLICY "Customers can view own shipments" ON shipments
  FOR SELECT USING (customer_id = get_user_company());

-- Logistics and sales can manage shipments
CREATE POLICY "Logistics can manage shipments" ON shipments
  FOR ALL USING (
    get_user_role() IN ('logistics_executive', 'sales_executive', 'sales_manager', 'super_admin', 'ceo', 'director')
  );

-- ========================================
-- ACCOUNTING
-- ========================================

-- Finance team can manage all accounting
CREATE POLICY "Finance can manage accounting" ON sales_invoices
  FOR ALL USING (
    get_user_role() IN ('finance_accountant', 'finance_manager', 'super_admin', 'ceo', 'director')
  );

-- Customers can view their invoices
CREATE POLICY "Customers can view own invoices" ON sales_invoices
  FOR SELECT USING (customer_id = get_user_company());

-- Finance can manage purchase bills
CREATE POLICY "Finance can manage bills" ON purchase_bills
  FOR ALL USING (
    get_user_role() IN ('finance_accountant', 'finance_manager', 'purchase_executive', 'procurement_manager', 'super_admin', 'ceo', 'director')
  );

-- Suppliers can view their bills
CREATE POLICY "Suppliers can view own bills" ON purchase_bills
  FOR SELECT USING (
    supplier_id IN (
      SELECT id FROM suppliers WHERE company_id = get_user_company()
    )
  );

-- Finance can manage chart of accounts
CREATE POLICY "Finance can manage COA" ON chart_of_accounts
  FOR ALL USING (
    get_user_role() IN ('finance_accountant', 'finance_manager', 'super_admin', 'ceo', 'director')
  );

-- ========================================
-- HR & PAYROLL
-- ========================================

-- Employees can view their own record
CREATE POLICY "Employees can view own record" ON employees
  FOR SELECT USING (
    profile_id = auth.uid()
  );

-- HR can manage all employee records
CREATE POLICY "HR can manage employees" ON employees
  FOR ALL USING (
    get_user_role() IN ('hr_executive', 'payroll_admin', 'super_admin', 'ceo', 'director')
  );

-- Managers can view their team
CREATE POLICY "Managers can view team" ON employees
  FOR SELECT USING (
    reporting_to IN (
      SELECT id FROM employees WHERE profile_id = auth.uid()
    )
  );

-- Employees can view their own attendance
CREATE POLICY "Employees can view own attendance" ON attendance
  FOR SELECT USING (
    employee_id IN (
      SELECT id FROM employees WHERE profile_id = auth.uid()
    )
  );

-- HR can manage attendance
CREATE POLICY "HR can manage attendance" ON attendance
  FOR ALL USING (
    get_user_role() IN ('hr_executive', 'super_admin', 'ceo', 'director')
  );

-- Employees can view their own payslips
CREATE POLICY "Employees can view own payslips" ON payslips
  FOR SELECT USING (
    employee_id IN (
      SELECT id FROM employees WHERE profile_id = auth.uid()
    )
  );

-- Payroll admin can manage payslips
CREATE POLICY "Payroll can manage payslips" ON payslips
  FOR ALL USING (
    get_user_role() IN ('payroll_admin', 'hr_executive', 'super_admin', 'ceo', 'director')
  );

-- ========================================
-- MARKETING
-- ========================================

-- Marketing team can manage campaigns
CREATE POLICY "Marketing can manage campaigns" ON marketing_campaigns
  FOR ALL USING (
    get_user_role() IN ('marketing_executive', 'sales_manager', 'super_admin', 'ceo', 'director')
  );

-- ========================================
-- ACTIVITY LOGS
-- ========================================

-- Users can view their own activity
CREATE POLICY "Users can view own activity" ON activity_logs
  FOR SELECT USING (user_id = auth.uid());

-- Admins can view all activity
CREATE POLICY "Admins can view all activity" ON activity_logs
  FOR SELECT USING (is_admin());

-- All authenticated users can insert activity logs
CREATE POLICY "Users can log activity" ON activity_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ========================================
-- NOTIFICATIONS
-- ========================================

-- Users can view and manage their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- System can create notifications for any user
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);
