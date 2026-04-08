/* =====================================================
   FISCA — Moteur de calcul fiscal (Burkina Faso LF 2020)
   IUTS · TPA · CNSS / CARFO
   ===================================================== */

/* ----- BARÈME IUTS MENSUEL (art. 59-71 Code impôts) ----- */
const IUTS_TRANCHES = [
  { plafond: 30000,    taux: 0.00 },
  { plafond: 50000,    taux: 0.12 },
  { plafond: 80000,    taux: 0.14 },
  { plafond: 120000,   taux: 0.16 },
  { plafond: 170000,   taux: 0.18 },
  { plafond: 250000,   taux: 0.20 },
  { plafond: 400000,   taux: 0.24 },
  { plafond: 600000,   taux: 0.28 },
  { plafond: Infinity, taux: 0.30 },
];

/* ----- PARAMÈTRES FIXES LF 2020 ----- */
const PARAMS = {
  CNSS_TAUX:        0.055,   // Part salariale CNSS
  CNSS_PLAFOND:     600000,  // Plafond mensuel cotisation
  CARFO_TAUX:       0.06,    // Part salariale CARFO
  CARFO_PLAFOND:    600000,
  TPA_TAUX:         0.03,    // Taxe Patronale d'Apprentissage
  ABATT_FORFAIT:    0.20,    // Abattement forfaitaire salaire de base
  EXO_LOGEMENT:     75000,   // Exonération indemnité de logement
  EXO_TRANSPORT:    30000,   // Exonération indemnité de transport
  EXO_FONCTION:     50000,   // Exonération par indemnité de fonction
  ABATT_CHARGE:     1000,    // Abattement / charge / mois
  MAX_ABATT_FAM_P:  0.40,    // Max abattement familial = 40% IUTS brut
  MAX_CHARGES:      6,
};

/* ----- ÉTAT GLOBAL APPLICATION ----- */
const STATE = {
  mois: 'Avril',
  annee: 2026,
  cotisation: 'CNSS',   // 'CNSS' | 'CARFO'
  rapportUnlocked: false,
  rapportRef: null,
  company: {
    nom: 'SK SARL',
    ifu: '0012345BF',
    rc: 'BF-OUA-2019-B-0045',
    secteur: 'Commerce général',
    adresse: 'Ouagadougou, Secteur 15, Burkina Faso',
    tel: '+226 70 00 00 00',
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
    { periode: 'Janvier 2026',  nb: 8, brut: 1275000, iuts: 238200, tpa: 38250, cnss: 122100, total: 398550, date: '31 jan. 2026', statut: 'ok',      ref: 'FISCA-202601-4412' },
    { periode: 'Février 2026',  nb: 8, brut: 1275000, iuts: 248500, tpa: 38250, cnss: 127600, total: 414350, date: '28 fév. 2026', statut: 'ok',      ref: 'FISCA-202602-8841' },
    { periode: 'Mars 2026',     nb: 8, brut: 0,       iuts: 0,      tpa: 0,     cnss: 0,      total: 0,      date: '—',            statut: 'retard',  ref: null },
    { periode: 'Avril 2026',    nb: 3, brut: 0,       iuts: 0,      tpa: 0,     cnss: 0,      total: 0,      date: '—',            statut: 'en_cours',ref: null },
  ],
};

/* =====================================================
   FONCTIONS DE CALCUL
   ===================================================== */

/* Calcul IUTS brut sur base imposable (tranches progressives) */
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

/* Calcul complet pour un employé */
function calcEmploye(e, cotisationType) {
  const coType = cotisationType || STATE.cotisation;
  const salBase   = +e.base        || 0;
  const anc       = +e.anciennete  || 0;
  const heurSup   = +e.heures      || 0;
  const indLog    = +e.logement    || 0;
  const indTrans  = +e.transport   || 0;
  const indFonct  = +e.fonction    || 0;
  const charges   = Math.min(+(e.charges || 0), PARAMS.MAX_CHARGES);

  /* Rémunération brute totale */
  const remBrute = salBase + anc + heurSup + indLog + indTrans + indFonct;

  /* Cotisation sociale (base plafonnée) */
  const taux     = coType === 'CARFO' ? PARAMS.CARFO_TAUX    : PARAMS.CNSS_TAUX;
  const plafond  = coType === 'CARFO' ? PARAMS.CARFO_PLAFOND : PARAMS.CNSS_PLAFOND;
  const baseCot  = Math.min(remBrute, plafond);
  const cotSoc   = Math.round(baseCot * taux);

  /* TPA patronale */
  const tpa      = Math.round(remBrute * PARAMS.TPA_TAUX);

  /* Exonérations */
  const exoLog   = Math.min(indLog,   PARAMS.EXO_LOGEMENT);
  const exoTrans = Math.min(indTrans, PARAMS.EXO_TRANSPORT);
  const exoFonct = Math.min(indFonct, PARAMS.EXO_FONCTION);
  const totalExo = exoLog + exoTrans + exoFonct;

  /* Abattement forfaitaire 20% sur salaire de base */
  const abattForf = Math.round(salBase * PARAMS.ABATT_FORFAIT);

  /* Salaire net imposable */
  const sni       = remBrute - totalExo - cotSoc;

  /* Base imposable = SNI − abattement forfaitaire */
  const baseImp   = Math.max(0, sni - abattForf);

  /* IUTS brut (tranches) */
  const iutsBrut  = calcIUTS(baseImp);

  /* Abattement familial */
  const abattFam  = Math.min(
    charges * PARAMS.ABATT_CHARGE,
    Math.round(iutsBrut * PARAMS.MAX_ABATT_FAM_P)
  );
  const iutsNet   = Math.max(0, iutsBrut - abattFam);

  /* Net à payer salarié */
  const netAPayer = remBrute - iutsNet - cotSoc;

  return {
    remBrute, cotSoc, tpa, exoLog, exoTrans, exoFonct,
    totalExo, abattForf, sni, baseImp, iutsBrut, abattFam, iutsNet, netAPayer,
  };
}

/* Agrégat sur tous les employés */
function calcTotaux() {
  let totBrut = 0, totCotSoc = 0, totTpa = 0, totExo = 0;
  let totBase = 0, totIutsBrut = 0, totAbattFam = 0, totIutsNet = 0, totNet = 0;

  STATE.employees.forEach(e => {
    const r = calcEmploye(e);
    totBrut     += r.remBrute;
    totCotSoc   += r.cotSoc;
    totTpa      += r.tpa;
    totExo      += r.totalExo;
    totBase     += r.baseImp;
    totIutsBrut += r.iutsBrut;
    totAbattFam += r.abattFam;
    totIutsNet  += r.iutsNet;
    totNet      += r.netAPayer;
  });

  return { totBrut, totCotSoc, totTpa, totExo, totBase, totIutsBrut, totAbattFam, totIutsNet, totNet };
}

/* ----- Formatage monétaire ----- */
const fmt  = n => Number(n).toLocaleString('fr-BF') + ' FCFA';
const fmtN = n => Number(n).toLocaleString('fr-BF');
const periodeLabel = () => `${STATE.mois} ${STATE.annee}`;

/* =====================================================
   TVA — Taxe sur la Valeur Ajoutée (18 % BF)
   ===================================================== */

const TVA_PARAMS = {
  TAUX: 0.18,            // Taux standard Burkina Faso
  TAUX_REDUIT: 0.09,     // Taux réduit (non encore appliqué BF — réservé)
  SEUIL_ASSUJETTI: 50000000, // CA annuel >= 50 M FCFA => assujetti TVA
};

/**
 * Calcule la TVA sur un montant HT
 * @param {number} montantHT  — montant hors taxes
 * @param {number} [taux]     — taux (défaut 18 %)
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
 * @param {Array<{type:'collecte'|'deductible', montantHT:number, taux:number}>} lignes
 * @returns {{ collectee, deductible, solde, aRembourser, aVerser }}
 */
function calcSoldeTVA(lignes) {
  let collectee   = 0;
  let deductible  = 0;
  (lignes || []).forEach(l => {
    const { tva } = calcTVA(l.montantHT, l.taux);
    if (l.type === 'collecte')    collectee  += tva;
    else                          deductible += tva;
  });
  const solde      = collectee - deductible;
  return {
    collectee:   Math.round(collectee),
    deductible:  Math.round(deductible),
    solde:       Math.round(solde),
    aVerser:     Math.max(0,  Math.round(solde)),
    aRembourser: Math.max(0, -Math.round(solde)),
  };
}

/* =====================================================
   RAS — Retenue À la Source (art. 100-115 Code impôts BF)
   ===================================================== */

const RAS_PARAMS = {
  PHYSIQUE:          0.20,  // Prestataire personne physique
  MORALE_RESIDANTE:  0.10,  // Personne morale résidente BF
  NON_RESIDANTE:     0.25,  // Personne morale/physique non-résidente
};

/**
 * Calcule la RAS sur un montant brut
 * @param {number} montantBrut
 * @param {'physique'|'morale_residante'|'non_residante'} type
 * @returns {{ brut, ras, net }}
 */
function calcRAS(montantBrut, type) {
  const taux = RAS_PARAMS[type] || RAS_PARAMS.physique;
  const brut = +montantBrut || 0;
  const ras  = Math.round(brut * taux);
  return { brut, ras, net: brut - ras, taux };
}

/**
 * Total RAS sur un tableau de lignes
 * @param {Array<{montantBrut:number, type:string}>} lignes
 * @returns {{ totalBrut, totalRas, totalNet }}
 */
function calcTotalRAS(lignes) {
  let totalBrut = 0, totalRas = 0, totalNet = 0;
  (lignes || []).forEach(l => {
    const r = calcRAS(l.montantBrut, l.type);
    totalBrut += r.brut;
    totalRas  += r.ras;
    totalNet  += r.net;
  });
  return {
    totalBrut: Math.round(totalBrut),
    totalRas:  Math.round(totalRas),
    totalNet:  Math.round(totalNet),
  };
}

/* =====================================================
   CNSS PATRONAL — Cotisations employeur
   ===================================================== */

const CNSS_PAT_PARAMS = {
  TAUX_FAMILLE:    0.055,   // Prestations familiales (charge patronale)
  TAUX_ACCIDENT:   0.012,   // Accidents du travail (taux moyen)
  TAUX_RETRAITE:   0.16,    // Vieillesse/retraite (charge patronale)
  PLAFOND:         600000,  // Plafond mensuel de cotisation
  CARFO_PAT_TAUX:  0.077,   // Cotisation patronale CARFO
  CARFO_PLAFOND:   600000,
};

/**
 * Calcule les cotisations patronales CNSS pour un employé
 * @param {number} remBrute  — rémunération brute mensuelle
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
  const carfo     = (regime === 'CARFO') ? Math.round(baseCarfo * CNSS_PAT_PARAMS.CARFO_PAT_TAUX) : 0;

  return { baseCot: base, famille, accident, retraite, totalPat, carfo };
}

/**
 * Coût total employeur pour un employé (tous prélèvements patronaux)
 * @param {Object} e         — employé (même structure que STATE.employees[i])
 * @param {'CNSS'|'CARFO'} [cotisationType]
 * @returns {{ remBrute, tpa, cnssPatronal, carfoPatronal, coutTotal, coutTotalParRapportBrut }}
 */
function calcCoutEmployeur(e, cotisationType) {
  const coType    = cotisationType || STATE.cotisation;
  const calc      = calcEmploye(e, coType);
  const pat       = calcCNSSPatronal(calc.remBrute, coType);

  const tpa         = calc.tpa;
  const cnssPatron  = pat.totalPat;
  const carfoPatron = pat.carfo;
  const coutTotal   = calc.remBrute + tpa + cnssPatron + carfoPatron;
  const ratio       = calc.remBrute > 0
    ? Math.round((coutTotal / calc.remBrute) * 100) / 100
    : 0;

  return {
    remBrute:      calc.remBrute,
    netAPayer:     calc.netAPayer,
    iutsNet:       calc.iutsNet,
    cotSocSal:     calc.cotSoc,
    tpa,
    cnssPatronal:  cnssPatron,
    carfoPatronal: carfoPatron,
    coutTotal,
    coutTotalParRapportBrut: ratio,
  };
}

/**
 * Agrégat coût employeur sur tous les employés
 * @returns {{ totalBrut, totalTpa, totalCNSSPat, totalCoutEmployeur }}
 */
function calcCoutEmployeurTotal() {
  let totalBrut = 0, totalTpa = 0, totalCNSSPat = 0, totalCout = 0;

  STATE.employees.forEach(e => {
    const r  = calcCoutEmployeur(e);
    totalBrut    += r.remBrute;
    totalTpa     += r.tpa;
    totalCNSSPat += r.cnssPatronal + r.carfoPatronal;
    totalCout    += r.coutTotal;
  });

  return {
    totalBrut:         Math.round(totalBrut),
    totalTpa:          Math.round(totalTpa),
    totalCNSSPat:      Math.round(totalCNSSPat),
    totalCoutEmployeur: Math.round(totalCout),
  };
}

/* =====================================================
   SIMULATEUR — Projection et comparaison de scénarios
   ===================================================== */

/**
 * Simule le profil fiscal d'un seul employé avec tous les détails
 * utiles pour le simulateur interactif (vue simulateur)
 * @param {Object} params — {base, anciennete, heures, logement, transport, fonction, charges}
 * @param {'CNSS'|'CARFO'} [regime]
 * @returns {Object} résultats enrichis avec coût employeur et taux effectif
 */
function simulerEmploye(params, regime) {
  const coType = regime || STATE.cotisation;
  const calc   = calcEmploye(params, coType);
  const cout   = calcCoutEmployeur(params, coType);

  const tauxEffectif = calc.remBrute > 0
    ? Math.round((calc.iutsNet / calc.remBrute) * 10000) / 100   // en %
    : 0;

  const pressionFiscale = cout.coutTotal > 0
    ? Math.round(((cout.iutsNet + cout.cotSocSal + cout.cnssPatronal + cout.tpa) / cout.coutTotal) * 10000) / 100
    : 0;

  return {
    ...calc,
    ...cout,
    tauxEffectif,        // IUTS / brut (%)
    pressionFiscale,     // Total prélèvements / coût employeur (%)
  };
}

/**
 * Compare deux scénarios salariaux (avant / après augmentation, embauche, etc.)
 * @param {Object} scenarioA
 * @param {Object} scenarioB
 * @returns {{ a, b, delta }} — résultats et différences
 */
function comparerScenarios(scenarioA, scenarioB) {
  const a = simulerEmploye(scenarioA);
  const b = simulerEmploye(scenarioB);
  return {
    a, b,
    delta: {
      remBrute:    b.remBrute    - a.remBrute,
      iutsNet:     b.iutsNet     - a.iutsNet,
      netAPayer:   b.netAPayer   - a.netAPayer,
      coutTotal:   b.coutTotal   - a.coutTotal,
    },
  };
}

/* =====================================================
   PÉNALITÉS DE RETARD (BF — art. 158-165 Code impôts)
   ===================================================== */

const PENALITE_PARAMS = {
  IUTS_TAUX_MOIS: 0.10,  // 10 % / mois de retard sur IUTS
  CNSS_TAUX_MOIS: 0.25,  // 25 % / mois de retard sur CNSS
  MAX_MOIS:       12,    // Plafonnement à 12 mois
};

/**
 * Calcule les pénalités de retard sur une période
 * @param {number} montantIuts   — IUTS net de la période
 * @param {number} montantCnss   — CNSS salariale de la période
 * @param {number} nbMoisRetard  — mois de retard (≥ 1)
 * @returns {{ penaliteIuts, penaliteCnss, totalPenalites, montantTotal, nbMoisRetard }}
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
 * Calcule les pénalités pour toutes les périodes en retard
 * @param {Array}  historique — STATE.historique
 * @param {Date}  [dateRef]  — date de référence (défaut : aujourd'hui)
 * @returns {Array} — une entrée par période en retard avec pénalités
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
      const parts    = h.periode.split(' ');
      const moisIdx  = MOIS_NOMS.findIndex(m => m === parts[0]);
      const annee    = parseInt(parts[1]) || ref.getFullYear();
      // Date limite légale = 15 du mois suivant la période
      const dateLimite = new Date(annee, moisIdx + 1, 15);
      const diffMs     = ref - dateLimite;
      const nbMois     = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30)));
      return { ...h, ...calcPenalites(h.iuts, h.cnss, nbMois) };
    });
}
