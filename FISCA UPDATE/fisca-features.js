/* =====================================================
   FISCA — Fonctionnalités enrichies
   Bulletin · Simulateur · TVA · RAS · IA · Workflow · Multi-sociétés
   ===================================================== */

/* =====================================================
   COPY MOIS PRÉCÉDENT (N-1)   [PRO]
   ===================================================== */
function copyFromN1() {
  if (!can('n1-copy')) { showUpgradeModal('pro'); return; }
  const prev = STATE.historique.find(h => h.statut === 'ok');
  if (!prev) { showToast('Aucun mois précédent disponible.', 'warn'); return; }
  // Conserver les employés mais reset les variables mensuelles
  STATE.employees = STATE.employees.map(e => ({
    ...e, heures: 0, // réinitialiser heures sup
  }));
  renderSaisie();
  showToast(`Données de ${prev.periode} importées. Ajustez si nécessaire.`, 'ok');
}

/* =====================================================
   BULLETIN DE PAIE PDF   [PRO]
   ===================================================== */
function renderBulletins() {
  if (gateView('bulletin','pro')) return;
  const container = document.getElementById('bulletins-list');
  if (!container) return;
  container.innerHTML = STATE.employees.map((e, i) => {
    const r = calcEmploye(e);
    return `
    <div class="bulletin-card" id="bulletin-${i}">
      <div class="bulletin-header">
        <div>
          <div class="bulletin-emp">${e.nom}</div>
          <div class="bulletin-cat"><span class="tag ${e.cat==='Cadre'?'tag-green':'tag-orange'}">${e.cat}</span></div>
        </div>
        <div class="bulletin-actions no-print">
          <button class="btn-sm btn-outline" onclick="printBulletin(${i})">${icon('printer')} Imprimer</button>
          <button class="btn-sm btn-primary" onclick="exportBulletinPDF(${i})">${icon('download')} PDF</button>
        </div>
      </div>
      <div class="bulletin-body">
        <div class="bulletin-section-title">RÉMUNÉRATION BRUTE</div>
        <div class="bulletin-line"><span>Salaire de base</span><span>${fmt(e.base)}</span></div>
        <div class="bulletin-line"><span>Prime d'ancienneté</span><span>${fmt(e.anciennete)}</span></div>
        ${e.heures ? `<div class="bulletin-line"><span>Heures supplémentaires</span><span>${fmt(e.heures)}</span></div>` : ''}
        ${e.logement ? `<div class="bulletin-line"><span>Indemnité de logement</span><span>${fmt(e.logement)}</span></div>` : ''}
        ${e.transport ? `<div class="bulletin-line"><span>Indemnité de transport</span><span>${fmt(e.transport)}</span></div>` : ''}
        ${e.fonction  ? `<div class="bulletin-line"><span>Indemnité de fonction</span><span>${fmt(e.fonction)}</span></div>` : ''}
        <div class="bulletin-line subtotal"><span>Rémunération brute totale</span><span>${fmt(r.remBrute)}</span></div>

        <div class="bulletin-section-title" style="margin-top:12px;">RETENUES SALARIALES</div>
        <div class="bulletin-line ret"><span>Cotisation ${STATE.cotisation} (${STATE.cotisation==='CNSS'?'5,5%':'6%'})</span><span>- ${fmt(r.cotSoc)}</span></div>
        ${r.exoLog   ? `<div class="bulletin-line ret"><span>Exon. logement (plaf. ${fmt(PARAMS.EXO_LOGEMENT)})</span><span>- ${fmt(r.exoLog)}</span></div>` : ''}
        ${r.exoTrans ? `<div class="bulletin-line ret"><span>Exon. transport (plaf. ${fmt(PARAMS.EXO_TRANSPORT)})</span><span>- ${fmt(r.exoTrans)}</span></div>` : ''}
        ${r.exoFonct ? `<div class="bulletin-line ret"><span>Exon. fonction (plaf. ${fmt(PARAMS.EXO_FONCTION)})</span><span>- ${fmt(r.exoFonct)}</span></div>` : ''}
        <div class="bulletin-line ret"><span>Abattement forfaitaire ${(r.tauxForf*100).toFixed(0)}% (${e.cat==='Cadre'?'Cadre':'Non-cadre'} — CGI Art.111)</span><span>- ${fmt(r.abattForf)}</span></div>
        <div class="bulletin-line ret"><span>IUTS brut — base imposable : ${fmt(r.baseImp)} (CGI Art.112)</span><span>- ${fmt(r.iutsBrut)}</span></div>
        <div class="bulletin-line ret"><span>Abattement familial ${e.charges} charge${e.charges>1?'s':''} (CGI Art.113)</span><span>+ ${fmt(r.abattFam)}</span></div>
        <div class="bulletin-line ret total-ret"><span>IUTS net retenu</span><span>- ${fmt(r.iutsNet)}</span></div>
        ${r.retPersonnel ? `<div class="bulletin-line ret"><span>Retenue 1% personnel</span><span>- ${fmt(r.retPersonnel)}</span></div>` : ''}

        <div class="bulletin-net">
          <span>NET À PAYER</span>
          <span class="bulletin-net-amount">${fmt(r.netAPayer)}</span>
        </div>
        <div class="bulletin-footer-info">
          <span>${STATE.company.nom} · ${periodeLabel()} · ${STATE.cotisation}</span>
          <span>${e.charges} charge(s) · Base imp. : ${fmt(r.baseImp)} · Taux eff. IUTS : ${r.remBrute?((r.iutsNet/r.remBrute)*100).toFixed(1)+'%':'0%'}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function exportBulletinPDF(idx) {
  if (typeof window.jspdf === 'undefined') { showToast('jsPDF non disponible.','error'); return; }
  const { jsPDF } = window.jspdf;
  const el = document.getElementById(`bulletin-${idx}`);
  if (!el) return;
  showToast('Génération bulletin PDF…','info');
  const canvas = await html2canvas(el, { scale:2, backgroundColor:'#fff' });
  const pdf = new jsPDF('p','mm','a4');
  const w = pdf.internal.pageSize.getWidth();
  const h = (canvas.height * w) / canvas.width;
  pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,w,h);
  pdf.save(`Bulletin-${STATE.employees[idx].nom.replace(/\s+/g,'-')}-${STATE.mois}${STATE.annee}.pdf`);
  showToast('Bulletin téléchargé.','ok');
}

function printBulletin(idx) {
  printDocument(`bulletin-${idx}`);
}

/* =====================================================
   SIMULATEUR FISCAL   [PRO]
   ===================================================== */
let SIM_AB_MODE = false;

function renderSimulateur() {
  if (gateView('simulateur','pro')) return;
  updateSimulateur();
  if (SIM_AB_MODE) updateABComparison();
}

/* ---- Mode Comparer A/B ---- */
function toggleABMode() {
  SIM_AB_MODE = !SIM_AB_MODE;
  const panel = document.getElementById('sim-ab-panel');
  const btn   = document.getElementById('btn-ab-toggle');
  if (panel) panel.style.display = SIM_AB_MODE ? 'block' : 'none';
  if (btn)   btn.textContent = SIM_AB_MODE ? '← Mode simple' : 'Comparer A vs B';
  if (SIM_AB_MODE) updateABComparison();
}

function _readSimB() {
  return {
    base:       parseFloat(document.getElementById('simb-base')?.value)    || 0,
    anciennete: parseFloat(document.getElementById('simb-anc')?.value)     || 0,
    logement:   parseFloat(document.getElementById('simb-log')?.value)     || 0,
    transport:  parseFloat(document.getElementById('simb-trans')?.value)   || 0,
    fonction:   parseFloat(document.getElementById('simb-fonct')?.value)   || 0,
    charges:    parseInt(document.getElementById('simb-charges')?.value)   || 0,
    heures:     0,
    nom:        'Scénario B',
    cat:        document.getElementById('simb-cat')?.value || 'Non-cadre',
  };
}

function _readSimA() {
  return {
    base:       parseFloat(document.getElementById('sim-base')?.value)    || 0,
    anciennete: parseFloat(document.getElementById('sim-anc')?.value)     || 0,
    logement:   parseFloat(document.getElementById('sim-log')?.value)     || 0,
    transport:  parseFloat(document.getElementById('sim-trans')?.value)   || 0,
    fonction:   parseFloat(document.getElementById('sim-fonct')?.value)   || 0,
    charges:    parseInt(document.getElementById('sim-charges')?.value)   || 0,
    heures:     0,
    nom:        'Scénario A',
    cat:        document.getElementById('sim-cat')?.value || 'Non-cadre',
  };
}

function updateABComparison() {
  if (!SIM_AB_MODE) return;
  const comp  = comparerScenarios(_readSimA(), _readSimB());
  const tbody = document.getElementById('ab-compare-tbody');
  if (!tbody) return;

  const rows = [
    ['Rémunération brute totale', comp.a.remBrute,  comp.b.remBrute,  comp.delta.remBrute],
    ['IUTS net (DGI)',            comp.a.iutsNet,   comp.b.iutsNet,   comp.delta.iutsNet],
    ['Net à payer salarié',      comp.a.netAPayer, comp.b.netAPayer, comp.delta.netAPayer],
    ['Cotisation salariale',     comp.a.cotSocSal, comp.b.cotSocSal, comp.b.cotSocSal - comp.a.cotSocSal],
    ['Coût total employeur',     comp.a.coutTotal, comp.b.coutTotal, comp.delta.coutTotal],
    ['Taux effectif IUTS',       null, null, null, comp.a.tauxEffectif.toFixed(1)+'%', comp.b.tauxEffectif.toFixed(1)+'%'],
  ];

  tbody.innerHTML = rows.map(([label, a, b, d, aStr, bStr]) => {
    if (a === null) {
      // Ligne taux (pas de delta FCFA)
      return `<tr>
        <td class="text-sm">${label}</td>
        <td class="td-num">${aStr}</td>
        <td class="td-num">${bStr}</td>
        <td class="td-num">—</td>
      </tr>`;
    }
    const sign = d > 0 ? '+' : '';
    const cls  = d > 0 ? 'green' : d < 0 ? 'red' : '';
    return `<tr>
      <td class="text-sm">${label}</td>
      <td class="td-num">${fmtN(a)}</td>
      <td class="td-num">${fmtN(b)}</td>
      <td class="td-num bold ${cls}">${sign}${fmtN(d)}</td>
    </tr>`;
  }).join('');

  setEl('ab-taux-a', comp.a.tauxEffectif.toFixed(1) + '%');
  setEl('ab-taux-b', comp.b.tauxEffectif.toFixed(1) + '%');
  setEl('ab-net-a',  fmt(comp.a.netAPayer));
  setEl('ab-net-b',  fmt(comp.b.netAPayer));
  setEl('ab-cout-a', fmt(comp.a.coutTotal));
  setEl('ab-cout-b', fmt(comp.b.coutTotal));
}

function updateSimulateur() {
  const base      = parseFloat(document.getElementById('sim-base')?.value)    || 0;
  const anc       = parseFloat(document.getElementById('sim-anc')?.value)     || 0;
  const logement  = parseFloat(document.getElementById('sim-log')?.value)     || 0;
  const transport = parseFloat(document.getElementById('sim-trans')?.value)   || 0;
  const fonction  = parseFloat(document.getElementById('sim-fonct')?.value)   || 0;
  const charges   = parseInt(document.getElementById('sim-charges')?.value)   || 0;
  const cat       = document.getElementById('sim-cat')?.value || 'Non-cadre';

  const e = { nom:'Simulation', cat, charges, base, anciennete:anc, heures:0, logement, transport, fonction };

  // Utilise le moteur centralisé fisca-calc.js
  const sim = simulerEmploye(e, STATE.cotisation);

  setEl('sim-brut',        fmt(sim.remBrute));
  setEl('sim-cot-sal',     fmt(sim.cotSocSal));
  setEl('sim-iuts',        fmt(sim.iutsNet));
  setEl('sim-net',         fmt(sim.netAPayer));
  setEl('sim-cot-pat',     fmt(sim.cnssPatronal + sim.carfoPatronal));
  setEl('sim-cout-total',  fmt(sim.coutTotal));
  setEl('sim-tpa',         fmt(sim.tpa));
  setEl('sim-base-imp',    fmt(sim.baseImp));
  setEl('sim-taux-eff',    sim.tauxEffectif.toFixed(1) + '%');

  // Barres de répartition (base = coût total employeur)
  const ct = sim.coutTotal;
  if (sim.netAPayer > 0 && ct > 0) {
    const pNet  = (sim.netAPayer / ct * 100).toFixed(1);
    const pIuts = (sim.iutsNet   / ct * 100).toFixed(1);
    const pCot  = ((sim.cotSocSal + sim.cnssPatronal + sim.carfoPatronal) / ct * 100).toFixed(1);
    const pTpa  = (sim.tpa        / ct * 100).toFixed(1);
    setEl('sim-bar-net',  pNet  + '%');
    setEl('sim-bar-iuts', pIuts + '%');
    setEl('sim-bar-cot',  pCot  + '%');
    setEl('sim-bar-tpa',  pTpa  + '%');
    const barNet  = document.getElementById('sim-prog-net');
    const barIuts = document.getElementById('sim-prog-iuts');
    const barCot  = document.getElementById('sim-prog-cot');
    const barTpa  = document.getElementById('sim-prog-tpa');
    if (barNet)  barNet.style.width  = pNet  + '%';
    if (barIuts) barIuts.style.width = pIuts + '%';
    if (barCot)  barCot.style.width  = pCot  + '%';
    if (barTpa)  barTpa.style.width  = pTpa  + '%';
  }
  // Mettre à jour la comparaison A/B si active
  if (SIM_AB_MODE) updateABComparison();
}

/* =====================================================
   MODULE TVA   [PRO]
   ===================================================== */
// Taux délégué au moteur : TVA_PARAMS.TAUX (fisca-calc.js)
const TVA_STATE = {
  collectee: [
    { label: 'Ventes produits', ht: 2500000 },
    { label: 'Prestations de services', ht: 800000 },
  ],
  deductible: [
    { label: 'Achats matières premières', ht: 1200000 },
    { label: 'Charges locatives', ht: 300000 },
    { label: 'Équipements professionnels', ht: 450000 },
  ],
};

function renderTVA() {
  if (gateView('tva','pro')) return;
  refreshTVA();
}

function refreshTVA() {
  // Moteur fisca-calc.js : calcTVA() et calcSoldeTVA()
  const lignesC = TVA_STATE.collectee.map(l => ({ type:'collecte',   montantHT:l.ht, taux:TVA_PARAMS.TAUX }));
  const lignesD = TVA_STATE.deductible.map(l => ({ type:'deductible', montantHT:l.ht, taux:TVA_PARAMS.TAUX }));
  const solde   = calcSoldeTVA([...lignesC, ...lignesD]);

  const totHTc  = TVA_STATE.collectee.reduce((s,l) => s + l.ht, 0);
  const totHTd  = TVA_STATE.deductible.reduce((s,l) => s + l.ht, 0);
  const credit  = solde.solde < 0;

  const renderLines = (lines, type) => lines.map((l,i) => {
    const { tva, ttc } = calcTVA(l.ht, TVA_PARAMS.TAUX);
    return `<div class="tva-line">
      <input class="tva-line-label" value="${l.label}" onchange="TVA_STATE.${type}[${i}].label=this.value">
      <div class="tva-line-ht">${fmtN(l.ht)}</div>
      <div class="tva-line-tva">${fmtN(tva)}</div>
      <div class="tva-line-ttc">${fmtN(ttc)}</div>
      <button class="btn-icon btn-danger" onclick="TVA_STATE.${type}.splice(${i},1);refreshTVA()">${icon('trash')}</button>
    </div>`;
  }).join('');

  const cBody = document.getElementById('tva-collectee-body');
  const dBody = document.getElementById('tva-deductible-body');
  if (cBody) cBody.innerHTML = renderLines(TVA_STATE.collectee, 'collectee');
  if (dBody) dBody.innerHTML = renderLines(TVA_STATE.deductible,'deductible');

  setEl('tva-tot-ht-c',   fmt(totHTc));
  setEl('tva-tot-tva-c',  fmt(solde.collectee));
  setEl('tva-tot-ttc-c',  fmt(totHTc + solde.collectee));
  setEl('tva-tot-ht-d',   fmt(totHTd));
  setEl('tva-tot-tva-d',  fmt(solde.deductible));
  setEl('tva-nette',      fmt(Math.abs(solde.solde)));

  const netEl = document.getElementById('tva-nette-label');
  if (netEl) {
    netEl.textContent = credit ? 'Crédit de TVA (reportable)' : 'TVA nette à reverser';
    netEl.className = `tva-nette-label ${credit ? 'credit' : 'debit'}`;
  }
  const netValEl = document.getElementById('tva-nette');
  if (netValEl) netValEl.style.color = credit ? 'var(--g600)' : 'var(--red)';
}

function addTVALine(type) {
  TVA_STATE[type].push({ label: 'Nouvelle ligne', ht: 0 });
  refreshTVA();
}

/* =====================================================
   RETENUE À LA SOURCE (RAS)   [ENTREPRISE]
   ===================================================== */
// Taux délégués au moteur : RAS_PARAMS (fisca-calc.js — CGI 2025 Art. 206-226)
// Correspondance étiquettes UI → clés moteur
const RAS_TYPE_MAP = {
  'Résident avec IFU (5%)':            'RESIDENT_IFU',
  'Résident IFU — Immobilier (1%)':    'RESIDENT_IFU_IMMO',
  'Résident sans IFU (25%)':           'RESIDENT_SANS_IFU',
  'Travail temporaire (2%)':           'TRAVAIL_TEMPORAIRE',
  'Non-résident (20%)':                'NON_RESIDENT',
  'Non-résident CEDEAO Transport (10%)':'NON_RESIDENT_CEDEAO',
  'Non-déterminé — vacation/manuel (2%)':'NONDETER_VACATION',
  'Non-déterminé — entité publique (5%)':'NONDETER_PUBLIC',
  'Non-déterminé — salarié/intellectuel (10%)':'NONDETER_SALARIE',
};

const RAS_STATE = {
  prestations: [
    { beneficiaire:'CONSEIL DEV SARL',       type:'Résident avec IFU (5%)',            montant:500000 },
    { beneficiaire:'KONE Jean (consultant)', type:'Non-déterminé — salarié/intellectuel (10%)', montant:250000 },
    { beneficiaire:'AFRICA TECH INC',        type:'Non-résident (20%)',                montant:800000 },
  ],
};

function renderRAS() {
  if (gateView('ras','enterprise')) return;
  refreshRAS();
}

function refreshRAS() {
  const tbody = document.getElementById('ras-tbody');
  if (!tbody) return;

  // Calcul via moteur fisca-calc.js (calcRAS + calcTotalRAS — CGI 2025)
  const lignes = RAS_STATE.prestations.map(p => ({
    montantHT: p.montant,
    type:      RAS_TYPE_MAP[p.type] || 'RESIDENT_IFU',
  }));
  const totals = calcTotalRAS(lignes);

  tbody.innerHTML = RAS_STATE.prestations.map((p, i) => {
    const typeKey = RAS_TYPE_MAP[p.type] || 'RESIDENT_IFU';
    const { ras, net, taux, exonere } = calcRAS(p.montant, typeKey);
    return `<tr>
      <td><input style="border:none;width:150px;font-size:12px;" value="${p.beneficiaire}" onchange="RAS_STATE.prestations[${i}].beneficiaire=this.value"/></td>
      <td>
        <select style="border:1px solid var(--gr3);border-radius:5px;font-size:11px;max-width:220px;" onchange="RAS_STATE.prestations[${i}].type=this.value;refreshRAS()">
          ${Object.keys(RAS_TYPE_MAP).map(k=>`<option ${k===p.type?'selected':''}>${k}</option>`).join('')}
        </select>
      </td>
      <td class="td-num">${exonere ? '<span style="color:var(--g500);font-size:11px;">Exon.</span>' : (taux*100).toFixed(0)+'%'}</td>
      <td class="td-num">${fmtN(p.montant)}</td>
      <td class="td-num bold" style="color:${exonere?'var(--g500)':'var(--red)'}">${exonere ? '0' : fmtN(ras)}</td>
      <td class="td-num">${fmtN(net)}</td>
      <td><button class="btn-icon btn-danger" onclick="RAS_STATE.prestations.splice(${i},1);refreshRAS()">${icon('trash')}</button></td>
    </tr>`;
  }).join('');

  setEl('ras-tot-montant', fmt(totals.totalHT));
  setEl('ras-tot-ras',     fmt(totals.totalRas));
  setEl('ras-tot-net',     fmt(totals.totalNet));
}

function addRASLine() {
  RAS_STATE.prestations.push({ beneficiaire:'Nouveau prestataire', type:'Personne physique', montant:0 });
  refreshRAS();
}

/* =====================================================
   CNSS PATRONAL   [ENTREPRISE]
   ===================================================== */
function renderCNSSPatronal() {
  if (gateView('cnss-patronal','enterprise')) return;

  // Moteur fisca-calc.js : calcCNSSPatronal() + calcCoutEmployeur()
  const totEmployeur = calcCoutEmployeurTotal();
  const t = calcTotaux();

  // Taux patronal affiché (CNSS retraite + famille + accident)
  const patronalRate = (CNSS_PAT_PARAMS.TAUX_FAMILLE + CNSS_PAT_PARAMS.TAUX_ACCIDENT + CNSS_PAT_PARAMS.TAUX_RETRAITE);

  setEl('cnss-brut',       fmt(t.totBrut));
  setEl('cnss-base-pat',   fmt(Math.min(t.totBrut, PARAMS.CNSS_PLAFOND * STATE.employees.length)));
  setEl('cnss-cot-sal',    fmt(t.totCotSoc));
  setEl('cnss-taux-pat',   (patronalRate * 100).toFixed(1) + '%');
  setEl('cnss-cot-pat',    fmt(totEmployeur.totalCNSSPat));
  setEl('cnss-total',      fmt(totEmployeur.totalCNSSPat + t.totCotSoc));
  setEl('cnss-nb',         STATE.employees.length);

  // Tableau détail par employé
  const tbody = document.getElementById('cnss-detail-tbody');
  if (!tbody) return;
  tbody.innerHTML = STATE.employees.map((e, i) => {
    const r   = calcEmploye(e);
    const pat = calcCNSSPatronal(r.remBrute, STATE.cotisation);
    return `<tr>
      <td>${i+1}</td>
      <td class="td-name">${e.nom}</td>
      <td class="td-num">${fmtN(r.remBrute)}</td>
      <td class="td-num">${fmtN(pat.baseCot)}</td>
      <td class="td-num">${fmtN(r.cotSoc)}</td>
      <td class="td-num bold" style="color:var(--ora)">${fmtN(pat.totalPat + pat.carfo)}</td>
      <td class="td-num bold">${fmtN(r.cotSoc + pat.totalPat + pat.carfo)}</td>
    </tr>`;
  }).join('');

  // Mise à jour du total pied de tableau (id utilisé dans index.html)
  setEl('cnss-cot-pat2', fmt(totEmployeur.totalCNSSPat));
}

/* =====================================================
   IRF — Impôt sur les Revenus Fonciers   [PRO]
   CGI 2025 Art. 121-126
   ===================================================== */
const IRF_STATE = {
  baux: [
    { bailleur:'OUEDRAOGO Amidou',  loyer:150000 },
    { bailleur:'TRAORE Kadiatou',   loyer:80000  },
    { bailleur:'Immeuble Secteur 30', loyer:250000 },
  ],
};

function renderIRF() {
  if (gateView('irf','pro')) return;
  refreshIRF();
}

function refreshIRF() {
  const tbody = document.getElementById('irf-tbody');
  if (!tbody) return;

  let totBrut = 0, totAbatt = 0, totBase = 0, totIrf = 0;

  tbody.innerHTML = IRF_STATE.baux.map((b, i) => {
    const r = calcIRF(b.loyer);
    totBrut  += r.loyerBrut;
    totAbatt += r.abattement;
    totBase  += r.baseNette;
    totIrf   += r.irfTotal;
    return `<tr>
      <td><input style="border:none;width:160px;font-size:12px;" value="${b.bailleur}" onchange="IRF_STATE.baux[${i}].bailleur=this.value"/></td>
      <td><input type="number" style="border:1px solid var(--gr3);border-radius:4px;width:110px;font-size:12px;text-align:right;" value="${b.loyer}" onchange="IRF_STATE.baux[${i}].loyer=+this.value;refreshIRF()"/></td>
      <td class="td-num">${fmtN(r.abattement)} <span style="font-size:10px;color:var(--gr5)">(50%)</span></td>
      <td class="td-num">${fmtN(r.baseNette)}</td>
      <td class="td-num bold" style="color:var(--red)">${fmtN(r.irfTotal)}</td>
      <td class="td-num">${r.tauxEffectif.toFixed(1)}%</td>
      <td><button class="btn-icon btn-danger" onclick="IRF_STATE.baux.splice(${i},1);refreshIRF()">${icon('trash')}</button></td>
    </tr>`;
  }).join('');

  setEl('irf-tot-brut',  fmt(totBrut));
  setEl('irf-tot-abatt', fmt(totAbatt));
  setEl('irf-tot-base',  fmt(totBase));
  setEl('irf-tot-irf',   fmt(totIrf));
}

function addIRFLine() {
  IRF_STATE.baux.push({ bailleur:'Nouveau bail', loyer:0 });
  refreshIRF();
}

/* =====================================================
   IRCM — Impôt sur Revenus Capitaux Mobiliers   [PRO]
   CGI 2025 Art. 140
   ===================================================== */
const IRCM_STATE = {
  revenus: [
    { label:'Dividendes distribués',      type:'DIVIDENDES', montant:2000000 },
    { label:'Intérêts compte bancaire',   type:'CREANCES',   montant:500000  },
    { label:'Obligations BF émises',      type:'OBLIGATIONS',montant:800000  },
  ],
};

function renderIRCM() {
  if (gateView('ircm','pro')) return;
  refreshIRCM();
}

function refreshIRCM() {
  const tbody = document.getElementById('ircm-tbody');
  if (!tbody) return;

  const IRCM_LABELS = {
    DIVIDENDES:  'Dividendes / autres produits (12,5%)',
    CREANCES:    'Intérêts / créances (25%)',
    OBLIGATIONS: 'Obligations BF (6%)',
  };

  let totBrut = 0, totIrcm = 0, totNet = 0;

  tbody.innerHTML = IRCM_STATE.revenus.map((r, i) => {
    const res = calcIRCM(r.montant, r.type);
    totBrut += res.brut;
    totIrcm += res.ircm;
    totNet  += res.net;
    return `<tr>
      <td><input style="border:none;width:180px;font-size:12px;" value="${r.label}" onchange="IRCM_STATE.revenus[${i}].label=this.value"/></td>
      <td>
        <select style="border:1px solid var(--gr3);border-radius:4px;font-size:11px;" onchange="IRCM_STATE.revenus[${i}].type=this.value;refreshIRCM()">
          ${Object.keys(IRCM_LABELS).map(k=>`<option value="${k}" ${k===r.type?'selected':''}>${IRCM_LABELS[k]}</option>`).join('')}
        </select>
      </td>
      <td class="td-num">${(res.taux*100).toFixed(1)}%</td>
      <td class="td-num">${fmtN(res.brut)}</td>
      <td class="td-num bold" style="color:var(--red)">${fmtN(res.ircm)}</td>
      <td class="td-num">${fmtN(res.net)}</td>
      <td><button class="btn-icon btn-danger" onclick="IRCM_STATE.revenus.splice(${i},1);refreshIRCM()">${icon('trash')}</button></td>
    </tr>`;
  }).join('');

  setEl('ircm-tot-brut', fmt(totBrut));
  setEl('ircm-tot-ircm', fmt(totIrcm));
  setEl('ircm-tot-net',  fmt(totNet));
}

function addIRCMLine() {
  IRCM_STATE.revenus.push({ label:'Nouveau revenu', type:'DIVIDENDES', montant:0 });
  refreshIRCM();
}

/* =====================================================
   CME — Contribution des Micro-Entreprises   [PRO]
   CGI 2025 Art. 533+
   ===================================================== */
function renderCME() {
  if (gateView('cme','pro')) return;
  refreshCME();
}

function refreshCME() {
  const ca      = parseFloat(document.getElementById('cme-ca')?.value)  || 0;
  const zone    = document.getElementById('cme-zone')?.value            || 'A';
  const cga     = document.getElementById('cme-cga')?.checked           || false;
  const res     = calcCME(ca, zone, cga);

  setEl('cme-classe',   `Classe ${res.classe}`);
  setEl('cme-tarif',    fmt(res.cme));
  setEl('cme-net',      fmt(res.cmeNet));
  setEl('cme-zone-aff', `Zone ${zone}`);
  if (cga) setEl('cme-reduc', '- 25% CGA');
  else setEl('cme-reduc', '');
}

/* =====================================================
   PATENTES   [PRO]
   CGI 2025 Art. 237-240
   ===================================================== */
function renderPatente() {
  if (gateView('patente','pro')) return;
  refreshPatente();
}

function refreshPatente() {
  const ca   = parseFloat(document.getElementById('pat-ca')?.value)  || 0;
  const vl   = parseFloat(document.getElementById('pat-vl')?.value)  || 0;
  const tab  = document.getElementById('pat-tableau')?.value         || 'A';
  const res  = calcPatente(ca, vl, tab);

  setEl('pat-droit-fixe', fmt(res.droitFixe));
  setEl('pat-droit-prop', fmt(res.droitProp));
  setEl('pat-total',      fmt(res.total));
}

/* =====================================================
   MULTI-SOCIÉTÉS   [ENTREPRISE]
   ===================================================== */
const COMPANIES = [
  { id:1, nom:'SK SARL',         ifu:'0012345BF', secteur:'Commerce',      nb:8,  statut:'ok'      },
  { id:2, nom:'TRANS BF SA',     ifu:'0078234BF', secteur:'Transport',     nb:12, statut:'retard'  },
  { id:3, nom:'AGRO SAVANE',     ifu:'0045678BF', secteur:'Agriculture',   nb:5,  statut:'en_cours'},
  { id:4, nom:'DIGIT SERVICES',  ifu:'0091234BF', secteur:'Tech',          nb:3,  statut:'ok'      },
];
let ACTIVE_COMPANY = 1;

function renderMultiCompany() {
  if (gateView('multi-company','enterprise')) return;
  const grid = document.getElementById('company-grid');
  if (!grid) return;
  grid.innerHTML = COMPANIES.map(c => {
    const sMap = { ok:'badge-ok', retard:'badge-red', en_cours:'badge-orange' };
    const sLabel = { ok:'À jour', retard:'En retard', en_cours:'En cours' };
    const isActive = c.id === ACTIVE_COMPANY;
    return `
    <div class="company-card ${isActive?'company-active':''}" onclick="setActiveCompany(${c.id})">
      <div class="company-card-header">
        <div class="company-avatar">${c.nom.charAt(0)}</div>
        <div>
          <div class="company-name">${c.nom}</div>
          <div class="company-ifu">IFU: ${c.ifu}</div>
        </div>
        ${isActive ? `<div class="company-active-badge">${icon('check')} Actif</div>` : ''}
      </div>
      <div class="company-info">
        <span class="tag tag-green">${c.secteur}</span>
        <span class="text-sm">${c.nb} employés</span>
        <span class="badge ${sMap[c.statut]}">${sLabel[c.statut]}</span>
      </div>
    </div>`;
  }).join('');
}

function setActiveCompany(id) {
  ACTIVE_COMPANY = id;
  const c = COMPANIES.find(x => x.id === id);
  if (c) {
    STATE.company.nom = c.nom;
    STATE.company.ifu = c.ifu;
    document.querySelector('.user-info strong').textContent = c.nom;
    showToast(`Société active : ${c.nom}`, 'ok');
  }
  renderMultiCompany();
}

/* =====================================================
   WORKFLOW APPROBATION   [ENTREPRISE]
   ===================================================== */
const WORKFLOW_STEPS = [
  { id:'saisie',       label:'Saisie RH',         icon:'edit',       color:'#3b82f6', desc:'Saisie des rémunérations par l\'équipe RH' },
  { id:'verification', label:'Vérification Compta',icon:'calculator', color:'#f97316', desc:'Contrôle des calculs par le comptable' },
  { id:'approbation',  label:'Approbation DG',     icon:'check',      color:'#24a05a', desc:'Validation finale par la direction' },
  { id:'generation',   label:'Génération',         icon:'fileText',   color:'#0d3321', desc:'Rapport officiel généré et archivé' },
];
let WF_CURRENT = 'saisie';

function renderWorkflow() {
  if (gateView('workflow','enterprise')) return;
  const board = document.getElementById('wf-board');
  if (!board) return;
  board.innerHTML = WORKFLOW_STEPS.map(s => {
    const isCurrent = s.id === WF_CURRENT;
    const isDone    = WORKFLOW_STEPS.findIndex(x=>x.id===WF_CURRENT) > WORKFLOW_STEPS.findIndex(x=>x.id===s.id);
    return `
    <div class="wf-column ${isCurrent?'wf-current':''} ${isDone?'wf-done':''}">
      <div class="wf-col-header" style="border-color:${s.color}">
        <div class="wf-col-icon" style="background:${s.color}20;color:${s.color}">${icon(s.icon)}</div>
        <div class="wf-col-title">${s.label}</div>
        ${isDone    ? `<span class="wf-status done">${icon('checkCircle')} Fait</span>` : ''}
        ${isCurrent ? `<span class="wf-status current">En cours</span>` : ''}
      </div>
      <p class="wf-col-desc">${s.desc}</p>
      ${isCurrent ? `
        <div class="wf-card">
          <div class="wf-card-title">${periodeLabel()} — ${STATE.company.nom}</div>
          <div class="wf-card-detail">${STATE.employees.length} employés · En attente d'action</div>
          <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:8px;" onclick="advanceWorkflow()">
            ${icon('arrowRight')} Passer à l'étape suivante
          </button>
        </div>` : ''}
    </div>`;
  }).join('');
}

function advanceWorkflow() {
  const idx = WORKFLOW_STEPS.findIndex(s => s.id === WF_CURRENT);
  if (idx < WORKFLOW_STEPS.length - 1) {
    WF_CURRENT = WORKFLOW_STEPS[idx + 1].id;
    renderWorkflow();
    showToast(`Avancé à : ${WORKFLOW_STEPS[idx+1].label}`, 'ok');
    if (WF_CURRENT === 'generation') {
      setTimeout(() => openPayModal(), 800);
    }
  }
}

/* =====================================================
   ASSISTANT IA FISCAL   [PRO]
   ===================================================== */
const IA_FAQ = [
  /* ─── Exonérations ─── */
  { keys:['logement','indemnite logement','exoneration logement'],
    answer:'L\'indemnité de logement est exonérée d\'IUTS jusqu\'à <strong>75 000 FCFA/mois</strong>. Le surplus est intégré à la base imposable (CGI Art. 110).' },
  { keys:['transport','indemnite transport'],
    answer:'L\'indemnité de transport est exonérée jusqu\'à <strong>30 000 FCFA/mois</strong>. Au-delà, le surplus est imposable (CGI Art. 110).' },
  { keys:['fonction','indemnite fonction'],
    answer:'Chaque indemnité de fonction est exonérée jusqu\'à <strong>50 000 FCFA/mois</strong> (CGI Art. 110).' },
  /* ─── Abattements ─── */
  { keys:['charge familiale','abattement familial','enfant','dependant'],
    answer:'<strong>CGI 2025 Art. 113</strong> — L\'abattement familial est une <em>réduction en % sur l\'IUTS calculé</em> :<br>• 1 charge : <strong>8 %</strong><br>• 2 charges : <strong>10 %</strong><br>• 3 charges : <strong>12 %</strong><br>• 4 charges : <strong>14 %</strong><br>Maximum 4 charges prises en compte.' },
  { keys:['abattement forfaitaire','frais professionnel'],
    answer:'<strong>CGI 2025 Art. 111</strong> — L\'abattement forfaitaire est appliqué sur le salaire de base :<br>• <strong>25 %</strong> pour les <em>non-cadres</em> (employés ordinaires)<br>• <strong>20 %</strong> pour les <em>cadres</em> (catégories P, A, B / grades 6, 1, 2 du secteur public)' },
  /* ─── Barème IUTS ─── */
  { keys:['iuts','impot unique','bareme','tranche'],
    answer:'<strong>CGI 2025 Art. 112</strong> — Barème IUTS mensuel (7 tranches) :<br>• 0 – 30 000 : <strong>0 %</strong><br>• 30 100 – 50 000 : <strong>12,10 %</strong><br>• 50 100 – 80 000 : <strong>13,90 %</strong><br>• 80 100 – 120 000 : <strong>15,70 %</strong><br>• 120 100 – 170 000 : <strong>18,40 %</strong><br>• 170 100 – 250 000 : <strong>21,70 %</strong><br>• 250 100 + : <strong>25 %</strong>' },
  /* ─── Cotisations sociales ─── */
  { keys:['cnss','cotisation sociale'],
    answer:'La cotisation CNSS salariale est de <strong>5,5 %</strong> du brut, plafonnée à <strong>600 000 FCFA/mois</strong>. La part patronale (retraite + famille + accident) est de <strong>22,7 % environ</strong>.' },
  { keys:['carfo','fonctionnaire','agent public'],
    answer:'Pour les agents publics, la cotisation CARFO est de <strong>6 %</strong> (part salariale) et <strong>7,7 %</strong> (part patronale), plafonnée à 600 000 FCFA.' },
  /* ─── TPA ─── */
  { keys:['tpa','taxe patronale','apprentissage'],
    answer:'La Taxe Patronale d\'Apprentissage (TPA) est de <strong>3 %</strong> sur la masse salariale brute totale (CGI 2025 Art. 229). Les adhérents CGA bénéficient d\'une réduction de 20 %.' },
  /* ─── TVA ─── */
  { keys:['tva','taxe valeur ajoutee'],
    answer:'<strong>CGI 2025 Art. 317</strong> — Taux TVA :<br>• Taux standard : <strong>18 %</strong><br>• Taux réduit : <strong>10 %</strong> pour hôtels/restaurants agréés et transport aérien national<br>Seuil d\'assujettissement : CA annuel ≥ 50 000 000 FCFA.' },
  /* ─── RAS ─── */
  { keys:['ras','retenue source','honoraire','prestataire'],
    answer:'<strong>CGI 2025 Art. 207 & 212</strong> — Retenue à la source :<br>• Résident avec IFU : <strong>5 %</strong> (1 % travaux immobiliers)<br>• Résident sans IFU : <strong>25 %</strong><br>• Travail temporaire : <strong>2 %</strong><br>• Non-résident : <strong>20 %</strong><br>• CEDEAO transport : <strong>10 %</strong><br>Exonéré si montant < 50 000 FCFA HT.' },
  /* ─── IRF ─── */
  { keys:['irf','revenu foncier','loyer','bailleur'],
    answer:'<strong>CGI 2025 Art. 124-126</strong> — Impôt sur les Revenus Fonciers :<br>• Abattement : <strong>50 %</strong> sur le loyer brut<br>• Sur la base nette : <strong>18 %</strong> jusqu\'à 100 000 F, puis <strong>25 %</strong> au-delà.' },
  /* ─── IRCM ─── */
  { keys:['ircm','dividende','interet','capital mobilier'],
    answer:'<strong>CGI 2025 Art. 140</strong> — Impôt sur Revenus Capitaux Mobiliers :<br>• Revenus des créances / intérêts : <strong>25 %</strong><br>• Obligations émises au BF : <strong>6 %</strong><br>• Dividendes et autres produits : <strong>12,5 %</strong>' },
  /* ─── IS / MFP ─── */
  { keys:['is','impot societe','benefice','minimum forfaitaire','mfp'],
    answer:'<strong>IS</strong> : taux de <strong>27,5 %</strong> sur le bénéfice imposable.<br><strong>Minimum forfaitaire</strong> : 0,5 % du CA HT, avec un plancher de <strong>1 000 000 FCFA</strong> (RNI) ou <strong>300 000 FCFA</strong> (RSI). Les adhérents CGA bénéficient de 50 % de réduction sur le MFP et 30 % sur l\'IS.' },
  /* ─── CME ─── */
  { keys:['cme','micro entreprise','contribution micro'],
    answer:'<strong>CGI 2025 Art. 533+</strong> — La Contribution des Micro-Entreprises (CME) est un tarif fixe annuel selon la zone et la classe d\'activité (CA) :<br>• Zone A (Ouaga/Bobo) : 10 000 – 200 000 FCFA/an<br>• Zone D (rural) : 2 000 – 80 000 FCFA/an<br>Réduction 25 % pour les adhérents CGA.' },
  /* ─── Patentes ─── */
  { keys:['patente','droit fixe','droit proportionnel'],
    answer:'<strong>CGI 2025 Art. 237-240</strong> — La patente = droit fixe + droit proportionnel :<br>• Droit fixe (tableau A) : de 10 000 FCFA (CA ≤ 5 M) à 400 000 FCFA (CA > 200 M)<br>• Droit proportionnel : % de la valeur locative des locaux professionnels (~16 %).' },
  /* ─── Délais ─── */
  { keys:['declaration','delai','date limite','15'],
    answer:'Délais légaux (CGI 2025) :<br>• IUTS / TPA : au plus tard le <strong>15 du mois suivant</strong><br>• TVA : au plus tard le <strong>20 du mois suivant</strong><br>• CNSS : au plus tard le <strong>15 du mois suivant</strong><br>• IRF : versements trimestriels, 10 du mois suivant.' },
  /* ─── Divers ─── */
  { keys:['anciennete','prime anciennete'],
    answer:'La prime d\'ancienneté est imposable à l\'IUTS. Elle est intégrée dans le salaire brut. Son taux légal est généralement <strong>2 % par an</strong> de présence effective.' },
  { keys:['smig','salaire minimum'],
    answer:'Le SMIG au Burkina Faso est de <strong>34 664 FCFA/mois</strong>. Aucun salarié ne peut être rémunéré en dessous de ce seuil.' },
  { keys:['retenue personnel','1%'],
    answer:'Une retenue de <strong>1 %</strong> sur le salaire net est obligatoire pour les salariés (contribution personnel). Elle est déduite avant versement du net à payer.' },
];

const IA_HISTORY = [];

function renderAssistant() {
  if (gateView('assistant','pro')) return;
}

function sendIAMessage() {
  const input = document.getElementById('ia-input');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  IA_HISTORY.push({ role:'user', text: msg });
  renderIAHistory();

  // Recherche de réponse
  setTimeout(() => {
    const answer = findIAAnswer(msg);
    IA_HISTORY.push({ role:'ia', text: answer });
    renderIAHistory();
    // Auto-scroll
    const chat = document.getElementById('ia-chat');
    if (chat) chat.scrollTop = chat.scrollHeight;
  }, 600);
}

function findIAAnswer(q) {
  const qn = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  for (const faq of IA_FAQ) {
    if (faq.keys.some(k => qn.includes(k.normalize('NFD').replace(/[\u0300-\u036f]/g,'')))) {
      return faq.answer;
    }
  }
  return `Je n'ai pas de réponse précise à cette question dans ma base de connaissances fiscales. Consultez le <strong>Code des impôts du Burkina Faso</strong> ou contactez un conseiller fiscal agréé.`;
}

function renderIAHistory() {
  const chat = document.getElementById('ia-chat');
  if (!chat) return;
  chat.innerHTML = IA_HISTORY.map(m => `
    <div class="ia-msg ia-msg-${m.role}">
      ${m.role === 'ia' ? `<div class="ia-avatar">${icon('shield')}</div>` : ''}
      <div class="ia-bubble ia-bubble-${m.role}">${m.role==='ia' ? m.text : m.text}</div>
      ${m.role === 'user' ? `<div class="ia-avatar ia-avatar-user">Moi</div>` : ''}
    </div>`).join('');
  chat.scrollTop = chat.scrollHeight;
}

function iaKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendIAMessage(); }
}

const IA_SUGGESTIONS = [
  "Quel est le barème IUTS 2025 ?",
  "Comment calculer l'abattement familial CGI 2025 ?",
  "Quel est le taux de RAS pour un prestataire avec IFU ?",
  "Comment fonctionne l'IRF sur les revenus fonciers ?",
  "Quelle est la différence entre CME et IS ?",
  "Quel est le taux IRCM sur les dividendes ?",
  "Quels sont les délais légaux de déclaration ?",
];

/* =====================================================
   CENTRE DE NOTIFICATIONS   [PRO]
   ===================================================== */
const NOTIFICATIONS = [
  { id:1, type:'urgent', title:'Déclaration Mars 2026 en retard', detail:'Date limite dépassée. Pénalités de 25% applicables.', time:'Il y a 2 jours', read:false },
  { id:2, type:'warn',   title:'Échéance dans 5 jours', detail:'Déclaration Avril 2026 : date limite le 15 avril 2026.', time:'Il y a 1 jour', read:false },
  { id:3, type:'info',   title:'Nouveau salarié à valider', detail:'DIALLO Hawa ajoutée — vérifier les informations avant génération.', time:'Il y a 3 heures', read:true },
  { id:4, type:'ok',     title:'Paiement Orange Money confirmé', detail:'Rapport Fév. 2026 généré — Réf. FISCA-202602-8841.', time:'Il y a 5 jours', read:true },
  { id:5, type:'info',   title:'Mise à jour barème IUTS 2026', detail:'La Loi de Finances 2026 est publiée. Aucun changement de taux cette année.', time:'Il y a 10 jours', read:true },
];

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  panel.classList.toggle('open');
  renderNotifications();
}

function renderNotifications() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  const unread = NOTIFICATIONS.filter(n => !n.read).length;
  setEl('notif-count', unread > 0 ? unread : '');
  document.getElementById('notif-unread-count').textContent = `${unread} non lu(s)`;

  const typeIcon = { urgent:'alertTriangle', warn:'alertTriangle', info:'info', ok:'checkCircle' };
  const typeColor= { urgent:'var(--red)',    warn:'var(--ora)',    info:'var(--blu)', ok:'var(--g500)' };
  list.innerHTML = NOTIFICATIONS.map(n => `
    <div class="notif-item ${n.read?'notif-read':''}" onclick="markRead(${n.id})">
      <div class="notif-icon" style="color:${typeColor[n.type]}">${icon(typeIcon[n.type])}</div>
      <div class="notif-content">
        <div class="notif-title">${n.title}</div>
        <div class="notif-detail">${n.detail}</div>
        <div class="notif-time">${n.time}</div>
      </div>
      ${!n.read ? '<div class="notif-unread-dot"></div>' : ''}
    </div>`).join('');
}

function markRead(id) {
  const n = NOTIFICATIONS.find(x => x.id === id);
  if (n) { n.read = true; renderNotifications(); }
}

function markAllRead() {
  NOTIFICATIONS.forEach(n => n.read = true);
  renderNotifications();
}

/* =====================================================
   ABONNEMENT   [TOUS]
   ===================================================== */
function renderAbonnement() {
  const p = PLANS[CURRENT_PLAN];
  setEl('abo-plan-label',   p.label);
  setEl('abo-plan-price',   p.price);
  setEl('abo-plan-detail',  p.priceDetail);
  setEl('abo-plan-desc',    p.description);
  setEl('abo-max-emp',      isFinite(p.limits.employees) ? p.limits.employees : 'Illimité');
  setEl('abo-max-hist',     p.limits.historyMonths + ' mois');

  const badge = document.getElementById('abo-plan-badge');
  if (badge) { badge.textContent = p.label; badge.style.background = p.color; }
}

/* =====================================================
   MISE À JOUR NAVIGATION PAR PLAN
   ===================================================== */
// Appelée par showView pour vérifier l'accès
const VIEW_REQUIRED_PLAN = {
  bulletin:       'pro',
  simulateur:     'pro',
  tva:            'pro',
  assistant:      'pro',
  bilan:          'pro',
  irf:            'pro',
  ircm:           'pro',
  cme:            'pro',
  patente:        'pro',
  'multi-company':'enterprise',
  workflow:       'enterprise',
  ras:            'enterprise',
  'cnss-patronal':'enterprise',
  abonnement:     'starter',
};

// Surcharge showView pour intégrer le gate check
const _origShowView = showView;
window.showView = function(name) {
  const req = VIEW_REQUIRED_PLAN[name];
  if (req && !can(req)) {
    _origShowView(name); // affiche la vue (le gate la vide et montre le message)
    gateView(name, req);
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll(`.nav-item[data-view="${name}"]`).forEach(n => n.classList.add('active'));
    const t = VIEW_TITLES[name] || ['FISCA',''];
    document.getElementById('topbar-title').textContent = t[0];
    document.getElementById('topbar-sub').textContent   = t[1];
    return;
  }
  _origShowView(name);
  // Render spécialisé
  if (name === 'bulletin')       renderBulletins();
  if (name === 'simulateur')     renderSimulateur();
  if (name === 'tva')            renderTVA();
  if (name === 'ras')            renderRAS();
  if (name === 'cnss-patronal')  renderCNSSPatronal();
  if (name === 'multi-company')  renderMultiCompany();
  if (name === 'workflow')       renderWorkflow();
  if (name === 'abonnement')     renderAbonnement();
  if (name === 'irf')            renderIRF();
  if (name === 'ircm')           renderIRCM();
  if (name === 'cme')            renderCME();
  if (name === 'patente')        renderPatente();
};

// Étendre VIEW_TITLES
Object.assign(VIEW_TITLES, {
  bulletin:       ['Bulletins de paie',           'PDF par employé · Impression directe'],
  simulateur:     ['Simulateur fiscal',            'Coût employeur · Net salarié · Taux effectif IUTS'],
  tva:            ['Module TVA',                   'TVA collectée · Déductible · Nette à reverser (CGI Art.317)'],
  ras:            ['Retenue à la source',          'RAS sur honoraires — CGI 2025 Art. 206-226'],
  'cnss-patronal':['CNSS Patronal',                'Cotisations employeur CNSS / CARFO'],
  irf:            ['Revenus Fonciers (IRF)',        'Abattement 50% · Barème 18/25% — CGI Art.121-126'],
  ircm:           ['Capitaux Mobiliers (IRCM)',    'Dividendes · Intérêts · Obligations — CGI Art.140'],
  cme:            ['Micro-Entreprises (CME)',       'Tarif fixe Zone × Classe — CGI Art.533+'],
  patente:        ['Contribution des Patentes',     'Droit fixe + Droit proportionnel — CGI Art.237-240'],
  'multi-company':['Multi-sociétés',               'Gérez toutes vos entités depuis un tableau de bord'],
  workflow:       ['Workflow d\'approbation',       'Saisie → Vérification → Approbation → Génération'],
  assistant:      ['Assistant IA Fiscal',           'Questions · Réponses · Code général des Impôts 2025'],
  abonnement:     ['Mon abonnement',                'Gestion du plan et des fonctionnalités'],
  notifications:  ['Notifications',                 'Alertes et rappels fiscaux'],
});
