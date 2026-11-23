# 📘 سجل التدقيق الشامل وخارطة طريق المشروع (Project Audit & Roadmap)

> **الغرض من هذا الملف**: يمثل هذا الملف المرجع الدائم (Single Source of Truth) لمشروع **نظام ERP المتكامل (MERN + Electron)**. يحتوي على خلاصة الفحص الشامل للمشروع، نقاط القوة، الثغرات المحاسبية والتقنية المكتشفة، سجل ما تم إنجازه، وخطة العمل المرحلية القادمة والمهارات المطلوبة لكل مرحلة، وذلك لتجنب إعادة الفحص من الصفر في الجلسات القادمة.

---

## 🏗️ أولاً: نظرة عامة على بنية المشروع (Architecture Overview)

يتكون المشروع من 3 حزم رئيسية مترابطة:
1. **`erp-mern-server-v3` (الخادم الخلفي - Backend)**:
   - مبني على Node.js + Express + MongoDB (Mongoose 8) + Socket.io.
   - يدعم المحاسبة ذات القيد المزدوج (`JournalEntry`)، المخزون المستمر متعدد المخازن، التجميعات (`Bundles/PC Builder`)، المبيعات ونقطة البيع (`POS`)، المشتريات، شؤون الموظفين والرواتب (`HR & Payroll`)، المحافظ والأرصدة الدائنة (`Customer Wallet`)، وتوليد التقارير (`Puppeteer` & `ExcelJS`).
2. **`erp-mern-client-v3-full` (واجهة المستخدم - Frontend)**:
   - مبنية على React 18 + Vite 7 + TailwindCSS v4 + TanStack React Query + Socket.io-client.
3. **`desktop-app` (تطبيق سطح المكتب - Desktop Wrapper)**:
   - مبني على Electron 34 + Electron-Builder + Bytenode (لحماية الكود المصدري عبر V8 Bytecode)، مع دعم الطباعة الحرارية الصامتة وإعداد اتصال قاعدة البيانات.

---

## 💪 ثانياً: نقاط القوة في المشروع (Project Strengths)

1. **تغطية وظيفية شاملة ومترابطة (Rich ERP Domain)**:
   - يغطي النظام دورة العمل الكاملة من المشتريات والمخازن (متعددة المستودعات + متوسط التكلفة المرجح WAC) إلى المبيعات (نقطة بيع، عروض أسعار/فواتير مبدئية، مرتجعات، تجميعات) والمحاسبة المالية وشؤون الموظفين.
2. **محرك قيود محاسبية مزدوجة صارم ([journalEntryService.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/services/journalEntryService.js))**:
   - يتحقق من توازن القيد (`Debit === Credit`)، يمنع الترحيل على الحسابات الأب (`PARENT_ACCOUNT_NOT_ALLOWED`)، ويتحقق من عدم الإقفال المحاسبي للفترة المالية (`checkFiscalPeriod`).
3. **حماية ذرية للمخزون ودعم التجميعات ([stockService.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/services/stockService.js) & [bundleService.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/services/bundleService.js))**:
   - استخدام شروط ذرية (`$elemMatch: { warehouse, qty: { $gte: line.qty } }`) في `deductStockBulk` لمنع السحب بالسالب أثناء التزاحم (Race Conditions)، مع تفكيك التجميعات (`Bundles`) تلقائياً إلى مكوناتها الفعلية عند الخصم أو الإرجاع.
4. **مزامنة لحظية للعملات والمخزون (Real-time Socket.io Sync)**:
   - بث مباشر لتحديثات سعر الصرف (`exchange_rate_updated`) وتحديثات المخزون الجزئية (`stock:update`) لجميع شاشات الكاشير المتصلة دون الحاجة لإعادة تحميل الصفحة.
5. **جاهزية التشغيل المكتبي وحماية الملكية الفكرية (`desktop-app`)**:
   - دعم تجميع الخادم إلى Bytecode عبر `bytenode`، والطباعة الصامتة للفواتير الحرارية، وفحص اتصال MongoDB تلقائياً.

---

## 🚨 ثالثاً: سجل الثغرات ونقاط الضعف المكتشفة (Discovered Flaws)

### 1. ثغرات الخادم والمنطق المحاسبي (Backend & Accounting Logic)

| # | المكون / المسار | السطر / الدالة | الوصف والتأثير المنطقي والمالي | الخطورة | الحالة |
| :-: | :--- | :--- | :--- | :-: | :-: |
| **B1** | [salesController.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/controllers/salesController.js#L1205-L1245) | `updateSameDayCashInvoice` (L1207)<br>`revertProformaConversion` (L1511) | **تكرار القيود المحاسبية وفساد الأرصدة عند التعديل/الإلغاء**: تم إصلاحه عبر دالة `reverseJournalEntriesByReference` التي تعكس أرصدة `Account.balance` وتحدث القيد مع تمرير تكلفة البضاعة المباعة `totalCost`. | 🔴 **حرج (Critical)** | ✅ **تم الإصلاح** |
| **B2** | [procurementController.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/controllers/procurementController.js#L1416-L1525) | `updatePurchaseInvoice` | **فساد أرصدة الحسابات ومتوسط التكلفة (WAC) عند تعديل فاتورة شراء**: تم إصلاح عكس القيد القديم وأرصدة الحسابات، وإرجاع التكلفة المرجحة القديمة قبل احتساب الجديدة، والحفاظ على الأرصدة المدينة للموردين. | 🔴 **حرج (Critical)** | ✅ **تم الإصلاح** |
| **B3** | [salesReturnController.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/controllers/salesReturnController.js#L525-L680) | `reverseSalesReturn` | **تعطل القيد العكسي لإلغاء مرتجع المبيعات وعدم تفكيك الـ Bundles**: تم تحديثها لاستخدام `getSystemAccount` (`SALES_RETURNS`, `AR`, `INVENTORY`, `COGS`) وعكس قيد التكلفة وتفكيك التجميعات عبر `preparePhysicalDeductions`. | 🔴 **حرج (Critical)** | ✅ **تم الإصلاح** |
| **B4** | [payrollService.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/services/payrollService.js#L117-L155) & [financeService.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/services/financeService.js#L164) | `payPayroll` & `recordFinancialOperation` | **تشتت حسابات مصروف الرواتب**: تم توحيد ربط مصروف الرواتب على الحساب القياسي `SALARIES_EXPENSE` (`5201` / `5021`) عبر `getSystemAccount`. | 🟠 **عالي (High)** | ✅ **تم الإصلاح** |
| **B5** | [walletController.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/controllers/walletController.js#L116-L580) | `useCredit`<br>`getWalletBalance`<br>`adjustWalletBalance` | **تضارب رصيد المحفظة في الكاشير وغياب القيد المحاسبي للتسوية**: تم توحيد `useCredit` ليدعم `walletBalance + creditFromNegativeBalance`، وربط `adjustWalletBalance` بقيد محاسبي متوازن على حساب أمانات العملاء (`CUSTOMER_WALLET`). | 🟠 **عالي (High)** | ✅ **تم الإصلاح** |
| **B6** | [journalEntryService.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/services/journalEntryService.js#L46) | `generateSerialNumber` | **تحديث متسلسل القيود خارج جلسة الترانزاكشن (`session`)**: تم تمرير `{ session }` إلى `Counter.findOneAndUpdate`. | 🟠 **عالي (High)** | ✅ **تم الإصلاح** |
| **B7** | [auth.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/middleware/auth.js#L11-L75) & [main.js](file:///c:/Users/HP/Desktop/erp%20system/desktop-app/src/main.js#L22-L130) | `requireAuth` & Electron Env | **ثغرات الأمان والبيئة**: تم إضافة التحقق الحي المخبأ (30 ثانية) من حالة `isActive` في قاعدة البيانات، وتوليد مفاتيح `JWT_SECRET` عشوائية مشفرة لكل تثبيت مكتبي، وتحديث `.gitignore`. | 🟠 **عالي (High)** | ✅ **تم الإصلاح** |

---

### 2. ثغرات واجهة المستخدم وتجربة الاستخدام (Frontend & UI/UX Audit)

| # | الشاشة / المكون | نوع المشكلة | السلوك الحالي الخاطئ | الحل الهندسي المطلوب | الخطورة | الحالة |
| :-: | :--- | :--- | :--- | :--- | :-: | :-: |
| **F1** | [usePos.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-client-v3-full/src/hooks/usePos.js#L1086-L1185) | **State / Logic Bug** | السطر L1179 كان يرسل دائماً `type: INVOICE_TYPES.OFFICIAL` حتى عند اختيار فاتورة مبدئية (`PROFORMA`). | تم تمرير `type: isProforma ? INVOICE_TYPES.PROFORMA : INVOICE_TYPES.OFFICIAL` وتصفير المدفوعات وتجاوز خصم المحفظة والخزينة لعروض الأسعار. | 🔴 **حرج (Critical)** | ✅ **تم الإصلاح** |
| **F2** | [usePos.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-client-v3-full/src/hooks/usePos.js#L738) & [SettingsContext.jsx](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-client-v3-full/src/context/SettingsContext.jsx) | **Validation / Tax Sync** | واجهة الكاشير كانت تحسب `totalAfterDiscount` بدون إضافة ضريبة القيمة المضافة (`taxRate`). | تم إرجاع `taxRate` من `/api/settings` وحساب `taxAmount` و `totalAfterDiscount` في `usePos.js` ليتطابق 100% مع الخادم. | 🟠 **عالي (High)** | ✅ **تم الإصلاح** |
| **F3** | [PurchaseInvoiceView.jsx](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-client-v3-full/src/pages/PurchaseInvoiceView.jsx#L461) & [procurementController.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/controllers/procurementController.js) | **Data Loss / Mismatch** | حقل `discount` في المشتريات لم يكن يُرسل أو يُحفظ في قاعدة البيانات. | تم إرسال وحفظ `discount` في `PurchaseOrder` واحتساب الصافي مالياً ومحاسبياً عند الإنشاء والتعديل. | 🟠 **عالي (High)** | ✅ **تم الإصلاح** |
| **F4** | [usePos.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-client-v3-full/src/hooks/usePos.js#L1233) | **Performance** | إعادة سحب 5000 صنف بالكامل عبر الشبكة بعد كل فاتورة مبيعات رغم وجود مزامنة Socket لحظية. | تم الاكتفاء بالتحديث الجزئي الفوري عبر Socket (`stock:update`) وعدم استدعاء `refreshProducts` إلا في حال انقطاع الـ Socket. | 🟡 **متوسط (Medium)** | ✅ **تم الإصلاح** |

---

## 🛠️ رابعاً: خطة التنفيذ المرحلية والمهارات المطلوبة (Phased Execution Plan & Required Skills)

> **قاعدة العمل**: لا يتم الانتقال إلى مرحلة جديدة أو تعديل الكود إلا بعد مراجعة مخرجات المرحلة وتحديد المهارات المطلوبة لها.

### المرحلة 1: إصلاح سلامة القيود المحاسبية والمخزون (Critical Accounting & Inventory Integrity)
- **المهام المحددة**:
  1. إصلاح دالة `updateSameDayCashInvoice` و `revertProformaConversion` في [salesController.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/controllers/salesController.js) لاستخدام عكس القيود المحاسبية الرسمية (`reverseJournalEntry` أو عكس أرصدة `Account.balance`) بالمعرف الصحيح (`referenceType: 'SALE_INVOICE'`, `referenceId`)، وتضمين تكلفة البضاعة المباعة (`totalCost`) عند إعادة إنشاء القيد.
  2. إصلاح دالة `reverseSalesReturn` في [salesReturnController.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/controllers/salesReturnController.js) لاستخدام الحسابات القياسية (`getSystemAccount`) بدلاً من الأرقام القديمة (`40102`)، وعكس قيد تكلفة البضاعة المباعة (`COGS / Inventory`)، وتفكيك التجميعات (`preparePhysicalDeductions`).
  3. إصلاح دالة `updatePurchaseInvoice` في [procurementController.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/controllers/procurementController.js) لعكس أرصدة الحسابات قبل حذف/إلغاء القيد القديم، وإصلاح معادلة متوسط التكلفة المرجح (`WAC`)، وإزالة `Math.max(0, ...)` التي تمسح الرصيد المدين للمورد.
- **المهارات المطلوبة (Required Skills)**:
  - مهارة **`erp-audit-lead`**: ضبط القيد المزدوج (Double-Entry Validation)، مطابقة المخزون المستمر مع تكلفة المبيعات (Perpetual Inventory vs COGS Reconciliation)، وسلامة المعاملات الذرية (ACID Transactions في Mongoose).

### المرحلة 2: ضبط منطق الأعمال المالي (المحفظة، الرواتب، التسلسل الذري)
- **المهام المحددة**:
  1. توحيد منطق الرصيد المتاح في المحفظة بين `getWalletBalance` و `useCredit` في [walletController.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/controllers/walletController.js)، وإنشاء قيد محاسبي رسمي عند تعديل رصيد المحفظة يدوياً في `adjustWalletBalance`.
  2. توحيد قيود صرف الرواتب واستقطاعات السلف في [payrollService.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/services/payrollService.js) و [financeService.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/services/financeService.js).
  3. تمرير `{ session }` لدالة `generateSerialNumber` في [journalEntryService.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/services/journalEntryService.js) لضمان ذرية تسلسل القيود.
- **المهارات المطلوبة (Required Skills)**:
  - مهارة **`erp-audit-lead`** + هندسة النظم المالية الخلفية (Node.js/Mongoose Session Concurrency & Sub-ledger Reconciliation).

### المرحلة 3: إصلاح أخطاء نقطة البيع وواجهة المشتريات والأداء (POS & Frontend UX)
- **المهام المحددة**:
  1. إصلاح خطأ إصدار الفاتورة المبدئية (`PROFORMA`) في [usePos.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-client-v3-full/src/hooks/usePos.js#L1177).
  2. مزامنة حساب الضريبة (`taxRate`) بين [usePos.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-client-v3-full/src/hooks/usePos.js) و [salesController.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/controllers/salesController.js).
  3. ربط حقل الخصم (`discount`) في [PurchaseInvoiceView.jsx](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-client-v3-full/src/pages/PurchaseInvoiceView.jsx) مع الخادم الخلفي (`createDirectPurchaseInvoice` & `updatePurchaseInvoice`).
  4. تحسين أداء تحديث الأصناف في `usePos.js` بعد البيع (تحديث الأصناف المباعة محلياً أو عبر Socket بدلاً من إعادة سحب 5000 صنف في كل فاتورة).
- **المهارات المطلوبة (Required Skills)**:
  - مهارة **`erp-audit-lead` (UI/UX & Frontend Audit)** + تطوير واجهات React 18 & TanStack Query.

### المرحلة 4: الأمان، التنظيف، وتجهيز البيئة الإنتاجية (Security & Project Hygiene)
- **المهام المحددة**:
  1. تحديث ملف `.gitignore` الرئيسي لمنع رفع ملفات `.env` والسجلات والملفات المؤقتة.
  2. تنظيف الملفات المؤقتة ومخرجات الاختبارات النصية (`*.txt`) المتراكمة في مجلد `erp-mern-server-v3`.
  3. تحسين التحقق من حالة المستخدم (`isActive`) في [auth.js](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/middleware/auth.js) وتأمين إعدادات `JWT_SECRET` في [main.js](file:///c:/Users/HP/Desktop/erp%20system/desktop-app/src/main.js).
- **المهارات المطلوبة (Required Skills)**:
  - هندسة أمن التطبيقات (JWT/Auth Security, Electron Hardening, Git Hygiene).

---

## ✅ خامساً: سجل الخطوات المنجزة (Completed Steps Log)

- **[2026-10-30]**:
  - تفعيل مهارة خبير تدقيق أنظمة الـ ERP (`erp-audit-lead`).
  - إجراء مراجعة معمارية وبرمجية ومحاسبية شاملة للمشاريع الثلاثة (`erp-mern-server-v3`, `erp-mern-client-v3-full`, `desktop-app`).
  - توثيق نقاط القوة والضعف (7 ثغرات خلفية/محاسبية + 4 ثغرات واجهة مستخدم وأداء).
  - إنشاء ملف المتابعة الدائم [PROJECT_AUDIT_AND_ROADMAP.md](file:///c:/Users/HP/Desktop/erp%20system/PROJECT_AUDIT_AND_ROADMAP.md) وتحديد المراحل والمهارات المطلوبة قبل البدء بالتنفيذ.
- **[2026-11-01]**:
  - وضع جميع المراحل داخل قائمة المهام التفاعلية (`task.md`).
  - **إنجاز المرحلة 1 (Critical Accounting & Inventory Integrity)**:
    - إضافة دالة [`reverseJournalEntriesByReference`](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/services/journalEntryService.js#L399) لعكس أرصدة `Account.balance` أصولياً.
    - إصلاح تعديل الفاتورة النقدية [`updateSameDayCashInvoice`](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/controllers/salesController.js#L1204) وإلغاء تحويل عرض السعر [`revertProformaConversion`](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/controllers/salesController.js#L1511) مع احتساب `totalCost` (COGS).
    - إصلاح عكس مرتجع المبيعات [`reverseSalesReturn`](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/controllers/salesReturnController.js#L525) باستخدام `getSystemAccount` وتفكيك الـ Bundles عبر `preparePhysicalDeductions`.
    - إصلاح تعديل فاتورة الشراء [`updatePurchaseInvoice`](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/controllers/procurementController.js#L1416) لعكس متوسط التكلفة المرجح (`WAC`) وأرصدة الحسابات والحفاظ على الأرصدة المدينة للموردين.
  - **إنجاز المرحلة 2 (Financial Business Logic & Concurrency)**:
    - توحيد الرصيد المتاح في [`useCredit`](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/controllers/walletController.js#L103) مع `getWalletBalance`، وربط [`adjustWalletBalance`](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/controllers/walletController.js#L510) بقيد محاسبي في الأستاذ العام.
    - توحيد حساب مصروف الرواتب (`SALARIES_EXPENSE`) في [`financeService.js`](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/services/financeService.js#L164).
    - تمرير `{ session }` لتوليد الأرقام التسلسلية للقيود في [`generateSerialNumber`](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/services/journalEntryService.js#L46).
  - **إنجاز المرحلة 3 (Frontend & POS UX)**:
    - إصلاح حفظ الفاتورة المبدئية (`PROFORMA`) ومزامنة `taxRate` وتحسين الأداء بعد البيع في [`usePos.js`](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-client-v3-full/src/hooks/usePos.js) و [`SettingsContext.jsx`](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-client-v3-full/src/context/SettingsContext.jsx).
    - تفعيل إرسال وحفظ حقل الخصم `discount` في [`PurchaseInvoiceView.jsx`](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-client-v3-full/src/pages/PurchaseInvoiceView.jsx) و [`procurementController.js`](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/controllers/procurementController.js).
  - **إنجاز المرحلة 4 (Security & Hygiene)**:
    - تعزيز التحقق من حالة الحساب `isActive` في [`auth.js`](file:///c:/Users/HP/Desktop/erp%20system/erp-mern-server-v3/src/middleware/auth.js)، وتوليد `JWT_SECRET` مشفر تلقائياً في [`desktop-app/src/main.js`](file:///c:/Users/HP/Desktop/erp%20system/desktop-app/src/main.js)، وتحديث [`.gitignore`](file:///c:/Users/HP/Desktop/erp%20system/.gitignore).

