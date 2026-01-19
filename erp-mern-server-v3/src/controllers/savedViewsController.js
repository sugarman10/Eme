import SavedView from '../models/SavedView.js';

/**
 * Create a new saved view (filter)
 * POST /api/dashboard/views
 */
export const createSavedView = async (req, res) => {
    try {
        const { name, params } = req.body;
        const userId = req.user._id;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'اسم الفلتر مطلوب' });
        }

        const savedView = await SavedView.create({
            userId,
            name: name.trim(),
            type: 'DASHBOARD',
            params: {
                from: params?.from,
                to: params?.to,
                warehouseId: params?.warehouseId,
                comparePrevious: params?.comparePrevious || false
            }
        });

        res.status(201).json(savedView);
    } catch (error) {
        console.error('Create Saved View Error:', error);
        res.status(500).json({ message: 'فشل حفظ الفلتر' });
    }
};

/**
 * Get all saved views for current user
 * GET /api/dashboard/views
 */
export const getSavedViews = async (req, res) => {
    try {
        const userId = req.user._id;

        const savedViews = await SavedView.find({ userId, type: 'DASHBOARD' })
            .sort({ createdAt: -1 })
            .select('name params createdAt');

        res.json(savedViews);
    } catch (error) {
        console.error('Get Saved Views Error:', error);
        res.status(500).json({ message: 'فشل تحميل الفلاتر المحفوظة' });
    }
};

/**
 * Delete a saved view
 * DELETE /api/dashboard/views/:id
 */
export const deleteSavedView = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const savedView = await SavedView.findOne({ _id: id, userId });

        if (!savedView) {
            return res.status(404).json({ message: 'الفلتر غير موجود' });
        }

        await savedView.deleteOne();

        res.json({ message: 'تم حذف الفلتر بنجاح' });
    } catch (error) {
        console.error('Delete Saved View Error:', error);
        res.status(500).json({ message: 'فشل حذف الفلتر' });
    }
};
