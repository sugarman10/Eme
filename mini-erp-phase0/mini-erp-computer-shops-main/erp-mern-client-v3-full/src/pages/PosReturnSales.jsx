import React from 'react'
import { PosReturnLayout } from '../components/pos/PosReturnLayout'

/**
 * PosReturnSales - Master Sales Return Page
 * 
 * Replaces old sales returns table with high-speed POS return workstations:
 * - mode=fast: مردود نقدي (Cash Sales Return)
 * - mode=split: مردود مبيعات (Customer Sales Return)
 */
export default function PosReturnSales() {
    return <PosReturnLayout />
}
