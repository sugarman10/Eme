import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import App from './App.jsx'
import './styles/index.css'
import ToastProvider from './context/ToastContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { WarehouseProvider } from './context/WarehouseContext.jsx'
import { FiscalPeriodProvider } from './context/FiscalPeriodContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <WarehouseProvider>
            <FiscalPeriodProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </FiscalPeriodProvider>
          </WarehouseProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)

