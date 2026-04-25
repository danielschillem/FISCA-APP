import jsPDF from 'jspdf';
import { fmtN } from './fiscalCalc';
import type { Company } from '../types';
import { buildPdfTrace, drawTraceQr } from './pdfTrace';

export type PaymentReceiptOptions = {
    documentLabel: string;
    baseAmount: number;
    feeRate?: number;
    provider?: string;
    transactionRef?: string;
    transactionId?: string;
    transactionStatus?: string;
    transactionPhone?: string;
    company?: Company;
    periodLabel?: string;
};

export function computeOmTotal(baseAmount: number, feeRate = 0.015) {
    const base = Math.max(0, Math.round(baseAmount || 0));
    const fee = Math.round(base * feeRate);
    return { base, fee, total: base + fee };
}

export async function appendPaymentReceiptPage(doc: jsPDF, opts: PaymentReceiptOptions): Promise<void> {
    const feeRate = opts.feeRate ?? 0.015;
    const provider = opts.provider ?? 'Orange Money';
    const { base, fee, total } = computeOmTotal(opts.baseAmount, feeRate);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const ml = 16;
    const mr = w - 16;
    const contentW = mr - ml;

    doc.addPage();

    const trace = await buildPdfTrace('receipt', {
        documentLabel: opts.documentLabel,
        periodLabel: opts.periodLabel ?? '',
        transactionRef: opts.transactionRef ?? '',
        transactionId: opts.transactionId ?? '',
        transactionStatus: opts.transactionStatus ?? 'completed',
        transactionPhone: opts.transactionPhone ?? '',
        provider,
        baseAmount: base,
        feeAmount: fee,
        totalAmount: total,
        feeRate,
        ifu: opts.company?.ifu ?? '',
        rc: opts.company?.rc ?? '',
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(20, 30, 50);
    doc.text('RECU DE PAIEMENT FISCA', ml, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(70, 80, 95);
    doc.text(`Document : ${opts.documentLabel}`, ml, 25);
    if (opts.periodLabel) doc.text(`Periode : ${opts.periodLabel}`, ml, 30);
    doc.text(`Date : ${new Date().toLocaleString('fr-FR')}`, ml, opts.periodLabel ? 35 : 30);
    if (opts.transactionRef) doc.text(`Reference : ${opts.transactionRef}`, ml, opts.periodLabel ? 40 : 35);
    if (opts.transactionId) doc.text(`Transaction : ${opts.transactionId}`, ml, opts.periodLabel ? 45 : 40);

    try {
        await drawTraceQr(doc, trace, mr - 38, 15, 22);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.7);
        doc.setTextColor(105, 115, 130);
        doc.text('QR recu / traçabilité', mr - 27, 40, { align: 'center' });
    } catch {
        // Keep receipt generation resilient even if QR fails.
    }

    const txLineCount = (opts.transactionRef ? 1 : 0) + (opts.transactionId ? 1 : 0);
    const blockY = (opts.periodLabel ? 42 : 37) + txLineCount * 5;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(ml, blockY, contentW, 36);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(35, 45, 60);
    doc.text('Montant service', ml + 3, blockY + 9);
    doc.text(`${fmtN(base)} FCFA`, mr - 3, blockY + 9, { align: 'right' });

    doc.text(`Frais transaction ${provider} (${(feeRate * 100).toFixed(1).replace('.', ',')} %)`, ml + 3, blockY + 18);
    doc.text(`${fmtN(fee)} FCFA`, mr - 3, blockY + 18, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text('Total paye par utilisateur', ml + 3, blockY + 29);
    doc.text(`${fmtN(total)} FCFA`, mr - 3, blockY + 29, { align: 'right' });

    let y = blockY + 46;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 30, 50);
    doc.text('Informations FISCA', ml, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    doc.setTextColor(55, 65, 80);
    doc.text('FISCA - Plateforme de conformite fiscale et sociale', ml, y);
    y += 4.6;
    doc.text(`Entreprise : ${opts.company?.nom || '-'}`, ml, y);
    y += 4.6;
    doc.text(`IFU : ${opts.company?.ifu || '-'}   RC : ${opts.company?.rc || '-'}`, ml, y);

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 30, 50);
    doc.text('Conditions generales', ml, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.3);
    doc.setTextColor(65, 75, 90);
    const cguLines = doc.splitTextToSize(
        'Le paiement couvre le service de generation documentaire FISCA pour la periode demandee. Les frais de transaction Orange Money (1,5%) sont a la charge de l utilisateur. Les donnees declarees restent sous la responsabilite exclusive du contribuable. FISCA est un outil d assistance et ne se substitue ni a l administration fiscale ni a un conseil professionnel habilite.',
        contentW
    );
    doc.text(cguLines, ml, y);

    doc.setDrawColor(230, 233, 238);
    doc.setLineWidth(0.25);
    doc.line(ml, h - 10, mr, h - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(120, 130, 145);
    doc.text('Recu genere automatiquement par FISCA', ml, h - 5.5);
    doc.text(`Trace: ${trace.traceId}`, ml, h - 2.2);
    doc.text(`Hash: ${trace.digest.slice(0, 20)}`, mr - 36, h - 2.2);
    doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}/${doc.getNumberOfPages()}`, mr, h - 5.5, { align: 'right' });
}

