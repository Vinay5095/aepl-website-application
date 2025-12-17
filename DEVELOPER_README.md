# 🚀 Developer Quick Start Guide
## Enterprise B2B Trade & Operations OS v2.0

> **For the complete implementation guide, see [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)**

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

```bash
# Required versions
Node.js >= 18.0.0
pnpm >= 8.0.0
Docker >= 20.10.0
Docker Compose >= 2.0.0
```

### Install Node.js & pnpm

```bash
# Using nvm (recommended)
nvm install 18
nvm use 18

# Install pnpm globally
npm install -g pnpm@8
```

### Verify installations

```bash
node --version    # Should be v18.x.x or higher
pnpm --version    # Should be 8.x.x or higher
docker --version  # Should be 20.x.x or higher
```

---

## 🏁 Quick Start (5 minutes)

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd aepl-website-application

# Install all dependencies
pnpm install
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL, Redis, MinIO
docker-compose up -d

# Verify services are running
docker-compose ps

# Check logs if needed
docker-compose logs -f
```

### 3. Environment Configuration

```bash
# Copy environment template (when available)
cp apps/api/.env.example apps/api/.env

# Edit with your settings (once API is set up)
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/trade_os_dev
# REDIS_URL=redis://localhost:6379
# S3_ENDPOINT=http://localhost:9000
```

### 4. Build Packages

```bash
# Build all packages
pnpm build

# Or build incrementally during development
pnpm dev
```

---

## 📂 Project Structure

```
aepl-website-application/
├── README.md                    # Complete technical spec (6800+ lines)
├── PRD.md                       # Final PRD (1326 lines)
├── IMPLEMENTATION_GUIDE.md      # 32-week implementation roadmap
├── DEVELOPER_README.md          # This file - quick start guide
├── docker-compose.yml           # Local development infrastructure
├── package.json                 # Root monorepo configuration
├── pnpm-workspace.yaml          # Workspace definition
├── turbo.json                   # Build system configuration
│
├── packages/                    # Shared packages
│   ├── types/                   # ✅ TypeScript type definitions
│   │   ├── src/
│   │   │   ├── enums.ts         # All enums (states, roles, etc.)
│   │   │   ├── entities.ts      # Entity interfaces (40+ entities)
│   │   │   ├── api.ts           # API request/response types
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── state-machine/           # ✅ State machine engine
│   │   ├── src/
│   │   │   ├── types.ts         # State machine types
│   │   │   ├── rfq-transitions.ts    # RFQ Item state machine (24 transitions)
│   │   │   ├── order-transitions.ts  # Order Item state machine (27 transitions)
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── database/                # 🚧 TODO: Database schema & migrations
│   ├── auth/                    # 🚧 TODO: Authentication & authorization
│   ├── audit/                   # 🚧 TODO: Audit logging
│   └── engines/                 # 🚧 TODO: All 27 engines
│
├── apps/                        # Applications
│   ├── api/                     # 🚧 TODO: Backend API
│   └── web/                     # 🚧 TODO: Frontend UI
│
└── docs/                        # Additional documentation
```

**Legend:**
- ✅ = Implemented
- 🚧 = TODO / In Progress
- ❌ = Not started

---

## 🎯 What's Currently Implemented

### Phase 1: Foundation (Partially Complete)

✅ **Project Structure**
- Monorepo setup with pnpm workspaces
- Turborepo build system configuration
- Docker Compose for local development

✅ **Type Definitions** (`packages/types`)
- Complete enums (RFQ states, Order states, Roles, etc.)
- Entity interfaces (40+ entities including RFQ, Order, Customer, Vendor)
- API request/response types
- Full TypeScript strict mode compliance

✅ **State Machine** (`packages/state-machine`)
- Complete RFQ Item state machine (24 transitions)
- Complete Order Item state machine (27 transitions)
- Role-based transition guards
- Validation rules and side effects
- Helper functions for transition checks

✅ **Infrastructure**
- PostgreSQL 15 (Docker)
- Redis 7 (Docker)
- MinIO S3-compatible storage (Docker)

---

## 🚧 What's Next (In Priority Order)

### Immediate Next Steps

1. **Database Package** (`packages/database`)
   - Set up Drizzle ORM
   - Create complete schema for all 50+ tables
   - Implement migrations
   - Add seed data

2. **Authentication Package** (`packages/auth`)
   - JWT token generation/validation
   - Role-based access control (RBAC)
   - MFA support
   - Session management

3. **Audit Package** (`packages/audit`)
   - Audit log writer
   - Change tracking
   - Query utilities

4. **API Application** (`apps/api`)
   - Express/Fastify server setup
   - RFQ endpoints
   - Order endpoints
   - State transition API
   - Authentication middleware

5. **Frontend Application** (`apps/web`)
   - React + TypeScript setup
   - Shadcn/UI component library
   - TailwindCSS configuration
   - Authentication screens
   - RFQ module UI

---

## 📚 Key Documentation Files

| File | Purpose | When to Read |
|------|---------|--------------|
| **README.md** | Complete technical specification (6800+ lines) | When implementing any feature |
| **PRD.md** | Final product requirements (1326 lines) | Before starting any module |
| **IMPLEMENTATION_GUIDE.md** | 32-week implementation roadmap | Planning and tracking progress |
| **DEVELOPER_README.md** | Quick start guide (this file) | First time setup |

---

## 🛠️ Development Workflow

### Daily Development

```bash
# Pull latest changes
git pull

# Install any new dependencies
pnpm install

# Start infrastructure (if not running)
docker-compose up -d

# Start development mode (rebuilds on change)
pnpm dev

# Run tests
pnpm test

# Lint code
pnpm lint

# Type check
pnpm typecheck
```

### Making Changes

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes...

# Build to ensure no errors
pnpm build

# Run tests
pnpm test

# Commit changes
git add .
git commit -m "feat(scope): your commit message"

# Push and create PR
git push origin feature/your-feature-name
```

### Commit Message Format

Follow conventional commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `engine`

**Examples**:
```
feat(state-machine): Implement RFQ state transitions
fix(types): Correct RfqItem interface definition
engine(sla): Add SLA monitoring cron job
docs(readme): Update quick start guide
```

---

## 🧪 Testing

### Unit Tests

```bash
# Run all unit tests
pnpm test

# Run tests for specific package
cd packages/state-machine
pnpm test

# Watch mode
pnpm test --watch

# Coverage
pnpm test --coverage
```

### Integration Tests (Once API is ready)

```bash
# Run integration tests
pnpm test:integration

# Run specific test file
pnpm test tests/integration/rfq-workflow.test.ts
```

---

## 📊 Database Management

### Access PostgreSQL

```bash
# Connect to database
docker exec -it trade-os-postgres psql -U postgres -d trade_os_dev

# Run SQL queries
SELECT * FROM rfq_items LIMIT 10;

# Exit
\q
```

### Migrations (Once database package is ready)

```bash
cd packages/database

# Generate migration
pnpm db:generate

# Run migrations
pnpm db:migrate

# Rollback migration
pnpm db:rollback

# Seed database
pnpm db:seed
```

---

## 🎨 Code Style

### TypeScript

- Strict mode enabled
- No `any` types (use `unknown` if needed)
- Explicit return types for functions
- Interface over type for object shapes

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Types/Interfaces**: `PascalCase`
- **Functions/Variables**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Enums**: `PascalCase` with `UPPER_SNAKE_CASE` values

### Example

```typescript
// Good
interface RfqItem extends BaseEntity {
  rfqId: string;
  state: RfqItemState;
}

const RFQ_MAX_ITEMS = 100;

function validateRfqItem(item: RfqItem): ValidationResult {
  // ...
}

// Bad
interface rfq_item {  // Wrong: should be PascalCase
  rfq_id: any;        // Wrong: avoid 'any'
}
```

---

## 🐛 Troubleshooting

### Issue: `pnpm install` fails

**Solution**:
```bash
# Clear cache
pnpm store prune

# Remove node_modules
rm -rf node_modules
rm -rf packages/*/node_modules
rm -rf apps/*/node_modules

# Reinstall
pnpm install
```

### Issue: Docker containers not starting

**Solution**:
```bash
# Stop all containers
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Start fresh
docker-compose up -d
```

### Issue: Port already in use

**Solution**:
```bash
# Find process using port (e.g., 5432)
lsof -i :5432

# Kill the process
kill -9 <PID>

# Or change port in docker-compose.yml
```

### Issue: TypeScript errors

**Solution**:
```bash
# Clean build cache
pnpm clean

# Rebuild
pnpm build

# Check for version mismatches
pnpm list typescript
```

---

## 🔐 Security Guidelines

1. **Never commit secrets**
   - Use `.env` files (already in .gitignore)
   - Use environment variables for sensitive data

2. **Authentication**
   - All API endpoints must check authentication
   - Enforce role-based permissions

3. **Input validation**
   - Validate all user inputs
   - Use Zod or similar for runtime validation

4. **SQL injection**
   - Always use parameterized queries
   - Never concatenate SQL strings

5. **Audit logging**
   - Log all state transitions
   - Include user ID, timestamp, IP address

---

## 📞 Getting Help

### Resources

1. **README.md** - Complete technical specification
2. **PRD.md** - Product requirements document
3. **IMPLEMENTATION_GUIDE.md** - Detailed implementation roadmap

### Common Questions

**Q: Where do I find the complete state machine definition?**
A: `packages/state-machine/src/rfq-transitions.ts` and `order-transitions.ts`

**Q: Where are the TypeScript types defined?**
A: `packages/types/src/` (enums.ts, entities.ts, api.ts)

**Q: How do I implement a new engine?**
A: Follow the pattern in IMPLEMENTATION_GUIDE.md, Phase 5-6

**Q: Where's the database schema?**
A: It's in the README.md (Section 41) and will be implemented in `packages/database`

**Q: Can I modify the state machine?**
A: Only if it's specified in PRD.md. All changes must align with the specification.

---

## ⚡ Performance Tips

### Development

```bash
# Use Turbo's remote caching (once configured)
turbo run build --remote-cache

# Parallel execution
turbo run test --parallel

# Filter to specific packages
turbo run build --filter=@trade-os/types

# Watch mode for faster iteration
pnpm dev
```

### Database

- Always use indexes for foreign keys
- Use connection pooling
- Implement query result caching (Redis)
- Use materialized views for dashboards

---

## 🎯 Definition of Done

Before marking any feature as complete, ensure:

- [ ] Code follows style guidelines
- [ ] TypeScript strict mode passes
- [ ] Unit tests written and passing (>80% coverage)
- [ ] Integration tests passing
- [ ] Code reviewed by peer
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] Error handling implemented
- [ ] Audit logging in place
- [ ] Matches specification in README.md/PRD.md

---

## 📝 License

This project is proprietary software. All rights reserved.

See [README.md](./README.md) for full license information.

---

**Happy Coding! 🚀**

For questions or issues, refer to the [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) or README.md.
