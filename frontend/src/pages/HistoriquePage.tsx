import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { historiqueApi } from '../lib/api';
import { fmt, fmtN } from '../lib/fiscalCalc';
import { Card, Btn, Spinner } from '../components/ui';
import { MOIS_FR } from '../types';
import { FileSpreadsheet, BarChart2, GitCompare } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function HistoriquePage() {
    const [annee, setAnnee] = useState(new Date().getFullYear());
    const [vue, setVue] = useState<'tableau' | 'graphique' | 'comparaison'>('tableau');

    const { data, isLoading } = useQuery({
        queryKey: ['historique', annee],
        queryFn: () => historiqueApi.get(annee).then((r) => r.data),
    });

    const { data: dataN1, isLoading: isLoadingN1 } = useQuery({
        queryKey: ['historique', annee - 1],
        queryFn: () => historiqueApi.get(annee - 1).then((r) => r.data),
        enabled: vue === 'comparaison',
    });

    const { data: annees = [] } = useQuery<number[]>({
        queryKey: ['historique-annees'],
        queryFn: () => historiqueApi.annees().then((r) => r.data),
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 flex-wrap">
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

                {/* Toggle vue */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 ml-2">
                    {([
                        { id: 'tableau', label: 'Tableau', Icon: FileSpreadsheet },
                        { id: 'graphique', label: 'Graphique', Icon: BarChart2 },
                        { id: 'comparaison', label: `Évolution N-1 / N`, Icon: GitCompare },
                    ] as const).map(({ id, label, Icon }) => (
                        <button
                            key={id}
                            onClick={() => setVue(id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${vue === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Icon className="w-3.5 h-3.5" /> {label}
                        </button>
                    ))}
                </div>

                {data && vue === 'tableau' && (
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
                <Card title="">
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

                    {/* Vue TABLEAU */}
                    {vue === 'tableau' && (
                        <Card title={`Détail mensuel : ${annee}`}>
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
                    )}

                    {/* Vue GRAPHIQUE */}
                    {vue === 'graphique' && (() => {
                        type MoisRow = { mois: number; total_obligations: number; iuts_total: number };
                        const rows: MoisRow[] = data.mois ?? [];
                        const maxTotal = Math.max(...rows.map(m => m.total_obligations ?? 0), 1);
                        const maxIuts = Math.max(...rows.map(m => m.iuts_total ?? 0), 1);
                        return (
                            <Card title={`Évolution mensuelle : ${annee}`}>
                                <div className="space-y-3">
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(moisNum => {
                                        const m = rows.find(r => r.mois === moisNum);
                                        const total = m?.total_obligations ?? 0;
                                        const iuts = m?.iuts_total ?? 0;
                                        const pctTotal = Math.round((total / maxTotal) * 100);
                                        const pctIuts = Math.round((iuts / maxIuts) * 100);
                                        return (
                                            <div key={moisNum}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-medium text-gray-600 w-10 shrink-0">{MOIS_FR[moisNum - 1]?.slice(0, 4)}</span>
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                                                                <div className="h-3 rounded-full bg-gray-400 transition-all" style={{ width: `${pctTotal}%` }} />
                                                            </div>
                                                            <span className="text-[10px] font-mono text-gray-500 w-20 text-right shrink-0">{total > 0 ? fmtN(total) : ':'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                                                <div className="h-2 rounded-full bg-green-400 transition-all" style={{ width: `${pctIuts}%` }} />
                                                            </div>
                                                            <span className="text-[10px] font-mono text-green-600 w-20 text-right shrink-0">{iuts > 0 ? fmtN(iuts) : ':'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex gap-4 mt-4 text-[11px] text-gray-500">
                                    <span><span className="inline-block w-3 h-3 bg-gray-400 rounded-sm mr-1" />Total obligations</span>
                                    <span><span className="inline-block w-3 h-3 bg-green-400 rounded-sm mr-1" />IUTS</span>
                                </div>
                            </Card>
                        );
                    })()}

                    {/* Vue COMPARAISON N-1 vs N */}
                    {vue === 'comparaison' && (
                        isLoadingN1 ? <Spinner /> : (
                            <Card title={`Comparaison ${annee - 1} vs ${annee}`}>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-xs font-semibold text-gray-500 border-b border-gray-200">
                                                <th className="text-left py-2 px-3">Mois</th>
                                                <th className="text-right py-2 px-3">{annee - 1}</th>
                                                <th className="text-right py-2 px-3">{annee}</th>
                                                <th className="text-right py-2 px-3">Variation</th>
                                                <th className="text-right py-2 px-3">%</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(moisNum => {
                                                type MoisRow = { mois: number; total_obligations: number };
                                                const n1row = (dataN1?.mois ?? [] as MoisRow[]).find((m: MoisRow) => m.mois === moisNum);
                                                const nrow = (data.mois ?? [] as MoisRow[]).find((m: MoisRow) => m.mois === moisNum);
                                                const v1 = (n1row as MoisRow | undefined)?.total_obligations ?? 0;
                                                const v2 = (nrow as MoisRow | undefined)?.total_obligations ?? 0;
                                                const delta = v2 - v1;
                                                const pct = v1 === 0 ? null : Math.round((delta / v1) * 100);
                                                return (
                                                    <tr key={moisNum} className="hover:bg-gray-50">
                                                        <td className="py-2.5 px-3 font-medium text-gray-800">{MOIS_FR[moisNum - 1]}</td>
                                                        <td className="py-2.5 px-3 text-right font-mono text-xs text-gray-500">{v1 > 0 ? fmtN(v1) : ':'}</td>
                                                        <td className="py-2.5 px-3 text-right font-mono text-xs font-semibold">{v2 > 0 ? fmtN(v2) : ':'}</td>
                                                        <td className={`py-2.5 px-3 text-right font-mono text-xs font-bold ${delta > 0 ? 'text-red-600' : delta < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                            {delta !== 0 ? `${delta > 0 ? '+' : ''}${fmtN(delta)}` : ':'}
                                                        </td>
                                                        <td className={`py-2.5 px-3 text-right text-xs font-bold ${pct !== null && pct > 0 ? 'text-red-600' : pct !== null && pct < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                            {pct !== null ? `${pct > 0 ? '+' : ''}${pct} %` : ':'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="font-bold border-t-2 border-gray-300 bg-gray-50">
                                                <td className="py-2.5 px-3">Total</td>
                                                <td className="py-2.5 px-3 text-right font-mono text-xs text-gray-500">{fmt(dataN1?.total_obligations ?? 0)}</td>
                                                <td className="py-2.5 px-3 text-right font-mono text-xs">{fmt(data.total_obligations ?? 0)}</td>
                                                <td className={`py-2.5 px-3 text-right font-mono text-xs ${(data.total_obligations ?? 0) > (dataN1?.total_obligations ?? 0) ? 'text-red-600' : 'text-green-600'}`}>
                                                    {fmt((data.total_obligations ?? 0) - (dataN1?.total_obligations ?? 0))}
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-xs">
                                                    {dataN1?.total_obligations > 0
                                                        ? `${Math.round(((data.total_obligations - dataN1.total_obligations) / dataN1.total_obligations) * 100)} %`
                                                        : ':'}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                <p className="text-[11px] text-gray-400 mt-3">
                                    Comparaison des obligations totales (IUTS + CNSS + TVA + Retenues) entre {annee - 1} et {annee}.
                                </p>
                            </Card>
                        )
                    )}
                </>
            )}
        </div>
    );
}

