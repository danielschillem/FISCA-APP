import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { historiqueApi } from '../lib/api';
import { fmt, fmtN } from '../lib/fiscalCalc';
import { Card, Btn, Spinner } from '../components/ui';
import { MOIS_FR } from '../types';
import { FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function HistoriquePage() {
    const [annee, setAnnee] = useState(new Date().getFullYear());

    const { data, isLoading } = useQuery({
        queryKey: ['historique', annee],
        queryFn: () => historiqueApi.get(annee).then((r) => r.data),
    });

    const { data: annees = [] } = useQuery<number[]>({
        queryKey: ['historique-annees'],
        queryFn: () => historiqueApi.annees().then((r) => r.data),
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 flex-wrap">
                <label className="text-sm font-medium text-gray-700">Exercice fiscal</label>
                <select
                    value={annee}
                    onChange={(e) => setAnnee(+e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                    {(annees.length ? annees : [annee]).map((a) => (
                        <option key={a} value={a}>{a}</option>
                    ))}
                </select>
                {data && (
                    <Btn
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const rows = (data.mois ?? []).map((m: {
                                mois: number; iuts_total: number; tpa_total: number; css_total: number;
                                cnss_patronal: number; tva_nette: number; retenue_total: number; total_obligations: number;
                            }) => ({
                                Mois: MOIS_FR[m.mois - 1],
                                'IUTS (FCFA)': m.iuts_total,
                                'TPA (FCFA)': m.tpa_total,
                                'CSS (FCFA)': m.css_total,
                                'CNSS Pat. (FCFA)': m.cnss_patronal,
                                'TVA nette (FCFA)': m.tva_nette,
                                'Retenues (FCFA)': m.retenue_total,
                                'Total obligations (FCFA)': m.total_obligations,
                            }));
                            const ws = XLSX.utils.json_to_sheet(rows);
                            const wb = XLSX.utils.book_new();
                            XLSX.utils.book_append_sheet(wb, ws, `Historique ${annee}`);
                            XLSX.writeFile(wb, `historique-fiscal-${annee}.xlsx`);
                        }}
                        title="Exporter l'historique en XLSX"
                    >
                        <FileSpreadsheet className="w-4 h-4" /> Export XLSX
                    </Btn>
                )}
            </div>

            {isLoading ? <Spinner /> : !data ? (
                <Card>
                    <p className="text-center text-gray-400 py-8">Aucune donnée pour {annee}</p>
                </Card>
            ) : (
                <>
                    {/* Totaux annuels */}
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                        {[
                            { label: 'IUTS total', value: data.iuts_total, color: 'green' },
                            { label: 'TPA total', value: data.tpa_total, color: 'blue' },
                            { label: 'CSS total', value: data.css_total, color: 'orange' },
                            { label: 'Total obligations', value: data.total_obligations, color: 'gray' },
                        ].map(({ label, value, color }) => (
                            <div key={label} className={`bg-${color}-50 rounded-xl p-4`}>
                                <p className="text-xs text-gray-500">{label}</p>
                                <p className={`text-xl font-bold text-${color}-700`}>{fmt(value ?? 0)}</p>
                            </div>
                        ))}
                    </div>

                    {/* Tableau mensuel */}
                    <Card title={`Détail mensuel — ${annee}`}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs font-semibold text-gray-500 border-b border-gray-200">
                                        {['Mois', 'IUTS', 'TPA', 'CSS', 'CNSS Pat.', 'TVA', 'Retenues', 'Total'].map((c) => (
                                            <th key={c} className="py-2 px-3 text-right first:text-left">{c}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {(data.mois ?? []).map((m: {
                                        mois: number; iuts_total: number; tpa_total: number; css_total: number;
                                        cnss_patronal: number; tva_nette: number; retenue_total: number; total_obligations: number;
                                    }) => (
                                        <tr key={m.mois} className="hover:bg-gray-50">
                                            <td className="py-2.5 px-3 font-medium text-gray-800">{MOIS_FR[m.mois - 1]}</td>
                                            <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtN(m.iuts_total)}</td>
                                            <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtN(m.tpa_total)}</td>
                                            <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtN(m.css_total)}</td>
                                            <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtN(m.cnss_patronal)}</td>
                                            <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtN(m.tva_nette)}</td>
                                            <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtN(m.retenue_total)}</td>
                                            <td className="py-2.5 px-3 text-right font-mono text-xs font-bold text-gray-900">{fmtN(m.total_obligations)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
}

