import type { Company } from '../types';

/** Mappe la société API (Paramètres / `GET /company`) vers l’état local des annexes. */
export function apiCompanyToLocal(c: Company) {
    const parts = [c.adresse, c.quartier, c.ville].map((x) => String(x ?? '').trim()).filter(Boolean);
    const adresse = parts.length ? parts.join(' · ') : String(c.adresse ?? '');
    return {
        ifu: String(c.ifu ?? '').toUpperCase(),
        raisonSociale: String(c.nom ?? ''),
        rc: String(c.rc ?? ''),
        adresse,
        telephone: String(c.tel ?? ''),
    };
}

/** Champs identité envoyés à `PUT /company` (le backend fusionne avec l’existant). */
export function localCompanyToApiPatch(local: {
    ifu: string;
    raisonSociale: string;
    rc: string;
    adresse: string;
    telephone: string;
}): Pick<Company, 'nom' | 'ifu' | 'rc' | 'adresse' | 'tel'> {
    return {
        nom: local.raisonSociale,
        ifu: local.ifu,
        rc: local.rc,
        adresse: local.adresse,
        tel: local.telephone,
    };
}
