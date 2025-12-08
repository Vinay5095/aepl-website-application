-- Enterprise ERP Database Schema for Industrial Business Operations
-- Version: 1.0
-- Date: 2025-12-08

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- CORE: ROLES & PERMISSIONS
-- ========================================

CREATE TYPE user_role AS ENUM (
  'super_admin',
  'ceo',
  'director',
  'sales_executive',
  'sales_manager',
  'purchase_executive',
  'procurement_manager',
  'warehouse_staff',
  'inventory_manager',
  'qc_inspector',
  'qc_manager',
  'logistics_executive',
  'finance_accountant',
  'finance_manager',
  'hr_executive',
  'payroll_admin',
  'marketing_executive',
  'b2b_customer',
  'supplier'
);

-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'b2b_customer',
  full_name VARCHAR(255),
  phone VARCHAR(20),
  avatar_url TEXT,
  company_id UUID,
  department VARCHAR(100),
  designation VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Companies (for B2B customers and internal company)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  company_type VARCHAR(50), -- 'internal', 'customer', 'supplier'
  gst_number VARCHAR(15),
  pan_number VARCHAR(10),
  tan_number VARCHAR(10),
  cin_number VARCHAR(21),
  email VARCHAR(255),
  phone VARCHAR(20),
  website VARCHAR(255),
  logo_url TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'India',
  postal_code VARCHAR(10),
  is_active BOOLEAN DEFAULT true,
  credit_limit DECIMAL(15, 2),
  payment_terms_days INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- PRODUCT CATALOG MODULE
-- ========================================

-- Product categories
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  parent_id UUID REFERENCES product_categories(id),
  description TEXT,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product brands
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  logo_url TEXT,
  website VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products master
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(500) NOT NULL,
  slug VARCHAR(500) UNIQUE NOT NULL,
  brand_id UUID REFERENCES brands(id),
  category_id UUID REFERENCES product_categories(id),
  model VARCHAR(255),
  short_description TEXT,
  long_description TEXT,
  
  -- Technical specifications (JSONB for flexibility)
  technical_specs JSONB,
  
  -- Packaging & UOM
  base_uom VARCHAR(50) DEFAULT 'PCS',
  moq INTEGER DEFAULT 1,
  increment INTEGER DEFAULT 1,
  package_weight DECIMAL(10, 3),
  package_dimensions JSONB, -- {length, width, height, unit}
  
  -- Inventory
  track_inventory BOOLEAN DEFAULT true,
  
  -- Pricing
  base_price DECIMAL(15, 2),
  currency VARCHAR(3) DEFAULT 'INR',
  
  -- Tax
  hsn_code VARCHAR(8),
  gst_rate DECIMAL(5, 2),
  cess_rate DECIMAL(5, 2) DEFAULT 0,
  
  -- Visibility
  is_public BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  -- SEO
  meta_title VARCHAR(500),
  meta_description TEXT,
  meta_keywords TEXT,
  
  -- Images
  primary_image_url TEXT,
  image_urls JSONB, -- Array of image URLs
  
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product documents (TDS, MSDS, COA, COC, Certificates)
CREATE TABLE product_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  document_type VARCHAR(50), -- 'TDS', 'MSDS', 'COA', 'COC', 'Certificate', 'Other'
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  visibility VARCHAR(20) DEFAULT 'public', -- 'public', 'private', 'customer_specific'
  description TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product pricing tiers
CREATE TABLE product_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES companies(id),
  min_quantity INTEGER DEFAULT 1,
  max_quantity INTEGER,
  price DECIMAL(15, 2) NOT NULL,
  discount_percent DECIMAL(5, 2) DEFAULT 0,
  valid_from DATE,
  valid_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- RFQ & QUOTE MODULE
-- ========================================

CREATE TYPE rfq_status AS ENUM (
  'draft',
  'submitted',
  'under_review',
  'quoted',
  'accepted',
  'rejected',
  'expired'
);

-- RFQ (Request for Quote)
CREATE TABLE rfqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES companies(id) NOT NULL,
  contact_person_id UUID REFERENCES profiles(id),
  status rfq_status DEFAULT 'draft',
  required_by_date DATE,
  delivery_address TEXT,
  special_instructions TEXT,
  total_amount DECIMAL(15, 2),
  assigned_to UUID REFERENCES profiles(id), -- Sales rep
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RFQ line items
CREATE TABLE rfq_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id UUID REFERENCES rfqs(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_description TEXT,
  quantity DECIMAL(10, 2) NOT NULL,
  uom VARCHAR(50),
  required_by_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RFQ documents (from customer)
CREATE TABLE rfq_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id UUID REFERENCES rfqs(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE quote_status AS ENUM (
  'draft',
  'sent',
  'accepted',
  'rejected',
  'revised',
  'expired'
);

-- Quotations
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number VARCHAR(50) UNIQUE NOT NULL,
  rfq_id UUID REFERENCES rfqs(id),
  customer_id UUID REFERENCES companies(id) NOT NULL,
  status quote_status DEFAULT 'draft',
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  subtotal DECIMAL(15, 2) NOT NULL,
  discount_amount DECIMAL(15, 2) DEFAULT 0,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL,
  terms_and_conditions TEXT,
  payment_terms VARCHAR(255),
  delivery_terms VARCHAR(255),
  notes TEXT,
  prepared_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quote line items
CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- SALES & CRM MODULE
-- ========================================

CREATE TYPE lead_status AS ENUM (
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost'
);

-- Leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(255),
  contact_person VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  source VARCHAR(100), -- 'Website', 'Referral', 'Trade Show', etc.
  status lead_status DEFAULT 'new',
  assigned_to UUID REFERENCES profiles(id),
  estimated_value DECIMAL(15, 2),
  notes TEXT,
  converted_to_customer BOOLEAN DEFAULT false,
  customer_id UUID REFERENCES companies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE sales_order_status AS ENUM (
  'draft',
  'confirmed',
  'in_production',
  'ready_to_ship',
  'partially_shipped',
  'shipped',
  'delivered',
  'cancelled'
);

-- Sales Orders
CREATE TABLE sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  quote_id UUID REFERENCES quotes(id),
  customer_id UUID REFERENCES companies(id) NOT NULL,
  status sales_order_status DEFAULT 'draft',
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  required_by_date DATE,
  subtotal DECIMAL(15, 2) NOT NULL,
  discount_amount DECIMAL(15, 2) DEFAULT 0,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  freight_charges DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL,
  billing_address TEXT,
  shipping_address TEXT,
  payment_terms VARCHAR(255),
  delivery_terms VARCHAR(255),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Order line items
CREATE TABLE sales_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) NOT NULL,
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
  quantity_reserved DECIMAL(10, 2) DEFAULT 0,
  quantity_shipped DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- PURCHASE MODULE
-- ========================================

-- Suppliers
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  supplier_code VARCHAR(50) UNIQUE,
  rating DECIMAL(3, 2), -- Out of 5
  on_time_delivery_score DECIMAL(5, 2), -- Percentage
  quality_score DECIMAL(5, 2), -- Percentage
  payment_terms_days INTEGER DEFAULT 30,
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE pr_status AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'ordered',
  'cancelled'
);

-- Purchase Requisitions
CREATE TABLE purchase_requisitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pr_number VARCHAR(50) UNIQUE NOT NULL,
  status pr_status DEFAULT 'draft',
  requested_by UUID REFERENCES profiles(id) NOT NULL,
  required_by_date DATE,
  department VARCHAR(100),
  justification TEXT,
  total_estimated_amount DECIMAL(15, 2),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PR line items
CREATE TABLE purchase_requisition_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pr_id UUID REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  uom VARCHAR(50),
  estimated_unit_price DECIMAL(15, 2),
  estimated_total DECIMAL(15, 2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE po_status AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'sent_to_supplier',
  'acknowledged',
  'partially_received',
  'received',
  'cancelled'
);

-- Purchase Orders
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number VARCHAR(50) UNIQUE NOT NULL,
  pr_id UUID REFERENCES purchase_requisitions(id),
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  status po_status DEFAULT 'draft',
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  subtotal DECIMAL(15, 2) NOT NULL,
  discount_amount DECIMAL(15, 2) DEFAULT 0,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  freight_charges DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL,
  delivery_address TEXT,
  payment_terms VARCHAR(255),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PO line items
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) NOT NULL,
  description TEXT,
  quantity DECIMAL(10, 2) NOT NULL,
  uom VARCHAR(50),
  unit_price DECIMAL(15, 2) NOT NULL,
  tax_rate DECIMAL(5, 2),
  tax_amount DECIMAL(15, 2),
  line_total DECIMAL(15, 2) NOT NULL,
  quantity_received DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE grn_status AS ENUM (
  'draft',
  'received',
  'quality_check_pending',
  'quality_check_passed',
  'quality_check_failed',
  'posted'
);

-- Goods Received Notes
CREATE TABLE goods_received_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grn_number VARCHAR(50) UNIQUE NOT NULL,
  po_id UUID REFERENCES purchase_orders(id) NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  status grn_status DEFAULT 'draft',
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by UUID REFERENCES profiles(id) NOT NULL,
  supplier_invoice_number VARCHAR(100),
  supplier_invoice_date DATE,
  transporter VARCHAR(255),
  vehicle_number VARCHAR(50),
  lr_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GRN line items
CREATE TABLE grn_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grn_id UUID REFERENCES goods_received_notes(id) ON DELETE CASCADE,
  po_item_id UUID REFERENCES purchase_order_items(id),
  product_id UUID REFERENCES products(id) NOT NULL,
  ordered_quantity DECIMAL(10, 2),
  received_quantity DECIMAL(10, 2) NOT NULL,
  accepted_quantity DECIMAL(10, 2),
  rejected_quantity DECIMAL(10, 2) DEFAULT 0,
  uom VARCHAR(50),
  batch_number VARCHAR(100),
  manufacturing_date DATE,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- WAREHOUSE & INVENTORY MODULE
-- ========================================

-- Warehouses
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(10),
  contact_person VARCHAR(255),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Warehouse bins/locations
CREATE TABLE warehouse_bins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  bin_code VARCHAR(50) NOT NULL,
  aisle VARCHAR(50),
  rack VARCHAR(50),
  level VARCHAR(50),
  bin_type VARCHAR(50), -- 'Storage', 'Picking', 'Receiving', 'Quarantine', 'Rejected'
  capacity_weight DECIMAL(10, 2),
  capacity_volume DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(warehouse_id, bin_code)
);

-- Stock lots (for lot tracking)
CREATE TABLE stock_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_number VARCHAR(100) UNIQUE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  batch_number VARCHAR(100),
  manufacturing_date DATE,
  expiry_date DATE,
  supplier_id UUID REFERENCES suppliers(id),
  grn_id UUID REFERENCES goods_received_notes(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE stock_move_type AS ENUM (
  'inbound',
  'outbound',
  'transfer',
  'adjustment'
);

-- Stock movements
CREATE TABLE stock_moves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  move_type stock_move_type NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  lot_id UUID REFERENCES stock_lots(id),
  from_warehouse_id UUID REFERENCES warehouses(id),
  to_warehouse_id UUID REFERENCES warehouses(id),
  from_bin_id UUID REFERENCES warehouse_bins(id),
  to_bin_id UUID REFERENCES warehouse_bins(id),
  quantity DECIMAL(10, 2) NOT NULL,
  uom VARCHAR(50),
  reference_type VARCHAR(50), -- 'GRN', 'Sales Order', 'Transfer', 'Adjustment'
  reference_id UUID,
  notes TEXT,
  moved_by UUID REFERENCES profiles(id),
  move_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Current stock levels (materialized view or table)
CREATE TABLE stock_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  bin_id UUID REFERENCES warehouse_bins(id),
  lot_id UUID REFERENCES stock_lots(id),
  available_quantity DECIMAL(10, 2) DEFAULT 0,
  reserved_quantity DECIMAL(10, 2) DEFAULT 0,
  on_hand_quantity DECIMAL(10, 2) DEFAULT 0,
  uom VARCHAR(50),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, warehouse_id, bin_id, lot_id)
);

-- Stock valuations
CREATE TABLE stock_valuations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  valuation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_cost DECIMAL(15, 2) NOT NULL,
  total_value DECIMAL(15, 2) NOT NULL,
  valuation_method VARCHAR(20) DEFAULT 'FIFO', -- 'FIFO', 'Weighted_Avg'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- QUALITY CONTROL MODULE
-- ========================================

CREATE TYPE qc_type AS ENUM (
  'inbound',
  'in_process',
  'outbound'
);

CREATE TYPE qc_status AS ENUM (
  'pending',
  'in_progress',
  'passed',
  'failed',
  'on_hold'
);

-- QC templates
CREATE TABLE qc_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  qc_type qc_type NOT NULL,
  product_category_id UUID REFERENCES product_categories(id),
  description TEXT,
  parameters JSONB, -- Array of test parameters with limits
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- QC inspections
CREATE TABLE qc_inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_number VARCHAR(50) UNIQUE NOT NULL,
  qc_type qc_type NOT NULL,
  status qc_status DEFAULT 'pending',
  reference_type VARCHAR(50), -- 'GRN', 'Production', 'Sales Order'
  reference_id UUID,
  product_id UUID REFERENCES products(id) NOT NULL,
  lot_id UUID REFERENCES stock_lots(id),
  template_id UUID REFERENCES qc_templates(id),
  quantity_inspected DECIMAL(10, 2),
  quantity_passed DECIMAL(10, 2),
  quantity_failed DECIMAL(10, 2),
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  inspected_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  test_results JSONB, -- Detailed test results
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE ncr_status AS ENUM (
  'open',
  'under_investigation',
  'corrective_action',
  'preventive_action',
  'closed'
);

-- Non-Conformance Reports
CREATE TABLE ncr_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ncr_number VARCHAR(50) UNIQUE NOT NULL,
  status ncr_status DEFAULT 'open',
  inspection_id UUID REFERENCES qc_inspections(id),
  product_id UUID REFERENCES products(id) NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  root_cause TEXT,
  corrective_action TEXT,
  preventive_action TEXT,
  responsible_person UUID REFERENCES profiles(id),
  target_close_date DATE,
  actual_close_date DATE,
  cost_impact DECIMAL(15, 2),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Certificate of Analysis (COA)
CREATE TABLE certificates_of_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coa_number VARCHAR(50) UNIQUE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  lot_id UUID REFERENCES stock_lots(id) NOT NULL,
  inspection_id UUID REFERENCES qc_inspections(id),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  test_results JSONB,
  issued_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- LOGISTICS MODULE
-- ========================================

CREATE TYPE shipment_status AS ENUM (
  'planned',
  'picked',
  'packed',
  'dispatched',
  'in_transit',
  'delivered',
  'cancelled'
);

-- Carriers
CREATE TABLE carriers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE,
  contact_person VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shipments
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_number VARCHAR(50) UNIQUE NOT NULL,
  sales_order_id UUID REFERENCES sales_orders(id),
  customer_id UUID REFERENCES companies(id) NOT NULL,
  status shipment_status DEFAULT 'planned',
  shipment_date DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  carrier_id UUID REFERENCES carriers(id),
  tracking_number VARCHAR(255),
  awb_number VARCHAR(255),
  vehicle_number VARCHAR(50),
  driver_name VARCHAR(255),
  driver_phone VARCHAR(20),
  freight_charges DECIMAL(15, 2),
  freight_paid_by VARCHAR(50), -- 'Sender', 'Receiver'
  shipping_address TEXT,
  eway_bill_number VARCHAR(50),
  eway_bill_date DATE,
  pod_file_url TEXT, -- Proof of Delivery
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shipment items
CREATE TABLE shipment_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  sales_order_item_id UUID REFERENCES sales_order_items(id),
  product_id UUID REFERENCES products(id) NOT NULL,
  lot_id UUID REFERENCES stock_lots(id),
  quantity DECIMAL(10, 2) NOT NULL,
  uom VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shipment tracking events
CREATE TABLE shipment_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  event_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  location VARCHAR(255),
  event_type VARCHAR(100),
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- ACCOUNTING MODULE (India Compliant)
-- ========================================

CREATE TYPE account_type AS ENUM (
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense'
);

-- Chart of Accounts
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_code VARCHAR(50) UNIQUE NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_type account_type NOT NULL,
  parent_id UUID REFERENCES chart_of_accounts(id),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  is_system_account BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Journal entries
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_number VARCHAR(50) UNIQUE NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_type VARCHAR(50), -- 'Sales Invoice', 'Purchase Bill', 'Payment', etc.
  reference_id UUID,
  description TEXT,
  total_debit DECIMAL(15, 2) NOT NULL,
  total_credit DECIMAL(15, 2) NOT NULL,
  is_posted BOOLEAN DEFAULT false,
  posted_by UUID REFERENCES profiles(id),
  posted_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Journal entry lines
CREATE TABLE journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID REFERENCES chart_of_accounts(id) NOT NULL,
  debit_amount DECIMAL(15, 2) DEFAULT 0,
  credit_amount DECIMAL(15, 2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE invoice_status AS ENUM (
  'draft',
  'sent',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled'
);

-- Sales Invoices
CREATE TABLE sales_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  sales_order_id UUID REFERENCES sales_orders(id),
  customer_id UUID REFERENCES companies(id) NOT NULL,
  status invoice_status DEFAULT 'draft',
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal DECIMAL(15, 2) NOT NULL,
  discount_amount DECIMAL(15, 2) DEFAULT 0,
  cgst_amount DECIMAL(15, 2) DEFAULT 0,
  sgst_amount DECIMAL(15, 2) DEFAULT 0,
  igst_amount DECIMAL(15, 2) DEFAULT 0,
  cess_amount DECIMAL(15, 2) DEFAULT 0,
  other_charges DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL,
  amount_paid DECIMAL(15, 2) DEFAULT 0,
  balance_due DECIMAL(15, 2),
  
  -- GST fields
  place_of_supply VARCHAR(100),
  gstin_customer VARCHAR(15),
  
  -- E-invoice fields
  einvoice_irn VARCHAR(100),
  einvoice_ack_no VARCHAR(100),
  einvoice_ack_date TIMESTAMP WITH TIME ZONE,
  einvoice_qr_code TEXT,
  
  billing_address TEXT,
  shipping_address TEXT,
  notes TEXT,
  terms_and_conditions TEXT,
  
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Invoice line items
CREATE TABLE sales_invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES sales_invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  description TEXT NOT NULL,
  hsn_code VARCHAR(8),
  quantity DECIMAL(10, 2) NOT NULL,
  uom VARCHAR(50),
  unit_price DECIMAL(15, 2) NOT NULL,
  discount_percent DECIMAL(5, 2) DEFAULT 0,
  discount_amount DECIMAL(15, 2) DEFAULT 0,
  taxable_amount DECIMAL(15, 2) NOT NULL,
  cgst_rate DECIMAL(5, 2),
  cgst_amount DECIMAL(15, 2) DEFAULT 0,
  sgst_rate DECIMAL(5, 2),
  sgst_amount DECIMAL(15, 2) DEFAULT 0,
  igst_rate DECIMAL(5, 2),
  igst_amount DECIMAL(15, 2) DEFAULT 0,
  cess_rate DECIMAL(5, 2),
  cess_amount DECIMAL(15, 2) DEFAULT 0,
  line_total DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase Bills (Supplier Invoices)
CREATE TABLE purchase_bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_invoice_number VARCHAR(100) NOT NULL,
  supplier_invoice_date DATE NOT NULL,
  po_id UUID REFERENCES purchase_orders(id),
  grn_id UUID REFERENCES goods_received_notes(id),
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  status invoice_status DEFAULT 'draft',
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal DECIMAL(15, 2) NOT NULL,
  discount_amount DECIMAL(15, 2) DEFAULT 0,
  cgst_amount DECIMAL(15, 2) DEFAULT 0,
  sgst_amount DECIMAL(15, 2) DEFAULT 0,
  igst_amount DECIMAL(15, 2) DEFAULT 0,
  cess_amount DECIMAL(15, 2) DEFAULT 0,
  tds_amount DECIMAL(15, 2) DEFAULT 0,
  other_charges DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL,
  amount_paid DECIMAL(15, 2) DEFAULT 0,
  balance_due DECIMAL(15, 2),
  
  -- GST fields
  gstin_supplier VARCHAR(15),
  place_of_supply VARCHAR(100),
  
  notes TEXT,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchase Bill items
CREATE TABLE purchase_bill_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id UUID REFERENCES purchase_bills(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  description TEXT NOT NULL,
  hsn_code VARCHAR(8),
  quantity DECIMAL(10, 2) NOT NULL,
  uom VARCHAR(50),
  unit_price DECIMAL(15, 2) NOT NULL,
  discount_amount DECIMAL(15, 2) DEFAULT 0,
  taxable_amount DECIMAL(15, 2) NOT NULL,
  cgst_rate DECIMAL(5, 2),
  cgst_amount DECIMAL(15, 2) DEFAULT 0,
  sgst_rate DECIMAL(5, 2),
  sgst_amount DECIMAL(15, 2) DEFAULT 0,
  igst_rate DECIMAL(5, 2),
  igst_amount DECIMAL(15, 2) DEFAULT 0,
  cess_rate DECIMAL(5, 2),
  cess_amount DECIMAL(15, 2) DEFAULT 0,
  line_total DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE payment_mode AS ENUM (
  'cash',
  'cheque',
  'bank_transfer',
  'upi',
  'card',
  'other'
);

-- Payments received
CREATE TABLE payments_received (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES companies(id) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(15, 2) NOT NULL,
  payment_mode payment_mode NOT NULL,
  reference_number VARCHAR(100),
  bank_account_id UUID,
  notes TEXT,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment received allocations (to invoices)
CREATE TABLE payment_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID REFERENCES payments_received(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES sales_invoices(id) NOT NULL,
  allocated_amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments made
CREATE TABLE payments_made (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount DECIMAL(15, 2) NOT NULL,
  payment_mode payment_mode NOT NULL,
  reference_number VARCHAR(100),
  bank_account_id UUID,
  tds_deducted DECIMAL(15, 2) DEFAULT 0,
  notes TEXT,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment made allocations (to bills)
CREATE TABLE payment_bill_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID REFERENCES payments_made(id) ON DELETE CASCADE,
  bill_id UUID REFERENCES purchase_bills(id) NOT NULL,
  allocated_amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bank accounts
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_name VARCHAR(255) NOT NULL,
  bank_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  ifsc_code VARCHAR(11),
  branch VARCHAR(255),
  account_type VARCHAR(50), -- 'Current', 'Savings'
  opening_balance DECIMAL(15, 2) DEFAULT 0,
  current_balance DECIMAL(15, 2) DEFAULT 0,
  chart_account_id UUID REFERENCES chart_of_accounts(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fixed Assets
CREATE TABLE fixed_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_code VARCHAR(50) UNIQUE NOT NULL,
  asset_name VARCHAR(255) NOT NULL,
  asset_category VARCHAR(100),
  purchase_date DATE NOT NULL,
  purchase_cost DECIMAL(15, 2) NOT NULL,
  salvage_value DECIMAL(15, 2) DEFAULT 0,
  useful_life_years INTEGER NOT NULL,
  depreciation_method VARCHAR(50) DEFAULT 'Straight Line', -- 'Straight Line', 'WDV'
  accumulated_depreciation DECIMAL(15, 2) DEFAULT 0,
  net_book_value DECIMAL(15, 2),
  disposal_date DATE,
  disposal_amount DECIMAL(15, 2),
  asset_account_id UUID REFERENCES chart_of_accounts(id),
  depreciation_account_id UUID REFERENCES chart_of_accounts(id),
  accumulated_dep_account_id UUID REFERENCES chart_of_accounts(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- HR & PAYROLL MODULE (India Compliant)
-- ========================================

-- Departments
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  code VARCHAR(50) UNIQUE,
  head_id UUID REFERENCES profiles(id),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Designations
CREATE TABLE designations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  code VARCHAR(50) UNIQUE,
  department_id UUID REFERENCES departments(id),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE employment_type AS ENUM (
  'full_time',
  'part_time',
  'contract',
  'intern',
  'consultant'
);

CREATE TYPE employee_status AS ENUM (
  'active',
  'on_leave',
  'resigned',
  'terminated',
  'retired'
);

-- Employees
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id),
  employee_code VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  middle_name VARCHAR(255),
  last_name VARCHAR(255) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(20),
  marital_status VARCHAR(20),
  
  -- Contact
  personal_email VARCHAR(255),
  personal_phone VARCHAR(20),
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  
  -- Address
  current_address TEXT,
  permanent_address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(10),
  
  -- Employment details
  department_id UUID REFERENCES departments(id),
  designation_id UUID REFERENCES designations(id),
  employment_type employment_type NOT NULL,
  status employee_status DEFAULT 'active',
  date_of_joining DATE NOT NULL,
  date_of_confirmation DATE,
  date_of_leaving DATE,
  reporting_to UUID REFERENCES employees(id),
  
  -- Statutory details
  pan_number VARCHAR(10),
  aadhaar_number VARCHAR(12),
  uan_number VARCHAR(12), -- Universal Account Number (PF)
  esic_number VARCHAR(17), -- ESIC number
  bank_account_number VARCHAR(50),
  bank_ifsc VARCHAR(11),
  bank_name VARCHAR(255),
  
  -- Salary details
  ctc_annual DECIMAL(15, 2),
  basic_salary DECIMAL(15, 2),
  
  -- Documents
  photo_url TEXT,
  resume_url TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leave types
CREATE TABLE leave_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  max_days_per_year INTEGER,
  is_paid BOOLEAN DEFAULT true,
  is_carry_forward BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE leave_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);

-- Employee leave requests
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) NOT NULL,
  leave_type_id UUID REFERENCES leave_types(id) NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  number_of_days DECIMAL(5, 2) NOT NULL,
  reason TEXT,
  status leave_status DEFAULT 'pending',
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance records
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) NOT NULL,
  attendance_date DATE NOT NULL,
  check_in_time TIME,
  check_out_time TIME,
  working_hours DECIMAL(5, 2),
  status VARCHAR(50), -- 'Present', 'Absent', 'Half Day', 'Leave', 'Holiday'
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, attendance_date)
);

-- Salary components (earnings and deductions)
CREATE TABLE salary_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  component_type VARCHAR(20) NOT NULL, -- 'earning', 'deduction'
  is_fixed BOOLEAN DEFAULT true,
  is_taxable BOOLEAN DEFAULT true,
  calculation_formula TEXT, -- For computed components
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employee salary structure
CREATE TABLE employee_salary_structure (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) NOT NULL,
  component_id UUID REFERENCES salary_components(id) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE payroll_status AS ENUM (
  'draft',
  'processing',
  'processed',
  'paid',
  'cancelled'
);

-- Payroll runs
CREATE TABLE payroll_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_number VARCHAR(50) UNIQUE NOT NULL,
  pay_period_from DATE NOT NULL,
  pay_period_to DATE NOT NULL,
  payment_date DATE,
  status payroll_status DEFAULT 'draft',
  total_gross_salary DECIMAL(15, 2),
  total_deductions DECIMAL(15, 2),
  total_net_salary DECIMAL(15, 2),
  processed_by UUID REFERENCES profiles(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employee payslips
CREATE TABLE payslips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) NOT NULL,
  pay_period_from DATE NOT NULL,
  pay_period_to DATE NOT NULL,
  working_days INTEGER,
  present_days DECIMAL(5, 2),
  
  -- Earnings
  basic_salary DECIMAL(15, 2),
  hra DECIMAL(15, 2),
  da DECIMAL(15, 2),
  special_allowance DECIMAL(15, 2),
  other_allowances DECIMAL(15, 2),
  overtime DECIMAL(15, 2),
  bonus DECIMAL(15, 2),
  gross_salary DECIMAL(15, 2) NOT NULL,
  
  -- Deductions
  pf_employee DECIMAL(15, 2) DEFAULT 0,
  pf_employer DECIMAL(15, 2) DEFAULT 0,
  esi_employee DECIMAL(15, 2) DEFAULT 0,
  esi_employer DECIMAL(15, 2) DEFAULT 0,
  professional_tax DECIMAL(15, 2) DEFAULT 0,
  tds DECIMAL(15, 2) DEFAULT 0,
  lwf_employee DECIMAL(15, 2) DEFAULT 0,
  lwf_employer DECIMAL(15, 2) DEFAULT 0,
  loan_deduction DECIMAL(15, 2) DEFAULT 0,
  other_deductions DECIMAL(15, 2) DEFAULT 0,
  total_deductions DECIMAL(15, 2) NOT NULL,
  
  net_salary DECIMAL(15, 2) NOT NULL,
  
  -- Bank details
  bank_account_number VARCHAR(50),
  bank_ifsc VARCHAR(11),
  
  payslip_file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TDS computation
CREATE TABLE tds_computations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) NOT NULL,
  financial_year VARCHAR(10) NOT NULL, -- '2024-25'
  
  -- Income components
  gross_salary_annual DECIMAL(15, 2),
  standard_deduction DECIMAL(15, 2) DEFAULT 50000,
  section_80c DECIMAL(15, 2) DEFAULT 0,
  section_80d DECIMAL(15, 2) DEFAULT 0,
  other_exemptions DECIMAL(15, 2) DEFAULT 0,
  taxable_income DECIMAL(15, 2),
  
  -- Tax calculation
  income_tax DECIMAL(15, 2),
  education_cess DECIMAL(15, 2),
  total_tax DECIMAL(15, 2),
  tds_deducted DECIMAL(15, 2),
  
  computation_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- MARKETING MODULE
-- ========================================

CREATE TYPE campaign_status AS ENUM (
  'draft',
  'scheduled',
  'sent',
  'completed',
  'cancelled'
);

-- Marketing campaigns
CREATE TABLE marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  campaign_type VARCHAR(50), -- 'Email', 'SMS', 'Promotion'
  status campaign_status DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  subject VARCHAR(500),
  content TEXT,
  target_audience VARCHAR(100), -- 'All Customers', 'Segment', 'Custom'
  audience_filter JSONB,
  
  -- Metrics
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blog posts / Content
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image_url TEXT,
  author_id UUID REFERENCES profiles(id),
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'published'
  published_at TIMESTAMP WITH TIME ZONE,
  meta_title VARCHAR(500),
  meta_description TEXT,
  tags TEXT[],
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- SYSTEM & AUDIT
-- ========================================

-- Activity logs (immutable audit trail)
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  action VARCHAR(100) NOT NULL, -- 'create', 'update', 'delete', 'approve', etc.
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System settings
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value TEXT,
  description TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  title VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  notification_type VARCHAR(50),
  reference_type VARCHAR(100),
  reference_id UUID,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- File uploads metadata
CREATE TABLE file_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  entity_type VARCHAR(100),
  entity_id UUID,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Profiles
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_company_id ON profiles(company_id);
CREATE INDEX idx_profiles_email ON profiles(email);

-- Products
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_slug ON products(slug);

-- RFQs
CREATE INDEX idx_rfqs_customer ON rfqs(customer_id);
CREATE INDEX idx_rfqs_status ON rfqs(status);
CREATE INDEX idx_rfqs_assigned ON rfqs(assigned_to);

-- Sales Orders
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_sales_orders_order_number ON sales_orders(order_number);

-- Purchase Orders
CREATE INDEX idx_pos_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_pos_status ON purchase_orders(status);
CREATE INDEX idx_pos_po_number ON purchase_orders(po_number);

-- Stock
CREATE INDEX idx_stock_moves_product ON stock_moves(product_id);
CREATE INDEX idx_stock_moves_warehouse ON stock_moves(to_warehouse_id);
CREATE INDEX idx_stock_balances_product ON stock_balances(product_id);
CREATE INDEX idx_stock_balances_warehouse ON stock_balances(warehouse_id);

-- QC
CREATE INDEX idx_qc_inspections_product ON qc_inspections(product_id);
CREATE INDEX idx_qc_inspections_status ON qc_inspections(status);

-- Invoices
CREATE INDEX idx_sales_invoices_customer ON sales_invoices(customer_id);
CREATE INDEX idx_sales_invoices_status ON sales_invoices(status);
CREATE INDEX idx_sales_invoices_due_date ON sales_invoices(due_date);

-- HR
CREATE INDEX idx_employees_code ON employees(employee_code);
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_attendance_employee_date ON attendance(employee_id, attendance_date);

-- Activity logs
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);

-- ========================================
-- TRIGGERS FOR AUTO-UPDATES
-- ========================================

-- Auto-update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON sales_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
