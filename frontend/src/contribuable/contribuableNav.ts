export const MOIS_LABELS = [
    '',
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
] as const;

export const TOPBAR_TITLES: Record<string, string> = {
    generer: 'Génération annexes & bulletins PDF',
    iuts: 'IUTS — Impôt sur salaires',
    ros: 'ROS — CNSS',
    tpa: 'TPA — Taxe patronale',
    rsfon: 'RSFON — Loyers',
    rslib: 'RSLIB — Libéralités',
    rsetr: 'RSETR — Prestataires étrangers',
    rspre: 'RSPRE — Prestataires résidents',
    rstva: 'RSTVA — Retenues TVA',
    tva: 'TVA',
    prel: 'Prélèvements supportés',
};

/** Sous-navigation « Déclarations et annexes » (menu principal unifié). */
export const DECLARATIONS_SUBNAV: {
    to: string;
    code: string;
    label: string;
    badge: 'none' | 'num' | 'arrow';
}[] = [
    { to: '/declarations/iuts', code: 'iuts', label: 'IUTS', badge: 'num' },
    { to: '/declarations/ros', code: 'ros', label: 'ROS / CNSS', badge: 'arrow' },
    { to: '/declarations/tpa', code: 'tpa', label: 'TPA Patronale', badge: 'arrow' },
    { to: '/declarations/rsfon', code: 'rsfon', label: 'RSFON (Loyers)', badge: 'num' },
    { to: '/declarations/rslib', code: 'rslib', label: 'RSLIB (Libéralités)', badge: 'num' },
    { to: '/declarations/rsetr', code: 'rsetr', label: 'RSETR (Étrangers)', badge: 'num' },
    { to: '/declarations/rspre', code: 'rspre', label: 'RSPRE (Résidents)', badge: 'num' },
    { to: '/declarations/rstva', code: 'rstva', label: 'RSTVA (TVA source)', badge: 'num' },
    { to: '/declarations/tva', code: 'tva', label: 'TVA', badge: 'num' },
    { to: '/declarations/prel', code: 'prel', label: 'Prélèvements', badge: 'num' },
    { to: '/declarations/generer', code: 'generer', label: 'Générer PDF', badge: 'none' },
];
