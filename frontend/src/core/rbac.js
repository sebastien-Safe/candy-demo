/**
 * [ candy-e ] — MOTEUR RBAC FRONTEND
 *
 * Matrice conforme REM-MS-DUI-Va2 (fév. 2026) — cf.
 * docs/ANS_matrice_roles_EXI_EDC_PSC_102.md pour la justification de
 * chaque rôle (moindre privilège, EXI EDC PSC 102).
 *
 * admin_crm/administrateur (fusionnés → super_admin), cadre (renommé →
 * cadre_sante), kine/psycho/ergo (fusionnés → intervenant_soins_exterieur),
 * medecin_demo (supprimé, cf. 009_remove_medecin_demo.sql) et ash (supprimé,
 * cf. 014_remove_ash_role.sql, audit du 2026-07-17 : 0 compte concerné)
 * n'existent plus.
 */

export const ROLES = {
  SUPER_ADMIN:              'super_admin',
  DIRECTEUR_ETABLISSEMENT:  'directeur_etablissement',
  CADRE_SANTE:              'cadre_sante',
  MEDECIN:                  'medecin',
  INFIRMIERE:               'infirmiere',
  AIDE_SOIGNANTE:           'aide_soignante',
  INTERVENANT_SOINS_EXTERIEUR: 'intervenant_soins_exterieur',
  SECRETAIRE:               'secretaire',
  DPO:                      'dpo',
};

const _full = ['*'];

const PERMISSIONS = {
  // ── Super administrateur ────────────────────────────────────
  // Fusion admin_crm + administrateur (permissions identiques en réel,
  // jamais différenciées) — compte à privilèges, seul rôle habilité à
  // créer un compte utilisateur (SC.SSI/IAM.92 : séparation stricte
  // comptes à privilèges / comptes métier).
  super_admin: _full,

  // ── Direction d'établissement ───────────────────────────────
  // Nouveau rôle (absent avant cette matrice) — pilotage, statistiques,
  // archivage. Aucun accès en écriture aux données de soin :
  // discharge_date.write ne gate QUE la route dédiée POST
  // /api/patients/:id/sortie (jamais le PATCH générique). user.deactivate
  // permet de désactiver un compte (départ d'un salarié) sans pouvoir en
  // créer ni en changer le rôle — ce pouvoir reste exclusif à super_admin.
  directeur_etablissement: [
    'patient.read',
    'agenda.read',
    'consultation.read',
    'transmission.read',
    'stat.read',
    'discharge_date.write',
    'user.read', 'user.deactivate',
    'admin.access',
    'dashboard.access',
  ],

  // ── Cadre de santé ──────────────────────────────────────────
  // Renomme `cadre`. Accès complet aux données cliniques (lecture +
  // écriture sur ordonnances/traitements/soins — extension réelle par
  // rapport à `cadre`, qui n'avait que la lecture sur ces trois modules ;
  // décision explicite de la matrice cible, pas un effet de bord du
  // renommage). Ne gère plus les comptes utilisateurs (admin.access retiré
  // — SC.SSI/IAM.92 : un rôle avec accès aux données de santé ne doit pas
  // cumuler un pouvoir d'administration des comptes).
  cadre_sante: [
    'patient.read', 'patient.write',
    'consultation.read', 'consultation.write',
    'ordonnance.read', 'ordonnance.write',
    'agenda.read', 'agenda.write',
    'note.read', 'note.write',
    'transmission.read', 'transmission.write',
    'constante.read', 'constante.write',
    'traitement.read', 'traitement.write',
    'soin.read', 'soin.write',
    'chute.read', 'chute.write',
    'tournee.read',
    'stat.read',
    'dashboard.access',
  ],

  // ── Médecin ─────────────────────────────────────────────────
  // Permissions cliniques inchangées ; dashboard.access ajouté ici et sur
  // les rôles suivants pour aligner le nav frontend sur l'accès backend
  // déjà existant (routes/dashboard.js ROLES_LECTURE) — ce n'est pas un
  // nouveau droit, juste le gate qui manquait pour exclure proprement dpo
  // (qui n'a jamais eu accès à /api/dashboard) du lien "Tableau de bord".
  medecin: [
    'patient.read', 'patient.write',
    'consultation.read', 'consultation.write',
    'ordonnance.read', 'ordonnance.write',
    'agenda.read', 'agenda.write',
    'note.read', 'note.write',
    'transmission.read', 'transmission.write',
    'constante.read', 'constante.write',
    'traitement.read', 'traitement.write',
    'soin.read', 'soin.write',
    'chute.read', 'chute.write',
    'tournee.read',
    'stat.read',
    'dashboard.access',
  ],

  // ── Infirmier(e) ────────────────────────────────────────────
  // Inchangé.
  infirmiere: [
    'patient.read', 'patient.write',
    'consultation.read',
    'ordonnance.read',
    'agenda.read',
    'note.read', 'note.write',
    'transmission.read', 'transmission.write',
    'constante.read', 'constante.write',
    'traitement.read',
    'soin.read', 'soin.write',
    'chute.read', 'chute.write',
    'tournee.read', 'tournee.write',
    'dashboard.access',
  ],

  // ── Aide-soignant(e) ────────────────────────────────────────
  aide_soignante: [
    'patient.read',
    'agenda.read',
    'note.read', 'note.write',
    'transmission.read', 'transmission.write',
    'constante.read', 'constante.write',
    'chute.read', 'chute.write',
    'tournee.read', 'tournee.write',
    'dashboard.access',
  ],

  // ── Intervenant soins extérieur ─────────────────────────────
  // Fusion kine + psycho + ergo. Nivelé au strict minimum commun
  // (transmissions L+E) plutôt qu'à l'union de leurs accès actuels — perte
  // volontaire de l'accès consultations (kine/psycho) et notes/constantes/
  // chutes/agenda (kine/ergo) : décision explicite de la matrice cible
  // (moindre privilège), pas un oubli.
  intervenant_soins_exterieur: [
    'patient.read',
    'transmission.read', 'transmission.write',
  ],

  // ── Secrétaire ──────────────────────────────────────────────
  // Permissions cliniques inchangées (contrainte explicite) ; dashboard.access
  // ajouté, cf. commentaire sur medecin ci-dessus.
  secretaire: [
    'patient.read',
    'agenda.read', 'agenda.write',
    'ordonnance.read',
    'note.read',
    'transmission.read',
    'chute.read',
    'dashboard.access',
  ],

  // ── DPO ─────────────────────────────────────────────────────
  // Aucun accès aux données de soin (patient.*, consultation.*, etc.) :
  // le DPO agit sur la conformité RGPD, pas sur le dossier médical.
  dpo: [
    'rgpd.audit.read',
    'rgpd.register.read',
    'rgpd.purge.read', 'rgpd.purge.approve',
    'rgpd.rights.access',
    'rgpd.dashboard.read',
  ],
};

export function can(role, perm) {
  const perms = PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes('*') || perms.includes(perm);
}

export function hasModule(role, moduleId) {
  return can(role, moduleId);
}

export function filterModules(role, modules) {
  return modules.filter(m => !m.permission || can(role, m.permission));
}

export function filterNav(role, items) {
  return items.filter(item => !item.permission || can(role, item.permission));
}

export const NAV_ITEMS = [
  {
    section: 'Accueil',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: '🏠', route: '#dashboard', permission: 'dashboard.access' },
    ],
  },
  {
    section: 'Soins EHPAD',
    items: [
      { id: 'tournee',       label: 'Tournées 24H',     icon: '🔄', route: '#tournee',       permission: 'tournee.read' },
      { id: 'transmissions', label: 'Transmissions',    icon: '💬', route: '#transmissions', permission: 'transmission.read', badge: true },
      { id: 'soins',         label: 'Soins & Pansements', icon: '🩹', route: '#soins',      permission: 'soin.read' },
      { id: 'traitements',   label: 'Traitements',      icon: '💊', route: '#traitements',  permission: 'traitement.read' },
    ],
  },
  {
    section: 'Patients',
    items: [
      { id: 'patients', label: 'Patients', icon: '👥', route: '#patients', permission: 'patient.read' },
    ],
  },
  {
    section: 'Clinique',
    items: [
      { id: 'agenda',        label: 'Agenda',        icon: '📅', route: '#agenda',        permission: 'agenda.read' },
      { id: 'consultations', label: 'Consultations', icon: '🩺', route: '#consultations', permission: 'consultation.read' },
      { id: 'ordonnances',   label: 'Ordonnances',   icon: '📋', route: '#ordonnances',   permission: 'ordonnance.read' },
    ],
  },
  {
    section: 'Administration',
    items: [
      { id: 'stats', label: 'Statistiques', icon: '📊', route: '#stats', permission: 'stat.read' },
      { id: 'admin', label: 'Administration', icon: '⚙️', route: '#admin', permission: 'admin.access' },
      { id: 'rgpd', label: 'RGPD — Tableau de bord DPO', icon: '🔒', route: '#rgpd', permission: 'rgpd.dashboard.read' },
    ],
  },
];

export const PATIENT_TABS = [
  { id: 'etat_civil',    label: 'État civil',      icon: '🆔', permission: 'patient.read' },
  { id: 'constantes',   label: 'Constantes',       icon: '📊', permission: 'constante.read' },
  { id: 'consultations', label: 'Consultations',   icon: '🩺', permission: 'consultation.read' },
  { id: 'traitements',  label: 'Traitements',      icon: '💊', permission: 'traitement.read' },
  { id: 'soins',        label: 'Soins & Pansements', icon: '🩹', permission: 'soin.read' },
  { id: 'ordonnances',  label: 'Ordonnances',       icon: '📋', permission: 'ordonnance.read' },
  { id: 'notes',        label: 'Notes de suivi',    icon: '💬', permission: 'note.read' },
  { id: 'transmissions', label: 'Transmissions',    icon: '📣', permission: 'transmission.read' },
  { id: 'chutes',       label: 'Chutes',            icon: '🚨', permission: 'chute.read' },
  { id: 'documents',    label: 'Documents',         icon: '📁', permission: 'patient.read' },
];
