# سجل وحالة مشروع ERP محلات الكمبيوتر والملحقات

## 1. التقنيات وهيكل الملفات

### أ. التقنيات المستخدمة (Tech Stack)
- **الواجهة الأمامية (Frontend)**: `erp-mern-client-v3-full/` — React `^18.3.1`، Vite `^7.2.4`، Tailwind CSS `^4.1.17`، React Router DOM `^6.26.2`، Socket.io-client `^4.8.1`، Axios، Lucide React، مع `jspdf` / `html2canvas` للطباعة والتصدير.
- **الواجهة الخلفية / قاعدة البيانات (Backend/DB)**: `erp-mern-server-v3/` — Node.js + Express `^4.19.2`، قاعدة بيانات MongoDB مع Mongoose `^8.6.3`، مصادقة JWT + `bcryptjs`، تحديث فوري عبر `Socket.io`.
- **تطبيق سطح المكتب (Desktop App)**: `desktop-app/` — Electron `^34.2.0` مع `electron-builder ^25.1.8`.

---

### ب. المسارات الدقيقة للملفات المسؤولة

#### 1. الفاتورة المبدئية / عرض السعر (Proforma / Quotation) وقالب طباعتها
- **واجهة إنشاء وتحرير الفاتورة المبدئية وسجل عروض الأسعار**:
  - `erp-mern-client-v3-full/src/pages/Quotations.jsx` (تتضمن إدارة عروض الأسعار + نافذة الطباعة `PrintQuotationModal`)
  - `erp-mern-client-v3-full/src/pages/PosSales.jsx` و `erp-mern-client-v3-full/src/components/pos/PosLayout.jsx` (عند إصدار عرض سعر من نقطة البيع `INVOICE_TYPES.PROFORMA`)
- **ملف قالب طباعة الفاتورة المبدئية (Proforma Print Template)**:
  - `erp-mern-client-v3-full/src/components/pos/InvoicePrintTemplate.jsx` (القالب الموحد للطباعة A4 في نقطة البيع لعروض الأسعار والفواتير)
  - `erp-mern-client-v3-full/src/pages/Quotations.jsx` (المكون `PrintQuotationModal` لطباعة عروض الأسعار من صفحة الفواتير المبدئية)
- **الواجهة الخلفية (Backend)**:
  - `erp-mern-server-v3/src/routes/salesV2.js`
  - `erp-mern-server-v3/src/models/SalesOrder.js`

#### 2. فاتورة المبيعات (Sales Invoice) وقالب طباعتها
- **واجهة نقطة البيع وإنشاء فاتورة المبيعات**:
  - `erp-mern-client-v3-full/src/pages/PosSales.jsx`
  - `erp-mern-client-v3-full/src/components/pos/PosLayout.jsx`
  - `erp-mern-client-v3-full/src/components/pos/CartPanel.jsx`
  - `erp-mern-client-v3-full/src/components/pos/PaymentModal.jsx`
- **واجهة سجل فواتير المبيعات وتفاصيلها**:
  - `erp-mern-client-v3-full/src/pages/SalesInvoices.jsx`
  - `erp-mern-client-v3-full/src/components/modals/SalesInvoiceModal.jsx`
- **ملف قالب طباعة فاتورة المبيعات (Sales Invoice Print Templates)**:
  - `erp-mern-client-v3-full/src/components/pos/InvoicePrintTemplate.jsx` (قالب الطباعة الرئيسي A4 في نقطة البيع)
  - `erp-mern-client-v3-full/src/pages/SalesInvoices.jsx` (قسم `#receipt-print` للطباعة المباشرة من سجل فواتير المبيعات)
- **الواجهة الخلفية (Backend)**:
  - `erp-mern-server-v3/src/routes/salesV2.js`
  - `erp-mern-server-v3/src/models/SalesOrder.js`

#### 3. سندات الصرف والقبض (Vouchers)
- **قالب ونافذة طباعة سندات الصرف والقبض الموحدة (Voucher Print Template & Modal)**:
  - `erp-mern-client-v3-full/src/components/modals/VoucherPrintModal.jsx` (المكون الموحد لعرض وطباعة سندات القبض وسندات الصرف مع الترويسة المعتمدة من `SettingsContext` والتفقيط بالعربية وملخص الرصيد المتبقي)
  - `erp-mern-client-v3-full/src/components/pos/VoucherPrintTemplate.jsx` (تصدير القالب الموحد)
- **واجهات سندات الصرف والقبض والخزينة وكشوف الحساب (Frontend)**:
  - `erp-mern-client-v3-full/src/pages/CustomerReceipts.jsx` (إدارة وطباعة سندات القبض من العملاء)
  - `erp-mern-client-v3-full/src/pages/PaymentVouchers.jsx` (إدارة وطباعة سندات الصرف للعملاء والموردين)
  - `erp-mern-client-v3-full/src/pages/SupplierPayments.jsx` (تسديد دفعات الموردين وسجل سندات الصرف للموردين وطباعتها)
  - `erp-mern-client-v3-full/src/pages/CustomerDetails.jsx` و `erp-mern-client-v3-full/src/components/modals/SupplierStatementModal.jsx` (طباعة سندات القبض والصرف من كشوف حساب العملاء والموردين)
  - `erp-mern-client-v3-full/src/pages/Treasuries.jsx` و `erp-mern-client-v3-full/src/pages/Expenses.jsx` (سجل حركات الخزينة والمصروفات مع زر طباعة السند بجانب كل عملية)
- **الواجهة الخلفية لسندات الصرف والقبض (Backend)**:
  - `erp-mern-server-v3/src/controllers/financeController.js` و `erp-mern-server-v3/src/controllers/paymentVoucherController.js`
  - `erp-mern-server-v3/src/controllers/procurementController.js` و `erp-mern-server-v3/src/routes/procurement.js`
  - `erp-mern-server-v3/src/routes/treasuries.js`
  - `erp-mern-server-v3/src/models/Receipt.js` و `erp-mern-server-v3/src/models/PaymentVoucher.js` و `erp-mern-server-v3/src/models/Transaction.js`

---

## 2. قائمة المهام الحالية (Sprint Backlog)

### أ. الفاتورة المبدئية (Proforma Invoice)
- [x] السماح بإضافة أصناف حرة غير مسجلة في المخزون.
- [x] طباعة: إلغاء البند الثاني في الشروط والأحكام.
- [x] طباعة: إلغاء ملاحظة "هذا المستند لا يعتبر فاتورة ضريبية رسمية".
- [x] طباعة: إلغاء خانة "موافقة وتوقيع العميل".
- [x] طباعة: إدراج الموقع الرسمي والإيميل وشعار الشركة.

### ب. فاتورة المبيعات (Sales Invoice)
- [x] السماح باعتماد الفاتورة حتى مع عدم توفر رصيد في المخزون (البيع بالسالب/تجاوز شرط الرصيد).
- [x] إلغاء إظهار سعر صرف الدولار.
- [x] إلغاء المعادل بالدولار.
- [x] إضافة الإيميل والموقع الإلكتروني (Website) للمحل في قالب الطباعة.

### ج. سندات الصرف والقبض (Vouchers)
- [x] إضافة ميزة وقالب طباعة لسندات الصرف والقبض.

---

## 3. سجل التعديلات المنجزة (Changelog)
- `2026-11-02` - تأسيس ملف المتابعة `PROJECT_STATE.md` وتوثيق التقنيات والمسارات الدقيقة للفاتورة المبدئية، فاتورة المبيعات، قوالب الطباعة، وسندات الصرف والقبض، وحصر المتطلبات النهائية.
- `2026-11-02` - إنجاز **الحزمة الأولى (تعديلات قوالب الطباعة للفاتورة المبدئية وفاتورة المبيعات)** في `InvoicePrintTemplate.jsx` و `Quotations.jsx` و `SalesInvoices.jsx`: إضافة الشعار والإيميل والموقع الإلكتروني، إزالة سعر الصرف والمعادل بالدولار، وتحديث الشروط والأحكام والتواقيع في الفاتورة المبدئية.
- `2026-11-04` - إنجاز **الحزمة الثانية (المنطق المخزني في الفاتورة المبدئية وفاتورة المبيعات)**:
  - **الفاتورة المبدئية**: السماح بإضافة أصناف حرة (يدوية غير مسجلة بقاعدة البيانات مع إمكانية تعديل الاسم والكمية والسعر) وأصناف مسجلة رصيدها `0` في `Quotations.jsx` و `FastInvoiceView.jsx` و `usePos.js`، مع دعم حفظها وعرضها وطباعتها في `SalesInvoice.js` و `SalesOrder.js` و `salesController.js` دون رمي أخطاء `CastError`.
  - **فاتورة المبيعات**: إلغاء قيود الرصيد المتاح في الواجهة الأمامية (`usePos.js`, `FastInvoiceView.jsx`, `ProductCard.jsx`, `SalesInvoiceModal.jsx`) والخلفية (`Item.js`, `stockService.js`, `bundleService.js`, `salesService.js`, `salesController.js`) للسماح بالبيع بالسالب واعتماد الفواتير وتوليد قيود تكلفة البضاعة المباعة (`COGS`) بالتكلفة الافتراضية للمنتج (`cost || costPrice || 0`).
- `2026-11-04` - إنجاز **الحزمة الثالثة والأخيرة (قالب وميزة طباعة سندات الصرف والقبض + التحسين الجمالي للفاتورة المبدئية)**:
  - **قالب ونافذة طباعة السندات الموحدة**: إنشاء `VoucherPrintModal.jsx` و `VoucherPrintTemplate.jsx` بالترويسة الرسمية من `SettingsContext` (الشعار، اسم الشركة، العنوان، الهاتف، البريد الإلكتروني، الموقع الإلكتروني)، والتحديد التلقائي لنوع السند (`سند قبض` / `سند صرف`)، وعرض المبلغ بالعملة المحلية (`د.ل`) رقماً وكتابةً، واسم الجهة (`استلمنا من السيد / السادة` أو `يصرف للسيد / السادة`)، وطريقة الدفع والخزينة، والبيان (`وذلك عن`)، وملخص الرصيد المتبقي للعميل أو المورد، وخانات التوقيع والختم في سندات الصرف فقط (مع إزالتها واستبعادها تماماً من سندات القبض حسب الاعتماد)، مع عزل الطباعة `@media print`.
  - **ربط طباعة السندات في شاشات النظام**: تفعيل زر الطباعة الفوري (`حفظ وطباعة السند` و `طباعة السند`) في شاشات سندات القبض (`CustomerReceipts.jsx`)، وسندات الدفع (`PaymentVouchers.jsx`)، وسداد دفعات الموردين (`SupplierPayments.jsx`)، وكشوف حساب العملاء والموردين (`CustomerDetails.jsx`, `SupplierStatementModal.jsx`)، وسجل الخزينة والعمليات المالية (`Treasuries.jsx`)، والمصروفات (`Expenses.jsx`).
  - **تحسين جمالي في الفاتورة المبدئية**: إخفاء شارة `"صنف حر"` وكود `'حر'` عند الطباعة (`print:hidden`) في `Quotations.jsx` و `InvoicePrintTemplate.jsx` ليظهر الصنف المطبوع للعميل كصنف طبيعي أنيق.
- `2026-11-23` - إنجاز **المرحلة 0 (النظافة والأمان)** دون أي تغيير في المنطق الوظيفي: حذف كلمات السر المكتوبة من سكربتات التهيئة والاختبار واستبدالها بمتغيرات بيئة (أو كلمات مولّدة عشوائياً في سكربتات الاختبار فقط)، إضافة دور `sales` إلى `User.js`، تصحيح إصدارات التقنية في هذا الملف بالإصدارات الفعلية من `package.json`، وحذف ملفات مخرجات الاختبار النصية وإفراغ `uploads/` واستثناء المخرجات المؤقتة في `.gitignore`.

---

## 4. قرارات معتمدة من المدير (23 تشرين الثاني 2026)

- **البيع بالسالب: يبقى مسموحاً كما هو** — قرار معاذ. لم يُغيَّر أي سطر في منطق المخزون (`stockService.js` لم يُلمس في المرحلة 0)، ويُراقَب لاحقاً بتقرير أرصدة سالبة دوري.
- **مزامنة الفروع: الفرع 1 أولاً** — يُستكمل فرع واحد أولاً، ثم يُنتقل إلى باقي الفروع. لا كود مزامنة في هذه المرحلة، والنطاق موثّق هنا فقط.
