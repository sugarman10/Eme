import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

/**
 * Label Component
 * An accessible label for form fields
 * 
 * @example
 * <Label htmlFor="email">Email</Label>
 * <Label htmlFor="name" required>Name</Label>
 */
const Label = forwardRef(({
    className,
    required = false,
    children,
    ...props
}, ref) => {
    return (
        <label
            ref={ref}
            className={cn(
                'label',
                required && 'label-required',
                className
            )}
            {...props}
        >
            {children}
        </label>
    )
})

Label.displayName = 'Label'

export { Label }
