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
    const { user } = useAuthStore();

    const { data: notifs } = useQuery<Notification[]>({
        queryKey: ['notifications'],
        queryFn: () => notificationApi.list().then((r) => r.data),
        enabled: !!user,
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
        if (!user || !('Notification' in window)) return;

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
    }, [user?.email]); // Une seule fois par session utilisateur
    const now = new Date();
    const dateStr = `${JOURS[now.getDay()]} ${now.getDate()} ${MOIS[now.getMonth()]} ${now.getFullYear()}`;
    const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'US';

    return (
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm px-5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <button
                    onClick={toggleSidebar}
                    className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors text-gray-500 hover:text-gray-700"
                    aria-label="Menu"
                >
                    <Menu className="w-5 h-5" />
                </button>
                <div className="hidden sm:block">
                    <h1 className="text-[15px] font-semibold text-gray-900 leading-tight">{title}</h1>
                    {subtitle && <p className="text-[11px] text-gray-400">{subtitle}</p>}
                </div>
                <h1 className="sm:hidden text-[15px] font-semibold text-gray-900">{title}</h1>
            </div>

            <div className="flex items-center gap-2">
                {/* Date chip */}
                <div className="hidden md:flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-full px-3 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-gray-500 font-medium">{dateStr}</span>
                </div>

                {/* Notifications */}
                <button
                    onClick={toggleNotif}
                    className="relative p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors text-gray-500 hover:text-gray-700"
                    aria-label="Notifications"
                >
                    <Bell className="w-5 h-5" />
                    {unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold shadow-sm">
                            {unread > 9 ? '9+' : unread}
                        </span>
                    )}
                </button>

                {/* User avatar */}
                <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm cursor-default select-none"
                    style={{ background: 'linear-gradient(135deg, #16a34a, #0d9488)' }}
                    title={user?.email}
                >
                    {initials}
                </div>
            </div>
        </header>
    );
}

