import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Login from './pages/Login'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'

// Mock the API to prevent actual network calls during tests
import { vi } from 'vitest'
vi.mock('./services/api', () => ({
    default: {
        post: vi.fn()
    }
}))

describe('Login Page', () => {
    it('renders login form', () => {
        render(
            <BrowserRouter>
                <AuthProvider>
                    <Login />
                </AuthProvider>
            </BrowserRouter>
        )

        expect(screen.getByText('تسجيل الدخول')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('name@company.com')).toBeInTheDocument()
    })
})
