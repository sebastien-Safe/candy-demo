// ================================================================
// C@NDY — Données factices pour la démonstration hors-ligne
// Aucune donnée réelle. Aucun appel réseau. Tout est en mémoire.
// ================================================================

(function () {

  // ── Semaine courante (pour l'agenda) ──
  function _mockGetMonday() {
    const d = new Date();
    const day = d.getDay() || 7; // dimanche -> 7
    d.setDate(d.getDate() - day + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const _MONDAY = _mockGetMonday();
  function _mockDateAt(dayOffset, hour) {
    const d = new Date(_MONDAY);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  }
  function _isoDaysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }

  // ── PATIENTS (10 patients fictifs) ──
  // Les 5 premiers (is_demo:true) correspondent aux dossiers statiques
  // patient-1-dupont-marie.html … patient-5-petit-isabelle.html
  const patients = [
    {
      id: 'pat-dupont-marie', nom: 'Dupont', prenom: 'Marie',
      date_naissance: '1978-04-12', sexe: 'F', groupe_sanguin: 'A+',
      allergies: [{ nom: 'Pénicilline' }], is_demo: true,
      telephone: '06 12 34 56 78', ville: 'Lyon',
      pathologie_chronique: 'Diabète de type 2',
      antecedents: 'Appendicectomie (2005), HTA depuis 2015',
      traitements_actuels: ['Metformine 1000mg', 'Amlodipine 5mg'],
    },
    {
      id: 'pat-bernard-luc', nom: 'Bernard', prenom: 'Luc',
      date_naissance: '1965-09-03', sexe: 'M', groupe_sanguin: 'O+',
      allergies: [], is_demo: true,
      telephone: '06 23 45 67 89', ville: 'Villeurbanne',
      pathologie_chronique: 'BPCO',
      antecedents: 'Tabagisme sevré en 2018, infarctus en 2019',
      traitements_actuels: ['Ventoline', 'Bisoprolol 2.5mg', 'Aspirine 75mg'],
    },
    {
      id: 'pat-lefevre-sophie', nom: 'Lefèvre', prenom: 'Sophie',
      date_naissance: '1990-01-22', sexe: 'F', groupe_sanguin: 'B-',
      allergies: [{ nom: 'Latex' }], is_demo: true,
      telephone: '06 34 56 78 90', ville: 'Lyon',
      pathologie_chronique: 'Asthme allergique',
      antecedents: 'Eczéma atopique dans l’enfance',
      traitements_actuels: ['Seretide 125'],
    },
    {
      id: 'pat-moreau-paul', nom: 'Moreau', prenom: 'Paul',
      date_naissance: '1955-11-08', sexe: 'M', groupe_sanguin: 'AB+',
      allergies: [{ nom: 'Iode' }], is_demo: true,
      telephone: '06 45 67 89 01', ville: 'Caluire-et-Cuire',
      pathologie_chronique: 'Insuffisance cardiaque, fibrillation auriculaire',
      antecedents: 'Pontage coronarien en 2012',
      traitements_actuels: ['Eliquis 5mg', 'Furosémide 40mg', 'Ramipril 5mg'],
    },
    {
      id: 'pat-petit-isabelle', nom: 'Petit', prenom: 'Isabelle',
      date_naissance: '1983-06-30', sexe: 'F', groupe_sanguin: 'A-',
      allergies: [], is_demo: true,
      telephone: '06 56 78 90 12', ville: 'Lyon',
      pathologie_chronique: 'Hypothyroïdie',
      antecedents: 'Grossesse gémellaire en 2016',
      traitements_actuels: ['Levothyrox 75µg'],
    },
    {
      id: 'pat-roux-antoine', nom: 'Roux', prenom: 'Antoine',
      date_naissance: '1972-02-14', sexe: 'M', groupe_sanguin: 'O-',
      allergies: [{ nom: 'Amoxicilline' }], is_demo: false,
      telephone: '06 67 89 01 23', ville: 'Bron',
      pathologie_chronique: 'Hypertension artérielle',
      antecedents: 'RAS',
      traitements_actuels: ['Amlodipine 5mg'],
    },
    {
      id: 'pat-simon-claire', nom: 'Simon', prenom: 'Claire',
      date_naissance: '1995-08-19', sexe: 'F', groupe_sanguin: 'A+',
      allergies: [], is_demo: false,
      telephone: '06 78 90 12 34', ville: 'Vénissieux',
      pathologie_chronique: 'Migraine chronique',
      antecedents: 'RAS',
      traitements_actuels: ['Topiramate 50mg'],
    },
    {
      id: 'pat-michel-julien', nom: 'Michel', prenom: 'Julien',
      date_naissance: '1960-12-25', sexe: 'M', groupe_sanguin: 'B+',
      allergies: [{ nom: 'Sulfamides' }], is_demo: false,
      telephone: '06 89 01 23 45', ville: 'Lyon',
      pathologie_chronique: 'Diabète de type 1',
      antecedents: 'Rétinopathie diabétique débutante',
      traitements_actuels: ['Insuline Lantus', 'Insuline Novorapid'],
    },
    {
      id: 'pat-garcia-emma', nom: 'Garcia', prenom: 'Emma',
      date_naissance: '2001-03-05', sexe: 'F', groupe_sanguin: 'O+',
      allergies: [{ nom: 'Pollens' }], is_demo: false,
      telephone: '06 90 12 34 56', ville: 'Oullins',
      pathologie_chronique: 'Aucune',
      antecedents: 'RAS',
      traitements_actuels: [],
    },
    {
      id: 'pat-martin-henri', nom: 'Martin', prenom: 'Henri',
      date_naissance: '1948-07-17', sexe: 'M', groupe_sanguin: 'A+',
      allergies: [], is_demo: false,
      telephone: '07 01 23 45 67', ville: 'Lyon',
      pathologie_chronique: 'Arthrose, hypertension',
      antecedents: 'Prothèse de hanche en 2020',
      traitements_actuels: ['Ramipril 5mg', 'Paracétamol 1g si besoin'],
    },
  ];

  // ── AGENDA (semaine courante, du lundi au vendredi) ──
  const agenda = [
    { id: 'rdv-1',  date_rdv: _mockDateAt(0, 9),  titre: 'Consultation — Dupont Marie',              type_rdv: 'consultation',    patient_id: 'pat-dupont-marie' },
    { id: 'rdv-2',  date_rdv: _mockDateAt(0, 11), titre: 'Renouvellement ordonnance — Bernard Luc',   type_rdv: 'renouvellement',  patient_id: 'pat-bernard-luc' },
    { id: 'rdv-3',  date_rdv: _mockDateAt(1, 8),  titre: 'Suivi post-opératoire — Moreau Paul',       type_rdv: 'suivi',           patient_id: 'pat-moreau-paul' },
    { id: 'rdv-4',  date_rdv: _mockDateAt(1, 15), titre: 'Consultation — Lefèvre Sophie',             type_rdv: 'consultation',    patient_id: 'pat-lefevre-sophie' },
    { id: 'rdv-5',  date_rdv: _mockDateAt(2, 10), titre: 'Vaccination — Garcia Emma',                 type_rdv: 'vaccination',     patient_id: 'pat-garcia-emma' },
    { id: 'rdv-6',  date_rdv: _mockDateAt(2, 16), titre: 'Consultation — Petit Isabelle',             type_rdv: 'consultation',    patient_id: 'pat-petit-isabelle' },
    { id: 'rdv-7',  date_rdv: _mockDateAt(3, 9),  titre: 'Bilan annuel — Martin Henri',               type_rdv: 'bilan',           patient_id: 'pat-martin-henri' },
    { id: 'rdv-8',  date_rdv: _mockDateAt(3, 14), titre: 'Consultation — Roux Antoine',               type_rdv: 'consultation',    patient_id: 'pat-roux-antoine' },
    { id: 'rdv-9',  date_rdv: _mockDateAt(4, 8),  titre: 'Consultation — Simon Claire',               type_rdv: 'consultation',    patient_id: 'pat-simon-claire' },
    { id: 'rdv-10', date_rdv: _mockDateAt(4, 17), titre: 'Renouvellement traitement — Michel Julien', type_rdv: 'renouvellement',  patient_id: 'pat-michel-julien' },
  ];

  // ── NOTES DE SUIVI / TRANSMISSIONS (par patient + auteur) ──
  const notes_suivi = [
    {
      patient_id: 'pat-dupont-marie', auteur_id: 'demo-medecin',
      contenu: 'Patiente stable sous Metformine. Glycémie à jeun contrôlée à 1,15 g/L ce jour. Poursuite du traitement, prochain bilan biologique dans 3 mois.',
      updated_at: _isoDaysAgo(2),
    },
    {
      patient_id: 'pat-bernard-luc', auteur_id: 'demo-medecin',
      contenu: 'Amélioration de la dyspnée depuis l’arrêt du tabac. Saturation à 96 % en air ambiant. Poursuite de la bithérapie bronchodilatatrice, réévaluation EFR à prévoir.',
      updated_at: _isoDaysAgo(5),
    },
    {
      patient_id: 'pat-lefevre-sophie', auteur_id: 'demo-medecin',
      contenu: 'Asthme bien contrôlé, aucune crise depuis la dernière consultation. Technique de prise du Seretide vérifiée et correcte. RAS.',
      updated_at: _isoDaysAgo(10),
    },
    {
      patient_id: 'pat-moreau-paul', auteur_id: 'demo-medecin',
      contenu: 'Insuffisance cardiaque stable, pas de signe de décompensation. Poids stable à 78 kg. INR à surveiller sous Eliquis. Consultation cardiologique de suivi programmée.',
      updated_at: _isoDaysAgo(1),
    },
    {
      patient_id: 'pat-petit-isabelle', auteur_id: 'demo-medecin',
      contenu: 'TSH normalisée sous Levothyrox 75µg. Patiente asymptomatique. Contrôle biologique à 6 mois.',
      updated_at: _isoDaysAgo(20),
    },
  ];

  // ── PROFIL DE DÉMONSTRATION ──
  const profiles = [
    {
      id: 'demo-medecin', nom: 'Démo', prenom: 'Médecin',
      role: 'medecin', email: 'demo@candy-demo.local',
      actif: true, is_admin: false,
      created_at: '2026-01-01T09:00:00.000Z',
    },
  ];

  // ── JOURNAL D'AUDIT ──
  const audit_logs = [
    { id: 'log-1', action: 'LOGIN',       user_role: 'medecin',   details: { email: 'demo@candy-demo.local' },         created_at: _isoDaysAgo(0) },
    { id: 'log-2', action: 'CREATE_USER', user_role: 'admin_crm', details: { email: 'secretaire@cabinet-demo.fr' },    created_at: _isoDaysAgo(1) },
    { id: 'log-3', action: 'CHANGE_ROLE', user_role: 'admin_crm', details: { target_role: 'medecin_demo' },           created_at: _isoDaysAgo(3) },
  ];

  // ── STATISTIQUES DU CABINET (vue v_stats_candy) ──
  const v_stats_candy = [
    {
      total_patients_reels: 247,
      total_patients_demo: 10,
      total_consultations: 1834,
      total_ordonnances: 962,
      rdv_a_venir: 37,
      utilisateurs_actifs: 6,
    },
  ];

  window.CANDY_MOCK_DATA = {
    patients, agenda, notes_suivi, profiles, audit_logs, v_stats_candy,
  };

})();
