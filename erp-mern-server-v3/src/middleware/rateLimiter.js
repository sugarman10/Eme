import rateLimit from 'express-rate-limit';

/**
 * Rate Limiter for General API Routes
 * Protects against brute force and DDoS attacks
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Increased from 100 to 500 for ERP system needs
    message: {
        success: false,
        message: 'تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة لاحقاً',
        message_en: 'Too many requests from this IP, please try again later'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Skip successful requests
    skipSuccessfulRequests: false,
    // Skip failed requests
    skipFailedRequests: false,
    skip: (req, res) => process.env.NODE_ENV === 'test'
});

/**
 * Strict Rate Limiter for Authentication Routes
 * Prevents brute force attacks on login/register
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: {
        success: false,
        message: 'تم تجاوز عدد محاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة',
        message_en: 'Too many login attempts, please try again after 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
    skip: (req, res) => process.env.NODE_ENV === 'test'
});

/**
 * Lenient Rate Limiter for Public Routes
 * Higher limits for non-sensitive endpoints
 */
export const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Higher limit for public endpoints
    message: {
        success: false,
        message: 'تم تجاوز الحد المسموح. يرجى الانتظار قليلاً',
        message_en: 'Rate limit exceeded, please wait'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, res) => process.env.NODE_ENV === 'test'
});

/**
 * Heavy Operation Limiter
 * For resource-intensive operations like reports
 */
export const heavyLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // Only 20 heavy operations per hour
    message: {
        success: false,
        message: 'تم تجاوز عدد العمليات المكثفة. يرجى المحاولة بعد ساعة',
        message_en: 'Too many heavy operations, please try again after 1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, res) => process.env.NODE_ENV === 'test'
});
