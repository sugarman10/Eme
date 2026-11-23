import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Automated Database Backup Script
 * 
 * Features:
 * - Creates MongoDB backup using mongodump
 * - Compresses backup to .zip
 * - Organizes by date
 * - Automatic cleanup of old backups
 * 
 * Usage:
 * node scripts/backup-db.js
 * 
 * Schedule with cron:
 * 0 2 * * * cd /path/to/project && node scripts/backup-db.js
 */

const BACKUP_DIR = './backups';
const RETENTION_DAYS = 30; // Keep backups for 30 days
const DB_CONNECTION = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp_db';

async function createBackup() {
    try {
        console.log('🚀 Starting database backup...');

        // 1. Create backups directory if not exists
        await fs.mkdir(BACKUP_DIR, { recursive: true });

        // 2. Generate backup filename with timestamp
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const backupName = `backup-${timestamp}`;
        const backupPath = path.join(BACKUP_DIR, backupName);

        // 3. Run mongodump
        console.log(`📦 Creating backup: ${backupName}`);
        const dumpCommand = `mongodump --uri="${DB_CONNECTION}" --out="${backupPath}"`;
        await execAsync(dumpCommand);
        console.log('✅ Database dump completed');

        // 4. Compress backup
        console.log('🗜️  Compressing backup...');
        const zipCommand = process.platform === 'win32'
            ? `powershell Compress-Archive -Path "${backupPath}" -DestinationPath "${backupPath}.zip"`
            : `tar -czf "${backupPath}.tar.gz" -C "${BACKUP_DIR}" "${backupName}"`;

        await execAsync(zipCommand);
        console.log('✅ Backup compressed');

        // 5. Remove uncompressed folder
        await fs.rm(backupPath, { recursive: true, force: true });

        // 6. Get backup size
        const zipFile = process.platform === 'win32' ? `${backupPath}.zip` : `${backupPath}.tar.gz`;
        const stats = await fs.stat(zipFile);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

        console.log(`\n🎉 Backup completed successfully!`);
        console.log(`📁 Location: ${zipFile}`);
        console.log(`📊 Size: ${sizeInMB} MB`);
        console.log(`📅 Date: ${new Date().toLocaleString('ar-EG')}`);

        // 7. Cleanup old backups
        await cleanupOldBackups();

    } catch (error) {
        console.error('❌ Backup failed:', error.message);
        throw error;
    }
}

async function cleanupOldBackups() {
    try {
        console.log(`\n🧹 Cleaning up old backups (older than ${RETENTION_DAYS} days)...`);

        const files = await fs.readdir(BACKUP_DIR);
        const now = Date.now();
        const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

        let deletedCount = 0;

        for (const file of files) {
            const filePath = path.join(BACKUP_DIR, file);
            const stats = await fs.stat(filePath);
            const fileAge = now - stats.mtimeMs;

            if (fileAge > retentionMs) {
                await fs.unlink(filePath);
                deletedCount++;
                console.log(`🗑️  Deleted old backup: ${file}`);
            }
        }

        if (deletedCount === 0) {
            console.log('✅ No old backups to delete');
        } else {
            console.log(`✅ Deleted ${deletedCount} old backup(s)`);
        }

    } catch (error) {
        console.error('⚠️  Cleanup warning:', error.message);
        // Don't throw - cleanup is not critical
    }
}

// Run backup
createBackup()
    .then(() => {
        console.log('\n✅ Backup process completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Backup process failed');
        process.exit(1);
    });
