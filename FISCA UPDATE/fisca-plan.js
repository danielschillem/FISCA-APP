/* =====================================================
   FISCA — Système de plans & feature gating
   Starter · Pro · Entreprise
   ===================================================== */

const PLANS = {
  starter: {
    label: 'Starter', emoji: 'S',
    price: 'Gratuit', priceDetail: '+ 2 000 FCFA / rapport',
    color: '#6b7280', colorLight: '#f3f4f6',
    features: new Set([
      'dashboard','saisie','calcul','rapport','historique',
      'export-csv','parametres',
    ]),
    limits: { employees: 5, historyMonths: 3 },
    description: 'Pour les auto-entrepreneurs et micro-entreprises',
  },
  pro: {
    label: 'Pro', emoji: 'P',
    price: '15 000 FCFA', priceDetail: '/ mois · rapports inclus',
    color: '#24a05a', colorLight: '#e6f9ed',
    features: new Set([
      'dashboard','saisie','calcul','rapport','historique','bilan',
      'export-csv','parametres',
      'bulletin','simulateur','tva','import','n1-copy',
      'notifications','assistant','multi-payment',
      'wave','mtn-momo','virement',
    ]),
    limits: { employees: 50, historyMonths: 12 },
    description: 'Pour les PME et cabinets comptables',
  },
  enterprise: {
    label: 'Entreprise', emoji: 'E',
    price: 'Sur devis', priceDetail: 'engagement annuel',
    color: '#f97316', colorLight: '#fff7ed',
    features: new Set([
      'dashboard','saisie','calcul','rapport','historique','bilan',
      'export-csv','parametres',
      'bulletin','simulateur','tva','import','n1-copy',
      'notifications','assistant','multi-payment',
      'wave','mtn-momo','virement',
      'multi-company','workflow','ras','cnss-patronal',
      'api-webhooks','audit-trail','white-label','dgi-connect',
      'roles','archivage',
    ]),
    limits: { employees: Infinity, historyMonths: 120 },
    description: 'Pour les grands comptes et groupes multi-entités',
  },
};

/* Plan actif (modifiable en démo) */
let CURRENT_PLAN = 'starter';

function can(feature) {
  return PLANS[CURRENT_PLAN].features.has(feature);
}

function planLimit(key) {
  return PLANS[CURRENT_PLAN].limits[key];
}

/* =====================================================
   SWITCHING DE PLAN (demo)
   ===================================================== */
function switchPlan(plan) {
  CURRENT_PLAN = plan;
  // Màj boutons demo bar
  document.querySelectorAll('.demo-plan-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.plan === plan);
  });
  // Màj badge sidebar
  const badge = document.getElementById('plan-badge');
  if (badge) {
    const p = PLANS[plan];
    badge.textContent = p.label;
    badge.style.background = p.color;
  }
  // Màj nav : afficher/cacher items selon plan
  updateNavByPlan();
  // Toast
  showToast(`Plan ${PLANS[plan].label} activé — fonctionnalités mises à jour.`, 'info');
  // Si la vue courante n'est pas accessible, revenir au dashboard
  const active = document.querySelector('.view.active');
  if (active) {
    const viewName = active.id.replace('view-','');
    if (!can(viewName)) showView('dashboard');
  }
}

function updateNavByPlan() {
  document.querySelectorAll('.nav-item[data-feature]').forEach(el => {
    const feat = el.dataset.feature;
    const locked = !can(feat);
    el.classList.toggle('nav-locked', locked);
    // Màj badge lock
    let lockBadge = el.querySelector('.nav-lock');
    if (locked && !lockBadge) {
      lockBadge = document.createElement('span');
      lockBadge.className = 'nav-lock';
      lockBadge.innerHTML = icon('lock');
      el.appendChild(lockBadge);
    } else if (!locked && lockBadge) {
      lockBadge.remove();
    }
  });
}

/* =====================================================
   MODAL UPGRADE
   ===================================================== */
function showUpgradeModal(targetPlan) {
  const modal = document.getElementById('upgrade-modal');
  if (!modal) return;
  renderUpgradeModal(targetPlan || 'pro');
  modal.classList.add('open');
}

function closeUpgradeModal() {
  document.getElementById('upgrade-modal').classList.remove('open');
}

function renderUpgradeModal(highlight) {
  const body = document.getElementById('upgrade-modal-body');
  if (!body) return;

  const planOrder = ['starter','pro','enterprise'];
  const featMatrix = [
    { label: 'Employés',              starter: '5 max',    pro: '50 max',     ent: 'Illimité' },
    { label: 'Rapports IUTS mensuels',starter: 'Payant',   pro: 'Inclus',     ent: 'Inclus' },
    { label: 'Bulletin de paie PDF',  starter: false,      pro: true,         ent: true },
    { label: 'Import CSV / XLSX',     starter: false,      pro: true,         ent: true },
    { label: 'Copy mois précédent',   starter: false,      pro: true,         ent: true },
    { label: 'Simulateur fiscal',     starter: false,      pro: true,         ent: true },
    { label: 'Module TVA',            starter: false,      pro: true,         ent: true },
    { label: 'Assistant IA fiscal',   starter: false,      pro: true,         ent: true },
    { label: 'Wave / MTN MoMo',       starter: false,      pro: true,         ent: true },
    { label: 'Bilan annuel PDF',      starter: false,      pro: true,         ent: true },
    { label: 'Multi-sociétés',        starter: false,      pro: false,        ent: true },
    { label: 'Workflow approbation',  starter: false,      pro: false,        ent: true },
    { label: 'Retenue à la source',   starter: false,      pro: false,        ent: true },
    { label: 'CNSS patronal complet', starter: false,      pro: false,        ent: true },
    { label: 'API & Webhooks',        starter: false,      pro: false,        ent: true },
    { label: 'Connexion DGI directe', starter: false,      pro: false,        ent: true },
    { label: 'Audit trail complet',   starter: false,      pro: false,        ent: true },
    { label: 'Archivage 10 ans',      starter: false,      pro: false,        ent: true },
  ];

  const cell = (val) => {
    if (val === true)  return `<td class="uc-yes">${icon('check')}</td>`;
    if (val === false) return `<td class="uc-no">—</td>`;
    return `<td class="uc-val">${val}</td>`;
  };

  body.innerHTML = `
    <table class="upgrade-table">
      <thead>
        <tr>
          <th>Fonctionnalité</th>
          ${planOrder.map(k => {
            const p = PLANS[k];
            const isHL = k === highlight;
            return `<th class="${isHL?'uc-highlight':''}">
              <div class="uc-plan-name" style="color:${p.color}">${p.label}</div>
              <div class="uc-plan-price">${p.price}</div>
              <div class="uc-plan-detail">${p.priceDetail}</div>
              <button class="uc-btn" style="background:${p.color}" onclick="switchPlan('${k}'); closeUpgradeModal();">
                ${CURRENT_PLAN === k ? 'Plan actuel' : 'Activer (démo)'}
              </button>
            </th>`;
          }).join('')}
        </tr>
      </thead>
      <tbody>
        ${featMatrix.map(f => `<tr>
          <td class="uc-feat">${f.label}</td>
          ${cell(f.starter)}${cell(f.pro)}${cell(f.ent)}
        </tr>`).join('')}
      </tbody>
    </table>`;
}

/* =====================================================
   GATE VIEW — overlay pour vues verrouillées
   ===================================================== */
function gateView(viewName, requiredPlan) {
  if (can(viewName)) return false; // accessible
  const el = document.getElementById(`view-${viewName}`);
  if (!el) return true;
  const p = PLANS[requiredPlan];
  el.innerHTML = `
    <div class="gate-fullscreen">
      <div class="gate-box">
        <div class="gate-icon" style="color:${p.color}">${icon('lock')}</div>
        <h2>Fonctionnalité <span style="color:${p.color}">${p.label}</span></h2>
        <p>${p.description}</p>
        <div class="gate-features">
          ${[...p.features].slice(0,6).map(f => `<span class="gate-feat">${icon('check')} ${f}</span>`).join('')}
        </div>
        <div class="gate-actions">
          <button class="btn btn-primary" style="background:${p.color};border-color:${p.color}" onclick="showUpgradeModal('${requiredPlan}')">
            ${icon('trendingUp')} Voir les plans
          </button>
          <button class="btn btn-outline" onclick="showView('dashboard')">Retour</button>
        </div>
        <p class="gate-demo-note">En mode démo : <button class="gate-demo-btn" onclick="switchPlan('${requiredPlan}'); showView('${viewName}')">Activer ${p.label} maintenant</button></p>
      </div>
    </div>`;
  return true;
}
