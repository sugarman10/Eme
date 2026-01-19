import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import SalesInvoices from '../SalesInvoices'
import { renderWithProviders } from '../../test-utils'
import api from '../../services/api'

vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        put: vi.fn()
    }
}))

describe('Sales Invoices Page', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders invoices list', async () => {
        const mockInvoices = [
            {
                _id: '1',
                number: 'INV-001',
                customer: { name: 'عميل 1' },
                date: new Date().toISOString(),
                totals: { grand: 1000 },
                status: 'posted'
            }
        ]

        // Mock multiple calls (invoices, warehouses)
        api.get.mockImplementation((url) => {
            if (url === '/sales/invoice') return Promise.resolve({ data: mockInvoices })
            if (url === '/inventory/warehouses') return Promise.resolve({ data: [] })
            return Promise.resolve({ data: [] })
        })

        renderWithProviders(<SalesInvoices />)

        expect(screen.getByText('فواتير المبيعات')).toBeInTheDocument()

        await waitFor(() => {
            expect(screen.getByText('#INV-001')).toBeInTheDocument()
        })
    })
})
