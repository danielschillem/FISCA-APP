import { useEffect, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { companyApi, contribuableApi } from '../lib/api';
import type { Company } from '../types';
import { useContribuableStore } from '../contribuable/contribuableStore';
import { apiCompanyToLocal } from '../contribuable/companySync';
import { DECLARATIONS_SUBNAV } from '../contribuable/contribuableNav';
import type { AnnexNavCode } from '../contribuable/contribuableStore';
import { useToastStore } from '../lib/store';

export default function DeclarationsLayout() {
    const qc = useQueryClient();
    const toast = useToastStore((s) => s.toast);
    const setCompany = useContribuableStore((s) => s.setCompany);
    const loadFromServerState = useContribuableStore((s) => s.loadFromServerState);
    const toServerState = useContribuableStore((s) => s.toServerState);
    const rowCount = useContribuableStore((s) => s.rowCount);
    const resetAllContribuable = useContribuableStore((s) => s.resetAllContribuable);
    const companyState = useContribuableStore((s) => s.company);
    const periodState = useContribuableStore((s) => s.period);
    const annexesState = useContribuableStore((s) => s.annexes);
    const loadedRef = useRef(false);
    const saveTimerRef = useRef<number | null>(null);

    const handleResetAnnexes = () => {
        if (
            !confirm(
                'Effacer toutes les lignes d’annexes et la période locale ? La fiche entreprise (Paramètres) n’est pas modifiée.',
            )
        )
            return;
        resetAllContribuable();
        localStorage.removeItem('fisca-contribuable-v2');
        void qc.invalidateQueries({ queryKey: ['company'] });
        toast('Données des annexes réinitialisées.', 'success');
    };

    const { data: apiCompany } = useQuery<Company>({
        queryKey: ['company'],
        queryFn: () => companyApi.get().then((r) => r.data),
    });

    useEffect(() => {
        if (!apiCompany) return;
        setCompany(apiCompanyToLocal(apiCompany));
    }, [apiCompany, setCompany]);

    useEffect(() => {
        let cancelled = false;
        void contribuableApi.getState().then((res) => {
            if (cancelled) return;
            const state = res?.data?.state;
            if (state && typeof state === 'object') {
                loadFromServerState(state);
            }
            loadedRef.current = true;
        }).catch(() => {
            loadedRef.current = true;
        });
        return () => {
            cancelled = true;
        };
    }, [loadFromServerState]);

    useEffect(() => {
        if (!loadedRef.current) return;
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => {
            void contribuableApi.saveState(toServerState());
        }, 900);
        return () => {
            if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        };
    }, [companyState, periodState, annexesState, toServerState]);

    return (
        <div className="space-y-5">
            <div className="-mx-0.5 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[var(--card-shadow)]">
                <div className="scrollbar-thin flex flex-wrap items-stretch justify-between gap-2 px-2 py-2 sm:px-3">
                    <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto sm:gap-0.5">
                    {DECLARATIONS_SUBNAV.map((item) => {
                        const n =
                            item.badge === 'none'
                                ? 0
                                : rowCount(item.code as AnnexNavCode);
                        const isArrow = item.badge === 'arrow';
                        const badgeClass =
                            n > 0 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600';
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) =>
                                    [
                                        'shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 sm:px-3.5 sm:py-2.5 sm:text-[13px]',
                                        isActive
                                            ? 'bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-200/80'
                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                                    ].join(' ')
                                }
                            >
                                <span>{item.label}</span>
                                {item.badge !== 'none' && (
                                    <span
                                        className={`ml-1.5 inline-block min-w-[1.25rem] rounded-full px-1 py-0 text-[10px] font-bold ${badgeClass}`}
                                    >
                                        {isArrow ? <ArrowUpRight className="inline w-3 h-3 align-middle opacity-90" /> : n > 0 ? n : '0'}
                                    </span>
                                )}
                            </NavLink>
                        );
                    })}
                    </div>
                    <button
                        type="button"
                        onClick={handleResetAnnexes}
                        className="shrink-0 self-center rounded-lg border border-red-200/90 bg-white px-3 py-2 text-[11px] font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 sm:mr-1"
                    >
                        Réinitialiser les annexes
                    </button>
                </div>
            </div>
            <Outlet />
        </div>
    );
}
