import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import Suppliers from '../Suppliers'
import { renderWithProviders } from '../../test-utils'
import api from '../../services/api'

vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }
}))

describe('Suppliers Page', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders suppliers list correctly', async () => {
        const mockSuppliers = [
            { _id: '1', code: 'S001', name: 'المورد الأول', phone: '123456' },
            { _id: '2', code: 'S002', name: 'المورد الثاني', phone: '789012' }
        ]

        api.get.mockResolvedValue({ data: mockSuppliers })

        renderWithProviders(<Suppliers />)

        expect(screen.getByText('المورّدون')).toBeInTheDocument()

        await waitFor(() => {
            expect(screen.getByText('المورد الأول')).toBeInTheDocument()
            expect(screen.getByText('المورد الثاني')).toBeInTheDocument()
        })
    })
})
