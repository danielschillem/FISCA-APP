import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { declarationApi } from '../lib/api';
import { fmtN } from '../lib/fiscalCalc';
import { Card, Btn, Badge, Spinner } from '../components/ui';
import type { Declaration } from '../types';
import { MOIS_FR } from '../types';
import { FileDown, FileText, Trash2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function statutBadge(statut: string) {
    if (statut === 'ok' || statut === 'approuve') return <Badge color="green"><CheckCircle2 className="w-3 h-3 inline mr-1" />Validée</Badge>;
    if (statut === 'retard') return <Badge color="red"><AlertCircle className="w-3 h-3 inline mr-1" />En retard</Badge>;
    if (statut === 'soumis') return <Badge color="blue"><Clock className="w-3 h-3 inline mr-1" />Soumise</Badge>;
    return <Badge color="orange"><Clock className="w-3 h-3 inline mr-1" />En cours</Badge>;
}

function generatePDF(d: Declaration, companyName?: string) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // ── En-tête ──
    doc.setFillColor(22, 163, 74);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('FISCA', 14, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Plateforme Fiscale · Burkina Faso · CGI 2025', 14, 19);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DECLARATION IUTS / TPA / CSS', 210 - 14, 12, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Période : ${MOIS_FR[d.mois - 1]} ${d.annee}`, 210 - 14, 19, { align: 'right' });

    // ── Infos entreprise ──
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Entreprise :', 14, 38);
    doc.setFont('helvetica', 'normal');
    doc.text(companyName ?? '—', 50, 38);
    if (d.ref) {
        doc.text(`Référence : ${d.ref}`, 14, 45);
    }
    doc.text(`Nombre de salariés : ${d.nb_salaries}`, 14, 52);
    doc.text(`Date de génération : ${new Date(d.created_at).toLocaleDateString('fr-FR')}`, 14, 59);

    // ── Tableau récapitulatif ──
    autoTable(doc, {
        startY: 68,
        head: [['Rubrique', 'Montant (FCFA)']],
        body: [
            ['Masse salariale brute', fmtN(d.brut_total) + ' F'],
            ['IUTS net (retenu)', fmtN(d.iuts_total) + ' F'],
            ['TPA (3 %)', fmtN(d.tpa_total) + ' F'],
            ['CSS / CNSS (5,5 %)', fmtN(d.css_total) + ' F'],
            ['TOTAL à déclarer', fmtN(d.total) + ' F'],
        ],
        styles: { fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        foot: [['', '']],
    });

    // ── Pied de page ──
    const pageH = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Document généré par FISCA · Non opposable sans signature DGI', 105, pageH - 10, { align: 'center' });

    doc.save(`declaration-IUTS-${d.annee}-${String(d.mois).padStart(2, '0')}.pdf`);
}

export default function DeclarationsPage() {
    const [annee, setAnnee] = useState(new Date().getFullYear());
    const [deleting, setDeleting] = useState<string | null>(null);
    const qc = useQueryClient();

    const { data: declarations = [], isLoading } = useQuery<Declaration[]>({
        queryKey: ['declarations', annee],
        queryFn: () => declarationApi.list(annee).then((r) => r.data ?? []),
    });

    const deleteMut = useMutation({
        mutationFn: (id: string) => declarationApi.delete(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['declarations'] });
            setDeleting(null);
        },
    });

    const handleDownloadCSV = async (id: string, mois: number, anneeDecl: number) => {
        const res = await declarationApi.exportDecl(id);
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DIPE-IUTS-TPA-${anneeDecl}${String(mois).padStart(2, '0')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            {/* Filtre année */}
            <Card>
                <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700">Exercice fiscal</label>
                    <select
                        value={annee}
                        onChange={(e) => setAnnee(+e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                    >
                        {[2026, 2025, 2024, 2023].map((a) => (
                            <option key={a} value={a}>{a}</option>
                        ))}
                    </select>
                    <span className="text-sm text-gray-500">{declarations.length} déclaration(s)</span>
                </div>
            </Card>

            {/* Liste */}
            {isLoading ? (
                <Spinner />
            ) : declarations.length === 0 ? (
                <Card>
                    <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">Aucune déclaration pour {annee}</p>
                        <p className="text-gray-400 text-sm mt-1">Allez dans la saisie mensuelle et cliquez sur "Générer déclaration"</p>
                    </div>
                </Card>
            ) : (
                <div className="space-y-3">
                    {declarations.map((d) => (
                        <Card key={d.id}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                {/* Info principale */}
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <FileText className="w-5 h-5 text-green-700" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-gray-900 text-sm">
                                                {MOIS_FR[d.mois - 1]} {d.annee}
                                            </span>
                                            {statutBadge(d.statut)}
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            {d.nb_salaries} salarié(s) · Créée le {new Date(d.created_at).toLocaleDateString('fr-FR')}
                                            {d.ref && <span className="ml-2 font-mono bg-gray-100 px-1 rounded">{d.ref}</span>}
                                        </p>
                                    </div>
                                </div>

                                {/* Totaux */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                    <div>
                                        <p className="text-xs text-gray-400">Brut</p>
                                        <p className="text-sm font-semibold text-gray-700">{fmtN(d.brut_total)} F</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">IUTS net</p>
                                        <p className="text-sm font-semibold text-green-700">{fmtN(d.iuts_total)} F</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">TPA</p>
                                        <p className="text-sm font-semibold text-blue-700">{fmtN(d.tpa_total)} F</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400">Total</p>
                                        <p className="text-sm font-bold text-gray-900">{fmtN(d.total)} F</p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Btn
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDownloadCSV(d.id, d.mois, d.annee)}
                                        title="Télécharger DIPE (CSV pour DGI)"
                                    >
                                        <FileDown className="w-4 h-4" /> DIPE CSV
                                    </Btn>
                                    <Btn
                                        variant="outline"
                                        size="sm"
                                        onClick={() => generatePDF(d)}
                                        title="Télécharger résumé PDF"
                                    >
                                        <FileDown className="w-4 h-4" /> PDF
                                    </Btn>
                                    {deleting === d.id ? (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => deleteMut.mutate(d.id)}
                                                className="px-2 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
                                            >
                                                Confirmer
                                            </button>
                                            <button
                                                onClick={() => setDeleting(null)}
                                                className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
                                            >
                                                Annuler
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setDeleting(d.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Résumé annuel */}
            {declarations.length > 0 && (
                <Card>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Cumul {annee}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: 'Brut total', value: declarations.reduce((s, d) => s + Number(d.brut_total), 0), color: 'text-gray-900' },
                            { label: 'IUTS total (DGI)', value: declarations.reduce((s, d) => s + Number(d.iuts_total), 0), color: 'text-green-700' },
                            { label: 'TPA total', value: declarations.reduce((s, d) => s + Number(d.tpa_total), 0), color: 'text-blue-700' },
                            { label: 'Total déclaré', value: declarations.reduce((s, d) => s + Number(d.total), 0), color: 'text-gray-900 font-bold' },
                        ].map((s) => (
                            <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                                <p className={`text-base font-bold ${s.color}`}>{fmtN(s.value)} F</p>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}
