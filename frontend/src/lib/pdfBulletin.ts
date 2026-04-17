/**
 * Bulletin de paie - CGI 2025 / Code du Travail Burkina Faso
 * Fond BLANC PUR - traits horizontaux uniquement entre rubriques
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Bulletin, Company } from '../types';
import { MOIS_FR } from '../types';
import { fmtN } from './fiscalCalc';

type RGB = [number, number, number];
const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [255, 255, 255];
const DARK: RGB = [50, 50, 50];
const MID: RGB = [110, 110, 110];
const TH_BG: RGB = [220, 220, 220];   // gris en-tete colonnes

const pad = (n: number) => n.toString().padStart(2, '0');
const n2 = (n: number) => n.toFixed(2).replace('.', ',');
const p3 = (n: number) => n > 0 ? n.toFixed(3).replace('.', ',') + ' %' : '';
const amt = (n: number) => n !== 0 ? fmtN(Math.round(n)) : '';
const lastDay = (m: number, y: number) => new Date(y, m, 0).getDate();

type CS = Record<string, unknown>;
interface Cell { content: string; colSpan?: number; rowSpan?: number; styles?: CS; }
type Row = (string | Cell)[];
const c = (content: string, s: CS = {}): Cell => ({ content, styles: s });
const R: CS = { halign: 'right' };

// Ligne rubrique (fond BLANC, texte gras, trait trace manuellement avant)
function secRow(label: string): Row {
    return [c(label, {
        colSpan: 6,
        fontStyle: 'bold',
        fillColor: WHITE,
        textColor: DARK,
        fontSize: 7.5,
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
    })];
}

// Ligne TOTAL (fond BLANC, texte gras)
function totRow(label: string, gain: string, ret: string): Row {
    const s: CS = { fontStyle: 'bold', fillColor: WHITE, textColor: BLACK };
    return [
        c(label, { ...s, colSpan: 4 }),
        c(gain, { ...s, halign: 'right' }),
        c(ret, { ...s, halign: 'right' }),
    ];
}

// Ligne de donnees (fond BLANC, aucune bordure)
function dataRow(
    label: string, nb: string, base: string, taux: string,
    gain: string, ret: string,
): Row {
    return [label, c(nb, R), c(base, R), c(taux, R), c(gain, R), c(ret, R)];
}

// ============================================================================
function drawPage(doc: jsPDF, b: Bulletin, company?: Company, pageInfo?: string) {
    const W = doc.internal.pageSize.getWidth();   // 210 mm
    const H = doc.internal.pageSize.getHeight();  // 297 mm
    const ML = 13;
    const MR = W - 13;
    const CW = MR - ML;   // 184 mm

    // Calculs
    const fsp = b.fsp ?? 0;
    const totalRet = b.iuts_net + b.cotisation_sociale + fsp;
    const cotTaux = b.cotisation === 'CARFO' ? '6,000 %' : '5,500 %';
    const tauxH = b.salaire_base > 0 ? b.salaire_base / 173.33 : 0;
    const baseCNSS = Math.min(b.brut_total, 600_000);
    const baseFSP = Math.max(0, b.brut_total - b.iuts_net - b.cotisation_sociale);
    const iutsEff = b.base_imposable > 0 ? (b.iuts_net / b.base_imposable * 100) : 0;
    const ld = lastDay(b.mois, b.annee);
    const dateS = `01/${pad(b.mois)}/${String(b.annee).slice(-2)}`;
    const dateE = `${ld}/${pad(b.mois)}/${String(b.annee).slice(-2)}`;

    // == EN-TETE ==============================================================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BLACK);
    doc.text(company?.nom ?? '', ML, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    const addrLines = [
        company?.adresse ?? '',
        company?.quartier ?? '',
        [company?.bp ? 'BP ' + company.bp : '', company?.ville ?? ''].filter(Boolean).join('  '),
        [
            company?.ifu ? 'IFU : ' + company.ifu : '',
            company?.rc ? 'RC : ' + company.rc : '',
        ].filter(Boolean).join('   '),
    ].filter(Boolean);
    addrLines.forEach((line, i) => doc.text(line, ML, 17 + i * 4));

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...BLACK);
    doc.text('BULLETIN DE PAIE', MR, 12, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text(`Periode du  ${dateS}  au  ${dateE}`, MR, 19.5, { align: 'right' });
    doc.text(`Paiement le  ${dateE}   par Virement`, MR, 24.5, { align: 'right' });
    if (pageInfo) doc.text(pageInfo, MR, 29, { align: 'right' });

    // Separateur
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.5);
    doc.line(ML, 33, MR, 33);

    // == BLOC SALARIE =========================================================
    const INFO: [string, string][] = [
        ['Regime social :', b.cotisation],
        ['Categorie :', b.categorie],
        ['Charges :', `${b.charges} personne(s) a charge`],
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

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text(`Categorie  ${b.categorie}`, ML, 58);
    doc.text('Coef.  --', ML + 60, 58);
    doc.text(`Horaire  ${n2(173.33)}`, ML + 90, 58);

    // Boite salarié (droite)
    const boxX = ML + CW * 0.43;
    const boxW = CW - CW * 0.43;
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.5);
    doc.rect(boxX, 34, boxW, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...BLACK);
    doc.text(b.nom_employe, boxX + 5, 44);

    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.5);
    doc.line(ML, 63, MR, 63);

    // == TABLEAU PRINCIPAL ====================================================
    const body: Row[] = [];
    const sectionSet = new Set<number>();  // indices des lignes "rubrique"
    const totalSet = new Set<number>();  // indices des lignes "total"

    const addSec = (label: string) => { sectionSet.add(body.length); body.push(secRow(label)); };
    const addTot = (label: string, g: string, r: string) => {
        totalSet.add(body.length); body.push(totRow(label, g, r));
    };

    // Remuneration
    body.push(dataRow('Salaire de base', n2(173.33), n2(tauxH), '', amt(b.salaire_base), ''));
    if (b.anciennete > 0)
        body.push(dataRow("Prime d'anciennete", '', '', '', amt(b.anciennete), ''));
    if (b.heures_sup > 0)
        body.push(dataRow('Heures supplementaires', '', '', '', amt(b.heures_sup), ''));
    if (b.logement > 0)
        body.push(dataRow('Indemnite de logement', '', '', '', amt(b.logement), ''));
    if (b.transport > 0)
        body.push(dataRow('Indemnite de transport', '', '', '', amt(b.transport), ''));
    if (b.fonction > 0)
        body.push(dataRow('Indemnite de fonction', '', '', '', amt(b.fonction), ''));
    addTot('TOTAL BRUT', amt(b.brut_total), '');

    // Cotisations salariales
    addSec('COTISATIONS ET RETENUES SALARIALES');
    body.push(dataRow(
        'IUTS - Impot Unique sur Traitements et Salaires',
        '', amt(b.base_imposable), p3(iutsEff), '', amt(b.iuts_net),
    ));
    body.push(dataRow(
        `Cotisation ${b.cotisation} (part salariale)`,
        '', amt(baseCNSS), cotTaux, '', amt(b.cotisation_sociale),
    ));
    if (fsp > 0)
        body.push(dataRow('FSP - Fonds de Soutien Patriotique', '', amt(baseFSP), '1,000 %', '', amt(fsp)));

    // Charges patronales
    addSec('CHARGES PATRONALES (a titre indicatif)');
    body.push(dataRow('TPA - Taxe Patronale et Apprentissage', '', amt(b.brut_total), '3,000 %', '', amt(b.tpa ?? 0)));
    addTot('TOTAL DES COTISATIONS ET CONTRIBUTIONS', '', amt(totalRet));

    // En-tete 2 niveaux
    const HEAD = [
        [
            c('Designation', { rowSpan: 2, halign: 'center', valign: 'middle', fillColor: TH_BG, textColor: BLACK, fontStyle: 'bold', lineColor: BLACK, lineWidth: 0.4 }),
            c('Nombre', { rowSpan: 2, halign: 'center', valign: 'middle', fillColor: TH_BG, textColor: BLACK, fontStyle: 'bold', lineColor: BLACK, lineWidth: 0.4 }),
            c('Base', { rowSpan: 2, halign: 'center', valign: 'middle', fillColor: TH_BG, textColor: BLACK, fontStyle: 'bold', lineColor: BLACK, lineWidth: 0.4 }),
            c('Taux\nsalarial', { rowSpan: 2, halign: 'center', valign: 'middle', fillColor: TH_BG, textColor: BLACK, fontStyle: 'bold', lineColor: BLACK, lineWidth: 0.4 }),
            c('Part salarie', { colSpan: 2, halign: 'center', fillColor: TH_BG, textColor: BLACK, fontStyle: 'bold', lineColor: BLACK, lineWidth: 0.4 }),
        ],
        [
            c('Gain', { halign: 'center', fillColor: TH_BG, textColor: BLACK, fontStyle: 'bold', lineColor: BLACK, lineWidth: 0.4 }),
            c('Retenue', { halign: 'center', fillColor: TH_BG, textColor: BLACK, fontStyle: 'bold', lineColor: BLACK, lineWidth: 0.4 }),
        ],
    ];

    const NCOLS = 6;
    const startY = 65;

    autoTable(doc, {
        startY,
        head: HEAD as never,
        body: body as never,
        margin: { left: ML, right: W - MR },
        tableLineColor: BLACK,
        tableLineWidth: 0.5,
        // Corps : AUCUNE bordure de ligne (fond blanc pur)
        styles: {
            fontSize: 7.5,
            cellPadding: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 },
            textColor: DARK,
            fillColor: WHITE,
            lineWidth: 0,          // ZERO trait dans le corps
            font: 'helvetica',
            overflow: 'linebreak',
        },
        headStyles: {
            fillColor: TH_BG,
            textColor: BLACK,
            fontStyle: 'bold',
            fontSize: 7,
            lineColor: BLACK,
            lineWidth: 0.4,
        },
        columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 18, halign: 'right' },
            2: { cellWidth: 26, halign: 'right' },
            3: { cellWidth: 20, halign: 'right' },
            4: { cellWidth: 20, halign: 'right' },
            5: { cellWidth: 20, halign: 'right' },
        },

        didDrawCell: (data) => {
            if (data.row.section !== 'body') return;
            const { cell, column } = data;
            const ri = data.row.index;
            const ci = column.index;

            // --- trait plein AVANT chaque rubrique ---
            if (sectionSet.has(ri) && ci === 0) {
                doc.setDrawColor(...BLACK);
                doc.setLineWidth(0.5);
                doc.line(ML, cell.y, MR, cell.y);
            }

            // --- trait plein AVANT chaque TOTAL ---
            if (totalSet.has(ri) && ci === 0) {
                doc.setDrawColor(...BLACK);
                doc.setLineWidth(0.5);
                doc.line(ML, cell.y, MR, cell.y);
            }

            // --- trait plein APRES le dernier TOTAL ---
            if (ri === body.length - 1 && ci === 0) {
                doc.setDrawColor(...BLACK);
                doc.setLineWidth(0.5);
                doc.line(ML, cell.y + cell.height, MR, cell.y + cell.height);
            }

            // --- separateurs de colonnes verticaux noirs fins ---
            if (!sectionSet.has(ri) && ci < NCOLS - 1) {
                doc.setDrawColor(...BLACK);
                doc.setLineWidth(0.15);
                doc.line(cell.x + cell.width, cell.y, cell.x + cell.width, cell.y + cell.height);
            }
        },
    });

    // == NET A PAYER ==========================================================
    const netY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.5);
    doc.line(ML, netY + 2, MR, netY + 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BLACK);
    doc.text('NET A PAYER AU SALARIE', ML, netY + 11);
    doc.setFontSize(13);
    doc.text(`${amt(b.salaire_net)} FCFA`, MR, netY + 11, { align: 'right' });

    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.5);
    doc.line(ML, netY + 14, MR, netY + 14);

    // Ligne "dont..." comme dans le modele francais
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(...MID);
    doc.text(
        `dont IUTS ${amt(b.iuts_net)} FCFA  -  ${b.cotisation} salariale ${amt(b.cotisation_sociale)} FCFA  -  FSP ${amt(fsp)} FCFA  -  TPA employeur ${amt(b.tpa ?? 0)} FCFA`,
        ML, netY + 19,
    );

    // == CUMULS (Periode) =====================================================
    const cumY = netY + 23;
    autoTable(doc, {
        startY: cumY,
        head: [['Cumuls', 'Salaire brut', 'Ch. salariales', 'Ch. patronales', 'Hres travaillees', 'Hres suppl.', 'Cout employeur']],
        body: [[
            c('Periode', { fontStyle: 'bold' }),
            c(amt(b.brut_total) + ' FCFA', R),
            c(amt(totalRet) + ' FCFA', R),
            c(amt(b.tpa ?? 0) + ' FCFA', R),
            c(n2(173.33) + ' h', R),
            c(b.heures_sup > 0 ? n2(b.heures_sup) : '0,00', R),
            c(amt(b.brut_total + (b.tpa ?? 0)) + ' FCFA', { ...R, fontStyle: 'bold' }),
        ]] as never,
        margin: { left: ML, right: W - MR },
        tableLineColor: BLACK,
        tableLineWidth: 0.4,
        styles: {
            fontSize: 7,
            cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 },
            textColor: DARK, fillColor: WHITE,
            lineColor: BLACK, lineWidth: 0.3,
        },
        headStyles: {
            fillColor: TH_BG, textColor: BLACK, fontStyle: 'bold',
            fontSize: 7, halign: 'center', lineColor: BLACK, lineWidth: 0.4,
        },
        columnStyles: {
            0: { cellWidth: 20, fontStyle: 'bold' },
            1: { cellWidth: 26, halign: 'right' },
            2: { cellWidth: 26, halign: 'right' },
            3: { cellWidth: 24, halign: 'right' },
            4: { cellWidth: 24, halign: 'right' },
            5: { cellWidth: 20, halign: 'right' },
            6: { cellWidth: 44, halign: 'right' },
        },
    });

    // == SIGNATURES ===========================================================
    const sigY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
    if (sigY + 18 < H - 14) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...DARK);
        doc.text('Date et signature du salarie (bon pour accord)', ML, sigY);
        doc.setDrawColor(...BLACK);
        doc.setLineWidth(0.4);
        doc.rect(ML, sigY + 2, 84, 15);
        doc.text("Cachet et signature de l'employeur", MR - 84, sigY);
        doc.rect(MR - 84, sigY + 2, 84, 15);
    }

    // == PIED DE PAGE =========================================================
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.4);
    doc.line(ML, H - 10, MR, H - 10);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.5);
    doc.setTextColor(...MID);
    doc.text(
        `Pour la definition des termes employes, se reporter a la reglementation en vigueur (Code du Travail BF, CGI 2025). Conserver ce bulletin sans limitation de duree. - Genere par FISCA - ${new Date().toLocaleDateString('fr-FR')}`,
        W / 2, H - 6, { align: 'center' },
    );
}

// == Exports ==================================================================
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