import { initAuth, requireAuth }         from '../core/auth.js';
import { mountSidebar }                  from '../layout/sidebar.js';
import { mountTopbar }                   from '../layout/topbar.js';
import { mountFooter }                   from '../layout/footer.js';
import { startRouter, route, navigate }  from '../core/router.js';
import { mountDashboard }                from '../modules/dashboard/dashboard.js';
import { mountPatientList }              from '../modules/patient/patient-list.js';
import { mountPatientRecord }            from '../modules/patient/patient-record.js';
import { mountAgenda }                   from '../modules/agenda/agenda.js';
import { mountAdmin }                    from '../modules/admin/admin.js';
import { mountTransmissions }            from '../modules/transmissions/transmissions.js';
import { mountTournee }                  from '../modules/tournee/tournee.js';
import { mountSoins }                    from '../modules/soins/soins.js';
import { mountTraitements }              from '../modules/traitements/traitements.js';
import { mountStats }                    from '../modules/stats/stats.js';
import { mountRgpd }                     from '../modules/rgpd/rgpd.js';
import { subscribe, removeNotification, getRole } from '../core/state.js';

(async () => {
  // 1. Vérifier l'authentification — si absent, redirige vers login?fresh=1
  await initAuth();
  if (!await requireAuth()) return;

  // 2. Monter le shell (sidebar, topbar, footer)
  mountSidebar();
  mountTopbar();
  mountFooter();

  // 3. Toasts
  subscribe('notifications', (notifs) => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    container.innerHTML = notifs.map(n => `
      <div class="toast toast--${n.type}" data-id="${n.id}">
        <strong>${n.title}</strong>${n.message ? `<span>${n.message}</span>` : ''}
      </div>`).join('');
    container.querySelectorAll('.toast').forEach(t => {
      setTimeout(() => { removeNotification(t.dataset.id); t.remove(); }, 4000);
    });
  });

  // 4. Routes
  route('tournee',       () => mountTournee(),       { permission: 'tournee.read' });
  route('transmissions', () => mountTransmissions(), { permission: 'transmission.read' });
  route('soins',         () => mountSoins(),         { permission: 'soin.read' });
  route('traitements',   () => mountTraitements(),   { permission: 'traitement.read' });
  route('dashboard',     () => mountDashboard());
  route('patients',      () => mountPatientList(),   { permission: 'patient.read' });
  route('patient',       () => mountPatientRecord(), { permission: 'patient.read' });
  route('agenda',        () => mountAgenda(),        { permission: 'agenda.read' });
  route('consultations', () => mountPatientList(),   { permission: 'consultation.read' });
  route('ordonnances',   () => mountPatientList(),   { permission: 'ordonnance.read' });
  route('stats',         () => mountStats(),         { permission: 'stat.read' });
  route('admin',         () => mountAdmin(),         { permission: 'admin.access' });
  route('rgpd',          () => mountRgpd(),          { permission: 'rgpd.dashboard.read' });

  // 5. DPO : atterrissage par défaut sur le dashboard RGPD plutôt que
  // sur #dashboard (auquel il n'a jamais eu accès backend, cf.
  // routes/dashboard.js ROLES_LECTURE).
  if (getRole() === 'dpo' && !window.location.hash) {
    window.location.hash = 'rgpd';
  }

  // 6. Démarrer le routeur
  startRouter();
})().catch(err => {
  console.error('[candy-e] Erreur démarrage :', err);
  const main = document.getElementById('main-content');
  if (main) main.innerHTML = `
    <div style="text-align:center;padding:4rem 2rem;">
      <div style="font-size:3rem;margin-bottom:1rem">⚠️</div>
      <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:.5rem">Erreur de démarrage</h2>
      <p style="color:var(--color-text-muted);font-family:monospace;font-size:.8125rem;">${err?.message ?? err}</p>
      <a href="login.html?fresh=1" style="display:inline-block;margin-top:1.5rem;color:var(--color-primary);">
        → Retour à la connexion
      </a>
    </div>`;
});
