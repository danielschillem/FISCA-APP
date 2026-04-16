/**
 * Generation PDF bulletin de paie : CGI 2025 Burkina Faso
 * Design professionnel sobre - typographie claire, sections structurees
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Bulletin } from '../types';
import { MOIS_FR } from '../types';
import { fmt } from './fiscalCalc';

const DARK: [number, number, number] = [25, 25, 25];
const GRAY: [number, number, number] = [100, 100, 100];
const LGRAY: [number, number, number] = [210, 210, 210];
const XLGRAY: [number, number, number] = [245, 245, 245];
const ACCENT: [number, number, number] = [22, 101, 52];

function drawPage(doc: jsPDF, b: Bulletin, companyName: string, pageInfo?: string) {
    const W = doc.internal.pageSize.getWidth();
    const MARGIN = 15;

    doc.setFillColor(...ACCENT);
    doc.rect(0, 0, 3.5, 297, 'F');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY);
    doc.text('EMPLOYEUR', MARGIN, 14);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(companyName, MARGIN, 20);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text('Burkina Faso · CGI 2025', MARGIN, 26);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY);
    doc.text('BULLETIN DE PAIE', W - MARGIN, 14, { align: 'right' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(`${MOIS_FR[b.mois - 1].toUpperCase()} ${b.annee}`, W - MARGIN, 22, { align: 'right' });
    if (pageInfo) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRAY);
        doc.text(pageInfo, W - MARGIN, 28, { align: 'right' });
    }

    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, 32, W - MARGIN, 32);

    doc.setFillColor(...XLGRAY);
    doc.roundedRect(MARGIN, 35, W - MARGIN * 2, 18, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY);
    doc.text('SALARIE', MARGIN + 4, 41);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(b.nom_employe, MARGIN + 4, 47);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(`Categorie : ${b.categorie} · Regime : ${b.cotisation}`, MARGIN + 4, 52);

    const s1Y = 60;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ACCENT);
    doc.text('1. ELEMENTS DE REMUNERATION', MARGIN, s1Y);
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, s1Y + 2, W - MARGIN, s1Y + 2);

    autoTable(doc, {
        startY: s1Y + 5,
        head: [['Libelle', 'Base / Taux', 'Montant (FCFA)']],
        body: [
            ['Remuneration brute totale', '100 %', fmt(b.brut_total)],
            ['Base imposable IUTS', 'Apres abattements legaux', fmt(b.base_imposable ?? 0)],
        ],
        styles: { fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: DARK, lineColor: LGRAY, lineWidth: 0.25 },
        headStyles: { fillColor: XLGRAY, textColor: GRAY, fontStyle: 'bold', fontSize: 7, lineColor: LGRAY, lineWidth: 0.25 },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: {
            0: { cellWidth: 90, fontStyle: 'bold' },
            1: { cellWidth: 65, textColor: GRAY, fontSize: 8 },
            2: { halign: 'right', fontStyle: 'bold' },
        },
        tableLineColor: LGRAY,
        tableLineWidth: 0.25,
    });

    const s2Y: number = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ACCENT);
    doc.text('2. RETENUES SALARIALES', MARGIN, s2Y);
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, s2Y + 2, W - MARGIN, s2Y + 2);

    const cotTaux = b.cotisation === 'CARFO' ? '6 %' : '5,5 %';
    autoTable(doc, {
        startY: s2Y + 5,
        head: [['Libelle', 'Base legale', 'Taux', 'Montant (FCFA)']],
        body: [
            ['IUTS net retenu', 'CGI Art. 107', '-', fmt(b.iuts_net)],
            [`Cotisation ${b.cotisation} (salariale)`, `Regime ${b.cotisation}`, cotTaux, fmt(b.cotisation_sociale ?? 0)],
            ['FSP - Fonds de Soutien Patriotique', 'Loi de finances', '1 %', fmt(b.fsp ?? 0)],
        ],
        styles: { fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: DARK, lineColor: LGRAY, lineWidth: 0.25 },
        headStyles: { fillColor: XLGRAY, textColor: GRAY, fontStyle: 'bold', fontSize: 7, lineColor: LGRAY, lineWidth: 0.25 },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: {
            0: { cellWidth: 70, fontStyle: 'bold' },
            1: { cellWidth: 65, textColor: GRAY, fontSize: 8 },
            2: { cellWidth: 18, halign: 'center', textColor: GRAY },
            3: { halign: 'right', fontStyle: 'bold' },
        },
        tableLineColor: LGRAY,
        tableLineWidth: 0.25,
    });

    const s3Y: number = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY);
    doc.text('3. CHARGES PATRONALES (a titre indicatif)', MARGIN, s3Y);
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, s3Y + 2, W - MARGIN, s3Y + 2);

    autoTable(doc, {
        startY: s3Y + 5,
        body: [
            ['TPA - Taxe Patronale et Apprentissage', 'CGI Art. 333', '3 %', fmt(b.tpa ?? 0)],
        ],
        styles: { fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: GRAY, lineColor: LGRAY, lineWidth: 0.25 },
        columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 65, fontSize: 8 },
            2: { cellWidth: 18, halign: 'center' },
            3: { halign: 'right' },
        },
        tableLineColor: LGRAY,
        tableLineWidth: 0.25,
    });

    const netY: number = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, netY, W - MARGIN, netY);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text('NET A PAYER AU SALARIE', MARGIN, netY + 9);
    doc.setFontSize(14);
    doc.setTextColor(...ACCENT);
    doc.text(fmt(b.salaire_net) + ' FCFA', W - MARGIN, netY + 9, { align: 'right' });
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, netY + 13, W - MARGIN, netY + 13);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    const coutEmployeur = b.brut_total + (b.tpa ?? 0);
    doc.text(`Cout total employeur : ${fmt(coutEmployeur)} FCFA  (brut ${fmt(b.brut_total)} + TPA ${fmt(b.tpa ?? 0)})`, MARGIN, netY + 20);

    const sigY = netY + 30;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY);
    doc.text('Date et signature du salarie (bon pour accord)', MARGIN, sigY);
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.25);
    doc.rect(MARGIN, sigY + 3, 80, 18);
    doc.text('Cachet et signature employeur', W - MARGIN - 80, sigY);
    doc.rect(W - MARGIN - 80, sigY + 3, 80, 18);

    const pageH = doc.internal.pageSize.getHeight();
    doc.setFillColor(...XLGRAY);
    doc.rect(0, pageH - 12, W, 12, 'F');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...GRAY);
    doc.text(
        `Document genere par FISCA · ${new Date().toLocaleDateString('fr-FR')} · Ce document tient lieu de bulletin de paie (Art. L.85 Code du Travail BF)`,
        W / 2, pageH - 5,
        { align: 'center' }
    );
}

export function exportBulletinPDF(b: Bulletin, companyName = 'FISCA-APP') {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    drawPage(doc, b, companyName);
    doc.save(`Bulletin-${b.nom_employe.replace(/\s+/g, '_')}-${MOIS_FR[b.mois - 1]}-${b.annee}.pdf`);
}

export function exportAllBulletinsPDF(bulletins: Bulletin[], companyName = 'FISCA-APP') {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    bulletins.forEach((b, idx) => {
        if (idx > 0) doc.addPage();
        drawPage(doc, b, companyName, `${idx + 1} / ${bulletins.length}`);
    });
    const periode = bulletins[0] ? `${MOIS_FR[bulletins[0].mois - 1]}-${bulletins[0].annee}` : 'bulletins';
    doc.save(`Bulletins-${periode}.pdf`);
}
