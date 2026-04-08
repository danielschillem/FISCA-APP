export function fmtN(n: number): string {
    return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}

export function fmtFCFA(n: number): string {
    return `${fmtN(n)} FCFA`
}

export const MOIS_NOMS = [
    '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
