/**
 * [ candy-e ] — TESTS UNITAIRES : transitions de statut RNIV
 * Fichier : identite/rniv.test.js
 *
 * node:test / node:assert — aucune dépendance de test ajoutée (Node >= 20,
 * cf. package.json).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ErreurRNIV,
  creerIdentiteProvisoire,
  mettreAJourTraitsStricts,
  recupererDepuisINSi,
  validerParJustificatif,
  marquerIdentiteFictive,
} = require('./rniv');

const MATRICULE_VALIDE = '269032812345678';
const OID_NIR = '1.2.250.1.213.1.4.8';

function identiteDeBase(overrides = {}) {
  return creerIdentiteProvisoire({
    nom_naissance: 'DUPONT',
    premier_prenom_naissance: 'Marie',
    liste_prenoms: ['Marie', 'Jeanne'],
    date_naissance: '1952-03-12',
    sexe: 'F',
    code_insee_lieu_naissance: '69003',
    ...overrides,
  });
}

test('creerIdentiteProvisoire renvoie une identité PROVISOIRE', () => {
  const identite = identiteDeBase();
  assert.equal(identite.statut_identite, 'PROVISOIRE');
  assert.equal(identite.matricule_ins, null);
});

test('creerIdentiteProvisoire rejette un trait obligatoire manquant', () => {
  assert.throws(() => creerIdentiteProvisoire({ nom_naissance: 'DUPONT' }), ErreurRNIV);
});

test('recupererDepuisINSi avec un matricule valide passe en RECUPEREE', () => {
  const identite = identiteDeBase();
  const maj = recupererDepuisINSi(identite, { matriculeIns: MATRICULE_VALIDE, oidIns: OID_NIR });
  assert.equal(maj.statut_identite, 'RECUPEREE');
  assert.equal(maj.matricule_ins, MATRICULE_VALIDE);
});

test('recupererDepuisINSi rejette un format de matricule invalide', () => {
  const identite = identiteDeBase();
  assert.throws(
    () => recupererDepuisINSi(identite, { matriculeIns: '12345', oidIns: OID_NIR }),
    ErreurRNIV
  );
});

test('validerParJustificatif avec un justificatif accepté passe en VALIDEE', () => {
  const identite = identiteDeBase();
  const maj = validerParJustificatif(identite, { justificatifType: 'CNI' });
  assert.equal(maj.statut_identite, 'VALIDEE');
});

test('validerParJustificatif rejette un justificatif non reconnu', () => {
  const identite = identiteDeBase();
  assert.throws(() => validerParJustificatif(identite, { justificatifType: 'carte_vitale' }), ErreurRNIV);
});

test('RECUPEREE puis justificatif fort => QUALIFIEE avec date_qualification posée', () => {
  let identite = identiteDeBase();
  identite = recupererDepuisINSi(identite, { matriculeIns: MATRICULE_VALIDE, oidIns: OID_NIR });
  identite = validerParJustificatif(identite, { justificatifType: 'CNI' });
  assert.equal(identite.statut_identite, 'QUALIFIEE');
  assert.ok(identite.date_qualification instanceof Date);
});

test('VALIDEE puis INSi => QUALIFIEE (ordre inverse)', () => {
  let identite = identiteDeBase();
  identite = validerParJustificatif(identite, { justificatifType: 'passeport' });
  identite = recupererDepuisINSi(identite, { matriculeIns: MATRICULE_VALIDE, oidIns: OID_NIR });
  assert.equal(identite.statut_identite, 'QUALIFIEE');
});

test('mettreAJourTraitsStricts refuse la saisie manuelle du matricule INS', () => {
  const identite = identiteDeBase();
  assert.throws(
    () => mettreAJourTraitsStricts(identite, { matricule_ins: MATRICULE_VALIDE }),
    ErreurRNIV
  );
});

test('mettreAJourTraitsStricts rétrograde une identité QUALIFIEE si un trait strict change', () => {
  let identite = identiteDeBase();
  identite = recupererDepuisINSi(identite, { matriculeIns: MATRICULE_VALIDE, oidIns: OID_NIR });
  identite = validerParJustificatif(identite, { justificatifType: 'CNI' });
  assert.equal(identite.statut_identite, 'QUALIFIEE');

  const corrige = mettreAJourTraitsStricts(identite, { nom_naissance: 'DUPOND' });
  assert.equal(corrige.statut_identite, 'PROVISOIRE');
  assert.equal(corrige.matricule_ins, null);
  assert.equal(corrige.oid_ins, null);
  assert.equal(corrige.justificatif_type, null);
  assert.equal(corrige.date_qualification, null);
});

test('mettreAJourTraitsStricts ne rétrograde pas si la valeur ne change pas réellement', () => {
  let identite = identiteDeBase();
  identite = recupererDepuisINSi(identite, { matriculeIns: MATRICULE_VALIDE, oidIns: OID_NIR });
  identite = validerParJustificatif(identite, { justificatifType: 'CNI' });

  const inchange = mettreAJourTraitsStricts(identite, { nom_naissance: 'DUPONT' });
  assert.equal(inchange.statut_identite, 'QUALIFIEE');
});

test('marquerIdentiteFictive empêche toute récupération INSi ultérieure', () => {
  const identite = marquerIdentiteFictive(identiteDeBase());
  assert.equal(identite.statut_identite, 'PROVISOIRE');
  assert.throws(
    () => recupererDepuisINSi(identite, { matriculeIns: MATRICULE_VALIDE, oidIns: OID_NIR }),
    ErreurRNIV
  );
});
