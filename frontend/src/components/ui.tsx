// Shared UI primitives
import { useState } from 'react';
import { PLAN_FEATURES } from '../types';
import { useAppStore, useToastStore } from '../lib/store';
import { Lock, CheckCircle2, XCircle, Info } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: string;
    sub?: string;
    color?: 'green' | 'orange' | 'blue' | 'red' | 'gray';
    icon?: React.ReactNode;
}

const colorMap = {
    green: { border: 'border-l-green-500', text: 'text-green-600', icon: 'bg-green-50 text-green-600' },
    orange: { border: 'border-l-orange-500', text: 'text-orange-600', icon: 'bg-orange-50 text-orange-600' },
    blue: { border: 'border-l-blue-500', text: 'text-blue-600', icon: 'bg-blue-50 text-blue-600' },
    red: { border: 'border-l-red-500', text: 'text-red-600', icon: 'bg-red-50 text-red-600' },
    gray: { border: 'border-l-gray-400', text: 'text-gray-700', icon: 'bg-gray-100 text-gray-500' },
};

export function StatCard({ label, value, sub, color = 'green', icon }: StatCardProps) {
    const c = colorMap[color];
    return (
        <div
            className={`flex items-start gap-3 border border-slate-200/90 border-l-4 bg-white p-4 ${c.border} transition-shadow duration-200 hover:shadow-[var(--card-shadow-hover)]`}
            style={{ borderRadius: 'var(--card-radius)', boxShadow: 'var(--card-shadow)' }}
        >
            {icon && (
                <div className={`${c.icon} flex h-9 w-9 shrink-0 items-center justify-center rounded-lg`}>
                    {icon}
                </div>
            )}
            <div className="min-w-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
                <p className={`text-xl leading-tight font-bold tracking-tight ${c.text} whitespace-nowrap`}>{value}</p>
                {sub && <p className="mt-1 text-[11px] text-gray-500">{sub}</p>}
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
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${map[color]}`}>
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
        <div
            className={`overflow-hidden border border-slate-200/90 bg-white ${className}`}
            style={{ borderRadius: 'var(--card-radius)', boxShadow: 'var(--card-shadow)' }}
        >
            {(title || action) && (
                <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/95 px-5 py-3.5">
                    {title && (
                        <h3 className="text-sm font-semibold tracking-tight text-slate-800">{title}</h3>
                    )}
                    {action}
                </div>
            )}
            <div className="p-5 sm:p-6">{children}</div>
        </div>
    );
}

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'outline';
    size?: 'sm' | 'md';
}
export function Btn({ children, variant = 'primary', size = 'md', className = '', ...props }: BtnProps) {
    const base = 'inline-flex items-center justify-center gap-1.5 font-medium rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100';
    const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
    const variants = {
        primary: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-900/10 hover:shadow-md hover:shadow-emerald-900/15',
        secondary: 'bg-slate-100 hover:bg-slate-200/90 text-slate-800 border border-slate-200/80',
        danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-900/10',
        outline: 'border border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400 text-slate-800',
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
            {label && <label className="block text-xs font-medium text-slate-600">{label}</label>}
            <div className="relative">
                <input
                    className={`w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/50 ${suffix ? 'pr-14' : ''
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

/**
 * Champ de saisie numérique harmonisé (FCFA, montants entiers).
 * - Affiche vide quand la valeur est 0 (pas de "0" bloqué)
 * - Saisie libre en texte, nettoyage des non-chiffres
 * - Formatage milliers (espaces insécables) au blur
 * - Compatible iOS Safari (inputMode="numeric")
 */
interface NumericInputProps {
    value: number;
    onChange: (v: number) => void;
    onBlur?: () => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}
export function NumericInput({ value, onChange, onBlur, placeholder = '0', className = '', disabled }: NumericInputProps) {
    const [focused, setFocused] = useState(false);
    const [raw, setRaw] = useState('');

    const handleFocus = () => {
        setRaw(value === 0 ? '' : String(value));
        setFocused(true);
    };
    const handleBlur = () => {
        setFocused(false);
        const n = parseInt(raw.replace(/\s/g, ''), 10);
        onChange(isNaN(n) || n < 0 ? 0 : n);
        onBlur?.();
    };
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const cleaned = e.target.value.replace(/[^\d]/g, '');
        setRaw(cleaned);
        const n = parseInt(cleaned, 10);
        onChange(isNaN(n) ? 0 : n);
    };

    const displayValue = focused
        ? raw
        : (value === 0 ? '' : value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0'));

    return (
        <input
            type="text"
            inputMode="numeric"
            disabled={disabled}
            className={`w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono text-right shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/50 disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
            value={displayValue}
            placeholder={placeholder}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
        />
    );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: { value: string; label: string }[];
}
export function Select({ label, options, className = '', ...props }: SelectProps) {
    return (
        <div className="space-y-1">
            {label && <label className="block text-xs font-medium text-slate-600">{label}</label>}
            <select
                className={`w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500/50 ${className}`}
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
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                        {columns.map((c) => (
                            <th key={c} className="text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4 first:pl-0">
                                {c}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">{children}</tbody>
            </table>
        </div>
    );
}

export function Spinner() {
    return (
        <div className="flex items-center justify-center p-12">
            <div className="flex flex-col items-center gap-3">
                <div className="w-9 h-9 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
                <p className="text-xs font-medium text-slate-500">Chargement…</p>
            </div>
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

// --- Toaster (toast notifications éphémères) --------------------------

export function useToast() {
    return useToastStore(s => s.toast);
}

export function Toaster() {
    const toasts = useToastStore(s => s.toasts);
    if (toasts.length === 0) return null;
    return (
        <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none">
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`pointer-events-auto flex items-center gap-3 px-4 py-3.5 rounded-xl border text-sm font-medium text-white min-w-[240px] max-w-sm shadow-lg backdrop-blur-sm ${t.type === 'error' ? 'bg-red-600 border-red-500/30' : t.type === 'info' ? 'bg-blue-600 border-blue-500/30' : 'bg-emerald-600 border-emerald-500/30'
                        }`}
                >
                    {t.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 opacity-95" strokeWidth={2.25} />}
                    {t.type === 'error' && <XCircle className="w-4 h-4 shrink-0 opacity-95" strokeWidth={2.25} />}
                    {t.type === 'info' && <Info className="w-4 h-4 shrink-0 opacity-95" strokeWidth={2.25} />}
                    <span className="leading-snug">{t.msg}</span>
                </div>
            ))}
        </div>
    );
}

// Re-export useAppStore and PLAN_FEATURES for convenience
// eslint-disable-next-line react-refresh/only-export-components
export { useAppStore } from '../lib/store';
export { PLAN_FEATURES, PLAN_LIMITS } from '../types';
