/**
 * Export Récapitulatif fiscal & Bilan annuel
 * Formats : PDF (jsPDF), XLSX (xlsx), DOCX (docx)
 * CGI 2025 - Burkina Faso
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
    Document, Packer, Paragraph, Table, TableRow, TableCell,
    TextRun, AlignmentType, WidthType, BorderStyle, ShadingType,
    HeadingLevel, PageOrientation, Header, Footer,
} from 'docx';
import type { BilanData, Company } from '../types';
import { fmt, fmtN } from './fiscalCalc';

// ─── Libellés ────────────────────────────────────────────────────────────────
const LIGNES: { label: string; key: keyof Omit<BilanData, 'annee' | 'total'> }[] = [
    { label: 'IUTS – Impôt Unique sur les Traitements et Salaires', key: 'iuts' },
    { label: 'TPA – Taxe Patronale et d\'Apprentissage', key: 'tpa' },
    { label: 'CSS – Cotisations Salariales (CNSS/CARFO)', key: 'css' },
    { label: 'CNSS Patronal', key: 'cnss_patronal' },
    { label: 'TVA – Taxe sur la Valeur Ajoutée (nette)', key: 'tva' },
    { label: 'RAS – Retenues à la Source', key: 'ras' },
    { label: 'IRF – Impôt sur les Revenus Fonciers', key: 'irf' },
    { label: 'IRCM – Impôt sur les Revenus des Capitaux Mobiliers', key: 'ircm' },
    { label: 'IS – Impôt sur les Sociétés', key: 'is' },
    { label: 'CME – Contribution des Micro-Entreprises', key: 'cme' },
    { label: 'Patente Professionnelle', key: 'patente' },
];

const pct = (v: number, total: number): string =>
    total > 0 ? ((v / total) * 100).toFixed(1) + ' %' : '—';

// ─── PDF ─────────────────────────────────────────────────────────────────────
export function exportBilanPDF(b: BilanData, company?: Company) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const M = 15;
    const BLACK: [number, number, number] = [0, 0, 0];
    const DGRAY: [number, number, number] = [60, 60, 60];
    const MGRAY: [number, number, number] = [120, 120, 120];
    const LGRAY: [number, number, number] = [200, 200, 200];
    const BGGRAY: [number, number, number] = [245, 245, 245];

    // ── En-tête ──
    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...MGRAY);
    doc.text('ENTREPRISE', M, 12);
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(...BLACK);
    doc.text(company?.nom ?? '', M, 19);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...DGRAY);
    if (company?.adresse) doc.text(company.adresse, M, 24);
    const idLine = [
        company?.ifu ? 'IFU : ' + company.ifu : '',
        company?.rc ? 'RC : ' + company.rc : '',
    ].filter(Boolean).join('   ');
    if (idLine) doc.text(idLine, M, 28.5);

    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...MGRAY);
    doc.text('RÉCAPITULATIF FISCAL', W - M, 12, { align: 'right' });
    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(...BLACK);
    doc.text(`EXERCICE ${b.annee}`, W - M, 20, { align: 'right' });
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MGRAY);
    doc.text('Bilan annuel des obligations fiscales – CGI 2025 Burkina Faso', W - M, 25.5, { align: 'right' });

    doc.setDrawColor(...LGRAY); doc.setLineWidth(0.4);
    doc.line(M, 32, W - M, 32);

    // ── KPI 4 cases ──
    const kpiW = (W - M * 2) / 4;
    const kpiY = 35;
    const kpiH = 18;
    const kpis = [
        { label: 'IUTS versé', value: fmt(b.iuts) },
        { label: 'TVA collectée', value: fmt(b.tva) },
        { label: 'Retenues source', value: fmt(b.ras) },
        { label: 'Total obligations', value: fmt(b.total) },
    ];
    kpis.forEach((k, i) => {
        doc.setFillColor(...BGGRAY);
        doc.rect(M + i * kpiW, kpiY, kpiW - 2, kpiH, 'F');
        doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MGRAY);
        doc.text(k.label, M + i * kpiW + 3, kpiY + 5.5);
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...BLACK);
        doc.text(k.value, M + i * kpiW + 3, kpiY + 13);
    });

    // ── Tableau détail ──
    const rows = LIGNES.map(({ label, key }) => {
        const v = b[key] ?? 0;
        return [label, fmtN(v) + ' FCFA', pct(v, b.total)];
    });
    rows.push(['TOTAL OBLIGATIONS FISCALES', fmtN(b.total) + ' FCFA', '100 %']);

    autoTable(doc, {
        startY: kpiY + kpiH + 8,
        head: [['Module fiscal', 'Montant (FCFA)', '% du total']],
        body: rows.slice(0, -1),
        foot: [rows[rows.length - 1]],
        styles: {
            fontSize: 8.5, cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
            textColor: BLACK, lineColor: LGRAY, lineWidth: 0.25, font: 'helvetica',
        },
        headStyles: {
            fillColor: BGGRAY, textColor: BLACK, fontStyle: 'bold', fontSize: 7.5,
            lineColor: LGRAY, lineWidth: 0.25,
        },
        footStyles: {
            fillColor: [230, 230, 230] as [number, number, number],
            textColor: BLACK, fontStyle: 'bold', fontSize: 9,
        },
        columnStyles: {
            0: { cellWidth: 115 },
            1: { halign: 'right', fontStyle: 'bold', cellWidth: 45 },
            2: { halign: 'right', cellWidth: 25, textColor: MGRAY },
        },
        tableLineColor: LGRAY, tableLineWidth: 0.25,
        didParseCell: (data) => {
            // Griser les lignes à 0
            if (data.section === 'body') {
                const val = LIGNES[data.row.index]?.key;
                if (val && (b[val] ?? 0) === 0) {
                    data.cell.styles.textColor = [180, 180, 180];
                }
            }
        },
    });

    // ── Pied de page ──
    const pH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...LGRAY); doc.setLineWidth(0.3);
    doc.line(M, pH - 12, W - M, pH - 12);
    doc.setFontSize(6.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(...MGRAY);
    doc.text(
        `Généré par FISCA · ${new Date().toLocaleDateString('fr-FR')} · Document de synthèse fiscale – CGI 2025 Burkina Faso`,
        W / 2, pH - 6, { align: 'center' },
    );

    doc.save(`Bilan-Fiscal-${b.annee}-${(company?.nom ?? 'entreprise').replace(/\s+/g, '_')}.pdf`);
}

// ─── XLSX ────────────────────────────────────────────────────────────────────
export function exportBilanXLSX(b: BilanData, company?: Company) {
    const wb = XLSX.utils.book_new();

    // Feuille 1 : Récapitulatif
    const recapRows: (string | number)[][] = [
        [`RÉCAPITULATIF FISCAL - EXERCICE ${b.annee}`],
        [],
        company?.nom ? ['Entreprise :', company.nom] : [],
        company?.ifu ? ['IFU :', company.ifu] : [],
        company?.rc ? ['RC :', company.rc] : [],
        company?.adresse ? ['Adresse :', company.adresse] : [],
        [],
        ['Module fiscal', 'Montant (FCFA)', '% du total'],
        ...LIGNES.map(({ label, key }) => {
            const v = b[key] ?? 0;
            return [label, v, b.total > 0 ? +((v / b.total) * 100).toFixed(2) : 0];
        }),
        [],
        ['TOTAL OBLIGATIONS FISCALES', b.total, 100],
    ].filter(r => r.length > 0);

    const wsRecap = XLSX.utils.aoa_to_sheet(recapRows);

    // Largeurs colonnes
    wsRecap['!cols'] = [{ wch: 55 }, { wch: 20 }, { wch: 12 }];

    // Style titre (row 0)
    if (wsRecap['A1']) wsRecap['A1'].s = { font: { bold: true, sz: 14 } };

    // Format nombre pour col B
    for (let i = 8; i <= 8 + LIGNES.length; i++) {
        const cell = wsRecap[`B${i}`];
        if (cell) cell.z = '#,##0';
        const pctCell = wsRecap[`C${i}`];
        if (pctCell) pctCell.z = '0.00"%"';
    }

    XLSX.utils.book_append_sheet(wb, wsRecap, 'Récapitulatif');

    // Feuille 2 : Données brutes (pour pivot/graphique)
    const rawData = LIGNES.map(({ label, key }) => ({
        'Module': label,
        'Montant FCFA': b[key] ?? 0,
        'Part (%)': b.total > 0 ? +(((b[key] ?? 0) / b.total) * 100).toFixed(2) : 0,
        'Exercice': b.annee,
        'Entreprise': company?.nom ?? '',
        'IFU': company?.ifu ?? '',
    }));
    rawData.push({
        'Module': 'TOTAL',
        'Montant FCFA': b.total,
        'Part (%)': 100,
        'Exercice': b.annee,
        'Entreprise': company?.nom ?? '',
        'IFU': company?.ifu ?? '',
    });

    const wsData = XLSX.utils.json_to_sheet(rawData);
    wsData['!cols'] = [{ wch: 55 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsData, 'Données');

    XLSX.writeFile(wb, `Bilan-Fiscal-${b.annee}-${(company?.nom ?? 'entreprise').replace(/\s+/g, '_')}.xlsx`);
}

// ─── DOCX ────────────────────────────────────────────────────────────────────
const border = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
};

const cell = (text: string, opts: {
    bold?: boolean; shade?: boolean; right?: boolean; gray?: boolean; sz?: number;
} = {}) =>
    new TableCell({
        shading: opts.shade ? { type: ShadingType.SOLID, color: 'EBEBEB' } : undefined,
        borders: border,
        children: [new Paragraph({
            alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
            children: [new TextRun({
                text,
                bold: opts.bold ?? false,
                color: opts.gray ? '888888' : '000000',
                size: (opts.sz ?? 9) * 2,
                font: 'Arial',
            })],
        })],
    });

export async function exportBilanDOCX(b: BilanData, company?: Company) {
    const headRow = new TableRow({
        tableHeader: true,
        children: [
            cell('Module fiscal', { bold: true, shade: true, sz: 9 }),
            cell('Montant (FCFA)', { bold: true, shade: true, right: true, sz: 9 }),
            cell('% du total', { bold: true, shade: true, right: true, sz: 9 }),
        ],
    });

    const dataRows = LIGNES.map(({ label, key }) => {
        const v = b[key] ?? 0;
        const isZero = v === 0;
        return new TableRow({
            children: [
                cell(label, { gray: isZero }),
                cell(fmtN(v) + ' FCFA', { right: true, gray: isZero }),
                cell(pct(v, b.total), { right: true, gray: isZero }),
            ],
        });
    });

    const totalRow = new TableRow({
        children: [
            cell('TOTAL OBLIGATIONS FISCALES', { bold: true, shade: true }),
            cell(fmtN(b.total) + ' FCFA', { bold: true, shade: true, right: true }),
            cell('100 %', { bold: true, shade: true, right: true }),
        ],
    });

    const table = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headRow, ...dataRows, totalRow],
        columnWidths: [6000, 2400, 1200],
    });

    // Infos employeur
    const infoLines: Paragraph[] = [
        new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: `Récapitulatif Fiscal – Exercice ${b.annee}`, bold: true, font: 'Arial', size: 28, color: '000000' })],
            spacing: { after: 120 },
        }),
    ];

    if (company?.nom) infoLines.push(new Paragraph({ children: [new TextRun({ text: `Entreprise : ${company.nom}`, bold: true, font: 'Arial', size: 20 })] }));
    if (company?.ifu) infoLines.push(new Paragraph({ children: [new TextRun({ text: `IFU : ${company.ifu}`, font: 'Arial', size: 18 })] }));
    if (company?.rc) infoLines.push(new Paragraph({ children: [new TextRun({ text: `RC : ${company.rc}`, font: 'Arial', size: 18 })] }));
    if (company?.adresse) infoLines.push(new Paragraph({ children: [new TextRun({ text: `Adresse : ${company.adresse}`, font: 'Arial', size: 18 })] }));

    infoLines.push(new Paragraph({ spacing: { after: 160 }, children: [] }));

    // KPI résumé
    const kpiPara = new Paragraph({
        spacing: { after: 200 },
        children: [
            new TextRun({ text: `IUTS versé : ${fmt(b.iuts)}   `, bold: true, font: 'Arial', size: 18 }),
            new TextRun({ text: `TVA collectée : ${fmt(b.tva)}   `, bold: true, font: 'Arial', size: 18 }),
            new TextRun({ text: `Retenues source : ${fmt(b.ras)}   `, bold: true, font: 'Arial', size: 18 }),
            new TextRun({ text: `Total : ${fmt(b.total)}`, bold: true, font: 'Arial', size: 20, color: '000000' }),
        ],
    });

    infoLines.push(kpiPara);

    const footer = new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
        children: [new TextRun({
            text: `Document généré par FISCA · ${new Date().toLocaleDateString('fr-FR')} · CGI 2025 Burkina Faso`,
            italics: true, color: '888888', font: 'Arial', size: 16,
        })],
    });

    const doc = new Document({
        sections: [{
            properties: { page: { orientation: PageOrientation.PORTRAIT } },
            headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: `FISCA · Bilan Fiscal ${b.annee}`, color: '888888', font: 'Arial', size: 16 })] })] }) },
            footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CGI 2025 Burkina Faso – Document confidentiel', color: '888888', font: 'Arial', size: 16, italics: true })] })] }) },
            children: [...infoLines, table, footer],
        }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bilan-Fiscal-${b.annee}-${(company?.nom ?? 'entreprise').replace(/\s+/g, '_')}.docx`;
    a.click();
    URL.revokeObjectURL(url);
}
