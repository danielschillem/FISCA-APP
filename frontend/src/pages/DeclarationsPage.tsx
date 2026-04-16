import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { declarationApi, companyApi, bulletinApi } from '../lib/api';
import { fmtN } from '../lib/fiscalCalc';
import { Card, Btn, Badge, Spinner } from '../components/ui';
import type { Declaration, Company, Bulletin } from '../types';
import { MOIS_FR } from '../types';
import { FileDown, FileText, Trash2, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MOIS_NOMS_FR = [
    'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
];

function statutBadge(statut: string) {
    if (statut === 'ok' || statut === 'approuve') return <Badge color="green"><CheckCircle2 className="w-3 h-3 inline mr-1" />Validee</Badge>;
    if (statut === 'retard') return <Badge color="red"><AlertCircle className="w-3 h-3 inline mr-1" />En retard</Badge>;
    if (statut === 'soumis') return <Badge color="blue"><Clock className="w-3 h-3 inline mr-1" />Soumise</Badge>;
    return <Badge color="orange"><Clock className="w-3 h-3 inline mr-1" />En cours</Badge>;
}

// Reproduit fidelement le formulaire officiel DGI Burkina Faso
// DECLARATION DE VERSEMENT DE L'IUTS ET TPA (ref. IUTS 1)
function generateOfficialDGIPDF(d: Declaration, company?: Company, bulletins: Bulletin[] = []) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const ML = 10;
    const CW = 190;

    const box = (x: number, y: number, w: number, h: number, style: 'D' | 'F' | 'FD' = 'D') => {
        doc.setDrawColor(0); doc.setLineWidth(0.25);
        doc.rect(x, y, w, h, style);
    };
    const vl = (x: number, y1: number, y2: number) => {
        doc.setDrawColor(0); doc.setLineWidth(0.25); doc.line(x, y1, x, y2);
    };
    const t = (
        text: string, x: number, y: number,
        size: number,
        bold = false,
        align: 'left' | 'center' | 'right' = 'left',
        color: [number, number, number] = [0, 0, 0]
    ) => {
        doc.setFontSize(size);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setTextColor(...color);
        doc.text(text, x, y, { align });
    };
    const secBar = (x: number, y: number, w: number, h: number, label: string) => {
        doc.setFillColor(220, 220, 220);
        box(x, y, w, h, 'FD');
        t(label, x + 2, y + h - 2, 7, true);
    };

    // Formateur PDF-safe : evite le separateur unicode (fr-FR) non rendu par Helvetica
    const pdfNum = (n: number): string =>
        Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const BLACK: [number, number, number] = [0, 0, 0];

    // ==================== PAGE 1 ====================
    let y = 10;
    const secH = 7;
    const lineH = 7;

    // --- HEADER : 3 boites cote a cote ---
    const bW = CW / 3;
    const hH = 24;

    box(ML, y, bW, hH);
    t('CACHET DU SERVICE', ML + 2, y + 5.5, 7, true);

    box(ML + bW, y, bW, hH);
    t('DIRECTION GENERALE DES IMPOTS', ML + bW + bW / 2, y + 5.5, 7.5, true, 'center');
    t('DECLARATION DE VERSEMENT DE', ML + bW + bW / 2, y + 10.5, 8, true, 'center');
    t("- Retenue de l'Impot Unique sur les", ML + bW + 3, y + 15.5, 5.5);
    t('  Traitements et Salaires (IUTS)', ML + bW + 3, y + 19, 5.5);
    t("- Taxe Patronale d'Apprentissage (TPA)", ML + bW + 3, y + 22.5, 5.5);

    box(ML + 2 * bW, y, bW, hH);
    t('DATE DE RECEPTION', ML + 2 * bW + 2, y + 5.5, 7, true);

    y += hH;

    // --- I. PERIODE ---
    secBar(ML, y, CW, secH, 'I. PERIODE');
    y += secH;

    const pw = CW / 3;
    const periodeH = 9;
    box(ML, y, pw, periodeH); box(ML + pw, y, pw, periodeH); box(ML + 2 * pw, y, pw, periodeH);
    t('Mois', ML + 2, y + 3.5, 5.5, false);
    t('Semestre', ML + pw + 2, y + 3.5, 5.5, false);
    t('Annee', ML + 2 * pw + 2, y + 3.5, 5.5, false);
    t(MOIS_NOMS_FR[d.mois - 1], ML + 2, y + 8, 8.5, true, 'left', BLACK);
    t(String(d.annee), ML + 2 * pw + 2, y + 8, 8.5, true, 'left', BLACK);
    y += periodeH;

    // --- II. IDENTIFICATION ---
    secBar(ML, y, CW, secH, 'II. IDENTIFICATION DU REDEVABLE');
    y += secH;

    // RC | IFU
    const rcW = CW * 0.45;
    box(ML, y, rcW, lineH); box(ML + rcW, y, CW - rcW, lineH);
    t('N Registre de commerce', ML + 2, y + 3, 5, false);
    t('N IFU', ML + rcW + 2, y + 3, 5, false);
    t(company?.rc ?? '', ML + 2, y + 6.5, 8, true, 'left', BLACK);
    t(company?.ifu ?? '', ML + rcW + 2, y + 6.5, 8, true, 'left', BLACK);
    y += lineH;

    // Nom | Code activite
    const nomW = CW * 0.72;
    box(ML, y, nomW, lineH); box(ML + nomW, y, CW - nomW, lineH);
    t('Nom, prenoms ou raison sociale', ML + 2, y + 3, 5, false);
    t('Code activite', ML + nomW + 2, y + 3, 5, false);
    t(company?.nom ?? '', ML + 2, y + 6.5, 8, true, 'left', BLACK);
    y += lineH;

    // Profession
    box(ML, y, CW, lineH);
    t('Profession ou activite', ML + 2, y + 3, 5, false);
    t(company?.secteur ?? '', ML + 2, y + 6.5, 7.5, true, 'left', BLACK);
    y += lineH;

    // Adresse siege
    box(ML, y, CW, lineH);
    t('Adresse du siege (Localite)', ML + 2, y + 3, 5, false);
    t(company?.adresse ?? '', ML + 2, y + 6.5, 7.5, true, 'left', BLACK);
    y += lineH;

    // BP
    const bpH = 6;
    box(ML, y, CW, bpH);
    t('BP ..........  Quartier ................  Secteur ...  N et rue ..................  Section ...........  Lot ....  Parcelle ....', ML + 2, y + 4.5, 5, false);
    y += bpH;

    // Etablissements secondaires
    const etabH = 5.5;
    for (let i = 1; i <= 3; i++) {
        box(ML, y, CW, etabH);
        t(`${i}. Adresse etablissement secondaire ...............................................................................................................`, ML + 2, y + 4, 5, false);
        y += etabH;
    }

    // Adresse domicile
    box(ML, y, CW, lineH);
    t('Adresse du domicile (Localite) ...................................................................................................................', ML + 2, y + 4.5, 5, false);
    y += lineH;

    box(ML, y, CW, bpH);
    t('BP ..........  Quartier ................  Secteur ...  N et rue ..................  Section ...........  Lot ....  Parcelle ....', ML + 2, y + 4.5, 5, false);
    y += bpH;

    // --- III. TPA ---
    secBar(ML, y, CW, secH, "III. TAXE PATRONALE ET D'APPRENTISSAGE  (articles 127 a 130 du Code des Impots)");
    y += secH;

    const t1 = 90; const t2 = 30; const t3 = CW - t1 - t2;
    const tHH = 6; const tRH = 7;

    box(ML, y, t1, tHH); box(ML + t1, y, t2, tHH); box(ML + t1 + t2, y, t3, tHH);
    t('Montant base taxable', ML + 2, y + 4.5, 6, true);
    t('Taux', ML + t1 + t2 / 2, y + 4.5, 6, true, 'center');
    t('Montant TPA du', ML + t1 + t2 + 2, y + 4.5, 6, true);
    y += tHH;

    box(ML, y, t1, tRH); box(ML + t1, y, t2, tRH); box(ML + t1 + t2, y, t3, tRH);
    t(pdfNum(d.brut_total) + ' F', ML + 2, y + 5.5, 8, true, 'left', BLACK);
    t('3 %', ML + t1 + t2 / 2, y + 5.5, 8, true, 'center');
    t(pdfNum(d.tpa_total) + ' F', ML + t1 + t2 + 2, y + 5.5, 8, true, 'left', BLACK);
    y += tRH;

    box(ML, y, t1, tRH); box(ML + t1, y, t2, tRH); box(ML + t1 + t2, y, t3, tRH);
    t('Montant deductions TPA', ML + 2, y + 5.5, 6.5);
    t('0', ML + t1 + t2 + 2, y + 5.5, 7, true);
    y += tRH;

    doc.setFillColor(245, 245, 245); box(ML, y, CW, tRH, 'FD'); vl(ML + t1 + t2, y, y + tRH);
    t('Sous total TPA', ML + 2, y + 5.5, 7, true);
    t(pdfNum(d.tpa_total) + ' F', ML + t1 + t2 + 2, y + 5.5, 8, true, 'left', BLACK);
    y += tRH;

    // --- IV. IUTS ---
    secBar(ML, y, CW, secH, "IV. IMPOT UNIQUE SUR LES TRAITEMENTS ET SALAIRES  (articles 59 a 71 du Code des Impots)");
    y += secH;

    const iW = CW / 3;
    const iHH = 6; const iRH = 9;

    box(ML, y, iW, iHH); box(ML + iW, y, iW, iHH); box(ML + 2 * iW, y, iW, iHH);
    t('Nombre de salaries', ML + iW / 2, y + 4.5, 6, true, 'center');
    t('Total salaires bruts', ML + iW + iW / 2, y + 4.5, 6, true, 'center');
    t('Total IUTS du', ML + 2 * iW + iW / 2, y + 4.5, 6, true, 'center');
    y += iHH;

    box(ML, y, iW, iRH); box(ML + iW, y, iW, iRH); box(ML + 2 * iW, y, iW, iRH);
    t(String(d.nb_salaries), ML + iW / 2, y + 7, 11, true, 'center', BLACK);
    t(pdfNum(d.brut_total) + ' F', ML + iW + iW / 2, y + 7, 8, true, 'center', BLACK);
    t(pdfNum(d.iuts_total) + ' F', ML + 2 * iW + iW / 2, y + 7, 8, true, 'center', BLACK);
    y += iRH;

    // TOTAL GENERAL
    const totH = 9;
    doc.setFillColor(240, 240, 240); box(ML, y, CW, totH, 'FD'); vl(ML + 2 * iW, y, y + totH);
    t('TOTAL GENERAL', ML + iW, y + 6.5, 8, true, 'center');
    t(pdfNum(d.iuts_total + d.tpa_total) + ' FCFA', ML + 2 * iW + 3, y + 7, 9, true, 'left', [0, 0, 0]);
    y += totH;

    // --- REGLEMENT ---
    const reglH = 28;
    box(ML, y, CW, reglH);
    t("Reglement joint a l'ordre du receveur des impots :", ML + 2, y + 5, 6.5, true);
    t("- Cheque bancaire sur _________________ N __________  du ___________  Montant ____________________", ML + 4, y + 11, 5.5, false);
    t("- Espece d'un montant de ___________________________________________________________________________", ML + 4, y + 16, 5.5, false);
    t("- Virement bancaire : Code banque __________ Code guichet __________  N compte _______________  Cle RIB _____", ML + 4, y + 21, 5.5, false);
    t("  Swift code _________________  Code IBAN _________________", ML + 4, y + 26, 5.5, false);
    y += reglH;

    // --- SIGNATURE ---
    const sigLH = 7;
    box(ML, y, CW, sigLH);
    t('A ______________________________   Le _______________________________', ML + 2, y + 5, 6.5, false);
    t('Nom - Qualite - Signature', ML + CW - 60, y + 5, 6, false);
    y += sigLH;

    const sigBH = 22;
    const sw = CW * 0.46;
    box(ML, y, sw, sigBH); box(ML + CW - sw, y, sw, sigBH);
    t("Cachet et signature de l'employeur", ML + 2, y + 4.5, 5.5, false);
    t('Visa DGI / DGTCP', ML + CW - sw + 2, y + 4.5, 5.5, false);
    y += sigBH;

    // --- V. CADRE RESERVE A L'ADMINISTRATION ---
    secBar(ML, y, CW, secH, "V. CADRE RESERVE A L'ADMINISTRATION");
    y += secH;

    const admH = 30;
    const admW = CW / 4;
    const admLabels = ['PRISE EN RECETTE', 'PRISE EN CHARGE', 'PENALITES', 'VISA DU RECEVEUR'];
    admLabels.forEach((lbl, i) => {
        box(ML + i * admW, y, admW, admH);
        t(lbl, ML + i * admW + admW / 2, y + 5.5, 5.5, true, 'center');
    });

    // --- FOOTER ---
    doc.setDrawColor(190, 190, 190); doc.setLineWidth(0.2);
    doc.line(ML, 287, ML + CW, 287);
    doc.setFontSize(6); doc.setFont('helvetica', 'italic'); doc.setTextColor(130, 130, 130);
    doc.text('IUTS 1 - 1 -', ML, 292);
    doc.text('Genere par FISCA - Plateforme Fiscale Numerique Burkina Faso - CGI 2025', ML + CW / 2, 292, { align: 'center' });

    // ==================== PAGE 2 : ETAT ANNEXE ====================
    if (bulletins.length > 0) {
        doc.addPage();
        let y2 = 10;

        // Entete
        doc.setFillColor(220, 220, 220); doc.rect(ML, y2, CW, 9, 'FD');
        doc.setDrawColor(0); doc.setLineWidth(0.25); doc.rect(ML, y2, CW, 9);
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
        doc.text('IV. ETAT ANNEXE DE DECLARATION DE VERSEMENT DE LA RETENUE IUTS - TPA', ML + CW / 2, y2 + 6.5, { align: 'center' });
        y2 += 9;

        // Sous-entete periode
        doc.rect(ML, y2, CW, 6); doc.setLineWidth(0.25);
        doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
        doc.text(
            'Periode : ' + MOIS_NOMS_FR[d.mois - 1] + ' ' + d.annee +
            '  -  ' + (company?.nom ?? '') +
            '  -  IFU : ' + (company?.ifu ?? '') +
            '  -  RC : ' + (company?.rc ?? ''),
            ML + 2, y2 + 4.5
        );
        y2 += 6;

        const tableBody = bulletins.map((b, idx) => [
            String(idx + 1),
            b.nom_employe,
            pdfNum(b.brut_total),
            pdfNum(b.base_imposable),
            String(b.charges),
            pdfNum(b.iuts_net),
        ]);
        const totBrut = bulletins.reduce((s, b) => s + Number(b.brut_total), 0);
        const totBase = bulletins.reduce((s, b) => s + Number(b.base_imposable), 0);
        const totIUTS = bulletins.reduce((s, b) => s + Number(b.iuts_net), 0);

        autoTable(doc, {
            startY: y2,
            head: [['N', 'Noms et prenoms des salaries', 'Salaires bruts\n(FCFA)', 'Bases imposables\n(FCFA)', 'Nombre\nde charges', 'IUTS du\n(FCFA)']],
            body: tableBody,
            foot: [['', 'TOTAUX', pdfNum(totBrut), pdfNum(totBase), '', pdfNum(totIUTS)]],
            styles: {
                fontSize: 8,
                cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
                textColor: [0, 0, 0] as [number, number, number],
                lineColor: [0, 0, 0] as [number, number, number],
                lineWidth: 0.25,
            },
            headStyles: {
                fillColor: [220, 220, 220] as [number, number, number],
                textColor: [0, 0, 0] as [number, number, number],
                fontStyle: 'bold',
                fontSize: 7,
                halign: 'center',
            },
            footStyles: {
                fillColor: [218, 235, 218] as [number, number, number],
                textColor: [0, 0, 0] as [number, number, number],
                fontStyle: 'bold',
                fontSize: 8,
            },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' },
                1: { cellWidth: 65 },
                2: { cellWidth: 30, halign: 'right' },
                3: { cellWidth: 30, halign: 'right' },
                4: { cellWidth: 20, halign: 'center' },
                5: { cellWidth: 30, halign: 'right' },
            },
            tableLineColor: [0, 0, 0] as [number, number, number],
            tableLineWidth: 0.25,
        });

        doc.setDrawColor(190, 190, 190); doc.setLineWidth(0.2);
        doc.line(ML, 287, ML + CW, 287);
        doc.setFontSize(6); doc.setFont('helvetica', 'italic'); doc.setTextColor(130, 130, 130);
        doc.text('IUTS 1 - 2 -', ML, 292);
        doc.text('Genere par FISCA - Plateforme Fiscale Numerique Burkina Faso - CGI 2025', ML + CW / 2, 292, { align: 'center' });
    }

    doc.save('DGI-IUTS-TPA-' + d.annee + '-' + String(d.mois).padStart(2, '0') + '-' + (company?.nom ?? 'declaration').replace(/\s+/g, '_') + '.pdf');
}

export default function DeclarationsPage() {
    const [annee, setAnnee] = useState(new Date().getFullYear());
    const [deleting, setDeleting] = useState<string | null>(null);
    const [downloadingPDF, setDownloadingPDF] = useState<string | null>(null);
    const qc = useQueryClient();

    const { data: company } = useQuery<Company>({
        queryKey: ['company'],
        queryFn: () => companyApi.get().then((r) => r.data),
        staleTime: Infinity,
    });

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

    const handleDownloadPDF = async (d: Declaration) => {
        setDownloadingPDF(d.id);
        try {
            const res = await bulletinApi.list(d.mois, d.annee);
            const bulletins: Bulletin[] = res.data ?? [];
            generateOfficialDGIPDF(d, company, bulletins);
        } finally {
            setDownloadingPDF(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Filtre annee */}
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
                    <span className="text-sm text-gray-500">{declarations.length} declaration(s)</span>
                </div>
            </Card>

            {/* Liste */}
            {isLoading ? (
                <Spinner />
            ) : declarations.length === 0 ? (
                <Card>
                    <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">Aucune declaration pour {annee}</p>
                        <p className="text-gray-400 text-sm mt-1">Allez dans la saisie mensuelle et cliquez sur "Generer declaration"</p>
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
                                            {d.nb_salaries} salarie(s) - Cree le {new Date(d.created_at).toLocaleDateString('fr-FR')}
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
                                        title="Telecharger DIPE (CSV pour DGI)"
                                    >
                                        <FileDown className="w-4 h-4" /> DIPE CSV
                                    </Btn>
                                    <Btn
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDownloadPDF(d)}
                                        disabled={downloadingPDF === d.id}
                                        title="Formulaire officiel DGI IUTS/TPA"
                                    >
                                        {downloadingPDF === d.id
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : <FileDown className="w-4 h-4" />}
                                        {' '}Formulaire DGI
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

            {/* Resume annuel */}
            {declarations.length > 0 && (
                <Card>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Cumul {annee}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: 'Brut total', value: declarations.reduce((s, d) => s + Number(d.brut_total), 0), color: 'text-gray-900' },
                            { label: 'IUTS total (DGI)', value: declarations.reduce((s, d) => s + Number(d.iuts_total), 0), color: 'text-green-700' },
                            { label: 'TPA total', value: declarations.reduce((s, d) => s + Number(d.tpa_total), 0), color: 'text-blue-700' },
                            { label: 'Total declare', value: declarations.reduce((s, d) => s + Number(d.total), 0), color: 'text-gray-900 font-bold' },
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
