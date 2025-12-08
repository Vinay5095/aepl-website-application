# AEPL Enterprise ERP Platform

A comprehensive, enterprise-grade ERP system designed specifically for industrial business operations, with full India statutory compliance.

## 🚀 Features

### Core Modules

1. **Product Catalog**
   - Multi-level categorization
   - Technical specifications management
   - Document management (TDS, MSDS, COA, COC)
   - Tiered pricing
   - HSN/GST configuration

2. **B2B eCommerce & RFQ**
   - Request for Quote workflow
   - Multi-round negotiation
   - Quote builder
   - Order conversion

3. **Sales & CRM**
   - Lead management
   - Opportunity pipeline
   - Quote & sales order management
   - Customer pricing rules
   - Sales dashboards

4. **Purchase Management**
   - Purchase requisitions (PR)
   - Purchase orders (PO)
   - Multi-level approvals
   - Supplier portal
   - Goods received notes (GRN)
   - 3-way matching

5. **Warehouse & Inventory**
   - Multi-warehouse support
   - Bin locations
   - Lot & serial tracking
   - Stock movements
   - Cycle counting
   - Valuation (FIFO, Weighted Average)

6. **Quality Control (QC/QMS)**
   - Inbound/In-process/Outbound QC
   - QC templates
   - Non-conformance reports (NCR)
   - CAPA workflow
   - Certificate of Analysis (COA)

7. **Logistics**
   - Shipment management
   - Carrier integration
   - Tracking
   - POD upload
   - E-way bill support

8. **Accounting (India Compliant)**
   - Chart of accounts
   - Journal entries
   - GST compliant invoicing (CGST/SGST/IGST)
   - E-invoice generation
   - TDS/TCS
   - AR/AP management
   - Bank reconciliation
   - Fixed assets & depreciation
   - Financial reports (P&L, Balance Sheet, Cashflow)

9. **HRMS & Payroll (India Compliant)**
   - Employee master
   - Attendance & leave management
   - Payroll engine
   - PF/ESI calculation
   - Professional Tax (state-wise)
   - TDS on salary
   - Form 16 generation
   - Payslip generation

10. **Management Dashboard**
    - CEO/Director KPIs
    - Sales forecast
    - Procurement analytics
    - Inventory metrics
    - Financial summary

11. **Marketing**
    - Campaign management
    - Email/SMS campaigns
    - Lead capture
    - Product analytics

## 🛠️ Technology Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, shadcn/ui, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Form Management**: React Hook Form + Zod
- **Deployment**: Docker, Docker Compose
- **Database**: PostgreSQL with Row Level Security (RLS)

## 📋 Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Supabase account (or self-hosted Supabase)
- npm or yarn

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Vinay5095/aepl-website-application.git
cd aepl-website-application
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example environment file and update with your values:

```bash
cp .env.example .env.local
```

Update the following variables in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 4. Set up Supabase

#### Option A: Using Supabase Cloud

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from Project Settings > API
3. Run the migrations:

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

#### Option B: Using Docker (Self-hosted)

The docker-compose.yml includes a PostgreSQL database. Run the migrations manually after starting:

```bash
docker-compose up -d postgres
# Wait for postgres to be ready
docker-compose exec postgres psql -U postgres -d aepl_erp -f /docker-entrypoint-initdb.d/20251208_initial_schema.sql
docker-compose exec postgres psql -U postgres -d aepl_erp -f /docker-entrypoint-initdb.d/20251208_rls_policies.sql
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### 6. Build for production

```bash
npm run build
npm start
```

## 🐳 Docker Deployment

### Development

```bash
docker-compose up -d
```

### Production

1. Update `.env.production` with your production values
2. Build and deploy:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 👥 User Roles

The system supports the following roles:

### External Roles
- **Public Visitor**: Browse products (no login required)
- **B2B Customer**: Submit RFQs, view quotes, place orders
- **Supplier**: View POs, acknowledge orders, upload documents

### Internal Roles
- **Sales Executive**: Manage leads, quotes, orders
- **Sales Manager**: Approve quotes, view sales analytics
- **Purchase Executive**: Create PRs and POs
- **Procurement Manager**: Approve purchase orders
- **Warehouse Staff**: Manage stock movements, picking, packing
- **Inventory Manager**: Oversee warehouse operations
- **QC Inspector**: Perform quality inspections
- **QC Manager**: Approve QC results, manage NCRs
- **Logistics Executive**: Manage shipments
- **Finance/Accounting**: Manage invoices, payments, accounts
- **HR Executive**: Manage employees, attendance
- **Payroll Admin**: Process payroll
- **Marketing Executive**: Manage campaigns
- **CEO/Director**: View all dashboards and analytics
- **Super Admin**: Full system access

## 📊 Database Schema

The database includes comprehensive tables for:

- User profiles and companies
- Product catalog with categories, brands, specifications
- RFQs, quotes, and sales orders
- Purchase requisitions, orders, and GRNs
- Multi-warehouse inventory with lot tracking
- Quality control inspections and NCRs
- Shipments and logistics
- Complete accounting (COA, journals, invoices, payments)
- HR master data, attendance, and payroll
- Marketing campaigns
- Activity logs and notifications

See `supabase/migrations/` for the complete schema.

## 🔐 Security

- Row Level Security (RLS) enabled on all tables
- Role-based access control (RBAC)
- JWT authentication via Supabase Auth
- Secure file storage with permission controls
- Activity logging for audit trails
- Environment-based configuration

## 📝 API Routes

- `/api/health` - Health check endpoint for Docker
- Additional API routes will be added per module

## 🧪 Testing

```bash
# Run tests (to be implemented)
npm test

# Run e2e tests
npm run test:e2e
```

## 📦 Project Structure

```
aepl-website-application/
├── app/
│   ├── (public)/           # Public pages (home, products)
│   ├── (auth)/             # Authentication pages
│   ├── (customer)/         # B2B customer portal
│   ├── (supplier)/         # Supplier portal
│   ├── (dashboard)/        # Internal dashboards
│   │   ├── sales/          # Sales module
│   │   ├── purchase/       # Purchase module
│   │   ├── inventory/      # Inventory module
│   │   ├── quality/        # QC module
│   │   ├── logistics/      # Logistics module
│   │   ├── accounting/     # Accounting module
│   │   ├── hr/             # HR & Payroll module
│   │   ├── marketing/      # Marketing module
│   │   ├── management/     # CEO dashboard
│   │   └── admin/          # Admin panel
│   ├── api/                # API routes
│   └── globals.css         # Global styles
├── components/
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── supabase/           # Supabase client config
│   └── utils.ts            # Utility functions
├── supabase/
│   └── migrations/         # Database migrations
├── public/                 # Static assets
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Docker Compose setup
└── README.md               # This file
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software. All rights reserved.

## 📞 Support

For support, email: support@aepl.com

## 🗺️ Roadmap

### Phase 1: Foundation (Current)
- ✅ Project setup
- ✅ Database schema
- ✅ Authentication
- ✅ Docker deployment

### Phase 2: Core Modules
- [ ] Product catalog
- [ ] RFQ & Quote management
- [ ] Sales order processing
- [ ] Purchase order workflow
- [ ] Inventory management

### Phase 3: Advanced Features
- [ ] Quality control
- [ ] Logistics tracking
- [ ] Accounting & GST
- [ ] HRMS & Payroll

### Phase 4: Integrations
- [ ] E-invoice API
- [ ] E-way bill API
- [ ] Payment gateways
- [ ] SMS/Email providers
- [ ] Biometric attendance

### Phase 5: Analytics & Optimization
- [ ] Advanced reporting
- [ ] BI dashboards
- [ ] Performance optimization
- [ ] Mobile responsive

## 📚 Documentation

Detailed documentation for each module will be added in the `/docs` directory.

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Supabase for the backend infrastructure
- shadcn for the beautiful UI components
- All contributors and maintainers
