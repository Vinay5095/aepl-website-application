# 🏗️ IMPLEMENTATION GUIDE
## Enterprise B2B Trade & Operations OS v2.0

> **Status**: Foundation Phase
> **Last Updated**: 2024-12-17
> **Estimated Timeline**: 8 months (32 weeks) for full production system

---

## 📌 CRITICAL UNDERSTANDING

This document is THE primary guide for implementing the Enterprise B2B Trade & Operations OS as specified in:
- **README.md** - Complete technical specification (6800+ lines)
- **PRD.md** - Final absolute PRD (1326 lines)

### ⚠️ ABSOLUTE RULES (NEVER VIOLATE)

1. **RFQ_ITEM / ORDER_ITEM** is the ONLY workflow entity
2. **No header-level logic** - Headers (RFQ/Order) are containers only
3. **Append-only system** - Never overwrite or delete business records
4. **Immutable after CLOSED** - Once CLOSED/FORCE_CLOSED, data is frozen forever
5. **Full audit trail** - Every action is attributed, timestamped, reason-coded
6. **State machine enforced** - Illegal transitions blocked at DB + API + UI
7. **Field-level security** - Role-based visibility enforced everywhere
8. **No mock data** - All implementations must use real, production-grade logic
9. **All 27 engines required** - Partial implementation is NOT production-ready
10. **Tally integration mandatory** - XML/HTTP integration with on-prem accounting

---

## 🗂️ PROJECT STRUCTURE

```
aepl-website-application/
├── README.md                 # Complete technical spec (6800+ lines)
├── PRD.md                    # Final PRD (1326 lines)
├── IMPLEMENTATION_GUIDE.md   # This file
├── package.json              # Root package (monorepo)
├── pnpm-workspace.yaml       # Workspace configuration
├── turbo.json                # Build system config
├── .gitignore                # Git ignore rules
│
├── packages/                 # Shared packages
│   ├── types/                # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── enums.ts      # All enums (states, roles, etc.)
│   │   │   ├── entities.ts   # Core entity types
│   │   │   ├── api.ts        # API request/response types
│   │   │   └── index.ts      # Export all types
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── database/             # Database schema & migrations
│   │   ├── src/
│   │   │   ├── schema/       # Database schemas
│   │   │   │   ├── users.ts
│   │   │   │   ├── rfq.ts
│   │   │   │   ├── order.ts
│   │   │   │   └── ...
│   │   │   ├── migrations/   # Migration files
│   │   │   ├── seed/         # Seed data
│   │   │   └── client.ts     # DB client
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   ├── state-machine/        # State machine engine
│   │   ├── src/
│   │   │   ├── rfq-transitions.ts    # RFQ state machine
│   │   │   ├── order-transitions.ts  # Order state machine
│   │   │   ├── validator.ts          # Transition validator
│   │   │   ├── executor.ts           # Transition executor
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── auth/                 # Authentication & Authorization
│   │   ├── src/
│   │   │   ├── jwt.ts        # JWT handling
│   │   │   ├── rbac.ts       # Role-based access control
│   │   │   ├── mfa.ts        # Multi-factor auth
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── audit/                # Audit logging engine
│   │   ├── src/
│   │   │   ├── logger.ts     # Audit log writer
│   │   │   ├── query.ts      # Audit log queries
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── engines/              # All 27 engines
│       ├── src/
│       │   ├── sla/          # SLA & escalation engine
│       │   ├── credit/       # Credit & financial risk
│       │   ├── fx/           # Multi-currency & FX
│       │   ├── tax/          # Tax & duty engine
│       │   ├── compliance/   # Compliance & trade regulation
│       │   ├── notification/ # Notification & alerts
│       │   ├── vendor/       # Vendor intelligence
│       │   └── ...           # 20 more engines
│       └── package.json
│
├── apps/                     # Applications
│   ├── api/                  # Backend API (Node.js + TypeScript)
│   │   ├── src/
│   │   │   ├── routes/       # API routes
│   │   │   │   ├── rfq.ts
│   │   │   │   ├── order.ts
│   │   │   │   └── ...
│   │   │   ├── middleware/   # Express middleware
│   │   │   │   ├── auth.ts
│   │   │   │   ├── error.ts
│   │   │   │   └── audit.ts
│   │   │   ├── services/     # Business logic services
│   │   │   │   ├── rfq-service.ts
│   │   │   │   ├── order-service.ts
│   │   │   │   └── ...
│   │   │   ├── server.ts     # Express server
│   │   │   └── index.ts
│   │   ├── .env.example
│   │   └── package.json
│   │
│   └── web/                  # Frontend UI (React + TypeScript)
│       ├── src/
│       │   ├── components/   # Shared components (Shadcn/UI)
│       │   ├── pages/        # Page components
│       │   │   ├── rfq/
│       │   │   ├── order/
│       │   │   ├── dashboard/
│       │   │   └── ...
│       │   ├── hooks/        # Custom React hooks
│       │   ├── lib/          # Utilities
│       │   ├── styles/       # TailwindCSS
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── package.json
│       └── vite.config.ts
│
├── docker/                   # Docker configurations
│   ├── docker-compose.yml    # Local dev environment
│   ├── Dockerfile.api
│   └── Dockerfile.web
│
└── docs/                     # Additional documentation
    ├── architecture/
    ├── api/
    └── deployment/
```

---

## 🚀 GETTING STARTED

### Prerequisites

```bash
# Required versions
node >= 18.0.0
pnpm >= 8.0.0
PostgreSQL >= 15
Redis >= 7
Docker (recommended)
```

### Initial Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd aepl-website-application

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp apps/api/.env.example apps/api/.env
# Edit .env with your database credentials

# 4. Start database (Docker)
docker-compose up -d postgres redis

# 5. Run migrations
cd packages/database
pnpm db:migrate

# 6. Seed initial data
pnpm db:seed

# 7. Start development servers
cd ../..
pnpm dev
```

---

## 📊 IMPLEMENTATION PHASES

### Phase 1: Foundation (Week 1-2) ✅ IN PROGRESS
**Status**: Foundation files created
**Next Steps**:
1. Complete TypeScript type definitions
2. Set up database schema with Drizzle ORM
3. Create Docker development environment
4. Implement basic API structure with Express

**Deliverables**:
- [ ] Complete type definitions (all enums + entities)
- [ ] Database schema for all entities
- [ ] Working PostgreSQL migrations
- [ ] Basic Express API with health checks
- [ ] Docker Compose for local dev
- [ ] Authentication stub (JWT)

### Phase 2: State Machine Engine (Week 3-4)
**Critical**: This is THE core of the system

**Implementation Checklist**:
1. **RFQ Item State Machine**
   - [ ] Define all 16 states from PRD
   - [ ] Implement state transition matrix (from → to)
   - [ ] Add role-based transition guards
   - [ ] Implement side effects (notifications, SLA start)
   - [ ] Add validation rules per transition
   - [ ] Create audit logging for all transitions

2. **Order Item State Machine**
   - [ ] Define all 18 states from PRD
   - [ ] Implement state transition matrix
   - [ ] Add role-based transition guards
   - [ ] Implement side effects
   - [ ] Add validation rules
   - [ ] Create audit logging

3. **Database Constraints**
   - [ ] Create `state_transitions` table
   - [ ] Implement `validate_state_transition()` function
   - [ ] Add immutability triggers for CLOSED states
   - [ ] Enforce role permissions at DB level

4. **API Endpoints**
   - [ ] `POST /api/v1/rfq-items/:id/transition`
   - [ ] `POST /api/v1/order-items/:id/transition`
   - [ ] `GET /api/v1/rfq-items/:id/transitions` (allowed)
   - [ ] `GET /api/v1/order-items/:id/transitions` (allowed)

**Testing Requirements**:
- Unit tests for each transition
- Integration tests for invalid transitions
- Role permission tests
- Immutability tests for CLOSED states

### Phase 3: RFQ Module (Week 5-7)
End-to-end RFQ workflow implementation

**Backend**:
- [ ] RFQ header CRUD (container only)
- [ ] RFQ_ITEM CRUD with state machine
- [ ] Revision governance system
- [ ] Commercial terms management
- [ ] Vendor quote capture
- [ ] Cost breakdown calculator
- [ ] Quote PDF generation

**Frontend**:
- [ ] RFQ list page with filters
- [ ] RFQ create/edit page
- [ ] RFQ detail page with timeline
- [ ] Item-level state transition UI
- [ ] Vendor quote comparison view
- [ ] Cost breakdown interface

**Database**:
- [ ] `rfqs` table (container)
- [ ] `rfq_items` table (workflow entity)
- [ ] `rfq_item_revisions` table
- [ ] `commercial_terms` table
- [ ] `vendor_quotes` table
- [ ] `cost_breakdowns` table
- [ ] `compliance_data` table

### Phase 4: Order Module (Week 8-11)
End-to-end order workflow implementation

**Backend**:
- [ ] Order creation from RFQ
- [ ] ORDER_ITEM state machine integration
- [ ] Purchase order generation
- [ ] GRN creation
- [ ] QC workflow with lot management
- [ ] Shipment tracking
- [ ] Invoice generation
- [ ] Payment recording

**Frontend**:
- [ ] Order list page
- [ ] Order detail page
- [ ] PO management UI
- [ ] GRN capture form
- [ ] QC approval interface
- [ ] Shipment tracking view
- [ ] Invoice/Payment UI

**Database**:
- [ ] `orders` table (container)
- [ ] `order_items` table (workflow entity)
- [ ] `order_item_lots` table
- [ ] `purchase_orders` table
- [ ] `goods_receipt_notes` table
- [ ] `shipments` table
- [ ] `invoices` table
- [ ] `payments` table

### Phase 5: Critical Engines (Week 12-16)
Implement the engines that make the system production-ready

**Priority Engines**:
1. **SLA & Escalation Engine**
   - [ ] SLA rules configuration
   - [ ] Cron job for monitoring (every 15 min)
   - [ ] Warning notifications (80% threshold)
   - [ ] Escalation workflow
   - [ ] Auto-close logic

2. **Credit & Financial Risk Engine**
   - [ ] Customer credit profiles
   - [ ] Credit check function
   - [ ] Exposure tracking
   - [ ] Credit hold/override workflow

3. **Multi-Currency & FX Engine**
   - [ ] FX rates table
   - [ ] Rate fetching (RBI/OANDA)
   - [ ] Currency conversion
   - [ ] FX gain/loss calculation

4. **Tax & Duty Engine**
   - [ ] HS code management
   - [ ] Customs duty calculator
   - [ ] GST calculation (India)
   - [ ] Tax breakdown

5. **Audit & Compliance Engine**
   - [ ] Audit logging for all actions
   - [ ] Export control checks
   - [ ] Sanctioned country verification
   - [ ] Denied party screening

6. **Notification Engine**
   - [ ] Email notifications (SendGrid/SMTP)
   - [ ] SMS gateway integration
   - [ ] In-app notifications
   - [ ] Escalation alerts

### Phase 6: Remaining Engines (Week 17-22)
Implement the remaining 21 engines from the PRD

**See PRD.md Section 3.1 for complete list**

### Phase 7: Tally Integration (Week 23-24)
Critical accounting integration

**Middleware**:
- [ ] XML voucher generation
- [ ] HTTP sync with on-prem Tally
- [ ] Sync queue with retry logic
- [ ] Failed sync recovery
- [ ] Status monitoring

**Sync Events**:
- [ ] Invoice → Sales Invoice
- [ ] Payment → Receipt
- [ ] Vendor Invoice → Purchase Invoice
- [ ] FX Gain/Loss → Journal Voucher

### Phase 8: Frontend Complete (Week 25-28)
Full UI implementation

**Design System**:
- [ ] Shadcn/UI component library
- [ ] TailwindCSS configuration
- [ ] Theme system
- [ ] Responsive design

**Pages**:
- [ ] Dashboard (all roles)
- [ ] RFQ module (complete)
- [ ] Order module (complete)
- [ ] Master data management
- [ ] Reports & analytics
- [ ] Admin panel

### Phase 9: Testing & QA (Week 29-30)
Comprehensive testing

**Test Coverage Targets**:
- Unit tests: 80%
- Integration tests: 70%
- E2E tests: Critical paths

**Performance Testing**:
- P95 latency < 500ms
- Load testing (concurrent users)
- Database query optimization

**Security Testing**:
- Penetration testing
- Role permission validation
- Field-level security audit

### Phase 10: Production Deployment (Week 31-32)
Final preparations

**Infrastructure**:
- [ ] Production database setup
- [ ] Redis cluster
- [ ] Object storage (S3)
- [ ] CDN configuration
- [ ] Monitoring (Prometheus + Grafana)
- [ ] Alerting system
- [ ] Backup automation

**Documentation**:
- [ ] API documentation
- [ ] User manual
- [ ] Admin guide
- [ ] Runbook
- [ ] Disaster recovery plan

**Go-Live Checklist**: See PRD.md Section 19

---

## 🔧 DEVELOPMENT WORKFLOW

### Branch Strategy

```
main                  # Production-ready code
├── develop           # Integration branch
├── feature/*         # Feature branches
├── engine/*          # Engine implementation branches
├── bugfix/*          # Bug fixes
└── hotfix/*          # Production hotfixes
```

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `engine`

**Examples**:
```
engine(state-machine): Implement RFQ state transitions

- Add all 16 RFQ states
- Implement transition validation
- Add role-based guards
- Create audit logging

Refs: #123
```

### Code Review Requirements

- [ ] All state transitions tested
- [ ] Audit logging verified
- [ ] Field-level security enforced
- [ ] No hardcoded business rules
- [ ] TypeScript strict mode passed
- [ ] Unit tests pass (>80% coverage)
- [ ] Integration tests pass
- [ ] ESLint/Prettier passed

---

## 📖 KEY REFERENCES

### README.md Sections (Critical)
- Section 4: **Core Concepts** (Line 337)
- Section 7: **Workflow State Machines** (Lines 1300-1400)
- Section 8: **State Ownership Matrix** (Lines 353-373)
- Section 9: **Revision Governance** (Lines 119-125)
- Section 24: **Core Engines** (Lines 198-217)
- Section 41: **Database Schema** (Lines 2450+)

### PRD.md Sections (Critical)
- Section 1.2: **Absolute Design Principles** (Lines 22-37)
- Section 4: **Global Item State Machine** (Lines 249-311)
- Section 5: **Item State Ownership Matrix** (Lines 353-373)
- Section 6: **Revision Governance** (Lines 376-419)
- Section 3.1: **Engine Checklist** (Lines 143-172)

---

## ⚠️ COMMON PITFALLS (AVOID)

1. **❌ Header-level workflow logic**
   - ✅ Always work at item level (RFQ_ITEM / ORDER_ITEM)

2. **❌ Modifying closed items**
   - ✅ Once CLOSED/FORCE_CLOSED, create new RFQ for corrections

3. **❌ Deleting business records**
   - ✅ Use soft-delete flags, never DELETE

4. **❌ Skipping audit logging**
   - ✅ Every action must be audited

5. **❌ Hardcoded business rules**
   - ✅ All rules must be configurable/enforceable via DB

6. **❌ Missing role checks**
   - ✅ Enforce permissions at API + DB + UI

7. **❌ Ignoring state machine**
   - ✅ All transitions must go through state machine engine

8. **❌ Mock/dummy data in production code**
   - ✅ Only real, production-grade implementations

9. **❌ Partial engine implementation**
   - ✅ All 27 engines must be complete

10. **❌ Breaking immutability**
    - ✅ Database triggers must prevent closed item modifications

---

## 🎯 SUCCESS CRITERIA

The system is production-ready when:

✅ All 27 engines implemented and tested
✅ All state transitions validated (16 RFQ + 18 Order)
✅ SLA monitoring active (cron every 15 min)
✅ Audit logging verified (immutable, complete)
✅ Field-level security enforced (role-based)
✅ P95 latency < 500ms
✅ Database queries optimized
✅ Tally integration tested
✅ 80% unit test coverage
✅ 70% integration test coverage
✅ E2E tests passing (critical paths)
✅ Penetration testing passed
✅ Production deployment successful
✅ Disaster recovery drilled
✅ Monitoring dashboards live
✅ Runbook documented

---

## 📞 SUPPORT & RESOURCES

### Documentation
- **README.md**: Complete technical specification
- **PRD.md**: Final absolute PRD
- **This file**: Implementation guide

### Tech Stack
- **Backend**: Node.js 18+, TypeScript 5+, Express/Fastify
- **Database**: PostgreSQL 15+, Drizzle ORM
- **Cache**: Redis 7+
- **Frontend**: React 18+, TypeScript, Shadcn/UI, TailwindCSS
- **State Management**: React Query + Zustand
- **Testing**: Vitest, Playwright
- **Build**: Turborepo, pnpm

### External Integrations
- **Tally**: XML/HTTP middleware
- **Email**: SendGrid or SMTP
- **SMS**: MSG91 or similar
- **FX Rates**: RBI/OANDA APIs
- **Object Storage**: S3-compatible (MinIO/AWS)

---

## 🔒 FINAL STATEMENT

This implementation must follow README.md and PRD.md **exactly**.

**NO ASSUMPTIONS. NO SIMPLIFICATIONS. NO SHORTCUTS.**

Any deviation invalidates production readiness.

Build this system to handle:
- ✅ Any product (industrial, commodity, machinery, chemicals, FMCG)
- ✅ Any country (domestic + international trade)
- ✅ Urgency, disputes, audits
- ✅ Margin, tax, compliance requirements
- ✅ Years of growth with immutable audit trail

---

**Document Version**: 1.0
**Last Updated**: 2024-12-17
**Status**: ACTIVE DEVELOPMENT

---

> "The only workflow entities are RFQ_ITEM and ORDER_ITEM. Everything else is support structure."
> — PRD.md, Section 1.2
