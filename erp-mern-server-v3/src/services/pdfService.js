import puppeteer from 'puppeteer';
import logger from '../config/logger.js';

/**
 * Generate Dashboard PDF HTML with embedded Cairo font
 * @param {Object} data - Dashboard data {kpis, trends, alerts, etc}
 * @param {Object} meta - Metadata {from, to, warehouseName, exportDate}
 * @param {Object} chartImages - Chart base64 images {salesByDay, topProducts, categoryShare}
 * @returns {String} Full HTML string
 */
function generateDashboardPdfHtml(data, meta, chartImages = {}) {
  const { kpis = {}, trends = {}, alerts = [] } = data;
  const { from, to, warehouseName = 'كل المستودعات', exportDate, includeAlerts = true } = meta;

  // Cairo font base64 (embedded - works offline)
  // In production, use actual Cairo TTF file converted to base64
  // For now, fallback to system fonts with preference for Arabic
  const fontFace = `
    @font-face {
      font-family: 'Cairo';
      font-style: normal;
      font-weight: 400;
      src: local('Arial'), local('Segoe UI');
    }
    @font-face {
      font-family: 'Cairo';
      font-style: normal;
      font-weight: 700;
      src: local('Arial Bold'), local('Segoe UI Bold');
    }
  `;

  // Generate KPI cards HTML
  const kpiCards = [
    { title: 'المبيعات', value: kpis.salesRevenue || 0, unit: 'د.ل', trend: trends.sales },
    { title: 'عدد الفواتير', value: kpis.salesCount || 0, unit: '', trend: null },
    { title: 'إجمالي المقبوضات', value: kpis.receiptsTotal || 0, unit: 'د.ل', trend: null },
    { title: 'المخزون المنخفض', value: kpis.lowStockCount || 0, unit: 'صنف', trend: null }
  ].map(kpi => `
    <div class="kpi-card">
      <div class="kpi-title">${kpi.title}</div>
      <div class="kpi-value">${Number(kpi.value).toLocaleString('ar-LY')} ${kpi.unit}</div>
      ${kpi.trend !== null && kpi.trend !== undefined ? `
        <div class="kpi-trend ${kpi.trend >= 0 ? 'positive' : 'negative'}">
          ${kpi.trend >= 0 ? '↑' : '↓'} ${Math.abs(kpi.trend).toFixed(1)}%
        </div>
      ` : ''}
    </div>
  `).join('');

  // Generate alerts HTML
  const alertsHtml = includeAlerts && alerts.length > 0 ? `
    <section class="alerts-section">
      <h2 class="section-title">التنبيهات</h2>
      <div class="alerts-grid">
        ${alerts.map(alert => `
          <div class="alert-card severity-${alert.severity}">
            <div class="alert-title">${alert.title}</div>
            <div class="alert-message">${alert.message}</div>
          </div>
        `).join('')}
      </div>
    </section>
  ` : '';

  // Generate charts HTML
  const chartsHtml = `
    <section class="charts-section">
      <h2 class="section-title">الرسوم البيانية</h2>
      ${chartImages.salesByDay ? `
        <div class="chart-container">
          <h3 class="chart-title">المبيعات اليومية</h3>
          <img src="data:image/png;base64,${chartImages.salesByDay}" alt="المبيعات اليومية" class="chart-image" />
        </div>
      ` : ''}
      ${chartImages.topProducts ? `
        <div class="chart-container">
          <h3 class="chart-title">أعلى المنتجات مبيعاً</h3>
          <img src="data:image/png;base64,${chartImages.topProducts}" alt="أعلى المنتجات" class="chart-image" />
        </div>
      ` : ''}
      ${chartImages.categoryShare ? `
        <div class="chart-container">
          <h3 class="chart-title">حصة الفئات</h3>
          <img src="data:image/png;base64,${chartImages.categoryShare}" alt="حصة الفئات" class="chart-image" />
        </div>
      ` : ''}
    </section>
  `;

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير لوحة القيادة</title>
  <style>
    ${fontFace}
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Cairo', 'Arial', sans-serif;
      direction: rtl;
      text-align: right;
      font-size: 12pt;
      line-height: 1.6;
      color: #333;
      background: #fff;
    }
    
    .page {
      padding: 20mm;
    }
    
    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 15px;
      margin-bottom: 30px;
    }
    
    .header h1 {
      font-size: 24pt;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 10px;
    }
    
    .header-info {
      font-size: 11pt;
      color: #666;
      line-height: 1.8;
    }
    
    .header-info strong {
      color: #333;
      font-weight: 700;
    }
    
    .section-title {
      font-size: 16pt;
      font-weight: 700;
      color: #1e40af;
      margin: 25px 0 15px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 25px;
    }
    
    .kpi-card {
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      padding: 15px;
      background: #f9fafb;
    }
    
    .kpi-title {
      font-size: 11pt;
      color: #6b7280;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .kpi-value {
      font-size: 20pt;
      font-weight: 700;
      color: #111827;
      margin-bottom: 5px;
    }
    
    .kpi-trend {
      font-size: 10pt;
      font-weight: 600;
    }
    
    .kpi-trend.positive {
      color: #059669;
    }
    
    .kpi-trend.negative {
      color: #dc2626;
    }
    
    .alerts-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      margin-bottom: 25px;
    }
    
    .alert-card {
      border-right: 4px solid;
      padding: 12px;
      border-radius: 6px;
      background: #f9fafb;
    }
    
    .alert-card.severity-high {
      border-color: #dc2626;
      background: #fef2f2;
    }
    
    .alert-card.severity-medium {
      border-color: #f59e0b;
      background: #fffbeb;
    }
    
    .alert-card.severity-low {
      border-color: #3b82f6;
      background: #eff6ff;
    }
    
    .alert-title {
      font-size: 11pt;
      font-weight: 700;
      color: #111827;
      margin-bottom: 5px;
    }
    
    .alert-message {
      font-size: 10pt;
      color: #4b5563;
    }
    
    .chart-container {
      margin: 20px 0;
      page-break-inside: avoid;
    }
    
    .chart-title {
      font-size: 13pt;
      font-weight: 700;
      color: #374151;
      margin-bottom: 12px;
      text-align: center;
    }
    
    .chart-image {
      width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
      max-width: 700px;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 15px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      font-size: 10pt;
      color: #6b7280;
    }
    
    @media print {
      @page {
        size: A4;
        margin: 20mm;
      }
      
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="header">
      <h1>نظام إدارة الأعمال</h1>
      <h2 style="font-size: 16pt; color: #4b5563; margin-bottom: 15px;">تقرير لوحة القيادة</h2>
      <div class="header-info">
        <div><strong>الفترة:</strong> ${from} - ${to}</div>
        <div><strong>المستودع:</strong> ${warehouseName}</div>
        <div><strong>تاريخ التصدير:</strong> ${exportDate}</div>
      </div>
    </header>
    
    <section class="kpis-section">
      <h2 class="section-title">المؤشرات الرئيسية</h2>
      <div class="kpi-grid">
        ${kpiCards}
      </div>
    </section>
    
    ${alertsHtml}
    
    ${chartsHtml}
    
    <footer class="footer">
      <p>تم إنشاء هذا التقرير بواسطة نظام إدارة الأعمال | ${new Date().toLocaleDateString('ar-LY')}</p>
    </footer>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate PDF from HTML using Puppeteer
 * @param {String} html - Full HTML string
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generatePdfFromHtml(html) {
  let browser = null;
  try {
    logger.info('[PDF] Starting Puppeteer...');

    // Launch browser with Windows-compatible settings
    browser = await puppeteer.launch({
      headless: true, // Use boolean for better compatibility
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-first-run',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
        '--safebrowsing-disable-auto-update'
      ],
      timeout: 60000, // 60 second timeout for browser launch
      protocolTimeout: 60000
    });

    logger.info('[PDF] Browser launched successfully');
    const page = await browser.newPage();

    // Set viewport for better rendering
    await page.setViewport({ width: 1200, height: 800 });

    // Set content with longer timeout
    logger.debug('[PDF] Setting page content...');
    await page.setContent(html, {
      waitUntil: 'domcontentloaded', // Faster than networkidle0
      timeout: 60000
    });

    // Give a moment for content to render
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate PDF with proper settings
    logger.debug('[PDF] Generating PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: false,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      },
      timeout: 60000
    });

    logger.info('[PDF] PDF generated successfully', { size: pdfBuffer.length });
    return pdfBuffer;

  } catch (error) {
    logger.error('[PDF] Error generating PDF:', error.message);
    throw new Error(`فشل إنشاء PDF: ${error.message}`);
  } finally {
    // Cleanup in finally block
    if (browser) {
      try {
        await browser.close();
        logger.debug('[PDF] Browser closed');
      } catch (closeError) {
        logger.error('[PDF] Error closing browser:', closeError.message);
      }
    }
  }
}

/**
 * Generate Credit Note (Tax Credit Note) PDF HTML
 * @param {Object} salesReturn - The sales return document
 * @param {Object} customer - Customer object with name, phone, code
 * @param {Object} originalInvoice - Original invoice reference
 * @returns {String} Full HTML string for Credit Note
 */
function generateCreditNotePdfHtml(salesReturn, customer, originalInvoice) {
  const formatCurrency = (val) => Number(val || 0).toLocaleString('ar-LY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDate = (date) => new Date(date).toLocaleDateString('ar-LY', { year: 'numeric', month: 'long', day: 'numeric' });

  // Generate return number from ID if not present
  const returnNumber = salesReturn.returnNumber || `RET-${salesReturn._id?.toString().slice(-6).toUpperCase()}`;
  const invoiceNumber = originalInvoice?.number || originalInvoice?._id?.toString().slice(-6) || 'N/A';

  // Reason translation map
  const reasonLabels = {
    damaged: 'تالف',
    expired: 'منتهي الصلاحية',
    wrong_item: 'صنف خاطئ',
    customer_preference: 'رغبة العميل',
    other: 'أخرى'
  };

  // Generate items table rows
  const itemsRows = (salesReturn.items || []).map((item, index) => {
    const itemName = item.item?.name || item.item?.sku || 'صنف';
    const sku = item.item?.sku || '-';
    const qty = item.qty || 0;
    const unitPrice = item.unitPrice || 0;
    const refundAmount = item.refundAmount || (qty * unitPrice);
    const reason = reasonLabels[item.reason] || item.reason || '-';

    return `
      <tr>
        <td class="text-center">${index + 1}</td>
        <td>
          <div class="item-name">${itemName}</div>
          <div class="item-sku">${sku}</div>
        </td>
        <td class="text-center">${qty}</td>
        <td class="text-center">${formatCurrency(unitPrice)}</td>
        <td class="text-center">${formatCurrency(refundAmount)}</td>
        <td class="text-center">${reason}</td>
      </tr>
    `;
  }).join('');

  // Cairo font fallback
  const fontFace = `
    @font-face {
      font-family: 'Cairo';
      font-style: normal;
      font-weight: 400;
      src: local('Arial'), local('Segoe UI');
    }
    @font-face {
      font-family: 'Cairo';
      font-style: normal;
      font-weight: 700;
      src: local('Arial Bold'), local('Segoe UI Bold');
    }
  `;

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>إشعار دائن ضريبي - ${returnNumber}</title>
  <style>
    ${fontFace}
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Cairo', 'Arial', sans-serif;
      direction: rtl;
      text-align: right;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
      background: #fff;
    }
    
    .page {
      padding: 15mm;
      max-width: 210mm;
      margin: 0 auto;
    }
    
    /* Header with Purple accent */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 4px solid #7c3aed;
      padding-bottom: 20px;
      margin-bottom: 25px;
    }
    
    .company-info {
      flex: 1;
    }
    
    .company-name {
      font-size: 20pt;
      font-weight: 700;
      color: #1e1b4b;
      margin-bottom: 5px;
    }
    
    .company-details {
      font-size: 9pt;
      color: #6b7280;
      line-height: 1.8;
    }
    
    .document-info {
      text-align: left;
      background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      min-width: 200px;
    }
    
    .document-title {
      font-size: 14pt;
      font-weight: 700;
      margin-bottom: 8px;
      text-align: center;
    }
    
    .document-subtitle {
      font-size: 9pt;
      text-align: center;
      opacity: 0.9;
      margin-bottom: 10px;
    }
    
    .document-number {
      font-size: 12pt;
      font-weight: 700;
      text-align: center;
      background: rgba(255,255,255,0.2);
      padding: 5px 10px;
      border-radius: 4px;
    }
    
    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 25px;
    }
    
    .info-box {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 15px;
      background: #fafafa;
    }
    
    .info-box-title {
      font-size: 10pt;
      font-weight: 700;
      color: #7c3aed;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e9d5ff;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 10pt;
      margin-bottom: 5px;
    }
    
    .info-label {
      color: #6b7280;
    }
    
    .info-value {
      font-weight: 600;
      color: #111827;
    }
    
    /* Items Table */
    .items-section {
      margin-bottom: 25px;
    }
    
    .section-title {
      font-size: 12pt;
      font-weight: 700;
      color: #1e1b4b;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e9d5ff;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
    }
    
    thead {
      background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
      color: white;
    }
    
    thead th {
      padding: 12px 10px;
      font-weight: 600;
      text-align: center;
    }
    
    tbody tr {
      border-bottom: 1px solid #e5e7eb;
    }
    
    tbody tr:nth-child(even) {
      background: #faf5ff;
    }
    
    tbody td {
      padding: 10px;
      vertical-align: middle;
    }
    
    .text-center {
      text-align: center;
    }
    
    .item-name {
      font-weight: 600;
      color: #111827;
    }
    
    .item-sku {
      font-size: 8pt;
      color: #9ca3af;
      font-family: monospace;
    }
    
    /* Totals Section */
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }
    
    .totals-box {
      width: 280px;
      border: 2px solid #7c3aed;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 15px;
      border-bottom: 1px solid #e9d5ff;
    }
    
    .totals-row:last-child {
      border-bottom: none;
    }
    
    .totals-row.grand-total {
      background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
      color: white;
      font-size: 13pt;
      font-weight: 700;
    }
    
    .totals-label {
      font-weight: 600;
    }
    
    .totals-value {
      font-weight: 700;
    }
    
    /* Notes Section */
    .notes-section {
      background: #faf5ff;
      border: 1px solid #e9d5ff;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 30px;
    }
    
    .notes-title {
      font-size: 10pt;
      font-weight: 700;
      color: #7c3aed;
      margin-bottom: 8px;
    }
    
    .notes-content {
      font-size: 10pt;
      color: #4b5563;
    }
    
    /* Signature Section */
    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px dashed #e5e7eb;
    }
    
    .signature-box {
      text-align: center;
    }
    
    .signature-title {
      font-size: 10pt;
      font-weight: 700;
      color: #374151;
      margin-bottom: 40px;
    }
    
    .signature-line {
      border-top: 1px solid #9ca3af;
      padding-top: 8px;
      font-size: 9pt;
      color: #6b7280;
    }
    
    /* Footer */
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      font-size: 9pt;
      color: #9ca3af;
    }
    
    @media print {
      @page {
        size: A4;
        margin: 10mm;
      }
      
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <header class="header">
      <div class="company-info">
        <div class="company-name">نظام إدارة الأعمال</div>
        <div class="company-details">
          <div>عنوان الشركة - طرابلس، ليبيا</div>
          <div>هاتف: 091-XXXXXXX | البريد: info@company.ly</div>
          <div>الرقم الضريبي: XXXXXXXXXX</div>
        </div>
      </div>
      <div class="document-info">
        <div class="document-title">إشعار دائن ضريبي</div>
        <div class="document-subtitle">TAX CREDIT NOTE</div>
        <div class="document-number">${returnNumber}</div>
      </div>
    </header>
    
    <!-- Info Grid -->
    <div class="info-grid">
      <div class="info-box">
        <div class="info-box-title">بيانات العميل</div>
        <div class="info-row">
          <span class="info-label">الاسم:</span>
          <span class="info-value">${customer?.name || 'عميل نقدي'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">الهاتف:</span>
          <span class="info-value">${customer?.phone || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">الكود:</span>
          <span class="info-value">${customer?.code || '-'}</span>
        </div>
      </div>
      <div class="info-box">
        <div class="info-box-title">بيانات الإشعار</div>
        <div class="info-row">
          <span class="info-label">التاريخ:</span>
          <span class="info-value">${formatDate(salesReturn.date || salesReturn.createdAt)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">الفاتورة الأصلية:</span>
          <span class="info-value">#${invoiceNumber}</span>
        </div>
        <div class="info-row">
          <span class="info-label">المستودع:</span>
          <span class="info-value">${salesReturn.warehouse?.name || '-'}</span>
        </div>
      </div>
    </div>
    
    <!-- Items Table -->
    <div class="items-section">
      <div class="section-title">الأصناف المرتجعة</div>
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th>الصنف</th>
            <th style="width: 70px;">الكمية</th>
            <th style="width: 90px;">سعر الوحدة</th>
            <th style="width: 90px;">المبلغ</th>
            <th style="width: 100px;">السبب</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
    </div>
    
    <!-- Totals -->
    <div class="totals-section">
      <div class="totals-box">
        <div class="totals-row">
          <span class="totals-label">عدد الأصناف:</span>
          <span class="totals-value">${salesReturn.items?.length || 0}</span>
        </div>
        <div class="totals-row grand-total">
          <span class="totals-label">إجمالي المبلغ الدائن:</span>
          <span class="totals-value">${formatCurrency(salesReturn.totalAmount)} د.ل</span>
        </div>
      </div>
    </div>
    
    ${salesReturn.note ? `
    <div class="notes-section">
      <div class="notes-title">ملاحظات</div>
      <div class="notes-content">${salesReturn.note}</div>
    </div>
    ` : ''}
    
    <!-- Signature Section -->
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-title">توقيع المستلم</div>
        <div class="signature-line">الاسم: ___________________</div>
      </div>
      <div class="signature-box">
        <div class="signature-title">التوقيع المعتمد</div>
        <div class="signature-line">${salesReturn.approvedBy?.name || '___________________'}</div>
      </div>
    </div>
    
    <!-- Footer -->
    <footer class="footer">
      <p>هذا الإشعار الدائن يمثل خصماً من رصيد العميل بالمبلغ المذكور أعلاه</p>
      <p>تم الإنشاء بواسطة نظام إدارة الأعمال | ${formatDate(new Date())}</p>
    </footer>
  </div>
</body>
</html>
  `.trim();
}

export {
  generateDashboardPdfHtml,
  generatePdfFromHtml,
  generateCreditNotePdfHtml
};
