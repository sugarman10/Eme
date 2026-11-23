/**
 * Hardcoded Standard Chart of Accounts (دليل الحسابات القياسي الموحد)
 *
 * يحتوي على الشجرة المحاسبية القياسية المعيارية:
 * 1. الأصول (Assets)
 * 2. الخصوم (Liabilities)
 * 3. حقوق الملكية (Equity)
 * 4. الإيرادات (Revenues)
 * 5. المصروفات والتكاليف (Costs & Expenses)
 */

export const STANDARD_CHART_OF_ACCOUNTS = [
  // ==========================================
  // 1. الأصول (Assets)
  // ==========================================
  { code: '1', name: 'الأصول', type: 'asset', isSystem: true, parentCode: null },

  // 11 - الأصول المتداولة
  { code: '11', name: 'الأصول المتداولة', type: 'asset', isSystem: true, parentCode: '1' },
  { code: '1101', name: 'الصندوق والخزينة الرئيسية', type: 'asset', isSystem: true, parentCode: '11', systemKey: 'CASH', legacyCodes: ['1010', '11101'] },
  { code: '1102', name: 'الحسابات المصرفية والبنوك', type: 'asset', isSystem: true, parentCode: '11', systemKey: 'BANK', legacyCodes: ['1020'] },
  { code: '1103', name: 'ذمم العملاء والمدينون', type: 'asset', isSystem: true, parentCode: '11', systemKey: 'AR', legacyCodes: ['1030'] },
  { code: '1104', name: 'المخزون السلعي', type: 'asset', isSystem: true, parentCode: '11', systemKey: 'INVENTORY', legacyCodes: ['1040', '10103'] },
  { code: '1105', name: 'سلف وعهد الموظفين', type: 'asset', isSystem: true, parentCode: '11', systemKey: 'EMPLOYEE_ADVANCES', legacyCodes: ['10105'] },

  // 12 - الأصول الثابتة
  { code: '12', name: 'الأصول الثابتة', type: 'asset', isSystem: true, parentCode: '1' },
  { code: '1201', name: 'أجهزة ومعدات حاسوبية ومكتبية', type: 'asset', isSystem: true, parentCode: '12', systemKey: 'EQUIPMENT' },
  { code: '1202', name: 'أثاث وتجهيزات ديكور', type: 'asset', isSystem: true, parentCode: '12', systemKey: 'FURNITURE' },

  // ==========================================
  // 2. الخصوم والالتزامات (Liabilities)
  // ==========================================
  { code: '2', name: 'الخصوم والالتزامات', type: 'liability', isSystem: true, parentCode: null },

  // 21 - الخصوم المتداولة
  { code: '21', name: 'الخصوم المتداولة', type: 'liability', isSystem: true, parentCode: '2' },
  { code: '2101', name: 'ذمم الموردين والدائنون', type: 'liability', isSystem: true, parentCode: '21', systemKey: 'AP', legacyCodes: ['2010', '20101'] },
  { code: '2102', name: 'ضريبة القيمة المضافة المستحقة', type: 'liability', isSystem: true, parentCode: '21', systemKey: 'VAT_PAYABLE', legacyCodes: ['2020'] },
  { code: '2103', name: 'أمانات ومحافظ العملاء', type: 'liability', isSystem: true, parentCode: '21', systemKey: 'CUSTOMER_WALLET', legacyCodes: ['2030'] },
  { code: '2104', name: 'رواتب ومستحقات موظفين', type: 'liability', isSystem: true, parentCode: '21', systemKey: 'ACCRUED_SALARIES', legacyCodes: ['2040'] },

  // ==========================================
  // 3. حقوق الملكية (Equity)
  // ==========================================
  { code: '3', name: 'حقوق الملكية', type: 'equity', isSystem: true, parentCode: null },
  { code: '3101', name: 'رأس المال المدفوع', type: 'equity', isSystem: true, parentCode: '3', systemKey: 'CAPITAL', legacyCodes: ['3010'] },
  { code: '3102', name: 'الأرباح المحتجزة / المدورة', type: 'equity', isSystem: true, parentCode: '3', systemKey: 'RETAINED_EARNINGS', legacyCodes: ['3020'] },
  { code: '3103', name: 'جاري صاحب المنشأة / الشركاء', type: 'equity', isSystem: true, parentCode: '3', systemKey: 'OWNER_DRAWINGS', legacyCodes: ['3030'] },

  // ==========================================
  // 4. الإيرادات (Revenues)
  // ==========================================
  { code: '4', name: 'الإيرادات', type: 'revenue', isSystem: true, parentCode: null },

  // 41 - إيرادات النشاط الرئيسي
  { code: '41', name: 'إيرادات النشاط التشغيلي', type: 'revenue', isSystem: true, parentCode: '4' },
  { code: '4101', name: 'إيرادات المبيعات', type: 'revenue', isSystem: true, parentCode: '41', systemKey: 'SALES_REVENUE', legacyCodes: ['4010'] },
  { code: '4102', name: 'مردودات ومسموحات المبيعات', type: 'revenue', isSystem: true, parentCode: '41', systemKey: 'SALES_RETURNS', legacyCodes: ['40102'] },
  { code: '4103', name: 'خصم مسموح به (خصم المبيعات)', type: 'revenue', isSystem: true, parentCode: '41', systemKey: 'SALES_DISCOUNT', legacyCodes: ['40103'] },

  // 42 - إيرادات أخرى
  { code: '42', name: 'إيرادات أخرى وفروقات', type: 'revenue', isSystem: true, parentCode: '4' },
  { code: '4201', name: 'إيرادات وفروقات أسعار الصرف', type: 'revenue', isSystem: true, parentCode: '42', systemKey: 'FOREX_GAIN', legacyCodes: ['4020'] },
  { code: '4202', name: 'إيرادات وفروقات نقدية متنوعة', type: 'revenue', isSystem: true, parentCode: '42', systemKey: 'CASH_OVERAGE', legacyCodes: ['4030'] },

  // ==========================================
  // 5. التكاليف والمصروفات (Costs & Expenses)
  // ==========================================
  { code: '5', name: 'المصروفات والتكاليف', type: 'expense', isSystem: true, parentCode: null },

  // 51 - تكلفة النشاط
  { code: '51', name: 'تكلفة المبيعات', type: 'expense', isSystem: true, parentCode: '5' },
  { code: '5101', name: 'تكلفة البضاعة المباعة (COGS)', type: 'expense', isSystem: true, parentCode: '51', systemKey: 'COGS', legacyCodes: ['5010'] },
  { code: '5102', name: 'خسائر وتالف المخزون والتسويات', type: 'expense', isSystem: true, parentCode: '51', systemKey: 'INVENTORY_LOSS', legacyCodes: ['5040'] },

  // 52 - المصروفات التشغيلية والعمومية
  { code: '52', name: 'المصروفات التشغيلية والإدارية', type: 'expense', isSystem: true, parentCode: '5' },
  { code: '5201', name: 'رواتب وأجور الموظفين', type: 'expense', isSystem: true, parentCode: '52', systemKey: 'SALARIES_EXPENSE', legacyCodes: ['5021'] },
  { code: '5202', name: 'إيجارات ومرافق عامة (كهرباء ومياه وانترنت)', type: 'expense', isSystem: true, parentCode: '52', systemKey: 'RENT_UTILITIES', legacyCodes: ['5022'] },
  { code: '5203', name: 'مصاريف صيانة وتشغيل', type: 'expense', isSystem: true, parentCode: '52', systemKey: 'MAINTENANCE_EXPENSE' },
  { code: '5204', name: 'مصاريف دعاية وإعلان وتسويق', type: 'expense', isSystem: true, parentCode: '52', systemKey: 'MARKETING_EXPENSE' },
  { code: '5205', name: 'عجز وخسائر نقدية', type: 'expense', isSystem: true, parentCode: '52', systemKey: 'CASH_SHORTAGE', legacyCodes: ['5030'] },
  { code: '5206', name: 'مصاريف وعمولات بنكية', type: 'expense', isSystem: true, parentCode: '52', systemKey: 'BANK_FEES' },
  { code: '5299', name: 'مصروفات عمومية وإدارية أخرى', type: 'expense', isSystem: true, parentCode: '52', systemKey: 'GENERAL_EXPENSE', legacyCodes: ['5020'] },
];

/**
 * System Key Lookup Map
 */
export const SYSTEM_ACCOUNT_KEYS = {};
STANDARD_CHART_OF_ACCOUNTS.forEach((acc) => {
  if (acc.systemKey) {
    SYSTEM_ACCOUNT_KEYS[acc.systemKey] = acc;
  }
});
