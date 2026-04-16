/* =====================================================
   FISCA — Moteur de calcul fiscal (Burkina Faso CGI 2025)
   IUTS · TPA · CNSS / CARFO · IRF · IRCM · RAS
   IS/IBICA · CME · TVA · Patentes · Personnel
   Référence légale : Code Général des Impôts 2025
   ===================================================== */

/* ─────────────────────────────────────────────────────
   BARÈME IUTS MENSUEL (CGI 2025 — Art. 112)
   7 tranches, taux max 25 %
   ───────────────────────────────────────────────────── */
const IUTS_TRANCHES = [
  { plafond:  30000,    taux: 0.0000 },  //      0 → 30 000 :   0 %
  { plafond:  50000,    taux: 0.1210 },  // 30 100 → 50 000 : 12,10 %
  { plafond:  80000,    taux: 0.1390 },  // 50 100 → 80 000 : 13,90 %
  { plafond: 120000,    taux: 0.1570 },  // 80 100 →120 000 : 15,70 %
  { plafond: 170000,    taux: 0.1840 },  //120 100 →170 000 : 18,40 %
  { plafond: 250000,    taux: 0.2170 },  //170 100 →250 000 : 21,70 %
  { plafond: Infinity,  taux: 0.2500 },  //250 100 +        : 25,00 %
];

/* Abattement familial (CGI 2025 — Art. 113) :
   réduction en % sur l'IUTS calculé
   (max 4 charges prises en compte)             */
const IUTS_ABATT_FAM = {
  0: 0.00,
  1: 0.08,  // 8 %
  2: 0.10,  // 10 %
  3: 0.12,  // 12 %
  4: 0.14,  // 14 %
};

/* Abattement forfaitaire (CGI 2025 — Art. 111) */
const IUTS_ABATT_FORFAIT = {
  CADRE:      0.20,   // Catégories supérieures (P, A, B / 6, 1, 2)
  NON_CADRE:  0.25,   // Autres employés
};

/* ─────────────────────────────────────────────────────
   PARAMÈTRES GÉNÉRAUX
   ───────────────────────────────────────────────────── */
const PARAMS = {
  /* Cotisations sociales salariales */
  CNSS_TAUX:        0.055,   // Part salariale CNSS
  CNSS_PLAFOND:     600000,  // Plafond mensuel
  CARFO_TAUX:       0.06,    // Part salariale CARFO (fonctionnaires)
  CARFO_PLAFOND:    600000,
  /* Taxe Patronale et d'Apprentissage (CGI 2025 — Art. 229) */
  TPA_TAUX:         0.03,    // 3 %
  /* Exonérations IUTS (plafonds mensuels) */
  EXO_LOGEMENT:     75000,
  EXO_TRANSPORT:    30000,
  EXO_FONCTION:     50000,
  /* Retenue 1 % personnel (Excel feuille Personnel) */
  PERSONNEL_TAUX:   0.01,
  /* Limites charges de famille */
  MAX_CHARGES:      4,
};

/* ─────────────────────────────────────────────────────
   ÉTAT GLOBAL APPLICATION
   ───────────────────────────────────────────────────── */
const STATE = {
  mois: 'Avril',
  annee: 2026,
  cotisation: 'CNSS',      // 'CNSS' | 'CARFO'
  rapportUnlocked: false,
  rapportRef: null,
  company: {
    nom:      'SK SARL',
    ifu:      '0012345BF',
    rc:       'BF-OUA-2019-B-0045',
    secteur:  'Commerce général',
    adresse:  'Ouagadougou, Secteur 15, Burkina Faso',
    tel:      '+226 70 00 00 00',
  },
  employees: [
    { nom: 'SAWADOGO Koffi',   cat: 'Cadre',     charges: 2, base: 350000, anciennete: 17500, heures: 0,     logement: 75000, transport: 30000, fonction: 50000 },
    { nom: 'OUEDRAOGO Awa',    cat: 'Non-cadre', charges: 1, base: 120000, anciennete: 6000,  heures: 0,     logement: 30000, transport: 15000, fonction: 0     },
    { nom: 'KONE Moussa',      cat: 'Cadre',     charges: 3, base: 280000, anciennete: 14000, heures: 12000, logement: 60000, transport: 30000, fonction: 40000 },
    { nom: 'TRAORE Fatoumata', cat: 'Non-cadre', charges: 0, base: 95000,  anciennete: 4750,  heures: 0,     logement: 20000, transport: 15000, fonction: 0     },
    { nom: 'ZONGO Pierre',     cat: 'Non-cadre', charges: 2, base: 80000,  anciennete: 4000,  heures: 5000,  logement: 15000, transport: 10000, fonction: 0     },
    { nom: 'DIALLO Hawa',      cat: 'Non-cadre', charges: 1, base: 110000, anciennete: 5500,  heures: 0,     logement: 25000, transport: 15000, fonction: 0     },
    { nom: 'BAMBARA Issouf',   cat: 'Cadre',     charges: 4, base: 200000, anciennete: 10000, heures: 0,     logement: 50000, transport: 30000, fonction: 30000 },
    { nom: 'YAMEOGO Salimata', cat: 'Non-cadre', charges: 0, base: 70000,  anciennete: 3500,  heures: 0,     logement: 10000, transport: 10000, fonction: 0     },
  ],
  historique: [
    { periode: 'Janvier 2026',  nb: 8, brut: 1275000, iuts: 238200, tpa: 38250, cnss: 122100, total: 398550, date: '31 jan. 2026', statut: 'ok',       ref: 'FISCA-202601-4412' },
    { periode: 'Février 2026',  nb: 8, brut: 1275000, iuts: 248500, tpa: 38250, cnss: 127600, total: 414350, date: '28 fév. 2026', statut: 'ok',       ref: 'FISCA-202602-8841' },
    { periode: 'Mars 2026',     nb: 8, brut: 0,       iuts: 0,      tpa: 0,     cnss: 0,      total: 0,      date: '—',            statut: 'retard',   ref: null },
    { periode: 'Avril 2026',    nb: 3, brut: 0,       iuts: 0,      tpa: 0,     cnss: 0,      total: 0,      date: '—',            statut: 'en_cours', ref: null },
  ],
};

/* =====================================================
   FONCTIONS DE CALCUL — IUTS / TPA / CNSS
   ===================================================== */

/**
 * IUTS brut sur base imposable (tranches progressives CGI 2025 Art. 112)
 * @param {number} baseImp — base imposable mensuelle
 * @returns {number} IUTS brut arrondi
 */
function calcIUTS(baseImp) {
  let impot = 0;
  let prev  = 0;
  for (const t of IUTS_TRANCHES) {
    if (baseImp <= prev) break;
    const tranche = Math.min(baseImp, t.plafond) - prev;
    impot += tranche * t.taux;
    prev   = t.plafond;
    if (!isFinite(t.plafond)) break;
  }
  return Math.round(impot);
}

/**
 * Abattement forfaitaire selon catégorie (CGI 2025 Art. 111)
 * @param {'Cadre'|string} categorie
 * @returns {number} taux (0.20 ou 0.25)
 */
function getTauxAbattForfait(categorie) {
  const cat = (categorie || '').toLowerCase();
  // Cadres : catégories P, A, B / 6, 1, 2 du secteur public
  return (cat === 'cadre' || cat === 'p' || cat === 'a' || cat === 'b')
    ? IUTS_ABATT_FORFAIT.CADRE
    : IUTS_ABATT_FORFAIT.NON_CADRE;
}

/**
 * Abattement familial (CGI 2025 Art. 113) :
 * réduction en % sur l'IUTS brut
 * @param {number} iutsBrut
 * @param {number} charges  — nombre de charges (max 4)
 * @returns {number} montant de l'abattement familial
 */
function calcAbattFamilial(iutsBrut, charges) {
  const n    = Math.max(0, Math.min(Math.round(charges || 0), PARAMS.MAX_CHARGES));
  const taux = IUTS_ABATT_FAM[n] || 0;
  return Math.round(iutsBrut * taux);
}

/**
 * Calcul complet pour un employé
 * @param {Object} e   — employé
 * @param {'CNSS'|'CARFO'} [cotisationType]
 * @returns {Object}   — tous les détails fiscaux
 */
function calcEmploye(e, cotisationType) {
  const coType   = cotisationType || STATE.cotisation;
  const salBase  = +e.base        || 0;
  const anc      = +e.anciennete  || 0;
  const heurSup  = +e.heures      || 0;
  const indLog   = +e.logement    || 0;
  const indTrans = +e.transport   || 0;
  const indFonct = +e.fonction    || 0;
  const charges  = Math.min(+(e.charges || 0), PARAMS.MAX_CHARGES);
  const categorie= e.cat || 'Non-cadre';

  /* Rémunération brute totale */
  const remBrute = salBase + anc + heurSup + indLog + indTrans + indFonct;

  /* Cotisation sociale salariale (base plafonnée) */
  const taux    = coType === 'CARFO' ? PARAMS.CARFO_TAUX    : PARAMS.CNSS_TAUX;
  const plafond = coType === 'CARFO' ? PARAMS.CARFO_PLAFOND : PARAMS.CNSS_PLAFOND;
  const baseCot = Math.min(remBrute, plafond);
  const cotSoc  = Math.round(baseCot * taux);

  /* TPA patronale (3 %) */
  const tpa     = Math.round(remBrute * PARAMS.TPA_TAUX);

  /* Exonérations plafonnées */
  const exoLog   = Math.min(indLog,   PARAMS.EXO_LOGEMENT);
  const exoTrans = Math.min(indTrans, PARAMS.EXO_TRANSPORT);
  const exoFonct = Math.min(indFonct, PARAMS.EXO_FONCTION);
  const totalExo = exoLog + exoTrans + exoFonct;

  /* Abattement forfaitaire (CGI 2025 Art. 111) :
     25 % non-cadres, 20 % cadres — sur salaire de base */
  const tauxForf  = getTauxAbattForfait(categorie);
  const abattForf = Math.round(salBase * tauxForf);

  /* Salaire net imposable */
  const sni       = remBrute - totalExo - cotSoc;

  /* Base imposable = SNI − abattement forfaitaire */
  const baseImp   = Math.max(0, sni - abattForf);

  /* IUTS brut (tranches progressives CGI 2025) */
  const iutsBrut  = calcIUTS(baseImp);

  /* Abattement familial (CGI 2025 Art. 113) :
     % réduction sur IUTS brut selon nb charges */
  const abattFam  = calcAbattFamilial(iutsBrut, charges);
  const iutsNet   = Math.max(0, iutsBrut - abattFam);

  /* Retenue 1 % personnel sur salaire net */
  const netAvantPersonnel = remBrute - iutsNet - cotSoc;
  const retPersonnel      = Math.round(netAvantPersonnel * PARAMS.PERSONNEL_TAUX);
  const netAPayer         = netAvantPersonnel - retPersonnel;

  return {
    remBrute, cotSoc, tpa,
    exoLog, exoTrans, exoFonct, totalExo,
    tauxForf, abattForf,
    sni, baseImp,
    iutsBrut, abattFam, iutsNet,
    retPersonnel, netAPayer,
  };
}

/**
 * Agrégat sur tous les employés
 * @returns {Object}
 */
function calcTotaux() {
  let totBrut = 0, totCotSoc = 0, totTpa = 0, totExo = 0;
  let totBase = 0, totIutsBrut = 0, totAbattFam = 0, totIutsNet = 0, totNet = 0;
  let totPersonnel = 0;

  STATE.employees.forEach(e => {
    const r = calcEmploye(e);
    totBrut      += r.remBrute;
    totCotSoc    += r.cotSoc;
    totTpa       += r.tpa;
    totExo       += r.totalExo;
    totBase      += r.baseImp;
    totIutsBrut  += r.iutsBrut;
    totAbattFam  += r.abattFam;
    totIutsNet   += r.iutsNet;
    totNet       += r.netAPayer;
    totPersonnel += r.retPersonnel;
  });

  return {
    totBrut, totCotSoc, totTpa, totExo,
    totBase, totIutsBrut, totAbattFam, totIutsNet, totNet,
    totPersonnel,
  };
}

/* ─────────────────────────────────────────────────────
   Formatage monétaire
   ───────────────────────────────────────────────────── */
const fmt        = n => Number(n).toLocaleString('fr-BF') + ' FCFA';
const fmtN       = n => Number(n).toLocaleString('fr-BF');
const periodeLabel = () => `${STATE.mois} ${STATE.annee}`;

/* =====================================================
   TVA — Taxe sur la Valeur Ajoutée (CGI 2025 — Art. 317)
   ===================================================== */

const TVA_PARAMS = {
  TAUX:              0.18,   // Taux standard BF
  TAUX_HOTELLERIE:   0.10,   // Hébergement/restauration hôtels agréés + transport aérien national
  SEUIL_ASSUJETTI: 50000000, // CA annuel ≥ 50 M FCFA ⇒ assujetti TVA
};

/**
 * Calcule la TVA sur un montant HT
 * @param {number} montantHT
 * @param {number} [taux]  — défaut 18 %
 * @returns {{ ht, tva, ttc }}
 */
function calcTVA(montantHT, taux) {
  const t   = (taux !== undefined ? taux : TVA_PARAMS.TAUX);
  const ht  = +montantHT || 0;
  const tva = Math.round(ht * t);
  return { ht, tva, ttc: ht + tva };
}

/**
 * Extrait le HT depuis un montant TTC
 * @param {number} montantTTC
 * @param {number} [taux]
 * @returns {{ ht, tva, ttc }}
 */
function calcTVAFromTTC(montantTTC, taux) {
  const t   = (taux !== undefined ? taux : TVA_PARAMS.TAUX);
  const ttc = +montantTTC || 0;
  const ht  = Math.round(ttc / (1 + t));
  const tva = ttc - ht;
  return { ht, tva, ttc };
}

/**
 * Calcule le solde TVA d'une période
 * @param {Array<{type:'collecte'|'deductible', montantHT:number, taux?:number}>} lignes
 * @returns {{ collectee, deductible, solde, aRembourser, aVerser }}
 */
function calcSoldeTVA(lignes) {
  let collectee  = 0;
  let deductible = 0;
  (lignes || []).forEach(l => {
    const { tva } = calcTVA(l.montantHT, l.taux);
    if (l.type === 'collecte') collectee  += tva;
    else                       deductible += tva;
  });
  const solde = collectee - deductible;
  return {
    collectee:   Math.round(collectee),
    deductible:  Math.round(deductible),
    solde:       Math.round(solde),
    aVerser:     Math.max(0,  Math.round(solde)),
    aRembourser: Math.max(0, -Math.round(solde)),
  };
}

/* =====================================================
   RAS — Retenue À la Source (CGI 2025 — Art. 206–226)
   ===================================================== */

/**
 * Clés de taux :
 *   RESIDENT_IFU         → 5 %  (prestataire résident avec IFU, art. 207)
 *   RESIDENT_IFU_IMMO    → 1 %  (travaux immobiliers/TP avec IFU, art. 207)
 *   RESIDENT_SANS_IFU    → 25 % (prestataire non salarié sans IFU, art. 207)
 *   TRAVAIL_TEMPORAIRE   → 2 %  (entreprises travail temporaire, art. 207)
 *   NON_RESIDENT         → 20 % (prestataire non-résident, art. 212)
 *   NON_RESIDENT_CEDEAO  → 10 % (transport routier CEDEAO sans justif, art. 212)
 *   NONDETER_VACATION    → 2 %  (vacations enseign. / prestations manuelles, art. 221)
 *   NONDETER_PUBLIC      → 5 %  (entités publiques/parapubliques, art. 221)
 *   NONDETER_SALARIE     → 10 % (personnes physiques salariées + prestations intellectuelles, art. 221)
 *   COMMANDE_PUBLIQUE    → 5 %  (commandes publiques régime réel / CME, art. 226-1)
 *   COMMANDE_PUB_BIENS   → 1 %  (fournitures/travaux immobiliers commandes publiques, art. 226-1)
 */
const RAS_PARAMS = {
  RESIDENT_IFU:          0.05,
  RESIDENT_IFU_IMMO:     0.01,
  RESIDENT_SANS_IFU:     0.25,
  TRAVAIL_TEMPORAIRE:    0.02,
  NON_RESIDENT:          0.20,
  NON_RESIDENT_CEDEAO:   0.10,
  NONDETER_VACATION:     0.02,
  NONDETER_PUBLIC:       0.05,
  NONDETER_SALARIE:      0.10,
  COMMANDE_PUBLIQUE:     0.05,
  COMMANDE_PUB_BIENS:    0.01,
  SEUIL_IMPOSITION:      50000,  // < 50 000 FCFA HT ⇒ pas de RAS (art. 206)
};

/**
 * Calcule la RAS sur un montant HT
 * @param {number} montantHT     — montant hors taxes
 * @param {string} typeKey       — clé dans RAS_PARAMS
 * @returns {{ ht, ras, net, taux, exonere }}
 */
function calcRAS(montantHT, typeKey) {
  const ht    = +montantHT || 0;
  const taux  = RAS_PARAMS[typeKey] || RAS_PARAMS.RESIDENT_IFU;
  // Exonération sous le seuil (sauf non-résidents et non-déterminés)
  const exoSeuil = ['NON_RESIDENT','NON_RESIDENT_CEDEAO','NONDETER_VACATION',
                    'NONDETER_PUBLIC','NONDETER_SALARIE'];
  const exonere  = !exoSeuil.includes(typeKey) && ht < RAS_PARAMS.SEUIL_IMPOSITION;
  const ras      = exonere ? 0 : Math.round(ht * taux);
  return { ht, ras, net: ht - ras, taux, exonere };
}

/**
 * Total RAS sur un tableau de lignes
 * @param {Array<{montantHT:number, type:string}>} lignes
 * @returns {{ totalHT, totalRas, totalNet }}
 */
function calcTotalRAS(lignes) {
  let totalHT = 0, totalRas = 0, totalNet = 0;
  (lignes || []).forEach(l => {
    const r = calcRAS(l.montantHT || l.montantBrut, l.type);
    totalHT  += r.ht;
    totalRas += r.ras;
    totalNet += r.net;
  });
  return {
    totalHT:  Math.round(totalHT),
    totalRas: Math.round(totalRas),
    totalNet: Math.round(totalNet),
  };
}

/* =====================================================
   IRF — Impôt sur les Revenus Fonciers (CGI 2025 — Art. 121–126)
   ===================================================== */

/**
 * Barème IRF (Art. 125-126) :
 *   - Abattement 50 % sur loyer brut (Art. 124)
 *   - 18 % sur la base nette 0–100 000 FCFA/mois
 *   - 25 % sur la base nette > 100 000 FCFA/mois
 */
const IRF_PARAMS = {
  ABATTEMENT:       0.50,    // 50 % d'abattement sur loyer brut
  TAUX_TRANCHE1:    0.18,    // 18 % jusqu'à 100 000 F (base nette)
  SEUIL_TRANCHE2:   100000,  // Seuil bascule tranche 2
  TAUX_TRANCHE2:    0.25,    // 25 % au-delà de 100 000 F
};

/**
 * Calcule l'IRF sur un loyer brut mensuel
 * @param {number} loyerBrut  — loyer mensuel brut FCFA
 * @returns {{ loyerBrut, abattement, baseNette, irf1, irf2, irfTotal, loyerNet }}
 */
function calcIRF(loyerBrut) {
  const brut       = +loyerBrut || 0;
  const abattement = Math.round(brut * IRF_PARAMS.ABATTEMENT);
  const baseNette  = brut - abattement;

  let irf1 = 0, irf2 = 0;
  if (baseNette <= IRF_PARAMS.SEUIL_TRANCHE2) {
    irf1 = Math.round(baseNette * IRF_PARAMS.TAUX_TRANCHE1);
  } else {
    irf1 = Math.round(IRF_PARAMS.SEUIL_TRANCHE2 * IRF_PARAMS.TAUX_TRANCHE1);
    irf2 = Math.round((baseNette - IRF_PARAMS.SEUIL_TRANCHE2) * IRF_PARAMS.TAUX_TRANCHE2);
  }
  const irfTotal = irf1 + irf2;
  return {
    loyerBrut: brut,
    abattement,
    baseNette,
    irf1, irf2,
    irfTotal,
    loyerNet: brut - irfTotal,
    tauxEffectif: brut > 0 ? Math.round((irfTotal / brut) * 10000) / 100 : 0,
  };
}

/**
 * IRF annuel (12 mois ou loyer annuel)
 * @param {number} loyerMensuel
 * @returns {Object}
 */
function calcIRFAnnuel(loyerMensuel) {
  const m = calcIRF(loyerMensuel);
  return {
    ...m,
    irfAnnuel:   m.irfTotal * 12,
    loyerAnnuel: m.loyerBrut * 12,
  };
}

/* =====================================================
   IRCM — Impôt sur le Revenu des Capitaux Mobiliers
   (CGI 2025 — Art. 140)
   ===================================================== */

/**
 * Taux IRCM par type de revenu (Art. 140) :
 *   CREANCES   → 25 % (intérêts, dépôts, comptes courants)
 *   OBLIGATIONS → 6 % (obligations émises au Burkina Faso)
 *   DIVIDENDES → 12,5 % (autres produits : dividendes, actions, etc.)
 */
const IRCM_PARAMS = {
  CREANCES:    0.25,   // revenus des créances, produits non spécifiés
  OBLIGATIONS: 0.06,   // intérêts d'obligations émises au BF
  DIVIDENDES:  0.125,  // dividendes et autres produits des valeurs mobilières
};

/**
 * Calcule l'IRCM
 * @param {number} montantBrut
 * @param {'CREANCES'|'OBLIGATIONS'|'DIVIDENDES'} type
 * @returns {{ brut, ircm, net, taux }}
 */
function calcIRCM(montantBrut, type) {
  const taux = IRCM_PARAMS[type] || IRCM_PARAMS.CREANCES;
  const brut = +montantBrut || 0;
  const ircm = Math.round(brut * taux);
  return { brut, ircm, net: brut - ircm, taux };
}

/* =====================================================
   IS / IBICA — Impôt sur les Sociétés / Bénéfices
   (CGI 2025 — Art. 42 ss.)
   Minimum forfaitaire de perception (MFP)
   ===================================================== */

const IS_PARAMS = {
  TAUX_IS:             0.275,  // IS standard 27,5 %
  TAUX_IBICA:          0.275,  // IBICA (même taux)
  MFP_TAUX:            0.005,  // Minimum forfaitaire 0,5 % du CA HT
  MFP_MIN_RNI:       1000000,  // Min forfaitaire RNI : 1 000 000 FCFA
  MFP_MIN_RSI:        300000,  // Min forfaitaire RSI : 300 000 FCFA
  /* Réductions CGA (Art. 196) */
  CGA_REDUCTION_IS:    0.30,   // Réduction IS adhérents CGA : -30 %
  CGA_REDUCTION_MFP:   0.50,   // Réduction MFP adhérents CGA : -50 %
  CGA_REDUCTION_TPA:   0.20,   // Réduction TPA adhérents CGA : -20 %
};

/**
 * Calcule le Minimum Forfaitaire de Perception
 * @param {number} chiffreAffaireHT
 * @param {'RNI'|'RSI'} regime
 * @param {boolean} [adhesionCGA]
 * @returns {{ ca, mfpCalcule, mfpMinimum, mfpDu }}
 */
function calcMFP(chiffreAffaireHT, regime, adhesionCGA) {
  const ca          = +chiffreAffaireHT || 0;
  const mfpCalcule  = Math.round(ca * IS_PARAMS.MFP_TAUX);
  const minimum     = regime === 'RSI' ? IS_PARAMS.MFP_MIN_RSI : IS_PARAMS.MFP_MIN_RNI;
  let   mfpDu       = Math.max(mfpCalcule, minimum);
  if (adhesionCGA) mfpDu = Math.round(mfpDu * (1 - IS_PARAMS.CGA_REDUCTION_MFP));
  return { ca, mfpCalcule, mfpMinimum: minimum, mfpDu };
}

/**
 * Calcule l'IS / IBICA théorique sur un bénéfice imposable
 * @param {number} beneficeImposable
 * @param {boolean} [adhesionCGA]
 * @returns {{ benefice, is, isNet }}
 */
function calcIS(beneficeImposable, adhesionCGA) {
  const benefice = +beneficeImposable || 0;
  let   is       = Math.round(benefice * IS_PARAMS.TAUX_IS);
  if (adhesionCGA) is = Math.round(is * (1 - IS_PARAMS.CGA_REDUCTION_IS));
  return { benefice, is, isNet: is };
}

/* =====================================================
   CME — Contribution des Micro-Entreprises
   (CGI 2025 — Art. 533 ss.)
   Tarif fixe par Zone × Classe d'activité
   ===================================================== */

/**
 * Matrice CME : tarif annuel en FCFA
 * Zone A = Ouagadougou + Bobo-Dioulasso
 * Zone B = Autres chefs-lieux de région
 * Zone C = Chefs-lieux de province
 * Zone D = Reste du territoire
 * Classe 1 = CA le plus élevé … Classe 8 = CA le plus faible
 */
const CME_TARIFS = {
  A: [200000, 160000, 120000,  80000,  60000,  30000,  20000,  10000],
  B: [160000, 120000,  80000,  60000,  42000,  20000,  12000,   6000],
  C: [120000,  80000,  54000,  42000,  30000,  12000,   9000,   2500],
  D: [ 80000,  48000,  30000,  18000,  14000,   6000,   3500,   2000],
};

/**
 * Tranches CA pour déterminer la classe CME (régime déclaratif)
 * Index 0 = classe 8 (plus faible CA), index 7 = classe 1
 */
const CME_TRANCHES_CA = [
  { max:  1500000, classe: 8 },  //       0 →  1,5 M
  { max:  3000000, classe: 7 },  //  1,5 M →  3 M
  { max:  5000000, classe: 6 },  //  3 M   →  5 M
  { max:  7000000, classe: 5 },  //  5 M   →  7 M
  { max:  9000000, classe: 4 },  //  7 M   →  9 M
  { max: 11000000, classe: 3 },  //  9 M   → 11 M
  { max: 13000000, classe: 2 },  // 11 M   → 13 M
  { max: 15000000, classe: 1 },  // 13 M   → 15 M
];

/**
 * Détermine la classe CME selon le CA annuel
 * @param {number} chiffreAffaire
 * @returns {number} classe 1–8
 */
function getClasseCME(chiffreAffaire) {
  const ca = +chiffreAffaire || 0;
  for (const t of CME_TRANCHES_CA) {
    if (ca <= t.max) return t.classe;
  }
  return 1; // Au-delà de 15 M : classe 1 (tarif max)
}

/**
 * Calcule la CME annuelle
 * @param {number} chiffreAffaire
 * @param {'A'|'B'|'C'|'D'} zone
 * @param {boolean} [adhesionCGA]  — réduction 25 % si adhérent CGA (Art. 197)
 * @returns {{ ca, zone, classe, cme, cmeNet }}
 */
function calcCME(chiffreAffaire, zone, adhesionCGA) {
  const ca      = +chiffreAffaire || 0;
  const z       = (zone || 'A').toUpperCase();
  const classe  = getClasseCME(ca);
  const tarifs  = CME_TARIFS[z] || CME_TARIFS.A;
  // Classe 1 (CA le + élevé) → index 0 → tarif le + haut
  // Classe 8 (CA le + faible) → index 7 → tarif le + bas
  let   cme     = tarifs[classe - 1];
  let cmeNet = cme;
  if (adhesionCGA) cmeNet = Math.round(cme * 0.75);  // -25 % CGA (Art. 197)
  return { ca, zone: z, classe, cme, cmeNet };
}

/* =====================================================
   PATENTES — Contribution des Patentes
   (CGI 2025 — Art. 237–240)
   ===================================================== */

/**
 * Tableau A — Droit fixe général (Art. 239)
 * Basé sur le CA HT de l'exercice précédent
 */
const PATENTE_TABLEAU_A = [
  { max:   5000000, droit:  10000 },
  { max:   7000000, droit:  15000 },
  { max:  10000000, droit:  25000 },
  { max:  15000000, droit:  40000 },
  { max:  20000000, droit:  60000 },
  { max:  30000000, droit:  85000 },
  { max:  50000000, droit: 125000 },
  { max:  75000000, droit: 175000 },
  { max: 100000000, droit: 250000 },
  { max: 150000000, droit: 325000 },
  { max: 200000000, droit: 400000 },
  // > 200 M : 400 000 + 100 000 par tranche de 100 M supplémentaires
];

/**
 * Tableau B — Professions libérales (Art. 239)
 */
const PATENTE_TABLEAU_B = [
  { max:   1000000, droit:  25000 },
  { max:   3000000, droit:  35000 },
  { max:   5000000, droit:  50000 },
  { max:  10000000, droit: 100000 },
  // > 10 M : voir barème complet
];

/**
 * Calcule le droit fixe de patente
 * @param {number} chiffreAffaireHT
 * @param {'A'|'B'} [tableau]  — A=général, B=professions libérales
 * @returns {{ ca, droitFixe }}
 */
function calcPatenteDroitFixe(chiffreAffaireHT, tableau) {
  const ca  = +chiffreAffaireHT || 0;
  const tab = tableau === 'B' ? PATENTE_TABLEAU_B : PATENTE_TABLEAU_A;

  for (const t of tab) {
    if (ca <= t.max) return { ca, droitFixe: t.droit };
  }
  // Au-delà du dernier palier tableau A (> 200 M)
  const excedent   = Math.ceil((ca - 200000000) / 100000000);
  const droitFixe  = 400000 + excedent * 100000;
  return { ca, droitFixe };
}

/**
 * Droit proportionnel (Art. 240) : % de la valeur locative des locaux
 * Le taux est déterminé par arrêté — valeur généralement 16 %
 * @param {number} valeurLocative  — valeur locative annuelle des locaux
 * @param {number} [taux]          — défaut 0.16
 * @returns {{ valeurLocative, droitProp }}
 */
function calcPatenteDroitProp(valeurLocative, taux) {
  const vl    = +valeurLocative || 0;
  const t     = taux !== undefined ? taux : 0.16;
  return { valeurLocative: vl, droitProp: Math.round(vl * t) };
}

/**
 * Patente totale (droit fixe + droit proportionnel)
 * @param {number} ca
 * @param {number} valeurLocative
 * @param {'A'|'B'} [tableau]
 * @param {number} [tauxProp]
 * @returns {Object}
 */
function calcPatente(ca, valeurLocative, tableau, tauxProp) {
  const { droitFixe } = calcPatenteDroitFixe(ca, tableau);
  const { droitProp } = calcPatenteDroitProp(valeurLocative, tauxProp);
  return {
    ca,
    valeurLocative: +valeurLocative || 0,
    droitFixe,
    droitProp,
    total: droitFixe + droitProp,
  };
}

/* =====================================================
   CNSS PATRONAL — Cotisations employeur
   ===================================================== */

const CNSS_PAT_PARAMS = {
  TAUX_FAMILLE:   0.055,  // Prestations familiales (patronal)
  TAUX_ACCIDENT:  0.012,  // Accidents du travail (taux moyen)
  TAUX_RETRAITE:  0.16,   // Vieillesse / retraite (patronal)
  PLAFOND:        600000,
  CARFO_PAT_TAUX: 0.077,
  CARFO_PLAFOND:  600000,
};

/**
 * Cotisations patronales CNSS pour un employé
 * @param {number} remBrute
 * @param {'CNSS'|'CARFO'} [regime]
 * @returns {{ baseCot, famille, accident, retraite, totalPat, carfo }}
 */
function calcCNSSPatronal(remBrute, regime) {
  const base     = Math.min(+remBrute || 0, CNSS_PAT_PARAMS.PLAFOND);
  const famille  = Math.round(base * CNSS_PAT_PARAMS.TAUX_FAMILLE);
  const accident = Math.round(base * CNSS_PAT_PARAMS.TAUX_ACCIDENT);
  const retraite = Math.round(base * CNSS_PAT_PARAMS.TAUX_RETRAITE);
  const totalPat = famille + accident + retraite;

  const baseCarfo = Math.min(+remBrute || 0, CNSS_PAT_PARAMS.CARFO_PLAFOND);
  const carfo     = regime === 'CARFO' ? Math.round(baseCarfo * CNSS_PAT_PARAMS.CARFO_PAT_TAUX) : 0;

  return { baseCot: base, famille, accident, retraite, totalPat, carfo };
}

/**
 * Coût total employeur (tous prélèvements patronaux)
 * @param {Object} e
 * @param {'CNSS'|'CARFO'} [cotisationType]
 * @returns {Object}
 */
function calcCoutEmployeur(e, cotisationType) {
  const coType   = cotisationType || STATE.cotisation;
  const calc     = calcEmploye(e, coType);
  const pat      = calcCNSSPatronal(calc.remBrute, coType);

  const tpa          = calc.tpa;
  const cnssPatron   = pat.totalPat;
  const carfoPatron  = pat.carfo;
  const coutTotal    = calc.remBrute + tpa + cnssPatron + carfoPatron;
  const ratio        = calc.remBrute > 0
    ? Math.round((coutTotal / calc.remBrute) * 100) / 100
    : 0;

  return {
    remBrute:      calc.remBrute,
    netAPayer:     calc.netAPayer,
    iutsNet:       calc.iutsNet,
    cotSocSal:     calc.cotSoc,
    retPersonnel:  calc.retPersonnel,
    tpa,
    cnssPatronal:  cnssPatron,
    carfoPatronal: carfoPatron,
    coutTotal,
    coutTotalParRapportBrut: ratio,
  };
}

/**
 * Agrégat coût employeur — tous les employés
 * @returns {Object}
 */
function calcCoutEmployeurTotal() {
  let totalBrut = 0, totalTpa = 0, totalCNSSPat = 0, totalCout = 0;

  STATE.employees.forEach(e => {
    const r   = calcCoutEmployeur(e);
    totalBrut    += r.remBrute;
    totalTpa     += r.tpa;
    totalCNSSPat += r.cnssPatronal + r.carfoPatronal;
    totalCout    += r.coutTotal;
  });

  return {
    totalBrut:          Math.round(totalBrut),
    totalTpa:           Math.round(totalTpa),
    totalCNSSPat:       Math.round(totalCNSSPat),
    totalCoutEmployeur: Math.round(totalCout),
  };
}

/* =====================================================
   SIMULATEUR — Projection et comparaison de scénarios
   ===================================================== */

/**
 * Simule le profil fiscal complet d'un employé
 * @param {Object} params
 * @param {'CNSS'|'CARFO'} [regime]
 * @returns {Object}
 */
function simulerEmploye(params, regime) {
  const coType = regime || STATE.cotisation;
  const calc   = calcEmploye(params, coType);
  const cout   = calcCoutEmployeur(params, coType);

  const tauxEffectif = calc.remBrute > 0
    ? Math.round((calc.iutsNet / calc.remBrute) * 10000) / 100
    : 0;

  const pressionFiscale = cout.coutTotal > 0
    ? Math.round(
        ((cout.iutsNet + cout.cotSocSal + cout.cnssPatronal + cout.tpa)
         / cout.coutTotal) * 10000
      ) / 100
    : 0;

  return {
    ...calc,
    ...cout,
    tauxEffectif,
    pressionFiscale,
  };
}

/**
 * Compare deux scénarios salariaux (A/B)
 * @param {Object} scenarioA
 * @param {Object} scenarioB
 * @returns {{ a, b, delta }}
 */
function comparerScenarios(scenarioA, scenarioB) {
  const a = simulerEmploye(scenarioA);
  const b = simulerEmploye(scenarioB);
  return {
    a, b,
    delta: {
      remBrute:  b.remBrute  - a.remBrute,
      iutsNet:   b.iutsNet   - a.iutsNet,
      netAPayer: b.netAPayer - a.netAPayer,
      coutTotal: b.coutTotal - a.coutTotal,
    },
  };
}

/* =====================================================
   PÉNALITÉS DE RETARD (CGI 2025 — Art. 158–165)
   ===================================================== */

const PENALITE_PARAMS = {
  IUTS_TAUX_MOIS: 0.10,  // 10 % / mois de retard sur IUTS
  CNSS_TAUX_MOIS: 0.25,  // 25 % / mois de retard sur CNSS
  MAX_MOIS:       12,    // Plafonnement à 12 mois
};

/**
 * Pénalités de retard sur une période
 * @param {number} montantIuts
 * @param {number} montantCnss
 * @param {number} nbMoisRetard
 * @returns {Object}
 */
function calcPenalites(montantIuts, montantCnss, nbMoisRetard) {
  const n = Math.max(1, Math.min(Math.round(nbMoisRetard), PENALITE_PARAMS.MAX_MOIS));
  const penaliteIuts  = Math.round((+montantIuts || 0) * PENALITE_PARAMS.IUTS_TAUX_MOIS * n);
  const penaliteCnss  = Math.round((+montantCnss || 0) * PENALITE_PARAMS.CNSS_TAUX_MOIS * n);
  const totalPenalites = penaliteIuts + penaliteCnss;
  return {
    penaliteIuts,
    penaliteCnss,
    totalPenalites,
    montantTotal: (+montantIuts || 0) + (+montantCnss || 0) + totalPenalites,
    nbMoisRetard: n,
  };
}

/**
 * Pénalités pour toutes les périodes en retard
 * @param {Array}  historique
 * @param {Date}   [dateRef]
 * @returns {Array}
 */
function calcPenalitesHistorique(historique, dateRef) {
  const ref = dateRef || new Date();
  const MOIS_NOMS = [
    'Janvier','Février','Mars','Avril','Mai','Juin',
    'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
  ];
  return (historique || [])
    .filter(h => h.statut === 'retard' && h.iuts)
    .map(h => {
      const parts     = h.periode.split(' ');
      const moisIdx   = MOIS_NOMS.findIndex(m => m === parts[0]);
      const annee     = parseInt(parts[1]) || ref.getFullYear();
      const dateLimite = new Date(annee, moisIdx + 1, 15);
      const diffMs    = ref - dateLimite;
      const nbMois    = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30)));
      return { ...h, ...calcPenalites(h.iuts, h.cnss, nbMois) };
    });
}
