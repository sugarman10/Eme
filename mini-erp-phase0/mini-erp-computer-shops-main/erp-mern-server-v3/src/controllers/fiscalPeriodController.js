import FiscalPeriod from '../models/FiscalPeriod.js';
import { auditCreate, auditUpdate } from '../services/auditService.js';

export const getFiscalPeriods = async (req, res) => {
    try {
        const periods = await FiscalPeriod.find()
            .sort({ startDate: -1 })
            .populate('closedBy', 'name')
            .populate('reopenedBy', 'name');
        res.json(periods);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createFiscalPeriod = async (req, res) => {
    try {
        const { name, startDate, endDate, note } = req.body;

        // Check for overlap
        const start = new Date(startDate);
        const end = new Date(endDate);

        const overlap = await FiscalPeriod.findOne({
            $or: [
                { startDate: { $lte: end }, endDate: { $gte: start } }
            ]
        });

        if (overlap) {
            return res.status(400).json({
                message: `الفترة تتداخل مع فترة موجودة مسبقاً: ${overlap.name}`
            });
        }

        const period = await FiscalPeriod.create({
            name,
            startDate: start,
            endDate: end,
            note
        });

        await auditCreate('FISCAL_PERIOD', period, req.user, req.ip);
        res.status(201).json(period);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const closeFiscalPeriod = async (req, res) => {
    try {
        const { id } = req.params;
        const period = await FiscalPeriod.findById(id);

        if (!period) return res.status(404).json({ message: 'الفترة غير موجودة' });
        if (period.isClosed) return res.status(400).json({ message: 'الفترة مغلقة بالفعل' });

        const before = period.toObject();

        period.isClosed = true;
        period.closedAt = new Date();
        period.closedBy = req.user._id;

        await period.save();
        await auditUpdate('FISCAL_PERIOD', period._id, before, period, req.user, req.ip, null, { action: 'CLOSE' });

        res.json(period);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const reopenFiscalPeriod = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) return res.status(400).json({ message: 'سبب إعادة الفتح مطلوب' });

        const period = await FiscalPeriod.findById(id);
        if (!period) return res.status(404).json({ message: 'الفترة غير موجودة' });
        if (!period.isClosed) return res.status(400).json({ message: 'الفترة مفتوحة بالفعل' });

        const before = period.toObject();

        period.isClosed = false;
        period.reopenedAt = new Date();
        period.reopenedBy = req.user._id;
        period.note = (period.note || '') + `\nReopened: ${reason}`;

        await period.save();
        await auditUpdate('FISCAL_PERIOD', period._id, before, period, req.user, req.ip, null, { action: 'REOPEN', reason });

        res.json(period);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
