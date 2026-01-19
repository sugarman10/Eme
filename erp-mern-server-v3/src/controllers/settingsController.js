import CompanySettings from '../models/CompanySettings.js';

// Get Settings (Lazy init)
export const getSettings = async (req, res) => {
    try {
        const settings = await CompanySettings.getSettings();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update Settings
export const updateSettings = async (req, res) => {
    try {
        const settings = await CompanySettings.getSettings();

        // All supported fields
        const fields = [
            // Company Info
            'companyName', 'name', 'commercialRegister', 'address', 'phone',
            'email', 'website', 'taxNumber', 'logo', 'logoUrl',

            // Financial
            'currency', 'defaultCreditLimit', 'invoicePrefix', 'purchaseOrderPrefix',

            // Print - General
            'printTemplate', 'thankYouMessage',

            // Print - Header
            'print_showLogo', 'print_showCompanyName', 'print_showAddress',
            'print_showPhone', 'print_showCommercialRegister',
            'print_showInvoiceNumber', 'print_showDateTime',

            // Print - Customer
            'print_showCustomerName', 'print_showCustomerPhone', 'print_showCustomerAddress',

            // Print - Items Table
            'print_showRowNumber', 'print_showItemCode', 'print_showItemName',
            'print_showQuantity', 'print_showUnitPrice', 'print_showItemTotal',

            // Print - Totals
            'print_showSubtotal', 'print_showDiscount', 'print_showPaidAmount',
            'print_showRemainingAmount', 'print_showGrandTotal',

            // Print - Footer
            'print_showThankYouMessage', 'print_showNotes',

            // System
            'fiscalYearStart', 'dateFormat'
        ];

        fields.forEach(field => {
            if (req.body[field] !== undefined) {
                settings[field] = req.body[field];
            }
        });

        // Handle legacy field mapping
        if (req.body.companyName && !req.body.name) {
            settings.name = req.body.companyName;
        }

        settings.updatedBy = req.user._id;
        await settings.save();

        res.json(settings);
    } catch (error) {
        console.error('Settings update error:', error);
        res.status(500).json({ message: error.message });
    }
};
