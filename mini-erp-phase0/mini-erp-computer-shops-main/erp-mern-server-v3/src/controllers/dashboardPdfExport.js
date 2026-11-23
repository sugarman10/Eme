/**
 * Export Dashboard as PDF with charts as images
 * POST /api/dashboard/export/pdf
 *
 * Add this function to dashboardController.js at the end (after getDashboardSummary)
 */
export const exportDashboardPdf = async (req, res) => {
  try {
    const { from, to, warehouseId, includeAlerts = true, chartImages = {} } = req.body;

    // 1. Validate date params
    if (!from || !to) {
      return res.status(400).json({ message: 'يجب تحديد تاريخ البداية والنهاية' });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      return res.status(400).json({ message: 'صيغة التاريخ غير صحيحة. استخدم YYYY-MM-DD' });
    }

    if (warehouseId && !mongoose.isValidObjectId(warehouseId)) {
      return res.status(400).json({ message: 'معرف المستودع غير صحيح' });
    }

    // 2. Validate chartImages (base64 + size limits)
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB per image
    const MAX_TOTAL_SIZE = 12 * 1024 * 1024; // 12MB total

    let totalSize = 0;
    const validatedChartImages = {};

    for (const [key, base64Data] of Object.entries(chartImages)) {
      if (!base64Data) continue;

      // Validate base64 format (should be pure base64 without prefix)
      const base64Regex = /^[A-Za-z0-9+/=]+$/;
      if (!base64Regex.test(base64Data)) {
        return res.status(400).json({
          message: `صورة الرسم البياني "${key}" بصيغة غير صحيحة`,
        });
      }

      // Calculate size (base64 is ~4/3 of original size)
      const sizeBytes = Math.ceil((base64Data.length * 3) / 4);

      if (sizeBytes > MAX_IMAGE_SIZE) {
        return res.status(400).json({
          message: `صورة الرسم البياني "${key}" تتجاوز الحد الأقصى (5 ميجابايت)`,
        });
      }

      totalSize += sizeBytes;
      validatedChartImages[key] = base64Data;
    }

    if (totalSize > MAX_TOTAL_SIZE) {
      return res.status(400).json({
        message: `حجم الصور الإجمالي يتجاوز الحد الأقصى (12 ميجابايت)`,
      });
    }

    // 3. Get dashboard data (reuse existing logic from getDashboardSummary)
    const endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(from);
    startDate.setHours(0, 0, 0, 0);
    const duration = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - duration);

    const currentMatch = {
      date: { $gte: startDate, $lte: endDate },
      status: { $nin: ['cancelled', 'void', 'draft'] },
    };
    const prevMatch = {
      date: { $gte: prevStartDate, $lte: prevEndDate },
      status: { $nin: ['cancelled', 'void', 'draft'] },
    };

    if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
      currentMatch.warehouse = new mongoose.Types.ObjectId(warehouseId);
      prevMatch.warehouse = new mongoose.Types.ObjectId(warehouseId);
    }

    // Sales aggregation
    const [currentSales, prevSales] = await Promise.all([
      SalesInvoice.aggregate([
        { $match: currentMatch },
        { $group: { _id: null, total: { $sum: '$totals.grand' }, count: { $sum: 1 } } },
      ]),
      SalesInvoice.aggregate([
        { $match: prevMatch },
        { $group: { _id: null, total: { $sum: '$totals.grand' }, count: { $sum: 1 } } },
      ]),
    ]);

    const salesCurr = currentSales[0] || { total: 0, count: 0 };
    const salesPrev = prevSales[0] || { total: 0, count: 0 };
    const salesTrend = salesPrev.total > 0 ? ((salesCurr.total - salesPrev.total) / salesPrev.total) * 100 : 0;

    // Receipts aggregation
    const receiptsAgg = await Receipt.aggregate([
      { $match: currentMatch },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const receiptsTotal = receiptsAgg[0]?.total || 0;

    // Low stock count
    const lowStockCount = await Item.countDocuments({
      $expr: { $lte: ['$totalStock', '$reorderLevel'] },
      reorderLevel: { $gt: 0 },
    });

    // Aging calculation
    const cutoffDate = new Date(endDate);
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const aging90 = await Customer.aggregate([
      { $match: { balance: { $gt: 0 } } },
      {
        $lookup: {
          from: 'salesinvoices',
          localField: '_id',
          foreignField: 'customer',
          as: 'invoices',
        },
      },
      { $unwind: { path: '$invoices', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          'invoices.date': { $lte: cutoffDate },
          'invoices.totals.remaining': { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalOverdue: { $sum: '$invoices.totals.remaining' },
        },
      },
    ]);
    const totalOverdue90 = aging90[0]?.totalOverdue || 0;

    const kpis = {
      salesRevenue: salesCurr.total,
      salesCount: salesCurr.count,
      receiptsTotal,
      lowStockCount,
    };

    const trends = {
      sales: salesTrend,
    };

    // Alerts (if includeAlerts)
    const alerts = [];
    if (includeAlerts) {
      if (salesTrend < -15) {
        alerts.push({
          severity: 'high',
          title: 'انخفاض المبيعات',
          message: `انخفضت المبيعات بنسبة ${Math.abs(salesTrend).toFixed(1)}% مقارنة بالفترة السابقة`,
        });
      }
      if (totalOverdue90 > 5000) {
        alerts.push({
          severity: 'medium',
          title: 'ديون متأخرة +90 يوم',
          message: `إجمالي الديون المتأخرة: ${totalOverdue90.toLocaleString('ar-LY')} د.ل`,
        });
      }
      if (lowStockCount > 0) {
        alerts.push({
          severity: 'medium',
          title: 'مخزون منخفض',
          message: `${lowStockCount} منتج تحت حد إعادة الطلب`,
        });
      }
    }

    // 4. Prepare metadata
    let warehouseName = 'كل المستودعات';
    if (warehouseId) {
      const Warehouse = mongoose.model('Warehouse');
      const wh = await Warehouse.findById(warehouseId);
      warehouseName = wh?.name || warehouseName;
    }

    const meta = {
      from,
      to,
      warehouseName,
      exportDate: new Date().toLocaleDateString('ar-LY', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      includeAlerts,
    };

    const data = { kpis, trends, alerts };

    // 5. Generate PDF
    const { generateDashboardPdfHtml, generatePdfFromHtml } = await import('../services/pdfService.js');
    const html = generateDashboardPdfHtml(data, meta, validatedChartImages);
    const pdfBuffer = await generatePdfFromHtml(html);

    // 6. Stream PDF response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="dashboard-${from}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF Export Error:', error);
    res.status(500).json({ message: 'حدث خطأ أثناء تصدير PDF' });
  }
};
