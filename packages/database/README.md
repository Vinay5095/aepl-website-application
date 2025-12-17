# @trade-os/database

Database schema and migrations for Enterprise B2B Trade & Operations OS.

## Overview

This package implements the complete database schema using Drizzle ORM and PostgreSQL 15+, strictly following the specifications in README.md and PRD.md.

### Key Features

- **55+ Tables** covering all business entities
- **Mandatory Audit Columns** on every table
- **State Machine Support** for RFQ_ITEM and ORDER_ITEM workflows
- **Immutability Triggers** preventing closed item modifications
- **Audit Logging** with automatic change tracking
- **Type-Safe** with Drizzle ORM
- **Migration System** with version control

## Schema Overview

### Workflow Entities (CRITICAL)

Per PRD.md: "RFQ_ITEM / ORDER_ITEM is the ONLY workflow entity"

- **rfq_items** - RFQ line items (16 states, PRIMARY workflow entity)
- **order_items** - Order line items (18 states, PRIMARY workflow entity)

Headers (`rfqs`, `orders`) are containers only with NO workflow logic.

### Master Data

- **organizations** - Multi-tenant root
- **legal_entities** - Companies/branches
- **users** - System users with MFA
- **roles** - 22 user roles
- **permissions** - Granular permissions
- **customers** - Customer master with credit profiles
- **vendors** - Vendor master with ratings
- **products** - Product master with specifications

### Supporting Tables

- **rfq_item_revisions** - Version history
- **commercial_terms** - Incoterms, payment, warranty
- **vendor_quotes** - Vendor responses
- **cost_breakdowns** - Complete costing
- **compliance_data** - Export controls, sanctions
- **order_item_lots** - Quantity splits with QC
- **purchase_orders** - PO to vendors
- **shipments** - Shipment tracking
- **invoices** - Customer invoices
- **payments** - Payment records
- **rmas** - Returns management

### System Tables

- **audit_logs** - Complete change history
- **state_transitions** - Valid transition matrix
- **sla_rules** - SLA configuration
- **fx_rates** - Currency exchange rates
- **tally_sync_queue** - Accounting integration queue
- **notifications** - Notification logs

## Installation

```bash
cd packages/database
pnpm install
```

## Configuration

Create `.env` file:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/trade_os_dev
```

## Usage

### Generate Migrations

```bash
pnpm db:generate
```

### Run Migrations

```bash
pnpm db:migrate
```

### Seed Database

```bash
pnpm db:seed
```

Super Admin Credentials (default):
- Email: `admin@aepl.com`
- Password: `Admin@123`

### Push Schema (Development)

```bash
pnpm db:push
```

### Drizzle Studio (GUI)

```bash
pnpm db:studio
```

## Database Functions

### Audit Log Trigger

Automatically logs all INSERT, UPDATE, DELETE operations:

```sql
CREATE TRIGGER rfq_items_audit
AFTER INSERT OR UPDATE OR DELETE ON rfq_items
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
```

Applied to all critical tables.

### Immutability Trigger

Prevents modifications to closed items:

```sql
CREATE TRIGGER rfq_items_immutability
BEFORE UPDATE ON rfq_items
FOR EACH ROW EXECUTE FUNCTION prevent_closed_item_modification();
```

Raises exception if attempting to modify items in `CLOSED`, `FORCE_CLOSED`, or `RFQ_CLOSED` states.

### State Transition Validation

Validates transitions before execution:

```sql
SELECT validate_state_transition(
  'RFQ_ITEM',
  'DRAFT',
  'RFQ_SUBMITTED',
  'SALES_EXECUTIVE'
); -- Returns true/false
```

```sql
SELECT * FROM get_allowed_transitions(
  'RFQ_ITEM',
  'DRAFT',
  'SALES_EXECUTIVE'
); -- Returns allowed to_states
```

## Schema Structure

```
src/
├── schema/
│   ├── base.ts          # Audit columns
│   ├── users.ts         # Users & roles
│   ├── customers.ts     # Customers
│   ├── vendors.ts       # Vendors
│   ├── products.ts      # Products
│   ├── rfq.ts           # RFQ workflow ⭐
│   ├── orders.ts        # Order workflow ⭐
│   ├── system.ts        # System tables
│   └── index.ts         # Exports
├── client.ts            # DB connection
├── migrate.ts           # Migration runner
├── seed.ts              # Seed data
└── index.ts             # Main exports

sql/
└── functions/
    ├── audit_log_trigger.sql
    ├── immutability_trigger.sql
    └── state_transition_validation.sql
```

## Audit Columns

Every table MUST include these mandatory audit columns:

```typescript
{
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: uuid('created_by').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: uuid('updated_by').notNull(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
  deletedBy: uuid('deleted_by'),
  deletionReason: text('deletion_reason'),
}
```

## State Machine Support

### RFQ Items

16 states: `DRAFT` → `RFQ_SUBMITTED` → `SALES_REVIEW` → `TECH_REVIEW` → `TECH_APPROVED` → `COMPLIANCE_REVIEW` → `STOCK_CHECK` → `SOURCING_ACTIVE` → `VENDOR_QUOTES_RECEIVED` → `RATE_FINALIZED` → `MARGIN_APPROVAL` → `PRICE_FROZEN` → `QUOTE_SENT` → `CUSTOMER_ACCEPTED`/`CUSTOMER_REJECTED` → `RFQ_CLOSED`

### Order Items

18 states: `PR_CREATED` → `PR_ACKNOWLEDGED` → `CREDIT_CHECK` → `CREDIT_HOLD` → `PO_RELEASED` → `VENDOR_CONFIRMED` → `IN_PRODUCTION` → `GOODS_RECEIVED` → `QC_APPROVED`/`QC_REJECTED` → `READY_TO_DISPATCH` → `DISPATCHED` → `DELIVERED` → `INVOICED` → `PAYMENT_PARTIAL` → `PAYMENT_CLOSED` → `CLOSED`

Also: `CANCELLED` → `FORCE_CLOSED`

## Immutability Rules

Once an item reaches a terminal state (`CLOSED`, `FORCE_CLOSED`, `RFQ_CLOSED`), it becomes **immutable forever**.

Any attempt to modify will raise:
```
Cannot modify closed item (ID: xxx). State: CLOSED. Create new RFQ for corrections.
```

This is enforced at the database level via triggers.

## Type Safety

All schemas are fully typed and exported:

```typescript
import { db, rfqItems, orderItems } from '@trade-os/database';

// Fully typed queries
const items = await db.select().from(rfqItems).where(...);
```

## Compliance

This schema implementation ensures:

✅ **Item-Level Workflow** - Only rfq_items and order_items have state machines
✅ **Header as Container** - rfqs and orders tables have NO state fields
✅ **Audit Trail** - All tables have mandatory audit columns
✅ **Immutability** - Database triggers prevent closed item modifications
✅ **State Validation** - Functions enforce valid transitions
✅ **No Mock Data** - Production-grade schema only
✅ **PRD Alignment** - 100% aligned with README.md and PRD.md

## Relationships

Drizzle ORM relations configured for:
- One-to-many (organization → users)
- Many-to-many (roles ↔ permissions)
- One-to-one (rfq_item → commercial_terms)

Query with relations:

```typescript
const rfqWithItems = await db.query.rfqs.findFirst({
  with: {
    items: {
      with: {
        product: true,
        vendorQuotes: true,
      },
    },
  },
});
```

## Performance

### Indexes

Key indexes created:
- `audit_logs_table_record_idx` - For audit queries
- `audit_logs_timestamp_idx` - For time-based queries
- `tally_sync_queue_status_idx` - For sync queue processing
- Foreign key indexes (automatic)

### Connection Pooling

Configured via `postgres` client with sensible defaults.

## Migrations

Migrations are version-controlled in `migrations/` directory.

Each migration is a SQL file with:
- Up migration (apply changes)
- Down migration (revert changes)

Generate new migration:
```bash
pnpm db:generate
```

This creates a timestamped SQL file in `migrations/`.

## Troubleshooting

### Migration Fails

```bash
# Reset database (WARNING: destroys all data)
psql -U postgres -c "DROP DATABASE trade_os_dev;"
psql -U postgres -c "CREATE DATABASE trade_os_dev;"

# Run migrations again
pnpm db:migrate
```

### Seed Fails

```bash
# Clear data (keeps schema)
# Then re-run seed
pnpm db:seed
```

### Connection Issues

Check DATABASE_URL in `.env` and ensure PostgreSQL is running:
```bash
docker-compose ps postgres
```

## Contributing

When adding new tables:

1. Create schema file in `src/schema/`
2. Include mandatory audit columns from `base.ts`
3. Add relations if needed
4. Export from `src/schema/index.ts`
5. Generate migration: `pnpm db:generate`
6. Test migration: `pnpm db:migrate`
7. Update this README

## License

Proprietary - Enterprise B2B Trade & Operations OS
