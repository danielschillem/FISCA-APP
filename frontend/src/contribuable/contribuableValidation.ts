import type {
    PrelRow,
    RSETRRow,
    RSLibRow,
    RSPRERow,
    RSTVARow,
    RsfonRow,
    SalarieRow,
    TvaAvanceRow,
    TvaDeductibleRow,
} from './contribuableStore';

const IFU_RE = /^\d{10}[A-Z]{2}$/;
const DATE_DMY_RE = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;

function nonEmpty(v: string): boolean {
    return v.trim().length > 0;
}

function validIfu(v: string): boolean {
    return IFU_RE.test(v.trim().toUpperCase());
}

function validDate(v: string): boolean {
    return DATE_DMY_RE.test(v.trim());
}

export type RowFieldErrors = Partial<Record<string, string>>;

export function invalidIutsRows(rows: SalarieRow[]): number {
    return rows.filter((r) => !nonEmpty(r.nom) || r.salaireB <= 0 || r.charges < 0 || r.charges > 4).length;
}

export function invalidRsfonRows(rows: RsfonRow[]): number {
    return rows.filter((r) => !nonEmpty(r.identite) || !validIfu(r.ifu) || r.loyer <= 0).length;
}

export function invalidRasRows(rows: Array<RSLibRow | RSETRRow | RSPRERow | RSTVARow>, variant: 'rslib' | 'rsetr' | 'rspre' | 'rstva'): number {
    return rows.filter((r) => {
        if (variant === 'rsetr') {
            const rr = r as RSETRRow;
            return !nonEmpty(rr.nom) || !nonEmpty(rr.activite) || !nonEmpty(rr.adresse) || !nonEmpty(rr.nature) || !validDate(rr.date) || rr.montant <= 0;
        }
        const hasIfu = validIfu((r as RSLibRow | RSPRERow | RSTVARow).ifu);
        const baseOk = variant === 'rstva' ? (r as RSTVARow).montantTVA > 0 : (r as RSLibRow | RSPRERow).montant > 0;
        const id = (r as RSLibRow | RSPRERow | RSTVARow).identification;
        const date = (r as RSLibRow | RSPRERow | RSTVARow).date;
        const nature = (r as RSLibRow | RSPRERow | RSTVARow).nature;
        const adresse = (r as RSLibRow | RSPRERow | RSTVARow).adresse;
        return !hasIfu || !nonEmpty(id) || !nonEmpty(adresse) || !nonEmpty(nature) || !validDate(date) || !baseOk;
    }).length;
}

export function invalidTvaDedRows(rows: TvaDeductibleRow[]): number {
    return rows.filter((r) => !validIfu(r.ifu) || !nonEmpty(r.nom) || !validDate(r.date) || r.ht <= 0 || r.tvaDed < 0 || r.tvaDed > r.tvaFacturee).length;
}

export function invalidTvaAvRows(rows: TvaAvanceRow[]): number {
    return rows.filter((r) => !validIfu(r.ifu) || !nonEmpty(r.nom) || r.ttc <= 0 || r.cumulHTVA < r.htva).length;
}

export function invalidPrelRows(rows: PrelRow[]): number {
    return rows.filter((r) => !nonEmpty(r.nom) || !validIfu(r.ifu) || !validDate(r.date) || r.montantHT <= 0 || r.base < 0 || r.base > r.montantHT || r.prelevement < 0 || r.prelevement > r.base).length;
}

export function iutsFieldErrors(r: SalarieRow): RowFieldErrors {
    const e: RowFieldErrors = {};
    if (!nonEmpty(r.nom)) e.nom = 'Nom requis';
    if (r.salaireB <= 0) e.salaireB = 'Doit être > 0';
    if (r.charges < 0 || r.charges > 4) e.charges = '0 à 4';
    return e;
}

export function rsfonFieldErrors(r: RsfonRow): RowFieldErrors {
    const e: RowFieldErrors = {};
    if (!nonEmpty(r.identite)) e.identite = 'Identité requise';
    if (!validIfu(r.ifu)) e.ifu = 'IFU invalide';
    if (r.loyer <= 0) e.loyer = 'Doit être > 0';
    return e;
}

export function rasFieldErrors(r: RSLibRow | RSETRRow | RSPRERow | RSTVARow, variant: 'rslib' | 'rsetr' | 'rspre' | 'rstva'): RowFieldErrors {
    const e: RowFieldErrors = {};
    if (variant === 'rsetr') {
        const rr = r as RSETRRow;
        if (!nonEmpty(rr.nom)) e.nom = 'Nom requis';
        if (!nonEmpty(rr.activite)) e.activite = 'Activité requise';
        if (!nonEmpty(rr.adresse)) e.adresse = 'Adresse requise';
        if (!nonEmpty(rr.nature)) e.nature = 'Nature requise';
        if (!validDate(rr.date)) e.date = 'Date invalide';
        if (rr.montant <= 0) e.montant = 'Doit être > 0';
        return e;
    }
    const rc = r as RSLibRow | RSPRERow | RSTVARow;
    if (!validIfu(rc.ifu)) e.ifu = 'IFU invalide';
    if (!nonEmpty(rc.identification)) e.identification = 'Identification requise';
    if (!nonEmpty(rc.adresse)) e.adresse = 'Adresse requise';
    if (!nonEmpty(rc.nature)) e.nature = 'Nature requise';
    if (!validDate(rc.date)) e.date = 'Date invalide';
    if (variant === 'rstva') {
        if ((r as RSTVARow).montantTVA <= 0) e.montantTVA = 'Doit être > 0';
    } else if ((r as RSLibRow | RSPRERow).montant <= 0) {
        e.montant = 'Doit être > 0';
    }
    return e;
}

export function tvaDedFieldErrors(r: TvaDeductibleRow): RowFieldErrors {
    const e: RowFieldErrors = {};
    if (!validIfu(r.ifu)) e.ifu = 'IFU invalide';
    if (!nonEmpty(r.nom)) e.nom = 'Nom requis';
    if (!validDate(r.date)) e.date = 'Date invalide';
    if (r.ht <= 0) e.ht = 'Doit être > 0';
    if (r.tvaDed < 0) e.tvaDed = '>= 0';
    if (r.tvaDed > r.tvaFacturee) e.tvaDed = '<= TVA facturée';
    return e;
}

export function tvaAvFieldErrors(r: TvaAvanceRow): RowFieldErrors {
    const e: RowFieldErrors = {};
    if (!validIfu(r.ifu)) e.ifu = 'IFU invalide';
    if (!nonEmpty(r.nom)) e.nom = 'Nom requis';
    if (r.ttc <= 0) e.ttc = 'Doit être > 0';
    if (r.cumulHTVA < r.htva) e.cumulHTVA = '>= HTVA période';
    return e;
}

export function prelFieldErrors(r: PrelRow): RowFieldErrors {
    const e: RowFieldErrors = {};
    if (!nonEmpty(r.nom)) e.nom = 'Nom requis';
    if (!validIfu(r.ifu)) e.ifu = 'IFU invalide';
    if (!validDate(r.date)) e.date = 'Date invalide';
    if (r.montantHT <= 0) e.montantHT = 'Doit être > 0';
    if (r.base < 0) e.base = '>= 0';
    if (r.base > r.montantHT) e.base = '<= montant HT';
    if (r.prelevement < 0) e.prelevement = '>= 0';
    if (r.prelevement > r.base) e.prelevement = '<= base';
    return e;
}

