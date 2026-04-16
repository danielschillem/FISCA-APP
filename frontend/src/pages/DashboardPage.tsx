import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, declarationApi } from '../lib/api';
import { StatCard, Card, Badge, Spinner } from '../components/ui';
import { fmt, calcPenalite } from '../lib/fiscalCalc';
import { MOIS_FR } from '../types';
import { BarChart2, TrendingUp, Users, User, AlertTriangle, CheckCircle2, Clock, Minus } from 'lucide-react';

const MOIS_COURT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export default function DashboardPage() {
    const { data: kpi, isLoading: kpiLoading } = useQuery({
        queryKey: ['dashboard'],
        queryFn: () => dashboardApi.get().then((r) => r.data),
    });

    const { data: declarations = [] } = useQuery({
        queryKey: ['declarations'],
        queryFn: () => declarationApi.list().then((r) => r.data),
    });

    const now = new Date();
    const moisActuel = now.getMonth(); // 0-based

    const retards = declarations.filter((d: { statut: string }) => d.statut === 'retard');
    const totalPenalites = retards.reduce((sum: number, d: { iuts_total: number; mois: number }) => {
        const moisRetard = moisActuel - d.mois + 1;
        return sum + calcPenalite(d.iuts_total, Math.max(0, moisRetard));
    }, 0);

    if (kpiLoading) return <Spinner />;

    return (
        <div className="space-y-6">
            {/* Alert retards */}
            {retards.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-red-700 text-sm">
                            {retards.length} déclaration(s) en retard
                        </p>
                        <p className="text-xs text-red-600 mt-0.5">
                            Périodes : {retards.map((d: { periode: string }) => d.periode).join(', ')}.
                            {totalPenalites > 0 && (
                                <> Pénalités estimées : <strong>{fmt(totalPenalites)}</strong></>
                            )}
                        </p>
                    </div>
                </div>
            )}

            {/* KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                    label="IUTS Net"
                    value={fmt(kpi?.iuts_total ?? 0)}
                    sub={`${MOIS_FR[moisActuel]} ${now.getFullYear()}`}
                    color="green"
                    icon={<BarChart2 className="w-5 h-5" />}
                />
                <StatCard
                    label="TPA (3 %)"
                    value={fmt(kpi?.tpa_total ?? 0)}
                    sub={`${kpi?.nb_salaries ?? 0} salarié(s)`}
                    color="blue"
                    icon={<TrendingUp className="w-5 h-5" />}
                />
                <StatCard
                    label="Cotisations CNSS/CARFO"
                    value={fmt(kpi?.css_total ?? 0)}
                    sub="Part salariale"
                    color="orange"
                    icon={<Users className="w-5 h-5" />}
                />
                <StatCard
                    label="Salariés"
                    value={String(kpi?.nb_salaries ?? 0)}
                    sub="Employés actifs"
                    color="gray"
                    icon={<User className="w-5 h-5" />}
                />
            </div>

            {/* Calendrier fiscal + Activité */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Calendrier */}
                <Card title="Calendrier fiscal 2025–2026">
                    <div className="grid grid-cols-6 gap-2">
                        {MOIS_COURT.map((m, idx) => {
                            const decl = declarations.find(
                                (d: { mois: number; statut: string }) => d.mois === idx + 1
                            );
                            let bg = 'bg-gray-100 text-gray-500';
                            let badge: React.ReactNode = <Minus className="w-3 h-3" />;
                            if (decl) {
                                if (decl.statut === 'ok') { bg = 'bg-green-100 text-green-700'; badge = <CheckCircle2 className="w-3 h-3" />; }
                                else if (decl.statut === 'retard') { bg = 'bg-red-100 text-red-600'; badge = <AlertTriangle className="w-3 h-3" />; }
                                else { bg = 'bg-orange-100 text-orange-600'; badge = <Clock className="w-3 h-3" />; }
                            } else if (idx === moisActuel) {
                                bg = 'bg-blue-100 text-blue-600'; badge = <Clock className="w-3 h-3" />;
                            }
                            return (
                                <div key={m} className={`${bg} rounded-lg py-2 text-center`}>
                                    <p className="text-[11px] font-medium">{m}</p>
                                    <div className="flex justify-center mt-0.5">{badge}</div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex gap-4 mt-4 text-[11px] text-gray-500">
                        <span><span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-1" />Déclaré</span>
                        <span><span className="inline-block w-2 h-2 bg-red-400 rounded-full mr-1" />Retard</span>
                        <span><span className="inline-block w-2 h-2 bg-orange-400 rounded-full mr-1" />En cours</span>
                        <span><span className="inline-block w-2 h-2 bg-gray-300 rounded-full mr-1" />Attendu</span>
                    </div>
                </Card>

                {/* Activité récente */}
                <Card title="Activité récente">
                    {declarations.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">Aucune déclaration pour l'instant</p>
                    ) : (
                        <div className="space-y-3">
                            {[...declarations].slice(-5).reverse().map((d: {
                                id: string; periode: string; statut: string;
                                date_depot: string | null; ref: string | null; iuts_total: number;
                            }) => (
                                <div key={d.id} className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${d.statut === 'ok' ? 'bg-green-100 text-green-600' : d.statut === 'retard' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                                        }`}>
                                        {d.statut === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : d.statut === 'retard' ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">
                                            Déclaration {d.periode}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {d.date_depot
                                                ? new Date(d.date_depot).toLocaleDateString('fr-BF')
                                                : 'En attente'}
                                            {d.ref && ` · ${d.ref}`}
                                        </p>
                                    </div>
                                    <Badge color={d.statut === 'ok' ? 'green' : d.statut === 'retard' ? 'red' : 'orange'}>
                                        {d.statut === 'ok' ? 'Déclaré' : d.statut === 'retard' ? 'Retard' : 'En cours'}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            {/* Obligations fiscales du mois */}
            <Card title="Obligations fiscales — Échéances">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {[
                        { label: 'IUTS / TPA', echeance: '15 du mois', desc: 'Déclaration et paiement CGI Art. 122' },
                        { label: 'CNSS Part patronale', echeance: '15 du mois', desc: 'Allocations + accidents + retraite' },
                        { label: 'TVA', echeance: '15 du mois', desc: 'Déclaration mensuelle si CA ≥ 50 M/an' },
                        { label: 'Retenue à la source', echeance: '15 du mois', desc: 'CGI Art. 206–226' },
                        { label: 'IRF', echeance: '15 du mois', desc: 'Loyers versés — CGI Art. 121–126' },
                        { label: 'Acompte IS/MFP', echeance: '31 mars', desc: '1/4 IS théorique — CGI Art. 95' },
                    ].map((o) => (
                        <div key={o.label} className="border border-gray-100 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-gray-800">{o.label}</p>
                                <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium">
                                    {o.echeance}
                                </span>
                            </div>
                            <p className="text-[11px] text-gray-500">{o.desc}</p>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}

