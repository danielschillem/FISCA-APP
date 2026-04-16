// Shared UI primitives
import { PLAN_FEATURES } from '../types';
import { useAppStore } from '../lib/store';
import { Lock } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: string;
    sub?: string;
    color?: 'green' | 'orange' | 'blue' | 'red' | 'gray';
    icon?: React.ReactNode;
}

const colorMap = {
    green: { bg: 'bg-green-50', text: 'text-green-700', icon: 'bg-green-100' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-700', icon: 'bg-orange-100' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'bg-blue-100' },
    red: { bg: 'bg-red-50', text: 'text-red-700', icon: 'bg-red-100' },
    gray: { bg: 'bg-gray-50', text: 'text-gray-700', icon: 'bg-gray-100' },
};

export function StatCard({ label, value, sub, color = 'green', icon }: StatCardProps) {
    const c = colorMap[color];
    return (
        <div className={`${c.bg} rounded-xl p-5 flex items-start gap-4`}>
            {icon && (
                <div className={`${c.icon} ${c.text} w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0`}>
                    {icon}
                </div>
            )}
            <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
                <p className={`text-xl font-bold ${c.text}`}>{value}</p>
                {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

interface BadgeProps {
    children: React.ReactNode;
    color?: 'green' | 'orange' | 'red' | 'blue' | 'gray';
}
export function Badge({ children, color = 'gray' }: BadgeProps) {
    const map = {
        green: 'bg-green-100 text-green-700',
        orange: 'bg-orange-100 text-orange-700',
        red: 'bg-red-100 text-red-700',
        blue: 'bg-blue-100 text-blue-700',
        gray: 'bg-gray-100 text-gray-600',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[color]}`}>
            {children}
        </span>
    );
}

interface CardProps {
    title?: string;
    children: React.ReactNode;
    className?: string;
    action?: React.ReactNode;
}
export function Card({ title, children, className = '', action }: CardProps) {
    return (
        <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>
            {(title || action) && (
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    {title && <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>}
                    {action}
                </div>
            )}
            <div className="p-6">{children}</div>
        </div>
    );
}

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'outline';
    size?: 'sm' | 'md';
}
export function Btn({ children, variant = 'primary', size = 'md', className = '', ...props }: BtnProps) {
    const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors disabled:opacity-60';
    const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
    const variants = {
        primary: 'bg-green-600 hover:bg-green-700 text-white',
        secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
        danger: 'bg-red-600 hover:bg-red-700 text-white',
        outline: 'border border-gray-300 hover:bg-gray-50 text-gray-700',
    };
    return (
        <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
            {children}
        </button>
    );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    suffix?: string;
    error?: string;
}
export function Input({ label, suffix, error, className = '', ...props }: InputProps) {
    return (
        <div className="space-y-1">
            {label && <label className="block text-xs font-medium text-gray-700">{label}</label>}
            <div className="relative">
                <input
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${suffix ? 'pr-14' : ''
                        } ${error ? 'border-red-400' : ''} ${className}`}
                    {...props}
                />
                {suffix && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>
                )}
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: { value: string; label: string }[];
}
export function Select({ label, options, className = '', ...props }: SelectProps) {
    return (
        <div className="space-y-1">
            {label && <label className="block text-xs font-medium text-gray-700">{label}</label>}
            <select
                className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 ${className}`}
                {...props}
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </div>
    );
}

interface TableProps {
    columns: string[];
    children: React.ReactNode;
    className?: string;
}
export function Table({ columns, children, className = '' }: TableProps) {
    return (
        <div className={`overflow-x-auto ${className}`}>
            <table className="w-full text-sm text-left">
                <thead>
                    <tr className="border-b border-gray-200">
                        {columns.map((c) => (
                            <th key={c} className="text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4 first:pl-0">
                                {c}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">{children}</tbody>
            </table>
        </div>
    );
}

export function Spinner() {
    return (
        <div className="flex items-center justify-center p-8">
            <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
    );
}

interface GateProps {
    feature: string;
    requiredPlan: 'pro' | 'enterprise';
    children: React.ReactNode;
}
export function PlanGate({ feature, requiredPlan, children }: GateProps) {
    const { plan } = useAppStore();
    if (PLAN_FEATURES[plan]?.has(feature)) return <>{children}</>;
    const labels: Record<string, string> = { pro: 'Pro', enterprise: 'Entreprise' };
    const colors: Record<string, string> = { pro: '#24a05a', enterprise: '#f97316' };
    return (
        <div className="flex items-center justify-center min-h-[40vh] p-4">
            <div className="text-center max-w-sm">
                <div className="flex justify-center mb-4">
                    <Lock className="w-12 h-12 text-gray-300" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                    Fonctionnalité <span style={{ color: colors[requiredPlan] }}>{labels[requiredPlan]}</span>
                </h2>
                <p className="text-gray-500 text-sm">
                    Passez au plan {labels[requiredPlan]} pour accéder à cette fonctionnalité.
                </p>
            </div>
        </div>
    );
}

// Re-export useAppStore and PLAN_FEATURES for convenience
export { useAppStore } from '../lib/store';
export { PLAN_FEATURES, PLAN_LIMITS } from '../types';
