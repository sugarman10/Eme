import express from 'express';
import { body, param, validationResult } from 'express-validator';
import Employee from '../models/Employee.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { wrap } from '../middleware/asyncHandler.js';
import {
  getMonthlyPayroll,
  generatePayroll,
  processPayment,
  updatePayrollSlip,
  getEmployeePayrolls,
  processBulkPayment, // New
} from '../controllers/payrollController.js';
import {
  getLoans,
  createLoanRequest,
  approveLoanRequest,
  waiveLoanRequest,
  postponeLoanRequest,
  deleteLoanRequest,
} from '../controllers/loanController.js';

const router = express.Router();

// --- LOAN ROUTES ---
router.get('/loans', requireAuth(), getLoans);
router.post('/loans', requireAuth(), createLoanRequest);
router.post('/loans/:id/approve', requireAuth(), requireRole(['admin', 'manager']), approveLoanRequest);
router.post('/loans/:id/waive', requireAuth(), requireRole(['admin', 'manager']), waiveLoanRequest);
router.post('/loans/:id/postpone', requireAuth(), requireRole(['admin', 'manager']), postponeLoanRequest);
router.delete('/loans/:id', requireAuth(), requireRole(['admin', 'manager']), deleteLoanRequest);

// --- PAYROLL ROUTES ---
router.get('/employees/:id/payroll', requireAuth(), getEmployeePayrolls);
router.get('/payroll/:month', requireAuth(), requireRole(['admin', 'manager']), getMonthlyPayroll);
router.post('/payroll/generate', requireAuth(), requireRole(['admin', 'manager']), generatePayroll);
router.post('/payroll/pay-all', requireAuth(), requireRole(['admin', 'manager']), processBulkPayment); // New
router.post('/payroll/:id/pay', requireAuth(), requireRole(['admin', 'manager']), processPayment);
router.put('/payroll/:id', requireAuth(), requireRole(['admin', 'manager']), updatePayrollSlip);

// --- EMPLOYEE ROUTES ---

// GET /api/hr/employees
router.get(
  '/employees',
  requireAuth(),
  wrap(async (req, res) => {
    const employees = await Employee.find()
      .populate('user', 'name username role permissions isActive assignedWarehouse')
      .sort({ createdAt: -1 });
    res.json(employees);
  })
);

// POST /api/hr/employees
router.post(
  '/employees',
  requireAuth(),
  requireRole(['admin', 'manager']),
  body('name').isString().notEmpty().withMessage('اسم الموظف مطلوب'),
  body('position').isString().notEmpty().withMessage('المسمى الوظيفي مطلوب'),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      name,
      position,
      phone,
      joinDate,
      salaryDetails,
      hasUserAccount,
      userData,
    } = req.body;

    let createdUserId = null;

    // Create system user account if requested
    if (hasUserAccount && userData) {
      const username = (userData.username || '').trim();
      const password = (userData.password || '').trim();
      const role = userData.role || 'cashier';
      const permissions = Array.isArray(userData.permissions) ? userData.permissions : [];
      const assignedWarehouse = userData.assignedWarehouse || null;

      if (!username || !password) {
        return res.status(400).json({ message: 'اسم المستخدم وكلمة المرور مطلوبة لإنشاء حساب النظام' });
      }

      if (password.length < 4) {
        return res.status(400).json({ message: 'كلمة المرور يجب أن تتكون من 4 خانات على الأقل' });
      }

      // Check username uniqueness
      const existingUser = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
      if (existingUser) {
        return res.status(409).json({ message: 'اسم المستخدم مسجل مسبقاً في النظام' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        name: name.trim(),
        username,
        password: hashedPassword,
        role,
        permissions,
        assignedWarehouse,
        isActive: true,
      });

      createdUserId = user._id;
    }

    const employee = await Employee.create({
      name: name.trim(),
      position: position.trim(),
      phone: phone ? phone.trim() : '',
      joinDate: joinDate || new Date(),
      salaryDetails: {
        baseSalary: Number(salaryDetails?.baseSalary || 0),
        housingAllowance: Number(salaryDetails?.housingAllowance || 0),
        transportAllowance: Number(salaryDetails?.transportAllowance || 0),
      },
      user: createdUserId,
    });

    if (createdUserId) {
      await User.findByIdAndUpdate(createdUserId, { employee: employee._id });
    }

    const result = await Employee.findById(employee._id).populate('user', 'name username role permissions isActive assignedWarehouse');
    res.status(201).json(result);
  })
);

// PUT /api/hr/employees/:id
router.put(
  '/employees/:id',
  requireAuth(),
  requireRole(['admin', 'manager']),
  param('id').isMongoId(),
  wrap(async (req, res) => {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'الموظف غير موجود' });

    const {
      name,
      position,
      phone,
      joinDate,
      salaryDetails,
      hasUserAccount,
      userData,
    } = req.body;

    if (name) employee.name = name.trim();
    if (position) employee.position = position.trim();
    if (phone !== undefined) employee.phone = phone ? phone.trim() : '';
    if (joinDate) employee.joinDate = joinDate;
    if (salaryDetails) {
      employee.salaryDetails = {
        baseSalary: Number(salaryDetails.baseSalary || 0),
        housingAllowance: Number(salaryDetails.housingAllowance || 0),
        transportAllowance: Number(salaryDetails.transportAllowance || 0),
        dailyRate: Number(salaryDetails.dailyRate || 0),
      };
    }

    // Handle User Account
    if (hasUserAccount && userData) {
      const username = (userData.username || '').trim();
      const password = (userData.password || '').trim();
      const role = userData.role || 'cashier';
      const permissions = Array.isArray(userData.permissions) ? userData.permissions : [];
      const assignedWarehouse = userData.assignedWarehouse || null;

      if (employee.user) {
        // Update existing user
        const existingUser = await User.findById(employee.user);
        if (existingUser) {
          if (username && username.toLowerCase() !== existingUser.username.toLowerCase()) {
            const conflict = await User.findOne({
              username: { $regex: new RegExp(`^${username}$`, 'i') },
              _id: { $ne: existingUser._id },
            });
            if (conflict) {
              return res.status(409).json({ message: 'اسم المستخدم مسجل مسبقاً' });
            }
            existingUser.username = username;
          }
          if (password) {
            existingUser.password = await bcrypt.hash(password, 10);
          }
          existingUser.name = employee.name;
          existingUser.role = role;
          existingUser.permissions = permissions;
          existingUser.assignedWarehouse = assignedWarehouse;
          existingUser.isActive = true;
          await existingUser.save();
        }
      } else {
        // Create new user for existing employee
        if (!username || !password) {
          return res.status(400).json({ message: 'اسم المستخدم وكلمة المرور مطلوبة لإنشاء الحساب' });
        }
        const conflict = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        if (conflict) {
          return res.status(409).json({ message: 'اسم المستخدم مسجل مسبقاً' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
          name: employee.name,
          username,
          password: hashedPassword,
          role,
          permissions,
          assignedWarehouse,
          employee: employee._id,
          isActive: true,
        });
        employee.user = newUser._id;
      }
    } else if (hasUserAccount === false && employee.user) {
      // Deactivate user or unlink
      await User.findByIdAndUpdate(employee.user, { isActive: false });
    }

    await employee.save();
    const updated = await Employee.findById(employee._id).populate('user', 'name username role permissions isActive assignedWarehouse');
    res.json(updated);
  })
);

// DELETE /api/hr/employees/:id
router.delete(
  '/employees/:id',
  requireAuth(),
  requireRole(['admin', 'manager']),
  param('id').isMongoId(),
  wrap(async (req, res) => {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    if (employee.user) {
      // Deactivate linked user account
      await User.findByIdAndUpdate(employee.user, { isActive: false });
    }

    await Employee.findByIdAndDelete(req.params.id);
    res.json({ message: 'تم حذف الموظف بنجاح' });
  })
);

export default router;
