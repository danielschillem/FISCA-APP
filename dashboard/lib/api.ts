import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export const api = axios.create({
    baseURL: `${API_URL}/api`,
    headers: { 'Content-Type': 'application/json' },
})

// Injecter le token JWT dans chaque requête
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('fisca_token')
        if (token) config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// Redirection sur 401
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401 && typeof window !== 'undefined') {
            localStorage.removeItem('fisca_token')
            window.location.href = '/login'
        }
        return Promise.reject(err)
    }
)

// ─── Helpers API ──────────────────────────────────────────────

export const authApi = {
    login: (data: { email: string; password: string }) =>
        api.post('/auth/login', data),
    register: (data: { email: string; password: string; nom: string }) =>
        api.post('/auth/register', data),
    forgotPassword: (email: string) =>
        api.post('/auth/forgot-password', { email }),
    resetPassword: (token: string, password: string) =>
        api.post('/auth/reset-password', { token, password }),
    refresh: (refreshToken: string) =>
        api.post('/auth/refresh', { refresh_token: refreshToken }),
    logout: (refreshToken?: string) =>
        api.post('/auth/logout', { refresh_token: refreshToken ?? '' }),
}

export const employeesApi = {
    list: () => api.get('/employees'),
    create: (e: unknown) => api.post('/employees', e),
    update: (id: string, e: unknown) => api.put(`/employees/${id}`, e),
    delete: (id: string) => api.delete(`/employees/${id}`),
}

export const calculApi = {
    calcul: (data: unknown) => api.post('/calcul', data),
}

export const declarationsApi = {
    list: (page = 1, limit = 100) => api.get(`/declarations?page=${page}&limit=${limit}`),
    get: (id: string) => api.get(`/declarations/${id}`),
    create: (data: unknown) => api.post('/declarations', data),
    delete: (id: string) => api.delete(`/declarations/${id}`),
    exportUrl: (id: string) => `${API_URL}/api/declarations/${id}/export`,
}

export const companyApi = {
    get: () => api.get('/company'),
    update: (data: unknown) => api.put('/company', data),
}

// ─── Nouvelles APIs ──────────────────────────────────────────

export const userApi = {
    me: () => api.get('/me'),
    updateMe: (data: { email: string }) => api.put('/me', data),
    changePassword: (data: { current_password: string; new_password: string }) =>
        api.put('/me/password', data),
}

export const dashboardApi = {
    get: () => api.get('/dashboard'),
}

export const notificationsApi = {
    list: () => api.get('/notifications'),
}

export const bulletinsApi = {
    list: (mois?: number, annee?: number) => {
        const params = new URLSearchParams()
        if (mois) params.set('mois', String(mois))
        if (annee) params.set('annee', String(annee))
        return api.get(`/bulletins?${params}`)
    },
    generate: (data: { mois: number; annee: number; cotisation: string }) =>
        api.post('/bulletins/generate', data),
    get: (id: string) => api.get(`/bulletins/${id}`),
    exportUrl: (id: string) => `${API_URL}/api/bulletins/${id}/export`,
    delete: (id: string) => api.delete(`/bulletins/${id}`),
}

export const simulationsApi = {
    list: () => api.get('/simulations'),
    create: (data: { label: string; input: unknown }) => api.post('/simulations', data),
    get: (id: string) => api.get(`/simulations/${id}`),
    delete: (id: string) => api.delete(`/simulations/${id}`),
}

export const tvaApi = {
    list: () => api.get('/tva'),
    create: (data: unknown) => api.post('/tva', data),
    get: (id: string) => api.get(`/tva/${id}`),
    update: (id: string, data: unknown) => api.put(`/tva/${id}`, data),
    delete: (id: string) => api.delete(`/tva/${id}`),
    exportUrl: (id: string) => `${API_URL}/api/tva/${id}/export`,
    addLigne: (id: string, data: unknown) => api.post(`/tva/${id}/lignes`, data),
    deleteLigne: (id: string, lid: string) => api.delete(`/tva/${id}/lignes/${lid}`),
}

export const companiesApi = {
    list: () => api.get('/companies'),
    create: (data: unknown) => api.post('/companies', data),
    update: (id: string, data: unknown) => api.put(`/companies/${id}`, data),
    delete: (id: string) => api.delete(`/companies/${id}`),
}

export const workflowApi = {
    history: (declId: string) => api.get(`/declarations/${declId}/workflow`),
    soumettre: (declId: string, commentaire?: string) =>
        api.post(`/declarations/${declId}/soumettre`, { commentaire }),
    approuver: (declId: string, commentaire?: string) =>
        api.post(`/declarations/${declId}/approuver`, { commentaire }),
    rejeter: (declId: string, commentaire?: string) =>
        api.post(`/declarations/${declId}/rejeter`, { commentaire }),
}

export const assistantApi = {
    chat: (message: string) => api.post('/assistant', { message }),
}

// Helper pour injecter X-Company-ID
export function setActiveCompany(companyId: string | null) {
    if (companyId) {
        api.defaults.headers.common['X-Company-ID'] = companyId
    } else {
        delete api.defaults.headers.common['X-Company-ID']
    }
}

export const retenuesApi = {
    taux: () => api.get('/retenues/taux'),
    list: () => api.get('/retenues'),
    create: (data: unknown) => api.post('/retenues', data),
    get: (id: string) => api.get(`/retenues/${id}`),
    update: (id: string, data: unknown) => api.put(`/retenues/${id}`, data),
    delete: (id: string) => api.delete(`/retenues/${id}`),
    exportUrl: (id: string) => `${API_URL}/api/retenues/${id}/export`,
}

export const cnssApi = {
    list: () => api.get('/cnss'),
    generer: (data: { mois: number; annee: number }) => api.post('/cnss/generer', data),
    get: (id: string) => api.get(`/cnss/${id}`),
    valider: (id: string) => api.put(`/cnss/${id}/valider`, {}),
    delete: (id: string) => api.delete(`/cnss/${id}`),
    exportUrl: (id: string) => `${API_URL}/api/cnss/${id}/export`,
}

export const historiqueFiscalApi = {
    get: (annee?: number) => api.get(`/historique-fiscal${annee ? `?annee=${annee}` : ''}`),
    annees: () => api.get('/historique-fiscal/annees'),
}

export const exerciceApi = {
    list: () => api.get('/exercice'),
    actif: () => api.get('/exercice/actif'),
    create: (data: { annee: number; date_debut?: string; date_fin?: string; note?: string }) =>
        api.post('/exercice', data),
    update: (id: string, data: { date_debut?: string; date_fin?: string; note?: string }) =>
        api.put(`/exercice/${id}`, data),
    cloturer: (id: string) => api.put(`/exercice/${id}/cloturer`, {}),
}
