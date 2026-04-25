import type { Company } from '../types';

function norm(v: string | null | undefined): string {
    return String(v ?? '').trim();
}

export function isCompanyProfileComplete(company?: Partial<Company> | null): boolean {
    if (!company) return false;
    return (
        norm(company.nom) !== '' &&
        norm(company.ifu) !== '' &&
        norm(company.rc) !== '' &&
        norm(company.forme_juridique) !== '' &&
        norm(company.regime) !== '' &&
        norm(company.centre_impots) !== '' &&
        norm(company.adresse) !== '' &&
        norm(company.ville) !== '' &&
        norm(company.tel) !== ''
    );
}

