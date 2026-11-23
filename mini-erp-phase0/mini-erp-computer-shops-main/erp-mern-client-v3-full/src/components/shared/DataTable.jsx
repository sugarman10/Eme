import { Package, FileX2, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '../ui/Table'
import { Pagination, PaginationInfo } from '../ui/Pagination'

/**
 * DataTable - Smart Data Table Wrapper
 * Handles loading states, empty states, and pagination automatically
 * 
 * @example
 * <DataTable
 *   columns={[
 *     { key: 'name', header: 'الاسم' },
 *     { key: 'amount', header: 'المبلغ', render: (row) => formatCurrency(row.amount) }
 *   ]}
 *   data={invoices}
 *   isLoading={loading}
 *   pagination={{
 *     currentPage: page,
 *     totalPages: totalPages,
 *     totalItems: totalCount,
 *     itemsPerPage: 10,
 *     onPageChange: setPage
 *   }}
 * />
 */

export default function DataTable({
    columns = [],
    data = [],
    isLoading = false,
    pagination = null,
    emptyMessage = 'لا توجد بيانات',
    emptyIcon: EmptyIcon = FileX2,
    onRowClick = null,
    rowClassName = null,
    className,
}) {
    // Loading Skeleton
    if (isLoading) {
        return (
            <div className={cn('bg-white rounded-xl border border-slate-200 overflow-hidden', className)}>
                <Table>
                    <TableHeader>
                        <TableRow>
                            {columns.map((col, idx) => (
                                <TableHead key={idx} className={col.headerClassName}>
                                    <div className="h-4 bg-slate-200 rounded animate-pulse w-20" />
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[1, 2, 3, 4, 5].map((row) => (
                            <TableRow key={row}>
                                {columns.map((col, idx) => (
                                    <TableCell key={idx}>
                                        <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        )
    }

    // Empty State
    if (!data || data.length === 0) {
        return (
            <div className={cn('bg-white rounded-xl border border-slate-200 overflow-hidden', className)}>
                <Table>
                    <TableHeader>
                        <TableRow>
                            {columns.map((col, idx) => (
                                <TableHead key={idx} className={col.headerClassName}>
                                    {col.header}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                </Table>
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                        <EmptyIcon size={32} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-medium">{emptyMessage}</p>
                </div>
            </div>
        )
    }

    return (
        <div className={cn('bg-white rounded-xl border border-slate-200 overflow-hidden', className)}>
            <Table>
                <TableHeader>
                    <TableRow>
                        {columns.map((col, idx) => (
                            <TableHead key={idx} className={col.headerClassName}>
                                {col.header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((row, rowIdx) => (
                        <TableRow
                            key={row._id || row.id || rowIdx}
                            onClick={() => onRowClick?.(row)}
                            className={cn(
                                onRowClick && 'cursor-pointer',
                                typeof rowClassName === 'function' ? rowClassName(row) : rowClassName
                            )}
                        >
                            {columns.map((col, colIdx) => (
                                <TableCell key={colIdx} className={col.cellClassName}>
                                    {col.render ? col.render(row) : row[col.key]}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50">
                    <PaginationInfo
                        currentPage={pagination.currentPage}
                        totalPages={pagination.totalPages}
                        totalItems={pagination.totalItems}
                        itemsPerPage={pagination.itemsPerPage}
                    />
                    <Pagination
                        currentPage={pagination.currentPage}
                        totalPages={pagination.totalPages}
                        onPageChange={pagination.onPageChange}
                    />
                </div>
            )}
        </div>
    )
}

// Export a simple loading indicator
export function TableLoader({ rows = 5, columns = 4 }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        {Array.from({ length: columns }).map((_, idx) => (
                            <TableHead key={idx}>
                                <div className="h-4 bg-slate-200 rounded animate-pulse w-20" />
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: rows }).map((_, rowIdx) => (
                        <TableRow key={rowIdx}>
                            {Array.from({ length: columns }).map((_, colIdx) => (
                                <TableCell key={colIdx}>
                                    <div
                                        className="h-4 bg-slate-100 rounded animate-pulse"
                                        style={{ width: `${60 + Math.random() * 40}%` }}
                                    />
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
