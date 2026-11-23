import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { XCircle, UserPlus } from 'lucide-react'
import { Card } from '../../ui/Card'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { animations } from '../../../lib/posDesignTokens'

/**
 * AddCustomerModal - Simple Add Customer Form
 * 
 * Features:
 * - Name and phone inputs
 * - Basic validation
 * - Loading state
 * - Backdrop blur effect
 */
export const AddCustomerModal = ({
    show,
    onClose,
    newCustomer,
    setNewCustomer,
    onAdd,
    adding
}) => {
    if (!show) return null

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <motion.div
                initial={animations.scaleIn.initial}
                animate={animations.scaleIn.animate}
                exit={animations.scaleIn.exit}
            >
                <Card className="w-full max-w-md flex flex-col shadow-2xl bg-white rounded-xl overflow-hidden border-0 ring-1 ring-black/5">
                    {/* Header */}
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                        <div className="flex items-center gap-2">
                            <UserPlus size={18} className="text-primary" />
                            <h2 className="text-base font-bold text-slate-800">إضافة عميل جديد</h2>
                        </div>
                        <button
                            className="hover:bg-slate-200 rounded-full p-1 transition-colors"
                            onClick={onClose}
                        >
                            <XCircle size={18} className="text-slate-500" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-4 flex flex-col gap-4">
                        <div>
                            <label className="text-sm font-bold text-slate-700 mb-1 block">
                                اسم العميل <span className="text-red-500">*</span>
                            </label>
                            <Input
                                className="w-full"
                                placeholder="أدخل اسم العميل"
                                value={newCustomer.name}
                                onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="text-sm font-bold text-slate-700 mb-1 block">
                                رقم الهاتف
                            </label>
                            <Input
                                className="w-full"
                                placeholder="أدخل رقم الهاتف"
                                value={newCustomer.phone}
                                onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t bg-slate-50 flex gap-3 justify-end">
                        <Button
                            variant="secondary"
                            onClick={onClose}
                            disabled={adding}
                        >
                            إلغاء
                        </Button>
                        <Button
                            onClick={onAdd}
                            disabled={!newCustomer.name || adding}
                        >
                            {adding ? 'جاري الإضافة...' : 'إضافة'}
                        </Button>
                    </div>
                </Card>
            </motion.div>
        </div>
    )
}
