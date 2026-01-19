import express from 'express'
import { body, param, validationResult } from 'express-validator'
import Employee from '../models/Employee.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { wrap } from '../middleware/asyncHandler.js'
import { getMonthlyPayroll, generatePayroll, processPayment, updatePayrollSlip, getEmployeePayrolls } from '../controllers/payrollController.js'
import { getLoans, createLoanRequest, approveLoanRequest, deleteLoanRequest } from '../controllers/loanController.js'

const router = express.Router()

// --- LOAN ROUTES ---
router.get('/loans', requireAuth(), getLoans)
router.post('/loans', requireAuth(), createLoanRequest) // Loans can be requested by employees? Assuming yes, or restrict? "Sensitive routes" usually means approve/delete.
router.post('/loans/:id/approve', requireAuth(), requireRole(['admin', 'manager']), approveLoanRequest)
router.delete('/loans/:id', requireAuth(), requireRole(['admin', 'manager']), deleteLoanRequest)

// --- PAYROLL ROUTES ---
router.get('/employees/:id/payroll', requireAuth(), getEmployeePayrolls)
router.get('/payroll/:month', requireAuth(), requireRole(['admin', 'manager']), getMonthlyPayroll)
router.post('/payroll/generate', requireAuth(), requireRole(['admin', 'manager']), generatePayroll)
router.post('/payroll/:id/pay', requireAuth(), requireRole(['admin', 'manager']), processPayment)
router.put('/payroll/:id', requireAuth(), requireRole(['admin', 'manager']), updatePayrollSlip)

// --- EMPLOYEE ROUTES ---

// GET /api/hr/employees
router.get('/employees',
    requireAuth(),
    wrap(async (req, res) => {
        const employees = await Employee.find().sort({ createdAt: -1 })
        res.json(employees)
    })
)

// POST /api/hr/employees
router.post('/employees',
    requireAuth(),
    requireRole(['admin', 'manager']),
    body('name').isString().notEmpty(),
    body('position').isString().notEmpty(),
    // body('salary').isNumeric(), // Removed to support salaryDetails structure
    wrap(async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

        const employee = await Employee.create(req.body)
        res.status(201).json(employee)
    })
)

// PUT /api/hr/employees/:id
router.put('/employees/:id',
    requireAuth(),
    requireRole(['admin', 'manager']),
    param('id').isMongoId(),
    wrap(async (req, res) => {
        const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true })
        if (!employee) return res.status(404).json({ message: 'Employee not found' })
        res.json(employee)
    })
)

// DELETE /api/hr/employees/:id
router.delete('/employees/:id',
    requireAuth(),
    requireRole(['admin', 'manager']),
    param('id').isMongoId(),
    wrap(async (req, res) => {
        const employee = await Employee.findByIdAndDelete(req.params.id)
        if (!employee) return res.status(404).json({ message: 'Employee not found' })
        res.json({ message: 'Employee deleted' })
    })
)

export default router
