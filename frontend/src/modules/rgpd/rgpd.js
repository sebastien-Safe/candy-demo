/**
 * [ candy-e ] — MODULE RGPD (dashboard DPO)
 * Fichier : frontend/src/modules/rgpd/rgpd.js
 *
 * Accessible à dpo et super_admin (cf. routes/rgpd.js). 5 sections : vue
 * d'ensemble, file de purge (approbation/rejet à confirmation deux-clics,
 * suppression définitive et irréversible), demandes de droits (export PDF
 * réel pour accès/portabilité), violations (déclaration, liaison aux logs
 * d'audit, dossier CNIL PDF, notification des personnes concernées),
 * registre des traitements (édité en base, jamais un fichier statique).
 */

import { api } from '../../core/api.js';
import { addNotification } from '../../core/state.js';
import { formatDateTime } from '../../utils/date.js';

const SECTIONS = [
  { id: 'overview', label: '📊 Vue d\'ensemble' },
  { id: 'purge', label: '🗑️ File de purge' },
  { id: 'requests', label: '📨 Demandes de droits' },
  { id: 'breaches', label: '🚨 Violations' },
  { id: 'registre', label: '📘 Registre des traitements' },
];

export async function mountRgpd() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div class="page-header">
      <div class="page-header__eyebrow">Conformité</div>
      <h1 class="page-header__title">RGPD — Tableau de bord DPO</h1>
    </div>
    <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-6);flex-wrap:wrap;">
      ${SECTIONS.map((s, i) => `
        <button class="btn ${i === 0 ? 'btn--primary' : 'btn--outline'} btn--sm rgpd-tab" data-section="${s.id}">${s.label}</button>
      `).join('')}
    </div>
    <div id="rgpd-content">
      <div style="text-align:center;padding:var(--space-6);color:var(--color-text-muted);">Chargement…</div>
    </div>
  `;

  document.querySelectorAll('.rgpd-tab').forEach((btn) => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.rgpd-tab').forEach((b) => {
        b.classList.remove('active', 'btn--primary');
        b.classList.add('btn--outline');
      });
      btn.classList.add('active', 'btn--primary');
      btn.classList.remove('btn--outline');
      await _loadSection(btn.dataset.section);
    });
  });

  await _loadSection('overview');
}

async function _loadSection(section) {
  const fn = { overview: _loadOverview, purge: _loadPurge, requests: _loadRequests, breaches: _loadBreaches, registre: _loadRegistre }[section];
  if (fn) await fn();
}

function _erreur(msg) {
  return `<div class="table-empty"><div class="table-empty__icon">⚠️</div><div class="table-empty__text">${msg}</div></div>`;
}

// ── Vue d'ensemble ───────────────────────────────────────────────────────

async function _loadOverview() {
  const el = document.getElementById('rgpd-content');
  if (!el) return;

  let d;
  try {
    d = await api.get('/rgpd/dashboard');
  } catch (err) {
    el.innerHTML = _erreur(err.message);
    return;
  }

  const carte = (titre, contenu) => `
    <div class="card" style="flex:1;min-width:220px;">
      <div class="card__header"><div class="card__title">${titre}</div></div>
      <div style="padding:var(--space-4);">${contenu}</div>
    </div>`;

  el.innerHTML = `
    <div style="display:flex;gap:var(--space-4);flex-wrap:wrap;">
      ${carte('Dernière purge automatique', d.purge.lastRun?.last_run_at
        ? `${formatDateTime(d.purge.lastRun.last_run_at)}<br/><span class="badge badge--${d.purge.lastRun.last_status === 'success' ? 'success' : 'neutral'}">${d.purge.lastRun.last_status ?? '—'}</span>`
        : 'Jamais exécutée')}
      ${carte('Dossiers en attente de validation', `<span style="font-size:1.5rem;font-weight:700;">${d.purge.pendingApprovals.length}</span> résident(s)`)}
      ${carte('Activité 30 derniers jours', `${d.auditStats30j.total} actions — ${d.auditStats30j.echecs} échec(s) — ${d.auditStats30j.acteurs_uniques} acteur(s)`)}
      ${carte('Violations ouvertes', `<span style="font-size:1.5rem;font-weight:700;">${d.breachesOuvertes.length}</span>`)}
      ${carte('Demandes de droits', `${d.requests.ouvertes} ouverte(s), dont <strong>${d.requests.en_retard} en retard</strong>`)}
      ${carte('Registre des traitements', `${d.registre.nb_traitements} entrée(s)<br/><span style="font-size:.75rem;color:var(--color-text-muted);">Dernière maj : ${d.registre.derniere_maj ? formatDateTime(d.registre.derniere_maj) : '—'}</span>`)}
    </div>
    ${d.purge.pendingApprovals.length > 0 ? `
      <div class="card" style="margin-top:var(--space-4);">
        <div class="card__header"><div class="card__title">Dossiers résidents en attente de validation</div></div>
        <div class="table-wrapper" style="border:none;border-radius:0;box-shadow:none;">
          <table class="table">
            <thead><tr><th>Résident</th><th>Sortie</th><th>Marqué le</th></tr></thead>
            <tbody>
              ${d.purge.pendingApprovals.map((r) => `
                <tr><td>${r.nom} ${r.prenom}</td><td>${r.discharge_date ?? '—'}</td><td>${formatDateTime(r.purge_scheduled_at)}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}
  `;
}

// ── File de purge ────────────────────────────────────────────────────────

async function _loadPurge() {
  const el = document.getElementById('rgpd-content');
  if (!el) return;

  let data;
  try {
    data = await api.get('/rgpd/purge/pending');
  } catch (err) {
    el.innerHTML = _erreur(err.message);
    return;
  }

  el.innerHTML = `
    <div class="card">
      <div class="card__header">
        <div class="card__title">Dossiers résidents ayant atteint le délai légal de conservation (20 ans)</div>
      </div>
      <div class="table-wrapper" style="border:none;border-radius:0;box-shadow:none;">
        <table class="table">
          <thead><tr><th>Résident</th><th>Date de sortie</th><th>Marqué le</th><th>Actions</th></tr></thead>
          <tbody>
            ${!data.length
              ? `<tr><td colspan="4"><div class="table-empty"><div class="table-empty__text">Aucun dossier en attente</div></div></td></tr>`
              : data.map((r) => `
                <tr>
                  <td style="font-weight:500;">${r.nom} ${r.prenom}</td>
                  <td>${r.discharge_date ?? '—'}</td>
                  <td>${formatDateTime(r.purge_scheduled_at)}</td>
                  <td>
                    <div class="table__actions">
                      <button class="btn btn--outline btn--sm btn-reject-purge" data-id="${r.id}" data-nom="${r.nom} ${r.prenom}">Rejeter</button>
                      <button class="btn btn--sm btn-approve-purge" style="background:var(--color-danger,#e53e3e);color:#fff;" data-id="${r.id}" data-nom="${r.nom} ${r.prenom}">Approuver la suppression</button>
                    </div>
                  </td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.querySelectorAll('.btn-reject-purge').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!window.confirm(`Rejeter la purge du dossier de ${btn.dataset.nom} ? Le dossier reste conservé.`)) return;
      try {
        await api.post(`/rgpd/purge/${btn.dataset.id}/reject`);
        addNotification({ type: 'success', title: 'Purge rejetée', message: btn.dataset.nom });
        await _loadPurge();
      } catch (err) {
        addNotification({ type: 'danger', title: 'Erreur', message: err.message });
      }
    });
  });

  document.querySelectorAll('.btn-approve-purge').forEach((btn) => {
    btn.addEventListener('click', () => _confirmerPurgeDeuxEtapes(btn.dataset.id, btn.dataset.nom));
  });
}

// Confirmation à deux étapes explicites — pas une simple popup navigateur :
// le serveur exige lui-même le jeton "SUPPRESSION_DEFINITIVE" (cf.
// routes/rgpd.js), ce modal n'est pas qu'un habillage UI.
function _confirmerPurgeDeuxEtapes(residentId, nom) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <div class="modal__title">⚠️ Suppression définitive — étape 1/2</div>
      </div>
      <div class="modal__body">
        <p>Vous allez supprimer <strong>définitivement et irréversiblement</strong> le dossier de <strong>${nom}</strong> (délai légal de conservation de 20 ans atteint).</p>
        <p style="color:var(--color-danger,#e53e3e);">Cette action ne peut pas être annulée. Toutes les données cliniques associées seront supprimées.</p>
      </div>
      <div class="modal__footer">
        <button class="btn btn--outline" id="purge-annuler-1">Annuler</button>
        <button class="btn" style="background:var(--color-danger,#e53e3e);color:#fff;" id="purge-continuer">Continuer</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);

  const fermer = () => backdrop.remove();
  backdrop.querySelector('#purge-annuler-1').addEventListener('click', fermer);

  backdrop.querySelector('#purge-continuer').addEventListener('click', () => {
    fermer();
    const backdrop2 = document.createElement('div');
    backdrop2.className = 'modal-backdrop';
    backdrop2.innerHTML = `
      <div class="modal">
        <div class="modal__header"><div class="modal__title">⚠️ Suppression définitive — étape 2/2</div></div>
        <div class="modal__body">
          <p>Dernière confirmation. Tapez <strong>SUPPRIMER</strong> pour confirmer la suppression du dossier de ${nom}.</p>
          <input class="input" type="text" id="purge-confirmation-texte" placeholder="SUPPRIMER" />
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" id="purge-annuler-2">Annuler</button>
          <button class="btn" style="background:var(--color-danger,#e53e3e);color:#fff;" id="purge-confirmer-final">Confirmer la suppression définitive</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop2);

    const fermer2 = () => backdrop2.remove();
    backdrop2.querySelector('#purge-annuler-2').addEventListener('click', fermer2);
    backdrop2.querySelector('#purge-confirmer-final').addEventListener('click', async () => {
      const texte = document.getElementById('purge-confirmation-texte')?.value;
      if (texte !== 'SUPPRIMER') {
        addNotification({ type: 'warning', title: 'Confirmation incorrecte', message: 'Tapez exactement SUPPRIMER' });
        return;
      }
      try {
        await api.post(`/rgpd/purge/${residentId}/approve`, { confirmation: 'SUPPRESSION_DEFINITIVE' });
        addNotification({ type: 'success', title: 'Dossier supprimé définitivement', message: nom });
        fermer2();
        await _loadPurge();
      } catch (err) {
        addNotification({ type: 'danger', title: 'Erreur', message: err.message });
      }
    });
  });
}

// ── Demandes de droits ───────────────────────────────────────────────────

async function _loadRequests() {
  const el = document.getElementById('rgpd-content');
  if (!el) return;

  let data;
  try {
    data = await api.get('/rgpd/requests');
  } catch (err) {
    el.innerHTML = _erreur(err.message);
    return;
  }

  const STATUTS = ['recue', 'en_cours', 'traitee', 'rejetee'];

  el.innerHTML = `
    <div class="card">
      <div class="card__header">
        <div class="card__title">Demandes d'exercice de droits (Art. 15-22 RGPD)</div>
        <button class="btn btn--primary btn--sm" id="btn-new-request">+ Nouvelle demande</button>
      </div>
      <div class="table-wrapper" style="border:none;border-radius:0;box-shadow:none;">
        <table class="table">
          <thead><tr><th>Type</th><th>Demandeur</th><th>Reçue le</th><th>Échéance</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            ${!data.length
              ? `<tr><td colspan="6"><div class="table-empty"><div class="table-empty__text">Aucune demande</div></div></td></tr>`
              : data.map((r) => `
                <tr>
                  <td><span class="badge badge--neutral">${r.type}</span></td>
                  <td>${r.demandeur_nom}</td>
                  <td style="font-size:.8125rem;">${formatDateTime(r.date_reception)}</td>
                  <td style="font-size:.8125rem;${new Date(r.date_echeance) < new Date() && !['traitee','rejetee'].includes(r.statut) ? 'color:var(--color-danger,#e53e3e);font-weight:600;' : ''}">${formatDateTime(r.date_echeance)}</td>
                  <td>
                    <select class="select select--sm select-statut-demande" data-id="${r.id}">
                      ${STATUTS.map((s) => `<option value="${s}" ${s === r.statut ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                  </td>
                  <td>
                    ${['acces', 'portabilite'].includes(r.type) && r.resident_id
                      ? `<button class="btn btn--ghost btn--sm btn-export-request" data-id="${r.id}">📄 Export PDF</button>`
                      : ''}
                  </td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="modal-backdrop hidden" id="request-modal">
      <div class="modal">
        <div class="modal__header">
          <div class="modal__title">Nouvelle demande</div>
          <button class="modal__close" id="request-modal-close">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label class="label label--required">Type de demande</label>
            <select class="select" id="r-type">
              <option value="acces">Droit d'accès</option>
              <option value="rectification">Rectification</option>
              <option value="effacement">Effacement</option>
              <option value="portabilite">Portabilité</option>
              <option value="opposition">Opposition</option>
              <option value="limitation">Limitation</option>
            </select>
          </div>
          <div class="form-group">
            <label class="label label--required">Nom du demandeur</label>
            <input class="input" type="text" id="r-nom" />
          </div>
          <div class="form-group">
            <label class="label">Email du demandeur</label>
            <input class="input" type="email" id="r-email" />
          </div>
          <div class="form-group">
            <label class="label">ID résident concerné (si applicable)</label>
            <input class="input" type="text" id="r-resident" placeholder="UUID du résident" />
          </div>
          <div class="form-group">
            <label class="label">Description</label>
            <textarea class="input" id="r-description" rows="3"></textarea>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" id="r-cancel">Annuler</button>
          <button class="btn btn--primary" id="r-save">Enregistrer</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-new-request')?.addEventListener('click', () => {
    document.getElementById('request-modal')?.classList.remove('hidden');
  });
  document.getElementById('request-modal-close')?.addEventListener('click', () => {
    document.getElementById('request-modal')?.classList.add('hidden');
  });
  document.getElementById('r-cancel')?.addEventListener('click', () => {
    document.getElementById('request-modal')?.classList.add('hidden');
  });
  document.getElementById('r-save')?.addEventListener('click', async () => {
    const type = document.getElementById('r-type')?.value;
    const demandeurNom = document.getElementById('r-nom')?.value.trim();
    const demandeurEmail = document.getElementById('r-email')?.value.trim() || null;
    const residentId = document.getElementById('r-resident')?.value.trim() || null;
    const description = document.getElementById('r-description')?.value.trim() || null;

    if (!demandeurNom) {
      addNotification({ type: 'warning', title: 'Champ requis', message: 'Le nom du demandeur est obligatoire.' });
      return;
    }

    try {
      await api.post('/rgpd/requests', { type, demandeurNom, demandeurEmail, residentId, description });
    } catch (err) {
      addNotification({ type: 'danger', title: 'Erreur', message: err.message });
      return;
    }

    addNotification({ type: 'success', title: 'Demande enregistrée' });
    document.getElementById('request-modal')?.classList.add('hidden');
    await _loadRequests();
  });

  document.querySelectorAll('.select-statut-demande').forEach((sel) => {
    sel.addEventListener('change', async () => {
      try {
        await api.patch(`/rgpd/requests/${sel.dataset.id}`, { statut: sel.value });
        addNotification({ type: 'success', title: 'Statut mis à jour' });
      } catch (err) {
        addNotification({ type: 'danger', title: 'Erreur', message: err.message });
      }
    });
  });

  document.querySelectorAll('.btn-export-request').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api.telecharger(`/rgpd/requests/${btn.dataset.id}/export`, `export-rgpd-${btn.dataset.id}.pdf`);
      } catch (err) {
        addNotification({ type: 'danger', title: 'Erreur export', message: err.message });
      }
    });
  });
}

// ── Violations ────────────────────────────────────────────────────────────

async function _loadBreaches() {
  const el = document.getElementById('rgpd-content');
  if (!el) return;

  let data;
  try {
    data = await api.get('/rgpd/breaches');
  } catch (err) {
    el.innerHTML = _erreur(err.message);
    return;
  }

  el.innerHTML = `
    <div class="card">
      <div class="card__header">
        <div class="card__title">Registre des violations (Art. 33-34 RGPD)</div>
        <button class="btn btn--primary btn--sm" id="btn-new-breach">+ Déclarer une violation</button>
      </div>
      <div class="table-wrapper" style="border:none;border-radius:0;box-shadow:none;">
        <table class="table">
          <thead><tr><th>Nature</th><th>Déclarée le</th><th>Statut</th><th>Logs liés</th><th>Actions</th></tr></thead>
          <tbody>
            ${!data.length
              ? `<tr><td colspan="5"><div class="table-empty"><div class="table-empty__text">Aucune violation déclarée</div></div></td></tr>`
              : data.map((b) => `
                <tr>
                  <td style="max-width:280px;">${b.nature}</td>
                  <td style="font-size:.8125rem;">${formatDateTime(b.declared_at)}</td>
                  <td><span class="badge badge--neutral">${b.statut}</span></td>
                  <td>${b.audit_logs_linked_count}</td>
                  <td>
                    <div class="table__actions">
                      <button class="btn btn--ghost btn--sm btn-link-audit" data-id="${b.id}">Lier logs</button>
                      <button class="btn btn--ghost btn--sm btn-cnil-pdf" data-id="${b.id}">📄 CNIL</button>
                      <button class="btn btn--ghost btn--sm btn-notify-affected" data-id="${b.id}">✉️ Notifier</button>
                    </div>
                  </td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="modal-backdrop hidden" id="breach-modal">
      <div class="modal">
        <div class="modal__header">
          <div class="modal__title">Déclarer une violation de données</div>
          <button class="modal__close" id="breach-modal-close">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label class="label label--required">Nature de la violation</label>
            <textarea class="input" id="b-nature" rows="3"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="label">Période — début</label>
              <input class="input" type="datetime-local" id="b-debut" />
            </div>
            <div class="form-group">
              <label class="label">Période — fin</label>
              <input class="input" type="datetime-local" id="b-fin" />
            </div>
          </div>
          <div class="form-group">
            <label class="label">Volume de personnes estimé</label>
            <input class="input" type="number" id="b-volume" />
          </div>
          <div class="form-group">
            <label class="label">Conséquences probables</label>
            <textarea class="input" id="b-consequences" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label class="label">Mesures prises</label>
            <textarea class="input" id="b-mesures" rows="2"></textarea>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" id="b-cancel">Annuler</button>
          <button class="btn btn--primary" id="b-save">Déclarer</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-new-breach')?.addEventListener('click', () => {
    document.getElementById('breach-modal')?.classList.remove('hidden');
  });
  document.getElementById('breach-modal-close')?.addEventListener('click', () => {
    document.getElementById('breach-modal')?.classList.add('hidden');
  });
  document.getElementById('b-cancel')?.addEventListener('click', () => {
    document.getElementById('breach-modal')?.classList.add('hidden');
  });
  document.getElementById('b-save')?.addEventListener('click', async () => {
    const nature = document.getElementById('b-nature')?.value.trim();
    if (!nature) {
      addNotification({ type: 'warning', title: 'Champ requis', message: 'La nature de la violation est obligatoire.' });
      return;
    }
    try {
      await api.post('/rgpd/breaches', {
        nature,
        periodeDebut: document.getElementById('b-debut')?.value || null,
        periodeFin: document.getElementById('b-fin')?.value || null,
        volumePersonnesEstime: Number(document.getElementById('b-volume')?.value) || null,
        consequencesProbables: document.getElementById('b-consequences')?.value.trim() || null,
        mesuresPrises: document.getElementById('b-mesures')?.value.trim() || null,
      });
    } catch (err) {
      addNotification({ type: 'danger', title: 'Erreur', message: err.message });
      return;
    }
    addNotification({ type: 'success', title: 'Violation déclarée' });
    document.getElementById('breach-modal')?.classList.add('hidden');
    await _loadBreaches();
  });

  document.querySelectorAll('.btn-link-audit').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const r = await api.post(`/rgpd/breaches/${btn.dataset.id}/link-audit`, {});
        addNotification({ type: 'success', title: 'Logs liés', message: `${r.entriesLinkedThisCall} entrée(s) — conservation portée à 36 mois` });
        await _loadBreaches();
      } catch (err) {
        addNotification({ type: 'danger', title: 'Erreur', message: err.message });
      }
    });
  });

  document.querySelectorAll('.btn-cnil-pdf').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api.telecharger(`/rgpd/breaches/${btn.dataset.id}/cnil-pdf`, `declaration-cnil-${btn.dataset.id}.pdf`);
        await _loadBreaches();
      } catch (err) {
        addNotification({ type: 'danger', title: 'Erreur', message: err.message });
      }
    });
  });

  document.querySelectorAll('.btn-notify-affected').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const saisie = window.prompt('IDs résidents concernés, séparés par des virgules :');
      if (!saisie) return;
      const residentIds = saisie.split(',').map((s) => s.trim()).filter(Boolean);
      try {
        const r = await api.post(`/rgpd/breaches/${btn.dataset.id}/notify-affected`, { residentIds });
        const succes = r.resultats.filter((x) => x.success).length;
        addNotification({ type: succes > 0 ? 'success' : 'warning', title: 'Notification envoyée', message: `${succes}/${r.resultats.length} réussi(s)` });
      } catch (err) {
        addNotification({ type: 'danger', title: 'Erreur', message: err.message });
      }
    });
  });
}

// ── Registre des traitements ─────────────────────────────────────────────

async function _loadRegistre() {
  const el = document.getElementById('rgpd-content');
  if (!el) return;

  let data;
  try {
    data = await api.get('/rgpd/registre');
  } catch (err) {
    el.innerHTML = _erreur(err.message);
    return;
  }

  el.innerHTML = `
    <div class="card" style="margin-bottom:var(--space-4);border-left:3px solid var(--color-warning,#d69e2e);">
      <div class="card__header"><div class="card__title">⚠️ Analyse d'impact (AIPD)</div></div>
      <div style="padding:var(--space-4);">
        <textarea class="input" id="note-aipd" rows="3">${data.noteAipd?.note_aipd ?? ''}</textarea>
        <div style="margin-top:var(--space-2);display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:.75rem;color:var(--color-text-muted);">Dernière mise à jour : ${data.noteAipd?.updated_at ? formatDateTime(data.noteAipd.updated_at) : '—'}</span>
          <button class="btn btn--primary btn--sm" id="btn-save-note-aipd">Enregistrer</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card__header"><div class="card__title">Registre des traitements (Art. 30 RGPD)</div></div>
      <div class="table-wrapper" style="border:none;border-radius:0;box-shadow:none;">
        <table class="table">
          <thead><tr><th>Code</th><th>Nom</th><th>Base légale</th><th>Durée de conservation</th><th></th></tr></thead>
          <tbody>
            ${data.traitements.map((t) => `
              <tr>
                <td><span class="badge badge--neutral">${t.code}</span></td>
                <td style="font-weight:500;">${t.nom}</td>
                <td style="font-size:.8125rem;color:var(--color-text-muted);max-width:260px;">${t.base_legale}</td>
                <td style="font-size:.8125rem;">${t.duree_conservation}</td>
                <td><button class="btn btn--ghost btn--sm btn-edit-traitement" data-code="${t.code}">Modifier</button></td>
              </tr>
              <tr class="traitement-details hidden" data-code-details="${t.code}">
                <td colspan="5">
                  <div class="form-group"><label class="label">Finalité</label><textarea class="input champ-traitement" data-champ="finalite" rows="2">${t.finalite}</textarea></div>
                  <div class="form-group"><label class="label">Mesures de sécurité</label><textarea class="input champ-traitement" data-champ="mesures_securite" rows="2">${t.mesures_securite}</textarea></div>
                  <button class="btn btn--primary btn--sm btn-save-traitement" data-code="${t.code}">Enregistrer les modifications</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-save-note-aipd')?.addEventListener('click', async () => {
    try {
      await api.patch('/rgpd/registre-note', { note_aipd: document.getElementById('note-aipd')?.value });
      addNotification({ type: 'success', title: 'Note AIPD mise à jour' });
      await _loadRegistre();
    } catch (err) {
      addNotification({ type: 'danger', title: 'Erreur', message: err.message });
    }
  });

  document.querySelectorAll('.btn-edit-traitement').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelector(`[data-code-details="${btn.dataset.code}"]`)?.classList.toggle('hidden');
    });
  });

  document.querySelectorAll('.btn-save-traitement').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ligne = document.querySelector(`[data-code-details="${btn.dataset.code}"]`);
      const corps = {};
      ligne?.querySelectorAll('.champ-traitement').forEach((champ) => {
        corps[champ.dataset.champ] = champ.value;
      });
      try {
        await api.patch(`/rgpd/registre/${btn.dataset.code}`, corps);
        addNotification({ type: 'success', title: 'Traitement mis à jour', message: btn.dataset.code });
      } catch (err) {
        addNotification({ type: 'danger', title: 'Erreur', message: err.message });
      }
    });
  });
}
