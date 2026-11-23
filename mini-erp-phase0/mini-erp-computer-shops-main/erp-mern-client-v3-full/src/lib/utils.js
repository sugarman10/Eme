export function cn(...inputs) {
    return inputs.filter(Boolean).join(' ')
}

export function formatCurrency(value, currency = 'LYD') {
    return Number(value || 0).toLocaleString('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).replace('LYD', 'د.ل') // User prefers Arabic symbol but English numbers
}

export function formatNumber(value) {
    return Number(value || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })
}
