import { forwardRef } from 'react'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

/**
 * Pagination Component
 * Clean pagination bar with Previous, Page Numbers, Next
 * RTL-ready with proper arrow directions
 * 
 * @example
 * <Pagination
 *   currentPage={1}
 *   totalPages={10}
 *   onPageChange={(page) => setPage(page)}
 * />
 */

const Pagination = ({
    currentPage = 1,
    totalPages = 1,
    onPageChange,
    showPageNumbers = true,
    maxVisiblePages = 5,
    className
}) => {
    const handlePrevious = () => {
        if (currentPage > 1) {
            onPageChange?.(currentPage - 1)
        }
    }

    const handleNext = () => {
        if (currentPage < totalPages) {
            onPageChange?.(currentPage + 1)
        }
    }

    // Generate page numbers to show
    const getPageNumbers = () => {
        const pages = []
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

        // Adjust start if end is at max
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1)
        }

        // Add first page and ellipsis
        if (startPage > 1) {
            pages.push(1)
            if (startPage > 2) {
                pages.push('...')
            }
        }

        // Add visible pages
        for (let i = startPage; i <= endPage; i++) {
            pages.push(i)
        }

        // Add ellipsis and last page
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                pages.push('...')
            }
            pages.push(totalPages)
        }

        return pages
    }

    if (totalPages <= 1) return null

    return (
        <nav
            className={cn(
                'flex items-center justify-center gap-1',
                className
            )}
            aria-label="Pagination"
        >
            {/* Previous Button - RTL: ChevronRight goes to previous */}
            <Button
                variant="outline"
                size="icon"
                onClick={handlePrevious}
                disabled={currentPage === 1}
                className="h-9 w-9"
                aria-label="الصفحة السابقة"
            >
                <ChevronRight size={16} />
            </Button>

            {/* Page Numbers */}
            {showPageNumbers && getPageNumbers().map((page, idx) => (
                page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">
                        <MoreHorizontal size={16} />
                    </span>
                ) : (
                    <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => onPageChange?.(page)}
                        className={cn(
                            'h-9 min-w-9 px-3',
                            currentPage === page && 'pointer-events-none'
                        )}
                        aria-current={currentPage === page ? 'page' : undefined}
                    >
                        {page}
                    </Button>
                )
            ))}

            {/* Next Button - RTL: ChevronLeft goes to next */}
            <Button
                variant="outline"
                size="icon"
                onClick={handleNext}
                disabled={currentPage === totalPages}
                className="h-9 w-9"
                aria-label="الصفحة التالية"
            >
                <ChevronLeft size={16} />
            </Button>
        </nav>
    )
}

// Simple pagination info display
const PaginationInfo = forwardRef(({
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    className,
    ...props
}, ref) => {
    const startItem = (currentPage - 1) * itemsPerPage + 1
    const endItem = Math.min(currentPage * itemsPerPage, totalItems)

    return (
        <p
            ref={ref}
            className={cn('text-sm text-slate-600', className)}
            {...props}
        >
            عرض {startItem} - {endItem} من {totalItems} نتيجة
        </p>
    )
})
PaginationInfo.displayName = 'PaginationInfo'

export { Pagination, PaginationInfo }
