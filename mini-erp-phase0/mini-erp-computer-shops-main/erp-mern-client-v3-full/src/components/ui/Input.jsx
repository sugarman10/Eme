import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

/**
 * Input Component
 * A styled input field with focus states and error handling
 * 
 * @example
 * <Input placeholder="Enter email..." />
 * <Input error errorMessage="Invalid email" />
 */
const Input = forwardRef(({
    className,
    type = 'text',
    error = false,
    ...props
}, ref) => {
    return (
        <input
            type={type}
            ref={ref}
            className={cn(
                'input input-glow',
                error && 'input-error',
                className
            )}
            {...props}
        />
    )
})

Input.displayName = 'Input'

export { Input }
