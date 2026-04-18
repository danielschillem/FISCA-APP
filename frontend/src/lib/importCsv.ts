/**
 * importCsv.ts — Utilitaire import CSV/XLSX générique pour FISCA
 * Supporte : .csv (séparateur ; ou ,) et .xlsx/.xls (via bibliothèque xlsx)
 */
import * as XLSX from 'xlsx';

export type ParsedRow = Record<string, string>;

/** Parse un fichier CSV ou Excel et retourne un tableau d'objets clé-valeur.
 *  Les en-têtes de la première ligne deviennent les clés. */
export async function parseFile(file: File): Promise<ParsedRow[]> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (ext === 'csv' || ext === 'txt') {
        return parseCsv(await file.text());
    }
    if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
        return parseXlsx(await file.arrayBuffer());
    }
    throw new Error(`Format non supporté : .${ext}. Utilisez .csv ou .xlsx`);
}

function parseCsv(text: string): ParsedRow[] {
    // Détection séparateur ; ou ,
    const firstLine = text.split('\n')[0] ?? '';
    const sep = firstLine.includes(';') ? ';' : ',';

    const lines = text
        .split('\n')
        .map((l) => l.replace(/\r$/, '').trim())
        .filter((l) => l.length > 0);

    if (lines.length < 2) return [];

    const headers = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map((line) => {
        const vals = line.split(sep).map((v) => v.trim().replace(/^"|"$/g, ''));
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
    });
}

function parseXlsx(buffer: ArrayBuffer): ParsedRow[] {
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<ParsedRow>(ws, { defval: '', raw: false });
    return rows;
}

/** Génère et télécharge un fichier CSV à partir d'en-têtes et de lignes d'exemple */
export function downloadCsvTemplate(filename: string, headers: string[], examples: string[][]): void {
    const sep = ';';
    const lines = [headers.join(sep), ...examples.map((r) => r.join(sep))];
    const bom = '\uFEFF'; // UTF-8 BOM pour Excel français
    const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/** Normalise un montant : supprime espaces, points, virgules → entier */
export function parseAmount(raw: string): number {
    const cleaned = raw.replace(/[\s\u00A0.]/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : Math.round(n);
}

/** Normalise un taux : accepte 18, 18%, 0.18 → retourne 0.18 (décimal) */
export function parseTaux(raw: string): number {
    const cleaned = raw.replace(/%/g, '').trim();
    const n = parseFloat(cleaned.replace(',', '.'));
    if (isNaN(n)) return 0.18;
    return n > 1 ? n / 100 : n; // 18 → 0.18, 0.18 → 0.18
}
