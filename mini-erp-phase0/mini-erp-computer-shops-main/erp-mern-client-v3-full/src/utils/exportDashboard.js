import html2canvas from 'html2canvas';
import api from '../services/api';

/**
 * Convert oklch() color values to hex fallback
 * html2canvas doesn't support oklch() which is used by Tailwind CSS v4
 */
function replaceOklchColors(element) {
    const computedStyle = window.getComputedStyle(element);
    const properties = [
        'color', 'backgroundColor', 'borderColor', 'borderTopColor',
        'borderRightColor', 'borderBottomColor', 'borderLeftColor',
        'outlineColor', 'textDecorationColor', 'fill', 'stroke'
    ];

    properties.forEach(prop => {
        const value = computedStyle.getPropertyValue(prop);
        if (value && value.includes('oklch')) {
            // Replace oklch with a neutral fallback color
            const fallbackColors = {
                'color': '#1f2937',           // gray-800 text
                'backgroundColor': '#ffffff',  // white background
                'borderColor': '#e5e7eb',     // gray-200 border
                'borderTopColor': '#e5e7eb',
                'borderRightColor': '#e5e7eb',
                'borderBottomColor': '#e5e7eb',
                'borderLeftColor': '#e5e7eb',
                'outlineColor': '#3b82f6',    // blue-500 outline
                'textDecorationColor': '#1f2937',
                'fill': '#3b82f6',            // blue-500 for SVG
                'stroke': '#1f2937'           // gray-800 for SVG
            };
            element.style[prop] = fallbackColors[prop] || '#000000';
        }
    });

    // Recursively process children
    Array.from(element.children).forEach(child => replaceOklchColors(child));
}

/**
 * Capture chart as base64 PNG
 */
export async function captureChart(elementRef) {
    if (!elementRef?.current) return null;

    try {
        const canvas = await html2canvas(elementRef.current, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: elementRef.current.scrollWidth,
            windowHeight: elementRef.current.scrollHeight,
            // Clone the element and fix oklch colors before rendering
            onclone: (clonedDoc, clonedElement) => {
                replaceOklchColors(clonedElement);
            }
        });

        // Return base64 without data:image/png;base64, prefix
        return canvas.toDataURL('image/png').split(',')[1];
    } catch (error) {
        console.error('Chart capture error:', error);
        return null;
    }
}

/**
 * Export Dashboard PDF with charts
 */
export async function exportDashboardPdf(refs, filters, push) {
    try {
        push('info', 'جاري تصدير PDF...');

        // Capture charts dynamically - only available refs
        const chartImages = {};

        if (refs.salesByDayRef?.current) {
            const captured = await captureChart(refs.salesByDayRef);
            if (captured) chartImages.salesByDay = captured;
        }

        if (refs.topProductsRef?.current) {
            const captured = await captureChart(refs.topProductsRef);
            if (captured) chartImages.topProducts = captured;
        }

        if (refs.categoryShareRef?.current) {
            const captured = await captureChart(refs.categoryShareRef);
            if (captured) chartImages.categoryShare = captured;
        }

        // Continue even if no charts captured - PDF can still have KPIs and alerts

        // POST request
        const response = await api.post('/dashboard/export/pdf', {
            from: filters.from,
            to: filters.to,
            warehouseId: filters.warehouseId || null,
            includeAlerts: filters.includeAlerts !== false,
            chartImages
        }, {
            responseType: 'blob',
            timeout: 60000 // 60s timeout for PDF generation
        });

        // Download PDF - response.data is already a Blob when responseType is 'blob'
        const url = window.URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `dashboard-${filters.from || new Date().toISOString().split('T')[0]}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        push('success', 'تم تنزيل ملف PDF بنجاح');
    } catch (error) {
        console.error('PDF Export Error:', error);
        const message = error.response?.data?.message || 'فشل تصدير PDF';
        push('error', message);
    }
}
