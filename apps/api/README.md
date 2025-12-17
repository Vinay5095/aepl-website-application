# @trade-os/api

Backend API server for Enterprise B2B Trade & Operations OS.

## Overview

Express-based REST API with:
- JWT authentication with refresh tokens
- Role-based authorization (22 roles)
- Rate limiting and security headers
- Error handling and validation
- Request logging
- Health checks

## Stack

- **Framework**: Express.js
- **Language**: TypeScript (strict mode)
- **Validation**: Zod
- **Auth**: JWT (jsonwebtoken)
- **Database**: Drizzle ORM + PostgreSQL
- **Security**: helmet, cors, rate-limit

## Getting Started

### Prerequisites

```bash
# Ensure database is running
docker-compose up -d postgres redis

# Ensure database is migrated
cd packages/database
pnpm db:migrate
pnpm db:seed
```

### Configuration

Copy `.env.example` to `.env` and configure:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/trade_os_dev
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:5173
```

### Development

```bash
# Install dependencies
pnpm install

# Start dev server (with hot reload)
pnpm dev

# Type check
pnpm typecheck
```

### Production

```bash
# Build
pnpm build

# Start
pnpm start
```

## API Endpoints

### Authentication

#### POST /api/v1/auth/login
Login with email and password (and optional MFA token).

**Request:**
```json
{
  "email": "admin@aepl.com",
  "password": "Admin@123",
  "mfaToken": "123456" // optional, required if MFA enabled
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "sessionId": "uuid",
    "user": {
      "id": "uuid",
      "email": "admin@aepl.com",
      "firstName": "Super",
      "lastName": "Admin",
      "role": "MD",
      "roleName": "Managing Director",
      "organizationId": "uuid"
    }
  }
}
```

**Error (MFA Required):**
```json
{
  "success": false,
  "error": {
    "code": "MFA_REQUIRED",
    "message": "Multi-factor authentication required"
  },
  "requiresMfa": true
}
```

**Error (Account Locked):**
```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "Account locked due to too many failed login attempts. Try again in 12 minutes."
  }
}
```

#### POST /api/v1/auth/logout
Logout current session.

**Headers:**
```
Authorization: Bearer <access_token>
X-Session-ID: <session_id>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### POST /api/v1/auth/logout-all
Logout all sessions for current user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out from all devices"
}
```

#### POST /api/v1/auth/refresh
Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

#### GET /api/v1/auth/me
Get current user information.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "admin@aepl.com",
    "firstName": "Super",
    "lastName": "Admin",
    "role": "MD",
    "roleName": "Managing Director",
    "organizationId": "uuid",
    "mfaEnabled": false
  }
}
```

### Health Check

#### GET /health
Check API server health.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-17T19:00:00.000Z",
  "version": "v1",
  "uptime": 123.456
}
```

## Authentication Flow

### 1. Login

```typescript
// POST /api/v1/auth/login
const response = await fetch('http://localhost:3000/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'admin@aepl.com',
    password: 'Admin@123',
  }),
});

const { data } = await response.json();
const { accessToken, refreshToken, sessionId } = data;

// Store tokens securely
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);
localStorage.setItem('sessionId', sessionId);
```

### 2. Authenticated Requests

```typescript
// GET /api/v1/auth/me
const response = await fetch('http://localhost:3000/api/v1/auth/me', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
  },
});
```

### 3. Token Refresh

```typescript
// When access token expires (401 error), refresh it
const response = await fetch('http://localhost:3000/api/v1/auth/refresh', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    refreshToken: localStorage.getItem('refreshToken'),
  }),
});

const { data } = await response.json();
localStorage.setItem('accessToken', data.accessToken);
localStorage.setItem('refreshToken', data.refreshToken);
```

### 4. Logout

```typescript
// POST /api/v1/auth/logout
await fetch('http://localhost:3000/api/v1/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
    'X-Session-ID': localStorage.getItem('sessionId'),
  },
});

// Clear tokens
localStorage.removeItem('accessToken');
localStorage.removeItem('refreshToken');
localStorage.removeItem('sessionId');
```

## Error Handling

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "timestamp": "2024-12-17T19:00:00.000Z",
    "requestId": "12345-abcde",
    "path": "/api/v1/auth/login"
  }
}
```

### Error Codes

- `UNAUTHORIZED` (401) - No or invalid token
- `FORBIDDEN` (403) - Insufficient permissions
- `NOT_FOUND` (404) - Resource not found
- `INVALID_CREDENTIALS` (401) - Wrong email/password
- `ACCOUNT_LOCKED` (403) - Too many failed logins
- `ACCOUNT_DISABLED` (403) - User account disabled
- `MFA_REQUIRED` (200) - MFA token needed
- `INVALID_MFA_TOKEN` (401) - Wrong MFA code
- `INTERNAL_SERVER_ERROR` (500) - Server error

## Middleware

### authenticate

Verifies JWT token and attaches user to request.

```typescript
import { authenticate } from './middleware/auth';

router.get('/protected', authenticate, (req: AuthRequest, res) => {
  const user = req.user; // JwtPayload
  // ...
});
```

### authorize

Checks if user has required role(s).

```typescript
import { authenticate, authorize } from './middleware/auth';
import { Role } from '@trade-os/types';

router.post(
  '/admin-only',
  authenticate,
  authorize(Role.MD, Role.DIRECTOR, Role.ADMIN),
  (req, res) => {
    // Only MD, DIRECTOR, ADMIN can access
  }
);
```

### asyncHandler

Wraps async route handlers to catch errors.

```typescript
import { asyncHandler } from './middleware/error';

router.get('/data', asyncHandler(async (req, res) => {
  const data = await fetchData();
  res.json({ success: true, data });
  // Errors automatically caught and passed to error handler
}));
```

## Security Features

### Rate Limiting

- 100 requests per 15 minutes per IP
- Configurable via environment variables

### Security Headers

Helmet.js adds:
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options
- etc.

### CORS

Configured for specific origin (default: localhost:5173)

### Account Locking

- 5 failed login attempts locks account for 15 minutes
- Tracked per email address

### Password Policy

- Minimum 8 characters
- Uppercase, lowercase, number, special character required
- Common password detection

## TODO (Future Endpoints)

### RFQ Management
- `POST /api/v1/rfq` - Create RFQ
- `GET /api/v1/rfq` - List RFQs
- `GET /api/v1/rfq/:id` - Get RFQ details
- `POST /api/v1/rfq/:id/items/:itemId/transition` - Transition RFQ item state

### Order Management
- `POST /api/v1/orders` - Create order from RFQ
- `GET /api/v1/orders` - List orders
- `GET /api/v1/orders/:id` - Get order details
- `POST /api/v1/orders/:id/items/:itemId/transition` - Transition order item state

### Master Data
- Customer CRUD
- Vendor CRUD
- Product CRUD

### Reporting
- Dashboard metrics
- SLA performance
- Credit exposure

## Architecture

```
apps/api/
├── src/
│   ├── index.ts              # Server entry point
│   ├── middleware/
│   │   ├── auth.ts           # JWT verification & authorization
│   │   └── error.ts          # Error handling
│   ├── routes/
│   │   └── auth.ts           # Auth endpoints
│   ├── services/             # TODO: Business logic
│   └── utils/                # TODO: Utilities
├── package.json
├── tsconfig.json
└── .env.example
```

## Testing

```bash
# Unit tests
pnpm test

# Test authentication
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aepl.com","password":"Admin@123"}'

# Test health check
curl http://localhost:3000/health
```

## Production Deployment

### Environment Variables (Required)

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=<production-db-url>
JWT_SECRET=<strong-random-secret>
JWT_REFRESH_SECRET=<strong-random-secret>
CORS_ORIGIN=<frontend-url>
```

### Performance

- Enable compression
- Use Redis for session storage (not in-memory)
- Enable caching
- Use connection pooling

### Monitoring

- Health check endpoint for load balancers
- Structured logging
- Error tracking (Sentry)
- Performance monitoring (New Relic)

## License

Proprietary - Enterprise B2B Trade & Operations OS
