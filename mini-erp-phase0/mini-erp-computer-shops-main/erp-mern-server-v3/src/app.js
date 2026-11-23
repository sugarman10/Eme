import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import { xssProtection, additionalSecurityHeaders } from './middleware/security.js';

import usersRoutes from './routes/users.js';
import inventoryRoutes from './routes/inventory.js';
import procurementRoutes from './routes/procurement.js';
import salesV2Routes from './routes/salesV2.js';
import customerRoutes from './routes/customers.js';
import salesOrderRoutes from './routes/salesOrders.js';
import financeRoutes from './routes/finance.js';
import fiscalPeriodsRouter from './routes/fiscalPeriods.js';
import treasuriesRoutes from './routes/treasuries.js';
import hrRoutes from './routes/hr.js';
import authRoutes from './routes/auth.js';
import departmentsRoutes from './routes/departments.js';
import reportsRoutes from './routes/reports.js';
import notificationsRoutes from './routes/notifications.js';
import dashboardRoutes from './routes/dashboard.js';
import dailyClosuresRoutes from './routes/dailyClosures.js';
import settingsRoutes from './routes/settings.js';
import walletRoutes from './routes/wallet.js';
import auditRoutes from './routes/audit.js';
import expensesRoutes from './routes/expenses.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { apiLimiter, authLimiter, heavyLimiter } from './middleware/rateLimiter.js';
import { fiscalPeriodMiddleware } from './middleware/fiscalPeriod.js';

const app = express();

// ============================================================
// SECURITY MIDDLEWARE (Order matters!)
// ============================================================

// 1. Helmet - Basic security headers
app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));

// 2. Additional security headers
app.use(additionalSecurityHeaders());

// 3. CORS
const getOrigins = () => {
  const list = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '';
  return list
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};
const origins = getOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow all in development/test if no origin (like mobile/Postman) or matches list
      const isAllowed =
        !origin || process.env.NODE_ENV !== 'production' || origins.includes(origin) || origins.includes('*');

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked origin: ${origin}. Allowed: ${origins.join(', ')}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// 4. JSON/URLENCODED Parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 5. NoSQL Injection Prevention
app.use(mongoSanitize());

// 6. XSS Protection - Sanitize inputs
app.use(xssProtection());

// 7. Logging
app.use(morgan('tiny'));
app.use('/uploads', express.static('uploads'));

// صحّة
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// ⭐ Rate Limiting Protection
app.use('/api/', apiLimiter); // General API protection

// 📅 Active Fiscal Period Context
app.use(fiscalPeriodMiddleware);

// مسارات
app.use('/api/auth', authLimiter, authRoutes); // Strict limiting for auth
app.use('/api/users', usersRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/sales', salesV2Routes); // V2 now handles /invoice, /invoice-v2, etc.
app.use('/api/customers', customerRoutes); // NEW
app.use('/api/so', salesOrderRoutes); // NEW logic for Sales Orders
app.use('/api/finance', financeRoutes);
app.use('/api/fiscal-periods', fiscalPeriodsRouter);
app.use('/api/finance/treasuries', treasuriesRoutes);
app.use('/api/hr', hrRoutes); // NEW
app.use('/api/reports', heavyLimiter, reportsRoutes); // Heavy operations
app.use('/api/dashboard', dashboardRoutes); // NEW: Dashboard Analytics
app.use('/api/notifications', notificationsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/daily-closures', dailyClosuresRoutes); // الإغلاق اليومي
app.use('/api/wallet', walletRoutes); // محفظة العميل (Store Credit)
app.use('/api/audit', auditRoutes);
app.use('/api/expenses', expensesRoutes); // المصروفات

// 404 + أخطاء للمسارات غير الموجودة في /api
app.use('/api', notFound);
app.use('/api', errorHandler);

// Serve static frontend files in production / electron
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const possibleClientPaths = [
  process.env.CLIENT_DIR,
  path.join(__dirname, '..', 'client'),
  path.join(__dirname, '../../erp-mern-client-v3-full/dist'),
  path.join(__dirname, '../../desktop-app/client')
].filter(Boolean);

const clientPath = possibleClientPaths.find(p => fs.existsSync(path.join(p, 'index.html')));

if (clientPath && (process.env.SERVE_CLIENT === 'true' || process.env.NODE_ENV === 'production' || process.env.ELECTRON_RUN_AS_NODE === '1')) {
  app.use(express.static(clientPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// Catch-all errors
app.use(errorHandler);

export default app;
