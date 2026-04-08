/* =====================================================
   FISCA — Logique applicative
   Navigation · Saisie · Calcul · Rapport · PDF · Print · Import
   ===================================================== */

/* =====================================================
   NAVIGATION
   ===================================================== */
const VIEW_TITLES = {
  dashboard:   ['Tableau de bord',     'Avril 2026 · Exercice fiscal en cours'],
  saisie:      ['Saisie mensuelle',    'Avril 2026 · Rémunérations et cotisations'],
  calcul:      ['Calcul IUTS / TPA',   'Loi de Finances 2020 — Burkina Faso'],
  rapport:     ['Rapport du mois',     'Aperçu et génération du document officiel'],
  historique:  ['Historique fiscal',   '2026 · Toutes les déclarations'],
  bilan:       ['Bilan annuel',        '2026 · Synthèse de l\'exercice'],
  parametres:  ['Paramètres',          'Informations de votre entreprise'],
};

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const viewEl = document.getElementById('view-' + name);
  if (viewEl) viewEl.classList.add('active');

  document.querySelectorAll(`.nav-item[data-view="${name}"]`).forEach(n => n.classList.add('active'));

  const t = VIEW_TITLES[name] || ['FISCA', ''];
  document.getElementById('topbar-title').textContent = t[0];
  document.getElementById('topbar-sub').textContent   = t[1];

  if (name === 'calcul')     renderCalcul();
  if (name === 'rapport')    renderRapport();
  if (name === 'historique') renderHistorique();
  if (name === 'parametres') renderParametres();
  if (name === 'bilan')      renderBilan();
}

/* =====================================================
   DASHBOARD
   ===================================================== */
function renderDashboard() {
  const t = calcTotaux();
  setEl('dash-iuts', fmtN(t.totIutsNet));
  setEl('dash-tpa',  fmtN(t.totTpa));
  setEl('dash-cnss', fmtN(t.totCotSoc));
  setEl('dash-nb',   STATE.employees.length);

  // Sous-titres dynamiques
  setEl('dash-sub-iuts', `FCFA · ${periodeLabel()}`);
  setEl('dash-sub-tpa',  `FCFA · ${STATE.employees.length} salarié(s)`);
  setEl('dash-sub-cnss', `FCFA · ${STATE.cotisation} ${STATE.cotisation==='CNSS'?'5,5%':'6%'}`);
  setEl('dash-sub-nb',   `Employés · ${periodeLabel()}`);

  // Calendrier fiscal dynamique
  renderCalendrierFiscal();

  // Alerte retards avec pénalités
  const retards = STATE.historique.filter(h => h.statut === 'retard');
  const alertEl = document.getElementById('dash-alert-text');
  if (alertEl) {
    if (retards.length > 0) {
      const pens = calcPenalitesHistorique(STATE.historique);
      const totalPen = pens.reduce((s, r) => s + r.totalPenalites, 0);
      alertEl.innerHTML = `Déclaration IUTS <strong>${retards.map(r=>r.periode).join(', ')}</strong> en retard.${totalPen>0?' Pénalités estimées : <strong style="color:var(--red)">'+fmt(totalPen)+'</strong>':''}`;
      document.getElementById('dash-alert-wrap').style.display = '';
    } else {
      const alertWrap = document.getElementById('dash-alert-wrap');
      if (alertWrap) alertWrap.style.display = 'none';
    }
  }

  // Activité récente dynamique
  renderActiviteRecente();
}

function renderCalendrierFiscal() {
  const calGrid = document.getElementById('cal-grid');
  if (!calGrid) return;
  const MOIS_COURT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const MOIS_LONG  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const moisActuel = MOIS_LONG.indexOf(STATE.mois);
  calGrid.innerHTML = MOIS_COURT.map((m, idx) => {
    const h = STATE.historique.find(h2 => h2.periode.startsWith(MOIS_LONG[idx]));
    let cls = 'pending', badge = '—';
    if (h) {
      if (h.statut === 'ok')       { cls = 'done';    badge = 'OK'; }
      else if (h.statut === 'retard') { cls = 'late'; badge = '!'; }
      else if (h.statut === 'en_cours') { cls = 'current'; badge = '•'; }
    } else if (idx === moisActuel) { cls = 'current'; badge = '•'; }
    return `<div class="cal-m ${cls}">${m}<span class="cal-badge">${badge}</span></div>`;
  }).join('');
}

function renderActiviteRecente() {
  const list = document.getElementById('activity-list');
  if (!list) return;
  const items = [...STATE.historique]
    .filter(h => h.date && h.date !== '—')
    .slice(-4).reverse();
  if (!items.length) return;
  list.innerHTML = items.map(h => {
    const dot = h.statut === 'ok' ? 'g' : h.statut === 'retard' ? 'r' : 'o';
    const ic  = h.statut === 'ok' ? icon('checkCircle') : h.statut === 'retard' ? icon('alertTriangle') : icon('edit');
    return `<div class="act-item">
      <div class="act-dot ${dot}">${ic}</div>
      <div class="act-text"><strong>${h.statut==='ok'?'Rapport':'Déclaration'} ${h.periode} ${h.statut==='ok'?'généré':'en attente'}</strong><p>${h.date}${h.ref?' · '+h.ref:''}</p></div>
    </div>`;
  }).join('');
}

/* =====================================================
   SAISIE DYNAMIQUE
   ===================================================== */
function renderSaisie() {
  const container = document.getElementById('saisie-employees');
  if (!container) return;
  container.innerHTML = STATE.employees.map((e, i) => buildEmployeeForm(e, i)).join('');
  STATE.employees.forEach((_, i) => calcLiveEmployee(i));
}

function buildEmployeeForm(e, i) {
  const catColor = e.cat === 'Cadre' ? 'tag-green' : 'tag-orange';
  return `
  <div class="emp-block" id="emp-block-${i}">
    <div class="emp-block-header">
      <span class="emp-block-num">${icon('user')} Employé ${i + 1}</span>
      <span class="tag ${catColor}">${e.cat}</span>
      <button class="btn-icon btn-danger" title="Supprimer" onclick="removeEmployee(${i})">${icon('trash')}</button>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>Nom et Prénom <span class="req">*</span></label>
        <input id="nom-${i}" type="text" value="${e.nom}" oninput="updateEmp(${i},'nom',this.value)" />
      </div>
      <div class="form-group">
        <label>Catégorie</label>
        <select onchange="updateEmp(${i},'cat',this.value)">
          <option ${e.cat==='Cadre'?'selected':''}>Cadre</option>
          <option ${e.cat==='Non-cadre'?'selected':''}>Non-cadre</option>
        </select>
      </div>
      <div class="form-group">
        <label>Charges (dépendants)</label>
        <input id="charges-${i}" type="number" min="0" max="6" value="${e.charges}" oninput="updateEmp(${i},'charges',+this.value)" />
      </div>
    </div>
    <div class="form-grid" style="margin-top:10px;">
      <div class="form-group">
        <label>Salaire de base <span class="req">*</span></label>
        <div class="inp-fcfa"><input id="base-${i}" type="number" min="0" value="${e.base}" oninput="updateEmp(${i},'base',+this.value)" /></div>
      </div>
      <div class="form-group">
        <label>Prime d'ancienneté</label>
        <div class="inp-fcfa"><input id="anciennete-${i}" type="number" min="0" value="${e.anciennete}" oninput="updateEmp(${i},'anciennete',+this.value)" /></div>
      </div>
      <div class="form-group">
        <label>Heures sup. & sursalaire</label>
        <div class="inp-fcfa"><input id="heures-${i}" type="number" min="0" value="${e.heures}" oninput="updateEmp(${i},'heures',+this.value)" /></div>
      </div>
    </div>
    <div class="form-grid" style="margin-top:10px;">
      <div class="form-group">
        <label>Ind. logement <span class="help-tip">≤75 000 exonéré</span></label>
        <div class="inp-fcfa"><input id="logement-${i}" type="number" min="0" value="${e.logement}" oninput="updateEmp(${i},'logement',+this.value)" /></div>
      </div>
      <div class="form-group">
        <label>Ind. transport <span class="help-tip">≤30 000 exonéré</span></label>
        <div class="inp-fcfa"><input id="transport-${i}" type="number" min="0" value="${e.transport}" oninput="updateEmp(${i},'transport',+this.value)" /></div>
      </div>
      <div class="form-group">
        <label>Ind. de fonction <span class="help-tip">≤50 000 exonéré</span></label>
        <div class="inp-fcfa"><input id="fonction-${i}" type="number" min="0" value="${e.fonction}" oninput="updateEmp(${i},'fonction',+this.value)" /></div>
      </div>
    </div>
    <!-- Résultat temps réel -->
    <div class="emp-live-result" id="live-${i}">
      <div class="live-item"><div class="live-label">IUTS net</div><div class="live-val green" id="live-iuts-${i}">—</div></div>
      <div class="live-item"><div class="live-label">${STATE.cotisation} ${STATE.cotisation==='CNSS'?'5.5%':'6%'}</div><div class="live-val blue" id="live-cot-${i}">—</div></div>
      <div class="live-item"><div class="live-label">TPA 3%</div><div class="live-val orange" id="live-tpa-${i}">—</div></div>
      <div class="live-item"><div class="live-label">Net à payer</div><div class="live-val" id="live-net-${i}">—</div></div>
    </div>
  </div>`;
}

function updateEmp(i, field, val) {
  STATE.employees[i][field] = val;
  calcLiveEmployee(i);
  showFieldErrors(i);
  saveState();
}

function calcLiveEmployee(i) {
  const r = calcEmploye(STATE.employees[i]);
  setEl(`live-iuts-${i}`,  fmt(r.iutsNet));
  setEl(`live-cot-${i}`,   fmt(r.cotSoc));
  setEl(`live-tpa-${i}`,   fmt(r.tpa));
  setEl(`live-net-${i}`,   fmt(r.netAPayer));
}

function addEmployee() {
  STATE.employees.push({ nom: '', cat: 'Non-cadre', charges: 0, base: 0, anciennete: 0, heures: 0, logement: 0, transport: 0, fonction: 0 });
  renderSaisie();
  saveState();
  renderDashboard();
  const blocks = document.querySelectorAll('.emp-block');
  if (blocks.length) blocks[blocks.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function removeEmployee(i) {
  if (STATE.employees.length <= 1) { showToast('Vous devez avoir au moins un employé.', 'warn'); return; }
  if (!confirm(`Supprimer ${STATE.employees[i].nom || 'cet employé'} ?`)) return;
  STATE.employees.splice(i, 1);
  renderSaisie();
  saveState();
  renderDashboard();
}

/* =====================================================
   TABLEAU DE CALCUL
   ===================================================== */
function renderCalcul() {
  const tbody = document.getElementById('calcul-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const t = calcTotaux();

  STATE.employees.forEach((e, i) => {
    const r = calcEmploye(e);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="td-name">${e.nom || '—'}</td>
      <td><span class="tag ${e.cat==='Cadre'?'tag-green':'tag-orange'}">${e.cat}</span></td>
      <td class="td-num">${e.charges}</td>
      <td class="td-num">${fmtN(r.remBrute)}</td>
      <td class="td-num">${fmtN(r.cotSoc)}</td>
      <td class="td-num">${fmtN(r.exoLog)}</td>
      <td class="td-num">${fmtN(r.exoTrans)}</td>
      <td class="td-num">${fmtN(r.exoFonct)}</td>
      <td class="td-num">${fmtN(r.abattForf)}</td>
      <td class="td-num">${fmtN(r.baseImp)}</td>
      <td class="td-num">${fmtN(r.iutsBrut)}</td>
      <td class="td-num">${fmtN(r.abattFam)}</td>
      <td class="td-num bold green">${fmtN(r.iutsNet)}</td>
      <td class="td-num bold">${fmtN(r.netAPayer)}</td>`;
    tbody.appendChild(tr);
  });

  // Totaux
  setEl('t-brut',      fmtN(t.totBrut));
  setEl('t-cot',       fmtN(t.totCotSoc));
  setEl('t-base',      fmtN(t.totBase));
  setEl('t-iutsbrut',  fmtN(t.totIutsBrut));
  setEl('t-iutsnet',   fmtN(t.totIutsNet));
  setEl('t-net',       fmtN(t.totNet));

  // Récap reversements
  setEl('recap-brut',  fmt(t.totBrut));
  setEl('recap-iuts',  fmt(t.totIutsNet));
  setEl('recap-tpa',   fmt(t.totTpa));
  setEl('recap-cot',   fmt(t.totCotSoc));
  setEl('recap-total', fmt(t.totIutsNet + t.totTpa + t.totCotSoc));
}

/* =====================================================
   RAPPORT MENSUEL
   ===================================================== */
function renderRapport() {
  const t = calcTotaux();
  const today = new Date().toLocaleDateString('fr-BF', { day: '2-digit', month: 'long', year: 'numeric' });

  setEl('r-date',     today);
  setEl('r-periode',  periodeLabel());
  setEl('r-periode2', periodeLabel());
  setEl('r-nom',      STATE.company.nom);
  setEl('r-ifu',      STATE.company.ifu);
  setEl('r-rc',       STATE.company.rc);
  setEl('r-secteur',  STATE.company.secteur);
  setEl('r-adresse',  STATE.company.adresse);
  setEl('r-ref',      STATE.rapportRef || '— APERÇU —');

  // TPA
  setEl('r-brut',     fmt(t.totBrut));
  setEl('r-tpa',      fmt(t.totTpa));

  // IUTS
  setEl('r-nb',       STATE.employees.length);
  setEl('r-brut2',    fmt(t.totBrut));
  setEl('r-cot',      fmt(t.totCotSoc));
  setEl('r-exo',      fmt(t.totExo));
  setEl('r-base',     fmt(t.totBase));
  setEl('r-iutsb',    fmt(t.totIutsBrut));
  setEl('r-abatt',    fmt(t.totAbattFam));
  setEl('r-iutsn',    fmt(t.totIutsNet));

  // Reversements
  setEl('r-rev1',     fmt(t.totIutsNet));
  setEl('r-rev2',     fmt(t.totTpa));
  setEl('r-rev3',     fmt(t.totCotSoc));
  setEl('r-rev-total',fmt(t.totIutsNet + t.totTpa + t.totCotSoc));

  // État annexe
  const tbody = document.getElementById('rapport-tbody');
  if (tbody) {
    tbody.innerHTML = STATE.employees.map((e, i) => {
      const r = calcEmploye(e);
      return `<tr>
        <td>${i + 1}</td>
        <td class="td-name">${e.nom}</td>
        <td class="td-num">${fmtN(r.remBrute)}</td>
        <td class="td-num">${fmtN(r.baseImp)}</td>
        <td class="td-num">${e.charges}</td>
        <td class="td-num bold green">${fmtN(r.iutsNet)}</td>
        <td class="td-num">${fmtN(r.netAPayer)}</td>
      </tr>`;
    }).join('');
  }
  setEl('rt-brut', fmtN(t.totBrut));
  setEl('rt-base', fmtN(t.totBase));
  setEl('rt-iuts', fmtN(t.totIutsNet));
  setEl('rt-net',  fmtN(t.totNet));

  // Stamp
  const stamp = document.getElementById('rapport-stamp-id');
  if (stamp) stamp.textContent = STATE.rapportRef || '— PAIEMENT REQUIS —';

  // Lock/unlock style
  document.getElementById('rapport-doc').classList.toggle('locked', !STATE.rapportUnlocked);
}

/* =====================================================
   HISTORIQUE
   ===================================================== */
function renderHistorique() {
  const tbody = document.getElementById('hist-tbody');
  if (!tbody) return;
  tbody.innerHTML = STATE.historique.map(h => {
    const statusMap = {
      ok:       `<span class="badge badge-ok">${icon('checkCircle')} Généré</span>`,
      retard:   `<span class="badge badge-red">${icon('alertTriangle')} En retard</span>`,
      en_cours: `<span class="badge badge-orange">${icon('edit')} En cours</span>`,
    };
    const actionMap = {
      ok:       `<button class="btn-sm btn-outline" onclick="genDuplicata('${h.ref}')">${icon('copy')} Duplicata</button>`,
      retard:   `<button class="btn-sm btn-orange" onclick="openPayModal()">${icon('creditCard')} Générer</button>`,
      en_cours: `<button class="btn-sm btn-primary" onclick="showView('saisie')">${icon('edit')} Saisir</button>`,
    };
    return `<tr>
      <td><strong>${h.periode}</strong></td>
      <td class="td-num">${h.nb}</td>
      <td class="td-num">${h.brut ? fmtN(h.brut) : '—'}</td>
      <td class="td-num ${h.iuts ? 'green' : ''}">${h.iuts ? fmtN(h.iuts) : '—'}</td>
      <td class="td-num">${h.tpa  ? fmtN(h.tpa)  : '—'}</td>
      <td class="td-num">${h.cnss ? fmtN(h.cnss) : '—'}</td>
      <td class="td-num bold">${h.total ? fmtN(h.total) : '—'}</td>
      <td>${h.date}</td>
      <td>${statusMap[h.statut] || ''}</td>
      <td>${actionMap[h.statut] || ''}</td>
    </tr>`;
  }).join('');
}

function genDuplicata(ref) {
  if (!ref) return;
  showToast(`Duplicata en cours pour ${ref}…`, 'info');
  setTimeout(() => openPayModal('duplicata', ref), 400);
}

/* =====================================================
   EXPORT PDF  (jsPDF + html2canvas)
   ===================================================== */
async function exportPDF(type) {
  if (typeof window.jspdf === 'undefined' || typeof html2canvas === 'undefined') {
    showToast('Bibliothèques PDF non chargées. Vérifiez votre connexion.', 'error'); return;
  }
  const { jsPDF } = window.jspdf;

  if (type === 'rapport') {
    await exportRapportPDF(jsPDF);
  } else if (type === 'calcul') {
    exportCalculPDF(jsPDF);
  } else if (type === 'bilan') {
    exportBilanPDF(jsPDF);
  }
}

async function exportRapportPDF(jsPDF) {
  const el = document.getElementById('rapport-doc');
  renderRapport(); // S'assurer que les données sont à jour

  // Rendre visible temporairement si caché
  const viewEl = document.getElementById('view-rapport');
  const wasHidden = !viewEl.classList.contains('active');
  if (wasHidden) {
    viewEl.style.cssText = 'display:block;position:absolute;visibility:hidden;top:0;left:0;width:800px;';
  }

  try {
    showToast('Génération du PDF en cours…', 'info');
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf     = new jsPDF('p', 'mm', 'a4');
    const pageW   = pdf.internal.pageSize.getWidth();
    const pageH   = pdf.internal.pageSize.getHeight();
    const imgW    = pageW;
    const imgH    = (canvas.height * imgW) / canvas.width;
    let yPos = 0;
    while (yPos < imgH) {
      if (yPos > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, -yPos, imgW, imgH);
      yPos += pageH;
    }
    pdf.save(`FISCA-Rapport-${STATE.mois}-${STATE.annee}.pdf`);
    showToast('PDF téléchargé avec succès.', 'ok');
  } catch (e) {
    showToast('Erreur lors de la génération du PDF.', 'error');
    console.error(e);
  } finally {
    if (wasHidden) viewEl.style.cssText = '';
  }
}

function exportCalculPDF(jsPDF) {
  const t = calcTotaux();
  const doc = new jsPDF('l', 'mm', 'a4'); // Landscape pour le tableau large
  const pageW = doc.internal.pageSize.getWidth();

  // En-tête
  doc.setFillColor(13, 51, 33);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('FISCA — TABLEAU DE CALCUL IUTS', 14, 12);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 230, 200);
  doc.text(`${STATE.company.nom}  |  ${periodeLabel()}  |  IFU: ${STATE.company.ifu}  |  Cotisation: ${STATE.cotisation}`, 14, 22);

  // Tableau autoTable
  doc.autoTable({
    startY: 34,
    head: [['N°','Nom & Prénom','Cat.','Chg.','Sal. Brut','Cotis.','Exo. Log','Exo. Trs','Exo. Fct','Abatt 20%','Base Imp.','IUTS Brut','Abatt Fam','IUTS Net','Net/Payer']],
    body: STATE.employees.map((e, i) => {
      const r = calcEmploye(e);
      return [i+1, e.nom, e.cat, e.charges,
        fmtN(r.remBrute), fmtN(r.cotSoc), fmtN(r.exoLog), fmtN(r.exoTrans), fmtN(r.exoFonct),
        fmtN(r.abattForf), fmtN(r.baseImp), fmtN(r.iutsBrut), fmtN(r.abattFam), fmtN(r.iutsNet), fmtN(r.netAPayer)];
    }),
    foot: [['', 'TOTAUX', '', '', fmtN(t.totBrut), fmtN(t.totCotSoc), '', '', '', '',
            fmtN(t.totBase), fmtN(t.totIutsBrut), fmtN(t.totAbattFam), fmtN(t.totIutsNet), fmtN(t.totNet)]],
    styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [13, 51, 33], textColor: [255,255,255], fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: [31, 41, 55], textColor: [255,255,255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 253, 245] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 36 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 8 },
      4:  { halign: 'right' }, 5:  { halign: 'right' }, 6:  { halign: 'right' },
      7:  { halign: 'right' }, 8:  { halign: 'right' }, 9:  { halign: 'right' },
      10: { halign: 'right' }, 11: { halign: 'right' }, 12: { halign: 'right' },
      13: { halign: 'right', textColor: [26, 107, 58] },
      14: { halign: 'right' },
    },
  });

  // Pied de page
  const finalY = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(8); doc.setTextColor(107, 114, 128);
  doc.text(`Base légale : Articles 59-71 (IUTS) & 127-130 (TPA) — Code des impôts BF  |  FISCA © ${STATE.annee}`, 14, finalY);

  doc.save(`FISCA-Calcul-${STATE.mois}-${STATE.annee}.pdf`);
  showToast('Tableau exporté en PDF.', 'ok');
}

function exportBilanPDF(jsPDF) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(13, 51, 33);
  doc.rect(0, 0, pageW, 30, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(16); doc.setFont('helvetica','bold');
  doc.text('BILAN FISCAL ANNUEL', 14, 14);
  doc.setFontSize(10); doc.setFont('helvetica','normal');
  doc.setTextColor(180,230,200);
  doc.text(`${STATE.company.nom}  —  Exercice ${STATE.annee}`, 14, 24);

  doc.autoTable({
    startY: 38,
    head: [['Période','Nb Sal.','Masse Sal.','IUTS','TPA','CNSS','Total reversé','Statut']],
    body: STATE.historique.map(h => [
      h.periode, h.nb,
      h.brut  ? fmtN(h.brut)  : '—',
      h.iuts  ? fmtN(h.iuts)  : '—',
      h.tpa   ? fmtN(h.tpa)   : '—',
      h.cnss  ? fmtN(h.cnss)  : '—',
      h.total ? fmtN(h.total) : '—',
      { ok:'Généré', retard:'En retard', en_cours:'En cours' }[h.statut],
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [13,51,33], textColor: [255,255,255], fontStyle:'bold' },
    alternateRowStyles: { fillColor: [240,253,245] },
    columnStyles: { 2:{halign:'right'}, 3:{halign:'right'}, 4:{halign:'right'}, 5:{halign:'right'}, 6:{halign:'right',fontStyle:'bold'} },
  });

  doc.save(`FISCA-Bilan-${STATE.annee}.pdf`);
  showToast('Bilan exporté en PDF.', 'ok');
}

/* =====================================================
   IMPRESSION
   ===================================================== */
function printDocument(viewId) {
  // Peuple le rapport si nécessaire
  if (viewId === 'rapport-doc' || viewId === 'view-rapport') renderRapport();
  if (viewId === 'view-calcul') renderCalcul();

  const el = document.getElementById(viewId);
  if (!el) return;

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html lang="fr"><head>
    <meta charset="UTF-8">
    <title>FISCA — Impression</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:'Segoe UI',sans-serif;color:#111827;background:#fff;padding:20px;}
      svg{display:inline-block;vertical-align:middle;}
      table{width:100%;border-collapse:collapse;font-size:11px;}
      thead th{background:#0d3321;color:#fff;padding:8px;text-align:left;font-size:10px;}
      tbody tr:nth-child(even){background:#f0fdf5;}
      tbody td{padding:7px 8px;border-bottom:1px solid #e5e7eb;}
      tfoot td{background:#1f2937;color:#fff;font-weight:700;padding:8px;}
      .td-num,.td-right{text-align:right;font-weight:600;}
      .rapport-header{background:#0d3321;color:#fff;padding:24px;border-radius:8px 8px 0 0;}
      .rapport-header h1{font-size:18px;font-weight:800;}
      .rapport-meta{display:flex;gap:24px;margin-top:12px;}
      .rapport-meta strong{display:block;font-size:9px;opacity:.5;text-transform:uppercase;}
      .rapport-meta span{font-size:12px;font-weight:700;}
      .rapport-body{padding:20px;}
      .section-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#1a6b3a;border-bottom:2px solid #e6f9ed;padding-bottom:4px;margin:16px 0 10px;}
      .r-line{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px dashed #e5e7eb;font-size:12px;}
      .r-line.total{border-top:2px solid #111827;font-weight:800;font-size:14px;margin-top:6px;}
      .r-line .lbl{color:#6b7280;}
      .r-line .val{font-weight:700;}
      .r-line .val.green{color:#1a6b3a;}
      .r-line .val.red{color:#ef4444;}
      .stamp{margin-top:20px;background:#f0fdf5;border:2px dashed #34c76e;border-radius:8px;padding:14px;text-align:center;}
      .stamp-title{font-size:10px;font-weight:800;text-transform:uppercase;color:#1a6b3a;letter-spacing:1px;}
      .stamp-id{font-size:18px;font-weight:900;color:#0d3321;letter-spacing:2px;margin-top:4px;}
      .footer{margin-top:16px;padding:12px 0;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:9px;color:#9ca3af;}
      .tag{display:inline-block;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700;}
      .tag-green{background:#e6f9ed;color:#1a6b3a;}
      .tag-orange{background:#fff7ed;color:#9a3412;}
      .bold{font-weight:700;} .green{color:#1a6b3a;}
      @media print{body{padding:10mm;} @page{size:A4;margin:10mm;}}
    </style>
  </head><body>${el.outerHTML}</body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 500);
}

/* =====================================================
   IMPORT FICHIER (CSV + XLSX)
   ===================================================== */
function setupImportZone() {
  const zone = document.getElementById('drop-zone');
  const inp  = document.getElementById('file-input');
  if (!zone || !inp) return;

  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) parseImportFile(file);
  });
  inp.addEventListener('change', () => { if (inp.files[0]) parseImportFile(inp.files[0]); });
}

function parseImportFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (['xlsx', 'xls'].includes(ext)) {
    if (typeof XLSX === 'undefined') { showToast('Bibliothèque XLSX non chargée.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      showImportPreview(rows.map(mapRowToEmployee), rows);
    };
    reader.readAsArrayBuffer(file);
  } else if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = e => {
      const rows = parseCsvText(e.target.result);
      showImportPreview(rows.map(mapRowToEmployee), rows);
    };
    reader.readAsText(file, 'UTF-8');
  } else {
    showToast('Format non supporté. Utilisez CSV, XLS ou XLSX.', 'warn');
  }
}

function parseCsvText(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  const sep   = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
    const obj  = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
}

function normalizeKey(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s_\-\.]+/g,'');
}

function findCol(row, ...terms) {
  const keys = Object.keys(row);
  const key  = keys.find(k => terms.some(t => normalizeKey(k).includes(normalizeKey(t))));
  return key !== undefined ? row[key] : '';
}

function mapRowToEmployee(row) {
  const nom     = String(findCol(row,'nom','prenom','name','employe','agent') || '').trim();
  const catRaw  = String(findCol(row,'categ','cat','type','statut') || '');
  const isCadre = catRaw === '1' || (normalizeKey(catRaw).includes('cadre') && !normalizeKey(catRaw).includes('non'));
  return {
    nom:        nom || 'Sans nom',
    cat:        isCadre ? 'Cadre' : 'Non-cadre',
    charges:    parseInt(findCol(row,'charge','dependent','enfant','ayant')) || 0,
    base:       parseFloat(String(findCol(row,'base','salaire b','indiciaire')).replace(/\s/g,'')) || 0,
    anciennete: parseFloat(String(findCol(row,'anciennet','prime anc')).replace(/\s/g,'')) || 0,
    heures:     parseFloat(String(findCol(row,'heure','sup','sursalaire')).replace(/\s/g,'')) || 0,
    logement:   parseFloat(String(findCol(row,'logement','logt')).replace(/\s/g,'')) || 0,
    transport:  parseFloat(String(findCol(row,'transport','transp')).replace(/\s/g,'')) || 0,
    fonction:   parseFloat(String(findCol(row,'fonction','fonct')).replace(/\s/g,'')) || 0,
  };
}

const KNOWN_COLUMN_PATTERNS = [
  'nom','prenom','name','employe','agent','categ','cat','type','statut',
  'charge','dependent','enfant','ayant','base','salaire','indiciaire',
  'anciennet','prime','heure','sup','sursalaire','logement','logt',
  'transport','transp','fonction','fonct',
];

function detectUnknownColumns(rows) {
  if (!rows || !rows.length) return [];
  return Object.keys(rows[0]).filter(h => {
    const norm = normalizeKey(h);
    return !KNOWN_COLUMN_PATTERNS.some(p => norm.includes(normalizeKey(p)));
  });
}

function showImportPreview(employees, rawRows) {
  const valid = employees.filter(e => e.nom && e.nom !== 'Sans nom' && e.base > 0);

  // Feedback colonnes inconnues
  const unknown = detectUnknownColumns(rawRows);
  const warnEl  = document.getElementById('import-unknown-cols');
  if (warnEl) {
    if (unknown.length) {
      warnEl.textContent = `Colonnes ignorées (non reconnues) : ${unknown.join(', ')}`;
      warnEl.style.display = 'block';
    } else {
      warnEl.style.display = 'none';
    }
  }

  if (!valid.length) {
    showToast('Aucune donnée valide. Vérifiez les colonnes : Nom, SalaireBase, Categorie.', 'warn');
    return;
  }

  const modal = document.getElementById('import-modal');
  const tbody = document.getElementById('import-preview-tbody');
  const count = document.getElementById('import-count');

  count.textContent = `${valid.length} employé(s) détecté(s)`;
  tbody.innerHTML = valid.map((e, i) => `<tr>
    <td>${i+1}</td>
    <td>${e.nom}</td>
    <td><span class="tag ${e.cat==='Cadre'?'tag-green':'tag-orange'}">${e.cat}</span></td>
    <td class="td-num">${e.charges}</td>
    <td class="td-num">${fmtN(e.base)}</td>
    <td class="td-num">${fmtN(e.logement)}</td>
    <td class="td-num">${fmtN(e.transport)}</td>
    <td class="td-num">${fmtN(e.fonction)}</td>
  </tr>`).join('');

  modal._pendingEmployees = valid;
  modal.classList.add('open');
}

function confirmImport() {
  const modal = document.getElementById('import-modal');
  const emps  = modal._pendingEmployees || [];
  if (!emps.length) return;
  STATE.employees = emps;
  closeImportModal();
  renderSaisie();
  saveState();
  renderDashboard();
  showToast(`${emps.length} employé(s) importé(s) avec succès.`, 'ok');
}

function closeImportModal() {
  document.getElementById('import-modal').classList.remove('open');
}

function downloadTemplate() {
  if (typeof XLSX === 'undefined') {
    // Fallback CSV
    const csv = 'Nom,Categorie,Charges,SalaireBase,Anciennete,HeuresSup,Logement,Transport,Fonction\nEXEMPLE Employe,1,2,250000,12500,0,50000,20000,30000\n';
    const a   = document.createElement('a');
    a.href    = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'FISCA_Modele.csv'; a.click();
    return;
  }
  const wb = XLSX.utils.book_new();
  const data = [
    ['Nom','Categorie (1=Cadre / 2=Non-cadre)','Charges','SalaireBase','Anciennete','HeuresSup','Logement','Transport','Fonction'],
    ['EXEMPLE Koffi','1','2','350000','17500','0','75000','30000','50000'],
    ['EXEMPLE Awa','2','1','120000','6000','0','30000','15000','0'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [24,30,10,14,12,10,12,12,12].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Employes');
  XLSX.writeFile(wb, 'FISCA_Modele_Import.xlsx');
  showToast('Modèle téléchargé.', 'ok');
}

/* =====================================================
   PAIEMENT ORANGE MONEY
   ===================================================== */
function openPayModal(type, ref) {
  const modal = document.getElementById('pay-modal');
  modal._type = type || 'generate';
  modal._ref  = ref  || null;
  renderPayForm();
  modal.classList.add('open');
}

function closePayModal() {
  document.getElementById('pay-modal').classList.remove('open');
}

function renderPayForm() {
  document.getElementById('pay-body').innerHTML = `
    <div class="pay-amount-box">
      <div class="pay-amount-label">Frais de génération du rapport</div>
      <div class="pay-amount">2 030 FCFA</div>
      <div class="pay-amount-detail">2 000 FCFA + 30 FCFA frais transaction (1,5%)</div>
    </div>
    <div class="pay-steps">
      <div class="pay-step"><div class="step-n">1</div>Entrez votre numéro Orange Money</div>
      <div class="pay-step"><div class="step-n">2</div>Confirmez le paiement sur votre téléphone</div>
      <div class="pay-step"><div class="step-n">3</div>Le rapport est généré automatiquement</div>
    </div>
    <div class="phone-wrap">
      <span class="phone-prefix">+226</span>
      <input type="tel" id="phone-input" placeholder="70 00 00 00" maxlength="11" />
    </div>
    <button class="btn-pay" id="btn-pay-submit" onclick="processPayment()">
      ${icon('creditCard')} Payer 2 030 FCFA
    </button>
    <button class="btn-pay-cancel" onclick="closePayModal()">Annuler</button>`;
}

function processPayment() {
  const rawPhone = document.getElementById('phone-input').value || '';
  const phone    = rawPhone.replace(/[\s\-\.]/g, '');

  // Validation numéro Orange BF : 8 chiffres, commence par 05, 06 ou 07
  const BF_ORANGE_REGEX = /^0[5-7]\d{6}$/;
  const inp = document.getElementById('phone-input');
  if (!BF_ORANGE_REGEX.test(phone)) {
    inp.style.borderColor = 'var(--red)';
    inp.style.boxShadow   = '0 0 0 3px rgba(239,68,68,.15)';
    showToast('Numéro Orange Money invalide (ex: 07 00 00 00 — 8 chiffres, commence par 05/06/07).', 'warn');
    return;
  }
  inp.style.borderColor = '';
  inp.style.boxShadow   = '';

  const btn = document.getElementById('btn-pay-submit');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Traitement en cours…`;

  setTimeout(() => {
    const ref = `FISCA-${STATE.annee}${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.floor(Math.random()*9000+1000)}`;
    STATE.rapportRef      = ref;
    STATE.rapportUnlocked = true;

    // Sauvegarder la période courante dans l'historique
    sauvegarderPeriode(ref);
    saveState();

    document.getElementById('pay-body').innerHTML = `
      <div class="pay-success">
        <div class="pay-success-icon">${icon('checkCircle','success-check')}</div>
        <h3>Paiement confirmé !</h3>
        <p>Votre rapport <strong>${periodeLabel()}</strong> est généré.</p>
        <div class="pay-txn">Réf : ${ref}<br>Débité : 2 030 FCFA · Orange Money ****${phone.slice(-4)}</div>
        <button class="btn-pay" onclick="closePayModal(); showView('rapport');">
          ${icon('fileText')} Voir le rapport
        </button>
        <button class="btn-pay-cancel" onclick="closePayModal()">Fermer</button>
      </div>`;
  }, 2200);
}

/* =====================================================
   UTILITAIRES
   ===================================================== */
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) { el.textContent = val; }
  else { console.warn(`[FISCA] setEl: élément introuvable — id="${id}"`); }
}
function setElHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function showToast(msg, type = 'info') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  const colorMap = { ok:'#24a05a', error:'#ef4444', warn:'#f97316', info:'#3b82f6' };
  toast.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:${colorMap[type]||'#374151'};
    color:#fff;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;
    box-shadow:0 4px 20px rgba(0,0,0,.2);opacity:1;transition:opacity .4s;max-width:340px;`;
  toast.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

/* =====================================================
   PERSISTANCE LOCALSTORAGE
   ===================================================== */
const STORAGE_KEY = 'fisca_state_v1';

function saveState() {
  try {
    const toSave = {
      employees:       STATE.employees,
      historique:      STATE.historique,
      company:         STATE.company,
      mois:            STATE.mois,
      annee:           STATE.annee,
      cotisation:      STATE.cotisation,
      rapportUnlocked: STATE.rapportUnlocked,
      rapportRef:      STATE.rapportRef,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch(e) { /* quota dépassé ou navigation privée */ }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved.employees) && saved.employees.length) STATE.employees = saved.employees;
    if (Array.isArray(saved.historique) && saved.historique.length) STATE.historique = saved.historique;
    if (saved.company)         Object.assign(STATE.company, saved.company);
    if (saved.mois)            STATE.mois            = saved.mois;
    if (saved.annee)           STATE.annee           = saved.annee;
    if (saved.cotisation)      STATE.cotisation      = saved.cotisation;
    if (saved.rapportUnlocked) STATE.rapportUnlocked = saved.rapportUnlocked;
    if (saved.rapportRef)      STATE.rapportRef      = saved.rapportRef;
  } catch(e) { console.warn('[FISCA] loadState: données corrompues, réinitialisation.'); }
}

function resetState() {
  if (!confirm('Réinitialiser toutes les données ? Cette action est irréversible.')) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

/* =====================================================
   VALIDATION DES FORMULAIRES
   ===================================================== */
function validateEmployee(emp, i) {
  const errors = [];
  if (!emp.nom || emp.nom.trim().length < 2)
    errors.push({ field: `nom-${i}`,     msg: 'Nom requis (min. 2 caractères)' });
  if (!emp.base || emp.base <= 0)
    errors.push({ field: `base-${i}`,    msg: 'Salaire de base requis' });
  if (emp.base < 0)
    errors.push({ field: `base-${i}`,    msg: 'Salaire ne peut pas être négatif' });
  if (emp.charges < 0 || emp.charges > PARAMS.MAX_CHARGES)
    errors.push({ field: `charges-${i}`, msg: `Charges entre 0 et ${PARAMS.MAX_CHARGES}` });
  ['anciennete','heures','logement','transport','fonction'].forEach(f => {
    if ((+emp[f] || 0) < 0)
      errors.push({ field: `${f}-${i}`, msg: `${f} ne peut pas être négatif` });
  });
  return errors;
}

function showFieldErrors(i) {
  const block = document.getElementById(`emp-block-${i}`);
  if (!block) return;
  block.querySelectorAll('.field-error-msg').forEach(el => el.remove());
  block.querySelectorAll('.form-group.has-error').forEach(el => el.classList.remove('has-error'));
  validateEmployee(STATE.employees[i], i).forEach(err => {
    const input = document.getElementById(err.field);
    if (!input) return;
    const group = input.closest('.form-group');
    if (group) {
      group.classList.add('has-error');
      const msg = document.createElement('span');
      msg.className = 'field-error-msg';
      msg.textContent = err.msg;
      group.appendChild(msg);
    }
  });
}

function validateAllEmployees() {
  let valid = true;
  STATE.employees.forEach((_, i) => {
    const errs = validateEmployee(STATE.employees[i], i);
    if (errs.length) { showFieldErrors(i); valid = false; }
  });
  if (!valid) showToast('Veuillez corriger les erreurs dans le formulaire.', 'warn');
  return valid;
}

/* =====================================================
   SAUVEGARDE DE PÉRIODE
   ===================================================== */
function sauvegarderPeriode(ref) {
  const t      = calcTotaux();
  const label  = periodeLabel();
  const today  = new Date().toLocaleDateString('fr-BF', { day:'2-digit', month:'short', year:'numeric' });
  const entry  = {
    periode:  label,
    nb:       STATE.employees.length,
    brut:     t.totBrut,
    iuts:     t.totIutsNet,
    tpa:      t.totTpa,
    cnss:     t.totCotSoc,
    total:    t.totIutsNet + t.totTpa + t.totCotSoc,
    date:     today,
    statut:   'ok',
    ref:      ref,
    snapshot: JSON.parse(JSON.stringify(STATE.employees)),
  };
  const existing = STATE.historique.find(h => h.periode === label);
  if (existing) { Object.assign(existing, entry); }
  else { STATE.historique.push(entry); }
  saveState();
  renderHistorique();
  renderDashboard();
}

/* =====================================================
   PARAMÈTRES SOCIÉTÉ
   ===================================================== */
function renderParametres() {
  ['nom','ifu','rc','secteur','adresse','tel'].forEach(f => {
    const el = document.getElementById(`param-${f}`);
    if (el) el.value = STATE.company[f] || '';
  });
  const selCot = document.getElementById('param-cotisation');
  if (selCot) selCot.value = STATE.cotisation;
  const selMois = document.getElementById('param-mois');
  if (selMois) selMois.value = STATE.mois;
  const inpAnnee = document.getElementById('param-annee');
  if (inpAnnee) inpAnnee.value = STATE.annee;
}

function sauvegarderParametres() {
  const fields = ['nom','ifu','rc','secteur','adresse','tel'];
  fields.forEach(f => {
    const el = document.getElementById(`param-${f}`);
    if (el && el.value.trim()) STATE.company[f] = el.value.trim();
  });
  const selCot = document.getElementById('param-cotisation');
  if (selCot) STATE.cotisation = selCot.value;
  const selMois = document.getElementById('param-mois');
  if (selMois) STATE.mois = selMois.value;
  const inpAnnee = document.getElementById('param-annee');
  if (inpAnnee && +inpAnnee.value > 2000) STATE.annee = +inpAnnee.value;

  // Sync sidebar user card
  const uName = document.querySelector('.user-info strong');
  const uIfu  = document.querySelector('.user-info span');
  if (uName) uName.textContent = STATE.company.nom;
  if (uIfu)  uIfu.textContent  = 'IFU ' + STATE.company.ifu;

  saveState();
  renderDashboard();
  showToast('Paramètres enregistrés avec succès.', 'ok');
}

/* =====================================================
   BILAN ANNUEL
   ===================================================== */
function renderBilan() {
  const soldees  = STATE.historique.filter(h => h.statut === 'ok');
  const totalIuts  = soldees.reduce((s, h) => s + (h.iuts  || 0), 0);
  const totalTpa   = soldees.reduce((s, h) => s + (h.tpa   || 0), 0);
  const totalCnss  = soldees.reduce((s, h) => s + (h.cnss  || 0), 0);
  const totalBrut  = soldees.reduce((s, h) => s + (h.brut  || 0), 0);
  const totalVerse = soldees.reduce((s, h) => s + (h.total || 0), 0);

  setEl('bilan-iuts',     fmt(totalIuts));
  setEl('bilan-tpa',      fmt(totalTpa));
  setEl('bilan-cnss',     fmt(totalCnss));
  setEl('bilan-brut',     fmt(totalBrut));
  setEl('bilan-verse',    fmt(totalVerse));
  setEl('bilan-annee',    STATE.annee);
  setEl('bilan-annee2',   STATE.annee);
  setEl('bilan-nb-mois',  soldees.length + ' mois déclarés');

  // Pénalités sur retards
  const retards = calcPenalitesHistorique(STATE.historique);
  if (retards.length > 0) {
    const totalPen = retards.reduce((s, r) => s + r.totalPenalites, 0);
    setEl('bilan-penalites', fmt(totalPen));
    const penEl = document.getElementById('bilan-penalites-block');
    if (penEl) penEl.style.display = 'block';
    const penDetail = document.getElementById('bilan-penalites-detail');
    if (penDetail) {
      penDetail.innerHTML = retards.map(r =>
        `<li>${r.periode} : IUTS +${fmt(r.penaliteIuts)}, CNSS +${fmt(r.penaliteCnss)} (${r.nbMoisRetard} mois)</li>`
      ).join('');
    }
  } else {
    const penEl = document.getElementById('bilan-penalites-block');
    if (penEl) penEl.style.display = 'none';
  }
}

/* =====================================================
   SIDEBAR MOBILE
   ===================================================== */
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('sidebar-open');
  document.querySelector('.sidebar-overlay').classList.toggle('active');
}

/* =====================================================
   INITIALISATION
   ===================================================== */
window.addEventListener('DOMContentLoaded', () => {
  // Attacher handlers nav
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.addEventListener('click', () => showView(el.dataset.view));
  });

  // Fermer modals au clic extérieur
  ['pay-modal','import-modal'].forEach(id => {
    const m = document.getElementById(id);
    if (m) m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
  });

  // Charger l'état persisté en premier
  loadState();

  setupImportZone();
  renderSaisie();
  renderDashboard();
  renderCalcul();
  renderRapport();
  renderHistorique();

  showView('dashboard');
});
