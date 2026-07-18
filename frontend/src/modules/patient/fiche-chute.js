/**
 * [ candy-e ] — DÉCLARATION DE CHUTE
 * Modale accessible depuis Transmissions : recherche patient, circonstances,
 * constatations cliniques, actions prises. À l'enregistrement : insertion
 * dans `chutes` + génération automatique d'une transmission liée (alerte).
 */

import { api } from '../../core/api.js';
import { addNotification } from '../../core/state.js';
import { formatNomComplet } from '../../utils/format.js';

const LIEU_OPTIONS = [
  { value: 'chambre_lit',       label: 'Chambre (lit)' },
  { value: 'chambre_autre',     label: 'Chambre (autre)' },
  { value: 'salle_bain_wc',     label: 'Salle de bain / WC' },
  { value: 'couloir',           label: 'Couloir / Circulation' },
  { value: 'refectoire_salon',  label: 'Réfectoire / Salon' },
  { value: 'jardin_exterieur',  label: 'Jardin / Extérieur' },
];

const ACTIVITE_OPTIONS = [
  { value: 'transfert',        label: 'Transfert (lit/fauteuil)' },
  { value: 'marche_autonome',  label: 'Marche autonome' },
  { value: 'toilette_soin',    label: 'Pendant la toilette/soin' },
  { value: 'lever_nocturne',   label: 'Lever nocturne' },
  { value: 'autre',            label: 'Autre' },
];

const FACTEURS_OPTIONS = [
  { value: 'chaussage_inadapte',           label: 'Chaussage inadapté / Nu-pieds' },
  { value: 'aide_technique_hors_portee',   label: 'Aide technique hors de portée' },
  { value: 'sol_glissant',                 label: 'Sol glissant / Humide' },
  { value: 'obstacle',                     label: 'Obstacle sur le passage' },
  { value: 'eclairage_insuffisant',        label: 'Éclairage insuffisant' },
];

const ETAT_CONSCIENCE_OPTIONS = [
  { value: 'conscient_alerte',   label: 'Conscient / Alerte' },
  { value: 'somnolence',         label: 'Somnolence / Obnubilation' },
  { value: 'perte_connaissance', label: 'Perte de connaissance initiale (PCI)' },
];

const LESIONS_OPTIONS = [
  { value: 'hematome',     label: 'Hématome / Ecchymose' },
  { value: 'plaie',        label: 'Plaie / Dermabrasion' },
  { value: 'deformation',  label: 'Déformation de membre / Impotence' },
];

const ACTEURS_OPTIONS = [
  { value: 'ide_astreinte',     label: "IDE d'astreinte / secteur" },
  { value: 'medecin_traitant',  label: 'Médecin traitant / coordonnateur' },
  { value: 'famille',           label: 'Famille / personne de confiance' },
  { value: 'samu',              label: 'Centre 15 (SAMU)' },
];

const ANTICOAGULANTS_KEYWORDS = [
  'eliquis', 'apixaban', 'previscan', 'fluindione', 'kardegic', 'aspirine', 'acide acetylsalicylique',
  'xarelto', 'rivaroxaban', 'pradaxa', 'dabigatran', 'sintrom', 'acenocoumarol', 'coumadine', 'warfarine',
  'plavix', 'clopidogrel', 'lovenox', 'enoxaparine', 'innohep', 'tinzaparine', 'fraxiparine', 'nadroparine',
  'arixtra', 'fondaparinux', 'brilique', 'ticagrelor', 'efient', 'prasugrel',
];

let _selectedPatient = null; // { id, nom, prenom }

function _norm(str) {
  return (str ?? '').toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function _checkboxGroup(name, options) {
  return options.map(o => `
    <label style="display:flex;align-items:center;gap:.4rem;font-size:.875rem;padding:6px 0;cursor:pointer;">
      <input type="checkbox" name="${name}" value="${o.value}" /> ${o.label}
    </label>`).join('');
}

function _radioGroup(name, options, checkedValue) {
  return options.map(o => `
    <label style="display:flex;align-items:center;gap:.4rem;font-size:.875rem;padding:6px 0;cursor:pointer;">
      <input type="radio" name="${name}" value="${o.value}" ${o.value === checkedValue ? 'checked' : ''} /> ${o.label}
    </label>`).join('');
}

/**
 * Injecte la modale dans le DOM (une seule fois) et l'affiche.
 * @param {{id:string, nom:string, prenom:string}|null} prefillPatient
 *   Si fourni (ex. depuis le dossier patient), le patient est présélectionné.
 */
export function openChuteModal(prefillPatient = null) {
  if (!document.getElementById('chute-modal')) {
    document.body.insertAdjacentHTML('beforeend', _modalHtml());
    _bindModalEvents();
  }
  _resetModal(prefillPatient);
  document.getElementById('chute-modal')?.classList.remove('hidden');
}

function _modalHtml() {
  return `
  <div class="modal-backdrop hidden" id="chute-modal">
    <div class="modal" style="max-width:640px;max-height:90vh;overflow-y:auto;">
      <div class="modal__header">
        <div class="modal__title">🚨 Déclarer une chute / incident</div>
        <button class="modal__close" id="chute-modal-close">✕</button>
      </div>
      <div class="modal__body">

        <div class="form-group">
          <label class="label label--required">Patient concerné</label>
          <input type="text" class="input" id="chute-patient-search" list="chute-patient-datalist"
                 placeholder="Rechercher un patient par nom…" autocomplete="off" />
          <datalist id="chute-patient-datalist"></datalist>
          <div id="chute-patient-feedback" style="font-size:.8125rem;margin-top:4px;color:var(--color-text-muted);"></div>
        </div>

        <div id="chute-anticoagulant-alert" class="hidden" style="border:2px solid var(--color-danger);border-radius:var(--radius-md);padding:10px 14px;margin-bottom:var(--space-4);background:var(--color-danger-light);">
          <strong>⚠️ Alerte sécurité traitement :</strong> ce patient est sous traitement anticoagulant/antiagrégant actif.
          Risque hémorragique accru — surveillance neurologique stricte recommandée.
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="label">Date de l'évènement</label>
            <input type="date" class="input" id="chute-date" />
          </div>
          <div class="form-group">
            <label class="label">Heure de l'évènement</label>
            <input type="time" class="input" id="chute-heure" />
          </div>
        </div>

        <div class="form-group">
          <label class="label label--required">Lieu de la chute</label>
          <select class="select" id="chute-lieu">
            ${LIEU_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="label">Activité au moment du sinistre</label>
          <select class="select" id="chute-activite">
            <option value="">—</option>
            ${ACTIVITE_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="label">Présence de témoin</label>
          <div style="display:flex;gap:var(--space-4);">
            ${_radioGroup('chute-temoin', [{ value: 'non', label: 'Non (résident retrouvé au sol)' }, { value: 'oui', label: 'Oui (soignant ou tiers)' }], 'non')}
          </div>
        </div>

        <div class="form-group">
          <label class="label">Facteurs environnementaux favorisants</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 var(--space-4);">
            ${_checkboxGroup('chute-facteurs', FACTEURS_OPTIONS)}
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="label">TA systolique</label>
            <input type="number" class="input" id="chute-ta-sys" placeholder="135" />
          </div>
          <div class="form-group">
            <label class="label">TA diastolique</label>
            <input type="number" class="input" id="chute-ta-dia" placeholder="80" />
          </div>
          <div class="form-group">
            <label class="label">Pouls (bpm)</label>
            <input type="number" class="input" id="chute-fc" placeholder="78" />
          </div>
          <div class="form-group">
            <label class="label">SpO₂ (%)</label>
            <input type="number" class="input" id="chute-spo2" placeholder="96" />
          </div>
        </div>

        <div class="form-group">
          <label class="label">État de conscience</label>
          <select class="select" id="chute-conscience">
            <option value="">—</option>
            ${ETAT_CONSCIENCE_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="label">Lésions suspectées ou visibles</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 var(--space-4);">
            ${_checkboxGroup('chute-lesions', LESIONS_OPTIONS)}
          </div>
        </div>

        <div class="form-group">
          <label class="label">Acteurs prévenus immédiatement</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 var(--space-4);">
            ${_checkboxGroup('chute-acteurs', ACTEURS_OPTIONS)}
          </div>
        </div>

        <div class="form-group">
          <label class="label">Notes / circonstances</label>
          <textarea class="textarea" id="chute-notes" rows="4" placeholder="Décrire les circonstances de la chute…"></textarea>
        </div>

      </div>
      <div class="modal__footer">
        <button class="btn btn--outline" id="chute-cancel">Annuler</button>
        <button class="btn btn--primary" id="chute-save">Enregistrer la déclaration</button>
      </div>
    </div>
  </div>`;
}

async function _resetModal(prefillPatient) {
  _selectedPatient = null;
  const now = new Date();
  document.getElementById('chute-patient-search').value = '';
  document.getElementById('chute-patient-feedback').textContent = '';
  document.getElementById('chute-anticoagulant-alert')?.classList.add('hidden');
  document.getElementById('chute-date').value = now.toISOString().slice(0, 10);
  document.getElementById('chute-heure').value = now.toTimeString().slice(0, 5);
  document.getElementById('chute-lieu').value = LIEU_OPTIONS[0].value;
  document.getElementById('chute-activite').value = '';
  document.getElementById('chute-conscience').value = '';
  document.getElementById('chute-ta-sys').value = '';
  document.getElementById('chute-ta-dia').value = '';
  document.getElementById('chute-fc').value = '';
  document.getElementById('chute-spo2').value = '';
  document.getElementById('chute-notes').value = '';
  document.querySelectorAll('#chute-modal input[type="checkbox"]').forEach(c => { c.checked = false; });
  document.querySelectorAll('#chute-modal input[name="chute-temoin"]').forEach(r => { r.checked = r.value === 'non'; });
  await _loadPatientDatalist();

  if (prefillPatient) {
    document.getElementById('chute-patient-search').value = formatNomComplet(prefillPatient.nom, prefillPatient.prenom);
    await _onPatientSearchInput();
  }
}

async function _loadPatientDatalist() {
  const dl = document.getElementById('chute-patient-datalist');
  if (!dl) return;
  const data = await api.get('/patients?actif=true&fields=id,nom,prenom');
  dl.innerHTML = (data ?? []).map(p => `<option value="${formatNomComplet(p.nom, p.prenom)}" data-id="${p.id}"></option>`).join('');
  dl.dataset.loaded = '1';
}

async function _onPatientSearchInput() {
  const input    = document.getElementById('chute-patient-search');
  const feedback = document.getElementById('chute-patient-feedback');
  const dl       = document.getElementById('chute-patient-datalist');
  const alertBox = document.getElementById('chute-anticoagulant-alert');

  const match = Array.from(dl?.options ?? []).find(o => o.value === input.value);
  if (!match) {
    _selectedPatient = null;
    feedback.textContent = '';
    feedback.style.color = 'var(--color-text-muted)';
    alertBox?.classList.add('hidden');
    return;
  }

  _selectedPatient = { id: match.dataset.id, nom: input.value };
  feedback.textContent = `✓ Patient sélectionné`;
  feedback.style.color = 'var(--color-success)';

  const traitements = await api.get(`/traitements?patientId=${_selectedPatient.id}`);

  const sousAnticoagulant = (traitements ?? []).filter(t => t.actif).some(t =>
    ANTICOAGULANTS_KEYWORDS.some(k => _norm(t.medicament).includes(k) || _norm(t.dci).includes(k)));

  alertBox?.classList.toggle('hidden', !sousAnticoagulant);
}

function _checkedValues(name) {
  return Array.from(document.querySelectorAll(`#chute-modal input[name="${name}"]:checked`)).map(el => el.value);
}

function _labelsFor(values, options) {
  return values.map(v => options.find(o => o.value === v)?.label ?? v);
}

async function _saveChute() {
  if (!_selectedPatient) {
    addNotification({ type: 'warning', title: 'Patient requis', message: 'Sélectionnez un patient dans la liste avant d\'enregistrer.' });
    return;
  }

  const v = (id) => { const el = document.getElementById(id); return el?.value ? Number(el.value) : null; };
  const temoin = document.querySelector('#chute-modal input[name="chute-temoin"]:checked')?.value ?? 'non';
  const facteurs   = _checkedValues('chute-facteurs');
  const lesions    = _checkedValues('chute-lesions');
  const acteurs    = _checkedValues('chute-acteurs');
  const conscience = document.getElementById('chute-conscience')?.value || null;
  const anticoagulantAlerte = !document.getElementById('chute-anticoagulant-alert')?.classList.contains('hidden');

  const payload = {
    patientId:                  _selectedPatient.id,
    date_evenement:             document.getElementById('chute-date')?.value || new Date().toISOString().slice(0, 10),
    heure_evenement:            document.getElementById('chute-heure')?.value || new Date().toTimeString().slice(0, 5),
    lieu:                       document.getElementById('chute-lieu')?.value,
    activite:                   document.getElementById('chute-activite')?.value || null,
    temoin,
    facteurs_environnementaux:  facteurs,
    tension_sys:                v('chute-ta-sys'),
    tension_dia:                v('chute-ta-dia'),
    frequence_cardiaque:        v('chute-fc'),
    saturation_o2:              v('chute-spo2'),
    etat_conscience:            conscience,
    lesions,
    acteurs_prevenus:           acteurs,
    notes:                      document.getElementById('chute-notes')?.value.trim() || null,
  };

  let chute;
  try {
    chute = await api.post('/chutes', payload);
  } catch (err) {
    addNotification({ type: 'danger', title: 'Erreur', message: err.message });
    return;
  }

  // Transmission automatique liée
  const priorite = conscience === 'perte_connaissance' || anticoagulantAlerte ? 'critique' : 'urgente';
  const resume = [
    `🚨 Chute déclarée — ${LIEU_OPTIONS.find(o => o.value === payload.lieu)?.label ?? payload.lieu}`,
    payload.activite ? `Activité : ${ACTIVITE_OPTIONS.find(o => o.value === payload.activite)?.label}` : null,
    `Témoin : ${temoin === 'oui' ? 'oui' : 'résident retrouvé au sol'}`,
    lesions.length ? `Lésions : ${_labelsFor(lesions, LESIONS_OPTIONS).join(', ')}` : null,
    conscience ? `État de conscience : ${ETAT_CONSCIENCE_OPTIONS.find(o => o.value === conscience)?.label}` : null,
    anticoagulantAlerte ? '⚠️ Patient sous traitement anticoagulant/antiagrégant — vigilance renforcée.' : null,
    payload.notes ? `Notes : ${payload.notes}` : null,
  ].filter(Boolean).join(' · ');

  try {
    const transmission = await api.post('/transmissions', {
      resident_id: _selectedPatient.id,
      type: 'alerte',
      priorite,
      contenu: resume,
    });
    await api.patch(`/chutes/${chute.id}`, { transmission_id: transmission.id });
  } catch {
    // best-effort : la chute est déjà enregistrée, la transmission liée est secondaire
  }

  addNotification({ type: 'success', title: 'Déclaration de chute enregistrée', message: 'Une alerte a été transmise dans le dossier du patient.' });
  document.getElementById('chute-modal')?.classList.add('hidden');
  document.dispatchEvent(new CustomEvent('candy:chute-saved', { detail: { patientId: _selectedPatient.id } }));
}

function _bindModalEvents() {
  document.getElementById('chute-modal-close')?.addEventListener('click', () => {
    document.getElementById('chute-modal')?.classList.add('hidden');
  });
  document.getElementById('chute-cancel')?.addEventListener('click', () => {
    document.getElementById('chute-modal')?.classList.add('hidden');
  });
  document.getElementById('chute-patient-search')?.addEventListener('input', _onPatientSearchInput);
  document.getElementById('chute-save')?.addEventListener('click', () => {
    const btn = document.getElementById('chute-save');
    btn.disabled = true;
    _saveChute().finally(() => { btn.disabled = false; });
  });
}
