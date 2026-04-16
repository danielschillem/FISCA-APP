import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
    baseURL: BASE,
    headers: { 'Content-Type': 'application/json' },
});

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('fisca_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    const companyId = localStorage.getItem('fisca_company_id');
    if (companyId) config.headers['X-Company-ID'] = companyId;
    return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
    (res) => res,
    async (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('fisca_token');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

// ── Auth ─────────────────────────────────────────────────────
export const authApi = {
    login: (data: { email: string; password: string }) =>
        api.post('/auth/login', data),
    register: (data: { email: string; password: string; nom: string }) =>
        api.post('/auth/register', data),
    forgotPassword: (email: string) =>
        api.post('/auth/forgot-password', { email }),
    resetPassword: (token: string, password: string) =>
        api.post('/auth/reset-password', { token, password }),
    logout: () => api.post('/auth/logout'),
    me: () => api.get('/me'),
    updateMe: (data: object) => api.put('/me', data),
    changePassword: (data: object) => api.put('/me/password', data),
    setPlan: (plan: string) => api.patch('/me/plan', { plan }),
};

// ── Employees ─────────────────────────────────────────────────
export const employeeApi = {
    list: () => api.get('/employees'),
    create: (data: object) => api.post('/employees', data),
    update: (id: string, data: object) => api.put(`/employees/${id}`, data),
    delete: (id: string) => api.delete(`/employees/${id}`),
    export: () => api.get('/employees/export', { responseType: 'blob' }),
    import: (file: File) => {
        const fd = new FormData();
        fd.append('file', file);
        return api.post('/employees/import', fd, {
            headers: { 'Content-Type': 'text/csv; charset=utf-8' },
        });
    },
};

// ── Calcul ────────────────────────────────────────────────────
export const calculApi = {
    calcul: (data: object) => api.post('/calcul', data),
    tva: (data: object) => api.post('/calcul/tva', data),
    ras: (data: object) => api.post('/calcul/ras', data),
    irf: (data: object) => api.post('/calcul/irf', data),
    ircm: (data: object) => api.post('/calcul/ircm', data),
    is: (data: object) => api.post('/calcul/is', data),
    mfp: (data: object) => api.post('/calcul/mfp', data),
    cme: (data: object) => api.post('/calcul/cme', data),
    patente: (data: object) => api.post('/calcul/patente', data),
    penalites: (data: object) => api.post('/calcul/penalites', data),
};

// ── Declarations ──────────────────────────────────────────────
export const declarationApi = {
    list: (annee?: number) => api.get('/declarations', { params: annee ? { annee } : undefined }),
    create: (data: object) => api.post('/declarations', data),
    get: (id: string) => api.get(`/declarations/${id}`),
    exportDecl: (id: string) => api.get(`/declarations/${id}/export`, { responseType: 'blob' }),
    delete: (id: string) => api.delete(`/declarations/${id}`),
    soumettre: (id: string, data?: object) => api.post(`/declarations/${id}/soumettre`, data),
    approuver: (id: string, data?: object) => api.post(`/declarations/${id}/approuver`, data),
    rejeter: (id: string, data?: object) => api.post(`/declarations/${id}/rejeter`, data),
    workflow: (id: string) => api.get(`/declarations/${id}/workflow`),
};

// ── Company ───────────────────────────────────────────────────
export const companyApi = {
    get: () => api.get('/company'),
    update: (data: object) => api.put('/company', data),
    list: () => api.get('/companies'),
    create: (data: object) => api.post('/companies', data),
    updateById: (id: string, data: object) => api.put(`/companies/${id}`, data),
    delete: (id: string) => api.delete(`/companies/${id}`),
};

// ── Bulletins ─────────────────────────────────────────────────
export const bulletinApi = {
    list: (mois?: number, annee?: number) => api.get('/bulletins', { params: { mois, annee } }),
    generate: (data: object) => api.post('/bulletins/generate', data),
    get: (id: string) => api.get(`/bulletins/${id}`),
    export: (id: string) => api.get(`/bulletins/${id}/export`, { responseType: 'blob' }),
    delete: (id: string) => api.delete(`/bulletins/${id}`),
};

// ── Simulations ───────────────────────────────────────────────
export const simulationApi = {
    list: () => api.get('/simulations'),
    create: (data: object) => api.post('/simulations', data),
    get: (id: string) => api.get(`/simulations/${id}`),
    delete: (id: string) => api.delete(`/simulations/${id}`),
};

// ── TVA ───────────────────────────────────────────────────────
export const tvaApi = {
    list: () => api.get('/tva'),
    create: (data: object) => api.post('/tva', data),
    get: (id: string) => api.get(`/tva/${id}`),
    update: (id: string, data: object) => api.put(`/tva/${id}`, data),
    delete: (id: string) => api.delete(`/tva/${id}`),
    export: (id: string) => api.get(`/tva/${id}/export`, { responseType: 'blob' }),
    addLigne: (id: string, data: object) => api.post(`/tva/${id}/lignes`, data),
    deleteLigne: (id: string, lid: string) => api.delete(`/tva/${id}/lignes/${lid}`),
};

// ── Retenues à la source ──────────────────────────────────────
export const retenueApi = {
    taux: () => api.get('/retenues/taux'),
    list: (mois?: number, annee?: number) => api.get('/retenues', { params: { mois, annee } }),
    create: (data: object) => api.post('/retenues', data),
    get: (id: string) => api.get(`/retenues/${id}`),
    update: (id: string, data: object) => api.put(`/retenues/${id}`, data),
    delete: (id: string) => api.delete(`/retenues/${id}`),
    export: (id: string) => api.get(`/retenues/${id}/export`, { responseType: 'blob' }),
};

// ── CNSS Patronal ─────────────────────────────────────────────
export const cnssApi = {
    list: (mois?: number, annee?: number) => api.get('/cnss', { params: { mois, annee } }),
    generate: (data: object) => api.post('/cnss/generer', data),
    generer: (data: object) => api.post('/cnss/generer', data),
    get: (id: string) => api.get(`/cnss/${id}`),
    valider: (id: string) => api.put(`/cnss/${id}/valider`),
    delete: (id: string) => api.delete(`/cnss/${id}`),
    export: (id: string) => api.get(`/cnss/${id}/export`, { responseType: 'blob' }),
};

// ── Historique fiscal ─────────────────────────────────────────
export const historiqueApi = {
    get: (annee: number) => api.get('/historique-fiscal', { params: { annee } }),
    annees: () => api.get('/historique-fiscal/annees'),
};

// ── Exercice fiscal ───────────────────────────────────────────
export const exerciceApi = {
    actif: () => api.get('/exercice/actif'),
    list: () => api.get('/exercice'),
    create: (data: object) => api.post('/exercice', data),
    update: (id: string, data: object) => api.put(`/exercice/${id}`, data),
    cloturer: (id: string) => api.put(`/exercice/${id}/cloturer`),
};

// ── Dashboard ─────────────────────────────────────────────────
export const dashboardApi = {
    get: () => api.get('/dashboard'),
};

// ── Notifications ─────────────────────────────────────────────
export const notificationApi = {
    list: () => api.get('/notifications'),
};

// ── Workflow ─────────────────────────────────────────────────
export const workflowApi = {
    list: (statut?: string) => api.get('/workflow', { params: statut ? { statut } : undefined }),
    get: (id: string) => api.get(`/declarations/${id}/workflow`),
    transition: (id: string, action: string) => api.post(`/declarations/${id}/${action}`),
};

// ── Assistant IA ──────────────────────────────────────────────
export const assistantApi = {
    chat: (message: string) => api.post('/assistant', { message }),
};
