import type jsPDF from 'jspdf';
import QRCode from 'qrcode';

export type PdfTrace = {
    traceId: string;
    issuedAt: string;
    digest: string;
    payload: string;
};
let fiscaLogoDataUrlPromise: Promise<string | null> | null = null;

function shortHash(input: string): string {
    let h = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

async function sha256Hex(input: string): Promise<string> {
    if (!globalThis.crypto?.subtle) return shortHash(input);
    const data = new TextEncoder().encode(input);
    const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function buildPdfTrace(kind: string, data: unknown): Promise<PdfTrace> {
    const issuedAt = new Date().toISOString();
    const raw = JSON.stringify({ kind, issuedAt, data });
    const digest = await sha256Hex(raw);
    const traceId = `${kind.toUpperCase()}-${issuedAt.slice(0, 10).replace(/-/g, '')}-${digest.slice(0, 10)}`;
    const payload = JSON.stringify({
        app: 'FISCA',
        kind,
        traceId,
        issuedAt,
        digest: digest.slice(0, 32),
    });
    return { traceId, issuedAt, digest, payload };
}

export async function drawTraceQr(
    doc: jsPDF,
    trace: PdfTrace,
    x: number,
    y: number,
    size: number,
    opts?: { centerLabel?: string; centerImageDataUrl?: string | null }
): Promise<void> {
    const dataUrl = await QRCode.toDataURL(trace.payload, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 256,
    });
    doc.addImage(dataUrl, 'PNG', x, y, size, size);
    let centerImage = opts?.centerImageDataUrl;
    if (centerImage === undefined) {
        centerImage = await getFiscaLogoDataUrl();
    }
    if (centerImage) {
        const box = size * 0.3;
        const bx = x + (size - box) / 2;
        const by = y + (size - box) / 2;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(bx, by, box, box, 1.2, 1.2, 'F');
        doc.addImage(centerImage, 'PNG', bx + 0.8, by + 0.8, box - 1.6, box - 1.6);
    } else if (opts?.centerLabel) {
        const box = size * 0.3;
        const bx = x + (size - box) / 2;
        const by = y + (size - box) / 2;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(bx, by, box, box, 1.2, 1.2, 'F');
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.2);
        doc.roundedRect(bx, by, box, box, 1.2, 1.2, 'S');
        doc.setTextColor(16, 120, 72);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(Math.max(5, size * 0.11));
        doc.text(opts.centerLabel, x + size / 2, y + size / 2 + 1, { align: 'center' });
    }
}

export async function getFiscaLogoDataUrl(): Promise<string | null> {
    if (!fiscaLogoDataUrlPromise) {
        fiscaLogoDataUrlPromise = (async () => {
            try {
                const res = await fetch('/logo-fisca-clean.png');
                if (!res.ok) return null;
                const blob = await res.blob();
                return await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(blob);
                });
            } catch {
                return null;
            }
        })();
    }
    return fiscaLogoDataUrlPromise;
}

