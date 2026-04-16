import { useAppStore, useAuthStore } from '../lib/store';
import { Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { notificationApi } from '../lib/api';
import type { Notification } from '../types';

interface TopbarProps {
    title: string;
    subtitle?: string;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
    const { toggleSidebar, toggleNotif } = useAppStore();
    const { user } = useAuthStore();

    const { data: notifs } = useQuery<Notification[]>({
        queryKey: ['notifications'],
        queryFn: () => notificationApi.list().then((r) => r.data),
        enabled: !!user,
        refetchInterval: 60_000,
    });

    const unread = notifs?.filter((n) => !n.lu).length ?? 0;

    return (
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button
                    onClick={toggleSidebar}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
                    aria-label="Menu"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                </button>
                <div>
                    <h1 className="text-base font-semibold text-gray-900">{title}</h1>
                    {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={toggleNotif}
                    className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
                    aria-label="Notifications"
                >
                    <Bell className="w-5 h-5" />
                    {unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                            {unread}
                        </span>
                    )}
                </button>
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                    {user?.email?.slice(0, 2).toUpperCase() ?? 'US'}
                </div>
            </div>
        </header>
    );
}
