import SystemSetting from '../models/SystemSetting.js';

// Simple In-Memory Cache
const CACHE_TTL = 5 * 60 * 1000; // 5 Minutes
const settingsCache = new Map();

/**
 * Get a system setting by key (Cached)
 * @param {string} key 
 * @param {any} defaultValue 
 * @returns {Promise<any>}
 */
export const getSetting = async (key, defaultValue = null) => {
    try {
        const now = Date.now();
        if (settingsCache.has(key)) {
            const { value, expiry } = settingsCache.get(key);
            if (now < expiry) return value;
        }

        const setting = await SystemSetting.findOne({ key });
        const value = setting ? setting.value : defaultValue;

        // Update Cache
        settingsCache.set(key, { value, expiry: now + CACHE_TTL });

        return value;
    } catch (error) {
        console.error(`Error fetching setting ${key}:`, error);
        return defaultValue;
    }
};

/**
 * Get Organization Tax Rate (Percentage)
 * @returns {Promise<number>}
 */
export const getOrgTaxRate = async () => {
    const rate = await getSetting('tax_rate_percent', 0);
    return Number(rate) || 0;
};

/**
 * Get Default Account ID by Code Key
 * @param {string} accountKey - e.g. 'account_sales_code' -> returns '40101'
 * @returns {Promise<string>}
 */
export const getAccountCode = async (accountKey, defaultCode) => {
    return await getSetting(accountKey, defaultCode);
};
