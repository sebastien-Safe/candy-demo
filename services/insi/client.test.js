/**
 * [ candy-e ] — TESTS : client INSi
 * Fichier : services/insi/client.test.js
 *
 * Entièrement mockés (transport HTTPS injecté) — aucun réseau ni
 * certificat réel requis pour `npm test`. Un smoke test optionnel contre
 * le vrai endpoint CNDA s'active automatiquement si INSI_CERT_PATH /
 * INSI_CERT_PASSWORD / INSI_ENDPOINT sont renseignés avec un certificat
 * lisible (cf. exigence "mock si certificats non disponibles").
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { analyserReponse } = require('./envelopes');
const { rechercherIdentite, verifierIdentite, MAX_TENTATIVES } = require('./client');
const { TRAITS_BASE, DOSSIERS_RECHERCHE, DOSSIERS_VERIFICATION } = require('./__fixtures__/dossiers-test');

const CERT_FICTIF = path.join(__dirname, '__fixtures__', 'dummy-cert.fixture');

// Traits et matricule/OID à ne jamais retrouver dans un payload d'audit.
const CLES_SENSIBLES = ['nomNaissance', 'premierPrenomNaissance', 'dateNaissance', 'matriculeIns', 'oidIns', 'DUPONT', 'Marie'];

function contientDonneesSensibles(objet) {
  const texte = JSON.stringify(objet);
  return CLES_SENSIBLES.some((cle) => texte.includes(cle));
}

test('analyserReponse — dossiers de recherche placeholder', () => {
  for (const dossier of DOSSIERS_RECHERCHE) {
    const resultat = analyserReponse(dossier.xmlReponse, 'recherche');
    assert.equal(resultat.type, dossier.resultatAttendu, `dossier ${dossier.nom}`);
    assert.ok(!contientDonneesSensibles(resultat.audit), `audit du dossier ${dossier.nom} ne doit contenir aucun trait`);
  }
});

test('analyserReponse — dossiers de vérification placeholder', () => {
  for (const dossier of DOSSIERS_VERIFICATION) {
    const resultat = analyserReponse(dossier.xmlReponse, 'verification');
    assert.equal(resultat.type, dossier.resultatAttendu, `dossier ${dossier.nom}`);
    assert.ok(!contientDonneesSensibles(resultat.audit), `audit du dossier ${dossier.nom} ne doit contenir aucun trait`);
  }
});

test('analyserReponse — identités multiples jamais résolues automatiquement', () => {
  const dossier = DOSSIERS_RECHERCHE.find((d) => d.nom === 'plusieurs_identites');
  const resultat = analyserReponse(dossier.xmlReponse, 'recherche');
  assert.equal(resultat.type, 'PLUSIEURS_IDENTITES');
  assert.equal(resultat.identite, null);
});

function definirEnvInsiFictif() {
  process.env.INSI_CERT_PATH = CERT_FICTIF;
  process.env.INSI_CERT_PASSWORD = 'mot-de-passe-test';
  process.env.INSI_ENDPOINT = 'https://cnda-test.example.invalid/insi';
  process.env.LPS_NOM = 'CANDY-E';
  process.env.LPS_VERSION = '0.1.0-test';
  process.env.LPS_NIL = 'NIL-TEST';
}

test('rechercherIdentite — IDENTITE_UNIQUE via transport injecté', async () => {
  definirEnvInsiFictif();

  const dossier = DOSSIERS_RECHERCHE.find((d) => d.nom === 'identite_unique');
  const effectuerRequete = async () => dossier.xmlReponse;

  const resultat = await rechercherIdentite(TRAITS_BASE, { effectuerRequete });
  assert.equal(resultat.type, 'IDENTITE_UNIQUE');
  assert.equal(resultat.identite.matriculeIns, '269032812345678');
  assert.equal(resultat.audit.tentatives, 1);
});

test('rechercherIdentite — configuration INSi incomplète => ERREUR_TECHNIQUE sans exception', async () => {
  const envAvant = { ...process.env };
  delete process.env.INSI_CERT_PATH;

  try {
    const resultat = await rechercherIdentite(TRAITS_BASE, { effectuerRequete: async () => '' });
    assert.equal(resultat.type, 'ERREUR_TECHNIQUE');
    assert.equal(resultat.audit.raison, 'configuration_insi_incomplete');
  } finally {
    process.env = envAvant;
  }
});

test('rechercherIdentite — retry borné : succès après 2 échecs réseau', async () => {
  definirEnvInsiFictif();

  const dossier = DOSSIERS_RECHERCHE.find((d) => d.nom === 'identite_unique');
  let appels = 0;
  const effectuerRequete = async () => {
    appels += 1;
    if (appels < 3) {
      const err = new Error('reset');
      err.code = 'ECONNRESET';
      throw err;
    }
    return dossier.xmlReponse;
  };

  const resultat = await rechercherIdentite(TRAITS_BASE, { effectuerRequete });
  assert.equal(resultat.type, 'IDENTITE_UNIQUE');
  assert.equal(resultat.audit.tentatives, 3);
  assert.equal(appels, 3);
});

test('rechercherIdentite — retry borné : abandon après MAX_TENTATIVES échecs réseau', async () => {
  definirEnvInsiFictif();

  let appels = 0;
  const effectuerRequete = async () => {
    appels += 1;
    const err = new Error('timeout');
    err.code = 'ETIMEDOUT';
    throw err;
  };

  const resultat = await rechercherIdentite(TRAITS_BASE, { effectuerRequete });
  assert.equal(resultat.type, 'ERREUR_TECHNIQUE');
  assert.equal(appels, MAX_TENTATIVES);
  assert.equal(resultat.audit.tentatives, MAX_TENTATIVES);
});

test('rechercherIdentite — erreur non retryable (4xx applicatif) : un seul essai', async () => {
  definirEnvInsiFictif();

  let appels = 0;
  const effectuerRequete = async () => {
    appels += 1;
    const err = new Error('bad request');
    err.statusHttp = 400;
    throw err;
  };

  const resultat = await rechercherIdentite(TRAITS_BASE, { effectuerRequete });
  assert.equal(resultat.type, 'ERREUR_TECHNIQUE');
  assert.equal(appels, 1);
});

test('verifierIdentite — VERIFICATION_KO via transport injecté', async () => {
  definirEnvInsiFictif();

  const dossier = DOSSIERS_VERIFICATION.find((d) => d.nom === 'verification_ko');
  const effectuerRequete = async () => dossier.xmlReponse;

  const resultat = await verifierIdentite(
    TRAITS_BASE,
    { matriculeIns: dossier.matriculeIns, oidIns: dossier.oidIns },
    { effectuerRequete }
  );
  assert.equal(resultat.type, 'VERIFICATION_KO');
});

// ---------------------------------------------------------------------
// Smoke test optionnel contre le vrai endpoint CNDA — auto-désactivé si
// aucun certificat réel n'est configuré (cf. exigence "mock si certificats
// non disponibles").
// ---------------------------------------------------------------------
function certificatReelDisponible() {
  const { INSI_CERT_PATH, INSI_CERT_PASSWORD, INSI_ENDPOINT } = process.env;
  if (!INSI_CERT_PATH || !INSI_CERT_PASSWORD || !INSI_ENDPOINT) return false;
  if (INSI_CERT_PATH === CERT_FICTIF) return false;
  return fs.existsSync(INSI_CERT_PATH);
}

test('rechercherIdentite — smoke test réel contre CNDA', { skip: !certificatReelDisponible() }, async () => {
  const resultat = await rechercherIdentite(TRAITS_BASE);
  assert.ok(['IDENTITE_UNIQUE', 'AUCUNE_IDENTITE', 'PLUSIEURS_IDENTITES'].includes(resultat.type));
});
