import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'

// Lazy Load Pages
const SalesDaily = lazy(() => import('./pages/SalesDaily.jsx'))
const PosSales = lazy(() => import('./pages/PosSales.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Departments = lazy(() => import('./pages/Departments.jsx'))
const Users = lazy(() => import('./pages/Users.jsx'))
const Items = lazy(() => import('./pages/Items.jsx'))
const Warehouses = lazy(() => import('./pages/Warehouses.jsx'))
const Suppliers = lazy(() => import('./pages/Suppliers.jsx'))
const PurchaseReturns = lazy(() => import('./pages/PurchaseReturns.jsx'))
const SalesReturns = lazy(() => import('./pages/SalesReturns.jsx'))
const PosReturnSales = lazy(() => import('./pages/PosReturnSales.jsx'))
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders.jsx'))
const PurchaseInvoiceView = lazy(() => import('./pages/PurchaseInvoiceView.jsx'))
const Customers = lazy(() => import('./pages/Customers.jsx'))
const CustomerDetails = lazy(() => import('./pages/CustomerDetails.jsx'))
const Accounts = lazy(() => import('./pages/Accounts.jsx'))
const Journals = lazy(() => import('./pages/Journals.jsx'))
const StockBalancesAll = lazy(() => import('./pages/StockBalancesAll.jsx'))
const SalesInvoices = lazy(() => import('./pages/SalesInvoices.jsx'))
const Quotations = lazy(() => import('./pages/Quotations.jsx'))
const StockMovements = lazy(() => import('./pages/StockMovements.jsx'))
const CustomerReceipts = lazy(() => import('./pages/CustomerReceipts.jsx'))
const PaymentVouchers = lazy(() => import('./pages/PaymentVouchers.jsx'))
const SupplierPayments = lazy(() => import('./pages/SupplierPayments.jsx'))
const Reports = lazy(() => import('./pages/Reports.jsx'))
const Employees = lazy(() => import('./pages/Employees.jsx'))
const EmployeeDetails = lazy(() => import('./pages/EmployeeDetails.jsx'))
const Payroll = lazy(() => import('./pages/Payroll.jsx'))
const Loans = lazy(() => import('./pages/Loans.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const Treasuries = lazy(() => import('./pages/Treasuries.jsx'))
const StockTransfer = lazy(() => import('./pages/StockTransfer.jsx'))
const DailyClosures = lazy(() => import('./pages/DailyClosures.jsx'))
const FinancialReports = lazy(() => import('./pages/FinancialReports.jsx'))
const Expenses = lazy(() => import('./pages/Expenses.jsx'))
const ExpenseCategories = lazy(() => import('./pages/ExpenseCategories.jsx'))
const FiscalPeriods = lazy(() => import('./pages/finance/FiscalPeriods.jsx'))
const TrialBalance = lazy(() => import('./pages/TrialBalance.jsx'))

// Loading Component
const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
)

import { SocketProvider } from './context/SocketContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { SettingsProvider } from './context/SettingsContext.jsx'

export default function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <div className="min-h-screen">
          <SocketProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* صفحة الدخول غير محمية */}
                <Route path="/login" element={<Login />} />

                {/* كل شيء داخل Layout محمي بالـ token */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route
                    index
                    element={
                      <ProtectedRoute roles={['admin']} fallbackTo="/pos">
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="departments" element={<ProtectedRoute perm="users_manage"><Departments /></ProtectedRoute>} />
                  <Route path="users" element={<ProtectedRoute roles={['admin']} perm="users_manage"><Users /></ProtectedRoute>} />
                  <Route path="items" element={<ProtectedRoute perm="items_manage"><Items /></ProtectedRoute>} />
                  <Route path="warehouses" element={<ProtectedRoute perm="warehouses_manage"><Warehouses /></ProtectedRoute>} />
                  <Route path="suppliers" element={<ProtectedRoute perm="suppliers_manage"><Suppliers /></ProtectedRoute>} />
                  <Route path="purchase-returns" element={<ProtectedRoute perm="purchases_returns"><PurchaseReturns /></ProtectedRoute>} />
                  <Route path="sales-returns" element={<ProtectedRoute perm="sales_returns"><SalesReturns /></ProtectedRoute>} />
                  <Route path="pos-return" element={<ProtectedRoute perm="sales_returns"><PosReturnSales /></ProtectedRoute>} />
                  <Route path="pos-returns" element={<Navigate to="/pos-return" replace />} />
                  <Route path="purchase-orders" element={<ProtectedRoute perm="purchases_view"><PurchaseOrders /></ProtectedRoute>} />
                  <Route path="purchase-invoice" element={<ProtectedRoute perm="purchases_create"><PurchaseInvoiceView /></ProtectedRoute>} />
                  <Route path="customers" element={<ProtectedRoute perm="customers_manage"><Customers /></ProtectedRoute>} />
                  <Route path="customers/:id" element={<ProtectedRoute perm="customers_manage"><CustomerDetails /></ProtectedRoute>} />
                  <Route path="accounts" element={<ProtectedRoute perm="coa_manage"><Accounts /></ProtectedRoute>} />
                  <Route path="journals" element={<ProtectedRoute perm="journals_manage"><Journals /></ProtectedRoute>} />

                  <Route path="stock-balances" element={<ProtectedRoute perm="inventory_view"><StockBalancesAll /></ProtectedRoute>} />
                  <Route path="sales-daily" element={<ProtectedRoute perm="sales_invoices_view"><SalesDaily /></ProtectedRoute>} />
                  <Route path="pos" element={<ProtectedRoute perm="pos_access"><PosSales /></ProtectedRoute>} />
                  <Route path="quotations" element={<ProtectedRoute perm="sales_invoices_view"><Quotations /></ProtectedRoute>} />
                  <Route path="proforma-invoices" element={<Navigate to="/quotations" replace />} />
                  {/* <Route path="sales-invoice-new" element={<SalesInvoiceNew />} /> */}
                  <Route path="sales-invoices" element={<Navigate to="/pos" replace />} />
                  <Route path="stock-movements" element={<ProtectedRoute perm="inventory_view"><StockMovements /></ProtectedRoute>} />
                  <Route path="customer-receipts" element={<ProtectedRoute perm="payment_vouchers"><CustomerReceipts /></ProtectedRoute>} />
                  <Route path="payment-vouchers" element={<ProtectedRoute perm="payment_vouchers"><PaymentVouchers /></ProtectedRoute>} />
                  <Route path="supplier-payments" element={<ProtectedRoute perm="supplier_payments"><SupplierPayments /></ProtectedRoute>} />
                  <Route path="reports" element={<ProtectedRoute roles={['admin']} fallbackTo="/pos"><Reports /></ProtectedRoute>} />
                  <Route path="financial-reports" element={<ProtectedRoute perm="financial_reports"><FinancialReports /></ProtectedRoute>} />
                  <Route path="employees" element={<ProtectedRoute perm="hr_employees_manage"><Employees /></ProtectedRoute>} />
                  <Route path="employees/:id" element={<ProtectedRoute perm="hr_employees_manage"><EmployeeDetails /></ProtectedRoute>} />
                  <Route path="payroll" element={<ProtectedRoute perm="hr_payroll_manage"><Payroll /></ProtectedRoute>} />
                  <Route path="loans" element={<ProtectedRoute perm="hr_loans_manage"><Loans /></ProtectedRoute>} />
                  <Route path="settings" element={<ProtectedRoute roles={['admin']} perm="settings_manage"><Settings /></ProtectedRoute>} />
                  <Route path="treasuries" element={<ProtectedRoute perm="treasury_view"><Treasuries /></ProtectedRoute>} />
                  <Route path="stock-transfer" element={<ProtectedRoute perm="inventory_transfer"><StockTransfer /></ProtectedRoute>} />
                  <Route path="daily-closures" element={<ProtectedRoute perm="daily_closures"><DailyClosures /></ProtectedRoute>} />
                  <Route path="expenses" element={<ProtectedRoute perm="expenses_manage"><Expenses /></ProtectedRoute>} />
                  <Route path="expense-categories" element={<ProtectedRoute perm="expenses_manage"><ExpenseCategories /></ProtectedRoute>} />
                  <Route path="fiscal-periods" element={<ProtectedRoute perm="fiscal_period_switch"><FiscalPeriods /></ProtectedRoute>} />
                  <Route path="trial-balance" element={<ProtectedRoute perm="financial_reports"><TrialBalance /></ProtectedRoute>} />

                </Route>

                {/* أي مسار غير معروف */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </SocketProvider>
        </div>
      </SettingsProvider>
    </ThemeProvider>
  )
}
