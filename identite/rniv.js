/**
 * [ candy-e ] — RÈGLES MÉTIER RNIV (Référentiel National d'Identitovigilance)
 * Fichier : identite/rniv.js
 *
 * Module pur (aucune dépendance DB/Express) : chaque fonction prend un objet
 * "identite" (reflet d'une ligne public.identites, cf.
 * database/migrations/003_identite_rniv.sql) et retourne un nouvel objet,
 * sans effet de bord ni accès base — la persistance reste à la charge de
 * l'appelant (futur routeur résidents).
 *
 * Cycle de vie : PROVISOIRE -> RECUPEREE (INSi) / VALIDEE (justificatif
 * fort) -> QUALIFIEE (les deux réunis). Toute modification d'un trait
 * strict rétrograde en PROVISOIRE. Le matricule INS ne se saisit jamais à
 * la main : seule recupererDepuisINSi() est autorisée à le poser (modélise
 * le retour du téléservice INSi, dont l'appel réel est hors périmètre —
 * cf. commentaire /api/insi dans server.js).
 */

const STATUTS_IDENTITE = Object.freeze(['PROVISOIRE', 'RECUPEREE', 'VALIDEE', 'QUALIFIEE']);

// Traits d'identité stricts : toute correction de l'un d'eux invalide la
// qualification précédente (règle centrale du RNIV).
const TRAITS_STRICTS = Object.freeze([
  'nom_naissance',
  'premier_prenom_naissance',
  'liste_prenoms',
  'date_naissance',
  'sexe',
  'code_insee_lieu_naissance',
]);

// Sous-ensemble des traits stricts exigés à la création (les autres —
// liste_prenoms, code_insee_lieu_naissance — restent facultatifs, cf.
// database/migrations/003_identite_rniv.sql, colonnes nullable).
const TRAITS_OBLIGATOIRES = Object.freeze(['nom_naissance', 'premier_prenom_naissance', 'date_naissance', 'sexe']);

const JUSTIFICATIFS_ACCEPTES = Object.freeze(['CNI', 'passeport', 'titre_sejour', 'permis_conduire']);

const REGEX_MATRICULE_INS = /^[0-9]{15}$/;

class ErreurRNIV extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErreurRNIV';
  }
}

function egal(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((valeur, i) => valeur === b[i]);
  }
  return a === b;
}

/**
 * Construit une identité neuve en PROVISOIRE à partir des traits stricts
 * connus à l'admission (ou par le script de reprise).
 */
function creerIdentiteProvisoire(traits) {
  for (const trait of TRAITS_OBLIGATOIRES) {
    if (traits[trait] === undefined || traits[trait] === null || traits[trait] === '') {
      throw new ErreurRNIV(`Trait strict manquant : ${trait}`);
    }
  }

  return {
    nom_naissance: traits.nom_naissance,
    premier_prenom_naissance: traits.premier_prenom_naissance,
    liste_prenoms: traits.liste_prenoms ?? [],
    date_naissance: traits.date_naissance,
    sexe: traits.sexe,
    code_insee_lieu_naissance: traits.code_insee_lieu_naissance ?? null,
    matricule_ins: null,
    oid_ins: null,
    statut_identite: 'PROVISOIRE',
    identite_fictive: false,
    identite_douteuse: false,
    date_qualification: null,
    justificatif_type: null,
  };
}

/**
 * Seul point d'entrée pour corriger l'état civil d'un résident. Rejette
 * toute clé hors des traits stricts (donc, explicitement, matricule_ins/
 * oid_ins/statut_identite/justificatif_type/date_qualification — chacun a
 * sa propre fonction dédiée). Si au moins un trait strict change réellement
 * de valeur, l'identité est rétrogradée en PROVISOIRE.
 */
function mettreAJourTraitsStricts(identite, patch) {
  const clesInterdites = Object.keys(patch).filter((cle) => !TRAITS_STRICTS.includes(cle));
  if (clesInterdites.length > 0) {
    throw new ErreurRNIV(
      `Champ(s) non modifiable(s) via mettreAJourTraitsStricts : ${clesInterdites.join(', ')}. ` +
        'Le matricule INS ne se saisit jamais à la main (cf. recupererDepuisINSi) ; ' +
        'le justificatif et le statut ont leurs propres fonctions dédiées.'
    );
  }

  const traitModifie = TRAITS_STRICTS.some((trait) => trait in patch && !egal(patch[trait], identite[trait]));
  const identiteMaj = { ...identite, ...patch };

  if (!traitModifie) {
    return identiteMaj;
  }

  return {
    ...identiteMaj,
    matricule_ins: null,
    oid_ins: null,
    justificatif_type: null,
    date_qualification: null,
    statut_identite: 'PROVISOIRE',
  };
}

/**
 * Unique fonction autorisée à poser matricule_ins/oid_ins — modélise le
 * retour du téléservice INSi (l'appel réel au téléservice est hors
 * périmètre de ce module).
 */
function recupererDepuisINSi(identite, { matriculeIns, oidIns }) {
  if (identite.identite_fictive) {
    throw new ErreurRNIV('Une identité fictive ne peut pas être récupérée via le téléservice INSi.');
  }
  if (!REGEX_MATRICULE_INS.test(matriculeIns)) {
    throw new ErreurRNIV(`Format de matricule INS invalide : attendu 15 chiffres, reçu "${matriculeIns}".`);
  }
  if (!oidIns) {
    throw new ErreurRNIV('OID INS manquant.');
  }

  return deriverStatut({ ...identite, matricule_ins: matriculeIns, oid_ins: oidIns });
}

/**
 * Valide l'identité sur présentation d'un justificatif à haut niveau de
 * confiance.
 */
function validerParJustificatif(identite, { justificatifType }) {
  if (identite.identite_fictive) {
    throw new ErreurRNIV('Une identité fictive ne peut pas être validée par justificatif.');
  }
  if (!JUSTIFICATIFS_ACCEPTES.includes(justificatifType)) {
    throw new ErreurRNIV(
      `Justificatif non accepté : "${justificatifType}". Attendu l'un de : ${JUSTIFICATIFS_ACCEPTES.join(', ')}.`
    );
  }

  return deriverStatut({ ...identite, justificatif_type: justificatifType });
}

/**
 * Signale une identité fictive (résident non identifiable à l'admission,
 * ex. urgence). Une identité fictive ne peut jamais être qualifiée : le
 * marquage rétrograde et efface tout élément de qualification acquis.
 */
function marquerIdentiteFictive(identite) {
  return {
    ...identite,
    identite_fictive: true,
    matricule_ins: null,
    oid_ins: null,
    justificatif_type: null,
    date_qualification: null,
    statut_identite: 'PROVISOIRE',
  };
}

/**
 * Signale un doute sur l'identité (suspicion d'homonymie, d'erreur de
 * saisie, etc.). Mêmes effets de bord qu'une correction de trait strict :
 * la confiance acquise n'est plus valable tant que le doute n'a pas été
 * levé par une nouvelle vérification complète.
 */
function signalerIdentiteDouteuse(identite) {
  return {
    ...identite,
    identite_douteuse: true,
    matricule_ins: null,
    oid_ins: null,
    justificatif_type: null,
    date_qualification: null,
    statut_identite: 'PROVISOIRE',
  };
}

/**
 * QUALIFIEE = RECUPEREE (matricule_ins + oid_ins présents) ET VALIDEE
 * (justificatif_type présent), simultanément. Pose date_qualification à
 * l'entrée dans QUALIFIEE, l'efface dès qu'on en sort.
 */
function deriverStatut(identite) {
  const recuperee = Boolean(identite.matricule_ins && identite.oid_ins);
  const validee = Boolean(identite.justificatif_type);

  let statut = 'PROVISOIRE';
  if (recuperee && validee) statut = 'QUALIFIEE';
  else if (recuperee) statut = 'RECUPEREE';
  else if (validee) statut = 'VALIDEE';

  const devientQualifiee = statut === 'QUALIFIEE' && identite.statut_identite !== 'QUALIFIEE';

  return {
    ...identite,
    statut_identite: statut,
    date_qualification: statut === 'QUALIFIEE' ? (devientQualifiee ? new Date() : identite.date_qualification) : null,
  };
}

module.exports = {
  STATUTS_IDENTITE,
  TRAITS_STRICTS,
  JUSTIFICATIFS_ACCEPTES,
  ErreurRNIV,
  creerIdentiteProvisoire,
  mettreAJourTraitsStricts,
  recupererDepuisINSi,
  validerParJustificatif,
  marquerIdentiteFictive,
  signalerIdentiteDouteuse,
  deriverStatut,
};
