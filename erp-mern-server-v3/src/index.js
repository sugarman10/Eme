import 'dotenv/config'
import connectDB from './config/db.js'
import logger from './config/logger.js'
import { createServer } from 'http';
import { initSocket } from './socket.js';
import app from './app.js';
import { initializeSystemData } from './services/initService.js';
import { closeUnclosedDays, autoClosePreviousDay } from './routes/dailyClosures.js';

// اتصال DB وتهيئة البيانات الأساسية
connectDB()
  .then(async () => {
    // تهيئة جميع البيانات الأساسية (الحسابات، العميل النقدي، إلخ)
    try {
      await initializeSystemData();
    } catch (err) {
      logger.logWarning('System data initialization had issues', { error: err.message });
    }

    // إغلاق الأيام السابقة غير المغلقة (إذا وجدت)
    try {
      await closeUnclosedDays();
    } catch (err) {
      logger.logWarning('closeUnclosedDays had issues', { error: err.message });
    }
  })
  .catch(e => {
    console.error('❌ Failed to connect DB:', e)
    process.exit(1)
  })

const PORT = Number(process.env.PORT || 4000)

const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => logger.logSuccess(`Server running on port ${PORT}`, {
  env: process.env.NODE_ENV || 'development',
  port: PORT
}))

// ============================================================
// CRON JOB: إغلاق تلقائي للأيام السابقة
// ============================================================
// يتحقق كل ساعة ويغلق أي أيام سابقة غير مغلقة
setInterval(async () => {
  const now = new Date();
  // Run every hour at the top of the hour (when minutes = 0-5)
  if (now.getMinutes() <= 5) {
    logger.info('🕐 Hourly check: Running auto-close for unclosed days...');
    try {
      await closeUnclosedDays();
    } catch (err) {
      logger.logWarning('Hourly auto-close check failed', { error: err.message });
    }
  }
}, 60 * 60 * 1000); // Check every hour
