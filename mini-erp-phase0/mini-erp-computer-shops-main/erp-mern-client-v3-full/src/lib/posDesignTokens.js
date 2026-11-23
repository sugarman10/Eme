// POS Design Tokens V2 - Professional Edition
// Optimized for modern, flexible, and beautiful POS interface

export const colors = {
    // Primary - Indigo (More professional than blue)
    primary: {
        50: '#EEF2FF',
        100: '#E0E7FF',
        200: '#C7D2FE',
        300: '#A5B4FC',
        400: '#818CF8',
        500: '#6366F1', // Main
        600: '#4F46E5',
        700: '#4338CA',
        800: '#3730A3',
        900: '#312E81',
    },

    // Success - Emerald
    success: {
        50: '#ECFDF5',
        100: '#D1FAE5',
        200: '#A7F3D0',
        300: '#6EE7B7',
        400: '#34D399',
        500: '#10B981', // Main
        600: '#059669',
        700: '#047857',
    },

    // Warning - Amber
    warning: {
        50: '#FFFBEB',
        100: '#FEF3C7',
        200: '#FDE68A',
        300: '#FCD34D',
        400: '#FBBF24',
        500: '#F59E0B', // Main
        600: '#D97706',
        700: '#B45309',
    },

    // Danger - Red
    danger: {
        50: '#FEF2F2',
        100: '#FEE2E2',
        200: '#FECACA',
        300: '#FCA5A5',
        400: '#F87171',
        500: '#EF4444', // Main
        600: '#DC2626',
        700: '#B91C1C',
    },

    // Neutral - Slate
    neutral: {
        50: '#F8FAFC',
        100: '#F1F5F9',
        200: '#E2E8F0',
        300: '#CBD5E1',
        400: '#94A3B8',
        500: '#64748B',
        600: '#475569',
        700: '#334155',
        800: '#1E293B',
        900: '#0F172A',
    },

    // Stock Status Colors
    stock: {
        high: '#10B981',    // Green - >50
        medium: '#F59E0B',  // Amber - 11-50
        low: '#EF4444',     // Red - <10
        out: '#94A3B8',     // Gray - 0
    }
}

// Spacing Scale (8px base)
export const spacing = {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
    '3xl': '4rem',   // 64px
}

// Border Radius
export const borderRadius = {
    sm: '0.375rem',  // 6px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    '2xl': '1.5rem', // 24px
    full: '9999px',
}

// Typography
export const typography = {
    // Font Families
    sans: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
    mono: 'ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace',

    // Font Sizes - Enhanced Scale
    fontSize: {
        xs: '0.75rem',      // 12px
        sm: '0.875rem',     // 14px
        base: '1rem',       // 16px
        lg: '1.125rem',     // 18px
        xl: '1.25rem',      // 20px
        '2xl': '1.5rem',    // 24px
        '3xl': '1.875rem',  // 30px
        '4xl': '2.25rem',   // 36px
    },

    // Font Weights
    fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        black: '900',
    },

    // Line Heights
    lineHeight: {
        tight: '1.25',
        normal: '1.5',
        relaxed: '1.75',
    }
}

// Shadows - Enhanced
export const shadows = {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    glow: '0 0 15px rgb(99 102 241 / 0.3)', // Primary glow
}

// Animations - Framer Motion Variants
export const animations = {
    // Spring physics
    spring: {
        type: 'spring',
        stiffness: 400,
        damping: 30,
    },

    // Smooth easing
    smooth: {
        duration: 0.2,
        ease: [0.4, 0, 0.2, 1],
    },

    // Scale animations
    scaleIn: {
        initial: { scale: 0.9, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        exit: { scale: 0.9, opacity: 0 },
    },

    // Slide animations
    slideIn: {
        initial: { x: 20, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: -20, opacity: 0 },
    },

    // Fade
    fadeIn: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
    },

    // Bounce (for add to cart)
    bounce: {
        scale: [1, 1.2, 0.9, 1.1, 1],
        transition: { duration: 0.4 }
    }
}

// Glassmorphism
export const glass = {
    light: 'bg-white/80 backdrop-blur-xl',
    medium: 'bg-white/70 backdrop-blur-md',
    dark: 'bg-slate-900/80 backdrop-blur-xl',
}

// Z-Index Scale
export const zIndex = {
    base: 0,
    dropdown: 10,
    sticky: 20,
    fixed: 30,
    modal: 40,
    popover: 50,
    toast: 60,
}

// Component Specific Sizes
export const components = {
    productCard: {
        height: '10rem',      // 160px - Balanced size
        imageHeight: '6.5rem', // 104px - Balanced size
        gap: '0.5rem',        // 8px
    },

    cartItem: {
        height: '4.5rem',     // 72px - Smaller
        imageSize: '3rem',    // 48px (circular) - Smaller
        gap: '0.5rem',        // 8px
    },

    sidebar: {
        width: {
            sm: '360px',
            md: '380px',
            lg: '400px',
        }
    }
}

export default {
    colors,
    spacing,
    borderRadius,
    typography,
    shadows,
    animations,
    glass,
    zIndex,
    components,
}
