# AEPL ERP Platform - System Architecture

## Executive Summary

This document describes the architecture of the AEPL Enterprise ERP Platform, a comprehensive business operations system designed for industrial supply companies with full India statutory compliance.

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Public  │  │   B2B    │  │ Supplier │  │ Internal │       │
│  │   Web    │  │ Customer │  │  Portal  │  │ Dashboard│       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js App Router (SSR)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Route Groups: (public), (auth), (customer),            │  │
│  │               (supplier), (dashboard)                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Server Components + API Routes + Server Actions         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                      Middleware Layer                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │   Auth   │  │   RLS    │  │  Logging │  │  Rate    │       │
│  │Validation│  │  Checks  │  │  Audit   │  │Limiting  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Backend Layer                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  PostgreSQL Database                      │  │
│  │  - 100+ tables with RLS                                  │  │
│  │  - ACID compliance                                        │  │
│  │  - Full-text search                                       │  │
│  │  - JSON/JSONB support                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Supabase Auth                            │  │
│  │  - JWT-based authentication                               │  │
│  │  - Role-based access control                              │  │
│  │  - Session management                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Supabase Storage                         │  │
│  │  - Document management                                    │  │
│  │  - File uploads (images, PDFs)                            │  │
│  │  - Access control policies                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Edge Functions                           │  │
│  │  - Background jobs                                        │  │
│  │  - Scheduled tasks                                        │  │
│  │  - Webhooks                                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    External Integrations                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │E-Invoice │  │ E-Way    │  │ Payment  │  │  SMS/    │       │
│  │   API    │  │ Bill API │  │ Gateway  │  │  Email   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript (strict mode)
- **UI Library**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS v4
- **Forms**: React Hook Form + Zod validation
- **State Management**: React Context + Server State (RSC)
- **Icons**: Lucide React

### Backend
- **Database**: PostgreSQL 15+ (via Supabase)
- **Authentication**: Supabase Auth (JWT-based)
- **Storage**: Supabase Storage (S3-compatible)
- **API**: Next.js API Routes + Server Actions
- **Edge Functions**: Supabase Edge Functions (Deno)

### Infrastructure
- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **Reverse Proxy**: Nginx
- **Caching**: Redis
- **Monitoring**: Built-in health checks

## Database Design Principles

### 1. Normalization
- Database is normalized to 3rd Normal Form (3NF)
- Referential integrity enforced via foreign keys
- Indexes on frequently queried columns

### 2. Row Level Security (RLS)
- Every table has RLS enabled
- Policies enforce role-based access
- Helper functions for common checks

### 3. Audit Trail
- `activity_logs` table captures all CRUD operations
- Immutable audit records
- Includes old/new values for updates

### 4. Soft Deletes
- Most tables use `is_active` flag instead of hard deletes
- Preserves data integrity
- Allows historical reporting

### 5. Timestamps
- `created_at` and `updated_at` on all tables
- Automatic triggers for `updated_at`

## Module Architecture

### 1. Product Catalog Module

**Tables**: 
- `products`, `product_categories`, `brands`
- `product_documents`, `product_pricing`

**Key Features**:
- Hierarchical categories
- JSONB for flexible technical specs
- Multi-tier pricing
- Document attachments

### 2. RFQ & Quote Module

**Tables**: 
- `rfqs`, `rfq_items`, `rfq_documents`
- `quotes`, `quote_items`

**Workflow**:
1. Customer submits RFQ
2. Sales assigns to rep
3. Sales builds quote
4. Customer accepts/rejects
5. Convert to sales order

### 3. Sales Module

**Tables**: 
- `leads`, `sales_orders`, `sales_order_items`

**Integration Points**:
- Product catalog (pricing)
- Inventory (reservation)
- Accounting (invoice generation)

### 4. Purchase Module

**Tables**: 
- `suppliers`, `purchase_requisitions`, `purchase_orders`
- `goods_received_notes`, `grn_items`

**Workflow**:
1. PR creation (manual or automatic)
2. Multi-level approval
3. PO generation
4. Supplier acknowledgment
5. GRN on receipt
6. 3-way matching (PO-GRN-Invoice)

### 5. Inventory Module

**Tables**: 
- `warehouses`, `warehouse_bins`
- `stock_lots`, `stock_moves`, `stock_balances`
- `stock_valuations`

**Features**:
- Multi-warehouse support
- Lot & serial tracking
- Real-time stock balances
- FIFO/Weighted Average valuation

### 6. Quality Control Module

**Tables**: 
- `qc_templates`, `qc_inspections`
- `ncr_reports`, `certificates_of_analysis`

**Workflow**:
1. Inspection on GRN/Production/Dispatch
2. Test results capture
3. Pass/Fail decision
4. NCR for failures
5. COA generation

### 7. Logistics Module

**Tables**: 
- `carriers`, `shipments`, `shipment_items`
- `shipment_tracking`

**Features**:
- Multi-carrier support
- Tracking updates
- POD upload
- E-way bill metadata

### 8. Accounting Module

**Tables**: 
- `chart_of_accounts`, `journal_entries`
- `sales_invoices`, `purchase_bills`
- `payments_received`, `payments_made`
- `bank_accounts`, `fixed_assets`

**GST Compliance**:
- CGST/SGST/IGST calculation
- HSN code support
- E-invoice IRN generation
- GSTR reports

**Features**:
- Double-entry accounting
- Automatic journal entries
- AR/AP management
- Bank reconciliation
- Fixed asset depreciation

### 9. HRMS & Payroll Module

**Tables**: 
- `departments`, `designations`, `employees`
- `leave_types`, `leave_requests`, `attendance`
- `salary_components`, `employee_salary_structure`
- `payroll_runs`, `payslips`, `tds_computations`

**India Compliance**:
- PF (EPF/EPS) calculation
- ESI calculation
- Professional Tax (state-wise)
- TDS on salary (Section 192)
- Labour Welfare Fund
- Form 16 generation

## Security Architecture

### 1. Authentication
- JWT-based authentication via Supabase Auth
- Session management with secure cookies
- Password hashing (bcrypt)
- MFA support (optional)

### 2. Authorization
- Role-based access control (RBAC)
- 19 predefined roles
- Row Level Security (RLS) policies
- Resource-level permissions

### 3. Data Protection
- Encrypted connections (TLS 1.3)
- Environment-based secrets
- No sensitive data in logs
- PII encryption at rest

### 4. Audit & Compliance
- Complete audit trail
- User activity logging
- Change tracking
- Compliance reports

## API Design

### REST API Principles
- RESTful resource naming
- Standard HTTP methods
- JSON request/response
- Proper status codes

### Server Actions
- Type-safe mutations
- Automatic revalidation
- Error handling
- Form data support

### Edge Functions
- Background jobs
- Scheduled tasks
- Webhooks
- Long-running processes

## Performance Optimization

### 1. Database
- Proper indexing strategy
- Query optimization
- Connection pooling
- Read replicas (future)

### 2. Caching
- Redis for session cache
- React Query for client cache
- Static page generation
- Incremental Static Regeneration (ISR)

### 3. Assets
- Image optimization (Next.js Image)
- CDN for static assets
- Code splitting
- Lazy loading

## Deployment Architecture

### Docker Containers
- **app**: Next.js application
- **postgres**: PostgreSQL database
- **redis**: Cache layer
- **nginx**: Reverse proxy

### Health Checks
- Application health endpoint
- Database connectivity check
- Redis connectivity check
- External API checks

### Logging
- Structured JSON logs
- Log aggregation
- Error tracking
- Performance monitoring

## Scalability Considerations

### Horizontal Scaling
- Stateless application servers
- Load balancing via Nginx
- Database connection pooling
- Session storage in Redis

### Vertical Scaling
- Database optimizations
- Query performance tuning
- Resource allocation
- Auto-scaling (cloud deployment)

## Disaster Recovery

### Backup Strategy
- Daily database backups
- Point-in-time recovery
- File storage backups
- Configuration backups

### High Availability
- Multi-region deployment (future)
- Automatic failover
- Health monitoring
- Incident response

## Compliance & Standards

### India Statutory Compliance
- **GST**: Full CGST/SGST/IGST support
- **E-Invoice**: IRN generation, QR code
- **E-Way Bill**: Metadata fields
- **TDS/TCS**: Automatic calculation
- **PF/ESI**: Employee deductions
- **Professional Tax**: State-wise rates
- **Form 16**: Annual tax certificate

### Data Privacy
- GDPR-ready architecture
- Data retention policies
- Right to erasure
- Data portability

### Industry Standards
- ISO 9001 (Quality Management)
- ISO 27001 (Information Security)
- SOC 2 compliance ready

## Development Guidelines

### Code Quality
- TypeScript strict mode
- ESLint configuration
- Prettier formatting
- Code reviews required

### Testing
- Unit tests (Jest)
- Integration tests
- E2E tests (Playwright)
- Performance tests

### CI/CD Pipeline
- Automated builds
- Automated testing
- Automated deployment
- Rollback capability

## Future Enhancements

### Phase 2
- Advanced analytics & BI
- Mobile applications (React Native)
- WhatsApp integration
- Voice assistants

### Phase 3
- AI/ML for demand forecasting
- Predictive maintenance
- Smart inventory optimization
- Chatbot support

### Phase 4
- Multi-company support
- Multi-currency
- Multi-language
- Global expansion features

## Conclusion

The AEPL ERP Platform is designed as a modern, scalable, and secure enterprise application following industry best practices. The architecture supports the complex requirements of industrial business operations while maintaining flexibility for future enhancements.
