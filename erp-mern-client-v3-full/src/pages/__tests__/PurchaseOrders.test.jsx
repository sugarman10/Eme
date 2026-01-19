import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import PurchaseOrders from '../PurchaseOrders'
import { renderWithProviders } from '../../test-utils'
import api from '../../services/api'

vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn()
    }
}))

describe('Purchase Orders Page', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders purchase orders list', async () => {
        const mockOrders = [
            {
                _id: 'PO-001',
                supplier: { name: 'مورد 1' },
                createdAt: new Date().toISOString(),
                items: [{ qty: 1, cost: 100 }],
                status: 'approved'
            }
        ]

        api.get.mockImplementation((url) => {
            if (url === '/procurement/po') return Promise.resolve({ data: mockOrders })
            return Promise.resolve({ data: [] })
        })

        renderWithProviders(<PurchaseOrders />)

        expect(screen.getByText('أوامر الشراء')).toBeInTheDocument()

        await waitFor(() => {
            expect(screen.getByText('#PO-001')).toBeInTheDocument()
            expect(screen.getByText('مورد 1')).toBeInTheDocument()
        })
    })
})
