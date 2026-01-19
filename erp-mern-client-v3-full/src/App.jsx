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
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders.jsx'))
const Customers = lazy(() => import('./pages/Customers.jsx'))
const CustomerDetails = lazy(() => import('./pages/CustomerDetails.jsx'))
const Accounts = lazy(() => import('./pages/Accounts.jsx'))
const Journals = lazy(() => import('./pages/Journals.jsx'))
const StockBalancesAll = lazy(() => import('./pages/StockBalancesAll.jsx'))
// const SalesInvoiceNew = lazy(() => import('./pages/SalesInvoiceNew.jsx'))
const SalesInvoices = lazy(() => import('./pages/SalesInvoices.jsx'))
const StockMovements = lazy(() => import('./pages/StockMovements.jsx'))
const CustomerReceipts = lazy(() => import('./pages/CustomerReceipts.jsx'))
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
                  <Route index element={<Dashboard />} />
                  <Route path="departments" element={<Departments />} />
                  <Route path="users" element={<Users />} />
                  <Route path="items" element={<Items />} />
                  <Route path="warehouses" element={<Warehouses />} />
                  <Route path="suppliers" element={<Suppliers />} />
                  <Route path="purchase-returns" element={<PurchaseReturns />} />
                  <Route path="sales-returns" element={<SalesReturns />} />
                  <Route path="purchase-orders" element={<PurchaseOrders />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="customers/:id" element={<CustomerDetails />} />
                  <Route path="accounts" element={<Accounts />} />
                  <Route path="journals" element={<Journals />} />

                  <Route path="stock-balances" element={<StockBalancesAll />} />
                  <Route path="sales-daily" element={<SalesDaily />} />
                  <Route path="pos" element={<PosSales />} />
                  {/* <Route path="sales-invoice-new" element={<SalesInvoiceNew />} /> */}
                  <Route path="sales-invoices" element={<SalesInvoices />} />
                  <Route path="stock-movements" element={<StockMovements />} />
                  <Route path="customer-receipts" element={<CustomerReceipts />} />
                  <Route path="supplier-payments" element={<SupplierPayments />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="financial-reports" element={<FinancialReports />} />
                  <Route path="employees" element={<Employees />} />
                  <Route path="employees/:id" element={<EmployeeDetails />} />
                  <Route path="payroll" element={<Payroll />} />
                  <Route path="loans" element={<Loans />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="treasuries" element={<Treasuries />} />
                  <Route path="stock-transfer" element={<StockTransfer />} />
                  <Route path="daily-closures" element={<DailyClosures />} />

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
