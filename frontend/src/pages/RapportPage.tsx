import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { declarationApi, dashboardApi, companyApi } from '../lib/api';
import { fmt, fmtN } from '../lib/fiscalCalc';
import { Card, Spinner, Btn } from '../components/ui';
import { MOIS_FR } from '../types';
import type { Declaration, Company, DashboardKPI } from '../types';
import { Printer, FileDown, FileSpreadsheet } from 'lucide-react';

export default function RapportPage() {
    const now = new Date();
    const [selectedMois, setSelectedMois] = useState(now.getMonth() + 1);
    const [selectedAnnee, setSelectedAnnee] = useState(now.getFullYear());
    const printRef = useRef<HTMLDivElement>(null);

    const { data: decls = [], isLoading: l1 } = useQuery<Declaration[]>({
        queryKey: ['declarations', selectedAnnee],
        queryFn: () => declarationApi.list(selectedAnnee).then((r) => r.data),
    });

    const { data: kpis, isLoading: l2 } = useQuery<DashboardKPI>({
        queryKey: ['dashboard'],
        queryFn: () => dashboardApi.get().then((r) => r.data),
    });

    const { data: company } = useQuery<Company>({
        queryKey: ['company'],
        queryFn: () => companyApi.get().then((r) => r.data),
    });

    if (l1 || l2) return <Spinner />;

    const decl: Declaration | undefined = decls.find((d) => d.mois === selectedMois) ?? decls[0];

    const print = () => {
        const content = printRef.current?.innerHTML ?? '';
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`<html><head><title>Rapport FISCA ${MOIS_FR[selectedMois - 1]} ${selectedAnnee}</title><style>body{font-family:sans-serif;padding:2rem;font-size:13px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px;text-align:right}th{background:#f5f5f5;text-align:center}h1{font-size:18px}</style></head><body>${content}</body></html>`);
        win.document.close();
        win.print();
    };

    const exportPDF = () => {
        const BLACK: [number, number, number] = [0, 0, 0];
        const GRAY: [number, number, number] = [120, 120, 120];
        const LIGHT: [number, number, number] = [245, 245, 245];
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        doc.setFont('Helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...BLACK);
        doc.text('RAPPORT FISCAL MENSUEL', 105, 18, { align: 'center' });
        doc.setFont('Helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...GRAY);
        doc.text(`${MOIS_FR[selectedMois - 1]} ${selectedAnnee}`, 105, 24, { align: 'center' });
        let y = 32; doc.setFontSize(9); doc.setTextColor(...BLACK);
        if (company?.nom) { doc.text(`Entreprise : ${company.nom}`, 14, y); y += 5; }
        if (company?.ifu) { doc.text(`IFU : ${company.ifu}`, 14, y); y += 5; }
        if (company?.adresse) { doc.text(`Adresse : ${company.adresse}`, 14, y); y += 5; }
        y += 2; doc.setDrawColor(...GRAY); doc.line(14, y, 196, y); y += 6;
        doc.setFontSize(8); doc.setTextColor(...GRAY); doc.setFont('Helvetica', 'bold');
        doc.text('RÉSUMÉ DES OBLIGATIONS (EXERCICE EN COURS)', 14, y); y += 4;
        const iutsTotal = (kpis?.total_annee?.iuts_total ?? 0) + (kpis?.total_annee?.tpa_total ?? 0);
        autoTable(doc, {
            startY: y,
            body: [
                ['IUTS + TPA (annee)', fmtN(iutsTotal) + ' FCFA'],
                ['CSS salaries (annee)', fmtN(kpis?.total_annee?.css_total ?? 0) + ' FCFA'],
                ['Nombre d\'employes', String(kpis?.nb_employes ?? 0)],
                ['Total obligations (annee)', fmtN(iutsTotal + (kpis?.total_annee?.css_total ?? 0)) + ' FCFA'],
            ],
            styles: { fontSize: 8, textColor: BLACK, cellPadding: 2 },
            columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold', fillColor: LIGHT }, 1: { cellWidth: 55, halign: 'right' } },
            theme: 'plain',
        });
        if (decl) {
            const tableY = ((doc as any).lastAutoTable?.finalY ?? (y + 30)) + 8;
            doc.setFontSize(8); doc.setTextColor(...GRAY); doc.setFont('Helvetica', 'bold');
            doc.text(`DECLARATION – ${MOIS_FR[(decl.mois ?? 1) - 1].toUpperCase()} ${decl.annee}`, 14, tableY - 3);
            autoTable(doc, {
                startY: tableY,
                head: [['Periode', 'Brut', 'IUTS', 'TPA', 'CSS', 'Total du']],
                body: [[`${MOIS_FR[decl.mois - 1]} ${decl.annee}`, fmtN(decl.brut_total), fmtN(decl.iuts_total), fmtN(decl.tpa_total), fmtN(decl.css_total), fmtN(decl.total)]],
                styles: { fontSize: 8, textColor: BLACK, cellPadding: 2 },
                headStyles: { fillColor: LIGHT, textColor: BLACK, fontStyle: 'bold' },
                columnStyles: { 0: { cellWidth: 35 }, 1: { halign: 'right', cellWidth: 30 }, 2: { halign: 'right', cellWidth: 25 }, 3: { halign: 'right', cellWidth: 22 }, 4: { halign: 'right', cellWidth: 25 }, 5: { halign: 'right', cellWidth: 30, fontStyle: 'bold' } },
            });
        }
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(7); doc.setTextColor(...GRAY); doc.setFont('Helvetica', 'normal');
        doc.text(`Genere par FISCA – ${new Date().toLocaleDateString('fr-FR')}`, 14, pageH - 10);
        doc.text('Page 1/1', 196, pageH - 10, { align: 'right' });
        doc.save(`rapport-fiscal-${String(selectedMois).padStart(2, '0')}-${selectedAnnee}.pdf`);
    };

    const exportXLSX = () => {
        const rows = decls.map((d) => ({
            'Mois': MOIS_FR[d.mois - 1], 'Annee': d.annee, 'Nb salaries': d.nb_salaries,
            'Brut total (FCFA)': d.brut_total, 'IUTS (FCFA)': d.iuts_total,
            'TPA (FCFA)': d.tpa_total, 'CSS (FCFA)': d.css_total,
            'Total du (FCFA)': d.total, 'Statut': d.statut,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 12 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Rapport ${selectedAnnee}`);
        XLSX.writeFile(wb, `rapport-fiscal-${selectedAnnee}.xlsx`);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 flex-wrap">
                <select value={selectedMois} onChange={(e) => setSelectedMois(+e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:outline-none">
                    {MOIS_FR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
                <select value={selectedAnnee} onChange={(e) => setSelectedAnnee(+e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:outline-none">
                    {[2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <div className="flex-1" />
                <Btn variant="outline" size="sm" onClick={exportXLSX}><FileSpreadsheet className="w-4 h-4" /> Export XLSX</Btn>
                <Btn variant="outline" size="sm" onClick={exportPDF}><FileDown className="w-4 h-4" /> PDF</Btn>
                <Btn variant="outline" size="sm" onClick={print}><Printer className="w-4 h-4" /> Imprimer</Btn>
            </div>

            <div ref={printRef}>
                <h1 className="text-xl font-bold text-gray-900 mb-6">Rapport fiscal : {MOIS_FR[selectedMois - 1]} {selectedAnnee}</h1>

                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'IUTS / TPA', value: (kpis?.total_annee?.iuts_total ?? 0) + (kpis?.total_annee?.tpa_total ?? 0) },
                        { label: 'CSS salaries', value: kpis?.total_annee?.css_total ?? 0 },
                        { label: 'Nb employes', value: kpis?.nb_employes ?? 0, raw: true },
                        { label: 'Total obligations', value: (kpis?.total_annee?.iuts_total ?? 0) + (kpis?.total_annee?.tpa_total ?? 0) + (kpis?.total_annee?.css_total ?? 0) },
                    ].map(({ label, value, raw }) => (
                        <div key={label} className="bg-gray-50 rounded-xl p-4">
                            <p className="text-xs text-gray-500">{label}</p>
                            <p className="text-xl font-bold text-gray-900">{raw ? value : fmt(value)}</p>
                        </div>
                    ))}
                </div>

                {decl ? (
                    <Card title={`Declaration ${MOIS_FR[decl.mois - 1]} ${decl.annee}`} className="mb-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
                            {[
                                { label: 'Brut total', val: fmtN(decl.brut_total) },
                                { label: 'IUTS', val: fmtN(decl.iuts_total) },
                                { label: 'TPA', val: fmtN(decl.tpa_total) },
                                { label: 'CSS', val: fmtN(decl.css_total) },
                                { label: 'Total du', val: fmtN(decl.total) },
                            ].map(({ label, val }) => (
                                <div key={label} className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-[11px] text-gray-400">{label}</p>
                                    <p className="text-sm font-bold text-gray-900 font-mono">{val}</p>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-gray-400">{decl.nb_salaries} salarie{decl.nb_salaries !== 1 ? 's' : ''} · Statut : {decl.statut} · Ref. : {decl.ref ?? '—'}</p>
                    </Card>
                ) : (
                    <Card title=""><p className="text-center text-gray-400 py-8 text-sm">Aucune declaration pour {MOIS_FR[selectedMois - 1]} {selectedAnnee}</p></Card>
                )}

                {decls.length > 0 && (
                    <Card title={`Toutes les declarations ${selectedAnnee}`}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs font-semibold text-gray-500 border-b border-gray-100">
                                        <th className="text-left py-2 px-3">Mois</th>
                                        <th className="text-right py-2 px-3">Brut</th>
                                        <th className="text-right py-2 px-3">IUTS</th>
                                        <th className="text-right py-2 px-3">TPA</th>
                                        <th className="text-right py-2 px-3">CSS</th>
                                        <th className="text-right py-2 px-3 font-bold">Total du</th>
                                        <th className="text-center py-2 px-3">Statut</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {decls.map((d) => (
                                        <tr key={d.id} onClick={() => setSelectedMois(d.mois)}
                                            className={`cursor-pointer transition-colors ${d.mois === selectedMois ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                                            <td className="py-2 px-3 font-medium text-gray-800">{MOIS_FR[d.mois - 1]}</td>
                                            <td className="py-2 px-3 text-right font-mono text-xs text-gray-600">{fmtN(d.brut_total)}</td>
                                            <td className="py-2 px-3 text-right font-mono text-xs text-gray-600">{fmtN(d.iuts_total)}</td>
                                            <td className="py-2 px-3 text-right font-mono text-xs text-gray-600">{fmtN(d.tpa_total)}</td>
                                            <td className="py-2 px-3 text-right font-mono text-xs text-gray-600">{fmtN(d.css_total)}</td>
                                            <td className="py-2 px-3 text-right font-mono text-xs font-bold text-gray-900">{fmtN(d.total)}</td>
                                            <td className="py-2 px-3 text-center">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${d.statut === 'ok' || d.statut === 'approuve' ? 'bg-green-100 text-green-700' : d.statut === 'retard' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{d.statut}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t-2 border-gray-200">
                                    <tr className="text-xs font-bold text-gray-700 bg-gray-50">
                                        <td className="py-2 px-3">TOTAL {selectedAnnee}</td>
                                        <td className="py-2 px-3 text-right font-mono">{fmtN(decls.reduce((s, d) => s + d.brut_total, 0))}</td>
                                        <td className="py-2 px-3 text-right font-mono">{fmtN(decls.reduce((s, d) => s + d.iuts_total, 0))}</td>
                                        <td className="py-2 px-3 text-right font-mono">{fmtN(decls.reduce((s, d) => s + d.tpa_total, 0))}</td>
                                        <td className="py-2 px-3 text-right font-mono">{fmtN(decls.reduce((s, d) => s + d.css_total, 0))}</td>
                                        <td className="py-2 px-3 text-right font-mono">{fmtN(decls.reduce((s, d) => s + d.total, 0))}</td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}
