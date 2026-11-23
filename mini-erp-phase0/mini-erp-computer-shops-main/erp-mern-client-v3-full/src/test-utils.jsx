import React from 'react'
import { render } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import { WarehouseProvider } from './context/WarehouseContext'

const createTestQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
})

export function renderWithProviders(ui) {
    const queryClient = createTestQueryClient()

    return render(
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <SettingsProvider>
                    <WarehouseProvider>
                        <ToastProvider>
                            <BrowserRouter>
                                {ui}
                            </BrowserRouter>
                        </ToastProvider>
                    </WarehouseProvider>
                </SettingsProvider>
            </AuthProvider>
        </QueryClientProvider>
    )
}
