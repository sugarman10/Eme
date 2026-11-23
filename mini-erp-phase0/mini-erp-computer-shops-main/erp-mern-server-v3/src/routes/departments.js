import express from 'express';
import { body, param, validationResult } from 'express-validator';
import Department from '../models/Department.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { wrap } from '../middleware/asyncHandler.js';

const router = express.Router();

router.post(
  '/',
  requireAuth(['admin', 'manager']),
  requireRole(['admin', 'manager']),
  body('name').isString().isLength({ min: 2 }).trim(),
  body('description').optional().isString(),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, description } = req.body;
    const exists = await Department.findOne({ name });
    if (exists) return res.status(409).json({ message: 'Department already exists' });
    const dep = await Department.create({ name, description });
    res.status(201).json(dep);
  })
);

router.get(
  '/',
  requireAuth(),
  wrap(async (req, res) => {
    const { page = 1, limit = 20, q = '' } = req.query;
    const filter = q ? { name: { $regex: q, $options: 'i' } } : {};
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Department.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Department.countDocuments(filter),
    ]);
    res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  })
);

router.get(
  '/:id',
  requireAuth(),
  param('id').isMongoId(),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const dep = await Department.findById(req.params.id);
    if (!dep) return res.status(404).json({ message: 'Not found' });
    res.json(dep);
  })
);

router.put(
  '/:id',
  requireAuth(['admin', 'manager']),
  requireRole(['admin', 'manager']),
  param('id').isMongoId(),
  body('name').optional().isString().isLength({ min: 2 }).trim(),
  body('description').optional().isString(),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const dep = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!dep) return res.status(404).json({ message: 'Not found' });
    res.json(dep);
  })
);

router.delete(
  '/:id',
  requireAuth(['admin']),
  requireRole(['admin']),
  param('id').isMongoId(),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const dep = await Department.findByIdAndDelete(req.params.id);
    if (!dep) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  })
);

export default router;
