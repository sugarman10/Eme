import { createContext, useContext, useState, useEffect } from 'react'

/**
 * ThemeContext - Manages dark mode across the application
 * 
 * Features:
 * - Persists preference in localStorage
 * - Applies 'dark' class to document root
 * - Syncs with system preference on first load
 */

const ThemeContext = createContext()

export const useTheme = () => {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}

export const ThemeProvider = ({ children }) => {
    const [darkMode, setDarkMode] = useState(() => {
        // Check localStorage first
        const saved = localStorage.getItem('darkMode')
        if (saved !== null) {
            return JSON.parse(saved)
        }
        // Fallback to system preference
        return window.matchMedia('(prefers-color-scheme: dark)').matches
    })

    // Apply dark class to document
    useEffect(() => {
        const root = document.documentElement
        if (darkMode) {
            root.classList.add('dark')
        } else {
            root.classList.remove('dark')
        }
        // Save to localStorage
        localStorage.setItem('darkMode', JSON.stringify(darkMode))
    }, [darkMode])

    // Listen for system preference changes
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleChange = (e) => {
            // Only auto-switch if user hasn't manually set preference
            const saved = localStorage.getItem('darkMode')
            if (saved === null) {
                setDarkMode(e.matches)
            }
        }
        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [])

    const toggleDarkMode = () => {
        setDarkMode(prev => !prev)
    }

    const value = {
        darkMode,
        setDarkMode,
        toggleDarkMode
    }

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    )
}

export default ThemeContext
