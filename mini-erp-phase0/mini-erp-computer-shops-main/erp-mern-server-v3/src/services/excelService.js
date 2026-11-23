/**
 * Excel Export Service
 * Handles generation of Excel files for financial reports.
 */

import ExcelJS from 'exceljs';

/**
 * Common styles and setup
 */
const setupWorkbook = () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ERP System';
  workbook.created = new Date();
  return workbook;
};

const applyHeaderStyle = (row) => {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2C3E50' }, // Dark blue
  };
  row.alignment = { horizontal: 'center' };
};

const applyTotalStyle = (row) => {
  row.font = { bold: true };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFECF0F1' }, // Light gray
  };
  row.getCell(1).alignment = { horizontal: 'right' }; // Label alignment
};

/**
 * Generate Trial Balance Excel
 */
export async function generateTrialBalanceExcel(data, res) {
  const workbook = setupWorkbook();
  const sheet = workbook.addWorksheet('ميزان المراجعة', { views: [{ rightToLeft: true }] });

  // Title & Period
  sheet.mergeCells('A1:E1');
  sheet.getCell('A1').value = 'ميزان المراجعة (Trial Balance)';
  sheet.getCell('A1').font = { size: 16, bold: true };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:E2');
  sheet.getCell('A2').value = `الفترة: ${data.period.from || 'بداية النشاط'} إلى ${data.period.to}`;
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  // Headers
  sheet.getRow(4).values = ['الكود', 'اسم الحساب', 'النوع', 'مدين', 'دائن'];
  applyHeaderStyle(sheet.getRow(4));
  sheet.columns = [
    { key: 'code', width: 15 },
    { key: 'name', width: 40 },
    { key: 'type', width: 15 },
    { key: 'debit', width: 20 },
    { key: 'credit', width: 20 },
  ];

  // Data
  data.accounts.forEach((acc) => {
    sheet.addRow({
      code: acc.code,
      name: acc.name,
      type: acc.type,
      debit: acc.debitTotal,
      credit: acc.creditTotal,
    });
  });

  // Totals
  const totalRow = sheet.addRow({
    code: 'الإجمالي',
    debit: data.totals.totalDebit,
    credit: data.totals.totalCredit,
  });
  applyTotalStyle(totalRow);
  sheet.mergeCells(`A${totalRow.number}:C${totalRow.number}`); // Merge Code, Name, Type for "Total" label

  // Write to response
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=trial-balance-${data.period.to}.xlsx`);

  await workbook.xlsx.write(res);
}

/**
 * Generate Income Statement Excel
 */
export async function generateIncomeStatementExcel(data, res) {
  const workbook = setupWorkbook();
  const sheet = workbook.addWorksheet('قائمة الدخل', { views: [{ rightToLeft: true }] });

  // Title
  sheet.mergeCells('A1:C1');
  sheet.getCell('A1').value = 'قائمة الدخل (Income Statement)';
  sheet.getCell('A1').font = { size: 16, bold: true };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:C2');
  sheet.getCell('A2').value = `الفترة: ${data.الفترة.من || 'بداية النشاط'} إلى ${data.الفترة.إلى}`;
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  // Headers
  sheet.getRow(4).values = ['الكود', 'اسم الحساب', 'الرصيد'];
  applyHeaderStyle(sheet.getRow(4));
  sheet.columns = [
    { key: 'code', width: 15 },
    { key: 'name', width: 40 },
    { key: 'balance', width: 20 },
  ];

  let rowIndex = 5;

  // Helper to add section
  const addSection = (title, accounts, total = null) => {
    const titleRow = sheet.addRow([title]);
    titleRow.font = { bold: true, underline: true };

    accounts.forEach((acc) => {
      sheet.addRow({
        code: acc.code,
        name: acc.name,
        balance: acc.balance,
      });
    });

    if (total !== null) {
      const row = sheet.addRow({
        name: `إجمالي ${title}`,
        balance: total,
      });
      row.font = { italic: true };
      row.getCell('balance').font = { bold: true };
      sheet.addRow([]); // Spacer
    }
  };

  // Revenue
  addSection('الإيرادات', data.حسابات_الإيرادات, data.الإجماليات.إجمالي_الإيرادات);

  // COGS
  if (data.حساب_تكلفة_البضاعة) {
    addSection('تكلفة البضاعة المباعة', [data.حساب_تكلفة_البضاعة], data.الإجماليات.تكلفة_البضاعة_المباعة);
  }

  // Gross Profit
  const gpRow = sheet.addRow({ name: 'مجمل الربح', balance: data.الإجماليات.مجمل_الربح });
  applyTotalStyle(gpRow);
  sheet.addRow([]);

  // Expenses
  addSection('المصروفات التشغيلية', data.حسابات_المصروفات_التشغيلية, data.الإجماليات.المصروفات_التشغيلية);

  // Net Profit
  const npRow = sheet.addRow({ name: 'صافي الربح', balance: data.الإجماليات.صافي_الربح });
  applyTotalStyle(npRow);
  npRow.font = { size: 12, bold: true };
  npRow.getCell('balance').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27AE60' } }; // Green

  // Write to response
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=income-statement-${data.الفترة.إلى}.xlsx`);

  await workbook.xlsx.write(res);
}

/**
 * Generate Customer Statement Excel
 */
export async function generateCustomerStatementExcel(data, res) {
  const workbook = setupWorkbook();
  const sheet = workbook.addWorksheet('كشف حساب', { views: [{ rightToLeft: true }] });

  // Title & Info
  sheet.mergeCells('A1:F1');
  sheet.getCell('A1').value = `كشف حساب عميل: ${data.العميل.الاسم}`;
  sheet.getCell('A1').font = { size: 16, bold: true };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:F2');
  sheet.getCell('A2').value =
    `الكود: ${data.العميل.الكود || '-'} | الفترة: ${data.الفترة.من || 'بداية النشاط'} إلى ${data.الفترة.إلى}`;
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  // Headers
  sheet.getRow(4).values = ['التاريخ', 'النوع', 'الرقم', 'مدين', 'دائن', 'الرصيد'];
  applyHeaderStyle(sheet.getRow(4));
  sheet.columns = [
    { key: 'date', width: 15 },
    { key: 'type', width: 15 },
    { key: 'ref', width: 20 },
    { key: 'debit', width: 15 },
    { key: 'credit', width: 15 },
    { key: 'balance', width: 15 },
  ];

  // Data
  data.العمليات.forEach((tx) => {
    sheet.addRow({
      date: new Date(tx.التاريخ).toISOString().split('T')[0],
      type: tx.النوع,
      ref: tx.الرقم,
      debit: tx.مدين,
      credit: tx.دائن,
      balance: tx.الرصيد,
    });
  });

  // Totals
  const totalRow = sheet.addRow({
    date: 'الإجماليات',
    debit: data.الإجماليات.إجمالي_المدين,
    credit: data.الإجماليات.إجمالي_الدائن,
    balance: data.الإجماليات.الرصيد_الختامي,
  });
  applyTotalStyle(totalRow);
  sheet.mergeCells(`A${totalRow.number}:C${totalRow.number}`);

  // Write to response
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=customer-statement-${data.العميل.المعرف}-${data.الفترة.إلى}.xlsx`
  );

  await workbook.xlsx.write(res);
}

/**
 * Generate Aging Report Excel
 */
export async function generateAgingReportExcel(data, res) {
  const workbook = setupWorkbook();
  const sheet = workbook.addWorksheet('أعمار الديون', { views: [{ rightToLeft: true }] });

  // Title
  sheet.mergeCells('A1:G1');
  sheet.getCell('A1').value = 'تقرير أعمار الديون (Aging Report)';
  sheet.getCell('A1').font = { size: 16, bold: true };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:G2');
  sheet.getCell('A2').value = `حتى تاريخ: ${data.إلى}`;
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  // Headers
  sheet.getRow(4).values = ['الكود', 'اسم العميل', '0-30 يوم', '31-60 يوم', '61-90 يوم', '90+ يوم', 'الإجمالي'];
  applyHeaderStyle(sheet.getRow(4));
  sheet.columns = [
    { key: 'code', width: 15 },
    { key: 'name', width: 40 },
    { key: 'b1', width: 15 },
    { key: 'b2', width: 15 },
    { key: 'b3', width: 15 },
    { key: 'b4', width: 15 },
    { key: 'total', width: 20 },
  ];

  // Data
  data.العملاء.forEach((c) => {
    sheet.addRow({
      code: c.العميل.الكود,
      name: c.العميل.الاسم,
      b1: c['0_30'],
      b2: c['31_60'],
      b3: c['61_90'],
      b4: c['90_أكثر'],
      total: c.الإجمالي,
    });
  });

  // Totals
  const totalRow = sheet.addRow({
    code: 'المجموع الكلي',
    b1: data.الإجماليات['0_30'],
    b2: data.الإجماليات['31_60'],
    b3: data.الإجماليات['61_90'],
    b4: data.الإجماليات['90_أكثر'],
    total: data.الإجماليات.الإجمالي,
  });
  applyTotalStyle(totalRow);
  sheet.mergeCells(`A${totalRow.number}:B${totalRow.number}`);

  // Write to response
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=aging-report-${data.إلى}.xlsx`);

  await workbook.xlsx.write(res);
}

export default {
  generateTrialBalanceExcel,
  generateIncomeStatementExcel,
  generateCustomerStatementExcel,
  generateAgingReportExcel,
};
