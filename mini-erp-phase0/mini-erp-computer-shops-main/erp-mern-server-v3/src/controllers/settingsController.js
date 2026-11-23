import CompanySettings from '../models/CompanySettings.js';
import User from '../models/User.js';
import Item from '../models/Item.js';
import { getOrgTaxRate } from '../services/settingService.js';

// Get Settings (Lazy init)
export const getSettings = async (req, res) => {
  try {
    const [settings, taxRate] = await Promise.all([
      CompanySettings.getSettings(),
      getOrgTaxRate(),
    ]);
    const payload = settings.toObject ? settings.toObject() : { ...settings };
    payload.taxRate = Number(payload.taxRate ?? taxRate ?? 0);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Settings
export const updateSettings = async (req, res) => {
  try {
    const settings = await CompanySettings.getSettings();

    // 1. Permission check for USD exchange rate modification
    if (req.body.usdExchangeRate !== undefined) {
      let userRole = req.user?.role;
      let userPerms = req.user?.permissions || [];

      if (req.user?.id && (!userPerms || userPerms.length === 0)) {
        const dbUser = await User.findById(req.user.id).select('permissions role');
        if (dbUser) {
          userRole = dbUser.role || userRole;
          userPerms = dbUser.permissions || [];
        }
      }

      const canEditExchange = userRole === 'admin' || userPerms.includes('exchange_rate_manage') || userPerms.includes('*');
      if (!canEditExchange) {
        return res.status(403).json({
          message: 'عذراً، تعديل سعر الصرف يتطلب منحك صلاحية تعديل سعر الصرف من قبل مدير النظام',
          code: 'FORBIDDEN_EXCHANGE_RATE'
        });
      }
    }

    // 2. Permission check for core company settings
    const coreCompanyFields = ['companyName', 'name', 'commercialRegister', 'taxNumber', 'logo', 'logoUrl', 'fiscalYearStart', 'currency', 'defaultCreditLimit'];
    const touchesCore = coreCompanyFields.some(f => req.body[f] !== undefined);
    if (touchesCore && req.user?.role !== 'admin' && req.user?.role !== 'manager') {
      return res.status(403).json({
        message: 'عذراً، تعديل بيانات الشركة الأساسية متاح للمدير العام فقط',
        code: 'FORBIDDEN_COMPANY_SETTINGS'
      });
    }

    // All supported fields
    const fields = [
      // Company Info
      'companyName',
      'name',
      'commercialRegister',
      'address',
      'phone',
      'email',
      'website',
      'taxNumber',
      'logo',
      'logoUrl',

      // Financial & Multi-Currency
      'currency',
      'usdExchangeRate',
      'enableSmartRounding',
      'exchangeRateUpdatedAt',
      'defaultCreditLimit',
      'invoicePrefix',
      'purchaseOrderPrefix',

      // Print - General
      'printTemplate',
      'thankYouMessage',

      // Print - Header
      'print_showLogo',
      'print_showCompanyName',
      'print_showAddress',
      'print_showPhone',
      'print_showEmail',
      'print_showWebsite',
      'print_showCommercialRegister',
      'print_showInvoiceNumber',
      'print_showDateTime',

      // Print - Customer
      'print_showCustomerName',
      'print_showCustomerPhone',
      'print_showCustomerAddress',

      // Print - Items Table
      'print_showRowNumber',
      'print_showItemCode',
      'print_showItemName',
      'print_showQuantity',
      'print_showUnitPrice',
      'print_showItemTotal',

      // Print - Totals
      'print_showSubtotal',
      'print_showDiscount',
      'print_showPaidAmount',
      'print_showRemainingAmount',
      'print_showGrandTotal',

      // Print - Footer
      'print_showThankYouMessage',
      'print_showNotes',

      // System
      'fiscalYearStart',
      'dateFormat',
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        settings[field] = req.body[field];
      }
    });

    // Handle legacy field mapping
    if (req.body.companyName && !req.body.name) {
      settings.name = req.body.companyName;
    }

    let updatedItemCount = 0;
    if (req.body.usdExchangeRate !== undefined) {
      const newRate = Number(req.body.usdExchangeRate);
      if (newRate > 0) {
        settings.usdExchangeRate = newRate;
        settings.exchangeRateUpdatedAt = new Date();

        // 🚀 Automatically recalculate and update all items priced in USD in MongoDB
        try {
          const updateResult = await Item.updateMany(
            {
              $or: [
                { pricingCurrency: 'USD' },
                { priceUSD: { $gt: 0 } }
              ]
            },
            [
              {
                $set: {
                  price: {
                    $cond: [
                      { $gt: ['$priceUSD', 0] },
                      { $round: [{ $multiply: ['$priceUSD', newRate] }, 2] },
                      '$price'
                    ]
                  },
                  cost: {
                    $cond: [
                      { $gt: ['$costUSD', 0] },
                      { $round: [{ $multiply: ['$costUSD', newRate] }, 2] },
                      '$cost'
                    ]
                  },
                  wholesalePrice: {
                    $cond: [
                      { $gt: ['$wholesalePriceUSD', 0] },
                      { $round: [{ $multiply: ['$wholesalePriceUSD', newRate] }, 2] },
                      '$wholesalePrice'
                    ]
                  },
                  minPrice: {
                    $cond: [
                      { $gt: ['$minPriceUSD', 0] },
                      { $round: [{ $multiply: ['$minPriceUSD', newRate] }, 2] },
                      '$minPrice'
                    ]
                  },
                  maxPrice: {
                    $cond: [
                      { $gt: ['$maxPriceUSD', 0] },
                      { $round: [{ $multiply: ['$maxPriceUSD', newRate] }, 2] },
                      '$maxPrice'
                    ]
                  }
                }
              }
            ]
          );
          updatedItemCount = updateResult?.modifiedCount || 0;
        } catch (itemErr) {
          console.error('Failed to update USD items on exchange rate change:', itemErr);
        }
      }
    }

    settings.updatedBy = req.user?._id || req.user?.id || settings.updatedBy;
    await settings.save();

    // Broadcast exchange rate update via socket.io if available
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('exchange_rate_updated', {
          usdExchangeRate: settings.usdExchangeRate,
          enableSmartRounding: settings.enableSmartRounding,
          updatedAt: settings.exchangeRateUpdatedAt,
          updatedItemCount,
        });
        io.emit('stock:update'); // triggers inventory refresh on all active screens
      }
    } catch (e) {
      // Non-critical socket notification
    }

    res.json({
      ...settings.toObject(),
      updatedItemCount,
    });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ message: error.message });
  }
};
