import User from '../models/User.js';
import Department from '../models/Department.js';
import bcrypt from 'bcryptjs';

// GET /api/users
export const getUsers = async (req, res) => {
    const { page = 1, limit = 20, q = '' } = req.query;
    const filter = q ? {
        $or: [
            { name: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
            { username: { $regex: q, $options: 'i' } }
        ]
    } : {};

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
        User.find(filter)
            .select('-password')
            .populate({ path: 'department', strictPopulate: false })
            .populate('assignedWarehouse', 'name code')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        User.countDocuments(filter)
    ]);

    res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

// POST /api/users
export const createUser = async (req, res) => {
    let { name, email, username, password, role = 'cashier', department = null, assignedWarehouse = null } = req.body;

    // Sanitize inputs
    name = (name || '').trim();
    email = (email || '').trim().toLowerCase();
    username = (username || '').trim();
    password = (password || '').trim();
    if (!department) department = null;
    if (!assignedWarehouse) assignedWarehouse = null;

    // Custom validation for uniqueness
    const existsEmail = await User.findOne({ email });
    if (existsEmail) return res.status(409).json({ message: 'Email already in use' });

    if (username) {
        const existsUsername = await User.findOne({ username });
        if (existsUsername) return res.status(409).json({ message: 'Username already in use' });
    }

    if (department) {
        const dep = await Department.findById(department);
        if (!dep) return res.status(400).json({ message: 'Invalid department' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, username, password: hash, role, department, assignedWarehouse });

    res.status(201).json({ id: user._id });
};

// PUT /api/users/:id
export const updateUser = async (req, res) => {
    const { name, email, username, role, department, password, assignedWarehouse } = req.body;

    // If password provided, hash it. If not, don't include in update
    let updateData = { ...req.body };
    if (password) {
        updateData.password = await bcrypt.hash(password, 10);
    } else {
        delete updateData.password;
    }

    // Sanitize ObjectId fields: empty string -> null
    if (!updateData.department) updateData.department = null;
    if (!updateData.assignedWarehouse) updateData.assignedWarehouse = null;

    // Ensure username uniqueness if changed
    if (username) {
        const exists = await User.findOne({ username, _id: { $ne: req.params.id } });
        if (exists) return res.status(409).json({ message: 'Username already in use' });
    }
    // Ensure email uniqueness if changed
    if (email) {
        const exists = await User.findOne({ email, _id: { $ne: req.params.id } });
        if (exists) return res.status(409).json({ message: 'Email already in use' });
    }

    if (department) {
        const dep = await Department.findById(department);
        if (!dep) return res.status(400).json({ message: 'Invalid department' });
    }

    const updated = await User.findByIdAndUpdate(req.params.id, updateData, { new: true })
        .select('-password')
        .populate({ path: 'department', strictPopulate: false });

    if (!updated) return res.status(404).json({ message: 'User not found' });
    res.json(updated);
};

// PATCH /api/users/:id/status
export const toggleUserStatus = async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Prevent admin from banning themselves (optional safety)
    if (req.user.id === user._id.toString()) {
        return res.status(400).json({ message: 'Cannot ban yourself' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({ id: user._id, isActive: user.isActive, message: `User ${user.isActive ? 'activated' : 'banned'}` });
};

// DELETE /api/users/:id
export const deleteUser = async (req, res) => {
    const removed = await User.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ message: 'User not found' });
    res.json({ ok: true });
};
