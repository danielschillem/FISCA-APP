import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Plan } from '../types';

interface AuthState {
    token: string | null;
    user: User | null;
    companyId: string | null;
    impersonating: boolean;        // true quand un super_admin inspecte un user
    realAdminToken: string | null; // token original du super_admin pour restaurer
    setAuth: (token: string, user: User) => void;
    setCompanyId: (id: string) => void;
    startImpersonate: (token: string, user: User) => void;
    stopImpersonate: () => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            user: null,
            companyId: null,
            impersonating: false,
            realAdminToken: null,
            setAuth: (token, user) => {
                localStorage.setItem('fisca_token', token);
                set({ token, user });
            },
            setCompanyId: (id) => {
                localStorage.setItem('fisca_company_id', id);
                set({ companyId: id });
            },
            startImpersonate: (token, user) => {
                const realToken = get().token;
                localStorage.setItem('fisca_token', token);
                set({ token, user, impersonating: true, realAdminToken: realToken });
            },
            stopImpersonate: () => {
                const realToken = get().realAdminToken;
                if (realToken) localStorage.setItem('fisca_token', realToken);
                set({ token: realToken, impersonating: false, realAdminToken: null });
                window.location.href = '/admin';
            },
            logout: () => {
                localStorage.removeItem('fisca_token');
                localStorage.removeItem('fisca_company_id');
                set({ token: null, user: null, companyId: null });
            },
        }),
        { name: 'fisca-auth' }
    )
);

// --- App state (plan demo, current view) ----------------------

interface AppState {
    plan: Plan;
    setPlan: (p: Plan) => void;
    sidebarOpen: boolean;
    toggleSidebar: () => void;
    notifOpen: boolean;
    toggleNotif: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    plan: 'starter',
    setPlan: (p) => set({ plan: p }),
    sidebarOpen: true,
    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    notifOpen: false,
    toggleNotif: () => set((s) => ({ notifOpen: !s.notifOpen })),
}));

// Sync plan depuis useAuthStore vers useAppStore.
// On initialise immédiatement (persist hydrate AVANT l'enregistrement du subscriber),
// puis on reste à l'écoute des changements ultérieurs (login, refresh, impersonate).
{
    const initialPlan = useAuthStore.getState().user?.plan;
    if (initialPlan) useAppStore.getState().setPlan(initialPlan as Plan);
}
useAuthStore.subscribe((state) => {
    if (state.user?.plan) {
        useAppStore.getState().setPlan(state.user.plan as Plan);
    }
});

// --- Toast store (notifications éphémères) ----------------------------

interface ToastItem { id: number; msg: string; type: 'success' | 'error' | 'info' }
interface ToastStore {
    toasts: ToastItem[];
    toast: (msg: string, type?: ToastItem['type']) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
    toasts: [],
    toast: (msg, type = 'success') => {
        const id = Date.now();
        set((s) => ({ toasts: [...s.toasts, { id, msg, type }] }));
        setTimeout(() => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3500);
    },
}));
