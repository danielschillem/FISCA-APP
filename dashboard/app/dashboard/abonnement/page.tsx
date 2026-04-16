'use client'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import type { User } from '@/types'
import { Check, X, Crown, Zap, Rocket } from 'lucide-react'
import toast from 'react-hot-toast'

const PLANS = [
    {
        id: 'starter',
        label: 'Starter',
        price: 'Gratuit',
        priceDetail: '+ 2 000 FCFA / rapport',
        color: '#6b7280',
        bg: '#f9fafb',
        icon: Zap,
        desc: 'Pour les auto-entrepreneurs et micro-entreprises',
    },
    {
        id: 'pro',
        label: 'Pro',
        price: '15 000 FCFA',
        priceDetail: '/ mois · rapports inclus',
        color: '#24a05a',
        bg: '#f0fdf4',
        icon: Rocket,
        desc: 'Pour les PME et cabinets comptables',
        recommended: true,
    },
    {
        id: 'enterprise',
        label: 'Entreprise',
        price: 'Sur devis',
        priceDetail: 'engagement annuel',
        color: '#f97316',
        bg: '#fff7ed',
        icon: Crown,
        desc: 'Pour les grands comptes et groupes multi-entités',
    },
]

const FEAT_MATRIX = [
    { label: 'Employés', starter: '5 max', pro: '50 max', ent: 'Illimité' },
    { label: 'Calcul IUTS / TPA', starter: true, pro: true, ent: true },
    { label: 'Rapports mensuels', starter: 'Payant', pro: 'Inclus', ent: 'Inclus' },
    { label: 'Bulletins de paie PDF', starter: false, pro: true, ent: true },
    { label: 'Simulateur fiscal A/B', starter: false, pro: true, ent: true },
    { label: 'Module TVA complet', starter: false, pro: true, ent: true },
    { label: 'IRF — Revenus fonciers', starter: false, pro: true, ent: true },
    { label: 'IRCM — Capitaux mobiliers', starter: false, pro: true, ent: true },
    { label: 'Assistant IA fiscal', starter: false, pro: true, ent: true },
    { label: 'Export CSV / XLSX', starter: true, pro: true, ent: true },
    { label: 'Multi-sociétés', starter: false, pro: false, ent: true },
    { label: 'Workflow approbation', starter: false, pro: false, ent: true },
    { label: 'Retenue à la source', starter: false, pro: false, ent: true },
    { label: 'CNSS patronal complet', starter: false, pro: false, ent: true },
    { label: 'CME / IS / Patentes', starter: false, pro: false, ent: true },
    { label: 'API & Webhooks', starter: false, pro: false, ent: true },
    { label: 'Archivage 10 ans', starter: false, pro: false, ent: true },
    { label: 'Support prioritaire', starter: false, pro: 'Email', ent: 'Dédié' },
]

function FeatCell({ v }: { v: boolean | string }) {
    if (v === false) return <X size={14} style={{ color: '#d1d5db' }} />
    if (v === true) return <Check size={14} style={{ color: '#24a05a' }} />
    return <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{v}</span>
}

export default function AbonnementPage() {
    const { user, token, setAuth } = useAuthStore()
    const currentPlan = user?.plan ?? 'starter'

    const switchMut = useMutation({
        mutationFn: (plan: string) => api.patch('/me/plan', { plan }),
        onSuccess: (_res, plan) => {
            if (user && token) {
                setAuth(token, { ...user, plan: plan as User['plan'] })
            }
            toast.success(`Plan changé vers ${plan}`)
        },
        onError: () => toast.error('Erreur lors du changement de plan'),
    })

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontWeight: 700, fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Crown size={20} /> Abonnement & Plan
                </h2>
                <p style={{ fontSize: 13, color: 'var(--gr5)', marginTop: 4 }}>
                    Plan actuel : <strong style={{ color: PLANS.find(p => p.id === currentPlan)?.color }}>{PLANS.find(p => p.id === currentPlan)?.label}</strong>
                </p>
            </div>

            {/* Grille des plans */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
                {PLANS.map((plan) => {
                    const Icon = plan.icon
                    const isCurrent = currentPlan === plan.id
                    return (
                        <div key={plan.id} style={{
                            background: plan.bg,
                            border: `2px solid ${isCurrent ? plan.color : 'var(--gr2)'}`,
                            borderRadius: 14, padding: '20px 20px 16px',
                            position: 'relative', overflow: 'hidden',
                        }}>
                            {plan.recommended && (
                                <div style={{
                                    position: 'absolute', top: 12, right: 12,
                                    background: plan.color, color: 'white',
                                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                                }}>
                                    RECOMMANDÉ
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <Icon size={20} style={{ color: plan.color }} />
                                <span style={{ fontWeight: 700, fontSize: 16, color: plan.color }}>{plan.label}</span>
                            </div>
                            <p style={{ fontWeight: 800, fontSize: 22, color: '#111', marginBottom: 2 }}>{plan.price}</p>
                            <p style={{ fontSize: 12, color: 'var(--gr5)', marginBottom: 10 }}>{plan.priceDetail}</p>
                            <p style={{ fontSize: 13, color: 'var(--gr6)', marginBottom: 16 }}>{plan.desc}</p>
                            {isCurrent ? (
                                <div style={{
                                    background: plan.color, color: 'white',
                                    textAlign: 'center', borderRadius: 8,
                                    padding: '8px 0', fontSize: 13, fontWeight: 600,
                                }}>
                                    Plan actuel ✓
                                </div>
                            ) : plan.id === 'enterprise' ? (
                                <a href="mailto:contact@fisca.bf" style={{
                                    display: 'block', textAlign: 'center',
                                    border: `1.5px solid ${plan.color}`, color: plan.color,
                                    borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 600,
                                    textDecoration: 'none',
                                }}>
                                    Nous contacter
                                </a>
                            ) : (
                                <button
                                    onClick={() => switchMut.mutate(plan.id)}
                                    disabled={switchMut.isPending}
                                    style={{
                                        width: '100%', background: plan.color, color: 'white',
                                        border: 'none', borderRadius: 8, padding: '8px 0',
                                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                    }}
                                >
                                    {switchMut.isPending ? 'Changement…' : `Passer au ${plan.label}`}
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Tableau comparatif */}
            <div className="card">
                <div className="card-header"><h3>Comparatif des fonctionnalités</h3></div>
                <div className="card-body" style={{ padding: 0 }}>
                    <table style={{ width: '100%', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--gr2)', background: 'var(--gr1)' }}>
                                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, color: 'var(--gr5)' }}>Fonctionnalité</th>
                                {PLANS.map((p) => (
                                    <th key={p.id} style={{
                                        padding: '10px 16px', textAlign: 'center', fontSize: 13,
                                        fontWeight: 700, color: p.color,
                                        background: currentPlan === p.id ? p.bg : undefined,
                                    }}>
                                        {p.label}
                                        {currentPlan === p.id && <span style={{ fontSize: 10, display: 'block', color: 'var(--gr5)', fontWeight: 400 }}>actuel</span>}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {FEAT_MATRIX.map((row, i) => (
                                <tr key={row.label} style={{
                                    borderBottom: '1px solid var(--gr1)',
                                    background: i % 2 === 0 ? 'transparent' : 'var(--gr1)',
                                }}>
                                    <td style={{ padding: '8px 16px', color: 'var(--gr7)' }}>{row.label}</td>
                                    <td style={{ padding: '8px 16px', textAlign: 'center' }}><FeatCell v={row.starter} /></td>
                                    <td style={{ padding: '8px 16px', textAlign: 'center' }}><FeatCell v={row.pro} /></td>
                                    <td style={{ padding: '8px 16px', textAlign: 'center' }}><FeatCell v={row.ent} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--gr4)', marginTop: 12, textAlign: 'center' }}>
                Prix HT · TVA 18 % non incluse · Facturation mensuelle · Résiliation possible à tout moment
            </p>
        </div>
    )
}

