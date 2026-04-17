/**
 * Bulletin de paie - CGI 2025 / Code du Travail Burkina Faso
 * Disposition conforme au modele francais standard
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Bulletin, Company } from '../types';
import { MOIS_FR } from '../types';
import { fmtN } from './fiscalCalc';

// == Couleurs ==================================================================
type RGB = [number, number, number];
const BLACK:  RGB = [0,   0,   0  ];
const WHITE:  RGB = [255, 255, 255];
const DARK:   RGB = [40,  40,  40 ];
const MID:    RGB = [110, 110, 110];
const LGRAY:  RGB = [195, 195, 195];
const TH_BG:  RGB = [225, 225, 225];   // fond entetes de colonnes
const SEC_BG: RGB = [242, 242, 242];   // fond lignes sections
const TOT_BG: RGB = [228, 228, 228];   // fond lignes total

// == Helpers ===================================================================
const pad     = (n: number) => n.toString().padStart(2, '0');
const n2      = (n: number) => n.toFixed(2).replace('.', ',');
const p3      = (n: number) => n > 0 ? n.toFixed(3).replace('.', ',') : '';
const amt     = (n: number) => n !== 0 ? fmtN(Math.round(n)) : '';
const lastDay = (m: number, y: number) => new Date(y, m, 0).getDate();

// == Types internes ============================================================
type CS = Record<string, unknown>;
interface Cell { content: string; colSpan?: number; rowSpan?: number; styles?: CS; }
type Row = (string | Cell)[];

const c = (content: string, s: CS = {}): Cell => ({ content, styles: s });
const R: CS = { halign: 'right' };

function secRow(label: string): Row {
    return [c(label, {
        colSpan: 7, fontStyle: 'bold', fillColor: SEC_BG, textColor: DARK,
        fontSize: 7, cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 },
    })];
}

function totRow(label: string, gain: string, ret: string, pat: string): Row {
    const s: CS = { fontStyle: 'bold', fillColor: TOT_BG, textColor: BLACK };
    return [
        c(label, { ...s, colSpan: 4 }),
        c(gain,  { ...s, halign: 'right' }),
        c(ret,   { ...s, halign: 'right' }),
        c(pat,   { ...s, halign: 'right' }),
    ];
}

function row(
    label: string, nb: string, base: string, taux: string,
    gain: string, ret: string, pat: string,
): Row {
    return [
        label,
        c(nb,   R), c(base, R), c(taux, R),
        c(gain, R), c(ret,  R), c(pat,  R),
    ];
}

// == Dessin d'une page =========================================================
function drawPage(doc: jsPDF, b: Bulletin, company?: Company, pageInfo?: string) {
    const W  = doc.internal.pageSize.getWidth();
    const H  = doc.internal.pageSize.getHeight();
    const ML = 13;
    const MR = W - 13;
    const CW = MR - ML;  // 184 mm

    // -- Calculs derives -------------------------------------------------------
    const fsp      = b.fsp ?? 0;
    const totalRet = b.iuts_net + b.cotisation_sociale + fsp;
    const cotTaux  = b.cotisation === 'CARFO' ? '6,000' : '5,500';
    const tauxH    = b.salaire_base > 0 ? b.salaire_base / 173.33 : 0;
    const baseCNSS = Math.min(b.brut_total, 600_000);
    const baseFSP  = Math.max(0, b.brut_total - b.iuts_net - b.cotisation_sociale);
    const iutsEff  = b.base_imposable > 0 ? (b.iuts_net / b.base_imposable * 100) : 0;
    const ld       = lastDay(b.mois, b.annee);
    const dateS    = `01/${pad(b.mois)}/${String(b.annee).slice(-2)}`;
    const dateE    = `${ld}/${pad(b.mois)}/${String(b.annee).slice(-2)}`;
    const moisFR   = (MOIS_FR[b.mois - 1] ?? '').toUpperCase();

    // -- 1. EN-TETE : Employeur (gauche) + Titre (droite) ----------------------
    // Employeur
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BLACK);
    doc.text(company?.nom ?? '', ML, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    const addrLines: string[] = [
        company?.adresse ?? '',
        company?.quartier ?? '',
        [company?.bp ? 'BP ' + company.bp : '', company?.ville ?? ''].filter(Boolean).join('  '),
        [
            company?.ifu ? 'IFU : ' + company.ifu : '',
            company?.rc  ? 'RC : '  + company.rc  : '',
        ].filter(Boolean).join('   '),
    ].filter(Boolean);
    addrLines.forEach((line, i) => doc.text(line, ML, 17 + i * 4));

    // Titre
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...BLACK);
    doc.text('BULLETIN DE PAIE', MR, 12, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text(`Periode du  ${dateS}  au  ${dateE}`, MR, 19.5, { align: 'right' });
    doc.text(`Paiement le  ${dateE}   par Virement`,  MR, 24.5, { align: 'right' });
    if (pageInfo) doc.text(pageInfo, MR, 29, { align: 'right' });

    // Ligne separatrice 1
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.5);
    doc.line(ML, 33, MR, 33);

    // -- 2. BLOC EMPLOYE (gauche : infos, droite : boite nom) ------------------
    // Infos gauche (style Conv.coll. / N Sec / Date entree / Emploi / Categorie)
    const INFO: [string, string][] = [
        ['Regime social :', b.cotisation],
        ['Categorie :',     b.categorie],
        ['Charges :',       `${b.charges} personne(s) a charge`],
    ];
    INFO.forEach(([label, val], i) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...MID);
        doc.text(label, ML, 39 + i * 6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...DARK);
        doc.text(val, ML + 28, 39 + i * 6);
    });
    // Ligne "Categorie / Coef. / Horaire" (comme dans le modele francais)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text(`Categorie  ${b.categorie}`, ML, 58);
    doc.text(`Coef.  --`, ML + 60, 58);
    doc.text(`Horaire  ${n2(173.33)}`, ML + 90, 58);

    // Boite salarié (droite, comme dans le modele francais)
    const boxX = ML + CW * 0.43;
    const boxW = CW - CW * 0.43;
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.4);
    doc.rect(boxX, 34, boxW, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...BLACK);
    doc.text(b.nom_employe, boxX + 5, 44);

    // Ligne separatrice 2
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.5);
    doc.line(ML, 63, MR, 63);

    // -- 3. TABLEAU PRINCIPAL --------------------------------------------------
    // Entete a 2 niveaux : "Part salarie" regroupe "Gain" et "Retenue"
    const HEAD: Cell[][] = [
        [
            c('Designation',      { rowSpan: 2, halign: 'center', fillColor: TH_BG, textColor: BLACK, fontStyle: 'bold' }),
            c('Nombre',           { rowSpan: 2, halign: 'center', fillColor: TH_BG, textColor: BLACK, fontStyle: 'bold' }),
            c('Base',             { rowSpan: 2, halign: 'center', fillColor: TH_BG, textColor: BLACK, fontStyle: 'bold' }),
            c('Taux\nsalarial',   { rowSpan: 2, halign: 'center', fillColor: TH_BG, textColor: BLACK, fontStyle: 'bold' }),
            c('Part salarie',     {  colSpan: 2, halign: 'center', fillColor: TH_BG, textColor: BLACK, fontStyle: 'bold' }),
            c('Part\nemployeur',  { rowSpan: 2, halign: 'center', fillColor: TH_BG, textColor: BLACK, fontStyle: 'bold' }),
        ],
        [
            c('Gain',    { halign: 'center', fillColor: TH_BG, textColor: BLACK, fontStyle: 'bold' }),
            c('Retenue', { halign: 'center', fillColor: TH_BG, textColor: BLACK, fontStyle: 'bold' }),
        ],
    ];

    const body: Row[] = [];

    // Remuneration
    body.push(row('Salaire de base', n2(173.33), n2(tauxH), '', amt(b.salaire_base), '', ''));
    if (b.anciennete > 0)
        body.push(row("Prime d'anciennete",       '', '', '', amt(b.anciennete),  '', ''));
    if (b.heures_sup > 0)
        body.push(row('Heures supplementaires',   '', '', '', amt(b.heures_sup),  '', ''));
    if (b.logement > 0)
        body.push(row('Indemnite de logement',    '', '', '', amt(b.logement),    '', ''));
    if (b.transport > 0)
        body.push(row('Indemnite de transport',   '', '', '', amt(b.transport),   '', ''));
    if (b.fonction > 0)
        body.push(row('Indemnite de fonction',    '', '', '', amt(b.fonction),    '', ''));

    body.push(totRow('TOTAL BRUT', amt(b.brut_total), '', ''));

    // Cotisations salariales
    body.push(secRow('COTISATIONS ET RETENUES SALARIALES'));
    body.push(row(
        'IUTS - Impot Unique sur Traitements et Salaires',
        '', amt(b.base_imposable), p3(iutsEff), '', amt(b.iuts_net), '',
    ));
    body.push(row(
        `Cotisation ${b.cotisation} (part salariale)`,
        '', amt(baseCNSS), cotTaux, '', amt(b.cotisation_sociale), '',
    ));
    if (fsp > 0) body.push(row(
        'FSP - Fonds de Soutien Patriotique',
        '', amt(baseFSP), '1,000', '', amt(fsp), '',
    ));

    // Charges patronales
    body.push(secRow('CHARGES PATRONALES (a titre indicatif)'));
    body.push(row('TPA - Taxe Patronale et Apprentissage', '', amt(b.brut_total), '3,000', '', '', amt(b.tpa ?? 0)));

    body.push(totRow('TOTAL DES COTISATIONS ET CONTRIBUTIONS', '', amt(totalRet), amt(b.tpa ?? 0)));

    // Colonnes : 72+16+22+16+19+19+20 = 184 = CW
    autoTable(doc, {
        startY: 65,
        head: HEAD as never,
        body: body as never,
        margin: { left: ML, right: W - MR },
        tableLineColor: LGRAY,
        tableLineWidth: 0.2,
        styles: {
            fontSize: 7.5,
            cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 },
            textColor: DARK, lineColor: LGRAY, lineWidth: 0.2, font: 'helvetica',
            overflow: 'linebreak',
        },
        headStyles: { fillColor: TH_BG, textColor: BLACK, fontStyle: 'bold', fontSize: 7 },
        columnStyles: {
            0: { cellWidth: 72 },
            1: { cellWidth: 16, halign: 'right' },
            2: { cellWidth: 22, halign: 'right' },
            3: { cellWidth: 16, halign: 'right' },
            4: { cellWidth: 19, halign: 'right' },
            5: { cellWidth: 19, halign: 'right' },
            6: { cellWidth: 20, halign: 'right' },
        },
    });

    // -- 4. NET A PAYER (hors tableau, style modele francais) ------------------
    const netY: number = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.3);
    doc.line(ML, netY + 1.5, MR, netY + 1.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BLACK);
    doc.text('NET A PAYER AU SALARIE', ML, netY + 10);
    doc.setFontSize(13);
    doc.text(`${amt(b.salaire_net)} FCFA`, MR, netY + 10, { align: 'right' });

    doc.setLineWidth(0.3);
    doc.line(ML, netY + 13.5, MR, netY + 13.5);

    // Note sous le net (comme "dont evolution de la remuneration" dans le modele)
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(...MID);
    doc.text(
        `dont base ${amt(b.salaire_base)} FCFA  -  IUTS preleve ${amt(b.iuts_net)} FCFA  -  ${b.cotisation} salariale ${amt(b.cotisation_sociale)} FCFA  -  FSP ${amt(fsp)} FCFA`,
        ML, netY + 19,
    );

    // -- 5. TABLEAU CUMULS (comme "Cumuls" du modele francais) -----------------
    const cumY = netY + 23;

    autoTable(doc, {
        startY: cumY,
        // Colonnes : 20+30+28+28+20+24+22+12 = 184 = CW
        head: [['Cumuls', 'Salaire brut', 'Ch. salariales', 'Ch. patronales', 'Av. en nature', 'Hres travaillees', 'Hres suppl.', 'Cout employeur']],
        body: [[
            c('Periode', { fontStyle: 'bold' }),
            c(amt(b.brut_total)          + ' FCFA', R),
            c(amt(totalRet)              + ' FCFA', R),
            c(amt(b.tpa ?? 0)           + ' FCFA', R),
            c('0,00',    { halign: 'center' }),
            c(n2(173.33) + ' h',                   R),
            c(b.heures_sup > 0 ? n2(b.heures_sup) : '0,00', R),
            c(amt(b.brut_total + (b.tpa ?? 0))    + ' FCFA', { ...R, fontStyle: 'bold' }),
        ]] as never,
        margin: { left: ML, right: W - MR },
        tableLineColor: LGRAY,
        tableLineWidth: 0.2,
        styles: {
            fontSize: 7.5,
            cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 },
            textColor: DARK, lineColor: LGRAY, lineWidth: 0.2,
        },
        headStyles: { fillColor: TH_BG, textColor: BLACK, fontStyle: 'bold', fontSize: 7, halign: 'center' },
        columnStyles: {
            0: { cellWidth: 20, fontStyle: 'bold' },
            1: { cellWidth: 26, halign: 'right' },
            2: { cellWidth: 26, halign: 'right' },
            3: { cellWidth: 26, halign: 'right' },
            4: { cellWidth: 18, halign: 'center' },
            5: { cellWidth: 22, halign: 'right' },
            6: { cellWidth: 20, halign: 'right' },
            7: { cellWidth: 26, halign: 'right' },
        },
    });

    // -- 6. SIGNATURES ---------------------------------------------------------
    const sigY: number = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

    if (sigY + 18 < H - 14) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...DARK);
        doc.text('Date et signature du salarie (bon pour accord)', ML, sigY);
        doc.setDrawColor(...LGRAY);
        doc.setLineWidth(0.25);
        doc.rect(ML, sigY + 2, 84, 15);
        doc.text("Cachet et signature de l'employeur", MR - 84, sigY);
        doc.rect(MR - 84, sigY + 2, 84, 15);
    }

    // -- 7. PIED DE PAGE -------------------------------------------------------
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.3);
    doc.line(ML, H - 10, MR, H - 10);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.5);
    doc.setTextColor(...MID);
    doc.text(
        `Pour la definition des termes employes, se reporter a la reglementation en vigueur (Code du Travail BF, CGI 2025). Conserver ce bulletin sans limitation de duree. - Genere par FISCA - ${new Date().toLocaleDateString('fr-FR')}`,
        W / 2, H - 6, { align: 'center' },
    );
}

// == Exports ===================================================================
export function exportBulletinPDF(b: Bulletin, company?: Company) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    drawPage(doc, b, company);
    doc.save(`Bulletin-${b.nom_employe.replace(/\s+/g, '_')}-${MOIS_FR[b.mois - 1]}-${b.annee}.pdf`);
}

export function exportAllBulletinsPDF(bulletins: Bulletin[], company?: Company) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    bulletins.forEach((b, idx) => {
        if (idx > 0) doc.addPage();
        drawPage(doc, b, company, `${idx + 1} / ${bulletins.length}`);
    });
    const p = bulletins[0];
    const name = p ? `${MOIS_FR[p.mois - 1]}-${p.annee}` : 'bulletins';
    doc.save(`Bulletins-${name}.pdf`);
}