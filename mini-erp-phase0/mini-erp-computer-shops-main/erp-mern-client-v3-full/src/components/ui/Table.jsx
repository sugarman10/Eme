import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

/**
 * Composable Table Components
 * RTL-compatible with proper text alignment for Arabic
 * 
 * @example
 * <Table>
 *   <TableHeader>
 *     <TableRow>
 *       <TableHead>الاسم</TableHead>
 *       <TableHead>المبلغ</TableHead>
 *     </TableRow>
 *   </TableHeader>
 *   <TableBody>
 *     <TableRow>
 *       <TableCell>أحمد</TableCell>
 *       <TableCell>1000</TableCell>
 *     </TableRow>
 *   </TableBody>
 * </Table>
 */

const Table = forwardRef(({ className, ...props }, ref) => (
    <div className="w-full overflow-x-auto">
        <table
            ref={ref}
            className={cn(
                'w-full caption-bottom text-sm border-collapse',
                className
            )}
            {...props}
        />
    </div>
))
Table.displayName = 'Table'

const TableHeader = forwardRef(({ className, ...props }, ref) => (
    <thead
        ref={ref}
        className={cn('bg-slate-50 border-b border-slate-200', className)}
        {...props}
    />
))
TableHeader.displayName = 'TableHeader'

const TableBody = forwardRef(({ className, ...props }, ref) => (
    <tbody
        ref={ref}
        className={cn('[&_tr:last-child]:border-0', className)}
        {...props}
    />
))
TableBody.displayName = 'TableBody'

const TableFooter = forwardRef(({ className, ...props }, ref) => (
    <tfoot
        ref={ref}
        className={cn(
            'border-t border-slate-200 bg-slate-50 font-medium',
            className
        )}
        {...props}
    />
))
TableFooter.displayName = 'TableFooter'

const TableRow = forwardRef(({ className, ...props }, ref) => (
    <tr
        ref={ref}
        className={cn(
            'border-b border-slate-100 transition-colors hover:bg-slate-50/50 data-[state=selected]:bg-slate-100',
            className
        )}
        {...props}
    />
))
TableRow.displayName = 'TableRow'

const TableHead = forwardRef(({ className, ...props }, ref) => (
    <th
        ref={ref}
        className={cn(
            'h-12 px-4 text-right align-middle font-semibold text-slate-600 [&:has([role=checkbox])]:pr-0',
            className
        )}
        {...props}
    />
))
TableHead.displayName = 'TableHead'

const TableCell = forwardRef(({ className, ...props }, ref) => (
    <td
        ref={ref}
        className={cn(
            'p-4 align-middle text-slate-700 [&:has([role=checkbox])]:pr-0',
            className
        )}
        {...props}
    />
))
TableCell.displayName = 'TableCell'

const TableCaption = forwardRef(({ className, ...props }, ref) => (
    <caption
        ref={ref}
        className={cn('mt-4 text-sm text-slate-500', className)}
        {...props}
    />
))
TableCaption.displayName = 'TableCaption'

export {
    Table,
    TableHeader,
    TableBody,
    TableFooter,
    TableRow,
    TableHead,
    TableCell,
    TableCaption,
}
