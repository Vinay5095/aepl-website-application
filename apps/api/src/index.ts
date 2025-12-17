/**
 * API Server Entry Point
 * Enterprise B2B Trade & Operations OS
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler, notFoundHandler } from './middleware/error';

// Routes
import authRoutes from './routes/auth';
import stateTransitionRoutes from './routes/state-transition';
import customerRoutes from './routes/customer';
import vendorRoutes from './routes/vendor';
import productRoutes from './routes/product';
import rfqRoutes from './routes/rfq';
import orderRoutes from './routes/order';
import slaRoutes from './routes/sla';
import creditRoutes from './routes/credit';
import fxRoutes from './routes/fx';
import taxRoutes from './routes/tax';
import notificationRoutes from './routes/notification';
import tallyRoutes from './routes/tally';
import revisionRoutes from './routes/revision';
import quantityFulfillmentRoutes from './routes/quantity-fulfillment';
import rmaRoutes from './routes/rma';
import commercialTermsRoutes from './routes/commercial-terms';
import vendorIntelligenceRoutes from './routes/vendor-intelligence';

// Services
import { startSlaMonitoringCron } from './services/sla-cron';
import { startFxRateCron } from './services/fx-rate-cron';
import { startCreditMonitoringCron } from './services/credit-cron';
import { startTallySyncCron } from './services/tally-cron';

const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || 'v1';

/**
 * Security Middleware
 */
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

/**
 * Rate Limiting
 */
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

/**
 * Body Parsing
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Request ID
 */
app.use((req, res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || 
    `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  next();
});

/**
 * Health Check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: API_VERSION,
    uptime: process.uptime(),
  });
});

/**
 * API Routes
 */
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}`, stateTransitionRoutes);
app.use(`/api/${API_VERSION}`, customerRoutes);
app.use(`/api/${API_VERSION}`, vendorRoutes);
app.use(`/api/${API_VERSION}`, productRoutes);
app.use(`/api/${API_VERSION}/rfq`, rfqRoutes);
app.use(`/api/${API_VERSION}/orders`, orderRoutes);
app.use(`/api/${API_VERSION}/sla`, slaRoutes);
app.use(`/api/${API_VERSION}/credit`, creditRoutes);
app.use(`/api/${API_VERSION}/fx`, fxRoutes);
app.use(`/api/${API_VERSION}/tax`, taxRoutes);
app.use(`/api/${API_VERSION}/notifications`, notificationRoutes);
app.use(`/api/${API_VERSION}/integrations/tally`, tallyRoutes);
app.use(`/api/${API_VERSION}`, revisionRoutes);
app.use(`/api/${API_VERSION}`, quantityFulfillmentRoutes);
app.use(`/api/${API_VERSION}`, rmaRoutes);
app.use(`/api/${API_VERSION}`, commercialTermsRoutes);
app.use(`/api/${API_VERSION}`, vendorIntelligenceRoutes);

/**
 * 404 Handler
 */
app.use(notFoundHandler);

/**
 * Error Handler (must be last)
 */
app.use(errorHandler);

/**
 * Start Server
 */
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 Enterprise B2B Trade & Operations OS - API Server');
  console.log('='.repeat(60));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api/${API_VERSION}`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  
  // Start cron jobs
  startSlaMonitoringCron();
  startFxRateCron();
  startCreditMonitoringCron();
  startTallySyncCron();
  
  console.log('⏰ Background jobs started: SLA Monitoring, FX Rate Fetching, Credit Monitoring, Tally Sync');
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
