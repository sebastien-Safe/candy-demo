// ================================================================
// C@NDY — Configuration v2
// Supabase dédié — indépendant du CRM S@FE
// ================================================================

const CANDY_SUPABASE_URL = 'https://dsfhvtkuwvaexybfqbsa.supabase.co';
const CANDY_SUPABASE_KEY = 'sb_publishable_1HYOqPI5cRAR-PGe4e9drQ_qkd9WT5r';
const CANDY_APP_NAME     = 'C@NDY';
const CANDY_VERSION      = '2.0.0';

// ── Rôles ──
const CANDY_ROLES = {
  ADMIN_CRM:    'admin_crm',    // Admins S@FE CRM — gestion + stats uniquement
  MEDECIN:      'medecin',      // Accès complet aux dossiers réels
  SECRETAIRE:   'secretaire',   // Patients + agenda uniquement
  MEDECIN_DEMO: 'medecin_demo', // Démo commerciale — 5 patients fictifs uniquement
};

// ── Permissions par rôle ──
const CANDY_PERMISSIONS = {
  admin_crm:    ['users','stats'],
  medecin:      ['patients','consultations','ordonnances','agenda','documents','notes','stats'],
  secretaire:   ['patients','agenda'],
  medecin_demo: ['patients_demo','consultations_demo','ordonnances_demo','agenda_demo','notes_demo'],
};

// ── Pages autorisées par rôle ──
const CANDY_PAGES = {
  admin_crm:    ['admin.html'],
  medecin:      ['patients.html','dossier.html','management.html'],
  secretaire:   ['patients.html'],
  medecin_demo: ['patients.html','dossier.html'],
};

// ── Redirection après login selon le rôle ──
const CANDY_REDIRECT = {
  admin_crm:    'admin.html',
  medecin:      'patients.html',
  secretaire:   'patients.html',
  medecin_demo: 'patients.html',
};
