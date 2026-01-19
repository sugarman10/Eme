import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

/**
 * Button Component
 * A versatile button with multiple variants and sizes
 * 
 * @example
 * <Button>Default</Button>
 * <Button variant="destructive" size="lg">Delete</Button>
 * <Button variant="outline" size="sm">Cancel</Button>
 */
const Button = forwardRef(({
    className,
    variant = 'default',
    size = 'default',
    loading = false,
    children,
    disabled,
    ...props
}, ref) => {
    const variants = {
        default: 'btn-primary',
        secondary: 'btn-secondary',
        destructive: 'btn-destructive',
        success: 'btn-success',
        outline: 'btn-outline',
        ghost: 'btn-ghost',
        link: 'btn-link',
    }

    const sizes = {
        default: '',
        sm: 'btn-sm',
        lg: 'btn-lg',
        icon: 'btn-icon',
    }

    return (
        <button
            ref={ref}
            disabled={disabled || loading}
            className={cn(
                'btn',
                variants[variant],
                sizes[size],
                loading && 'opacity-70 cursor-wait',
                className
            )}
            {...props}
        >
            {loading && (
                <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            )}
            {children}
        </button>
    )
})

Button.displayName = 'Button'

export { Button }
