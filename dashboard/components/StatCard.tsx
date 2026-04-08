import { ReactNode } from 'react'

const COLOR_CLASS: Record<string, string> = {
    green: 's-green',
    orange: 's-orange',
    blue: 's-blue',
    red: 's-red',
    // legacy aliases
    brand: 's-green',
    purple: 's-blue',
    gray: 's-blue',
}

interface StatCardProps {
    label: string
    value: string
    sub?: string
    color?: string
    icon?: ReactNode
}

export default function StatCard({ label, value, sub, color = 'green', icon }: StatCardProps) {
    const cls = COLOR_CLASS[color] ?? 's-green'
    return (
        <div className={`stat-card ${cls}`}>
            {icon && <div className="stat-icon">{icon}</div>}
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            {sub && <div className="stat-sub">{sub}</div>}
        </div>
    )
}
