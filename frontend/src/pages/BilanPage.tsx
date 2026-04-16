import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, declarationApi } from '../lib/api';
import { fmt } from '../lib/fiscalCalc';
import { Card, Spinner, Btn } from '../components/ui';
import { useAppStore, PLAN_FEATURES } from '../components/ui';
import { MOIS_FR } from '../types';
import { Printer, Lock } from 'lucide-react';

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

