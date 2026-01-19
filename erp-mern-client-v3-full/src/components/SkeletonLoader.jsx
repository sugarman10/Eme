export default function SkeletonLoader({ rows = 3, columns = 3, type = 'table' }) {
    if (type === 'table') {
        return (
            <div className="animate-pulse">
                <div className="space-y-3">
                    {Array.from({ length: rows }).map((_, i) => (
                        <div key={i} className="flex gap-4">
                            {Array.from({ length: columns }).map((_, j) => (
                                <div key={j} className="h-12 bg-muted rounded flex-1"></div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (type === 'card') {
        return (
            <div className="animate-pulse space-y-4">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="p-4 border rounded-lg">
                        <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="animate-pulse space-y-2">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="h-4 bg-muted rounded"></div>
            ))}
        </div>
    );
}
