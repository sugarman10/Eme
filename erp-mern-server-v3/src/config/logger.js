/**
 * Winston Logger Configuration
 * Professional logging system for ERP Backend
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define colors for each level
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};

winston.addColors(colors);

// Define log format
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Console format (for development)
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(
        (info) => `${info.timestamp} [${info.level}]: ${info.message}${info.stack ? '\n' + info.stack : ''}`
    )
);

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Define log directory
const logDir = path.join(__dirname, '../logs');

// Define transports
const transports = [
    // Console transport (always enabled in development)
    new winston.transports.Console({
        format: consoleFormat,
        level: isProduction ? 'info' : 'debug',
    }),

    // Error log file (all environments)
    new DailyRotateFile({
        filename: path.join(logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '30d',
        format: format,
    }),

    // Combined log file (all logs)
    new DailyRotateFile({
        filename: path.join(logDir, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        format: format,
    }),

    // HTTP requests log
    new DailyRotateFile({
        filename: path.join(logDir, 'http-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'http',
        maxSize: '20m',
        maxFiles: '14d',
        format: format,
    }),
];

// Create the logger
const logger = winston.createLogger({
    level: isProduction ? 'info' : 'debug',
    levels,
    format,
    transports,
    exitOnError: false,
});

// Stream for Morgan HTTP logger
logger.stream = {
    write: (message) => {
        logger.http(message.trim());
    },
};

// Helper methods for common logging patterns
logger.logRequest = (req, message = 'Request') => {
    logger.http(`${message}: ${req.method} ${req.url}`, {
        ip: req.ip,
        userId: req.user?.id,
        body: req.body,
    });
};

logger.logError = (error, context = {}) => {
    logger.error(error.message, {
        stack: error.stack,
        ...context,
    });
};

logger.logSuccess = (message, data = {}) => {
    logger.info(`✅ ${message}`, data);
};

logger.logWarning = (message, data = {}) => {
    logger.warn(`⚠️ ${message}`, data);
};

logger.logDebug = (message, data = {}) => {
    logger.debug(`🔍 ${message}`, data);
};

export default logger;
