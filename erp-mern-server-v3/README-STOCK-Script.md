# سكريبت تحديث المخزون - Stock Update Script

## 📝 الوصف

سكريبت لتحديث جميع أرصدة المنتجات إلى **1000 قطعة** في المستودع الرئيسي.

## 📂 الموقع

```
c:\Users\HP\Desktop\erp system\erp-mern-server-v3\set-stock-1000.mjs
```

## ⚙️ طريقة الاستخدام

### الطريقة 1: من Terminal

```bash
# انتقل إلى مجلد server
cd "c:\Users\HP\Desktop\erp system\erp-mern-server-v3"

# شغّل السكريبت
node set-stock-1000.mjs
```

### الطريقة 2: تعديل اسم قاعدة البيانات

إذا كان اسم قاعدة البيانات مختلف عن `erp-system`:

1. افتح الملف `set-stock-1000.mjs`
2. عدّل السطر 9:
```javascript
const DB_NAME = 'your-actual-db-name';  // غيّر هنا
```

## 🔍 التحقق من اسم قاعدة البيانات

### باستخدام MongoDB Compass:
1. افتح MongoDB Compass
2. اتصل بـ `mongodb://localhost:27017`
3. شاهد قائمة قواعد البيانات
4. ابحث عن database يحتوي على collections: `items`, `warehouses`, `stockbalances`

### باستخدام mongosh:
```bash
mongosh
show dbs
use <db-name>
show collections
```

## 📊 ماذا يفعل السكريبت؟

1. ✅ يتصل بقاعدة البيانات MongoDB
2. ✅ يجلب جميع المنتجات
3. ✅ يجلب المستودع الأول (أو ينشئ واحد إذا لم يوجد)
4. ✅ يحدث/ينشئ سجل مخزون لكل منتج مع الكمية 1000
5. ✅ يعرض ملخص بالعمليات المنجزة

## 📝 Output مثال

```
🚀 Starting stock update script...

🔌 Connecting to MongoDB...
✅ Connected to database

📦 Found 20 items

📍 Using warehouse: المستودع الرئيسي (MAIN)
🔄 Setting stock to 1000 for all items...

✏️  Updated: لوحة -> 1000 pcs
➕ Created: مصباح الزجبي -> 1000 pcs
✏️  Updated: مرآة حائط كبيرة -> 1000 pcs

==================================================
✅ Done!
==================================================
📊 Summary:
   - Total items: 20
   - Updated: 15
   - Created: 5
   - Errors: 0
   - Warehouse: المستودع الرئيسي
   - Stock per item: 1000
==================================================

🔌 Database connection closed

✅ Script completed successfully
```

## 🎯 تعديل الكمية المطلوبة

إذا أردت كمية مختلفة عن 1000، عدّل السطر 10:

```javascript
const TARGET_STOCK = 1000;  // غيّر إلى الكمية المطلوبة
```

## ⚠️ ملاحظات هامة

- ⚠️ السكريبت سيحدّث **جميع** المنتجات
- ⚠️ سيتم الكتابة فوق الأرصدة الحالية
- ✅ يمكن تشغيله عدة مرات بأمان (idempotent)
- ✅ يستخدم `upsert` لذلك آمن على قاعدة البيانات

## 🐛 حل المشاكل

### Problem: "No items found"
**الحل:** اسم قاعدة البيانات غير صحيح. تأكد من DB_NAME.

### Problem: "Cannot connect to MongoDB"
**الحل:** تأكد من تشغيل MongoDB على localhost:27017

### Problem: "Module not found: mongodb"
**الحل:** نفذ `npm install` في مجلد server أولاً

## 📞 الدعم

إذا واجهت مشكلة، تأكد من:
1. ✅ MongoDB يعمل
2. ✅ اسم قاعدة البيانات صحيح  
3. ✅ تشغيل السكريبت من مجلد `erp-mern-server-v3`
