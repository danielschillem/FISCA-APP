import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, declarationApi } from '../lib/api';
import { StatCard, Card, Badge, Spinner } from '../components/ui';
import { fmt, calcPenalite } from '../lib/fiscalCalc';
import { MOIS_FR } from '../types';
import { BarChart2, TrendingUp, Users, User, AlertTriangle, CheckCircle2, Clock, Minus, CalendarDays, ArrowRight } from 'lucide-react';
import { getProchaines, TYPE_COLORS, type Echeance } from '../lib/fiscalCalendar';

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
    const anneeActuelle = now.getFullYear();
    const prochaines = getProchaines(anneeActuelle, 5, now);
    const navigate = useNavigate();

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

            {/* Prochaines échéances fiscales */}
            <Card title="Prochaines échéances fiscales">
                <div className="space-y-2">
                    {prochaines.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">Aucune échéance à venir</p>
                    ) : (
                        prochaines.map((e: Echeance) => {
                            const urgBg =
                                e.urgence === 'critique' ? 'bg-red-50 border-red-200' :
                                    e.urgence === 'proche' ? 'bg-amber-50 border-amber-200' :
                                        'bg-gray-50 border-gray-100';
                            const urgText =
                                e.urgence === 'critique' ? 'text-red-600' :
                                    e.urgence === 'proche' ? 'text-amber-600' :
                                        'text-gray-500';
                            const dot = TYPE_COLORS[e.type] ?? '#94a3b8';
                            return (
                                <div key={e.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${urgBg}`}>
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dot }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-800">{e.label}</p>
                                        <p className="text-xs text-gray-500 truncate">{e.description}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs font-bold text-gray-700">
                                            {e.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                        </p>
                                        <p className={`text-[11px] font-semibold ${urgText}`}>
                                            {e.joursRestants === 0 ? "Aujourd'hui !" :
                                                e.joursRestants === 1 ? 'Demain' :
                                                    `J-${e.joursRestants}`}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                <button
                    onClick={() => navigate('/calendrier')}
                    className="mt-4 w-full flex items-center justify-center gap-2 text-xs text-green-600 font-semibold hover:text-green-700 py-2 rounded-lg hover:bg-green-50 transition-colors"
                >
                    <CalendarDays className="w-3.5 h-3.5" />
                    Voir le calendrier fiscal complet
                    <ArrowRight className="w-3.5 h-3.5" />
                </button>
            </Card>
        </div>
    );
}

