import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import api from '../services/api'
import { useAuth } from './AuthContext'

const WarehouseContext = createContext()

export function WarehouseProvider({ children }) {
    const { me } = useAuth()
    const [warehouses, setWarehouses] = useState([])
    const [selectedWarehouseId, setSelectedWarehouseId] = useState(null)
    const [loading, setLoading] = useState(true)

    // Check if the current user is strictly locked to a single branch/warehouse
    const isWarehouseLocked = useMemo(() => {
        return Boolean(me?.assignedWarehouse && me?.role !== 'admin')
    }, [me?.assignedWarehouse, me?.role])

    const assignedWarehouseId = useMemo(() => {
        if (!me?.assignedWarehouse) return null
        return me.assignedWarehouse._id || me.assignedWarehouse
    }, [me?.assignedWarehouse])

    // Load warehouses on mount or auth change
    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                const { data } = await api.get('/inventory/warehouses')
                const whList = data || []
                setWarehouses(whList)

                // If user is locked to an assigned warehouse, lock it strictly
                if (isWarehouseLocked && assignedWarehouseId) {
                    setSelectedWarehouseId(assignedWarehouseId)
                    localStorage.setItem('active_warehouse_id', assignedWarehouseId)
                    return
                }

                // Otherwise, load saved warehouse from localStorage for Admins
                const savedWarehouseId = localStorage.getItem('active_warehouse_id')
                if (savedWarehouseId && whList.find(w => w._id === savedWarehouseId)) {
                    setSelectedWarehouseId(savedWarehouseId)
                } else if (whList.length > 0) {
                    setSelectedWarehouseId(whList[0]._id)
                    localStorage.setItem('active_warehouse_id', whList[0]._id)
                }
            } catch (error) {
                console.error('Failed to load warehouses:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchWarehouses()
    }, [isWarehouseLocked, assignedWarehouseId])

    // Update warehouse - disallow switching if locked
    const selectWarehouse = (warehouseId) => {
        if (isWarehouseLocked && assignedWarehouseId) {
            setSelectedWarehouseId(assignedWarehouseId)
            return
        }
        setSelectedWarehouseId(warehouseId)
        if (warehouseId) {
            localStorage.setItem('active_warehouse_id', warehouseId)
        } else {
            localStorage.removeItem('active_warehouse_id')
        }
    }

    // Get current warehouse object
    const currentWarehouse = useMemo(() => {
        if (isWarehouseLocked && me?.assignedWarehouse && typeof me.assignedWarehouse === 'object' && me.assignedWarehouse.name) {
            return me.assignedWarehouse
        }
        return warehouses.find(w => w._id === selectedWarehouseId) || null
    }, [isWarehouseLocked, me?.assignedWarehouse, warehouses, selectedWarehouseId])

    const value = {
        warehouses,
        selectedWarehouseId,
        currentWarehouse,
        selectWarehouse,
        setWarehouse: selectWarehouse,
        isWarehouseLocked,
        loading
    }

    return (
        <WarehouseContext.Provider value={value}>
            {children}
        </WarehouseContext.Provider>
    )
}

export function useWarehouse() {
    const context = useContext(WarehouseContext)
    if (!context) {
        throw new Error('useWarehouse must be used within WarehouseProvider')
    }
    return context
}
