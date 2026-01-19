import mongoose from 'mongoose';

const CompanySettingsSchema = new mongoose.Schema({
    // Company Info
    companyName: { type: String, default: 'شركتي' },
    name: { type: String, default: '' }, // Legacy - keep for compatibility
    commercialRegister: { type: String, default: '' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' },
    taxNumber: { type: String, default: '' },
    logo: { type: String, default: '' },
    logoUrl: { type: String, default: '' }, // Legacy

    // Financial
    currency: { type: String, default: 'LYD' },
    defaultCreditLimit: { type: Number, default: 0 },
    invoicePrefix: { type: String, default: 'INV-' },
    purchaseOrderPrefix: { type: String, default: 'PO-' },

    // Print - General
    printTemplate: { type: String, enum: ['a4', 'a5', 'thermal'], default: 'a4' },
    thankYouMessage: { type: String, default: 'شكراً لتعاملكم معنا' },

    // Print - Header (Company Info)
    print_showLogo: { type: Boolean, default: true },
    print_showCompanyName: { type: Boolean, default: true },
    print_showAddress: { type: Boolean, default: true },
    print_showPhone: { type: Boolean, default: true },
    print_showCommercialRegister: { type: Boolean, default: true },
    print_showInvoiceNumber: { type: Boolean, default: true },
    print_showDateTime: { type: Boolean, default: true },

    // Print - Customer Info
    print_showCustomerName: { type: Boolean, default: true },
    print_showCustomerPhone: { type: Boolean, default: true },
    print_showCustomerAddress: { type: Boolean, default: false },

    // Print - Items Table
    print_showRowNumber: { type: Boolean, default: true },
    print_showItemCode: { type: Boolean, default: true },
    print_showItemName: { type: Boolean, default: true },
    print_showQuantity: { type: Boolean, default: true },
    print_showUnitPrice: { type: Boolean, default: true },
    print_showItemTotal: { type: Boolean, default: true },

    // Print - Totals Summary
    print_showSubtotal: { type: Boolean, default: true },
    print_showDiscount: { type: Boolean, default: true },
    print_showPaidAmount: { type: Boolean, default: true },
    print_showRemainingAmount: { type: Boolean, default: true },
    print_showGrandTotal: { type: Boolean, default: true },

    // Print - Footer
    print_showThankYouMessage: { type: Boolean, default: true },
    print_showNotes: { type: Boolean, default: true },

    // System
    fiscalYearStart: { type: Date },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Ensure only one document exists
CompanySettingsSchema.statics.getSettings = async function () {
    const settings = await this.findOne();
    if (settings) return settings;

    return this.create({
        companyName: 'شركتي',
        currency: 'LYD'
    });
};

export default mongoose.model('CompanySettings', CompanySettingsSchema);
