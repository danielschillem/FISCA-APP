import { useAppStore } from '../lib/store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../lib/api';
import type { Notification } from '../types';
import { useAuthStore } from '../lib/store';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Bell, X, CheckCheck } from 'lucide-react';

const NIVEAU_ICON: Record<string, React.ReactNode> = {
    error: <AlertCircle className="w-4 h-4 text-red-500" />,
    warning: <AlertTriangle className="w-4 h-4 text-orange-500" />,
    success: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    info: <Info className="w-4 h-4 text-blue-500" />,
};

const NIVEAU_BG: Record<string, string> = {
    error: 'bg-red-50',
    warning: 'bg-orange-50',
    success: 'bg-green-50',
    info: 'bg-blue-50',
};

export default function NotifPanel() {
    const { notifOpen, toggleNotif } = useAppStore();
    const { user } = useAuthStore();
    const qc = useQueryClient();

    const { data: notifs = [] } = useQuery<Notification[]>({
        queryKey: ['notifications'],
        queryFn: () => notificationApi.list().then((r) => r.data),
        enabled: !!user,
        staleTime: 30_000,
    });

    const readAllMut = useMutation({
        mutationFn: () => notificationApi.readAll(notifs.map((n) => n.id)),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
    });

    const unread = notifs.filter((n) => !n.lu).length;

    if (!notifOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-40" onClick={toggleNotif} />
            <div className="fixed top-0 right-0 h-screen w-80 bg-white border-l border-gray-200 z-50 flex flex-col shadow-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                        Notifications
                        {unread > 0 && (
                            <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">
                                {unread}
                            </span>
                        )}
                    </h2>
                    <div className="flex items-center gap-2">
                        {unread > 0 && (
                            <button
                                onClick={() => readAllMut.mutate()}
                                disabled={readAllMut.isPending}
                                className="flex items-center gap-1 text-xs text-green-600 hover:underline disabled:opacity-50"
                                title="Tout marquer comme lu"
                            >
                                <CheckCheck className="w-3.5 h-3.5" />
                                Tout lu
                            </button>
                        )}
                        <button
                            onClick={() => qc.invalidateQueries({ queryKey: ['notifications'] })}
                            className="text-xs text-gray-400 hover:text-gray-600"
                            title="Actualiser"
                        >
                            ↺
                        </button>
                        <button onClick={toggleNotif} className="text-gray-400 hover:text-gray-600 ml-1"><X className="w-4 h-4" /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {notifs.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <Bell className="w-8 h-8 mb-2 mx-auto text-gray-300" />
                            <p className="text-sm">Aucune notification</p>
                        </div>
                    ) : (
                        notifs.map((n) => (
                            <div
                                key={n.id}
                                className={`px-5 py-3 border-b border-gray-50 transition-opacity ${n.lu ? 'opacity-60' : ''} ${NIVEAU_BG[n.niveau] ?? ''}`}
                            >
                                <div className="flex items-start gap-2">
                                    <span className="shrink-0 mt-0.5">{NIVEAU_ICON[n.niveau] ?? 'ℹ️'}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-xs font-semibold text-gray-800 ${!n.lu ? 'font-bold' : ''}`}>{n.titre}</p>
                                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                                        {n.periode && (
                                            <p className="text-[10px] text-gray-400 mt-1">Période : {n.periode}</p>
                                        )}
                                        {n.lien && (
                                            <a
                                                href={n.lien}
                                                onClick={toggleNotif}
                                                className="text-[10px] text-green-600 hover:underline mt-1 block"
                                            >
                                                Voir →
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
