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
    list: () => api.get('/declarations'),
    create: (data: unknown) => api.post('/declarations', data),
    delete: (id: string) => api.delete(`/declarations/${id}`),
}

export const companyApi = {
    get: () => api.get('/company'),
    update: (data: unknown) => api.put('/company', data),
}
