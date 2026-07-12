/**
 * [ candy-e ] — CLIENT API CENTRALISÉ (DÉMO STATIQUE / MOCK)
 * Fichier : core/api.js
 *
 * ⚠️ Version DÉMO : aucun appel réseau. Toutes les requêtes sont routées
 * vers le jeu de données en mémoire de src/mock-data.js. La signature
 * publique (api.get/post/patch/delete, async, mêmes chemins) est identique
 * à la version « backend Express » afin qu'aucun module appelant n'ait
 * besoin d'être modifié.
 */

import * as db from '../mock-data.js';

// ─── Registre des collections ───────────────────────────────────────────────

const COLLECTIONS = {
  patients:         db.patients,
  agenda:           db.agenda,
  consultations:    db.consultations,
  ordonnances:      db.ordonnances,
  documents:        db.documents,
  constantes:       db.constantes,
  traitements:      db.traitements,
  tournees_soins:   db.tourneesSoins,
  soins_pansements: db.soinsPansements,
  notes_suivi:      db.notesSuivi,
  transmissions:    db.transmissions,
  chutes:           db.chutes,
  audit_logs:       db.auditLogs,
  profiles:         db.profiles,
};

// Tri par défaut appliqué à chaque collection avant projection/limite.
const SORTERS = {
  transmissions:    (a, b) => new Date(b.created_at)   - new Date(a.created_at),
  notes_suivi:      (a, b) => new Date(b.updated_at)   - new Date(a.updated_at),
  consultations:    (a, b) => new Date(b.date_consult) - new Date(a.date_consult),
  constantes:       (a, b) => new Date(b.date_mesure)  - new Date(a.date_mesure),
  soins_pansements: (a, b) => new Date(b.date_soin)    - new Date(a.date_soin),
  agenda:           (a, b) => new Date(a.date_rdv)     - new Date(b.date_rdv),
  audit_logs:       (a, b) => new Date(b.created_at)   - new Date(a.created_at),
  chutes:           (a, b) => new Date(b.date_evenement) - new Date(a.date_evenement),
  ordonnances:      (a, b) => new Date(b.date_emission) - new Date(a.date_emission),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid() {
  return (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function parsePath(path) {
  const [base, queryStr] = String(path).split('?');
  const params = new URLSearchParams(queryStr ?? '');
  const parts = base.split('/').filter(Boolean); // ex: "/patients/123" -> ['patients','123']
  return { parts, params };
}

/** Un enregistrement est-il lié au patient `id` (champ patientId OU resident_id selon la collection) ? */
function matchesPatient(record, id) {
  if (id == null || id === '') return true;
  return record.patientId === id || record.resident_id === id;
}

function findPatientBrief(record) {
  const pid = record.patientId ?? record.resident_id;
  if (!pid) return null;
  const p = db.patients.find(x => x.id === pid);
  return p ? { nom: p.nom, prenom: p.prenom } : null;
}

function findProfileBrief(id) {
  if (!id) return null;
  const p = db.profiles.find(x => x.id === id);
  return p ? { nom: p.nom, prenom: p.prenom } : null;
}

/** Attache les objets imbriqués (`patients`, `profiles`) attendus par les modules d'affichage. */
function enrich(root, record) {
  let out = record;

  if (['agenda', 'transmissions', 'traitements', 'soins_pansements', 'notes_suivi', 'consultations'].includes(root)) {
    const patients = findPatientBrief(out);
    if (patients) out = { ...out, patients };
  }

  if (root === 'consultations' || root === 'ordonnances') {
    const profiles = findProfileBrief(out.medecin_id);
    if (profiles) out = { ...out, profiles };
  }

  if (root === 'traitements') {
    const profiles = findProfileBrief(out.prescripteur_id);
    if (profiles) out = { ...out, profiles };
  }

  return out;
}

function project(record, fieldsParam) {
  if (!fieldsParam) return record;
  const keys = fieldsParam.split(',').map(k => k.trim()).filter(Boolean);
  const out = {};
  keys.forEach(k => { if (k in record) out[k] = record[k]; });
  return out;
}

function defaultsFor(root) {
  const now = new Date().toISOString();
  switch (root) {
    case 'transmissions': return { lu: false, created_at: now };
    case 'notes_suivi':   return { updated_at: now };
    case 'traitements':   return { actif: true, date_fin: null };
    case 'agenda':        return { statut: 'planifie' };
    default:              return {};
  }
}

// ─── Endpoints calculés ──────────────────────────────────────────────────────

function buildDashboard() {
  const patientsActifs     = db.patients.filter(p => p.actif).length;
  const totalConsultations = db.consultations.length;
  const agendaPlanifie     = db.agenda.filter(a => a.statut === 'planifie').length;
  const ordonnancesActives = db.ordonnances.filter(o => o.statut === 'active').length;

  const todayStr = new Date().toISOString().slice(0, 10);

  const agendaDuJour = db.agenda
    .filter(a => (a.date_rdv ?? '').startsWith(todayStr))
    .sort(SORTERS.agenda)
    .map(a => enrich('agenda', { ...a }));

  const notesRecentes = [...db.notesSuivi]
    .sort(SORTERS.notes_suivi)
    .slice(0, 6)
    .map(n => enrich('notes_suivi', { ...n }));

  const consultationsRecentes = [...db.consultations]
    .sort(SORTERS.consultations)
    .slice(0, 6)
    .map(c => enrich('consultations', { ...c }));

  return {
    compteurs: { patientsActifs, totalConsultations, agendaPlanifie, ordonnancesActives },
    agendaDuJour,
    notesRecentes,
    consultationsRecentes,
  };
}

function buildStats() {
  const now = new Date();
  const consultationsCeMois = db.consultations.filter(c => {
    const d = new Date(c.date_consult);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const transmissionsNonLues = db.transmissions.filter(t => !t.lu);

  return {
    patients:      db.patients.map(p => ({ ...p })),
    consultations: consultationsCeMois.map(c => ({ ...c })),
    transmissions: transmissionsNonLues.map(t => ({ ...t })),
    // Données de pilotage complémentaires (non utilisées par l'écran actuel,
    // exposées pour un usage futur / la richesse de la démo).
    etablissement: { ...db.etablissementStats },
  };
}

// ─── Verbes HTTP simulés ─────────────────────────────────────────────────────

async function doGet(path) {
  const { parts, params } = parsePath(path);
  const [root, idOrSub] = parts;

  if (root === 'dashboard') return buildDashboard();
  if (root === 'stats')     return buildStats();

  // Auth : plus consommé par auth.js (rewrite démo), stub inoffensif au cas où.
  if (root === 'auth') return null;

  const collection = COLLECTIONS[root];
  if (!collection) {
    console.warn('[candy-e mock api] unhandled', 'GET', path);
    return null;
  }

  // Enregistrement unique : /collection/:id
  if (idOrSub) {
    const rec = collection.find(r => String(r.id) === String(idOrSub));
    return rec ? enrich(root, { ...rec }) : null;
  }

  let data = collection.map(r => enrich(root, { ...r }));

  const patientId = params.get('patientId') ?? params.get('id');
  if (patientId) data = data.filter(r => matchesPatient(r, patientId));

  if (params.get('actif') === 'true')  data = data.filter(r => r.actif === true);
  if (params.get('actif') === 'false') data = data.filter(r => r.actif === false);

  const date = params.get('date');
  if (date) {
    if (root === 'agenda')              data = data.filter(r => (r.date_rdv  ?? '').startsWith(date));
    else if (root === 'tournees_soins') data = data.filter(r => r.date_soin === date);
    else                                 data = data.filter(r => (r.date ?? '').startsWith(date));
  }

  const type = params.get('type');
  if (type) data = data.filter(r => r.type === type);

  const typeSoin = params.get('type_soin');
  if (typeSoin) data = data.filter(r => r.type_soin === typeSoin);

  const priorite = params.get('priorite');
  if (priorite) data = data.filter(r => r.priorite === priorite);

  if (params.get('nonLus') === 'true') data = data.filter(r => !r.lu);

  if (SORTERS[root]) data = [...data].sort(SORTERS[root]);

  const limit = params.get('limit');
  if (limit) data = data.slice(0, Number(limit));

  const fields = params.get('fields');
  if (fields) data = data.map(r => project(r, fields));

  return data;
}

async function doPost(path, body = {}) {
  const { parts } = parsePath(path);
  const [root, sub] = parts;

  if (root === 'auth' && sub === 'users') {
    const profile = { id: uuid(), actif: true, ...body };
    db.profiles.push(profile);
    return profile;
  }
  if (root === 'auth') {
    console.warn('[candy-e mock api] unhandled', 'POST', path);
    return null;
  }

  const collection = COLLECTIONS[root];
  if (!collection) {
    console.warn('[candy-e mock api] unhandled', 'POST', path);
    return null;
  }

  const now = new Date().toISOString();
  const record = { id: uuid(), created_at: now, ...defaultsFor(root), ...body };
  collection.push(record);
  return enrich(root, { ...record });
}

async function doPatch(path, body = {}) {
  const { parts } = parsePath(path);
  const [root, id] = parts;
  const collection = COLLECTIONS[root];

  if (!collection || !id) {
    console.warn('[candy-e mock api] unhandled', 'PATCH', path);
    return null;
  }

  const idx = collection.findIndex(r => String(r.id) === String(id));
  if (idx === -1) return null;

  collection[idx] = { ...collection[idx], ...body };
  return enrich(root, { ...collection[idx] });
}

async function doDelete(path) {
  const { parts } = parsePath(path);
  const [root, id] = parts;
  const collection = COLLECTIONS[root];

  if (!collection || !id) {
    console.warn('[candy-e mock api] unhandled', 'DELETE', path);
    return null;
  }

  const idx = collection.findIndex(r => String(r.id) === String(id));
  if (idx !== -1) collection.splice(idx, 1);
  return null;
}

// ─── API publique ────────────────────────────────────────────────────────────

export const api = {
  get:    (path)       => doGet(path),
  post:   (path, body) => doPost(path, body),
  patch:  (path, body) => doPatch(path, body),
  delete: (path)        => doDelete(path),
};
