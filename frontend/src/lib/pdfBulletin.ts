/**
 * Génération PDF bulletin de paie — CGI 2025 Burkina Faso
 * Utilise jspdf + jspdf-autotable
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Bulletin } from '../types';
import { MOIS_FR } from '../types';
import { fmt } from './fiscalCalc';

export function exportBulletinPDF(b: Bulletin, companyName = 'FISCA-APP') {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();

    // ── En-tête ──────────────────────────────────────────────────────────────
    doc.setFillColor(36, 160, 90); // vert FISCA
    doc.rect(0, 0, W, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('BULLETIN DE PAIE', 14, 11);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${companyName} · CGI 2025 Burkina Faso`, W - 14, 11, { align: 'right' });

    // ── Identité employé ──────────────────────────────────────────────────────
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(b.nom_employe, 14, 26);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`${b.categorie} · ${b.cotisation} · Période : ${MOIS_FR[b.mois - 1]} ${b.annee}`, 14, 32);

    // ── Tableau récapitulatif ─────────────────────────────────────────────────
    const rows: [string, string, string][] = [
        ['Rémunération brute totale', '', fmt(b.brut_total)],
        ['Base imposable (après abattements)', '', fmt(b.base_imposable ?? 0)],
        ['IUTS brut (barème progressif CGI Art.107)', `−`, fmt(b.iuts_brut ?? 0)],
        ['Abattement familial', `+`, fmt((b.iuts_brut ?? 0) - b.iuts_net)],
        ['IUTS net retenu', `−`, fmt(b.iuts_net)],
        [`Cotisation ${b.cotisation} (${b.cotisation === 'CARFO' ? '6' : '5,5'} %)`, `−`, fmt(b.cotisation_sociale ?? 0)],
        ['TPA patronale (3 %)', '', fmt(b.tpa ?? 0)],
        ['FSP — Fonds de Soutien Patriotique (1 %)', `−`, fmt(b.fsp ?? 0)],
    ];

    autoTable(doc, {
        startY: 38,
        head: [['Libellé', '', 'Montant (FCFA)']],
        body: rows,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [36, 160, 90], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 120 },
            1: { cellWidth: 10, halign: 'center', textColor: [180, 30, 30] },
            2: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
        },
    });

    const finalY: number = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    // ── Net à payer ───────────────────────────────────────────────────────────
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(14, finalY, W - 28, 14, 3, 3, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 120, 60);
    doc.text('NET À PAYER', 20, finalY + 9);
    doc.text(fmt(b.salaire_net), W - 20, finalY + 9, { align: 'right' });

    // ── Coût employeur ────────────────────────────────────────────────────────
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(14, finalY + 18, W - 28, 10, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 180);
    const tpa = b.tpa ?? 0;
    doc.text(`Coût total employeur : ${fmt(b.brut_total + tpa)} (brut + TPA 3 %)`, 20, finalY + 25);

    // ── Pied de page ──────────────────────────────────────────────────────────
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.setFont('helvetica', 'italic');
    doc.text(
        'Document généré par FISCA-APP · CGI 2025 Burkina Faso · ' + new Date().toLocaleDateString('fr-BF'),
        W / 2, pageH - 8,
        { align: 'center' }
    );

    doc.save(`Bulletin-${b.nom_employe.replace(/\s+/g, '_')}-${MOIS_FR[b.mois - 1]}-${b.annee}.pdf`);
}

/**
 * Exporte tous les bulletins d'un mois en un seul PDF multi-pages
 */
export function exportAllBulletinsPDF(bulletins: Bulletin[], companyName = 'FISCA-APP') {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();

    bulletins.forEach((b, idx) => {
        if (idx > 0) doc.addPage();

        // En-tête
        doc.setFillColor(36, 160, 90);
        doc.rect(0, 0, W, 18, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('BULLETIN DE PAIE', 14, 11);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`${companyName} · ${MOIS_FR[b.mois - 1]} ${b.annee} · ${idx + 1}/${bulletins.length}`, W - 14, 11, { align: 'right' });

        doc.setTextColor(30, 30, 30);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(b.nom_employe, 14, 26);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(`${b.categorie} · ${b.cotisation}`, 14, 32);

        autoTable(doc, {
            startY: 38,
            head: [['Libellé', 'Montant (FCFA)']],
            body: [
                ['Rémunération brute', fmt(b.brut_total)],
                [`IUTS net retenu`, `− ${fmt(b.iuts_net)}`],
                [`Cotisation ${b.cotisation}`, `− ${fmt(b.cotisation_sociale ?? 0)}`],
                ['FSP (1 %)', `− ${fmt(b.fsp ?? 0)}`],
                ['NET À PAYER', fmt(b.salaire_net)],
            ],
            theme: 'striped',
            styles: { fontSize: 9 },
            headStyles: { fillColor: [36, 160, 90], textColor: 255 },
            columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        });
    });

    const periode = bulletins[0] ? `${MOIS_FR[bulletins[0].mois - 1]}-${bulletins[0].annee}` : 'bulletins';
    doc.save(`Bulletins-${periode}.pdf`);
}
