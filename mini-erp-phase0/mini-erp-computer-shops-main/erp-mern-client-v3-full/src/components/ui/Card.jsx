import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

/**
 * Card Component
 * A flexible container for grouping related content
 * 
 * @example
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Title</CardTitle>
 *     <CardDescription>Description</CardDescription>
 *   </CardHeader>
 *   <CardContent>Content here</CardContent>
 *   <CardFooter>Footer actions</CardFooter>
 * </Card>
 */
const Card = forwardRef(({ className, variant = 'default', ...props }, ref) => {
    const variants = {
        default: 'card',
        premium: 'card-premium',
        glass: 'glass border border-white/20 shadow-xl'
    }

    return (
        <div
            ref={ref}
            className={cn(variants[variant] || variants.default, className)}
            {...props}
        />
    )
})
Card.displayName = 'Card'

const CardHeader = forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('card-header', className)}
        {...props}
    />
))
CardHeader.displayName = 'CardHeader'

const CardTitle = forwardRef(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn('card-title', className)}
        {...props}
    />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = forwardRef(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn('card-description', className)}
        {...props}
    />
))
CardDescription.displayName = 'CardDescription'

const CardContent = forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('card-content', className)}
        {...props}
    />
))
CardContent.displayName = 'CardContent'

const CardFooter = forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('card-footer', className)}
        {...props}
    />
))
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
