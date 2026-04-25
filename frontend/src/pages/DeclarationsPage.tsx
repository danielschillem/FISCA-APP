import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { declarationApi, companyApi, bulletinApi, tvaApi, irfApi, ircmApi, isApi, cmeApi, patenteApi, retenueApi, cnssApi } from '../lib/api';
import { fmtN } from '../lib/fiscalCalc';
import { Card } from '../components/ui';
import { usePaymentGate } from '../components/PaymentModal';
import type { Declaration, Company, Bulletin, TVADeclaration, IRFDeclaration, IRCMDeclaration, ISDeclaration, CMEDeclaration, PatenteDeclaration, RetenueSource, CNSSPatronal } from '../types';
import { FileText, Trash2, CheckCircle2, Clock, AlertCircle, Loader2, TrendingUp, BarChart3 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateTVAForm, generateIRFForm, generateIRCMForm, generateISForm, generateCMEForm, generatePatenteForm, generateRetenuesForm } from '../lib/pdfDGI';

const MOIS_NOMS_FR = [
    'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
];

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

    // BP - filled with actual company data
    const bpH = 6;
    const LGRAY: [number, number, number] = [110, 110, 110];
    box(ML, y, CW, bpH);
    const bpY = y + 4.5;
    t('BP', ML + 2, bpY, 4.5, false, 'left', LGRAY);
    t(company?.bp ?? '', ML + 7, bpY, 6.5, true, 'left', BLACK);
    t('Quartier', ML + 33, bpY, 4.5, false, 'left', LGRAY);
    t(company?.quartier ?? '', ML + 45, bpY, 6.5, true, 'left', BLACK);
    t('Secteur', ML + 78, bpY, 4.5, false, 'left', LGRAY);
    t('N et rue', ML + 92, bpY, 4.5, false, 'left', LGRAY);
    t(company?.adresse ?? '', ML + 104, bpY, 6.5, true, 'left', BLACK);
    t('Section', ML + 142, bpY, 4.5, false, 'left', LGRAY);
    t('Lot', ML + 162, bpY, 4.5, false, 'left', LGRAY);
    t('Parcelle', ML + 173, bpY, 4.5, false, 'left', LGRAY);
    y += bpH;

    // Etablissements secondaires
    const etabH = 5.5;
    for (let i = 1; i <= 3; i++) {
        box(ML, y, CW, etabH);
        t(`${i}. Adresse etablissement secondaire`, ML + 2, y + 4, 5, false);
        y += etabH;
    }

    // Adresse domicile
    box(ML, y, CW, lineH);
    t('Adresse du domicile (Localite)', ML + 2, y + 3, 5, false);
    y += lineH;

    box(ML, y, CW, bpH);
    const bpY2 = y + 4.5;
    t('BP', ML + 2, bpY2, 4.5, false, 'left', LGRAY);
    t('Quartier', ML + 33, bpY2, 4.5, false, 'left', LGRAY);
    t('Secteur', ML + 78, bpY2, 4.5, false, 'left', LGRAY);
    t('N et rue', ML + 92, bpY2, 4.5, false, 'left', LGRAY);
    t('Section', ML + 142, bpY2, 4.5, false, 'left', LGRAY);
    t('Lot', ML + 162, bpY2, 4.5, false, 'left', LGRAY);
    t('Parcelle', ML + 173, bpY2, 4.5, false, 'left', LGRAY);
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
    t(fmtN(d.brut_total) + ' F', ML + 2, y + 5.5, 8, true, 'left', BLACK);
    t('3 %', ML + t1 + t2 / 2, y + 5.5, 8, true, 'center');
    t(fmtN(d.tpa_total) + ' F', ML + t1 + t2 + 2, y + 5.5, 8, true, 'left', BLACK);
    y += tRH;

    box(ML, y, t1, tRH); box(ML + t1, y, t2, tRH); box(ML + t1 + t2, y, t3, tRH);
    t('Montant deductions TPA', ML + 2, y + 5.5, 6.5);
    t('0', ML + t1 + t2 + 2, y + 5.5, 7, true);
    y += tRH;

    doc.setFillColor(245, 245, 245); box(ML, y, CW, tRH, 'FD'); vl(ML + t1 + t2, y, y + tRH);
    t('Sous total TPA', ML + 2, y + 5.5, 7, true);
    t(fmtN(d.tpa_total) + ' F', ML + t1 + t2 + 2, y + 5.5, 8, true, 'left', BLACK);
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
    t(fmtN(d.brut_total) + ' F', ML + iW + iW / 2, y + 7, 8, true, 'center', BLACK);
    t(fmtN(d.iuts_total) + ' F', ML + 2 * iW + iW / 2, y + 7, 8, true, 'center', BLACK);
    y += iRH;

    // TOTAL GENERAL
    const totH = 9;
    doc.setFillColor(240, 240, 240); box(ML, y, CW, totH, 'FD'); vl(ML + 2 * iW, y, y + totH);
    t('TOTAL GENERAL', ML + iW, y + 6.5, 8, true, 'center');
    t(fmtN(d.iuts_total + d.tpa_total) + ' FCFA', ML + 2 * iW + 3, y + 7, 9, true, 'left', [0, 0, 0]);
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
            ' - ' + (company?.nom ?? '') +
            ' - IFU : ' + (company?.ifu ?? '') +
            ' - RC : ' + (company?.rc ?? ''),
            ML + 2, y2 + 4.5
        );
        y2 += 6;

        const tableBody = bulletins.map((b, idx) => [
            String(idx + 1),
            b.nom_employe,
            fmtN(b.brut_total),
            fmtN(b.base_imposable),
            String(b.charges),
            fmtN(b.iuts_net),
        ]);
        const totBrut = bulletins.reduce((s, b) => s + Number(b.brut_total), 0);
        const totBase = bulletins.reduce((s, b) => s + Number(b.base_imposable), 0);
        const totIUTS = bulletins.reduce((s, b) => s + Number(b.iuts_net), 0);

        autoTable(doc, {
            startY: y2,
            head: [['N', 'Noms et prenoms des salaries', 'Salaires bruts\n(FCFA)', 'Bases imposables\n(FCFA)', 'Nombre\nde charges', 'IUTS du\n(FCFA)']],
            body: tableBody,
            foot: [['', 'TOTAUX', fmtN(totBrut), fmtN(totBase), '', fmtN(totIUTS)]],
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

// -- Types unifiés ---------------------------------------------
type TaxType = 'IUTS/TPA' | 'TVA' | 'IRF' | 'IRCM' | 'IS/MFP' | 'CME' | 'Patente' | 'RAS' | 'CNSS';

interface UnifiedDecl {
    id: string;
    type: TaxType;
    annee: number;
    mois?: number;
    montant: number;
    statut: string;
    ref: string | null;
    created_at: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    raw: any;
}

const TYPE_CFG: Record<TaxType, { label: string; color: string; bg: string }> = {
    'IUTS/TPA': { label: 'IUTS / TPA',  color: 'text-green-700',  bg: 'bg-green-100'  },
    'TVA':      { label: 'TVA',          color: 'text-blue-700',   bg: 'bg-blue-100'   },
    'IRF':      { label: 'IRF',          color: 'text-orange-700', bg: 'bg-orange-100' },
    'IRCM':     { label: 'IRCM',         color: 'text-purple-700', bg: 'bg-purple-100' },
    'IS/MFP':   { label: 'IS / MFP',    color: 'text-indigo-700', bg: 'bg-indigo-100' },
    'CME':      { label: 'CME',          color: 'text-teal-700',   bg: 'bg-teal-100'   },
    'Patente':  { label: 'Patente',      color: 'text-amber-700',  bg: 'bg-amber-100'  },
    'RAS':      { label: 'Retenues',     color: 'text-cyan-700',   bg: 'bg-cyan-100'   },
    'CNSS':     { label: 'CNSS',         color: 'text-pink-700',   bg: 'bg-pink-100'   },
};

const MOIS_COURTS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

function periodeLabel(annee: number, mois?: number) {
    return mois ? `${MOIS_COURTS[mois - 1]} ${annee}` : String(annee);
}

function statutBadge(statut: string) {
    if (['ok','declare','approuve','valide'].includes(statut))
        return <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3" />Déclaré</span>;
    if (statut === 'retard')
        return <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700"><AlertCircle className="w-3 h-3" />En retard</span>;
    if (statut === 'soumis')
        return <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700"><Clock className="w-3 h-3" />Soumis</span>;
    return <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3" />Brouillon</span>;
}

export default function DeclarationsPage() {
    const [annee, setAnnee] = useState(new Date().getFullYear());
    const [deleting, setDeleting] = useState<string | null>(null);
    const [filterType, setFilterType] = useState<TaxType | 'Tous'>('Tous');
    const [downloadingPDF, setDownloadingPDF] = useState<string | null>(null);
    const { requestPayment, PaymentModalComponent } = usePaymentGate();
    const qc = useQueryClient();

    const { data: company } = useQuery<Company>({
        queryKey: ['company'],
        queryFn: () => companyApi.get().then((r) => r.data),
        staleTime: Infinity,
    });

    // -- Fetch all declaration types ----------------------------------
    const { data: iutsDecls  = [] } = useQuery<Declaration[]>({
        queryKey: ['declarations', annee],
        queryFn: () => declarationApi.list(annee).then((r) => r.data ?? []),
    });
    const { data: tvaDecls   = [] } = useQuery<TVADeclaration[]>({
        queryKey: ['tva', annee],
        queryFn: () => tvaApi.list(annee).then((r) => r.data ?? []),
    });
    const { data: irfDecls   = [] } = useQuery<IRFDeclaration[]>({
        queryKey: ['irf', annee],
        queryFn: () => irfApi.list(annee).then((r) => r.data),
    });
    const { data: ircmDecls  = [] } = useQuery<IRCMDeclaration[]>({
        queryKey: ['ircm', annee],
        queryFn: () => ircmApi.list(annee).then((r) => r.data),
    });
    const { data: isDecls    = [] } = useQuery<ISDeclaration[]>({
        queryKey: ['is', annee],
        queryFn: () => isApi.list(annee).then((r) => r.data),
    });
    const { data: cmeDecls   = [] } = useQuery<CMEDeclaration[]>({
        queryKey: ['cme', annee],
        queryFn: () => cmeApi.list(annee).then((r) => r.data),
    });
    const { data: patenteDecls = [] } = useQuery<PatenteDeclaration[]>({
        queryKey: ['patente', annee],
        queryFn: () => patenteApi.list(annee).then((r) => r.data),
    });
    const { data: rasDecls   = [] } = useQuery<RetenueSource[]>({
        queryKey: ['retenues', annee],
        queryFn: () => retenueApi.list(undefined, annee).then((r) => r.data ?? []),
    });
    const { data: cnssDecls  = [] } = useQuery<CNSSPatronal[]>({
        queryKey: ['cnss', annee],
        queryFn: () => cnssApi.list(undefined, annee).then((r) => r.data ?? []),
    });

    // -- Helper to build normalized rows -----------------------------
    const buildRows = (): UnifiedDecl[] => [
        ...iutsDecls.map(d   => ({ id: d.id, type: 'IUTS/TPA' as TaxType, annee: d.annee, mois: d.mois,  montant: d.total,                  statut: d.statut, ref: d.ref,  created_at: d.created_at, raw: d })),
        ...tvaDecls.map(d    => ({ id: d.id, type: 'TVA'      as TaxType, annee: d.annee, mois: d.mois,  montant: Math.max(0, d.tva_nette), statut: d.statut, ref: d.ref,  created_at: d.created_at, raw: d })),
        ...irfDecls.map(d    => ({ id: d.id, type: 'IRF'      as TaxType, annee: d.annee,                montant: d.irf_total,               statut: d.statut, ref: d.ref,  created_at: d.created_at, raw: d })),
        ...ircmDecls.map(d   => ({ id: d.id, type: 'IRCM'     as TaxType, annee: d.annee,                montant: d.ircm_total,              statut: d.statut, ref: d.ref,  created_at: d.created_at, raw: d })),
        ...isDecls.map(d     => ({ id: d.id, type: 'IS/MFP'   as TaxType, annee: d.annee,                montant: d.is_du,                   statut: d.statut, ref: d.ref,  created_at: d.created_at, raw: d })),
        ...cmeDecls.map(d    => ({ id: d.id, type: 'CME'      as TaxType, annee: d.annee,                montant: d.cme_net,                 statut: d.statut, ref: d.ref,  created_at: d.created_at, raw: d })),
        ...patenteDecls.map(d=> ({ id: d.id, type: 'Patente'  as TaxType, annee: d.annee,                montant: d.total_patente,           statut: d.statut, ref: d.ref,  created_at: d.created_at, raw: d })),
        ...rasDecls.map(d    => ({ id: d.id, type: 'RAS'      as TaxType, annee: d.annee, mois: d.mois,  montant: d.montant_retenue,         statut: d.statut, ref: d.ref,  created_at: d.created_at, raw: d })),
        ...cnssDecls.map(d   => ({ id: d.id, type: 'CNSS'     as TaxType, annee: d.annee, mois: d.mois,  montant: d.total_general,           statut: d.statut, ref: null,   created_at: d.created_at, raw: d })),
    ];

    const allDecls = buildRows();
    const all = allDecls
        .filter(d => filterType === 'Tous' || d.type === filterType)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const totalMontant = all.reduce((s, d) => s + d.montant, 0);
    const typesPresents = (Object.keys(TYPE_CFG) as TaxType[]).filter(t => allDecls.some(d => d.type === t));

    // -- Métriques récap ----------------------------------------------
    const totalVerse   = allDecls.reduce((s, d) => s + d.montant, 0);
    const nbDeclare    = allDecls.filter(d => ['ok','declare','approuve','valide'].includes(d.statut)).length;
    const nbRetard     = allDecls.filter(d => d.statut === 'retard').length;
    const nbBrouillon  = allDecls.filter(d => !['ok','declare','approuve','valide','retard','soumis'].includes(d.statut)).length;
    const tauxConf     = allDecls.length > 0 ? Math.round((nbDeclare / allDecls.length) * 100) : 0;

    // -- Delete handler -----------------------------------------------
    const handleDelete = async (d: UnifiedDecl) => {
        const apiMap: Record<TaxType, (id: string) => Promise<unknown>> = {
            'IUTS/TPA': declarationApi.delete,
            'TVA':      tvaApi.delete,
            'IRF':      irfApi.delete,
            'IRCM':     ircmApi.delete,
            'IS/MFP':   isApi.delete,
            'CME':      cmeApi.delete,
            'Patente':  patenteApi.delete,
            'RAS':      retenueApi.delete,
            'CNSS':     cnssApi.delete,
        };
        await apiMap[d.type](d.id);
        ['declarations','tva','irf','ircm','is','cme','patente','retenues','cnss'].forEach(
            k => qc.invalidateQueries({ queryKey: [k] }),
        );
        setDeleting(null);
    };

    // -- PDF handler --------------------------------------------------
    const handlePDF = async (d: UnifiedDecl) => {
        if (d.type === 'IUTS/TPA') {
            setDownloadingPDF(d.id);
            let bulletins: Bulletin[] = [];
            try { bulletins = (await bulletinApi.list(d.mois, d.annee)).data ?? []; }
            finally { setDownloadingPDF(null); }
            requestPayment('iuts', d.id, () => generateOfficialDGIPDF(d.raw as Declaration, company, bulletins));
            return;
        }
        if (d.type === 'TVA')     { generateTVAForm(d.raw as TVADeclaration, company);         return; }
        if (d.type === 'IRF')     { generateIRFForm(d.raw as IRFDeclaration, company);         return; }
        if (d.type === 'IRCM')    { generateIRCMForm(d.raw as IRCMDeclaration, company);       return; }
        if (d.type === 'IS/MFP')  { generateISForm(d.raw as ISDeclaration, company);           return; }
        if (d.type === 'CME')     { generateCMEForm(d.raw as CMEDeclaration, company);         return; }
        if (d.type === 'Patente') { generatePatenteForm(d.raw as PatenteDeclaration, company); return; }
        if (d.type === 'RAS') {
            const grouped = rasDecls.filter(r => r.mois === d.mois && r.annee === d.annee);
            generateRetenuesForm(grouped, company, d.mois, d.annee);
        }
    };

    return (
        <div className="space-y-6">
            {PaymentModalComponent}

            {/* Récap métriques */}
            {allDecls.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
                                <TrendingUp className="w-4 h-4 text-green-700" />
                            </div>
                            <span className="text-xs text-gray-500 font-medium">Total versé {annee}</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900">{fmtN(totalVerse)}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">FCFA toutes taxes</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                                <BarChart3 className="w-4 h-4 text-blue-700" />
                            </div>
                            <span className="text-xs text-gray-500 font-medium">Déclarations</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900">{allDecls.length}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{typesPresents.length} type(s) d'impôt</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                            </div>
                            <span className="text-xs text-gray-500 font-medium">Conformité</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900">{tauxConf} %</p>
                        <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${tauxConf}%` }} />
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
                                <AlertCircle className="w-4 h-4 text-orange-700" />
                            </div>
                            <span className="text-xs text-gray-500 font-medium">À régulariser</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900">{nbRetard + nbBrouillon}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{nbRetard} retard - {nbBrouillon} brouillon</p>
                    </div>
                </div>
            )}
            <Card>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">Exercice</label>
                        <select value={annee} onChange={(e) => setAnnee(+e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:outline-none">
                            {[2026, 2025, 2024, 2023].map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">Impôt</label>
                        <select value={filterType} onChange={(e) => setFilterType(e.target.value as TaxType | 'Tous')}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:outline-none">
                            <option value="Tous">Tous les impôts</option>
                            {(Object.keys(TYPE_CFG) as TaxType[]).map(t => (
                                <option key={t} value={t}>{TYPE_CFG[t].label}</option>
                            ))}
                        </select>
                    </div>
                    <span className="text-sm text-gray-500 ml-auto">{all.length} déclaration(s)</span>
                </div>
            </Card>

            {/* KPI cliquables par type d'impôt */}
            {typesPresents.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {typesPresents.map(type => {
                        const items = allDecls.filter(d => d.type === type);
                        const cfg = TYPE_CFG[type];
                        const active = filterType === type;
                        return (
                            <button key={type}
                                onClick={() => setFilterType(active ? 'Tous' : type)}
                                className={`rounded-xl border-2 p-3 text-left transition-all ${
                                    active
                                        ? `${cfg.bg} border-current ${cfg.color}`
                                        : 'bg-white border-gray-100 hover:border-gray-200'
                                }`}>
                                <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
                                <p className="text-base font-bold text-gray-900 mt-0.5">{fmtN(items.reduce((s, d) => s + d.montant, 0))} F</p>
                                <p className="text-[11px] text-gray-500">{items.length} décl.</p>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Liste unifiée */}
            {all.length === 0 ? (
                <Card>
                    <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">Aucune déclaration pour {annee}</p>
                        <p className="text-gray-400 text-sm mt-1">
                            Les déclarations enregistrées dans chaque module fiscal (IUTS, TVA, IRF, IRCM, IS, CME, Patente…) apparaîtront ici.
                        </p>
                    </div>
                </Card>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Type d'impôt</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Période</th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Montant dû (FCFA)</th>
                                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Statut</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Réf.</th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {all.map((d) => {
                                const cfg = TYPE_CFG[d.type];
                                const deleteKey = `${d.type}-${d.id}`;
                                return (
                                    <tr key={deleteKey} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                                                {cfg.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-700 font-medium">
                                            {periodeLabel(d.annee, d.mois)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtN(d.montant)}</td>
                                        <td className="px-4 py-3 text-center">{statutBadge(d.statut)}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{d.ref ?? ' - '}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-1 items-center">
                                                {d.type !== 'CNSS' && (
                                                    <button onClick={() => handlePDF(d)} title="Exporter le formulaire DGI en PDF"
                                                        disabled={downloadingPDF === d.id}
                                                        className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                                                        {downloadingPDF === d.id
                                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                                            : <FileText className="w-4 h-4" />}
                                                    </button>
                                                )}
                                                {deleting === deleteKey ? (
                                                    <>
                                                        <button onClick={() => handleDelete(d)}
                                                            className="px-2 py-0.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">
                                                            Confirmer
                                                        </button>
                                                        <button onClick={() => setDeleting(null)}
                                                            className="px-2 py-0.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
                                                            Annuler
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button onClick={() => setDeleting(deleteKey)} title="Supprimer"
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t border-gray-200">
                            <tr>
                                <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-700">Total {annee}</td>
                                <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtN(totalMontant)} F</td>
                                <td colSpan={3} />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}

