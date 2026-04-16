import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bilanApi } from '../lib/api';
import { fmt } from '../lib/fiscalCalc';
import { Card, Spinner } from '../components/ui';
import { useAppStore, PLAN_FEATURES, Btn } from '../components/ui';
import { Printer, Lock } from 'lucide-react';
import type { BilanData } from '../types';

export default function BilanPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('bilan')) return <Locked />;
    return <BilanContent />;
}

const LIGNES: { label: string; key: keyof Omit<BilanData, 'annee' | 'total'>; color: string }[] = [
    { label: 'IUTS (retenues salariales)', key: 'iuts', color: 'green' },
    { label: 'TPA (taxe professionnelle)', key: 'tpa', color: 'blue' },
    { label: 'CSS / Cotisations salariales', key: 'css', color: 'indigo' },
    { label: 'CNSS Patronal', key: 'cnss_patronal', color: 'purple' },
    { label: 'TVA nette collectée', key: 'tva', color: 'orange' },
    { label: 'Retenues à la source (RAS)', key: 'ras', color: 'yellow' },
    { label: 'IRF — Revenus Fonciers', key: 'irf', color: 'pink' },
    { label: 'IRCM — Capitaux Mobiliers', key: 'ircm', color: 'red' },
    { label: 'IS — Impôt sur les Sociétés', key: 'is', color: 'emerald' },
    { label: 'CME — Contribution Micro-Entreprises', key: 'cme', color: 'teal' },
    { label: 'Patente Professionnelle', key: 'patente', color: 'cyan' },
];

function BilanContent() {
    const [annee, setAnnee] = useState(new Date().getFullYear());

    const { data: bilan, isLoading } = useQuery<BilanData>({
        queryKey: ['bilan', annee],
        queryFn: () => bilanApi.get(annee).then((r) => r.data),
    });

    if (isLoading) return <Spinner />;

    const b = bilan ?? {
        annee, iuts: 0, tpa: 0, css: 0, ras: 0, tva: 0,
        cnss_patronal: 0, irf: 0, ircm: 0, is: 0, cme: 0, patente: 0, total: 0,
    };

    const nonZero = LIGNES.filter((l) => b[l.key] > 0);

    return (
        <div className="space-y-6 print:m-0">
            <div className="flex items-center gap-4 print:hidden">
                <select
                    value={annee}
                    onChange={(e) => setAnnee(+e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                    {Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
                <Btn variant="outline" onClick={() => window.print()}>
                    <Printer className="w-4 h-4" /> Imprimer
                </Btn>
            </div>

            {/* KPI summary cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500">IUTS versé</p>
                    <p className="text-lg font-bold text-green-700">{fmt(b.iuts)}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500">TVA collectée</p>
                    <p className="text-lg font-bold text-orange-700">{fmt(b.tva)}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500">Retenues source</p>
                    <p className="text-lg font-bold text-blue-700">{fmt(b.ras)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500">Total obligations {annee}</p>
                    <p className="text-lg font-bold text-gray-900">{fmt(b.total)}</p>
                </div>
            </div>

            {/* Module breakdown */}
            <Card title={`Récapitulatif fiscal — exercice ${annee}`}>
                {nonZero.length === 0 ? (
                    <p className="text-sm text-gray-400 py-8 text-center">
                        Aucune déclaration enregistrée pour l'exercice {annee}
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-semibold text-gray-500 border-b border-gray-200">
                                    <th className="py-2 px-3 text-left">Module fiscal</th>
                                    <th className="py-2 px-3 text-right">Montant (FCFA)</th>
                                    <th className="py-2 px-3 text-right">% du total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {LIGNES.map(({ label, key }) => {
                                    const v = b[key];
                                    const pct = b.total > 0 ? ((v / b.total) * 100).toFixed(1) : '—';
                                    return (
                                        <tr key={key} className={`hover:bg-gray-50 ${v === 0 ? 'opacity-40' : ''}`}>
                                            <td className="py-2.5 px-3 text-gray-800">{label}</td>
                                            <td className="py-2.5 px-3 text-right font-mono font-semibold">
                                                {fmt(v)}
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-gray-500 text-xs">
                                                {v > 0 ? `${pct} %` : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className="border-t-2 border-gray-300 font-bold">
                                    <td className="py-3 px-3 text-gray-900">Total obligations fiscales</td>
                                    <td className="py-3 px-3 text-right font-mono text-red-700 text-base">
                                        {fmt(b.total)}
                                    </td>
                                    <td className="py-3 px-3 text-right text-gray-500 text-xs">100 %</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}

function Locked() {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center max-w-xs">
                <div className="flex justify-center mb-4"><Lock className="w-12 h-12 text-gray-300" /></div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Bilan <span className="text-green-600">Pro</span></h2>
                <p className="text-gray-500 text-sm">Passez au plan Pro pour le bilan fiscal annuel complet.</p>
            </div>
        </div>
    );
}


export default function BilanPage() {
    const { plan } = useAppStore();
    if (!PLAN_FEATURES[plan]?.has('bilan')) return <Locked />;
    return <BilanContent />;
}

function BilanContent() {
    const [annee, setAnnee] = useState(new Date().getFullYear());

    const { data: decls = [], isLoading } = useQuery<any[]>({
        queryKey: ['declarations-bilan', annee],
        queryFn: () => declarationApi.list(annee).then((r) => r.data),
    });

    const totaux = decls.reduce(
        (acc, d) => ({
            iuts: acc.iuts + (d.iuts_total ?? 0),
            tpa: acc.tpa + (d.tpa_total ?? 0),
            cnss: acc.cnss + (d.css_total ?? 0),
            total: acc.total + (d.total ?? 0),
        }),
        { iuts: 0, tpa: 0, cnss: 0, total: 0 }
    );

    const printBilan = () => window.print();

    if (isLoading) return <Spinner />;

    return (
        <div className="space-y-6 print:m-0">
            <div className="flex items-center gap-4 print:hidden">
                <select
                    value={annee}
                    onChange={(e) => setAnnee(+e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                    {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <Btn variant="outline" onClick={printBilan}><Printer className="w-4 h-4" /> Imprimer</Btn>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                    { label: 'IUTS versé', value: totaux.iuts, color: 'green' },
                    { label: 'TPA versé', value: totaux.tpa, color: 'blue' },
                    { label: 'CSS salarié', value: totaux.cnss, color: 'orange' },
                    { label: 'Total obligations', value: totaux.total, color: 'gray' },
                ].map(({ label, value, color }) => (
                    <div key={label} className={`bg-${color}-50 rounded-xl p-4`}>
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className={`text-lg font-bold text-${color}-700`}>{fmt(value)}</p>
                    </div>
                ))}
            </div>

            <Card title={`Récapitulatif — exercice ${annee}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs font-semibold text-gray-500 border-b border-gray-200">
                                {['Mois', 'IUTS', 'TPA', 'CSS', 'Total', 'Statut'].map((c) => (
                                    <th key={c} className="py-2 px-3 text-right first:text-left">{c}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {decls.map((d) => (
                                <tr key={d.id} className="hover:bg-gray-50">
                                    <td className="py-2.5 px-3 text-gray-800 font-medium">{MOIS_FR[(d.mois ?? 1) - 1]} {d.annee}</td>
                                    <td className="py-2.5 px-3 text-right font-mono text-xs">{fmt(d.iuts_total ?? 0)}</td>
                                    <td className="py-2.5 px-3 text-right font-mono text-xs">{fmt(d.tpa_total ?? 0)}</td>
                                    <td className="py-2.5 px-3 text-right font-mono text-xs">{fmt(d.css_total ?? 0)}</td>
                                    <td className="py-2.5 px-3 text-right font-bold font-mono text-xs">{fmt(d.total ?? 0)}</td>
                                    <td className="py-2.5 px-3 text-right">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.statut === 'depose' ? 'bg-green-100 text-green-700' :
                                            d.statut === 'en_retard' ? 'bg-red-100 text-red-700' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                            {d.statut}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {decls.length === 0 && (
                                <tr><td colSpan={6} className="py-8 text-center text-gray-400">Aucune déclaration pour {annee}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

function Locked() {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center max-w-xs">
                <div className="flex justify-center mb-4"><Lock className="w-12 h-12 text-gray-300" /></div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Bilan <span className="text-green-600">Pro</span></h2>
                <p className="text-gray-500 text-sm">Passez au plan Pro pour le bilan fiscal annuel complet.</p>
            </div>
        </div>
    );
}

