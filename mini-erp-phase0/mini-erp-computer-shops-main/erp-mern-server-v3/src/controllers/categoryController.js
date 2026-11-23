import Category from '../models/Category.js';
import Item from '../models/Item.js';
import mongoose from 'mongoose';

/**
 * GET /api/inventory/categories
 * جلب جميع التصنيفات مع إحصائية عدد الأصناف المرتبطة بكل تصنيف
 */
export const getCategories = async (req, res) => {
  try {
    const { type, active } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (active === 'true') filter.isActive = true;

    const categories = await Category.find(filter).sort({ name: 1 }).lean();

    // جلب عدد الأصناف لكل تصنيف
    const counts = await Item.aggregate([
      { $match: { category: { $ne: null } } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const countMap = {};
    counts.forEach(c => {
      countMap[c._id.toString()] = c.count;
    });

    const enriched = categories.map(cat => ({
      ...cat,
      itemCount: countMap[cat._id.toString()] || 0
    }));

    res.json(enriched);
  } catch (error) {
    console.error('getCategories error:', error);
    res.status(500).json({ message: 'فشل جلب التصنيفات', error: error.message });
  }
};

/**
 * POST /api/inventory/categories
 * إنشاء تصنيف جديد
 */
export const createCategory = async (req, res) => {
  try {
    let { name, description = '', type = 'general', icon = '' } = req.body;
    name = (name || '').trim();

    if (!name) {
      return res.status(400).json({ message: 'اسم التصنيف مطلوب' });
    }

    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ message: 'هذا التصنيف موجود بالفعل', category: existing });
    }

    const category = await Category.create({
      name,
      description: (description || '').trim(),
      type: ['general', 'pc_builder'].includes(type) ? type : 'general',
      icon: (icon || '').trim(),
      isActive: true
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('createCategory error:', error);
    res.status(500).json({ message: 'فشل إنشاء التصنيف', error: error.message });
  }
};

/**
 * PUT /api/inventory/categories/:id
 * تعديل تصنيف
 */
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    let { name, description, type, icon, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'معرف التصنيف غير صالح' });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'التصنيف غير موجود' });
    }

    if (name !== undefined) {
      name = name.trim();
      if (!name) {
        return res.status(400).json({ message: 'اسم التصنيف مطلوب' });
      }

      // تأكد من عدم التكرار مع تصنيف آخر
      const duplicate = await Category.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name}$`, 'i') }
      });
      if (duplicate) {
        return res.status(400).json({ message: 'يوجد تصنيف آخر بنفس الاسم' });
      }

      category.name = name;
    }

    if (description !== undefined) category.description = description.trim();
    if (type !== undefined && ['general', 'pc_builder'].includes(type)) category.type = type;
    if (icon !== undefined) category.icon = icon.trim();
    if (isActive !== undefined) category.isActive = Boolean(isActive);

    await category.save();
    res.json(category);
  } catch (error) {
    console.error('updateCategory error:', error);
    res.status(500).json({ message: 'فشل تعديل التصنيف', error: error.message });
  }
};

/**
 * DELETE /api/inventory/categories/:id
 * حذف تصنيف وفك ارتباطه بأمان عن الأصناف
 */
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'معرف التصنيف غير صالح' });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: 'التصنيف غير موجود' });
    }

    // فك ارتباط الأصناف التابعة لهذا التصنيف
    await Item.updateMany({ category: id }, { $set: { category: null } });

    await Category.findByIdAndDelete(id);

    res.json({ message: 'تم حذف التصنيف بنجاح وتحديث الأصناف المرتبطة به' });
  } catch (error) {
    console.error('deleteCategory error:', error);
    res.status(500).json({ message: 'فشل حذف التصنيف', error: error.message });
  }
};
