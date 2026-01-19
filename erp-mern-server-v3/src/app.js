import 'dotenv/config'
import express from 'express';
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import mongoSanitize from 'express-mongo-sanitize'
import { xssProtection, additionalSecurityHeaders } from './middleware/security.js'

import usersRoutes from './routes/users.js'
import inventoryRoutes from './routes/inventory.js'
import procurementRoutes from './routes/procurement.js'
import salesV2Routes from './routes/salesV2.js'
import customerRoutes from './routes/customers.js'
import salesOrderRoutes from './routes/salesOrders.js'
import financeRoutes from './routes/finance.js'
import treasuriesRoutes from './routes/treasuries.js'
import hrRoutes from './routes/hr.js'
import authRoutes from './routes/auth.js'
import departmentsRoutes from './routes/departments.js'
import reportsRoutes from './routes/reports.js'
import notificationsRoutes from './routes/notifications.js'
import dashboardRoutes from './routes/dashboard.js';
import dailyClosuresRoutes from './routes/dailyClosures.js';
import settingsRoutes from './routes/settings.js';
import walletRoutes from './routes/wallet.js';
import { errorHandler, notFound } from './middleware/errors.js'
import { apiLimiter, authLimiter, heavyLimiter } from './middleware/rateLimiter.js'

const app = express()

// ============================================================
// SECURITY MIDDLEWARE (Order matters!)
// ============================================================

// 1. Helmet - Basic security headers
app.use(helmet({ crossOriginResourcePolicy: false }))

// 2. Additional security headers
app.use(additionalSecurityHeaders())

// 3. CORS
const getOrigins = () => {
    const list = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '';
    return list.split(',').map(s => s.trim()).filter(Boolean);
};
const origins = getOrigins();

app.use(cors({
    origin: (origin, callback) => {
        // Allow all in development/test if no origin (like mobile/Postman) or matches list
        const isAllowed = !origin ||
            process.env.NODE_ENV !== 'production' ||
            origins.includes(origin) ||
            origins.includes('*');

        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Blocked origin: ${origin}. Allowed: ${origins.join(', ')}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
}))

// 4. JSON/URLENCODED Parsing
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

// 5. NoSQL Injection Prevention
app.use(mongoSanitize())

// 6. XSS Protection - Sanitize inputs
app.use(xssProtection())

// 7. Logging
app.use(morgan('tiny'))
app.use('/uploads', express.static('uploads'))

// صحّة  
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }))

// ⭐ Rate Limiting Protection
app.use('/api/', apiLimiter) // General API protection

// مسارات
app.use('/api/auth', authLimiter, authRoutes) // Strict limiting for auth
app.use('/api/users', usersRoutes)
app.use('/api/departments', departmentsRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/procurement', procurementRoutes)
app.use('/api/sales', salesV2Routes) // V2 now handles /invoice, /invoice-v2, etc.
app.use('/api/customers', customerRoutes) // NEW
app.use('/api/so', salesOrderRoutes) // NEW logic for Sales Orders
app.use('/api/finance', financeRoutes)
app.use('/api/finance/treasuries', treasuriesRoutes)
app.use('/api/hr', hrRoutes) // NEW
app.use('/api/reports', heavyLimiter, reportsRoutes) // Heavy operations
app.use('/api/dashboard', dashboardRoutes); // NEW: Dashboard Analytics
app.use('/api/notifications', notificationsRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/daily-closures', dailyClosuresRoutes) // الإغلاق اليومي
app.use('/api/wallet', walletRoutes) // محفظة العميل (Store Credit)

// 404 + أخطاء
app.use(notFound)
app.use(errorHandler)

export default app;
