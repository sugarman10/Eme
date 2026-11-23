import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

/**
 * Badge Component
 * A small status indicator with semantic color variants
 * 
 * @example
 * <Badge>Default</Badge>
 * <Badge variant="success">Active</Badge>
 * <Badge variant="destructive">Error</Badge>
 * <Badge variant="warning">Pending</Badge>
 */
const Badge = forwardRef(({
    className,
    variant = 'default',
    children,
    ...props
}, ref) => {
    const variants = {
        default: 'badge-default',
        primary: 'badge-primary',
        secondary: 'badge-default',
        success: 'badge-success',
        warning: 'badge-warning',
        destructive: 'badge-destructive',
        outline: 'badge-outline',
    }

    return (
        <span
            ref={ref}
            className={cn(
                'badge',
                variants[variant],
                className
            )}
            {...props}
        >
            {children}
        </span>
    )
})

Badge.displayName = 'Badge'

export { Badge }
