import { useState } from 'react';
import { useAuthStore, useAppStore } from '../lib/store';
import { authApi } from '../lib/api';
import { PLAN_FEATURES, PLAN_LIMITS, type Plan } from '../types';
import { Card, Btn } from '../components/ui';
import { Check } from 'lucide-react';

const PLANS: { id: Plan; label: string; price: string; priceDetail: string; color: string; desc: string }[] = [
    {
        id: 'starter',
        label: 'Starter',
        price: 'Gratuit',
        priceDetail: '+ 2 000 FCFA / rapport',
        color: '#6b7280',
        desc: 'Pour les auto-entrepreneurs et micro-entreprises',
    },
    {
        id: 'pro',
        label: 'Pro',
        price: '15 000 FCFA',
        priceDetail: '/ mois · rapports inclus',
        color: '#24a05a',
        desc: 'Pour les PME et cabinets comptables',
    },
    {
        id: 'enterprise',
        label: 'Entreprise',
        price: 'Sur devis',
        priceDetail: 'engagement annuel',
        color: '#f97316',
        desc: 'Pour les grands comptes et groupes multi-entités',
    },
];

const FEAT_MATRIX: { label: string; starter: string | boolean; pro: string | boolean; ent: string | boolean }[] = [
    { label: 'Employés', starter: '5 max', pro: '50 max', ent: 'Illimité' },
    { label: 'IUTS / TPA (calcul)', starter: true, pro: true, ent: true },
    { label: 'Rapports mensuels', starter: 'Payant', pro: 'Inclus', ent: 'Inclus' },
    { label: 'Bulletins de paie PDF', starter: false, pro: true, ent: true },
    { label: 'Simulateur fiscal A/B', starter: false, pro: true, ent: true },
    { label: 'Module TVA complet', starter: false, pro: true, ent: true },
    { label: 'IRF — Revenus fonciers', starter: false, pro: true, ent: true },
    { label: 'IRCM — Capitaux mob.', starter: false, pro: true, ent: true },
    { label: 'Assistant IA fiscal', starter: false, pro: true, ent: true },
    { label: 'Export CSV / XLSX', starter: true, pro: true, ent: true },
    { label: 'Multi-sociétés', starter: false, pro: false, ent: true },
    { label: 'Workflow approbation', starter: false, pro: false, ent: true },
    { label: 'Retenue à la source', starter: false, pro: false, ent: true },
    { label: 'CNSS patronal complet', starter: false, pro: false, ent: true },
    { label: 'CME / IS / Patentes', starter: false, pro: false, ent: true },
    { label: 'API & Webhooks', starter: false, pro: false, ent: true },
    { label: 'Archivage 10 ans', starter: false, pro: false, ent: true },
];

export default function AbonnementPage() {
    const { plan, setPlan } = useAppStore();
    const { user } = useAuthStore();

    const [planError, setPlanError] = useState('');

    const switchPlan = async (p: Plan) => {
        setPlanError('');
        try {
            await authApi.setPlan(p);
            setPlan(p);
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 403) {
                setPlanError('Changement de plan réservé à l\'administrateur. Contactez votre admin.');
            } else {
                // Demo / réseau : basculer localement
                setPlan(p);
            }
        }
    };

    const cell = (val: string | boolean, highlight: boolean) => {
        if (val === true) return <td key="c" className="py-2.5 px-4 text-center text-green-600 font-bold"><Check className="w-4 h-4 mx-auto" /></td>;
        if (val === false) return <td key="c" className="py-2.5 px-4 text-center text-gray-300">—</td>;
        return <td key="c" className={`py-2.5 px-4 text-center text-xs ${highlight ? 'font-semibold' : ''}`}>{val}</td>;
    };

    return (
        <div className="space-y-6">
            {/* Current plan */}
            <Card>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                        style={{ background: PLANS.find((p2) => p2.id === plan)?.color ?? '#6b7280' }}>
                        {plan[0].toUpperCase()}
                    </div>
                    <div>
                        <p className="font-semibold text-gray-900">
                            Plan actuel : {PLANS.find((p2) => p2.id === plan)?.label}
                        </p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                </div>
            </Card>

            {planError && (
                <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800">
                    {planError}
                </div>
            )}

            {/* Plan cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLANS.map((p2) => (
                    <div
                        key={p2.id}
                        className={`rounded-xl border-2 p-5 transition-all ${plan === p2.id ? 'shadow-md' : 'border-gray-200'
                            }`}
                        style={plan === p2.id ? { borderColor: p2.color } : {}}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <span className="w-8 h-8 rounded-lg text-white text-sm font-bold flex items-center justify-center"
                                style={{ background: p2.color }}>
                                {p2.label[0]}
                            </span>
                            <span className="font-bold text-gray-900">{p2.label}</span>
                            {plan === p2.id && (
                                <span className="ml-auto text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Actif</span>
                            )}
                        </div>
                        <p className="text-2xl font-bold text-gray-900 mb-0.5" style={{ color: p2.color }}>{p2.price}</p>
                        <p className="text-xs text-gray-400 mb-3">{p2.priceDetail}</p>
                        <p className="text-xs text-gray-500 mb-4">{p2.desc}</p>
                        <Btn
                            className="w-full justify-center"
                            style={{ background: p2.color, borderColor: p2.color }}
                            onClick={() => switchPlan(p2.id)}
                            disabled={plan === p2.id}
                        >
                            {plan === p2.id ? 'Plan actuel' : `Passer à ${p2.label}`}
                        </Btn>
                    </div>
                ))}
            </div>

            {/* Feature matrix */}
            <Card title="Comparaison des fonctionnalités">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs font-semibold text-gray-500 border-b border-gray-200">
                                <th className="text-left py-3 px-4">Fonctionnalité</th>
                                {PLANS.map((p2) => (
                                    <th key={p2.id} className="text-center py-3 px-4" style={{ color: p2.color }}>
                                        {p2.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {FEAT_MATRIX.map((f) => (
                                <tr key={f.label} className="hover:bg-gray-50">
                                    <td className="py-2.5 px-4 text-gray-700">{f.label}</td>
                                    {cell(f.starter, plan === 'starter')}
                                    {cell(f.pro, plan === 'pro')}
                                    {cell(f.ent, plan === 'enterprise')}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

