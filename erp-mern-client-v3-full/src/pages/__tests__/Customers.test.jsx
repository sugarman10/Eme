import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import Customers from '../Customers'
import { renderWithProviders } from '../../test-utils'
import api from '../../services/api'

// Mock API
vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }
}))

describe('Customers Page', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders customers list correctly', async () => {
        const mockCustomers = [
            { _id: '1', code: 'C001', name: 'العميل الأول', phone: '123456', type: 'retail' },
            { _id: '2', code: 'C002', name: 'العميل الثاني', phone: '789012', type: 'wholesale' }
        ]

        api.get.mockResolvedValue({ data: mockCustomers })

        renderWithProviders(<Customers />)

        expect(screen.getByText('العملاء')).toBeInTheDocument()
        expect(screen.getByText('جاري التحميل...')).toBeInTheDocument()

        await waitFor(() => {
            expect(screen.getByText('العميل الأول')).toBeInTheDocument()
            expect(screen.getByText('العميل الثاني')).toBeInTheDocument()
        })
    })

    it('shows empty state when no customers found', async () => {
        api.get.mockResolvedValue({ data: [] })

        renderWithProviders(<Customers />)

        await waitFor(() => {
            expect(screen.getByText('لا توجد بيانات.')).toBeInTheDocument()
        })
    })
})
