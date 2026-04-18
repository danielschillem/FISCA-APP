/**
 * pdfDGI.ts – Générateurs de formulaires officiels DGI Burkina Faso
 * Formulaires reproduits fidèlement selon les modèles de la Direction Générale des Impôts.
 *
 * Exports :
 *   generateTVAForm     – Déclaration TVA mensuelle
 *   generateRetenuesForm – Déclaration RAS mensuelle
 *   generateISForm      – Déclaration IS/MFP annuelle
 *   generateIRCMForm    – Déclaration IRCM annuelle
 *   generateCMEForm     – Déclaration CME annuelle
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TVADeclaration, RetenueSource, ISDeclaration, IRCMDeclaration, CMEDeclaration, IRFDeclaration, PatenteDeclaration, Company } from '../types';
import { fmtN } from './fiscalCalc';

// ── Constantes ────────────────────────────────────────────────
const MOIS_DGI = [
    'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];
type RGB = [number, number, number];
type DocWithTable = jsPDF & { lastAutoTable: { finalY: number } };
const BLACK: RGB = [0, 0, 0];

// ── Helpers partagés ──────────────────────────────────────────
function makeDoc() {
    return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
}

/**
 * Sauvegarde le PDF de fa�on compatible mobile (iOS Safari, Android Chrome).
 * Sur iOS, doc.save() peut �chouer silencieusement apr�s un `await` car la
 * cha�ne du geste utilisateur est rompue. On utilise une blob URL + window.open
 * comme fallback universel.
 */
function savePdf(doc: jsPDF, filename: string) {
    try {
        // M�thode standard (desktop Chrome/Firefox/Edge)
        doc.save(filename);
    } catch {
        // Fallback mobile : ouvrir dans un nouvel onglet via blob URL
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
}

function box(doc: jsPDF, x: number, y: number, w: number, h: number, style: 'D' | 'F' | 'FD' = 'D') {
    doc.setDrawColor(0);
    doc.setLineWidth(0.25);
    doc.rect(x, y, w, h, style);
}

function secBar(doc: jsPDF, x: number, y: number, w: number, h: number, label: string) {
    doc.setFillColor(220, 220, 220);
    box(doc, x, y, w, h, 'FD');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(label, x + 2, y + h - 2);
}

function t(
    doc: jsPDF,
    text: string, x: number, y: number,
    size: number, bold = false,
    align: 'left' | 'center' | 'right' = 'left',
    color: RGB = BLACK,
) {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...color);
    doc.text(text, x, y, { align });
}

function dgiHeader(
    doc: jsPDF, ML: number, CW: number, y: number,
    title1: string, title2: string,
): number {
    const bW = CW / 3;
    const hH = 28;
    box(doc, ML, y, bW, hH);
    t(doc, 'CACHET DU SERVICE', ML + 2, y + 5.5, 7, true);

    box(doc, ML + bW, y, bW, hH);
    t(doc, 'DIRECTION GENERALE DES IMPOTS', ML + bW + bW / 2, y + 6, 7, true, 'center');
    t(doc, title1, ML + bW + bW / 2, y + 13, 6.5, true, 'center');
    if (title2) t(doc, title2, ML + bW + bW / 2, y + 19, 5.5, false, 'center');

    box(doc, ML + 2 * bW, y, bW, hH);
    t(doc, 'DATE DE RECEPTION', ML + 2 * bW + 2, y + 5.5, 7, true);
    return y + hH;
}

function dgiIdentification(doc: jsPDF, ML: number, CW: number, y: number, company?: Company): number {
    const secH = 7;
    secBar(doc, ML, y, CW, secH, 'II. IDENTIFICATION DU REDEVABLE');
    y += secH;

    const hw = CW / 2;
    const rowH = 8;

    // RC | IFU
    box(doc, ML, y, hw, rowH);
    box(doc, ML + hw, y, hw, rowH);
    t(doc, 'RC :', ML + 2, y + 3, 5.5);
    t(doc, 'IFU :', ML + hw + 2, y + 3, 5.5);
    t(doc, company?.rc ?? '', ML + 10, y + rowH - 1.5, 8.5, true, 'left', BLACK);
    t(doc, company?.ifu ?? '', ML + hw + 10, y + rowH - 1.5, 8.5, true, 'left', BLACK);
    y += rowH;

    // Nom
    box(doc, ML, y, CW, rowH);
    t(doc, 'Nom / Raison sociale :', ML + 2, y + 3, 5.5);
    t(doc, company?.nom ?? '', ML + 2, y + rowH - 1.5, 8.5, true, 'left', BLACK);
    y += rowH;

    // Adresse
    box(doc, ML, y, CW, rowH);
    t(doc, 'Adresse / Siege social :', ML + 2, y + 3, 5.5);
    const adresse = [company?.adresse, company?.ville].filter(Boolean).join(', ') || '';
    t(doc, adresse, ML + 2, y + rowH - 1.5, 8, false, 'left', BLACK);
    y += rowH;

    // BP / Quartier
    const bpH = 6;
    const LGRAY: RGB = [110, 110, 110];
    box(doc, ML, y, CW, bpH);
    const bpY = y + 4.5;
    t(doc, 'BP', ML + 2, bpY, 4.5, false, 'left', LGRAY);
    t(doc, company?.bp ?? '', ML + 7, bpY, 6.5, true, 'left', BLACK);
    t(doc, 'Quartier', ML + 33, bpY, 4.5, false, 'left', LGRAY);
    t(doc, company?.quartier ?? '', ML + 45, bpY, 6.5, true, 'left', BLACK);
    t(doc, 'Secteur', ML + 78, bpY, 4.5, false, 'left', LGRAY);
    t(doc, 'N et rue', ML + 92, bpY, 4.5, false, 'left', LGRAY);
    t(doc, company?.adresse ?? '', ML + 104, bpY, 6.5, true, 'left', BLACK);
    t(doc, 'Section', ML + 142, bpY, 4.5, false, 'left', LGRAY);
    t(doc, 'Lot', ML + 162, bpY, 4.5, false, 'left', LGRAY);
    t(doc, 'Parcelle', ML + 173, bpY, 4.5, false, 'left', LGRAY);
    y += bpH;

    // Tel | Email
    box(doc, ML, y, hw, rowH);
    box(doc, ML + hw, y, hw, rowH);
    t(doc, 'Tel :', ML + 2, y + 3, 5.5);
    t(doc, 'Email :', ML + hw + 2, y + 3, 5.5);
    t(doc, company?.tel ?? '', ML + 10, y + rowH - 1.5, 8, false, 'left', BLACK);
    t(doc, company?.email_entreprise ?? '', ML + hw + 14, y + rowH - 1.5, 7, false, 'left', BLACK);
    y += rowH;

    return y;
}

function dgiReglement(doc: jsPDF, ML: number, CW: number, y: number, montant: number): number {
    const secH = 7;
    secBar(doc, ML, y, CW, secH, 'MODALITES DE REGLEMENT');
    y += secH;

    const rowH = 9;
    box(doc, ML, y, CW, rowH);
    t(doc, 'Mode :', ML + 2, y + 3, 5.5);
    t(doc, '[ ] Cheque   [ ] Virement   [ ] Especes   [ ] Mobile Money', ML + 22, y + 3, 6.5);
    t(doc, 'Montant :', ML + 2, y + rowH - 2, 6);
    t(doc, fmtN(montant) + ' FCFA', ML + 28, y + rowH - 2, 9, true, 'left', BLACK);
    y += rowH;

    box(doc, ML, y, CW, rowH);
    t(doc, 'Reference du versement / Numero de cheque :', ML + 2, y + 3, 5.5);
    y += rowH;

    return y;
}

function dgiSignatures(doc: jsPDF, ML: number, CW: number, y: number): number {
    y += 5;
    const hw = CW / 2;
    const rowH = 22;
    box(doc, ML, y, hw, rowH);
    box(doc, ML + hw, y, hw, rowH);
    t(doc, 'LE DECLARANT', ML + hw / 2, y + 4, 7, true, 'center');
    t(doc, '(Signature et cachet)', ML + hw / 2, y + 8, 5.5, false, 'center');
    t(doc, 'LE RECEVEUR', ML + hw + hw / 2, y + 4, 7, true, 'center');
    return y + rowH;
}

function dgiFooter(doc: jsPDF) {
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(`Genere par FISCA – ${new Date().toLocaleDateString('fr-FR')}`, 14, pageH - 8);
    doc.text('Direction Generale des Impots – Burkina Faso', 200, pageH - 8, { align: 'right' });
}

// ── 1. TVA ────────────────────────────────────────────────────
export function generateTVAForm(decl: TVADeclaration, company?: Company) {
    const doc = makeDoc();
    const ML = 10;
    const CW = 190;
    const secH = 7;

    let y = dgiHeader(doc, ML, CW, 10,
        'DECLARATION DE LA TAXE', 'SUR LA VALEUR AJOUTEE (TVA)');

    // Section I : Période
    secBar(doc, ML, y, CW, secH, 'I. PERIODE');
    y += secH;
    const pw = CW / 3;
    const periodeH = 9;
    box(doc, ML, y, pw, periodeH);
    box(doc, ML + pw, y, pw, periodeH);
    box(doc, ML + 2 * pw, y, pw, periodeH);
    t(doc, 'Mois', ML + 2, y + 3.5, 5.5);
    t(doc, 'Trimestre', ML + pw + 2, y + 3.5, 5.5);
    t(doc, 'Annee', ML + 2 * pw + 2, y + 3.5, 5.5);
    t(doc, MOIS_DGI[decl.mois - 1], ML + 2, y + periodeH - 1.5, 8.5, true, 'left', BLACK);
    t(doc, String(decl.annee), ML + 2 * pw + 2, y + periodeH - 1.5, 8.5, true, 'left', BLACK);
    y += periodeH;

    y = dgiIdentification(doc, ML, CW, y, company);

    // Section III : TVA Collectée
    y += 2;
    secBar(doc, ML, y, CW, secH, 'III. TVA COLLECTEE SUR VENTES ET PRESTATIONS');
    y += secH;

    // Normalise le taux : peut �tre stock� en d�cimal (0.18 ancienne version) ou en % (18 nouvelle version)
    const normTaux = (t: number): number => t < 1 ? t * 100 : t;
    // Recalcule la TVA depuis HT � taux pour garantir la coh�rence math�matique
    // m�me pour les anciennes d�clarations dont montant_tva �tait incorrect en base
    const recalcTVA = (ht: number, taux: number): number => Math.round(ht * normTaux(taux) / 100);

    const lignesV = (decl.lignes ?? []).filter(l => l.type_op === 'vente');
    const lignesA = (decl.lignes ?? []).filter(l => l.type_op === 'achat');

    const ventesCalc = lignesV.map(l => ({ ...l, taux_pct: normTaux(l.taux_tva), tva_corr: recalcTVA(l.montant_ht, l.taux_tva) }));
    const achatsCalc = lignesA.map(l => ({ ...l, taux_pct: normTaux(l.taux_tva), tva_corr: recalcTVA(l.montant_ht, l.taux_tva) }));

    const pdfTVAC = ventesCalc.length > 0 ? ventesCalc.reduce((s, l) => s + l.tva_corr, 0) : decl.tva_collectee;
    const pdfTVAD = achatsCalc.length > 0 ? achatsCalc.reduce((s, l) => s + l.tva_corr, 0) : decl.tva_deductible;
    const pdfNette = pdfTVAC - pdfTVAD;
    const pdfCredit = pdfNette < 0;

    autoTable(doc, {
        startY: y,
        head: [['Description', 'Montant HT (FCFA)', 'Taux TVA', 'Montant TVA (FCFA)']],
        body: ventesCalc.length > 0
            ? ventesCalc.map(l => [l.description, fmtN(l.montant_ht), `${l.taux_pct.toFixed(0)} %`, fmtN(l.tva_corr)])
            : [['Ventes et prestations de services', fmtN(decl.ca_ht), '18 %', fmtN(pdfTVAC)]],
        foot: [['TOTAL TVA COLLECTEE', '', '', fmtN(pdfTVAC)]],
        styles: { fontSize: 7.5, textColor: BLACK, cellPadding: 2 },
        headStyles: { fillColor: [220, 220, 220] as RGB, textColor: BLACK, fontStyle: 'bold' },
        footStyles: { fillColor: [220, 220, 220] as RGB, fontStyle: 'bold', textColor: BLACK },
        columnStyles: {
            0: { cellWidth: 82 }, 1: { halign: 'right', cellWidth: 37 },
            2: { halign: 'center', cellWidth: 24 }, 3: { halign: 'right', cellWidth: 40 },
        },
        margin: { left: ML },
    });
    y = (doc as DocWithTable).lastAutoTable.finalY + 3;

    // Section IV : TVA Déductible
    secBar(doc, ML, y, CW, secH, 'IV. TVA DEDUCTIBLE SUR ACHATS ET CHARGES');
    y += secH;
    autoTable(doc, {
        startY: y,
        head: [['Description', 'Montant HT (FCFA)', 'Taux TVA', 'Montant TVA (FCFA)']],
        body: achatsCalc.length > 0
            ? achatsCalc.map(l => [l.description, fmtN(l.montant_ht), `${l.taux_pct.toFixed(0)} %`, fmtN(l.tva_corr)])
            : [['Achats et charges deductibles', '', '18 %', fmtN(pdfTVAD)]],
        foot: [['TOTAL TVA DEDUCTIBLE', '', '', fmtN(pdfTVAD)]],
        styles: { fontSize: 7.5, textColor: BLACK, cellPadding: 2 },
        headStyles: { fillColor: [220, 220, 220] as RGB, textColor: BLACK, fontStyle: 'bold' },
        footStyles: { fillColor: [220, 220, 220] as RGB, fontStyle: 'bold', textColor: BLACK },
        columnStyles: {
            0: { cellWidth: 82 }, 1: { halign: 'right', cellWidth: 37 },
            2: { halign: 'center', cellWidth: 24 }, 3: { halign: 'right', cellWidth: 40 },
        },
        margin: { left: ML },
    });
    y = (doc as DocWithTable).lastAutoTable.finalY + 3;

    // Section V : TVA nette
    secBar(doc, ML, y, CW, secH, 'V. RESULTAT : TVA NETTE DUE OU CREDIT DE TVA');
    y += secH;
    autoTable(doc, {
        startY: y,
        body: [
            ['TVA collectee (A)', fmtN(pdfTVAC) + ' FCFA'],
            ['TVA deductible (B)', fmtN(pdfTVAD) + ' FCFA'],
            [pdfCredit ? 'CREDIT DE TVA (B - A)' : 'TVA NETTE DUE (A - B)', fmtN(Math.abs(pdfNette)) + ' FCFA'],
        ],
        styles: { fontSize: 8.5, textColor: BLACK, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 120, fontStyle: 'bold', fillColor: [245, 245, 245] as RGB },
            1: { halign: 'right', fontStyle: 'bold' },
        },
        theme: 'plain',
        margin: { left: ML },
    });
    y = (doc as DocWithTable).lastAutoTable.finalY + 3;

    y = dgiReglement(doc, ML, CW, y, Math.max(0, pdfNette));
    dgiSignatures(doc, ML, CW, y);
    dgiFooter(doc);
    savePdf(doc, `DGI-TVA-${String(decl.mois).padStart(2, '0')}-${decl.annee}.pdf`);
}

// ── 2. Retenues �  la source ───────────────────────────────────
export function generateRetenuesForm(
    retenues: RetenueSource[],
    company?: Company,
    mois?: number,
    annee?: number,
) {
    const doc = makeDoc();
    const ML = 10;
    const CW = 190;
    const secH = 7;

    const m = mois ?? retenues[0]?.mois ?? new Date().getMonth() + 1;
    const a = annee ?? retenues[0]?.annee ?? new Date().getFullYear();

    let y = dgiHeader(doc, ML, CW, 10,
        'DECLARATION DE RETENUES A LA SOURCE',
        'SUR SOMMES VERSEES AUX PRESTATAIRES (CGI Art. 206)');

    // Section I
    secBar(doc, ML, y, CW, secH, 'I. PERIODE');
    y += secH;
    const pw = CW / 3;
    const periodeH = 9;
    box(doc, ML, y, pw, periodeH);
    box(doc, ML + pw, y, pw, periodeH);
    box(doc, ML + 2 * pw, y, pw, periodeH);
    t(doc, 'Mois', ML + 2, y + 3.5, 5.5);
    t(doc, 'Trimestre', ML + pw + 2, y + 3.5, 5.5);
    t(doc, 'Annee', ML + 2 * pw + 2, y + 3.5, 5.5);
    t(doc, MOIS_DGI[m - 1], ML + 2, y + periodeH - 1.5, 8.5, true, 'left', BLACK);
    t(doc, String(a), ML + 2 * pw + 2, y + periodeH - 1.5, 8.5, true, 'left', BLACK);
    y += periodeH;

    y = dgiIdentification(doc, ML, CW, y, company);

    // Section III : État nominatif
    y += 2;
    secBar(doc, ML, y, CW, secH, 'III. ETAT NOMINATIF DES BENEFICIAIRES');
    y += secH;

    const totBrut = retenues.reduce((s, r) => s + r.montant_brut, 0);
    const totRas = retenues.reduce((s, r) => s + r.montant_retenue, 0);
    const totNet = retenues.reduce((s, r) => s + r.montant_net, 0);

    autoTable(doc, {
        startY: y,
        head: [['Beneficiaire', 'Nature', 'Montant brut', 'Taux', 'Retenue', 'Net verse']],
        body: retenues.map(r => [
            r.beneficiaire,
            r.type_retenue,
            fmtN(r.montant_brut),
            `${r.taux_retenue} %`,
            fmtN(r.montant_retenue),
            fmtN(r.montant_net),
        ]),
        foot: [['TOTAL', '', fmtN(totBrut), '', fmtN(totRas), fmtN(totNet)]],
        styles: { fontSize: 7, textColor: BLACK, cellPadding: 2 },
        headStyles: { fillColor: [220, 220, 220] as RGB, textColor: BLACK, fontStyle: 'bold' },
        footStyles: { fillColor: [220, 220, 220] as RGB, fontStyle: 'bold', textColor: BLACK },
        columnStyles: {
            0: { cellWidth: 52 }, 1: { cellWidth: 35 },
            2: { halign: 'right', cellWidth: 30 }, 3: { halign: 'center', cellWidth: 17 },
            4: { halign: 'right', cellWidth: 29 }, 5: { halign: 'right', cellWidth: 27 },
        },
        margin: { left: ML },
    });
    y = (doc as DocWithTable).lastAutoTable.finalY + 3;

    y = dgiReglement(doc, ML, CW, y, totRas);
    dgiSignatures(doc, ML, CW, y);
    dgiFooter(doc);
    savePdf(doc, `DGI-Retenues-${String(m).padStart(2, '0')}-${a}.pdf`);
}

// ── 3. IS / MFP ───────────────────────────────────────────────
export function generateISForm(decl: ISDeclaration, company?: Company) {
    const doc = makeDoc();
    const ML = 10;
    const CW = 190;
    const secH = 7;

    let y = dgiHeader(doc, ML, CW, 10,
        "DECLARATION DES BENEFICES SOUMIS",
        "A L'IMPOT SUR LES SOCIETES (IS/MFP)");

    // Section I : Exercice
    secBar(doc, ML, y, CW, secH, 'I. EXERCICE FISCAL');
    y += secH;
    const hw = CW / 2;
    const rowH = 9;
    box(doc, ML, y, hw, rowH);
    box(doc, ML + hw, y, hw, rowH);
    t(doc, 'Annee fiscale :', ML + 2, y + 3.5, 5.5);
    t(doc, "Regime d'imposition :", ML + hw + 2, y + 3.5, 5.5);
    t(doc, String(decl.annee), ML + 2, y + rowH - 1.5, 10, true, 'left', BLACK);
    const regimeLabel =
        decl.regime === 'reel' || decl.regime === 'RNI' ? 'Reel Normal d\'Imposition (RNI)' :
            decl.regime === 'simplifie' || decl.regime === 'RSI' ? 'Reel Simplifie d\'Imposition (RSI)' :
                decl.regime;
    t(doc, regimeLabel, ML + hw + 2, y + rowH - 1.5, 8, true, 'left', BLACK);
    y += rowH;

    y = dgiIdentification(doc, ML, CW, y, company);

    // Section III : Calcul de l'IS
    y += 2;
    secBar(doc, ML, y, CW, secH, "III. RESULTAT FISCAL ET CALCUL DE L'IMPOT");
    y += secH;

    autoTable(doc, {
        startY: y,
        body: [
            ["Chiffre d'affaires HT (FCFA)", fmtN(decl.ca)],
            ['Benefice imposable (FCFA)', fmtN(decl.benefice)],
            ['IS theorique : 27,5 % du benefice (A)', fmtN(decl.is_theorique)],
            ['MFP : 0,5 % du CA (B)', fmtN(decl.mfp_du)],
            ['Adhesion CGA (reduction 50 %)', decl.adhesion_cga ? 'Oui – reduction appliquee' : 'Non'],
            ['IS DU = max(A, B) (FCFA)', fmtN(decl.is_du)],
        ],
        styles: { fontSize: 8.5, textColor: BLACK, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 120, fillColor: [245, 245, 245] as RGB },
            1: { halign: 'right', fontStyle: 'bold' },
        },
        theme: 'plain',
        margin: { left: ML },
    });
    y = (doc as DocWithTable).lastAutoTable.finalY + 3;

    y = dgiReglement(doc, ML, CW, y, decl.is_du);
    dgiSignatures(doc, ML, CW, y);
    dgiFooter(doc);
    savePdf(doc, `DGI-IS-${decl.annee}.pdf`);
}

// ── 4. IRCM ──────────────────────────────────────────────────
const TYPE_IRCM_LABEL: Record<string, string> = {
    CREANCES: 'Interets de creances, depots et cautionnements (25 %)',
    OBLIGATIONS: "Interets d'obligations et bons du tresor (6 %)",
    DIVIDENDES: 'Dividendes et revenus assimiles (12,5 %)',
};

export function generateIRCMForm(decl: IRCMDeclaration, company?: Company) {
    const doc = makeDoc();
    const ML = 10;
    const CW = 190;
    const secH = 7;

    let y = dgiHeader(doc, ML, CW, 10,
        "DECLARATION DE L'IMPOT SUR LE REVENU",
        'DES CAPITAUX MOBILIERS (IRCM) – CGI Art. 140');

    // Section I : Exercice
    secBar(doc, ML, y, CW, secH, 'I. EXERCICE FISCAL');
    y += secH;
    const rowH = 9;
    box(doc, ML, y, CW, rowH);
    t(doc, 'Annee fiscale :', ML + 2, y + 3.5, 5.5);
    t(doc, String(decl.annee), ML + 40, y + rowH - 1.5, 10, true, 'left', BLACK);
    y += rowH;

    y = dgiIdentification(doc, ML, CW, y, company);

    // Section III
    y += 2;
    secBar(doc, ML, y, CW, secH, 'III. NATURE ET MONTANT DES REVENUS MOBILIERS');
    y += secH;

    autoTable(doc, {
        startY: y,
        body: [
            ['Nature des revenus', TYPE_IRCM_LABEL[decl.type_revenu] ?? decl.type_revenu],
            ['Taux de retenue applicable', `${decl.taux} %`],
            ['Montant brut des revenus (FCFA)', fmtN(decl.montant_brut)],
            ['IRCM retenu a la source (FCFA)', fmtN(decl.ircm_total)],
            ['Montant net verse au beneficiaire (FCFA)', fmtN(decl.montant_net)],
        ],
        styles: { fontSize: 8.5, textColor: BLACK, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 110, fillColor: [245, 245, 245] as RGB },
            1: { halign: 'right', fontStyle: 'bold' },
        },
        theme: 'plain',
        margin: { left: ML },
    });
    y = (doc as DocWithTable).lastAutoTable.finalY + 3;

    y = dgiReglement(doc, ML, CW, y, decl.ircm_total);
    dgiSignatures(doc, ML, CW, y);
    dgiFooter(doc);
    savePdf(doc, `DGI-IRCM-${decl.annee}.pdf`);
}

// ── 5. CME ───────────────────────────────────────────────────
const ZONE_DESC: Record<string, string> = {
    A: 'Zone A – Ouagadougou, Bobo-Dioulasso',
    B: 'Zone B – Villes secondaires (Koudougou, Ouahigouya...)',
    C: 'Zone C – Autres centres urbains',
    D: 'Zone D – Zones rurales et periurbaines',
};

export function generateCMEForm(decl: CMEDeclaration, company?: Company) {
    const doc = makeDoc();
    const ML = 10;
    const CW = 190;
    const secH = 7;

    let y = dgiHeader(doc, ML, CW, 10,
        'DECLARATION DE LA CONTRIBUTION',
        'DES MICRO-ENTREPRISES (CME) – CGI Art. 533');

    // Section I : Période
    secBar(doc, ML, y, CW, secH, 'I. PERIODE');
    y += secH;
    const rowH = 9;
    box(doc, ML, y, CW / 2, rowH);
    box(doc, ML + CW / 2, y, CW / 2, rowH);
    t(doc, 'Annee fiscale :', ML + 2, y + 3.5, 5.5);
    t(doc, "Regime :", ML + CW / 2 + 2, y + 3.5, 5.5);
    t(doc, String(decl.annee), ML + 2, y + rowH - 1.5, 10, true, 'left', BLACK);
    t(doc, 'Contribution des Micro-Entreprises (CME)', ML + CW / 2 + 2, y + rowH - 1.5, 7, true, 'left', BLACK);
    y += rowH;

    y = dgiIdentification(doc, ML, CW, y, company);

    // Section III : Calcul
    y += 2;
    secBar(doc, ML, y, CW, secH, 'III. ASSIETTE ET CALCUL DE LA CONTRIBUTION');
    y += secH;

    autoTable(doc, {
        startY: y,
        body: [
            ["Chiffre d'affaires annuel (FCFA)", fmtN(decl.ca)],
            ['Zone geographique', ZONE_DESC[decl.zone] ?? decl.zone],
            ['Classe de contribution', `Classe ${decl.classe}`],
            ['Adhesion CGA (reduction 50 %)', decl.adhesion_cga ? 'Oui – reduction appliquee' : 'Non'],
            ['CME annuelle brute (FCFA)', fmtN(decl.cme)],
            ['CME NETTE DUE (FCFA)', fmtN(decl.cme_net)],
        ],
        styles: { fontSize: 8.5, textColor: BLACK, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 110, fillColor: [245, 245, 245] as RGB },
            1: { halign: 'right', fontStyle: 'bold' },
        },
        theme: 'plain',
        margin: { left: ML },
    });
    y = (doc as DocWithTable).lastAutoTable.finalY + 3;

    y = dgiReglement(doc, ML, CW, y, decl.cme_net);
    dgiSignatures(doc, ML, CW, y);
    dgiFooter(doc);
    savePdf(doc, `DGI-CME-${decl.annee}.pdf`);
}

// -- 6. IRF -----------------------------------------------------------
export function generateIRFForm(decl: IRFDeclaration, company?: Company) {
    const doc = makeDoc();
    const ML = 10;
    const CW = 190;
    const secH = 7;

    let y = dgiHeader(doc, ML, CW, 10,
        "DECLARATION DE L'IMPOT SUR LES",
        'REVENUS FONCIERS (IRF) - CGI Art. 121-126');

    secBar(doc, ML, y, CW, secH, 'I. EXERCICE FISCAL');
    y += secH;
    const rowH = 9;
    box(doc, ML, y, CW, rowH);
    t(doc, 'Annee fiscale :', ML + 2, y + 3.5, 5.5);
    t(doc, String(decl.annee), ML + 40, y + rowH - 1.5, 10, true, 'left', BLACK);
    y += rowH;

    y = dgiIdentification(doc, ML, CW, y, company);

    y += 2;
    secBar(doc, ML, y, CW, secH, "III. CALCUL DE L'IMPOT SUR LES REVENUS FONCIERS");
    y += secH;

    autoTable(doc, {
        startY: y,
        body: [
            ['Loyer brut annuel (FCFA)', fmtN(decl.loyer_brut)],
            ['Abattement forfaitaire 50 % (Art. 122)', fmtN(decl.abattement)],
            ['Base nette imposable (FCFA)', fmtN(decl.base_nette)],
            ['IRF tranche 18 % (base <= 100 000 FCFA)', fmtN(decl.irf1)],
            ['IRF tranche 25 % (base > 100 000 FCFA)', fmtN(decl.irf2)],
            ['IRF TOTAL DU (FCFA)', fmtN(decl.irf_total)],
            ['Loyer net apres impot (FCFA)', fmtN(decl.loyer_net)],
        ],
        styles: { fontSize: 8.5, textColor: BLACK, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 120, fillColor: [245, 245, 245] as RGB },
            1: { halign: 'right', fontStyle: 'bold' },
        },
        theme: 'plain',
        margin: { left: ML },
    });
    y = (doc as DocWithTable).lastAutoTable.finalY + 3;

    y = dgiReglement(doc, ML, CW, y, decl.irf_total);
    dgiSignatures(doc, ML, CW, y);
    dgiFooter(doc);
    savePdf(doc, `DGI-IRF-${decl.annee}.pdf`);
}

// -- 7. Patente -------------------------------------------------------
export function generatePatenteForm(decl: PatenteDeclaration, company?: Company) {
    const doc = makeDoc();
    const ML = 10;
    const CW = 190;
    const secH = 7;

    let y = dgiHeader(doc, ML, CW, 10,
        'DECLARATION DE LA PATENTE',
        'PROFESSIONNELLE - CGI Art. 237-240');

    secBar(doc, ML, y, CW, secH, 'I. EXERCICE FISCAL');
    y += secH;
    const rowH = 9;
    box(doc, ML, y, CW, rowH);
    t(doc, 'Annee fiscale :', ML + 2, y + 3.5, 5.5);
    t(doc, String(decl.annee), ML + 40, y + rowH - 1.5, 10, true, 'left', BLACK);
    y += rowH;

    y = dgiIdentification(doc, ML, CW, y, company);

    y += 2;
    secBar(doc, ML, y, CW, secH, 'III. CALCUL DE LA PATENTE PROFESSIONNELLE');
    y += secH;

    autoTable(doc, {
        startY: y,
        body: [
            ["Chiffre d'affaires annuel HT (FCFA)", fmtN(decl.ca)],
            ['Valeur locative annuelle des locaux (FCFA)', fmtN(decl.valeur_locative)],
            ['Droit fixe (tableau A - Art. 238)', fmtN(decl.droit_fixe)],
            ['Droit proportionnel (1 % valeur locative)', fmtN(decl.droit_prop)],
            ['PATENTE TOTALE DUE (FCFA)', fmtN(decl.total_patente)],
        ],
        styles: { fontSize: 8.5, textColor: BLACK, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 120, fillColor: [245, 245, 245] as RGB },
            1: { halign: 'right', fontStyle: 'bold' },
        },
        theme: 'plain',
        margin: { left: ML },
    });
    y = (doc as DocWithTable).lastAutoTable.finalY + 3;

    y = dgiReglement(doc, ML, CW, y, decl.total_patente);
    dgiSignatures(doc, ML, CW, y);
    dgiFooter(doc);
    savePdf(doc, `DGI-Patente-${decl.annee}.pdf`);
}
