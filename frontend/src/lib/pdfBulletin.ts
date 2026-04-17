/**
 * Bulletin de paie – CGI 2025 / Code du Travail Burkina Faso
 * Structure inspirée du modèle français, données 100 % FISCA
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Bulletin, Company } from '../types';
import { MOIS_FR } from '../types';
import { fmtN } from './fiscalCalc';

// ── couleurs ─────────────────────────────────────────────────────────────────
type RGB = [number, number, number];
const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [255, 255, 255];
const NEAR_BLK: RGB = [30, 30, 30];
const DARK_GRY: RGB = [60, 60, 60];
const MID_GRY: RGB = [120, 120, 120];
const LGT_GRY: RGB = [210, 210, 210];
const SEC_HEAD: RGB = [232, 232, 232];   // fond entête de section
const SEC_PAT: RGB = [245, 245, 245];   // fond charges patronales
const NET_BG: RGB = [22, 50, 90];      // fond "Net à payer" (bleu marine)
const TOTAL_BG: RGB = [248, 248, 248];   // fond lignes TOTAL

// ── helpers ───────────────────────────────────────────────────────────────────
const pad = (n: number) => n.toString().padStart(2, '0');
const n2 = (n: number) => n.toFixed(2).replace('.', ',');
const n1pct = (n: number) => n.toFixed(1).replace('.', ',') + ' %';
const fcfa = (n: number) => fmtN(Math.round(n));
const lastDay = (m: number, y: number) => new Date(y, m, 0).getDate();

// ── types internes ────────────────────────────────────────────────────────────
type CS = Record<string, unknown>;
interface CellObj { content: string; colSpan?: number; rowSpan?: number; styles?: CS; }
type Row = (string | CellObj)[];

function secRow(label: string, bg: RGB = SEC_HEAD): Row {
    return [{
        content: label, colSpan: 7, styles: {
            fontStyle: 'bold', fillColor: bg, textColor: DARK_GRY,
            fontSize: 7.5, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        }
    }];
}

function dataRow(
    label: string, nb: string, base: string, taux: string,
    gain: string, ret: string, pat: string, bold = false,
): Row {
    const s: CS = bold ? { fontStyle: 'bold' } : {};
    return [
        { content: label, styles: { ...s } },
        { content: nb, styles: { ...s, halign: 'right' } },
        { content: base, styles: { ...s, halign: 'right' } },
        { content: taux, styles: { ...s, halign: 'center' } },
        { content: gain, styles: { ...s, halign: 'right' } },
        { content: ret, styles: { ...s, halign: 'right' } },
        { content: pat, styles: { ...s, halign: 'right' } },
    ];
}

function totalRow(label: string, gain = '', ret = '', pat = ''): Row {
    return [
        { content: label, colSpan: 4, styles: { fontStyle: 'bold', fillColor: TOTAL_BG, textColor: BLACK, fontSize: 8.5 } },
        { content: gain, styles: { fontStyle: 'bold', halign: 'right', fillColor: TOTAL_BG } },
        { content: ret, styles: { fontStyle: 'bold', halign: 'right', fillColor: TOTAL_BG } },
        { content: pat, styles: { fontStyle: 'bold', halign: 'right', fillColor: TOTAL_BG } },
    ];
}

// ── génération d'une page ─────────────────────────────────────────────────────
function drawPage(doc: jsPDF, b: Bulletin, company?: Company, pageInfo?: string) {
    const W = doc.internal.pageSize.getWidth();   // 210 mm
    const H = doc.internal.pageSize.getHeight();  // 297 mm
    const ML = 14;
    const MR = W - 14;
    const CW = MR - ML;

    // ── calculs dérivés ───────────────────────────────────────────────────────
    const fsp = b.fsp ?? 0;
    const totalRet = b.iuts_net + b.cotisation_sociale + fsp;
    const coutEmpl = b.brut_total + (b.tpa ?? 0);
    const cotTaux = b.cotisation === 'CARFO' ? '6 %' : '5,5 %';
    const tauxH = b.salaire_base > 0 ? b.salaire_base / 173.33 : 0;
    const iutsEff = b.base_imposable > 0 ? n1pct(b.iuts_net / b.base_imposable * 100) : '-';
    const ld = lastDay(b.mois, b.annee);
    const pStart = `01/${pad(b.mois)}/${b.annee}`;
    const pEnd = `${ld}/${pad(b.mois)}/${b.annee}`;
    const moisLabel = MOIS_FR[b.mois - 1]?.toUpperCase() ?? '';
    const baseCNSS = Math.min(b.brut_total, 600_000);
    const baseFSP = b.brut_total - b.iuts_net - b.cotisation_sociale;  // net avant FSP

    // ── cadre externe ─────────────────────────────────────────────────────────
    doc.setDrawColor(...LGT_GRY);
    doc.setLineWidth(0.4);
    doc.rect(ML - 2, 4, CW + 4, H - 8);

    // ── EN-TÊTE : employeur (gauche) + titre (droite) ─────────────────────────
    let y = 10;

    // Employeur
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MID_GRY);
    doc.text('EMPLOYEUR', ML, y);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLACK);
    doc.text(company?.nom ?? '—', ML, y + 6.5);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_GRY);
    if (company?.adresse) doc.text(company.adresse, ML, y + 12);
    const ville = [company?.quartier, company?.ville].filter(Boolean).join(', ');
    if (ville) doc.text(ville, ML, y + 16);
    const idLine = [
        company?.ifu ? 'IFU : ' + company.ifu : '',
        company?.rc ? 'RC : ' + company.rc : '',
    ].filter(Boolean).join('     ');
    if (idLine) doc.text(idLine, ML, y + 20.5);

    // Titre + période
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...NEAR_BLK);
    doc.text('BULLETIN DE PAIE', MR, y + 5, { align: 'right' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_GRY);
    doc.text(`Période du  ${pStart}  au  ${pEnd}`, MR, y + 11.5, { align: 'right' });
    doc.text(`Paiement le  ${pEnd}   par Virement`, MR, y + 16, { align: 'right' });
    if (pageInfo) {
        doc.setFontSize(6.5);
        doc.text(pageInfo, MR, y + 20.5, { align: 'right' });
    }

    // Ligne séparatrice en-tête
    y = 34;
    doc.setDrawColor(...LGT_GRY);
    doc.setLineWidth(0.5);
    doc.line(ML, y, MR, y);

    // ── BLOC SALARIÉ ──────────────────────────────────────────────────────────
    y += 1.5;
    doc.setFillColor(247, 247, 247);
    doc.rect(ML, y, CW, 22, 'F');
    doc.setDrawColor(...LGT_GRY);
    doc.setLineWidth(0.25);
    doc.rect(ML, y, CW, 22);

    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MID_GRY);
    doc.text('SALARIÉ', ML + 3, y + 4.5);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLACK);
    doc.text(b.nom_employe, ML + 3, y + 11);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_GRY);
    doc.text(
        `Catégorie : ${b.categorie}     Régime social : ${b.cotisation}     Charges fiscales : ${b.charges}`,
        ML + 3, y + 16.5,
    );
    doc.text(
        `Salaire de base mensuel : ${fcfa(b.salaire_base)} FCFA     Horaire mensuel : 173,33 h`,
        ML + 3, y + 20.5,
    );

    // ── TABLEAU PRINCIPAL ─────────────────────────────────────────────────────
    y += 25;

    const HEAD: string[][] = [[
        'Désignation', 'Nbr (h)', 'Base', 'Taux',
        'Gain (FCFA)', 'Retenue (FCFA)', 'Part patron (FCFA)',
    ]];

    const body: Row[] = [];

    // ─ Éléments de rémunération ─
    body.push(secRow('ÉLÉMENTS DE RÉMUNÉRATION'));
    body.push(dataRow('Salaire de base', '173,33', n2(tauxH) + '/h', '', fcfa(b.salaire_base), '', ''));
    if (b.anciennete > 0)
        body.push(dataRow("Prime d'ancienneté", '', '', '', fcfa(b.anciennete), '', ''));
    if (b.heures_sup > 0)
        body.push(dataRow('Heures supplémentaires', '', '', '', fcfa(b.heures_sup), '', ''));
    if (b.logement > 0)
        body.push(dataRow('Indemnité de logement', '', '', '', fcfa(b.logement), '', ''));
    if (b.transport > 0)
        body.push(dataRow('Indemnité de transport', '', '', '', fcfa(b.transport), '', ''));
    if (b.fonction > 0)
        body.push(dataRow('Indemnité de fonction', '', '', '', fcfa(b.fonction), '', ''));
    body.push(totalRow('TOTAL BRUT', fcfa(b.brut_total), '', ''));

    // ─ Cotisations salariales ─
    body.push(secRow('COTISATIONS ET RETENUES SALARIALES'));
    body.push(dataRow(
        'IUTS – Impôt Unique sur Traitements et Salaires',
        '', fcfa(b.base_imposable), iutsEff, '', fcfa(b.iuts_net), '',
    ));
    body.push(dataRow(
        `Cotisation ${b.cotisation} (part salariale)`,
        '', fcfa(baseCNSS), cotTaux, '', fcfa(b.cotisation_sociale), '',
    ));
    if (fsp > 0)
        body.push(dataRow('FSP – Fonds de Soutien Patriotique', '', fcfa(Math.max(0, baseFSP)), '1 %', '', fcfa(fsp), ''));
    body.push(totalRow('TOTAL RETENUES SALARIALES', '', fcfa(totalRet), ''));

    // ─ Charges patronales ─
    body.push(secRow('CHARGES PATRONALES (à titre informatif)', SEC_PAT));
    body.push(dataRow('TPA – Taxe Patronale et Apprentissage', '', fcfa(b.brut_total), '3 %', '', '', fcfa(b.tpa ?? 0)));

    // ─ Net à payer ─
    body.push([
        {
            content: `NET À PAYER AU SALARIÉ  ·  ${moisLabel} ${b.annee}`,
            colSpan: 5,
            styles: {
                fontStyle: 'bold', fillColor: NET_BG, textColor: WHITE,
                fontSize: 9.5, cellPadding: { top: 4.5, bottom: 4.5, left: 4, right: 4 },
            },
        },
        {
            content: fcfa(b.salaire_net) + ' FCFA',
            colSpan: 2,
            styles: {
                fontStyle: 'bold', fillColor: NET_BG, textColor: WHITE,
                fontSize: 11, halign: 'right',
                cellPadding: { top: 4.5, bottom: 4.5, left: 4, right: 4 },
            },
        },
    ] as Row);

    autoTable(doc, {
        startY: y,
        head: HEAD,
        body: body as never,
        margin: { left: ML, right: 14 },
        tableLineColor: LGT_GRY,
        tableLineWidth: 0.25,
        styles: {
            fontSize: 8,
            cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
            textColor: BLACK, lineColor: LGT_GRY, lineWidth: 0.25, font: 'helvetica',
        },
        headStyles: {
            fillColor: NEAR_BLK, textColor: WHITE, fontStyle: 'bold',
            fontSize: 7, halign: 'center',
            cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
        },
        columnStyles: {
            0: { cellWidth: 64 },
            1: { cellWidth: 15, halign: 'right' },
            2: { cellWidth: 24, halign: 'right' },
            3: { cellWidth: 14, halign: 'center' },
            4: { cellWidth: 22, halign: 'right' },
            5: { cellWidth: 22, halign: 'right' },
            6: { cellWidth: 22, halign: 'right' },
        },
    });

    // ── RÉCAPITULATIF ─────────────────────────────────────────────────────────
    const recY: number = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MID_GRY);
    doc.text('RÉCAPITULATIF DE LA PÉRIODE', ML, recY);

    autoTable(doc, {
        startY: recY + 3,
        head: [['Salaire brut', 'Retenues salariales', 'Charges patronales (TPA)', 'Coût total employeur']],
        body: [[
            fcfa(b.brut_total) + ' FCFA',
            fcfa(totalRet) + ' FCFA',
            fcfa(b.tpa ?? 0) + ' FCFA',
            fcfa(coutEmpl) + ' FCFA',
        ]],
        margin: { left: ML, right: 14 },
        tableLineColor: LGT_GRY,
        tableLineWidth: 0.25,
        styles: {
            fontSize: 8.5,
            cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
            textColor: BLACK, halign: 'center',
        },
        headStyles: { fillColor: [238, 238, 238], textColor: DARK_GRY, fontStyle: 'bold', fontSize: 7.5 },
        columnStyles: { 3: { fontStyle: 'bold' } },
    });

    // ── SIGNATURES ────────────────────────────────────────────────────────────
    const sigY: number = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK_GRY);
    doc.text('Date et signature du salarié (bon pour accord)', ML, sigY);
    doc.setDrawColor(...LGT_GRY);
    doc.setLineWidth(0.25);
    doc.rect(ML, sigY + 2, 84, 18);

    doc.text("Cachet et signature de l'employeur", MR - 84, sigY);
    doc.rect(MR - 84, sigY + 2, 84, 18);

    // ── PIED DE PAGE ─────────────────────────────────────────────────────────
    doc.setDrawColor(...LGT_GRY);
    doc.setLineWidth(0.3);
    doc.line(ML, H - 9, MR, H - 9);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...MID_GRY);
    doc.text(
        `Généré par FISCA · ${new Date().toLocaleDateString('fr-FR')} · Ce document tient lieu de bulletin de paie (Art. L.85 Code du Travail BF)`,
        W / 2, H - 5, { align: 'center' },
    );
}

// ── exports ───────────────────────────────────────────────────────────────────
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
