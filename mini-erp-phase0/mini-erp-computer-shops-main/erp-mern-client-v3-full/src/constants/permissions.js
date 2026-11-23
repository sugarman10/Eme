/**
 * Comprehensive System Permissions Definition
 * Organized by functional module with Arabic labels and descriptions.
 */
export const PERMISSION_MODULES = [
  {
    id: 'sales',
    category: 'المبيعات ونقاط البيع (POS)',
    color: 'emerald',
    permissions: [
      { key: 'pos_access', label: 'استخدام نقطة البيع (POS)', desc: 'تمكين الموظف من تشغيل شاشة الكاشير والمبيعات السريعة' },
      { key: 'sales_invoices_view', label: 'استعراض فواتير المبيعات', desc: 'عرض قائمة وسجل فواتير البيع' },
      { key: 'sales_invoices_create', label: 'إنشاء فواتير بيع جديدة', desc: 'إصدار وترحيل فواتير بيع جديدة للعملاء' },
      { key: 'sales_invoices_edit', label: 'تعديل فواتير المبيعات', desc: 'تعديل بنود وأسعار الفواتير قبل الترحيل' },
      { key: 'delete_invoices', label: 'حذف أو إلغاء فواتير المبيعات', desc: 'إلغاء أو حذف فواتير البيع (صلاحية حساسة)' },
      { key: 'sales_returns', label: 'إدارة مردودات المبيعات', desc: 'إنشاء واسترجاع فواتير مرتجع البيع' },
      { key: 'customers_manage', label: 'إدارة بطاقات الزبائن', desc: 'إضافة وتعديل بيانات العملاء وسقف المديونية' },
      { key: 'allow_discount', label: 'منح خصومات على الفواتير', desc: 'إمكانية إعطاء خصم مالي أو نسبة مئوية للعميل' },
      { key: 'exchange_rate_manage', label: 'تعديل سعر صرف العملات (الدولار)', desc: 'إمكانية تغيير وتثبيت سعر الصرف اليومي وتحديث أسعار البيع المعتمدة' },
    ]
  },
  {
    id: 'purchases',
    category: 'المشتريات والموردين',
    color: 'blue',
    permissions: [
      { key: 'purchases_view', label: 'استعراض فواتير المشتريات', desc: 'عرض فواتير الشراء وأسعار التكلفة' },
      { key: 'purchases_create', label: 'تسجيل فواتير شراء جديدة', desc: 'إدخال واستلام بضاعة ومشتريات جديدة' },
      { key: 'purchases_returns', label: 'إدارة مردودات الشراء', desc: 'إرجاع بضاعة لمورد وتسوية الحساب' },
      { key: 'suppliers_manage', label: 'إدارة حسابات الموردين', desc: 'إضافة موردين ومتابعة كشوف حساباتهم' },
      { key: 'supplier_payments', label: 'سداد دفعات الموردين', desc: 'تسجيل سندات دفع ومستحقات الموردين' },
    ]
  },
  {
    id: 'inventory',
    category: 'المخازن والمستودعات',
    color: 'amber',
    permissions: [
      { key: 'inventory_view', label: 'استعراض الأصناف والمخزون', desc: 'الاطلاع على كميات وأرصدة البضاعة في المخازن' },
      { key: 'items_manage', label: 'إضافة وتعديل بطاقات الأصناف', desc: 'تعريف أصناف جديدة، الباركود، والأسعار' },
      { key: 'inventory_transfer', label: 'التحويل بين المستودعات', desc: 'نقل بضاعة بين المخازن والفروع' },
      { key: 'inventory_adjust', label: 'تسوية الجرد وتعديل الكميات', desc: 'إجراء تسويات عجز أو زيادة المخزون' },
      { key: 'warehouses_manage', label: 'إدارة المستودعات والفروع', desc: 'إضافة وتهيئة المستودعات وأماكن التخزين' },
    ]
  },
  {
    id: 'treasury',
    category: 'الخزينة والمالية',
    color: 'purple',
    permissions: [
      { key: 'treasury_view', label: 'عرض أرصدة الخزائن والصناديق', desc: 'الاطلاع على حركة الرصيد النقدي في الخزائن' },
      { key: 'treasury_manage', label: 'إدارة الخزائن والتحويلات المالية', desc: 'التحويل بين الصناديق والمصارف' },
      { key: 'payment_vouchers', label: 'سندات القبض والصرف', desc: 'تحرير سندات صرف أو قبض مالي' },
      { key: 'expenses_manage', label: 'تسجيل المصروفات والمنصرفات', desc: 'إدخال بنود المصاريف اليومية والتشغيلية' },
      { key: 'daily_closures', label: 'إقفال اليومية والورديات', desc: 'إنهاء وتقفيل يوميات البيع والصندوق' },
    ]
  },
  {
    id: 'accounting',
    category: 'الحسابات والتقارير العامة',
    color: 'indigo',
    permissions: [
      { key: 'coa_manage', label: 'دليل وشجرة الحسابات', desc: 'إدارة وتعديل دليل الحسابات العام' },
      { key: 'journals_manage', label: 'القيود اليومية المحاسبية', desc: 'إنشاء وتعديل قيود اليومية العامة' },
      { key: 'financial_reports', label: 'التقارير المالية والأرباح', desc: 'استعراض الأرباح والخسائر وميزان المراجعة' },
      { key: 'reports_view', label: 'تقارير حركة المبيعات والمخازن', desc: 'الاطلاع على تقارير الأداء والمبيعات العامة' },
      { key: 'fiscal_period_switch', label: 'التنقل بين الفترات والسنوات المالية', desc: 'إمكانية استعراض وتغيير السنة والفترة المالية النشطة في المنظومة' },
      { key: 'fiscal_period_manage', label: 'إدارة وإقفال الفترات المالية', desc: 'إنشاء فترات وسنوات مالية جديدة، إقفالها وإعادة فتحها' },
      { key: 'audit_view', label: 'سجل المراقبة والعمليات (Audit Trail)', desc: 'تتبع كافة التغييرات والعمليات المنفذة في النظام' },
    ]
  },
  {
    id: 'hr',
    category: 'الموارد البشرية وإعدادات المنظومة',
    color: 'rose',
    permissions: [
      { key: 'hr_employees_manage', label: 'إدارة شؤون الموظفين', desc: 'إضافة وتعديل بيانات الموظفين' },
      { key: 'hr_payroll_manage', label: 'احتساب وصرف الرواتب', desc: 'توليد مسير الرواتب الشهري وسداد المستحقات' },
      { key: 'hr_loans_manage', label: 'إدارة واعتماد والتغاضي عن السلف', desc: 'صرف السلف، إعفاء الموظفين، أو تأجيل الخصم' },
      { key: 'users_manage', label: 'إدارة المستخدمين والصلاحيات', desc: 'إنشاء الحسابات وتعيين الصلاحيات' },
      { key: 'settings_manage', label: 'إعدادات المنظومة والشركة', desc: 'تعديل بيانات الشركة، العملات والطباعة' },
    ]
  }
];

export const ALL_PERMISSION_KEYS = PERMISSION_MODULES.flatMap(m => m.permissions.map(p => p.key));

/**
 * Default preset permissions according to system roles
 */
export const ROLE_PRESETS = {
  cashier: [
    'pos_access',
    'sales_invoices_view',
    'sales_invoices_create',
    'sales_returns',
    'customers_manage',
    'inventory_view',
    'daily_closures'
  ],
  storekeeper: [
    'inventory_view',
    'items_manage',
    'inventory_transfer',
    'inventory_adjust',
    'purchases_view',
    'purchases_create',
    'purchases_returns'
  ],
  accountant: [
    'sales_invoices_view',
    'purchases_view',
    'suppliers_manage',
    'supplier_payments',
    'treasury_view',
    'treasury_manage',
    'payment_vouchers',
    'expenses_manage',
    'daily_closures',
    'coa_manage',
    'journals_manage',
    'financial_reports',
    'reports_view',
    'fiscal_period_switch',
    'hr_payroll_manage'
  ],
  manager: [
    'pos_access',
    'sales_invoices_view',
    'sales_invoices_create',
    'sales_invoices_edit',
    'sales_returns',
    'customers_manage',
    'allow_discount',
    'exchange_rate_manage',
    'purchases_view',
    'purchases_create',
    'purchases_returns',
    'suppliers_manage',
    'supplier_payments',
    'inventory_view',
    'items_manage',
    'inventory_transfer',
    'inventory_adjust',
    'treasury_view',
    'treasury_manage',
    'payment_vouchers',
    'expenses_manage',
    'daily_closures',
    'coa_manage',
    'journals_manage',
    'financial_reports',
    'reports_view',
    'fiscal_period_switch',
    'audit_view',
    'hr_employees_manage',
    'hr_payroll_manage',
    'hr_loans_manage'
  ],
  admin: ALL_PERMISSION_KEYS
};
