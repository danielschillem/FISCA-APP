import { useAppStore, useAuthStore } from '../lib/store';
import { Bell, Menu } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { notificationApi } from '../lib/api';
import type { Notification } from '../types';
import { getProchaines } from '../lib/fiscalCalendar';

interface TopbarProps {
    title: string;
    subtitle?: string;
}

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MOIS = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];

export default function Topbar({ title, subtitle }: TopbarProps) {
    const { toggleSidebar, toggleNotif } = useAppStore();
    const { user, impersonating } = useAuthStore();
    const canUseCompanyScopedApis = !!user && (user.role !== 'super_admin' || impersonating);

    const { data: notifs } = useQuery<Notification[]>({
        queryKey: ['notifications'],
        queryFn: () => notificationApi.list().then((r) => r.data),
        enabled: canUseCompanyScopedApis,
        refetchInterval: 30_000,
    });

    const unread = notifs?.filter((n) => !n.lu).length ?? 0;
    const prevUnread = useRef(unread);

    useEffect(() => {
        if (unread > prevUnread.current && 'Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            } else if (Notification.permission === 'granted') {
                const fresh = notifs?.filter((n) => !n.lu) ?? [];
                const top = fresh[0];
                if (top) {
                    new Notification(top.titre, {
                        body: top.message,
                        icon: '/favicon.svg',
                    });
                }
            }
        }
        prevUnread.current = unread;
    }, [unread, notifs]);

    // -- Push notifications J-7 : une notification par échéance urgente ------
    useEffect(() => {
        if (!canUseCompanyScopedApis || !('Notification' in window)) return;

        const fire = () => {
            if (Notification.permission !== 'granted') return;

            const now = new Date();
            const annee = now.getFullYear();
            const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
            const prochaines = getProchaines(annee, 10, now);
            const urgentes = prochaines.filter(e => e.joursRestants >= 0 && e.joursRestants <= 7);

            // Envoyer une notification par échéance urgente si pas encore envoyée aujourd'hui
            urgentes.forEach(e => {
                const key = `fisca_notif_${e.id}_${dateStr}`;
                if (localStorage.getItem(key)) return;
                localStorage.setItem(key, '1');
                const quand = e.joursRestants === 0 ? "aujourd'hui" : e.joursRestants === 1 ? 'demain' : `dans ${e.joursRestants} j`;
                new Notification(`Échéance fiscale ${quand} : ${e.label}`, {
                    body: e.description,
                    icon: '/favicon.svg',
                    tag: `echeance-${e.id}-${dateStr}`,
                });
            });
        };

        // Demander la permission si pas encore accordée, puis vérifier
        if (Notification.permission === 'default') {
            Notification.requestPermission().then(() => fire());
        } else {
            fire();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canUseCompanyScopedApis, user?.email]); // Une seule fois par session utilisateur
    const now = new Date();
    const dateStr = `${JOURS[now.getDay()]} ${now.getDate()} ${MOIS[now.getMonth()]} ${now.getFullYear()}`;
    const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'US';

    return (
        <header
            className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md backdrop-saturate-150 sm:px-7"
            style={{ minHeight: 'var(--header-h)', boxShadow: '0 1px 0 rgba(15, 23, 42, 0.04)' }}
        >
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <button
                    onClick={toggleSidebar}
                    className="shrink-0 rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200/80"
                    aria-label="Menu"
                >
                    <Menu className="h-5 w-5" />
                </button>
                <div className="hidden min-w-0 sm:block">
                    <h1 className="truncate text-lg font-semibold leading-tight tracking-tight text-slate-900">{title}</h1>
                    {subtitle && <p className="truncate text-[12px] text-slate-500 mt-0.5">{subtitle}</p>}
                </div>
                <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 sm:hidden">{title}</h1>
            </div>

            <div className="flex items-center gap-2">
                {/* Date chip */}
                <div className="hidden md:flex items-center gap-2 rounded-full border border-slate-200/90 bg-slate-50/90 px-3.5 py-1.5 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]" />
                    <span className="text-xs font-medium text-slate-600 tabular-nums">{dateStr}</span>
                </div>

                {/* Notifications */}
                <button
                    onClick={toggleNotif}
                    className="relative rounded-xl p-2 text-slate-500 ring-1 ring-slate-200/60 transition-colors hover:bg-slate-100 hover:text-slate-800 hover:ring-slate-300/80 active:bg-slate-200/60"
                    aria-label="Notifications"
                >
                    <Bell className="w-5 h-5" />
                    {unread > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-0.5 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
                            {unread > 9 ? '9+' : unread}
                        </span>
                    )}
                </button>

                {/* User avatar */}
                <div
                    className="flex h-9 w-9 cursor-default select-none items-center justify-center rounded-full text-xs font-bold text-white shadow-md ring-2 ring-white"
                    style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}
                    title={user?.email}
                >
                    {initials}
                </div>
            </div>
        </header>
    );
}

