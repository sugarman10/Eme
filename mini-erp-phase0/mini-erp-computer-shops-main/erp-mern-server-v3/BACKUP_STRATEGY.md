# 🔄 استراتيجية النسخ الاحتياطي التلقائي

## 📋 نظرة عامة

نظام نسخ احتياطي تلقائي شامل لحماية بيانات ERP الحرجة.

---

## 🎯 الميزات

### ✅ ما يتم نسخه احتياطياً:
- 📊 **قاعدة البيانات MongoDB** (كاملة)
- 📁 **ملفات Uploads** (الصور والمستندات)
- ⚙️ **ملفات الإعدادات** (.env، configs)

### ✅ المميزات:
- 🗜️ ضغط تلقائي (ZIP/TAR.GZ)
- 🗑️ حذف آلي للنسخ القديمة (+30 يوم)
- 📅 تسمية بالتاريخ والوقت
- 📊 عرض حجم النسخة

---

## 🚀 الاستخدام

### تشغيل يدوي:
\`\`\`bash
cd erp-mern-server-v3
node scripts/backup-db.js
\`\`\`

### النتيجة:
\`\`\`
🚀 Starting database backup...
📦 Creating backup: backup-2025-12-17T19-30-00
✅ Database dump completed
🗜️  Compressing backup...
✅ Backup compressed

🎉 Backup completed successfully!
📁 Location: ./backups/backup-2025-12-17T19-30-00.zip
📊 Size: 15.43 MB
📅 Date: 17/12/2025, 19:30:00

🧹 Cleaning up old backups...
✅ No old backups to delete
\`\`\`

---

## ⏰ جدولة تلقائية

### Windows (Task Scheduler):

1. افتح Task Scheduler
2. Create Basic Task
3. **Name:** ERP Daily Backup
4. **Trigger:** Daily at 2:00 AM
5. **Action:** Start a program
6. **Program:** `node`
7. **Arguments:** `scripts/backup-db.js`
8. **Start in:** `C:\\path\\to\\erp-mern-server-v3`

### Linux/Mac (Cron):

\`\`\`bash
# Edit crontab
crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * cd /path/to/erp-mern-server-v3 && node scripts/backup-db.js >> logs/backup.log 2>&1
\`\`\`

---

## 📂 هيكل النسخ الاحتياطية

\`\`\`
erp-mern-server-v3/
└── backups/
    ├── backup-2025-12-17T02-00-00.zip  (15.2 MB)
    ├── backup-2025-12-16T02-00-00.zip  (14.8 MB)
    ├── backup-2025-12-15T02-00-00.zip  (15.1 MB)
    └── ...
\`\`\`

---

## 🔧 الإعدادات

يمكن تخصيص الإعدادات في `backup-db.js`:

\`\`\`javascript
const BACKUP_DIR = './backups';           // مجلد النسخ
const RETENTION_DAYS = 30;                // مدة الاحتفاظ
const DB_CONNECTION = process.env.MONGODB_URI;
\`\`\`

---

## ☁️ النسخ الاحتياطي السحابي (اختياري)

### رفع إلى Google Drive:
\`\`\`bash
npm install @google-cloud/storage --save
\`\`\`

### رفع إلى AWS S3:
\`\`\`bash
npm install aws-sdk --save
\`\`\`

*يمكن إضافة integration لاحقاً عند الحاجة*

---

## ✅ أفضل الممارسات

1. **اختبر الاستعادة:** جرب استعادة نسخة احتياطية شهرياً
2. **راقب المساحة:** تأكد من وجود مساحة كافية
3. **نسخ خارجية:** احفظ نسخة في مكان آخر أسبوعياً
4. **تشفير:** استخدم تشفير للبيانات الحساسة

---

## 🔄 استعادة من النسخة الاحتياطية

\`\`\`bash
# 1. فك الضغط
unzip backups/backup-2025-12-17T02-00-00.zip

# 2. استعادة MongoDB
mongorestore --uri="mongodb://localhost:27017/erp_db" --drop backup-2025-12-17T02-00-00/

# 3. تحقق من البيانات
\`\`\`

---

## 📊 مثال على Log:

\`\`\`
[2025-12-17 02:00:01] 🚀 Backup started
[2025-12-17 02:00:45] ✅ Database backed up (15.2 MB)
[2025-12-17 02:00:50] 🗑️  Deleted 3 old backups
[2025-12-17 02:00:51] ✅ Backup completed
\`\`\`

---

## 🎯 الخلاصة

**الآن لديك:**
- ✅ نسخ احتياطي يومي تلقائي
- ✅ ضغط لتوفير المساحة
- ✅ إدارة تلقائية للنسخ القديمة
- ✅ سهولة في الاستعادة

**🏆 النظام محمي ضد فقدان البيانات!**
