import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Plan } from '../types';

interface AuthState {
    token: string | null;
    user: User | null;
    companyId: string | null;
    setAuth: (token: string, user: User) => void;
    setCompanyId: (id: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            companyId: null,
            setAuth: (token, user) => {
                localStorage.setItem('fisca_token', token);
                set({ token, user });
            },
            setCompanyId: (id) => {
                localStorage.setItem('fisca_company_id', id);
                set({ companyId: id });
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

// ─── App state (plan demo, current view) ──────────────────────

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

// Keep plan in sync with user.plan when user is set
useAuthStore.subscribe((state) => {
    if (state.user?.plan) {
        useAppStore.getState().setPlan(state.user.plan as Plan);
    }
});
