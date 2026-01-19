import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const WarehouseContext = createContext()

export function WarehouseProvider({ children }) {
    const [warehouses, setWarehouses] = useState([])
    const [selectedWarehouseId, setSelectedWarehouseId] = useState(null)
    const [loading, setLoading] = useState(true)

    // Load warehouses on mount
    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                const { data } = await api.get('/inventory/warehouses')
                setWarehouses(data || [])

                // Load saved warehouse from localStorage
                const savedWarehouseId = localStorage.getItem('active_warehouse_id')
                if (savedWarehouseId && data.find(w => w._id === savedWarehouseId)) {
                    setSelectedWarehouseId(savedWarehouseId)
                } else if (data.length > 0) {
                    // Auto-select first warehouse if none saved
                    setSelectedWarehouseId(data[0]._id)
                    localStorage.setItem('active_warehouse_id', data[0]._id)
                }
            } catch (error) {
                console.error('Failed to load warehouses:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchWarehouses()
    }, [])

    // Update localStorage when warehouse changes
    const selectWarehouse = (warehouseId) => {
        setSelectedWarehouseId(warehouseId)
        if (warehouseId) {
            localStorage.setItem('active_warehouse_id', warehouseId)
        } else {
            localStorage.removeItem('active_warehouse_id')
        }
    }

    // Get current warehouse object
    const currentWarehouse = warehouses.find(w => w._id === selectedWarehouseId)

    const value = {
        warehouses,
        selectedWarehouseId,
        currentWarehouse,
        selectWarehouse,
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
