import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ContribuableState } from '../contribuable/contribuableStore';
import { calcCNSSPatronale, calcFSP, calcTPA } from '../contribuable/contribuableCalc';
import { getFiscalRules } from '../contribuable/fiscalRules';
import { buildPdfTrace, drawTraceQr, getFiscaLogoDataUrl, type PdfTrace } from './pdfTrace';
import { appendPaymentReceiptPage } from './paymentReceipt';

function fmt(n: number): string {
    const v = Math.round(Number(n) || 0);
    const sign = v < 0 ? '-' : '';
    const s = String(Math.abs(v));
    return `${sign}${s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
}

function numberToFrench(n: number): string {
    const units = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
    const tens = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
    const below100 = (x: number): string => {
        if (x < 10) return units[x];
        if (x < 17) return teens[x - 10];
        if (x < 20) return `dix-${units[x - 10]}`;
        if (x < 70) {
            const t = Math.floor(x / 10);
            const u = x % 10;
            if (u === 0) return tens[t];
            if (u === 1) return `${tens[t]} et un`;
            return `${tens[t]}-${units[u]}`;
        }
        if (x < 80) {
            const r = x - 60;
            if (r === 10) return 'soixante-dix';
            if (r === 11) return 'soixante et onze';
            if (r < 17) return `soixante-${teens[r - 10]}`;
            return `soixante-dix-${units[r - 10]}`;
        }
        const r = x - 80;
        if (r === 0) return 'quatre-vingts';
        if (r < 10) return `quatre-vingt-${units[r]}`;
        if (r < 17) return `quatre-vingt-${teens[r - 10]}`;
        return `quatre-vingt-dix-${units[r - 10]}`;
    };
    const below1000 = (x: number): string => {
        if (x < 100) return below100(x);
        const h = Math.floor(x / 100);
        const r = x % 100;
        const hText = h === 1 ? 'cent' : `${units[h]} cent`;
        if (r === 0) return h > 1 ? `${hText}s` : hText;
        return `${hText} ${below100(r)}`;
    };
    const abs = Math.max(0, Math.round(n));
    if (abs < 1000) return below1000(abs);
    const thousands = Math.floor(abs / 1000);
    const rest = abs % 1000;
    const thouText = thousands === 1 ? 'mille' : `${below1000(thousands)} mille`;
    if (rest === 0) return thouText;
    if (abs < 1_000_000) return `${thouText} ${below1000(rest)}`;
    const millions = Math.floor(abs / 1_000_000);
    const rem = abs % 1_000_000;
    const milText = millions === 1 ? 'un million' : `${below1000(millions)} millions`;
    if (rem === 0) return milText;
    if (rem < 1000) return `${milText} ${below1000(rem)}`;
    const remTh = Math.floor(rem / 1000);
    const remRest = rem % 1000;
    const remThText = remTh === 1 ? 'mille' : `${below1000(remTh)} mille`;
    return remRest === 0 ? `${milText} ${remThText}` : `${milText} ${remThText} ${below1000(remRest)}`;
}

function drawJustifiedParagraph(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    width: number,
    lineHeight = 4.4
): number {
    const words = text.trim().split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (doc.getTextWidth(test) <= width) {
            line = test;
        } else {
            if (line) lines.push(line);
            line = w;
        }
    }
    if (line) lines.push(line);
    lines.forEach((ln, idx) => {
        const isLast = idx === lines.length - 1;
        if (isLast) {
            doc.text(ln, x, y + idx * lineHeight);
            return;
        }
        const parts = ln.split(' ');
        if (parts.length <= 1) {
            doc.text(ln, x, y + idx * lineHeight);
            return;
        }
        const textW = doc.getTextWidth(parts.join(''));
        const gaps = parts.length - 1;
        const extra = (width - textW) / gaps;
        let cx = x;
        parts.forEach((p, i) => {
            doc.text(p, cx, y + idx * lineHeight);
            cx += doc.getTextWidth(p);
            if (i < gaps) cx += extra;
        });
    });
    return y + lines.length * lineHeight;
}

function alignTotalAmountsRight(data: any) {
    const rowRaw = Array.isArray(data.row?.raw) ? data.row.raw : [];
    const firstCell = String(rowRaw[0] ?? '').trim().toUpperCase();
    const isTotalBodyRow = data.section === 'body' && firstCell === 'TOTAL';
    const isFootRow = data.section === 'foot';
    if (!(isFootRow || isTotalBodyRow)) return;
    if (data.column.index <= 0) return;
    const raw = String(data.cell.raw ?? '').trim();
    if (!raw || raw === '-') return;
    data.cell.styles.halign = 'right';
}

function drawProHeader(
    doc: jsPDF,
    title: string,
    company: ContribuableState['company'],
    period: ContribuableState['period'],
    _duplicate = false
): number {
    const x = 14;
    const rightCenterX = 168;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 30, 50);
    doc.setFontSize(9);
    doc.text('BURKINA FASO', rightCenterX, 12.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('LA PATRIE OU LA MORT, NOUS VAINCRONS', rightCenterX, 16.8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 30, 50);
    doc.setFontSize(15);
    doc.text(title, x, 17);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 90, 110);
    doc.setFontSize(9);
    doc.text(`Entreprise: ${company.raisonSociale || '-'}`, x, 23);
    doc.text(`IFU: ${company.ifu || '-'}`, x + 88, 23);
    doc.text(`Période: ${String(period.month).padStart(2, '0')}/${period.year}`, x + 140, 23);
    doc.text(`Adresse: ${company.adresse || '-'}`, x, 28);

    doc.setDrawColor(210, 216, 224);
    doc.setLineWidth(0.35);
    doc.line(14, 31.5, 196, 31.5);
    return 36;
}

function drawFooter(doc: jsPDF, trace?: PdfTrace) {
    const page = doc.getCurrentPageInfo().pageNumber;
    const total = doc.getNumberOfPages();
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(230, 233, 238);
    doc.setLineWidth(0.25);
    doc.line(14, h - 10, 196, h - 10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 130, 145);
    doc.setFontSize(8);
    const traceTxt = trace ? ` • Trace ${trace.traceId}` : '';
    doc.text(`Export FISCA • ${new Date().toLocaleDateString('fr-FR')}${traceTxt}`, 14, h - 5.5);
    doc.text(`Page ${page}/${total}`, 196, h - 5.5, { align: 'right' });
}

function drawDuplicataWatermark(doc: jsPDF) {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.saveGraphicsState();
    // Filigrane léger mais visible, même au-dessus des fonds blancs des tableaux.
    const d = doc as jsPDF & { GState?: new (opts: { opacity?: number }) => unknown; setGState?: (state: unknown) => void };
    if (d.GState && d.setGState) {
        d.setGState(new d.GState({ opacity: 0.1 }));
    }
    doc.setTextColor(185, 185, 185);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(48);
    doc.text('DUPLICATA', w / 2, h / 2, {
        align: 'center',
        angle: 30,
    });
    doc.restoreGraphicsState();
}

export async function exportContribuableAnnexesPDF(
    state: Pick<ContribuableState, 'company' | 'period' | 'annexes'>,
    opts?: { duplicate?: boolean; paymentBaseAmount?: number; paymentRef?: string }
) {
    const { company, period, annexes } = state;
    const rules = getFiscalRules(period.year);
    const traceGlobal = await buildPdfTrace('annexes', {
        companyIfu: company.ifu,
        period,
        counts: {
            iuts: annexes.iuts.rows.length,
            rsfon: annexes.rsfon.rows.length,
            rslib: annexes.rslib.rows.length,
            rsetr: annexes.rsetr.rows.length,
            rspre: annexes.rspre.rows.length,
            rstva: annexes.rstva.rows.length,
            tvaDed: annexes.tva.deductible.length,
            tvaAv: annexes.tva.avances.length,
            prel: annexes.prel.rows.length,
        },
    });
    const totalROS = annexes.iuts.rows.reduce((s, r) => s + r.cnss, 0);
    const totalCNSSPatronale = annexes.iuts.rows.reduce(
        (s, r) => s + calcCNSSPatronale(r.salaireB, period.year),
        0
    );
    const totalTPA = annexes.iuts.rows.reduce((s, r) => s + calcTPA(r.salaireB, period.year), 0);
    const totalFSP = annexes.iuts.rows.reduce(
        (s, r) => s + calcFSP(r.salaireB, r.cnss, r.iutsDu),
        0
    );
    const totalTvaDeductible = annexes.tva.deductible.reduce((s, r) => s + (r.tvaDed || 0), 0);
    const totalTvaCollectee = annexes.tva.avances.reduce((s, r) => s + ((r.htva || 0) * rules.tva.standardRate), 0);
    // TVA due = TVA collectee - TVA deductible (jamais negative).
    const totalTvaNette = Math.max(0, Math.round(totalTvaCollectee - totalTvaDeductible));
    const fiscaLogo = await getFiscaLogoDataUrl();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const tableWidth = 182;
    const tableMarginX = (pageWidth - tableWidth) / 2;
    const qrSize = 23;
    const qrX = 196 - qrSize;
    const qrY = 262;
    const pageHead = (title: string) => drawProHeader(doc, title, company, period, Boolean(opts?.duplicate));
    const next = (title: string): number => {
        doc.addPage();
        return pageHead(title);
    };
    const tableStripe = [248, 250, 252] as [number, number, number];
    const commonHeadStyles = {
        fillColor: [255, 255, 255] as [number, number, number],
        textColor: [25, 35, 52] as [number, number, number],
        fontStyle: 'bold' as const,
        halign: 'center' as const,
        lineColor: [0, 0, 0] as [number, number, number],
        lineWidth: 0.3,
    };
    const commonStyles = {
        font: 'helvetica',
        fontSize: 8.5,
        textColor: [35, 45, 60] as [number, number, number],
        cellPadding: 2.2,
        lineColor: [0, 0, 0] as [number, number, number],
        lineWidth: 0.3,
        valign: 'middle' as const,
    };
    const safeRows = (rows: string[][], cols: number): string[][] =>
        rows.length > 0 ? rows : [Array.from({ length: cols }, () => '-')];
    const centeredStartY = (rowCount: number, minY: number): number => {
        const pageHeight = doc.internal.pageSize.getHeight();
        const estimatedTableHeight = (rowCount + 1) * 8 + 10;
        const centered = (pageHeight - estimatedTableHeight) / 2;
        return Math.max(minY, centered);
    };
    const drawSectionQr = async (section: string, data: unknown) => {
        const trace = await buildPdfTrace(section, {
            companyIfu: company.ifu,
            period,
            ...((data as object) ?? {}),
        });
        try {
            await drawTraceQr(doc, trace, qrX, qrY, qrSize, {
                centerImageDataUrl: fiscaLogo,
                centerLabel: 'FISCA',
            });
        } catch {
            // QR non bloquant
        }
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(70, 80, 95);
        doc.setFontSize(6.5);
        doc.text(`QR ${section.toUpperCase()}`, qrX + qrSize / 2, qrY + qrSize + 3.2, { align: 'center' });
        return trace;
    };
    const pageTrace: Record<number, PdfTrace> = {};

    let yStart = pageHead('Pack Annexes Contribuable');
    const recapRows = [
        ['IUTS', fmt(annexes.iuts.rows.reduce((s, r) => s + r.iutsDu, 0))],
        ['ROS/CNSS', fmt(totalROS)],
        ['FSP (1% net salarial)', fmt(totalFSP)],
        ['CNSS Patronale', fmt(totalCNSSPatronale)],
        ['TPA', fmt(totalTPA)],
        ['RSFON', fmt(annexes.rsfon.rows.reduce((s, r) => s + r.retenue, 0))],
        ['RSLIB', fmt(annexes.rslib.rows.reduce((s, r) => s + r.retenue, 0))],
        ['RSETR', fmt(annexes.rsetr.rows.reduce((s, r) => s + r.retenue, 0))],
        ['RSPRE', fmt(annexes.rspre.rows.reduce((s, r) => s + r.retenue, 0))],
        ['RSTVA', fmt(annexes.rstva.rows.reduce((s, r) => s + r.retenue, 0))],
        ['TVA nette', fmt(totalTvaNette)],
        ['PREL', fmt(annexes.prel.rows.reduce((s, r) => s + r.prelevement, 0))],
    ];

    autoTable(doc, {
        startY: centeredStartY(recapRows.length, yStart),
        head: [['Annexe', 'Montant mensuel (FCFA)']],
        body: recapRows,
        foot: [[
            'TOTAL',
            fmt(
                recapRows.reduce((s, r) => {
                    const n = Number(String(r[1]).replace(/\s/g, ''));
                    return s + (Number.isFinite(n) ? n : 0);
                }, 0)
            ),
        ]],
        styles: { ...commonStyles, fontSize: 9, cellPadding: 2.6 },
        headStyles: commonHeadStyles,
        alternateRowStyles: { fillColor: tableStripe },
        footStyles: {
            fillColor: [243, 244, 246],
            textColor: [20, 20, 20],
            fontStyle: 'bold',
            lineColor: [0, 0, 0],
            lineWidth: 0.3,
            valign: 'middle',
        },
        columnStyles: {
            0: { halign: 'left', cellWidth: 120 },
            1: { halign: 'right', cellWidth: 62, fontStyle: 'bold' },
        },
        tableLineColor: [0, 0, 0],
        tableLineWidth: 0.3,
        tableWidth,
        margin: { left: tableMarginX, right: tableMarginX },
        didParseCell: alignTotalAmountsRight,
    });
    pageTrace[doc.getCurrentPageInfo().pageNumber] = await drawSectionQr('pack', {
        totals: recapRows.map((r) => ({ annexe: r[0], total: r[1] })),
    });

    yStart = next('Fiche de Synthèse et Responsabilité');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 30, 50);
    doc.setFontSize(11);
    doc.text('Synthèse mensuelle déclarative', pageWidth / 2, yStart, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(45, 55, 72);
    doc.setFontSize(9);
    const totalMensuel = recapRows.reduce((s, r) => s + (Number(String(r[1]).replace(/\s/g, '')) || 0), 0);
    const totalEnLettres = numberToFrench(totalMensuel);
    const taxLabelMap: Record<string, string> = {
        IUTS: 'IUTS (Impôt sur les traitements et salaires)',
        'ROS/CNSS': 'Cotisation sociale salariale (CNSS)',
        'FSP (1% net salarial)': 'FSP (Fonds de soutien patriotique)',
        'CNSS Patronale': 'Cotisation patronale CNSS',
        TPA: "TPA (Taxe patronale d'apprentissage)",
        RSFON: 'RSFON (Retenue sur revenus fonciers)',
        RSLIB: 'RSLIB (Retenue libératoire)',
        RSETR: 'RSETR (Retenue État/Trésor)',
        RSPRE: 'RSPRE (Retenue sur prestations)',
        RSTVA: 'RSTVA (Retenue sur TVA)',
        'TVA nette': 'TVA nette a reverser (TVA collectee - TVA deductible)',
        PREL: 'PREL (Prélèvement à la source)',
    };
    const taxesDetail = recapRows.map(([label, amount]) => ({
        label: taxLabelMap[label] ?? label,
        amount: String(amount),
    }));
    const centerX = pageWidth / 2;
    const textWidth = 160;
    const textX = (pageWidth - textWidth) / 2;
    let yTxt = 92;
    const introPrefix = `Conformément aux données saisies dans les annexes pour la période ${String(period.month).padStart(2, '0')}/${period.year}, le montant mensuel total des obligations fiscales à reverser est de`;
    const introAmount = `${totalEnLettres} francs CFA (${fmt(totalMensuel)} FCFA) dont :`;
    doc.setFont('helvetica', 'normal');
    yTxt = drawJustifiedParagraph(
        doc,
        `${introPrefix}`,
        textX,
        yTxt,
        textWidth,
        4.8
    ) + 1.8;
    doc.setFont('helvetica', 'bold');
    yTxt = drawJustifiedParagraph(
        doc,
        introAmount,
        textX,
        yTxt,
        textWidth,
        4.8
    ) + 1.8;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(45, 55, 72);
    doc.setFontSize(9);
    for (const t of taxesDetail) {
        const line = `- ${t.label} : ${t.amount} FCFA`;
        doc.text(line, textX, yTxt);
        yTxt += 4.4;
    }
    yTxt += 1.4;
    doc.setFont('helvetica', 'bold');
    doc.text('Engagement du contribuable', centerX, yTxt, { align: 'center' });
    yTxt += 4.2;
    doc.setFont('helvetica', 'normal');
    yTxt = drawJustifiedParagraph(
        doc,
        'Le contribuable demeure seul responsable de l’exactitude, de la sincérité et de la complétude des informations déclarées. Toute fausse déclaration, omission ou inexactitude engage sa responsabilité conformément aux textes fiscaux et réglementaires en vigueur.',
        textX,
        yTxt,
        textWidth,
        4.8
    ) + 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Limite de responsabilité de FISCA', centerX, yTxt, { align: 'center' });
    yTxt += 4.2;
    doc.setFont('helvetica', 'normal');
    yTxt = drawJustifiedParagraph(
        doc,
        'FISCA est un outil d’assistance à la préparation des déclarations. Son utilisation se fait sous l’entière responsabilité de l’utilisateur. FISCA ne se substitue ni à l’administration fiscale, ni au conseil d’un professionnel habilité.',
        textX,
        yTxt,
        textWidth,
        4.8
    ) + 7;
    doc.setDrawColor(140, 150, 165);
    doc.setLineWidth(0.25);
    doc.line(26, yTxt, 96, yTxt);
    doc.line(114, yTxt, 184, yTxt);
    doc.setFontSize(8);
    doc.setTextColor(90, 100, 118);
    doc.text('Lieu / Date', 61, yTxt + 4.5, { align: 'center' });
    doc.text('Signature / Cachet du contribuable (Lu et approuve)', 149, yTxt + 4.5, { align: 'center' });
    pageTrace[doc.getCurrentPageInfo().pageNumber] = await drawSectionQr('responsabilite', {
        periode: `${period.month}/${period.year}`,
        totalMensuel,
    });

    yStart = next('Annexe IUTS - Détail');
    const iutsRows = safeRows(
        annexes.iuts.rows.map((r) => [
            r.nom || '-',
            r.categorie.replace('_', '-'),
            fmt(r.salaireB),
            fmt(r.cnss),
            fmt(r.baseImp),
            fmt(r.iutsDu),
        ]),
        6
    );
    autoTable(doc, {
        startY: centeredStartY(iutsRows.length, yStart),
        head: [['Nom', 'Catégorie', 'Brut', 'CNSS', 'Base', 'IUTS']],
        body: iutsRows,
        foot: [[
            'TOTAL',
            '-',
            fmt(annexes.iuts.rows.reduce((s, r) => s + (r.salaireB || 0), 0)),
            fmt(annexes.iuts.rows.reduce((s, r) => s + (r.cnss || 0), 0)),
            fmt(annexes.iuts.rows.reduce((s, r) => s + (r.baseImp || 0), 0)),
            fmt(annexes.iuts.rows.reduce((s, r) => s + (r.iutsDu || 0), 0)),
        ]],
        styles: commonStyles,
        headStyles: commonHeadStyles,
        alternateRowStyles: { fillColor: tableStripe },
        footStyles: {
            fillColor: [243, 244, 246],
            textColor: [20, 20, 20],
            fontStyle: 'bold',
            lineColor: [0, 0, 0],
            lineWidth: 0.3,
            valign: 'middle',
        },
        columnStyles: {
            0: { halign: 'left', cellWidth: 52 },
            1: { halign: 'left', cellWidth: 28 },
            2: { halign: 'right', cellWidth: 22 },
            3: { halign: 'right', cellWidth: 22 },
            4: { halign: 'right', cellWidth: 28 },
            5: { halign: 'right', cellWidth: 30, fontStyle: 'bold' },
        },
        tableLineColor: [0, 0, 0],
        tableLineWidth: 0.3,
        tableWidth,
        margin: { left: tableMarginX, right: tableMarginX },
        didParseCell: alignTotalAmountsRight,
    });
    pageTrace[doc.getCurrentPageInfo().pageNumber] = await drawSectionQr('iuts', {
        rows: annexes.iuts.rows.length,
        totalIuts: annexes.iuts.rows.reduce((s, r) => s + r.iutsDu, 0),
    });

    yStart = next('Annexe ROS / TPA - Détail');
    const rosTpaRows = safeRows(
        annexes.iuts.rows.map((r) => [
            r.nom || '-',
            fmt(r.salaireB),
            fmt(r.cnss),
            fmt(calcCNSSPatronale(r.salaireB, period.year)),
            fmt(r.iutsDu),
            fmt(Math.max(0, r.salaireB - r.cnss - r.iutsDu)),
            fmt(calcTPA(r.salaireB, period.year)),
        ]),
        7
    );
    autoTable(doc, {
        startY: centeredStartY(rosTpaRows.length, yStart),
        head: [['Nom', 'Brut', 'CNSS (ROS)', 'CNSS patronale', 'IUTS', 'Net (ROS)', 'TPA']],
        body: rosTpaRows,
        foot: [[
            'TOTAL',
            fmt(annexes.iuts.rows.reduce((s, r) => s + (r.salaireB || 0), 0)),
            fmt(totalROS),
            fmt(totalCNSSPatronale),
            fmt(annexes.iuts.rows.reduce((s, r) => s + (r.iutsDu || 0), 0)),
            fmt(annexes.iuts.rows.reduce((s, r) => s + Math.max(0, (r.salaireB || 0) - (r.cnss || 0) - (r.iutsDu || 0)), 0)),
            fmt(totalTPA),
        ]],
        styles: commonStyles,
        headStyles: commonHeadStyles,
        alternateRowStyles: { fillColor: tableStripe },
        footStyles: {
            fillColor: [243, 244, 246],
            textColor: [20, 20, 20],
            fontStyle: 'bold',
            lineColor: [0, 0, 0],
            lineWidth: 0.3,
            valign: 'middle',
        },
        columnStyles: {
            0: { halign: 'left', cellWidth: 44 },
            1: { halign: 'right', cellWidth: 22 },
            2: { halign: 'right', cellWidth: 26 },
            3: { halign: 'right', cellWidth: 28 },
            4: { halign: 'right', cellWidth: 20 },
            5: { halign: 'right', cellWidth: 24 },
            6: { halign: 'right', cellWidth: 18, fontStyle: 'bold' },
        },
        tableLineColor: [0, 0, 0],
        tableLineWidth: 0.3,
        tableWidth,
        margin: { left: tableMarginX, right: tableMarginX },
        didParseCell: alignTotalAmountsRight,
    });
    pageTrace[doc.getCurrentPageInfo().pageNumber] = await drawSectionQr('ros_tpa', {
        rows: annexes.iuts.rows.length,
        totalCnss: totalROS,
        totalCnssPatronale: totalCNSSPatronale,
        totalTpa: totalTPA,
    });

    yStart = next('Annexe RSFON - Détail');
    const rsfonRows = safeRows(
        annexes.rsfon.rows.map((r) => [
            r.identite || '-',
            r.ifu || '-',
            r.localite || '-',
            fmt(r.loyer),
            fmt(r.retenue),
        ]),
        5
    );
    autoTable(doc, {
        startY: centeredStartY(rsfonRows.length, yStart),
        head: [['Identité', 'IFU', 'Localité', 'Loyer', 'Retenue IRF']],
        body: rsfonRows,
        foot: [[
            'TOTAL',
            '-',
            '-',
            fmt(annexes.rsfon.rows.reduce((s, r) => s + (r.loyer || 0), 0)),
            fmt(annexes.rsfon.rows.reduce((s, r) => s + (r.retenue || 0), 0)),
        ]],
        styles: commonStyles,
        headStyles: commonHeadStyles,
        alternateRowStyles: { fillColor: tableStripe },
        footStyles: {
            fillColor: [243, 244, 246],
            textColor: [20, 20, 20],
            fontStyle: 'bold',
            lineColor: [0, 0, 0],
            lineWidth: 0.3,
            valign: 'middle',
        },
        columnStyles: {
            0: { halign: 'left', cellWidth: 56 },
            1: { halign: 'left', cellWidth: 26 },
            2: { halign: 'left', cellWidth: 32 },
            3: { halign: 'right', cellWidth: 30 },
            4: { halign: 'right', cellWidth: 38, fontStyle: 'bold' },
        },
        tableLineColor: [0, 0, 0],
        tableLineWidth: 0.3,
        tableWidth,
        margin: { left: tableMarginX, right: tableMarginX },
        didParseCell: alignTotalAmountsRight,
    });
    pageTrace[doc.getCurrentPageInfo().pageNumber] = await drawSectionQr('rsfon', {
        rows: annexes.rsfon.rows.length,
        totalRetenue: annexes.rsfon.rows.reduce((s, r) => s + r.retenue, 0),
    });

    yStart = next('Annexes RAS - RSLIB / RSETR / RSPRE / RSTVA');
    const rasRows = safeRows(
        [
            ...annexes.rslib.rows.map((r) => [
                'RSLIB',
                r.identification || '-',
                r.ifu || '-',
                r.date || '-',
                fmt(r.montant),
                `${Math.round(r.taux * 100)}%`,
                fmt(r.retenue),
            ]),
            ...annexes.rsetr.rows.map((r) => [
                'RSETR',
                r.nom || '-',
                r.activite || '-',
                r.date || '-',
                fmt(r.montant),
                `${Math.round(r.taux * 100)}%`,
                fmt(r.retenue),
            ]),
            ...annexes.rspre.rows.map((r) => [
                'RSPRE',
                r.identification || '-',
                r.ifu || '-',
                r.date || '-',
                fmt(r.montant),
                `${Math.round(r.taux * 100)}%`,
                fmt(r.retenue),
            ]),
            ...annexes.rstva.rows.map((r) => [
                'RSTVA',
                r.identification || '-',
                r.ifu || '-',
                r.date || '-',
                fmt(r.montantTVA),
                `${Math.round(r.taux * 100)}%`,
                fmt(r.retenue),
            ]),
        ],
        7
    );
    autoTable(doc, {
        startY: centeredStartY(rasRows.length, yStart),
        head: [['Annexe', 'Bénéficiaire', 'IFU/ID', 'Date', 'Montant', 'Taux', 'Retenue']],
        body: rasRows,
        foot: [[
            'TOTAL',
            '-',
            '-',
            '-',
            fmt(
                annexes.rslib.rows.reduce((s, r) => s + (r.montant || 0), 0) +
                    annexes.rsetr.rows.reduce((s, r) => s + (r.montant || 0), 0) +
                    annexes.rspre.rows.reduce((s, r) => s + (r.montant || 0), 0) +
                    annexes.rstva.rows.reduce((s, r) => s + (r.montantTVA || 0), 0)
            ),
            '-',
            fmt(
                annexes.rslib.rows.reduce((s, r) => s + (r.retenue || 0), 0) +
                    annexes.rsetr.rows.reduce((s, r) => s + (r.retenue || 0), 0) +
                    annexes.rspre.rows.reduce((s, r) => s + (r.retenue || 0), 0) +
                    annexes.rstva.rows.reduce((s, r) => s + (r.retenue || 0), 0)
            ),
        ]],
        styles: commonStyles,
        headStyles: commonHeadStyles,
        alternateRowStyles: { fillColor: tableStripe },
        footStyles: {
            fillColor: [243, 244, 246],
            textColor: [20, 20, 20],
            fontStyle: 'bold',
            lineColor: [0, 0, 0],
            lineWidth: 0.3,
            valign: 'middle',
        },
        columnStyles: {
            0: { halign: 'left', cellWidth: 22 },
            1: { halign: 'left', cellWidth: 44 },
            2: { halign: 'left', cellWidth: 24 },
            3: { halign: 'center', cellWidth: 18 },
            4: { halign: 'right', cellWidth: 28 },
            5: { halign: 'center', cellWidth: 14 },
            6: { halign: 'right', cellWidth: 32, fontStyle: 'bold' },
        },
        tableLineColor: [0, 0, 0],
        tableLineWidth: 0.3,
        tableWidth,
        margin: { left: tableMarginX, right: tableMarginX },
        didParseCell: alignTotalAmountsRight,
    });
    pageTrace[doc.getCurrentPageInfo().pageNumber] = await drawSectionQr('ras', {
        rslib: annexes.rslib.rows.length,
        rsetr: annexes.rsetr.rows.length,
        rspre: annexes.rspre.rows.length,
        rstva: annexes.rstva.rows.length,
    });

    yStart = next('Annexe TVA - Déductible & Avances');
    const tvaRows = safeRows(
        [
            ...annexes.tva.deductible.map((r) => [
                'TVA Déductible',
                r.ifu || '-',
                r.nom || '-',
                r.ref || '-',
                fmt(r.ht),
                fmt(r.tvaFacturee),
                fmt(r.tvaDed),
            ]),
            ...annexes.tva.avances.map((r) => [
                'TVA Avances',
                r.ifu || '-',
                r.nom || '-',
                r.refMarche || '-',
                fmt(r.ttc),
                fmt(r.htva),
                fmt(r.cumulHTVA),
            ]),
        ],
        7
    );
    autoTable(doc, {
        startY: centeredStartY(tvaRows.length, yStart),
        head: [['Bloc', 'IFU', 'Nom', 'Référence', 'HT/TTC', 'TVA/HTVA', 'Valeur retenue']],
        body: tvaRows,
        foot: [[
            'TOTAL',
            '-',
            '-',
            '-',
            fmt(
                annexes.tva.deductible.reduce((s, r) => s + (r.ht || 0), 0) +
                    annexes.tva.avances.reduce((s, r) => s + (r.ttc || 0), 0)
            ),
            fmt(
                annexes.tva.deductible.reduce((s, r) => s + (r.tvaFacturee || 0), 0) +
                    annexes.tva.avances.reduce((s, r) => s + (r.htva || 0), 0)
            ),
            fmt(
                annexes.tva.deductible.reduce((s, r) => s + (r.tvaDed || 0), 0) +
                    annexes.tva.avances.reduce((s, r) => s + (r.cumulHTVA || 0), 0)
            ),
        ]],
        styles: commonStyles,
        headStyles: commonHeadStyles,
        alternateRowStyles: { fillColor: tableStripe },
        footStyles: {
            fillColor: [243, 244, 246],
            textColor: [20, 20, 20],
            fontStyle: 'bold',
            lineColor: [0, 0, 0],
            lineWidth: 0.3,
            valign: 'middle',
        },
        columnStyles: {
            0: { halign: 'left', cellWidth: 30 },
            1: { halign: 'left', cellWidth: 28 },
            2: { halign: 'left', cellWidth: 36 },
            3: { halign: 'left', cellWidth: 24 },
            4: { halign: 'right', cellWidth: 22 },
            5: { halign: 'right', cellWidth: 20 },
            6: { halign: 'right', cellWidth: 22, fontStyle: 'bold' },
        },
        tableLineColor: [0, 0, 0],
        tableLineWidth: 0.3,
        tableWidth,
        margin: { left: tableMarginX, right: tableMarginX },
        didParseCell: alignTotalAmountsRight,
    });
    pageTrace[doc.getCurrentPageInfo().pageNumber] = await drawSectionQr('tva', {
        rows: annexes.tva.deductible.length + annexes.tva.avances.length,
        totalDed: annexes.tva.deductible.reduce((s, r) => s + r.tvaDed, 0),
    });

    yStart = next('Annexe PREL - Détail');
    const prelRows = safeRows(
        annexes.prel.rows.map((r) => [
            r.nom || '-',
            r.ifu || '-',
            r.date || '-',
            fmt(r.montantHT),
            fmt(r.base),
            fmt(r.prelevement),
        ]),
        6
    );
    autoTable(doc, {
        startY: centeredStartY(prelRows.length, yStart),
        head: [['Nom', 'IFU', 'Date', 'Montant HT', 'Base', 'Prélèvement']],
        body: prelRows,
        foot: [[
            'TOTAL',
            '-',
            '-',
            fmt(annexes.prel.rows.reduce((s, r) => s + (r.montantHT || 0), 0)),
            fmt(annexes.prel.rows.reduce((s, r) => s + (r.base || 0), 0)),
            fmt(annexes.prel.rows.reduce((s, r) => s + (r.prelevement || 0), 0)),
        ]],
        styles: commonStyles,
        headStyles: commonHeadStyles,
        alternateRowStyles: { fillColor: tableStripe },
        footStyles: {
            fillColor: [243, 244, 246],
            textColor: [20, 20, 20],
            fontStyle: 'bold',
            lineColor: [0, 0, 0],
            lineWidth: 0.3,
            valign: 'middle',
        },
        columnStyles: {
            0: { halign: 'left', cellWidth: 50 },
            1: { halign: 'left', cellWidth: 28 },
            2: { halign: 'center', cellWidth: 22 },
            3: { halign: 'right', cellWidth: 28 },
            4: { halign: 'right', cellWidth: 24 },
            5: { halign: 'right', cellWidth: 30, fontStyle: 'bold' },
        },
        tableLineColor: [0, 0, 0],
        tableLineWidth: 0.3,
        tableWidth,
        margin: { left: tableMarginX, right: tableMarginX },
        didParseCell: alignTotalAmountsRight,
    });
    pageTrace[doc.getCurrentPageInfo().pageNumber] = await drawSectionQr('prel', {
        rows: annexes.prel.rows.length,
        totalPrelevement: annexes.prel.rows.reduce((s, r) => s + r.prelevement, 0),
    });

    yStart = next('Synthèse ROS / RSFON / RAS / PREL');
    const synthSourceRows = [
        {
            bloc: 'ROS/CNSS salarié',
            soumis: annexes.iuts.rows.reduce((s, r) => s + r.salaireB, 0),
            retenue: totalROS,
        },
        {
            bloc: 'CNSS patronale',
            soumis: annexes.iuts.rows.reduce((s, r) => s + r.salaireB, 0),
            retenue: totalCNSSPatronale,
        },
        {
            bloc: 'FSP (1% net salarial)',
            soumis: annexes.iuts.rows.reduce(
                (s, r) => s + Math.max(0, (r.salaireB || 0) - (r.cnss || 0) - (r.iutsDu || 0)),
                0
            ),
            retenue: totalFSP,
        },
        {
            bloc: 'RSFON',
            soumis: annexes.rsfon.rows.reduce((s, r) => s + r.loyer, 0),
            retenue: annexes.rsfon.rows.reduce((s, r) => s + r.retenue, 0),
        },
        {
            bloc: 'RSLIB+RSETR+RSPRE+RSTVA',
            soumis:
                annexes.rslib.rows.reduce((s, r) => s + r.montant, 0) +
                annexes.rsetr.rows.reduce((s, r) => s + r.montant, 0) +
                annexes.rspre.rows.reduce((s, r) => s + r.montant, 0) +
                annexes.rstva.rows.reduce((s, r) => s + r.montantTVA, 0),
            retenue:
                annexes.rslib.rows.reduce((s, r) => s + r.retenue, 0) +
                annexes.rsetr.rows.reduce((s, r) => s + r.retenue, 0) +
                annexes.rspre.rows.reduce((s, r) => s + r.retenue, 0) +
                annexes.rstva.rows.reduce((s, r) => s + r.retenue, 0),
        },
        {
            bloc: 'PREL',
            soumis: annexes.prel.rows.reduce((s, r) => s + r.base, 0),
            retenue: annexes.prel.rows.reduce((s, r) => s + r.prelevement, 0),
        },
    ];
    const synthRows = synthSourceRows.map((r) => [
        r.bloc,
        fmt(r.soumis),
        fmt(r.retenue),
        fmt(r.soumis + r.retenue),
    ]);
    const synthTotalSoumis = synthSourceRows.reduce((s, r) => s + r.soumis, 0);
    const synthTotalRetenue = synthSourceRows.reduce((s, r) => s + r.retenue, 0);
    synthRows.push([
        'TOTAL',
        fmt(synthTotalSoumis),
        fmt(synthTotalRetenue),
        fmt(synthTotalSoumis + synthTotalRetenue),
    ]);
    autoTable(doc, {
        startY: centeredStartY(synthRows.length, yStart),
        head: [['Bloc', 'Montant soumis', 'Retenue / Prélèvement', 'Total ligne']],
        body: synthRows,
        styles: { ...commonStyles, fontSize: 9, cellPadding: 2.4 },
        headStyles: commonHeadStyles,
        alternateRowStyles: { fillColor: tableStripe },
        columnStyles: {
            0: { halign: 'left', cellWidth: 68 },
            1: { halign: 'right', cellWidth: 36 },
            2: { halign: 'right', cellWidth: 36, fontStyle: 'bold' },
            3: { halign: 'right', cellWidth: 40, fontStyle: 'bold' },
        },
        tableLineColor: [0, 0, 0],
        tableLineWidth: 0.3,
        tableWidth,
        margin: { left: tableMarginX, right: tableMarginX },
        didParseCell: alignTotalAmountsRight,
    });
    pageTrace[doc.getCurrentPageInfo().pageNumber] = await drawSectionQr('synthese', {
        totalRos: totalROS,
        totalFsp: totalFSP,
        totalCnssPatronale: totalCNSSPatronale,
    });

    for (let p = 1; p <= doc.getNumberOfPages(); p++) {
        doc.setPage(p);
        if (opts?.duplicate) {
            // Surcouche discrète pour rester visible malgré les fonds de cellules.
            drawDuplicataWatermark(doc);
        }
        drawFooter(doc, pageTrace[p] ?? traceGlobal);
    }

    await appendPaymentReceiptPage(doc, {
        documentLabel: opts?.duplicate ? 'Pack annexes (Duplicata)' : 'Pack annexes',
        baseAmount: opts?.paymentBaseAmount ?? (opts?.duplicate ? 3000 : 5000),
        feeRate: 0.015,
        provider: 'Orange Money',
        transactionRef: opts?.paymentRef ?? traceGlobal.traceId,
        transactionId: opts?.paymentRef ?? traceGlobal.traceId,
        transactionStatus: 'completed',
        company: {
            id: '',
            user_id: '',
            nom: company.raisonSociale || '-',
            ifu: company.ifu || '-',
            rc: company.rc || '-',
            adresse: company.adresse || '-',
            tel: company.telephone || '-',
            secteur: '',
            forme_juridique: '',
            regime: '',
            centre_impots: '',
            code_activite: '',
            date_debut_activite: '',
            email_entreprise: '',
            ville: '',
            quartier: '',
            bp: '',
            fax: '',
        },
        periodLabel: `${String(period.month).padStart(2, '0')}/${period.year}`,
    });

    const suffix = opts?.duplicate
        ? `-duplicata-${new Date().toISOString().slice(0, 10)}`
        : '';
    const filename = `annexes-contribuable-${period.year}-${String(period.month).padStart(2, '0')}${suffix}.pdf`;
    doc.save(filename);
}

