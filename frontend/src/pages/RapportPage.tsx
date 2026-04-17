import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { declarationApi, dashboardApi, companyApi } from '../lib/api';
import { fmt, fmtN } from '../lib/fiscalCalc';
import { Card, Spinner, Btn } from '../components/ui';
import { MOIS_FR } from '../types';
import type { Company } from '../types';
import { Printer, FileDown } from 'lucide-react';

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

    const { data: company } = useQuery<Company>({
        queryKey: ['company'],
        queryFn: () => companyApi.get().then((r) => r.data),
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

    const exportPDF = () => {
        const BLACK: [number, number, number] = [0, 0, 0];
        const GRAY: [number, number, number] = [120, 120, 120];
        const LIGHT: [number, number, number] = [245, 245, 245];

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        // ── En-tête ───────────────────────────────────────────
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...BLACK);
        doc.text('RAPPORT FISCAL MENSUEL', 105, 18, { align: 'center' });

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...GRAY);
        doc.text(`${MOIS_FR[mois - 1]} ${annee}`, 105, 24, { align: 'center' });

        // Infos entreprise
        let y = 32;
        doc.setFontSize(9);
        doc.setTextColor(...BLACK);
        if (company?.nom) { doc.text(`Entreprise : ${company.nom}`, 14, y); y += 5; }
        if (company?.ifu) { doc.text(`IFU : ${company.ifu}`, 14, y); y += 5; }
        if (company?.adresse) { doc.text(`Adresse : ${company.adresse}`, 14, y); y += 5; }

        // Ligne séparatrice
        y += 2;
        doc.setDrawColor(...GRAY);
        doc.line(14, y, 196, y);
        y += 6;

        // ── KPIs ─────────────────────────────────────────────
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        doc.setFont('Helvetica', 'bold');
        doc.text('RÉSUMÉ DES OBLIGATIONS', 14, y);
        y += 4;

        const iutsTotal = (kpis?.iuts_total ?? 0) + (kpis?.tpa_total ?? 0);
        const cnssTotal = kpis?.cnss_total ?? 0;
        const grandTotal = iutsTotal + cnssTotal;

        autoTable(doc, {
            startY: y,
            head: [],
            body: [
                ['IUTS + TPA', fmtN(iutsTotal) + ' FCFA'],
                ['CSS salariés', fmtN(cnssTotal) + ' FCFA'],
                ['Nombre de salariés', String(kpis?.nb_salaries ?? 0)],
                ['Total obligations', fmtN(grandTotal) + ' FCFA'],
            ],
            styles: { fontSize: 8, textColor: BLACK, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 60, fontStyle: 'bold', fillColor: LIGHT },
                1: { cellWidth: 55, halign: 'right' },
            },
            theme: 'plain',
        });

        // ── Tableau déclaration ───────────────────────────────
        if (lastDecl) {
            const finalY: number = (doc as any).lastAutoTable?.finalY ?? (y + 30);
            const tableY = finalY + 8;

            doc.setFontSize(8);
            doc.setTextColor(...GRAY);
            doc.setFont('Helvetica', 'bold');
            doc.text(
                `DÉCLARATION – ${MOIS_FR[(lastDecl.mois ?? 1) - 1].toUpperCase()} ${lastDecl.annee}`,
                14, tableY - 3,
            );

            autoTable(doc, {
                startY: tableY,
                head: [['Employé', 'Brut', 'IUTS', 'TPA', 'CSS', 'Net à payer']],
                body: (lastDecl.lignes ?? []).map((l: any) => [
                    l.nom,
                    fmtN(l.brut_total),
                    fmtN(l.iuts_net),
                    fmtN(l.tpa),
                    fmtN(l.cotisation_sociale),
                    fmtN(l.salaire_net),
                ]),
                styles: { fontSize: 7, textColor: BLACK, cellPadding: 2 },
                headStyles: { fillColor: LIGHT, textColor: BLACK, fontStyle: 'bold' },
                columnStyles: {
                    0: { cellWidth: 55 },
                    1: { halign: 'right', cellWidth: 28 },
                    2: { halign: 'right', cellWidth: 22 },
                    3: { halign: 'right', cellWidth: 20 },
                    4: { halign: 'right', cellWidth: 22 },
                    5: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
                },
                foot: [[
                    'TOTAL',
                    fmtN(lastDecl.brut_total ?? 0),
                    fmtN(lastDecl.iuts_total ?? 0),
                    fmtN(lastDecl.tpa_total ?? 0),
                    fmtN(lastDecl.css_total ?? 0),
                    fmtN(lastDecl.total ?? 0),
                ]],
                footStyles: { fillColor: LIGHT, fontStyle: 'bold', textColor: BLACK, halign: 'right' },
            });
        }

        // ── Pied de page ─────────────────────────────────────
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        doc.setFont('Helvetica', 'normal');
        doc.text(
            `Généré par FISCA – ${new Date().toLocaleDateString('fr-FR')}`,
            14, pageH - 10,
        );
        doc.text(`Page 1/1`, 196, pageH - 10, { align: 'right' });

        doc.save(`rapport-fiscal-${String(mois).padStart(2, '0')}-${annee}.pdf`);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-end gap-2 print:hidden">
                <Btn variant="outline" onClick={exportPDF}><FileDown className="w-4 h-4" /> Télécharger PDF</Btn>
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

