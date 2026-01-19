import express from 'express'
import { body, param, validationResult } from 'express-validator'
import { requireAuth } from '../middleware/auth.js'
import { wrap } from '../middleware/asyncHandler.js'
import Notification from '../models/Notification.js'

const router = express.Router()

// Get unread/recent notifications
router.get('/', requireAuth(), wrap(async (req, res) => {
    const limit = parseInt(req.query.limit) || 20
    // For now, fetch all notifications for 'admin' or general ones. 
    // In a real app, filter by req.user.id or role.
    const notifications = await Notification.find({
        $or: [{ recipient: 'admin' }, { recipient: req.user.id }]
    })
        .sort({ createdAt: -1 })
        .limit(limit)

    const unreadCount = await Notification.countDocuments({
        $or: [{ recipient: 'admin' }, { recipient: req.user.id }],
        read: false
    })

    res.json({ notifications, unreadCount })
}))

// Mark as read
router.put('/:id/read', requireAuth(), param('id').isMongoId(), wrap(async (req, res) => {
    const notification = await Notification.findByIdAndUpdate(
        req.params.id,
        { read: true },
        { new: true }
    )
    res.json(notification)
}))

// Mark all as read
router.put('/read-all', requireAuth(), wrap(async (req, res) => {
    await Notification.updateMany(
        { $or: [{ recipient: 'admin' }, { recipient: req.user.id }], read: false },
        { read: true }
    )
    res.json({ message: 'All marked as read' })
}))

export default router
