/**
 * [ candy-e ] — DONNÉES FICTIVES (DÉMO STATIQUE)
 * Fichier : src/mock-data.js
 *
 * Jeu de données en mémoire pour la démo GitHub Pages : zéro appel réseau.
 * Toutes les dates « récentes » sont calculées par rapport à l'instant de
 * chargement de la page (Date.now()) afin que la démo reste crédible
 * quelle que soit la date de consultation.
 *
 * ⚠️ Données 100% fictives — aucune donnée personnelle réelle.
 */

// ─── Helpers de date ────────────────────────────────────────────────────────

function iso(d) { return d.toISOString(); }
function dateOnly(d) { return d.toISOString().slice(0, 10); }

function hoursAgoISO(h) { return iso(new Date(Date.now() - h * 3600000)); }
function daysAgoISO(d) { return iso(new Date(Date.now() - d * 86400000)); }
function daysAgoDateOnly(d) { return dateOnly(new Date(Date.now() - d * 86400000)); }
function daysFromNowDateOnly(d) { return dateOnly(new Date(Date.now() + d * 86400000)); }
function todayDateOnly() { return dateOnly(new Date()); }

/**
 * Date/heure ISO pour un jour décalé (offset, en jours, par rapport à aujourd'hui) à hh:mm.
 * Ancré en UTC (et non en heure locale du navigateur) afin de rester cohérent avec
 * `todayDateOnly()` / `todayISO()` (utils/date.js), qui sont eux-mêmes basés sur
 * `toISOString()` — sans cet ancrage commun, un décalage horaire local pourrait
 * faire apparaître un rendez-vous « aujourd'hui » un autre jour UTC que prévu.
 */
function dateTimeAt(dayOffset, hh, mm) {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, hh, mm, 0, 0,
  )).toISOString();
}

// ─── Personnel (profiles) ───────────────────────────────────────────────────

export const profiles = [
  { id: 'demo-cadre',      nom: 'Démo',      prenom: 'Cadre',    role: 'cadre',          actif: true,  email: 'demo@candy-e.local',        specialite: null },
  { id: 'staff-medecin1',  nom: 'Rousseau',  prenom: 'Amélie',   role: 'medecin',        actif: true,  email: 'a.rousseau@candy-e.local',  specialite: 'Gériatrie' },
  { id: 'staff-medecin2',  nom: 'Faure',     prenom: 'Nicolas',  role: 'medecin',        actif: true,  email: 'n.faure@candy-e.local',     specialite: 'Médecine générale / Coordination EHPAD' },
  { id: 'staff-medecin3',  nom: 'Girard',    prenom: 'Camille',  role: 'medecin',        actif: true,  email: 'c.girard@candy-e.local',    specialite: 'Diabétologie / Endocrinologie' },
  { id: 'staff-ide1',      nom: 'Bernard',   prenom: 'Nathalie', role: 'infirmiere',     actif: true,  email: 'n.bernard@candy-e.local',   specialite: null },
  { id: 'staff-as1',       nom: 'Benali',    prenom: 'Karim',    role: 'aide_soignante', actif: true,  email: 'k.benali@candy-e.local',    specialite: null },
  { id: 'staff-ash1',      nom: 'Dupuis',    prenom: 'Chantal',  role: 'ash',            actif: true,  email: 'c.dupuis@candy-e.local',    specialite: null },
  { id: 'staff-kine1',     nom: 'Marchand',  prenom: 'Julien',   role: 'kine',           actif: true,  email: 'j.marchand@candy-e.local',  specialite: 'Kinésithérapie gériatrique' },
  { id: 'staff-secr1',     nom: 'Renard',    prenom: 'Isabelle', role: 'secretaire',     actif: true,  email: 'i.renard@candy-e.local',    specialite: null },
  { id: 'staff-admincrm1', nom: 'Lefèvre',   prenom: 'Marc',     role: 'admin_crm',      actif: true,  email: 'm.lefevre@candy-e.local',   specialite: null },
  { id: 'staff-inactif1',  nom: 'Moreau',    prenom: 'Thomas',   role: 'aide_soignante', actif: false, email: 't.moreau@candy-e.local',    specialite: null },
];

// ─── Résidents (patients) ───────────────────────────────────────────────────

export const patients = [
  {
    id: 'p1', nom: 'Dubois', prenom: 'Marguerite', sexe: 'F',
    date_naissance: '1948-03-14', actif: true, gir: 3, chambre: '12',
    ville: 'Nantes', code_postal: '44000', adresse: '8 rue des Tilleuls',
    telephone: '02 40 12 34 56', email: null,
    numero_secu: '248037512345678', groupe_sanguin: 'A+',
    situation: 'Veuve', profession: 'Ancienne institutrice',
    allergies: ['Pénicilline'],
    medecin_nom: 'Dr Amélie Rousseau',
    pathologies: ['Maladie d\'Alzheimer (stade modéré)', 'Hypertension artérielle'],
    date_entree: daysAgoDateOnly(540),
  },
  {
    id: 'p2', nom: 'Lambert', prenom: 'Henri', sexe: 'M',
    date_naissance: '1943-05-02', actif: true, gir: 2, chambre: '14',
    ville: 'Angers', code_postal: '49000', adresse: '3 impasse du Verger',
    telephone: '02 41 22 33 44', email: 'famille.lambert@example.fr',
    numero_secu: '143054912098765', groupe_sanguin: 'O+',
    situation: 'Marié', profession: 'Ancien artisan menuisier',
    allergies: [],
    medecin_nom: 'Dr Nicolas Faure',
    pathologies: ['AVC ischémique sylvien gauche (2023) — hémiplégie droite séquellaire', 'Aphasie modérée', 'Fibrillation auriculaire'],
    date_entree: daysAgoDateOnly(380),
  },
  {
    id: 'p3', nom: 'Martin', prenom: 'Yvonne', sexe: 'F',
    date_naissance: '1938-06-25', actif: true, gir: 3, chambre: '21',
    ville: 'Rennes', code_postal: '35000', adresse: '15 avenue des Lilas',
    telephone: '02 99 45 67 89', email: null,
    numero_secu: '238065335012345', groupe_sanguin: 'B+',
    situation: 'Veuve', profession: 'Ancienne couturière',
    allergies: ['Iode'],
    medecin_nom: 'Dr Amélie Rousseau',
    pathologies: ['Fracture du col du fémur gauche opérée (PTH, mars 2026)', 'Ostéoporose sévère'],
    date_entree: daysAgoDateOnly(120),
  },
  {
    id: 'p4', nom: 'Petit', prenom: 'Robert', sexe: 'M',
    date_naissance: '1935-01-09', actif: true, gir: 4, chambre: '23',
    ville: 'Le Mans', code_postal: '72000', adresse: '22 rue de la Gare',
    telephone: '02 43 11 22 33', email: null,
    numero_secu: '135017233098712', groupe_sanguin: 'A-',
    situation: 'Veuf', profession: 'Ancien cheminot',
    allergies: [],
    medecin_nom: 'Dr Nicolas Faure',
    pathologies: ['Insuffisance cardiaque chronique (FEVG 35%)', 'BPCO post-tabagique'],
    date_entree: daysAgoDateOnly(710),
  },
  {
    id: 'p5', nom: 'Moreau', prenom: 'Jeanne', sexe: 'F',
    date_naissance: '1946-05-12', actif: true, gir: 3, chambre: '31',
    ville: 'Tours', code_postal: '37000', adresse: '4 place du Marché',
    telephone: '02 47 33 44 55', email: 'famille.moreau@example.fr',
    numero_secu: '246054437076543', groupe_sanguin: 'AB+',
    situation: 'Divorcée', profession: 'Ancienne infirmière',
    allergies: ['Latex'],
    medecin_nom: 'Dr Camille Girard',
    pathologies: ['Maladie de Parkinson idiopathique évoluée', 'Dysphagie modérée'],
    date_entree: daysAgoDateOnly(260),
  },
  {
    id: 'p6', nom: 'Simon', prenom: 'Georges', sexe: 'M',
    date_naissance: '1933-04-17', actif: true, gir: 4, chambre: '33',
    ville: 'Orléans', code_postal: '45000', adresse: '9 rue des Acacias',
    telephone: '02 38 55 66 77', email: null,
    numero_secu: '133044576054321', groupe_sanguin: 'O-',
    situation: 'Veuf', profession: 'Ancien boulanger',
    allergies: [],
    medecin_nom: 'Dr Camille Girard',
    pathologies: ['Diabète de type 2 insulino-requérant', 'Neuropathie diabétique périphérique'],
    date_entree: daysAgoDateOnly(900),
  },
  {
    id: 'p7', nom: 'Laurent', prenom: 'Odette', sexe: 'F',
    date_naissance: '1941-03-05', actif: true, gir: 4, chambre: '42',
    ville: 'Poitiers', code_postal: '86000', adresse: '17 rue Victor Hugo',
    telephone: '05 49 66 77 88', email: null,
    numero_secu: '241035986065432', groupe_sanguin: 'A+',
    situation: 'Veuve', profession: 'Ancienne commerçante',
    allergies: ['Sulfamides'],
    medecin_nom: 'Dr Amélie Rousseau',
    pathologies: ['Troubles cognitifs modérés (démence vasculaire)', 'Anxiété vespérale'],
    date_entree: daysAgoDateOnly(200),
  },
  {
    id: 'p8', nom: 'Michel', prenom: 'André', sexe: 'M',
    date_naissance: '1949-05-22', actif: true, gir: 5, chambre: '44',
    ville: 'La Rochelle', code_postal: '17000', adresse: '5 quai des Flots',
    telephone: '05 46 77 88 99', email: 'a.michel@example.fr',
    numero_secu: '149057917043210', groupe_sanguin: 'B-',
    situation: 'Marié', profession: 'Ancien professeur de mathématiques',
    allergies: [],
    medecin_nom: 'Dr Nicolas Faure',
    pathologies: ['Arthrose sévère bilatérale des genoux', 'Autonomie relative avec déambulateur'],
    date_entree: daysAgoDateOnly(90),
  },
  {
    id: 'p9', nom: 'Garcia', prenom: 'Suzanne', sexe: 'F',
    date_naissance: '1936-02-11', actif: true, gir: 1, chambre: '51',
    ville: 'Bordeaux', code_postal: '33000', adresse: '31 cours de l\'Intendance',
    telephone: '05 56 88 99 00', email: null,
    numero_secu: '236024933032109', groupe_sanguin: 'A+',
    situation: 'Veuve', profession: 'Ancienne employée de banque',
    allergies: ['Pénicilline', 'Aspirine'],
    medecin_nom: 'Dr Camille Girard',
    pathologies: ['Maladie d\'Alzheimer (stade sévère)', 'Grabataire', 'Dénutrition protéino-énergétique'],
    date_entree: daysAgoDateOnly(650),
  },
  {
    id: 'p10', nom: 'Rousseau', prenom: 'Paul', sexe: 'M',
    date_naissance: '1944-05-19', actif: false, gir: 2, chambre: '53',
    ville: 'Niort', code_postal: '79000', adresse: '2 rue des Halles',
    telephone: '05 49 99 00 11', email: null,
    numero_secu: '144057979021098', groupe_sanguin: 'O+',
    situation: 'Divorcé', profession: 'Ancien chauffeur routier',
    allergies: [],
    medecin_nom: 'Dr Nicolas Faure',
    pathologies: ['AVC hémorragique séquellaire', 'Dénutrition', 'Escarre talon en cours de cicatrisation'],
    date_entree: daysAgoDateOnly(430),
    date_sortie: daysAgoDateOnly(6),
    motif_sortie: 'Transfert en unité de soins de longue durée (USLD)',
  },
];

// ─── Transmissions ciblées ──────────────────────────────────────────────────

export const transmissions = [
  {
    id: 't1', resident_id: 'p2',
    auteur_nom: 'Nathalie Bernard', auteur_role: 'infirmiere',
    type: 'alerte', priorite: 'urgente', lu: false, cible_role: 'medecin',
    contenu: "Chute sans gravité ce matin dans la chambre, aucune plaie visible mais vigilance neurologique maintenue compte tenu du traitement par Previscan. TA 138/82, FC 76.",
    created_at: hoursAgoISO(2),
  },
  {
    id: 't2', resident_id: 'p9',
    auteur_nom: 'Karim Benali', auteur_role: 'aide_soignante',
    type: 'observation', priorite: 'normale', lu: false, cible_role: null,
    contenu: "Prise alimentaire du midi très partielle (1/4 assiette), a accepté la compote en dessert. À surveiller pour le repas du soir.",
    created_at: hoursAgoISO(5),
  },
  {
    id: 't3', resident_id: 'p4',
    auteur_nom: 'Dr Nicolas Faure', auteur_role: 'medecin',
    type: 'consigne', priorite: 'normale', lu: true, cible_role: 'infirmiere',
    contenu: "Majoration du Lasilix à 40mg le matin suite à prise de poids de 1,5 kg en 3 jours. Surveillance des œdèmes des membres inférieurs et pesée quotidienne.",
    created_at: hoursAgoISO(9),
  },
  {
    id: 't4', resident_id: 'p10',
    auteur_nom: 'Nathalie Bernard', auteur_role: 'infirmiere',
    type: 'observation', priorite: 'normale', lu: true, cible_role: null,
    contenu: "Réfection du pansement talon droit : bourgeonnement satisfaisant, diminution de la taille de la plaie. Poursuite du protocole en cours.",
    created_at: hoursAgoISO(14),
  },
  {
    id: 't5', resident_id: 'p1',
    auteur_nom: 'Chantal Dupuis', auteur_role: 'ash',
    type: 'information', priorite: 'normale', lu: true, cible_role: null,
    contenu: "Madame Dubois a bien participé à l'atelier mémoire cet après-midi, très souriante et coopérante.",
    created_at: hoursAgoISO(20),
  },
  {
    id: 't6', resident_id: 'p7',
    auteur_nom: 'Karim Benali', auteur_role: 'aide_soignante',
    type: 'alerte', priorite: 'critique', lu: false, cible_role: 'medecin',
    contenu: "Épisode de forte agitation en fin de journée avec déambulation nocturne et propos incohérents. Recherche de globe vésical négative. Médecin de garde prévenu.",
    created_at: hoursAgoISO(11),
  },
  {
    id: 't7', resident_id: 'p3',
    auteur_nom: 'Julien Marchand', auteur_role: 'kine',
    type: 'observation', priorite: 'normale', lu: true, cible_role: null,
    contenu: "Reprise de la marche avec déambulateur sur 15 mètres ce jour suite à la PTH, bonne tolérance, douleur cotée à 2/10.",
    created_at: hoursAgoISO(41),
  },
  {
    id: 't8', resident_id: 'p5',
    auteur_nom: 'Nathalie Bernard', auteur_role: 'infirmiere',
    type: 'consigne', priorite: 'urgente', lu: false, cible_role: 'aide_soignante',
    contenu: "Fausse route sur les liquides ce midi, texture eau gélifiée reprise dans l'attente de l'avis de l'orthophoniste. Prévenir la cuisine.",
    created_at: hoursAgoISO(3),
  },
];

// ─── Chutes ─────────────────────────────────────────────────────────────────

export const chutes = [
  {
    id: 'ch1', patientId: 'p2',
    date_evenement: todayDateOnly(), heure_evenement: '06:45',
    lieu: 'chambre_lit', activite: 'transfert', temoin: 'non',
    facteurs_environnementaux: ['aide_technique_hors_portee'],
    tension_sys: 138, tension_dia: 82, frequence_cardiaque: 76, saturation_o2: 96,
    etat_conscience: 'conscient_alerte', lesions: [],
    acteurs_prevenus: ['ide_astreinte', 'medecin_traitant'],
    notes: "Retrouvé au sol au réveil près du lit, semble avoir chuté lors d'un transfert seul. Aucune plaie visible. Surveillance neurologique renforcée du fait du traitement anticoagulant.",
    transmission_id: 't1',
  },
  {
    id: 'ch2', patientId: 'p7',
    date_evenement: daysAgoDateOnly(1), heure_evenement: '21:15',
    lieu: 'couloir', activite: 'marche_autonome', temoin: 'oui',
    facteurs_environnementaux: ['eclairage_insuffisant'],
    tension_sys: 130, tension_dia: 76, frequence_cardiaque: 82, saturation_o2: 97,
    etat_conscience: 'somnolence', lesions: ['hematome'],
    acteurs_prevenus: ['ide_astreinte'],
    notes: "Chute survenue en fin de soirée dans le couloir, désorientation associée à l'épisode d'agitation signalé. Hématome à l'avant-bras gauche.",
    transmission_id: null,
  },
];

// ─── Traitements en cours ───────────────────────────────────────────────────

export const traitements = [
  { id: 'tr1', patientId: 'p1', medicament: 'Aricept', dci: 'Donépézil', dose: '10 mg', frequence: '1 comprimé le soir', voie: 'orale', actif: true, date_debut: daysAgoDateOnly(240), date_fin: null, notes: "Traitement de la maladie d'Alzheimer.", prescripteur_id: 'staff-medecin1' },
  { id: 'tr2', patientId: 'p1', medicament: 'Doliprane', dci: 'Paracétamol', dose: '1000 mg', frequence: 'Si douleur, max 3/jour', voie: 'orale', actif: true, date_debut: daysAgoDateOnly(500), date_fin: null, notes: "Antalgique de palier 1.", prescripteur_id: 'staff-medecin1' },

  { id: 'tr3', patientId: 'p2', medicament: 'Previscan', dci: 'Fluindione', dose: 'Selon INR', frequence: '1 comprimé le soir selon dosage', voie: 'orale', actif: true, date_debut: daysAgoDateOnly(380), date_fin: null, notes: "Fibrillation auriculaire — anticoagulation au long cours. Surveillance INR hebdomadaire.", prescripteur_id: 'staff-medecin2' },
  { id: 'tr4', patientId: 'p2', medicament: 'Tahor', dci: 'Atorvastatine', dose: '20 mg', frequence: '1 comprimé le soir', voie: 'orale', actif: true, date_debut: daysAgoDateOnly(380), date_fin: null, notes: null, prescripteur_id: 'staff-medecin2' },

  { id: 'tr5', patientId: 'p3', medicament: 'Doliprane', dci: 'Paracétamol', dose: '1000 mg', frequence: '3x/jour', voie: 'orale', actif: true, date_debut: daysAgoDateOnly(120), date_fin: null, notes: "Douleurs post-opératoires (PTH).", prescripteur_id: 'staff-medecin1' },
  { id: 'tr6', patientId: 'p3', medicament: 'Calcium/Vitamine D3', dci: 'Cholécalciférol', dose: '1 sachet', frequence: '1x/jour', voie: 'orale', actif: true, date_debut: daysAgoDateOnly(120), date_fin: null, notes: "Ostéoporose.", prescripteur_id: 'staff-medecin1' },

  { id: 'tr7', patientId: 'p4', medicament: 'Lasilix', dci: 'Furosémide', dose: '40 mg', frequence: '1 comprimé le matin', voie: 'orale', actif: true, date_debut: daysAgoDateOnly(710), date_fin: null, notes: "Insuffisance cardiaque congestive.", prescripteur_id: 'staff-medecin2' },
  { id: 'tr8', patientId: 'p4', medicament: 'Kardégic', dci: 'Acide acétylsalicylique', dose: '75 mg', frequence: '1 sachet le matin', voie: 'orale', actif: true, date_debut: daysAgoDateOnly(710), date_fin: null, notes: null, prescripteur_id: 'staff-medecin2' },
  { id: 'tr9', patientId: 'p4', medicament: 'Bisoprolol', dci: 'Bisoprolol', dose: '2,5 mg', frequence: '1 comprimé le matin', voie: 'orale', actif: true, date_debut: daysAgoDateOnly(60), date_fin: null, notes: null, prescripteur_id: 'staff-medecin2' },

  { id: 'tr10', patientId: 'p5', medicament: 'Modopar', dci: 'Lévodopa/Bensérazide', dose: '125 mg', frequence: '4x/jour (8h-12h-16h-20h)', voie: 'orale', actif: true, date_debut: daysAgoDateOnly(260), date_fin: null, notes: "Maladie de Parkinson idiopathique.", prescripteur_id: 'staff-medecin3' },

  { id: 'tr11', patientId: 'p6', medicament: 'Glucophage', dci: 'Metformine', dose: '850 mg', frequence: '2x/jour', voie: 'orale', actif: true, date_debut: daysAgoDateOnly(900), date_fin: null, notes: "Diabète de type 2.", prescripteur_id: 'staff-medecin3' },
  { id: 'tr12', patientId: 'p6', medicament: 'Lantus', dci: 'Insuline glargine', dose: '20 UI', frequence: '1 injection le soir', voie: 'SC', actif: true, date_debut: daysAgoDateOnly(180), date_fin: null, notes: "Insulinothérapie lente.", prescripteur_id: 'staff-medecin3' },
];

// ─── Constantes vitales ─────────────────────────────────────────────────────

export const constantes = [
  { id: 'cn1', patientId: 'p1', date_mesure: hoursAgoISO(6), tension_sys: 120, tension_dia: 76, frequence_cardiaque: 72, saturation_o2: 97, temperature: 36.7, poids: 58.2, glycemie: null, echelle_douleur: 1, observations: "RAS." },
  { id: 'cn2', patientId: 'p1', date_mesure: daysAgoISO(3), tension_sys: 118, tension_dia: 74, frequence_cardiaque: 70, saturation_o2: 98, temperature: 36.6, poids: 58.4, glycemie: null, echelle_douleur: 0, observations: null },

  { id: 'cn3', patientId: 'p2', date_mesure: hoursAgoISO(10), tension_sys: 142, tension_dia: 88, frequence_cardiaque: 80, saturation_o2: 95, temperature: 37.1, poids: 71.0, glycemie: null, echelle_douleur: 0, observations: "Légère hypertension, à recontrôler." },
  { id: 'cn4', patientId: 'p2', date_mesure: daysAgoISO(2), tension_sys: 136, tension_dia: 84, frequence_cardiaque: 78, saturation_o2: 96, temperature: 36.8, poids: 71.5, glycemie: null, echelle_douleur: 0, observations: null },

  { id: 'cn5', patientId: 'p4', date_mesure: hoursAgoISO(4), tension_sys: 128, tension_dia: 78, frequence_cardiaque: 88, saturation_o2: 93, temperature: 36.9, poids: 82.6, glycemie: null, echelle_douleur: 0, observations: "Œdèmes des membres inférieurs ++, pesée quotidienne en cours." },
  { id: 'cn6', patientId: 'p4', date_mesure: daysAgoISO(1), tension_sys: 130, tension_dia: 80, frequence_cardiaque: 85, saturation_o2: 94, temperature: 36.8, poids: 81.1, glycemie: null, echelle_douleur: 0, observations: null },

  { id: 'cn7', patientId: 'p9', date_mesure: hoursAgoISO(8), tension_sys: 108, tension_dia: 64, frequence_cardiaque: 68, saturation_o2: 95, temperature: 37.6, poids: 42.3, glycemie: null, echelle_douleur: 3, observations: "Fébricule à surveiller, hydratation renforcée." },
  { id: 'cn8', patientId: 'p9', date_mesure: daysAgoISO(4), tension_sys: 110, tension_dia: 66, frequence_cardiaque: 70, saturation_o2: 96, temperature: 36.9, poids: 42.8, glycemie: null, echelle_douleur: 2, observations: null },
];

// ─── Consultations ──────────────────────────────────────────────────────────

export const consultations = [
  { id: 'c1', patientId: 'p1', date_consult: daysAgoDateOnly(5), type_acte: 'Consultation', titre: 'Suivi gériatrique trimestriel', notes: "Évolution cognitive stable sous Donépézil, MMSE à 16/30.", tension_sys: 118, tension_dia: 74, spo2: 97, poids: 58.3, medecin_id: 'staff-medecin1' },
  { id: 'c2', patientId: 'p2', date_consult: daysAgoDateOnly(10), type_acte: 'Spécialiste', titre: 'Consultation neurologique de suivi post-AVC', notes: "Récupération motrice partielle du membre supérieur droit, poursuite de la kinésithérapie.", tension_sys: null, tension_dia: null, spo2: null, poids: null, medecin_id: 'staff-medecin2' },
  { id: 'c3', patientId: 'p3', date_consult: daysAgoDateOnly(20), type_acte: 'Spécialiste', titre: 'Consultation orthopédique post-opératoire (PTH)', notes: "Cicatrisation satisfaisante, ablation des fils réalisée, reprise progressive de l'appui.", tension_sys: null, tension_dia: null, spo2: null, poids: null, medecin_id: 'staff-medecin1' },
  { id: 'c4', patientId: 'p4', date_consult: daysAgoDateOnly(2), type_acte: 'Consultation', titre: 'Suivi cardiologique — insuffisance cardiaque', notes: "Adaptation du traitement diurétique, ECG stable.", tension_sys: 128, tension_dia: 78, spo2: 93, poids: 82.6, medecin_id: 'staff-medecin2' },
  { id: 'c5', patientId: 'p4', date_consult: daysAgoDateOnly(45), type_acte: 'Urgence', titre: 'Décompensation cardiaque aiguë', notes: "Prise en charge en urgence, hospitalisation de 3 jours, retour en EHPAD avec ajustement thérapeutique.", tension_sys: 150, tension_dia: 92, spo2: 89, poids: 85.0, medecin_id: 'staff-medecin2' },
  { id: 'c6', patientId: 'p6', date_consult: daysAgoDateOnly(7), type_acte: 'Bilan', titre: 'Bilan diabétologique annuel', notes: "HbA1c à 7,8 %, adaptation du schéma insulinique.", tension_sys: 132, tension_dia: 80, spo2: 97, poids: 74.5, medecin_id: 'staff-medecin3' },
  { id: 'c7', patientId: 'p9', date_consult: daysAgoDateOnly(3), type_acte: 'Consultation', titre: 'Suivi nutritionnel — dénutrition', notes: "Poursuite des compléments alimentaires oraux, poids stable.", tension_sys: 108, tension_dia: 64, spo2: 95, poids: 42.3, medecin_id: 'staff-medecin3' },
  { id: 'c8', patientId: 'p5', date_consult: daysAgoDateOnly(15), type_acte: 'Spécialiste', titre: 'Consultation neurologique — Parkinson', notes: "Ajustement posologique de la Lévodopa, apparition de fluctuations motrices en fin de dose.", tension_sys: null, tension_dia: null, spo2: null, poids: null, medecin_id: 'staff-medecin3' },
];

// ─── Ordonnances ────────────────────────────────────────────────────────────

export const ordonnances = [
  { id: 'o1', patientId: 'p1', reference: 'ORD-2026-0451', date_emission: daysAgoDateOnly(5), statut: 'active', contenu: "Donépézil 10 mg : 1 comprimé le soir\nParacétamol 1 g : si douleur, max 3 g/jour", medecin_id: 'staff-medecin1' },
  { id: 'o2', patientId: 'p2', reference: 'ORD-2026-0398', date_emission: daysAgoDateOnly(30), statut: 'active', contenu: "Previscan : selon INR, contrôle biologique hebdomadaire\nKardégic 75 mg : 1 sachet le matin", medecin_id: 'staff-medecin2' },
  { id: 'o3', patientId: 'p4', reference: 'ORD-2026-0512', date_emission: daysAgoDateOnly(2), statut: 'active', contenu: "Lasilix 40 mg : 1 comprimé le matin\nBisoprolol 2,5 mg : 1 comprimé le matin", medecin_id: 'staff-medecin2' },
  { id: 'o4', patientId: 'p6', reference: 'ORD-2026-0288', date_emission: daysAgoDateOnly(95), statut: 'expiree', contenu: "Metformine 850 mg : 2 comprimés/jour (ancien schéma, remplacé)", medecin_id: 'staff-medecin3' },
  { id: 'o5', patientId: 'p9', reference: 'ORD-2026-0501', date_emission: daysAgoDateOnly(3), statut: 'active', contenu: "Complément nutritionnel oral hyperprotéiné : 2 briquettes/jour\nParacétamol si douleur", medecin_id: 'staff-medecin3' },
];

// ─── Documents ──────────────────────────────────────────────────────────────

export const documents = [
  { id: 'doc1', patientId: 'p1', nom: 'Compte-rendu consultation gériatrique.pdf', type_doc: 'Compte-rendu médical', created_at: daysAgoISO(5), taille_bytes: 245000 },
  { id: 'doc2', patientId: 'p1', nom: 'Bilan sanguin - juin 2026.pdf', type_doc: "Résultat d'analyse", created_at: daysAgoISO(20), taille_bytes: 189000 },
  { id: 'doc3', patientId: 'p2', nom: 'Compte-rendu hospitalisation neurologie.pdf', type_doc: 'Compte-rendu hospitalier', created_at: daysAgoISO(300), taille_bytes: 512000 },
  { id: 'doc4', patientId: 'p2', nom: 'IRM cérébrale.pdf', type_doc: 'Imagerie', created_at: daysAgoISO(310), taille_bytes: 3150000 },
  { id: 'doc5', patientId: 'p3', nom: 'Compte-rendu opératoire PTH.pdf', type_doc: 'Compte-rendu opératoire', created_at: daysAgoISO(130), taille_bytes: 198000 },
  { id: 'doc6', patientId: 'p9', nom: 'Ordonnance complément nutritionnel.pdf', type_doc: 'Ordonnance scannée', created_at: daysAgoISO(3), taille_bytes: 87000 },
];

// ─── Soins & pansements ─────────────────────────────────────────────────────

export const soinsPansements = [
  { id: 'sp1', patientId: 'p3', type_soin: 'plaie', stade: null, localisation: 'Hanche gauche (cicatrice PTH)', description: "Cicatrice calme, pas de signe d'infection, fils résorbables.", materiel: 'Pansement simple', date_soin: daysAgoISO(5), prochain_soin: daysFromNowDateOnly(2) },
  { id: 'sp2', patientId: 'p9', type_soin: 'escarre', stade: 'II', localisation: 'Talon gauche', description: "Rougeur ne blanchissant pas à la pression, peau intacte, prévention renforcée.", materiel: 'Mepitel, matelas à air', date_soin: hoursAgoISO(10), prochain_soin: daysFromNowDateOnly(1) },
  { id: 'sp3', patientId: 'p9', type_soin: 'escarre', stade: 'I', localisation: 'Sacrum', description: "Érythème simple, changes de position toutes les 3 heures.", materiel: 'Crème barrière', date_soin: daysAgoISO(2), prochain_soin: daysFromNowDateOnly(1) },
  { id: 'sp4', patientId: 'p10', type_soin: 'escarre', stade: 'II', localisation: 'Talon droit', description: "Bourgeonnement satisfaisant, diminution de la taille de la plaie de moitié depuis 3 semaines.", materiel: 'Hydrocellulaire', date_soin: hoursAgoISO(14), prochain_soin: daysFromNowDateOnly(3) },
  { id: 'sp5', patientId: 'p4', type_soin: 'catheter', stade: null, localisation: 'Bras gauche (voie veineuse périphérique)', description: "Point d'insertion propre, pas de signe inflammatoire, pansement refait.", materiel: 'Opsite', date_soin: daysAgoISO(1), prochain_soin: daysFromNowDateOnly(2) },
  { id: 'sp6', patientId: 'p2', type_soin: 'plaie', stade: null, localisation: 'Coude droit', description: "Petite dermabrasion suite à une chute sans gravité, désinfection réalisée.", materiel: 'Bétadine, compresses stériles', date_soin: hoursAgoISO(2), prochain_soin: daysFromNowDateOnly(1) },
];

// ─── Notes de suivi ─────────────────────────────────────────────────────────

export const notesSuivi = [
  { id: 'ns1', patientId: 'p1', contenu: "Madame Dubois participe activement aux ateliers de stimulation cognitive. Bon contact avec les autres résidents.", updated_at: hoursAgoISO(20) },
  { id: 'ns2', patientId: 'p1', contenu: "Quelques épisodes de désorientation temporelle en fin de journée (syndrome crépusculaire), rassurée par la présence soignante.", updated_at: daysAgoISO(4) },
  { id: 'ns3', patientId: 'p3', contenu: "Bonne dynamique de rééducation, motivation importante pour retrouver la marche.", updated_at: hoursAgoISO(30) },
  { id: 'ns4', patientId: 'p5', contenu: "Difficultés croissantes à la déglutition, orthophoniste sollicitée pour un bilan complet.", updated_at: hoursAgoISO(3) },
  { id: 'ns5', patientId: 'p9', contenu: "État général fragile, famille tenue informée de l'évolution de la dénutrition lors de la visite de la semaine dernière.", updated_at: daysAgoISO(2) },
  { id: 'ns6', patientId: 'p7', contenu: "Recrudescence de l'anxiété vespérale, mise en place de la musicothérapie en fin d'après-midi avec de bons résultats.", updated_at: hoursAgoISO(6) },
];

// ─── Agenda de la semaine ───────────────────────────────────────────────────

export const agenda = [
  { id: 'ag1',  resident_id: 'p1',  date_rdv: dateTimeAt(0, 9, 0),   duree_minutes: 30, type_rdv: 'Consultation', titre: 'Consultation de suivi gériatrique', statut: 'confirme', notes: null },
  { id: 'ag2',  resident_id: null, date_rdv: dateTimeAt(0, 10, 30),  duree_minutes: 60, type_rdv: 'Autre', titre: 'Atelier mémoire collectif', statut: 'planifie', notes: null },
  { id: 'ag3',  resident_id: 'p3',  date_rdv: dateTimeAt(0, 15, 0),   duree_minutes: 45, type_rdv: 'Autre', titre: 'Visite famille — fille de Mme Martin', statut: 'planifie', notes: null },
  { id: 'ag4',  resident_id: 'p2',  date_rdv: dateTimeAt(1, 9, 30),   duree_minutes: 45, type_rdv: 'Bilan', titre: 'Bilan kinésithérapie post-AVC', statut: 'planifie', notes: null },
  { id: 'ag5',  resident_id: null, date_rdv: dateTimeAt(1, 11, 0),   duree_minutes: 45, type_rdv: 'Autre', titre: 'Séance de gym douce', statut: 'planifie', notes: null },
  { id: 'ag6',  resident_id: 'p4',  date_rdv: dateTimeAt(2, 14, 0),   duree_minutes: 30, type_rdv: 'Spécialiste', titre: 'Consultation cardiologique', statut: 'planifie', notes: null },
  { id: 'ag7',  resident_id: 'p5',  date_rdv: dateTimeAt(3, 10, 0),   duree_minutes: 30, type_rdv: 'Autre', titre: 'Visite famille — fils de Mme Moreau', statut: 'planifie', notes: null },
  { id: 'ag8',  resident_id: null, date_rdv: dateTimeAt(3, 16, 0),   duree_minutes: 90, type_rdv: 'Autre', titre: "Loto de l'après-midi", statut: 'planifie', notes: null },
  { id: 'ag9',  resident_id: 'p6',  date_rdv: dateTimeAt(4, 9, 0),    duree_minutes: 20, type_rdv: 'Spécialiste', titre: 'Consultation dermatologique', statut: 'planifie', notes: null },
  { id: 'ag10', resident_id: null, date_rdv: dateTimeAt(5, 10, 0),   duree_minutes: 120, type_rdv: 'Autre', titre: 'Sortie au parc (résidents autonomes)', statut: 'planifie', notes: null },
  { id: 'ag11', resident_id: 'p7',  date_rdv: dateTimeAt(5, 15, 30),  duree_minutes: 30, type_rdv: 'Autre', titre: 'Visite famille — neveu de Mme Laurent', statut: 'planifie', notes: null },
  { id: 'ag12', resident_id: 'p8',  date_rdv: dateTimeAt(6, 9, 0),    duree_minutes: 30, type_rdv: 'Spécialiste', titre: 'Consultation ophtalmologique', statut: 'planifie', notes: null },
  { id: 'ag13', resident_id: 'p9',  date_rdv: dateTimeAt(6, 11, 0),   duree_minutes: 30, type_rdv: 'Bilan', titre: 'Bilan kinésithérapie de mobilisation passive', statut: 'planifie', notes: null },
  { id: 'ag14', resident_id: 'p10', date_rdv: dateTimeAt(-1, 9, 0),   duree_minutes: 30, type_rdv: 'Consultation', titre: 'Consultation de suivi post-transfert', statut: 'effectue', notes: 'Compte-rendu transmis à l\'unité de soins de longue durée.' },
];

// ─── Tournées 24H (planning « soins du jour ») ──────────────────────────────

export const tourneesSoins = [
  { id: 'ts1', resident_id: 'p1', date_soin: todayDateOnly(), type_tournee: 'matinale', type_toilette: 'complete_lit', habillage: true, prevention_escarres: false, repas: 'pris', nb_verres_eau: 2, mode_elimination: 'toilettes', urines: 'ok', selles: 'ok_moulees', protection_type: null, transmission: null },
  { id: 'ts2', resident_id: 'p2', date_soin: todayDateOnly(), type_tournee: 'matinale', type_toilette: 'douche', habillage: true, prevention_escarres: true, repas: 'pris', nb_verres_eau: 1, mode_elimination: 'change', urines: 'ok', selles: 'rien', protection_type: 'change_complet', transmission: "Aide au transfert fauteuil difficile ce matin, spasticité importante du membre supérieur droit." },
  { id: 'ts3', resident_id: 'p4', date_soin: todayDateOnly(), type_tournee: 'matinale', type_toilette: 'partielle_lit', habillage: true, prevention_escarres: false, repas: 'partiel', nb_verres_eau: 2, mode_elimination: 'toilettes', urines: 'ok', selles: 'ok_moulees', protection_type: null, transmission: null },
  { id: 'ts4', resident_id: 'p9', date_soin: todayDateOnly(), type_tournee: 'matinale', type_toilette: 'complete_lit', habillage: true, prevention_escarres: true, repas: 'refus', nb_verres_eau: 1, mode_elimination: 'change', urines: 'saturees', selles: 'rien', protection_type: 'change_complet', transmission: "Talon gauche : érythème à surveiller, prévention escarres renforcée." },
  { id: 'ts5', resident_id: 'p10', date_soin: todayDateOnly(), type_tournee: 'matinale', type_toilette: 'complete_lit', habillage: true, prevention_escarres: true, repas: 'pris', nb_verres_eau: 2, mode_elimination: 'change', urines: 'ok', selles: 'ok_moulees', protection_type: 'anatomique', transmission: null },
  { id: 'ts6', resident_id: 'p1', date_soin: todayDateOnly(), type_tournee: 'dejeuner', repas: 'pris', nb_verres_eau: 2 },
  { id: 'ts7', resident_id: 'p6', date_soin: todayDateOnly(), type_tournee: 'dejeuner', repas: 'partiel', nb_verres_eau: 1, transmission: "Glycémie avant repas à 2,1 g/L, resucrage non nécessaire, contrôle avant la collation." },
  { id: 'ts8', resident_id: 'p9', date_soin: todayDateOnly(), type_tournee: 'dejeuner', repas: 'refus', nb_verres_eau: 1, transmission: "Refus quasi complet du repas du midi, alerte transmise à l'équipe." },
  { id: 'ts9', resident_id: 'p5', date_soin: todayDateOnly(), type_tournee: 'soir', repas: 'pris', nb_verres_eau: 3, mode_elimination: 'toilettes', urines: 'ok', selles: 'ok_moulees', protection_type: null },
  { id: 'ts10', resident_id: 'p2', date_soin: todayDateOnly(), type_tournee: 'soir', repas: 'pris', nb_verres_eau: 2, mode_elimination: 'change', urines: 'ok', selles: 'ok_moulees', protection_type: 'change_complet' },
];

// ─── Journal d'audit ────────────────────────────────────────────────────────

export const auditLogs = [
  { id: 'al1', created_at: hoursAgoISO(1), action: 'LOGIN', table_name: null, user_role: 'cadre', details: { message: 'Connexion réussie' } },
  { id: 'al2', created_at: hoursAgoISO(2), action: 'CREATE', table_name: 'transmissions', user_role: 'infirmiere', details: { patient: 'LAMBERT Henri' } },
  { id: 'al3', created_at: hoursAgoISO(9), action: 'UPDATE', table_name: 'traitements', user_role: 'medecin', details: { medicament: 'Lasilix', patient: 'PETIT Robert' } },
  { id: 'al4', created_at: hoursAgoISO(2), action: 'CREATE', table_name: 'chutes', user_role: 'infirmiere', details: { patient: 'LAMBERT Henri' } },
  { id: 'al5', created_at: daysAgoISO(6), action: 'UPDATE', table_name: 'profiles', user_role: 'admin_crm', details: { compte: 'K. Benali', changement: 'activation du compte' } },
  { id: 'al6', created_at: daysAgoISO(15), action: 'DELETE', table_name: 'profiles', user_role: 'admin_crm', details: { compte: 'ancien stagiaire' } },
];

// ─── Données de pilotage complémentaires (flaveur « établissement ») ────────
// Non consommées directement par stats.js (qui recalcule tout depuis les
// tableaux ci-dessus) mais exposées via /stats pour un usage futur / démo.

export const etablissementStats = {
  totalResidents: 47,
  tauxOccupation: 94,
  girMoyen: 3.2,
  chutes90Jours: 12,
};
