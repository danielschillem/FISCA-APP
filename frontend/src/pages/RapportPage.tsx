import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { declarationApi, dashboardApi } from '../lib/api';
import { fmt, fmtN } from '../lib/fiscalCalc';
import { Card, Spinner, Btn } from '../components/ui';
import { MOIS_FR } from '../types';
import { Printer } from 'lucide-react';

export default function RapportPage() {
    const now = new Date();
    const mois = now.getMonth() + 1;
    const annee = now.getFullYear();
    const printRef = useRef<HTMLDivElement>(null);

    const { data: decls = [], isLoading: l1 } = useQuery<any[]>({
        queryKey: ['declarations', mois, annee],
        queryFn: () => declarationApi.list(annee).then((r) => r.data),
    });

    const { data: kpis, isLoading: l2 } = useQuery<any>({
        queryKey: ['dashboard'],
        queryFn: () => dashboardApi.get().then((r) => r.data),
    });

    if (l1 || l2) return <Spinner />;

    const lastDecl = decls.find((d) => d.mois === mois) ?? decls[0];

    const print = () => {
        const content = printRef.current?.innerHTML ?? '';
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`
      <html><head><title>Rapport FISCA ${MOIS_FR[(mois - 1)]} ${annee}</title>
      <style>body{font-family:sans-serif;padding:2rem;font-size:13px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px;text-align:right}th{background:#f5f5f5;text-align:center}.bold{font-weight:700}h1{font-size:18px}h2{font-size:14px;margin-top:2rem}</style>
      </head><body>${content}</body></html>
    `);
        win.document.close();
        win.print();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-end print:hidden">
                <Btn variant="outline" onClick={print}><Printer className="w-4 h-4" /> Imprimer</Btn>
            </div>

            <div ref={printRef}>
                <h1 className="text-xl font-bold text-gray-900 mb-6">
                    Rapport fiscal : {MOIS_FR[mois - 1]} {annee}
                </h1>

                {/* KPIs */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'IUTS / TPA', value: (kpis?.iuts_total ?? 0) + (kpis?.tpa_total ?? 0) },
                        { label: 'CSS salariés', value: kpis?.cnss_total ?? 0 },
                        { label: 'Nb salariés', value: kpis?.nb_salaries ?? 0, raw: true },
                        { label: 'Total obligations', value: (kpis?.iuts_total ?? 0) + (kpis?.tpa_total ?? 0) + (kpis?.cnss_total ?? 0) },
                    ].map(({ label, value, raw }) => (
                        <div key={label} className="bg-gray-50 rounded-xl p-4">
                            <p className="text-xs text-gray-500">{label}</p>
                            <p className="text-xl font-bold text-gray-900">{raw ? value : fmt(value)}</p>
                        </div>
                    ))}
                </div>

                {/* Last declaration detail */}
                {lastDecl && (
                    <Card title={`Déclaration ${MOIS_FR[(lastDecl.mois ?? 1) - 1]} ${lastDecl.annee}`} className="mb-4">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs font-semibold text-gray-500 border-b border-gray-200">
                                        <th className="text-left py-2 px-3">Employé</th>
                                        <th className="text-right py-2 px-3">Salaire brut</th>
                                        <th className="text-right py-2 px-3">IUTS</th>
                                        <th className="text-right py-2 px-3">TPA</th>
                                        <th className="text-right py-2 px-3">CSS</th>
                                        <th className="text-right py-2 px-3">Net à payer</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {(lastDecl.lignes ?? []).map((l: any) => (
                                        <tr key={l.id} className="hover:bg-gray-50">
                                            <td className="py-2.5 px-3 font-medium text-gray-800">{l.nom}</td>
                                            <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtN(l.brut_total)}</td>
                                            <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtN(l.iuts_net)}</td>
                                            <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtN(l.tpa)}</td>
                                            <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtN(l.cotisation_sociale)}</td>
                                            <td className="py-2.5 px-3 text-right font-bold font-mono text-xs">{fmtN(l.salaire_net)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}

