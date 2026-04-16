/**
 * Generation PDF bulletin de paie : CGI 2025 Burkina Faso
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Bulletin, Company } from '../types';
import { MOIS_FR } from '../types';
import { fmt } from './fiscalCalc';

const BLACK: [number, number, number] = [0, 0, 0];
const DARK_GRAY: [number, number, number] = [60, 60, 60];
const MID_GRAY: [number, number, number] = [120, 120, 120];
const LIGHT_GRAY: [number, number, number] = [200, 200, 200];
const BG_GRAY: [number, number, number] = [245, 245, 245];

function drawPage(doc: jsPDF, b: Bulletin, company?: Company, pageInfo?: string) {
    const W = doc.internal.pageSize.getWidth();
    const M = 15;

    // Fond blanc
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, doc.internal.pageSize.getHeight(), 'F');

    // Ligne de tete fine
    doc.setDrawColor(...LIGHT_GRAY);
    doc.setLineWidth(0.4);
    doc.line(M, 30, W - M, 30);

    // --- EMPLOYEUR (gauche) ---
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MID_GRAY);
    doc.text('EMPLOYEUR', M, 12);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLACK);
    doc.text(company?.nom ?? '', M, 18);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_GRAY);
    if (company?.adresse) doc.text(company.adresse, M, 23);
    const idLine = [company?.ifu ? 'IFU : ' + company.ifu : '', company?.rc ? 'RC : ' + company.rc : ''].filter(Boolean).join('   ');
    if (idLine) doc.text(idLine, M, 27.5);

    // --- BULLETIN DE PAIE (droite) ---
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MID_GRAY);
    doc.text('BULLETIN DE PAIE', W - M, 12, { align: 'right' });

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLACK);
    doc.text(`${MOIS_FR[b.mois - 1].toUpperCase()} ${b.annee}`, W - M, 19, { align: 'right' });

    if (pageInfo) {
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...MID_GRAY);
        doc.text(pageInfo, W - M, 24.5, { align: 'right' });
    }

    // --- SALARIE ---
    doc.setFillColor(...BG_GRAY);
    doc.rect(M, 33, W - M * 2, 18, 'F');
    doc.setDrawColor(...LIGHT_GRAY);
    doc.setLineWidth(0.25);
    doc.rect(M, 33, W - M * 2, 18);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MID_GRAY);
    doc.text('SALARIE', M + 4, 38.5);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLACK);
    doc.text(b.nom_employe, M + 4, 44.5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_GRAY);
    doc.text(`Categorie : ${b.categorie}   Regime : ${b.cotisation}`, M + 4, 49.5);

    // --- Section 1 : REMUNERATION ---
    const s1Y = 57;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLACK);
    doc.text('1. ELEMENTS DE REMUNERATION', M, s1Y);
    doc.setDrawColor(...LIGHT_GRAY);
    doc.setLineWidth(0.35);
    doc.line(M, s1Y + 2, W - M, s1Y + 2);

    autoTable(doc, {
        startY: s1Y + 5,
        head: [['Libelle', 'Base / Taux', 'Montant (FCFA)']],
        body: [
            ['Remuneration brute totale', '100 %', fmt(b.brut_total)],
            ['Base imposable IUTS', 'Apres abattements legaux', fmt(b.base_imposable ?? 0)],
        ],
        styles: { fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: BLACK, lineColor: LIGHT_GRAY, lineWidth: 0.25, font: 'helvetica' },
        headStyles: { fillColor: BG_GRAY, textColor: BLACK, fontStyle: 'bold', fontSize: 7, lineColor: LIGHT_GRAY, lineWidth: 0.25 },
        columnStyles: {
            0: { cellWidth: 90, fontStyle: 'bold' },
            1: { cellWidth: 65, textColor: DARK_GRAY as [number, number, number], fontSize: 8 },
            2: { halign: 'right', fontStyle: 'bold' },
        },
        tableLineColor: LIGHT_GRAY,
        tableLineWidth: 0.25,
    });

    // --- Section 2 : RETENUES ---
    const s2Y: number = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLACK);
    doc.text('2. RETENUES SALARIALES', M, s2Y);
    doc.setDrawColor(...LIGHT_GRAY);
    doc.setLineWidth(0.35);
    doc.line(M, s2Y + 2, W - M, s2Y + 2);

    const cotTaux = b.cotisation === 'CARFO' ? '6 %' : '5,5 %';
    autoTable(doc, {
        startY: s2Y + 5,
        head: [['Libelle', 'Base legale', 'Taux', 'Montant (FCFA)']],
        body: [
            ['IUTS net retenu', 'CGI Art. 107', '-', fmt(b.iuts_net)],
            [`Cotisation ${b.cotisation} (salariale)`, `Regime ${b.cotisation}`, cotTaux, fmt(b.cotisation_sociale ?? 0)],
            ['FSP - Fonds de Soutien Patriotique', 'Loi de finances', '1 %', fmt(b.fsp ?? 0)],
        ],
        styles: { fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: BLACK, lineColor: LIGHT_GRAY, lineWidth: 0.25, font: 'helvetica' },
        headStyles: { fillColor: BG_GRAY, textColor: BLACK, fontStyle: 'bold', fontSize: 7, lineColor: LIGHT_GRAY, lineWidth: 0.25 },
        columnStyles: {
            0: { cellWidth: 70, fontStyle: 'bold' },
            1: { cellWidth: 65, textColor: DARK_GRAY as [number, number, number], fontSize: 8 },
            2: { cellWidth: 18, halign: 'center', textColor: DARK_GRAY as [number, number, number] },
            3: { halign: 'right', fontStyle: 'bold' },
        },
        tableLineColor: LIGHT_GRAY,
        tableLineWidth: 0.25,
    });

    // --- Section 3 : CHARGES PATRONALES ---
    const s3Y: number = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK_GRAY);
    doc.text('3. CHARGES PATRONALES (a titre indicatif)', M, s3Y);
    doc.setDrawColor(...LIGHT_GRAY);
    doc.setLineWidth(0.25);
    doc.line(M, s3Y + 2, W - M, s3Y + 2);

    autoTable(doc, {
        startY: s3Y + 5,
        body: [
            ['TPA - Taxe Patronale et Apprentissage', 'CGI Art. 333', '3 %', fmt(b.tpa ?? 0)],
        ],
        styles: { fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: DARK_GRAY, lineColor: LIGHT_GRAY, lineWidth: 0.25, font: 'helvetica' },
        columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 65, fontSize: 8 },
            2: { cellWidth: 18, halign: 'center' },
            3: { halign: 'right' },
        },
        tableLineColor: LIGHT_GRAY,
        tableLineWidth: 0.25,
    });

    // --- NET A PAYER ---
    const netY: number = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.5);
    doc.line(M, netY, W - M, netY);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLACK);
    doc.text('NET A PAYER AU SALARIE', M, netY + 9);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLACK);
    doc.text(fmt(b.salaire_net), W - M, netY + 9, { align: 'right' });

    doc.setDrawColor(...LIGHT_GRAY);
    doc.setLineWidth(0.25);
    doc.line(M, netY + 13, W - M, netY + 13);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_GRAY);
    const coutEmployeur = b.brut_total + (b.tpa ?? 0);
    doc.text(`Cout total employeur : ${fmt(coutEmployeur)} FCFA  (brut ${fmt(b.brut_total)} + TPA ${fmt(b.tpa ?? 0)})`, M, netY + 20);

    // --- SIGNATURES ---
    const sigY = netY + 30;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK_GRAY);
    doc.text('Date et signature du salarie (bon pour accord)', M, sigY);
    doc.setDrawColor(...LIGHT_GRAY);
    doc.setLineWidth(0.25);
    doc.rect(M, sigY + 3, 80, 18);
    doc.text('Cachet et signature employeur', W - M - 80, sigY);
    doc.rect(W - M - 80, sigY + 3, 80, 18);

    // --- PIED DE PAGE ---
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...LIGHT_GRAY);
    doc.setLineWidth(0.3);
    doc.line(M, pageH - 12, W - M, pageH - 12);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...MID_GRAY);
    doc.text(
        `Genere par FISCA · ${new Date().toLocaleDateString('fr-FR')} · Ce document tient lieu de bulletin de paie (Art. L.85 Code du Travail BF)`,
        W / 2, pageH - 6,
        { align: 'center' }
    );
}

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
    const periode = bulletins[0] ? `${MOIS_FR[bulletins[0].mois - 1]}-${bulletins[0].annee}` : 'bulletins';
    doc.save(`Bulletins-${periode}.pdf`);
}
